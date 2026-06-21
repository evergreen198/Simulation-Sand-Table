import type {
    AgentRoundMemory,
    AgentSocialMemory,
    AgentMemory,
    SocialMemoryPattern,
} from "../types/memoTypes";
import type { Agent } from "../types/AgentType";
import type { Action } from "../types/Action";

export const MAX_ROUND_MEMORY_LENGTH = 50
export const MAX_SOCIAL_MEMORY_LENGTH = 30

/**
 * 构造单个 agent 的空记忆
 * @param agentId 目标 agent id
 * @returns 初始化后的 AgentMemory
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

/**
 * 追加一条回合记忆（超出上限时滑动丢弃最早一条）
 * @param oldMemory 旧回合记忆数组
 * @param agentBeforeState 行动前 agent 状态
 * @param agentAfterState 行动后 agent 状态
 * @param action 本回合执行的行动
 * @param round 回合号
 * @returns 更新后的回合记忆数组
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
            action: structuredClone(action),
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

/**
 * 追加一条社交记忆（按 pattern 分桶，超出上限时滑动丢弃最早一条）
 * @param pattern 社交记忆类型（attack_to / cooperate_by 等）
 * @param initiatorAgentId 关系另一方 id
 * @param round 回合号
 * @param oldSocialMemory 旧社交记忆
 * @returns 更新后的社交记忆
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
