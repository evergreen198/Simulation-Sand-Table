// 回合记忆更新的纯函数：由结算结果计算下一份记忆库（前端 store 与后端 session 共用）
import type { Agent } from "../types/AgentType"
import type { Action } from "../types/Action"
import type { AgentMemory, SocialMemoryEvent } from "../types/memoTypes"
import { updateAgentRoundMemory, updateCooperateMemory } from "./memoConstructor"

/** 单回合结算结果（驱动记忆更新所需的最小输入） */
export type RoundMemoryInput = {
    agentsBefore: Agent[]
    agentsAfter: Agent[]
    actions: { id: string; action: Action }[]
    round: number
}

/**
 * 基于本轮结算结果与社交事件，计算更新后的记忆库
 * @param agentsMemory 当前记忆库
 * @param input 本轮 before/after 状态、行动与回合号
 * @param events 本轮产生的社交事件（攻击/合作/背叛）
 * @returns 更新后的记忆库（不修改入参）
 */
export function applyRoundMemory(
    agentsMemory: AgentMemory[],
    input: RoundMemoryInput,
    events: SocialMemoryEvent[],
): AgentMemory[] {
    const eventsByAgentId = new Map<string, SocialMemoryEvent[]>()
    for (const e of events) {
        eventsByAgentId.set(e.agentId, [...(eventsByAgentId.get(e.agentId) ?? []), e])
    }

    return agentsMemory.map((mem) => {
        const forAgent = eventsByAgentId.get(mem.agentId) ?? []
        let social = mem.socialMemory
        for (const e of forAgent) {
            social = updateCooperateMemory(e.pattern, e.otherAgentId, e.round, social)
        }

        const before = input.agentsBefore.find((a) => a.id === mem.agentId)
        const after = input.agentsAfter.find((a) => a.id === mem.agentId)
        const resolved = input.actions.find((a) => a.id === mem.agentId)
        if (!before || !after || !resolved) {
            return forAgent.length > 0 ? { ...mem, socialMemory: social } : mem
        }

        return {
            ...mem,
            roundMemory: updateAgentRoundMemory(
                mem.roundMemory,
                before,
                after,
                resolved.action,
                input.round,
            ),
            socialMemory: social,
        }
    })
}
