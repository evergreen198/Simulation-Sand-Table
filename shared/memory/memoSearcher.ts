// 检索 agent 记忆的纯函数：调用方显式传入 agentsMemory（前端 store / 后端 session 均可复用）
import { socialMemoryPatternList } from "../types/memoTypes"
import type { AgentMemory } from "../types/memoTypes"
import type { Agent } from "../types/AgentType"

/**
 * 汇总某 agent 的回合记忆
 * @param agent 目标 agent
 * @param agentsMemory 全体记忆库
 * @returns 可读的回合记忆文本，无记忆时返回 "无"
 */
export function summarizeRoundMemo(agent: Agent, agentsMemory: AgentMemory[]): string {
    const agentMemo = agentsMemory.find((mem) => mem.agentId === agent.id)
    if (!agentMemo) return "无"
    let summary = "回合记忆：\n"
    agentMemo.roundMemory.forEach(mem => {
        summary += `第${mem.round}回合：` +
            `行动：${JSON.stringify(mem.action)}` +
            `行动前状态：${mem.beforeState}` +
            `行动后状态：${mem.afterState}` +
            `\n`
    })
    return summary
}

/**
 * 汇总某 agent 与指定邀请者之间的社交记忆
 * @param agent 目标 agent（被邀请方）
 * @param inviter 邀请者
 * @param agentsMemory 全体记忆库
 * @returns 可读的双方社交记忆文本，无记忆时返回 "无"
 */
export function summarizeSocialMemo(agent: Agent, inviter: Agent, agentsMemory: AgentMemory[]): string {
    const agentMemo = agentsMemory.find((mem) => mem.agentId === agent.id)
    if (!agentMemo) return "无"
    let summary = "社交记忆：\n"
    socialMemoryPatternList.forEach(pattern => {
        const matched = agentMemo.socialMemory[pattern].filter((smem) => smem.agentId === inviter.id)
        matched.forEach(smem => {
            summary += `你与 ${smem.agentId} 在第${smem.atRound}回合的关系为:你 ${pattern.replace(/_/g, ' ')}  ${smem.agentId}\n`
        })
    })
    return summary
}

/**
 * 汇总某 agent 的回合记忆与全部社交记忆（用于决策 prompt）
 * @param agent 目标 agent
 * @param agentsMemory 全体记忆库
 * @returns 可读的完整记忆文本，无记忆时返回 "无"
 */
export function summarizeMemo(agent: Agent, agentsMemory: AgentMemory[]): string {
    const agentMemo = agentsMemory.find((mem) => mem.agentId === agent.id)
    if (!agentMemo) return "无"
    let summary = "回合记忆：\n"
    agentMemo.roundMemory.forEach(mem => {
        summary += `第${mem.round}回合：` +
            `行动：${JSON.stringify(mem.action)}` +
            `行动前状态：${mem.beforeState}` +
            `行动后状态：${mem.afterState}` +
            `\n`
    })
    let socialSummary = '社交记忆:'
    socialMemoryPatternList.forEach(pattern => {
        agentMemo.socialMemory[pattern].forEach(smem => {
            socialSummary += `你与 ${smem.agentId} 在第${smem.atRound}回合的关系为:你 ${pattern.replace(/_/g, ' ')}  ${smem.agentId}\n`
        })
    })
    if (socialSummary === '社交记忆:') { socialSummary += '无' }
    summary += socialSummary
    return summary
}
