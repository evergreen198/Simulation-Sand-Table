// 主持人摘要的代码层兜底：Ollama 不可用或返回非法时，基于已构建的 facts 生成最小可读摘要
import type { Action } from "../types/Action"
import type {
  HostFinalFacts,
  HostFinalSummary,
  HostRoundFacts,
  HostRoundSummary,
  HostWinners,
} from "./host-types"

/** 将 action 格式化为可读字符串 */
function formatAction(action: Action | null): string {
  if (!action) return "无行动"
  if (action.type === "attack" || action.type === "cooperate") {
    return `${action.type} → ${action.target}`
  }
  return action.type
}

/**
 * 代码层最小回合摘要（Ollama 失败时使用）
 * @param facts 已构建的回合事实
 * @returns 回合摘要
 */
export function fallbackRoundSummary(facts: HostRoundFacts): HostRoundSummary {
  const dynamics: Record<string, string> = {}
  for (const s of facts.agentSnapshots) {
    dynamics[s.id] = `${s.alive ? "存活" : "阵亡"}，HP ${s.hp}，资源 ${s.resource}，行动 ${formatAction(s.action)}`
  }
  const summary =
    `第 ${facts.round} 回合：${facts.aliveCount} 名 agent 存活，` +
    `环境资源 ${facts.currentSource}/${facts.resourceTotal}。`
  return {
    round: facts.round,
    summary,
    events: facts.roundEvents,
    memberDynamics: dynamics,
  }
}

/**
 * 代码层最小终局摘要（Ollama 失败时使用）
 * @param facts 已构建的终局事实
 * @param winners 代码计算的多维胜利者
 * @returns 终局报告
 */
export function fallbackFinalSummary(
  facts: HostFinalFacts,
  winners: HostWinners,
): HostFinalSummary {
  const narrative =
    `仿真共 ${facts.totalRounds} 回合。${facts.globalSituation.resourceStatus}。` +
    `${facts.globalSituation.leader}。${facts.globalSituation.tension}。`
  return {
    globalSituation: facts.globalSituation,
    specialEvents: facts.specialEvents,
    winners,
    narrative,
  }
}
