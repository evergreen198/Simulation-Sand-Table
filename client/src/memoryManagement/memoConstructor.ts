import type {
  AgentRoundMemory,
  AgentSocialMemory,
  AgentMemory,
  SocialMemoryPattern,
} from "./memoTypes";
import type { Agent } from "../types/AgentType";
import type { Action } from "../types/Action";

export const MAX_ROUND_MEMORY_LENGTH = 50
export const MAX_SOCIAL_MEMORY_LENGTH = 30

//构建agent记忆的函数和agent记忆库
//构造初始记忆函数：
//在模拟中，通过map函数遍历agentActions，并调用constructAgentMemory函数构造初始记忆
/*
*@param agentId:string
*@param agents:Agent[]
*@param agentActions: AgentAction[]
*@returns AgentMemory
*/
export function constructAgentMemory(agentId: string): AgentMemory {
    return {
        agentId,
        socialMemory: {
            attack_by: [],
            betray_by: [],
            cooperate_by: [],
            cooperate_to: [],
            attack_to: [],
            betray_to: [],
        },
        roundMemory: [],
    };
}
//更新记忆函数：
//在模拟中，通过map函数遍历agentActions，并调用addAgentMemory函数更新记忆
/*
*@param oldMemory:AgentMemory
*param agentBeforeState:Agent
*param agentAfterState:Agent
*@param round:number
*@param action:Action
*@returns AgentRoundMemory[]
*/
export function updateAgentRoundMemory(
    oldMemory: AgentRoundMemory[],
    agentBeforeState: Agent,
    agentAfterState: Agent,
    action: Action,
    round: number,
): AgentRoundMemory[] {
    return [
        ...oldMemory.slice(Math.max(0, oldMemory.length - MAX_ROUND_MEMORY_LENGTH + 1)),
        {
            round,
            action:structuredClone(action),
            beforeState: {
                hp: agentBeforeState.state.hp,
                resource: agentBeforeState.state.resource,
                alive: agentBeforeState.state.alive,
            },
            afterState: {
                hp: agentAfterState.state.hp,
                resource: agentAfterState.state.resource,
                alive: agentAfterState.state.alive,
            },
        }]
}

//更新合作记忆函数：
//在模拟中，通过map函数遍历agentActions，并调用updateCooperateMemory函数更新合作记忆
/*
*@param pattern: SocialMemoryPattern
*@param initiatorAgentId:string
*@param round:number
*@param oldSocialMemory:AgentSocialMemory
*@returns AgentSocialMemory
*/
export function updateCooperateMemory(
    pattern: SocialMemoryPattern,
    initiatorAgentId: string,
    round: number,
    oldSocialMemory: AgentSocialMemory,
): AgentSocialMemory {
    return {
        ...oldSocialMemory,
        [pattern]: [
            ...oldSocialMemory[pattern].slice(Math.max(0, oldSocialMemory[pattern].length - MAX_SOCIAL_MEMORY_LENGTH + 1)),
            {
                agentId: initiatorAgentId,
                atRound: round,
            },
        ],
    }
}