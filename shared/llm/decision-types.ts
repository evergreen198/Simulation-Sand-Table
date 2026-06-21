import type { Action } from "../types/Action"
import type { Agent } from "../types/AgentType"
import type { EnvironmentInitState, EnvironmentRoundState } from "../types/EnvironmentType"

// 决策上下文 —— 传给任意决策函数的标准化输入
export type DecisionInput = {
  agentStage: Agent
  agents: Agent[]
  envInit: EnvironmentInitState
  envRound: EnvironmentRoundState
  /** 会话 id：后端据此读取该局记忆构建 prompt */
  sessionId: string
}

// 决策输出 —— 任意决策函数返回的标准化结果
export type DecisionOutput = {
  id: string
  action: Action
  /** success: 决策合法，直接执行；fallback: 原决策不合法，已降级处理 */
  status: "success" | "fallback"
  /** fallback 时说明降级原因 */
  reason?: string
  /** 原始返回值（用于调试外部 agent 的不合法输出） */
  raw?: string
  /** UI 运行状态：决策中 / 执行动作中 / 降级等待 / 已死亡 */
  runtimeStatus: "deciding" | "acting" | "fallback_wait" | "dead"
}

// 错误详情
export type DecisionError =
  | { type: "INVALID_ACTION_TYPE"; detail: string }
  | { type: "MISSING_TARGET"; actionType: "attack" | "cooperate" }
  | { type: "TARGET_NOT_FOUND"; target: string }
  | { type: "TARGET_NOT_ALIVE"; target: string }
  | { type: "SELF_TARGET"; actionType: "attack" | "cooperate" }
  | { type: "DEAD_AGENT_ACTING"; actionType: string }
  | { type: "NULL_OR_UNDEFINED" }
  | { type: "EXECUTION_ERROR"; message: string }

// 决策函数签名 —— 未来外部 agent 只需实现此签名
export type DecisionFn = (input: DecisionInput) => Action | Promise<Action>
