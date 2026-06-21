// 按 sessionId 维护各局 agent 记忆：后端作为记忆唯一权威源
import type { AgentMemory } from "../shared/types/memoTypes"
import { constructAgentMemory } from "../shared/memory/memoConstructor"
import { applyRoundMemory, type RoundMemoryInput } from "../shared/memory/memoReducer"
import type { SocialMemoryEvent } from "../shared/types/memoTypes"

const sessions = new Map<string, AgentMemory[]>()

/**
 * 新局初始化：为该会话创建空记忆（覆盖同名旧会话）
 * @param sessionId 会话 id
 * @param agentIds 参与本局的 agent id 列表
 */
export function initSession(sessionId: string, agentIds: string[]): void {
  sessions.set(sessionId, agentIds.map(constructAgentMemory))
}

/**
 * 读取会话记忆；会话不存在时按 fallbackAgentIds 懒初始化
 * @param sessionId 会话 id
 * @param fallbackAgentIds 会话缺失时用于初始化的 id 列表
 * @returns 该会话记忆库
 */
export function getMemory(sessionId: string, fallbackAgentIds: string[] = []): AgentMemory[] {
  const existing = sessions.get(sessionId)
  if (existing) return existing
  const created = fallbackAgentIds.map(constructAgentMemory)
  sessions.set(sessionId, created)
  return created
}

/**
 * 提交本轮结算结果，更新并返回该会话最新记忆
 * @param sessionId 会话 id
 * @param input 本轮 before/after 状态与行动
 * @param events 本轮社交事件
 * @returns 更新后的记忆库
 */
export function commitRound(
  sessionId: string,
  input: RoundMemoryInput,
  events: SocialMemoryEvent[],
): AgentMemory[] {
  const fallbackIds = input.agentsAfter.map(a => a.id)
  const current = getMemory(sessionId, fallbackIds)
  const next = applyRoundMemory(current, input, events)
  sessions.set(sessionId, next)
  return next
}
