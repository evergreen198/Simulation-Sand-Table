//检索agent记忆的函数
import useAgentMemoStore from "../store/useAgentMemo"
import { Agent } from "../types/AgentType"

export function summarizeRoundMemo(agent:Agent):string{
    const memo = useAgentMemoStore.getState().agentsMemory
    const agentMemo = memo.find((mem) => mem.agentId === agent.id)
    if (!agentMemo) return ""
    let summary="回合记忆：\n"
    agentMemo.roundMemory.forEach(mem => {
        summary += `第${mem.round}回合：`+
        `行动：${mem.action}`+
        `行动前状态：${mem.beforeState}`+
        `行动后状态：${mem.afterState}`+
        `\n`
    })
    return summary
}
//TODO待完善
export function summarizeSocialMemo(agent:Agent):string{
    const memo = useAgentMemoStore.getState().agentsMemory
    const agentMemo = memo.find((mem) => mem.agentId === agent.id)
    if (!agentMemo) return ""
    let summary="社交记忆：\n"
    
    return summary
}

export function summarizeMemo(agent:Agent):string{
    const memo = useAgentMemoStore.getState()
    const agentMemo = memo.agentsMemory.find((mem) => mem.agentId === agent.id)
    if (!agentMemo) return ""
    let summary="回合记忆：\n"
    agentMemo.roundMemory.forEach(mem => {
        summary += `第${mem.round}回合：`+
        `行动：${mem.action}`+
        `行动前状态：${mem.beforeState}`+
        `行动后状态：${mem.afterState}`+
        `\n`
    })
    return summary
}
