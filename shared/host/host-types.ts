import type { Action } from "../types/Action"

/** 本轮各行动类型计数 */
export type ActionCounts = {
  gather: number
  attack: number
  cooperate: number
  defend: number
  wait: number
}

/** 单 agent 本轮快照，供主持人 prompt 使用 */
export type HostAgentSnapshot = {
  id: string
  hp: number
  resource: number
  alive: boolean
  action: Action | null
}

/**
 * 单回合结构化事实（代码提取，传给 LLM）
 * 入参来源：useStore + 后端记忆 在 tick 结算后
 */
export type HostRoundFacts = {
  round: number
  aliveCount: number
  currentSource: number
  resourceTotal: number
  resourceRatio: number
  actionCounts: ActionCounts
  roundEvents: string[]
  agentSnapshots: HostAgentSnapshot[]
}

/** 存入 useEnvMemo 的单回合摘要 */
export type HostRoundSummary = {
  round: number
  summary: string
  events: string[]
  memberDynamics: Record<string, string>
}

/** 多维胜利者（由代码计算，LLM 不得改写） */
export type HostWinners = {
  resource: string
  survival: string
  cooperation: string
  attack: string
  composite: string
}

/** 全局局势指标（代码计算） */
export type HostGlobalSituation = {
  resourceStatus: string
  actionRatio: string
  strategyConvergence: string
  leader: string
  tension: string
}

/**
 * 终局结构化事实（代码提取）
 * winners 单独传入 Ollama，不在此对象内
 */
export type HostFinalFacts = {
  totalRounds: number
  aliveCount: number
  currentSource: number
  resourceTotal: number
  resourceRatio: number
  globalSituation: HostGlobalSituation
  specialEvents: string[]
  agentSnapshots: HostAgentSnapshot[]
}

/** 终局报告，存入 useEnvMemo */
export type HostFinalSummary = {
  globalSituation: HostGlobalSituation
  specialEvents: string[]
  winners: HostWinners
  narrative: string
}
