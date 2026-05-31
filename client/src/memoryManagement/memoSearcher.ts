//检索agent记忆的函数
import useAgentMemoStore from "../store/useAgentMemo"
import type { SocialMemoryPattern } from "./memoTypes"
import { socialMemoryPatternList } from "./memoTypes"
import type { Agent } from "../types/AgentType"

export function summarizeRoundMemo(agent: Agent): string {
    const {agentsMemory}= useAgentMemoStore.getState()
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

export function summarizeSocialMemo(agent: Agent, inviter: Agent): string {
    const {agentsMemory}= useAgentMemoStore.getState()
    const agentMemo = agentsMemory.find((mem) => mem.agentId === agent.id)
    if (!agentMemo) return "无"
    let summary = "社交记忆：\n"
    //修复：只能检索到各种类型的第一条信息
    socialMemoryPatternList.forEach(pattern => {
        const smem = agentMemo.socialMemory[pattern].filter((smem) => smem.agentId === inviter.id)
        smem.forEach(smem => {
            summary += `你与 ${smem.agentId} 在第${smem.atRound}回合的关系为:你 ${pattern.replace(/_/g, ' ')}  ${smem.agentId}\n`
        })
    })

    return summary
}

export function summarizeMemo(agent: Agent): string {
    const {agentsMemory}= useAgentMemoStore.getState()
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
    //TODO：优化记忆存储：在社交记忆中存储你与对方的所有关系，使搜索时时间复杂度降为O(n)
    let memoAboutInviter = '社交记忆:'
    
    socialMemoryPatternList.forEach(pattern => {
        agentMemo.socialMemory[pattern].forEach(smem => {
            memoAboutInviter += `你与 ${smem.agentId} 在第${smem.atRound}回合的关系为:你 ${pattern.replace(/_/g, ' ')}  ${smem.agentId  }\n`
        })
    })
    if(memoAboutInviter =='社交记忆:'){memoAboutInviter += '无'}
    summary += memoAboutInviter
    return summary
}
