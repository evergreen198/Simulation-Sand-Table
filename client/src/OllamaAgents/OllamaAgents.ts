import ollama from "ollama"
import type { DecisionFn } from "../store/decisionProcessing/decisionInterface"
import type { Action } from "../types/Action"
import type { Agent } from "../types/AgentType"
import type { EnvironmentInitState, EnvironmentRoundState } from "../types/EnvironmentType"
import { agentLLMMap } from "./OllamaAgentsSetting"

const VALID_ACTIONS = new Set(["gather", "attack", "cooperate", "defend", "wait", "dead"])

export type CooperateInviteInput = {
  target: Agent
  inviter: Agent
  envInit: EnvironmentInitState
  envRound: EnvironmentRoundState
}

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

/**
 * 基于 Ollama 本地 LLM 的异步决策函数。
 * 替代 utils/decideAction.ts 的确定性评分逻辑，由大模型推理做出决策。
 *
 * 签名符合 DecisionFn = (input) => Promise<Action>
 * 如果 LLM 返回不合法，抛异常 → 由 decisionPipeline 的 try/catch 自动 fallback 到 wait。
 * agentStage: 当前 决策agent
 * agents: 所有agent
 * envInit: 环境初始化状态
 * envRound: 环境当前状态
 * 返回值：Action 
 */
export const ollamaDecisionFn: DecisionFn = async (input): Promise<Action> => {
  const cfg = agentLLMMap[input.agentStage.id]
  if (!cfg) {
    throw new Error(`Agent "${input.agentStage.id}" 未在 OllamaAgentsSetting.agentLLMMap 中配置`)
  }

  const aliveOthers = input.agents.filter(
    a => a.state.alive && a.id !== input.agentStage.id,
  )

  const othersDesc =
    aliveOthers.length === 0
      ? "（当前无其他存活 agent）"
      : aliveOthers
        .map(a => `${a.id}(HP=${a.state.hp} 资源=${a.state.resource})`)
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
    `只返回一行纯 JSON，不要 markdown 代码块，不要任何额外文字。`

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
  if (typeof obj.type !== "string" || !VALID_ACTIONS.has(obj.type)) {
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
    return { type, target: obj.target } as Action
  }

  // gather / defend / wait / dead 不需要 target
  if (
    type === "gather" ||
    type === "defend" ||
    type === "wait" ||
    type === "dead"
  ) {
    return { type } as Action
  }

  // 兜底（不应该到达这里）
  throw new Error(`未知的动作类型：${type}`)
}

export async function ollamaCooperateDecisionFn(
  input: CooperateInviteInput,
): Promise<"accept" | "reject"> {
  const cfg = agentLLMMap[input.target.id]
  if (!cfg) return "reject"

  const userPrompt =
    `当前是第 ${input.envRound.round} 回合。\n` +
    `你的 ID：${input.target.id}\n` +
    `你的状态：HP=${input.target.state.hp}，资源=${input.target.state.resource}\n` +
    `环境剩余资源：${input.envRound.currentSource}/${input.envInit.resourceTotal}\n` +
    `你的目标：${input.target.goal}\n\n` +
    `你被 ${input.inviter.id} 邀请合作\n` +
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
    if (!rawText) return "reject"
    return parseInviteDecision(rawText)
  } catch {
    return "reject"
  }
}