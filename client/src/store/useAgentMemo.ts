// 局内 agent 记忆状态：回合快照 + 社交关系，由 simulation 在结算节点驱动更新
import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import {
    constructAgentMemory,
    updateAgentRoundMemory,
    updateCooperateMemory,
} from "../memoryManagement/memoConstructor"
import type { AgentMemory, SocialMemoryEvent } from "../memoryManagement/memoTypes"
import type { Agent } from "../types/AgentType"
import type { ResolvedAction } from "./simulation"

interface AgentMemoState {
    agentsMemory: AgentMemory[]
    /** 新局初始化：为每个 agent 创建空记忆 */
    init: (agentIds: string[]) => void

    updateAllMemoState: (
        input: {
            agentsBefore: Agent[]
            agentsAfter: Agent[]
            actions: ResolvedAction[]
            round: number
        },
        events: SocialMemoryEvent[]
    ) => void

    /** 回合结算后追加本轮 before/after 与行动记录 */
    updateRoundState: (input: {
        agentsBefore: Agent[]
        agentsAfter: Agent[]
        actions: ResolvedAction[]
        round: number
    }) => void
    /** 结算阶段产生的攻击/背叛/合作成立等社交事件批量写入 */
    updateCooperateState: (events: SocialMemoryEvent[]) => void
}

const useAgentMemoStore = create<AgentMemoState>()(
    subscribeWithSelector((set) => ({
        agentsMemory: [],

        init: (agentIds) =>
            set({
                agentsMemory: agentIds.map((id) => constructAgentMemory(id)),
            }),
        updateAllMemoState: (input, events) => {
            set((state) => {
                const eventsByAgentId = new Map<string, SocialMemoryEvent[]>()
                for (const e of events) {
                    eventsByAgentId.set(e.agentId, [
                        ...(eventsByAgentId.get(e.agentId) ?? []),
                        e,
                    ])
                }
                return {
                    agentsMemory: state.agentsMemory.map((mem) => {
                        const before = input.agentsBefore.find((a) => a.id === mem.agentId)
                        const after = input.agentsAfter.find((a) => a.id === mem.agentId)
                        const resolved = input.actions.find((a) => a.id === mem.agentId)
                        if (!before || !after || !resolved) return mem
                        //TODO使用map将复杂度降为O(n+m)



                        const forAgent = eventsByAgentId.get(mem.agentId) ?? []
                        let social = mem.socialMemory
                        for (const e of forAgent) {
                            social = updateCooperateMemory(
                                e.pattern,
                                e.otherAgentId,
                                e.round,
                                social,
                            )
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
                    }),
                }
            })
        },

        updateRoundState: ({ agentsBefore, agentsAfter, actions, round }) =>
            set((state) => ({
                agentsMemory: state.agentsMemory.map((mem) => {
                    const before = agentsBefore.find((a) => a.id === mem.agentId)
                    const after = agentsAfter.find((a) => a.id === mem.agentId)
                    const resolved = actions.find((a) => a.id === mem.agentId)
                    if (!before || !after || !resolved) return mem
                    return {
                        ...mem,
                        roundMemory: updateAgentRoundMemory(
                            mem.roundMemory,
                            before,
                            after,
                            resolved.action,
                            round,
                        ),
                    }
                }),
            })),

        updateCooperateState: (events) => {
            if (events.length === 0) return
            //TODO使用map将复杂度降为O(n+m)
            const eventsByAgentId = new Map<string, SocialMemoryEvent[]>()
            for (const e of events) {
                eventsByAgentId.set(e.agentId, [
                    ...(eventsByAgentId.get(e.agentId) ?? []),
                    e,
                ])
            }
            set((state) => ({
                agentsMemory: state.agentsMemory.map((mem) => {

                    const forAgent = eventsByAgentId.get(mem.agentId) ?? []
                    if (forAgent.length === 0) return mem
                    let social = mem.socialMemory
                    for (const e of forAgent) {
                        social = updateCooperateMemory(
                            e.pattern,
                            e.otherAgentId,
                            e.round,
                            social,
                        )
                    }
                    return { ...mem, socialMemory: social }
                }),
            }))
        },
    })),
)

export default useAgentMemoStore
