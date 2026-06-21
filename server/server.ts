// 后端接口：Ollama 推理代理 + 按会话维护的 agent 记忆
import ollama from "ollama"
import express, { type Request, type Response } from "express"
import { agentLLMMap, EnvAgent } from "../shared/llm/ollama-config"
import type { DecisionInput } from "../shared/llm/decision-types"
import { summarizeMemo, summarizeSocialMemo } from "../shared/memory/memoSearcher"
import { fallbackRoundSummary, fallbackFinalSummary } from "../shared/host/host-fallback"
import type { HostFinalSummary } from "../shared/host/host-types"
import type { Action } from "../shared/types/Action"
import type { Agent } from "../shared/types/AgentType"
import { getMemory, initSession, commitRound } from "./memoryStore"

const app = express()
const port = 3000
app.use(express.json({ limit: "2mb" }))

const VALID_ACTIONS = new Set<Action["type"]>([
  "gather",
  "attack",
  "cooperate",
  "defend",
  "wait",
  "dead",
])


//TODO读这里代码
// ── 推理并发护栏：限制同时进行的 ollama.chat 数量，避免本地模型过载 ──
const MAX_CONCURRENT_INFERENCE = 2

function createLimiter(max: number) {
  let active = 0
  const queue: (() => void)[] = []
  const next = () => {
    if (active >= max || queue.length === 0) return
    active++
    queue.shift()!()
  }
  return function run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      queue.push(() => {
        task()
          .then(resolve, reject)
          .finally(() => {
            active--
            next()
          })
      })
      next()
    })
  }
}

const withInferenceSlot = createLimiter(MAX_CONCURRENT_INFERENCE)

/** 去除可能的 markdown 代码块包裹后解析 JSON */
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

/** 解析合作邀请决策，非法时按 reject 处理 */
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

app.get("/api/health", (_req: Request, res: Response) => {
  res.json({ ok: true })
})

// 新局初始化：清空并重建该会话记忆
app.post("/api/session/init", (req: Request, res: Response) => {
  const { sessionId, agentIds } = req.body as { sessionId: string; agentIds: string[] }
  initSession(sessionId, agentIds)
  res.json({ ok: true })
})

// 提交本轮结算结果，更新并回写该会话记忆
app.post("/api/round/commit", (req: Request, res: Response) => {
  const { sessionId, agentsBefore, agentsAfter, actions, round, events } = req.body
  const memory = commitRound(
    sessionId,
    { agentsBefore, agentsAfter, actions, round },
    events,
  )
  res.json(memory)
})

// agent 行动决策
app.post("/api/decision/action", async (req: Request<unknown, Action, DecisionInput>, res: Response<Action>) => {
  const input = req.body
  const cfg = agentLLMMap[input.agentStage.id]
  if (!cfg) {
    throw new Error(`Agent "${input.agentStage.id}" 未在 agentLLMMap 中配置`)
  }

  const memory = getMemory(input.sessionId, input.agents.map(a => a.id))

  const aliveOthers = input.agents.filter(
    (a: Agent) => a.state.alive && a.id !== input.agentStage.id,
  )
  const othersDesc =
    aliveOthers.length === 0
      ? "（当前无其他存活 agent）"
      : aliveOthers
          .map((a: Agent) => `${a.id}(HP=${a.state.hp} 资源=${a.state.resource})`)
          .join("，")

  const userPrompt =
    `当前是第 ${input.envRound.round} 回合。\n` +
    `你的 ID：${input.agentStage.id}\n` +
    `你的状态：HP=${input.agentStage.state.hp}，资源=${input.agentStage.state.resource}\n` +
    `其他存活 agent：${othersDesc}\n` +
    `环境剩余资源：${input.envRound.currentSource}/${input.envInit.resourceTotal}\n` +
    `你的目标：${input.agentStage.goal}\n\n` +
    `可用动作：\n` +
    `- { "type": "gather" }\n` +
    `- { "type": "attack", "target": "<对方ID>" }\n` +
    `- { "type": "cooperate", "target": "<对方ID>" }\n` +
    `- { "type": "defend" }\n` +
    `- { "type": "wait" }\n` +
    `注意：不能攻击自己，不能攻击已死亡的 agent。cooperate 对象必须存活。\n` +
    `只返回一行纯 JSON，不要 markdown 代码块，不要任何额外文字。` +
    `${summarizeMemo(input.agentStage, memory)}\n`

  const response = await withInferenceSlot(() =>
    ollama.chat({
      model: cfg.model,
      messages: [
        { role: "system", content: cfg.systemPrompt },
        { role: "user", content: userPrompt },
      ],
      format: "json",
      options: { temperature: cfg.temperature },
    }),
  )

  const rawText = response.message.content?.trim()
  if (!rawText) {
    throw new Error("Ollama 返回了空内容")
  }

  let parsed = parseJsonText(rawText)
  if (Array.isArray(parsed)) {
    if (parsed.length === 0) throw new Error("Ollama 返回了空数组")
    parsed = parsed[0]
  }
  if (parsed === null || typeof parsed !== "object") {
    throw new Error(`Ollama 返回的不是 JSON 对象：${rawText}`)
  }

  const obj = parsed as Record<string, unknown>
  if (typeof obj.type !== "string" || !VALID_ACTIONS.has(obj.type as Action["type"])) {
    throw new Error(`Ollama 返回的动作类型 "${obj.type}" 不合法`)
  }
  const type = obj.type as Action["type"]

  if (type === "attack" || type === "cooperate") {
    if (typeof obj.target !== "string" || obj.target.length === 0) {
      throw new Error(`Ollama 返回的 ${type} 缺少 target 字段`)
    }
    res.json({ type, target: obj.target } as Action)
    return
  }
  res.json({ type } as Action)
})

// 被邀请方是否接受合作
app.post("/api/decision/cooperate", async (req: Request, res: Response) => {
  const input = req.body
  const cfg = agentLLMMap[input.target.id]
  if (!cfg) {
    res.json("reject")
    return
  }

  const memory = getMemory(input.sessionId)
  const userPrompt =
    `当前是第 ${input.envRound.round} 回合。\n` +
    `你的 ID：${input.target.id}\n` +
    `你的状态：HP=${input.target.state.hp}，资源=${input.target.state.resource}\n` +
    `环境剩余资源：${input.envRound.currentSource}/${input.envInit.resourceTotal}\n` +
    `你的目标：${input.target.goal}\n\n` +
    `你被 ${input.inviter.id} 邀请合作\n` +
    `你与他之前的社交记忆：\n` +
    `${summarizeSocialMemo(input.target, input.inviter, memory)}\n` +
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
    const response = await withInferenceSlot(() =>
      ollama.chat({
        model: cfg.model,
        messages: [
          { role: "system", content: cfg.systemPrompt },
          { role: "user", content: userPrompt },
        ],
        format: "json",
        options: { temperature: cfg.temperature },
      }),
    )
    const rawText = response.message.content?.trim()
    res.json(rawText ? parseInviteDecision(rawText) : "reject")
  } catch {
    res.json("reject")
  }
})

// 每回合主持人摘要
app.post("/api/host/roundsummary", async (req: Request, res: Response) => {
  const facts = req.body
  const userPrompt =
    `以下是第 ${facts.round} 回合的系统事实（JSON）：\n` +
    `${JSON.stringify(facts)}\n\n` +
    `请根据以上事实输出 JSON：\n` +
    `{"summary":"本轮局势一句话","events":["特殊事件描述"],"memberDynamics":{"agentId":"该成员本轮动态"}}\n` +
    `events 应基于 roundEvents；若无特殊事件可返回空数组。memberDynamics 的 key 使用 agentSnapshots 中的 id。`

  try {
    const response = await withInferenceSlot(() =>
      ollama.chat({
        model: EnvAgent.model,
        messages: [
          { role: "system", content: EnvAgent.systemPrompt },
          { role: "user", content: userPrompt },
        ],
        format: "json",
        options: { temperature: EnvAgent.temperature },
      }),
    )

    const rawText = response.message.content?.trim()
    if (!rawText) {
      res.json(fallbackRoundSummary(facts))
      return
    }

    const parsed = parseJsonText(rawText) as Record<string, unknown>
    const summary =
      typeof parsed.summary === "string" ? parsed.summary : fallbackRoundSummary(facts).summary
    const events = Array.isArray(parsed.events)
      ? parsed.events.filter((e): e is string => typeof e === "string")
      : facts.roundEvents
    const memberDynamics: Record<string, string> = {}
    if (parsed.memberDynamics && typeof parsed.memberDynamics === "object") {
      for (const [k, v] of Object.entries(parsed.memberDynamics as Record<string, unknown>)) {
        if (typeof v === "string") memberDynamics[k] = v
      }
    }
    if (Object.keys(memberDynamics).length === 0) {
      Object.assign(memberDynamics, fallbackRoundSummary(facts).memberDynamics)
    }

    res.json({ round: facts.round, summary, events, memberDynamics })
  } catch {
    res.json(fallbackRoundSummary(facts))
  }
})

// 终局主持人报告
app.post("/api/host/finalsummary", async (req: Request, res: Response) => {
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
    const response = await withInferenceSlot(() =>
      ollama.chat({
        model: EnvAgent.model,
        messages: [
          { role: "system", content: EnvAgent.systemPrompt },
          { role: "user", content: userPrompt },
        ],
        format: "json",
        options: { temperature: EnvAgent.temperature },
      }),
    )

    const rawText = response.message.content?.trim()
    if (!rawText) {
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

    res.json({ globalSituation, specialEvents, winners, narrative })
  } catch {
    res.json(fallbackFinalSummary(facts, winners))
  }
})

app.listen(port, () => {
  console.log(`server running at http://localhost:${port}`)
})
