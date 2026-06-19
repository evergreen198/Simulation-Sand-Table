//后端接口文件,使用express框架
import ollama from "ollama"
import { agentLLMMap,EnvAgent } from '../client/src/OllamaAgents/OllamaAgentsSetting';
import {DecisionInput} from '../client/src/store/decisionProcessing/decisionInterface';
import { summarizeMemo } from '../client/src/memoryManagement/memoSearcher';
import { Action } from '../client/src/types/Action';
import { summarizeSocialMemo } from '../client/src/memoryManagement/memoSearcher';
import type {Agent} from '../client/src/types/AgentType';
import express,{ type Request, type Response} from 'express';
import type { HostFinalSummary } from '../client/src/hostSummary/hostTypes';
import { fallbackRoundSummary, fallbackFinalSummary } from '../client/src/hostSummary/hostStats';

const app = express();
const port = 3000;
const VALID_ACTIONS = new Set(["gather", "attack", "cooperate", "defend", "wait", "dead"]) as Set<Action["type"]>
app.use(express.json())

function parseJsonText(rawText: string): unknown {
  let text = rawText.trim()
  if (text.startsWith("```")) {
    text = text
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim()
  }
  return JSON.parse(text)
}

function parseInviteDecision(rawText: string): "accept" | "reject" {
  let parsed: unknown
  try {
    parsed = parseJsonText(rawText)
  } catch {
    return "reject"
  }
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) return "reject"
    parsed = parsed[0]
  }
  if (parsed === null || typeof parsed !== "object") return "reject"
  const decision = (parsed as Record<string, unknown>).decision
  if (decision === "accept" || decision === "reject") return decision
  return "reject"
}

app.post('/api/decision/action', async (req: Request<DecisionInput>, res: Response<Action>) => {
    const cfg = agentLLMMap[req.body.agentStage.id]
  if (!cfg) {
    throw new Error(`Agent "${req.body.agentStage.id}" 未在 OllamaAgentsSetting.agentLLMMap 中配置`)
  }

  const aliveOthers = req.body.agents.filter(
    (a: Agent) => a.state.alive && a.id !== req.body.agentStage.id,
  )

  const othersDesc =
    aliveOthers.length === 0
      ? "（当前无其他存活 agent）"
      : aliveOthers
        .map((a: Agent) => `${a.id}(HP=${a.state.hp} 资源=${a.state.resource})`)
        .join("，")

  const userPrompt =
      `当前是第 ${req.body.envRound.round} 回合。\n` +
    `你的 ID：${req.body.agentStage.id}\n` +
    `你的状态：HP=${req.body.agentStage.state.hp}，资源=${req.body.agentStage.state.resource}\n` +
    `其他存活 agent：${othersDesc}\n` +
    `环境剩余资源：${req.body.envRound.currentSource}/${req.body.envInit.resourceTotal}\n` +
    `你的目标：${req.body.agentStage.goal}\n\n` +
    `可用动作：\n` +
    `- { "type": "gather" }\n` +
    `- { "type": "attack", "target": "<对方ID>" }\n` +
    `- { "type": "cooperate", "target": "<对方ID>" }\n` +
    `- { "type": "defend" }\n` +
    `- { "type": "wait" }\n` +
    `注意：不能攻击自己，不能攻击已死亡的 agent。cooperate 对象必须存活。\n` +
    `只返回一行纯 JSON，不要 markdown 代码块，不要任何额外文字。`+
    `${summarizeMemo(req.body.agentStage)}\n` 

  const response = await ollama.chat({
    model: cfg.model,
    messages: [
      { role: "system", content: cfg.systemPrompt },
      { role: "user", content: userPrompt },
    ],
    format: "json",
    options: { temperature: cfg.temperature },
  })

  // 解析并做轻量校验
  let rawText = response.message.content?.trim()
  if (!rawText) {
    throw new Error("Ollama 返回了空内容")
  }

  // 容错：如果被 markdown 代码块包裹，去掉 ```
  if (rawText.startsWith("```")) {
    rawText = rawText
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```\s*$/, "")
      .trim()
  }

  // 容错：如果 LLM 返回了数组（如 ["gather"]），取第一个
  let parsed: unknown
  try {
    parsed = JSON.parse(rawText)
  } catch {
    throw new Error(`Ollama 返回了无法解析的 JSON：${rawText}`)
  }

  // 如果是数组，取第一个元素
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) {
      throw new Error("Ollama 返回了空数组")
    }
    parsed = parsed[0]
  }

  if (parsed === null || typeof parsed !== "object") {
    throw new Error(`Ollama 返回的不是 JSON 对象：${rawText}`)
  }

  const obj = parsed as Record<string, unknown>

  // 校验 type 字段
  if (typeof obj.type !== "string" || !VALID_ACTIONS.has(obj.type as Action["type"])) {
    throw new Error(
      `Ollama 返回的动作类型 "${obj.type}" 不合法。合法值：${[...VALID_ACTIONS].join(", ")}`,
    )
  }

  const type = obj.type as Action["type"]

  // attack / cooperate 必须有 target
  if (type === "attack" || type === "cooperate") {
    if (typeof obj.target !== "string" || obj.target.length === 0) {
      throw new Error(`Ollama 返回的 ${type} 缺少 target 字段`)
    }
    res.json({ type, target: obj.target } as Action)
    return
  }

  // gather / defend / wait / dead 不需要 target
  if (
    type === "gather" ||
    type === "defend" ||
    type === "wait" ||
    type === "dead"
  ) {
    res.json({ type } as Action)
    return
  }

  // 兜底（不应该到达这里）
  throw new Error(`未知的动作类型：${type}`)
})

app.post('/api/decision/cooperate',async (req, res) => {
  const cfg = agentLLMMap[req.body.target.id]
  const input = req.body
  if (!cfg){
    res.json("reject")
    return
  }

  const userPrompt =
    `当前是第 ${input.envRound.round} 回合。\n` +
    `你的 ID：${input.target.id}\n` +
    `你的状态：HP=${input.target.state.hp}，资源=${input.target.state.resource}\n` +
    `环境剩余资源：${input.envRound.currentSource}/${input.envInit.resourceTotal}\n` +
    `你的目标：${input.target.goal}\n\n` +
    `你被 ${input.inviter.id} 邀请合作\n` +
    `你与他之前的社交记忆：\n` +
    `${summarizeSocialMemo(input.target, input.inviter)}\n` +
    `ta的性格参数：risk=${input.inviter.traits.risk}，greed=${input.inviter.traits.greed}，social=${input.inviter.traits.social}，aggression=${input.inviter.traits.aggression}\n` +
    `ta当前状态：HP=${input.inviter.state.hp}，资源=${input.inviter.state.resource}\n` +
    `ta的当前被接受度：${input.inviter.state.beAcceptedCurrent}\n` +
    `ta的原始被接受度：beAcceptedBase=${input.inviter.traits.beAcceptedBase}\n` +
    `ta的目标：${input.inviter.goal}\n` +
    `请选择是否接受邀请：\n` +
    `- "accept": 接受邀请\n` +
    `- "reject": 拒绝邀请\n` +
    `只返回一行纯 JSON，格式为 {"decision": "accept" | "reject"}，不要 markdown 代码块，不要任何额外文字。`

  try {
    const response = await ollama.chat({
      model: cfg.model,
      messages: [
        { role: "system", content: cfg.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      format: "json",
      options: { temperature: cfg.temperature },
    })

    const rawText = response.message.content?.trim()
    if (!rawText){
      res.json("reject")
      return
    }
    const decision = parseInviteDecision(rawText)
    res.json(decision)
    return
  } catch {
    res.json("reject")
    return
  }
});

app.post('/api/host/roundsummary',async (req, res) => {
  const facts = req.body
  const userPrompt =
  `以下是第 ${facts.round} 回合的系统事实（JSON）：\n` +
  `${JSON.stringify(facts)}\n\n` +
  `请根据以上事实输出 JSON：\n` +
  `{"summary":"本轮局势一句话","events":["特殊事件描述"],"memberDynamics":{"agentId":"该成员本轮动态"}}\n` +
  `events 应基于 roundEvents；若无特殊事件可返回空数组。memberDynamics 的 key 使用 agentSnapshots 中的 id。`

try {
  const response = await ollama.chat({
    model: EnvAgent.model,
    messages: [
      { role: "system", content: EnvAgent.systemPrompt },
      { role: "user", content: userPrompt },
    ],
    format: "json",
    options: { temperature: EnvAgent.temperature },
  })

  const rawText = response.message.content?.trim()
  if (!rawText){ 
    res.json(fallbackRoundSummary(facts))
    return
  }

  const parsed = parseJsonText(rawText) as Record<string, unknown>
  const summary =
    typeof parsed.summary === "string"
      ? parsed.summary
      : fallbackRoundSummary(facts).summary
  const events = Array.isArray(parsed.events)
    ? parsed.events.filter((e): e is string => typeof e === "string")
    : facts.roundEvents
  const memberDynamics: Record<string, string> = {}
  if (parsed.memberDynamics && typeof parsed.memberDynamics === "object") {
    for (const [k, v] of Object.entries(
      parsed.memberDynamics as Record<string, unknown>,
    )) {
      if (typeof v === "string") memberDynamics[k] = v
    }
  }
  if (Object.keys(memberDynamics).length === 0) {
    Object.assign(memberDynamics, fallbackRoundSummary(facts).memberDynamics)
  }

  res.json({ round: facts.round, summary, events, memberDynamics })
  return
} catch {
  res.json(fallbackRoundSummary(facts))
  return
}
});

app.post('/api/host/finalsummary',async (req, res) => {
  const { facts, winners } = req.body
  const userPrompt =
    `以下是本次仿真的全局事实（JSON）：\n` +
    `${JSON.stringify(facts)}\n\n` +
    `系统已计算的胜利者（不得修改）：\n` +
    `${JSON.stringify(winners)}\n\n` +
    `请输出 JSON：\n` +
    `{"globalSituation":${JSON.stringify(facts.globalSituation)},"specialEvents":[...],"winners":${JSON.stringify(winners)},"narrative":"200字以内的全局总结"}\n` +
    `specialEvents 可基于 facts.specialEvents 归纳；winners 必须与上面完全一致。`

  try {
    const response = await ollama.chat({
      model: EnvAgent.model,
      messages: [
        { role: "system", content: EnvAgent.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      format: "json",
      options: { temperature: EnvAgent.temperature },
    })

    const rawText = response.message.content?.trim()
    if (!rawText){
      res.json(fallbackFinalSummary(facts, winners))
      return
    }

    const parsed = parseJsonText(rawText) as Record<string, unknown>
    const narrative =
      typeof parsed.narrative === "string"
        ? parsed.narrative
        : fallbackFinalSummary(facts, winners).narrative
    const specialEvents = Array.isArray(parsed.specialEvents)
      ? parsed.specialEvents.filter((e): e is string => typeof e === "string")
      : facts.specialEvents

    const gs = parsed.globalSituation
    const globalSituation =
      gs && typeof gs === "object" && !Array.isArray(gs)
        ? { ...facts.globalSituation, ...(gs as HostFinalSummary["globalSituation"]) }
        : facts.globalSituation

    res.json({
      globalSituation,
      specialEvents,
      winners,
      narrative,
    })
    return
  } catch {
    res.json(fallbackFinalSummary(facts, winners))
    return
  }
});

app.listen(port, () => {
  console.log(`server running at http://localhost:${port}`)
})
