import type { Action } from "../types/Action";
//agent存储的完整记忆
export interface AgentRoundMemory {
    round: number,
    //此处应为深拷贝的Action和Agent
    action: Action,
    beforeState: {
        hp: number
        resource: number
        alive: boolean
    },
    afterState: {
        hp: number
        resource: number
        alive: boolean
    },
}
//在收到合作邀请时检索的记忆——考虑在agent发出合作邀请后在该记忆库中检索后向agent确认
export interface AgentSocialMemory {
    attack_by: {
        agentId: string,
        atRound: number,
    }[],
    betray_by: {
        agentId: string,
        atRound: number,
    }[],
    cooperate_by: {
        agentId: string,
        atRound: number,
    }[],
    cooperate_to: {
        agentId: string,
        atRound: number,
    }[],
    attack_to: {
        agentId: string,
        atRound: number,
    }[],
    betray_to: {
        agentId: string,
        atRound: number,
    }[],
}

export interface AgentMemory {
    agentId: string,
    socialMemory: AgentSocialMemory,
    roundMemory: AgentRoundMemory[],
}

/** 单条社交记忆写入事件（结算阶段收集，批量写入 store） */
export type SocialMemoryPattern = keyof AgentSocialMemory
export const socialMemoryPatternList: SocialMemoryPattern[] = [
    "attack_by",
    "betray_by",
    "cooperate_by",
    "cooperate_to",
    "attack_to",
    "betray_to",
]
export type SocialMemoryEvent = {
    agentId: string
    pattern: SocialMemoryPattern
    otherAgentId: string
    round: number
}