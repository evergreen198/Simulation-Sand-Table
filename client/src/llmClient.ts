// 前端 API 请求函数：所有 Ollama 推理与记忆维护均经后端代理
import type { DecisionInput } from "../../shared/llm/decision-types"
import type { Action } from "../../shared/types/Action"
import type {
    HostFinalFacts,
    HostWinners,
    HostFinalSummary,
    HostRoundFacts,
    HostRoundSummary,
} from "../../shared/host/host-types"
import type { Agent } from "../../shared/types/AgentType"
import type { EnvironmentInitState, EnvironmentRoundState } from "../../shared/types/EnvironmentType"
import type { AgentMemory, SocialMemoryEvent } from "../../shared/types/memoTypes"

type CooperateInviteInput = {
    target: Agent
    inviter: Agent
    envInit: EnvironmentInitState
    envRound: EnvironmentRoundState
    sessionId: string
}

/** 单回合记忆提交载荷 */
type CommitRoundInput = {
    agentsBefore: Agent[]
    agentsAfter: Agent[]
    actions: { id: string; action: Action }[]
    round: number
    events: SocialMemoryEvent[]
}

async function postJson<T>(url: string, body: unknown, errLabel: string): Promise<T> {
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
    })
    if (!response.ok) {
        throw new Error(`${errLabel}: ${response.status} ${response.statusText}`)
    }
    return (await response.json()) as T
}

/**
 * 新局初始化：在后端为该会话创建空记忆
 * @param sessionId 本局会话 id
 * @param agentIds 参与本局的 agent id 列表
 */
export async function initSession(sessionId: string, agentIds: string[]): Promise<void> {
    await postJson<{ ok: true }>('/api/session/init', { sessionId, agentIds }, '会话初始化失败')
}

/**
 * 提交本轮结算结果，后端更新该局记忆并回写最新记忆
 * @param sessionId 本局会话 id
 * @param input 本轮 before/after 状态、行动与社交事件
 * @returns 更新后的本局记忆库
 */
export async function commitRound(sessionId: string, input: CommitRoundInput): Promise<AgentMemory[]> {
    return await postJson<AgentMemory[]>('/api/round/commit', { sessionId, ...input }, '记忆提交失败')
}

/**
 * 基于后端 Ollama 的 agent 行动决策。
 * 签名兼容 DecisionFn = (input) => Promise<Action>，失败抛异常由管道降级为 wait。
 * @param input 决策上下文（含 sessionId）
 * @returns 决策动作
 */
export const ollamaDecisionFn = async (input: DecisionInput): Promise<Action> => {
    return await postJson<Action>('/api/decision/action', input, '决策请求失败')
}

/**
 * 被邀请方是否接受合作的决策
 * @param input 含 target / inviter / 环境 / sessionId
 * @returns "accept" | "reject"
 */
export async function ollamaCooperateDecisionFn(input: CooperateInviteInput): Promise<"accept" | "reject"> {
    return await postJson<"accept" | "reject">('/api/decision/cooperate', input, '合作决策请求失败')
}

/**
 * 仿真终局主持人报告
 * @param input.facts 全局事实（buildFinalFacts）
 * @param input.winners 代码计算的多维胜利者，LLM 不得修改
 * @returns 终局报告
 */
export async function ollamaEnvFinalSummaryFn(input: {
    facts: HostFinalFacts
    winners: HostWinners
}): Promise<HostFinalSummary> {
    return await postJson<HostFinalSummary>('/api/host/finalsummary', input, '终局总结请求失败')
}

/**
 * 每回合主持人摘要
 * @param input 本轮结构化事实（buildRoundFacts）
 * @returns 含 summary、events、memberDynamics 的回合摘要
 */
export async function ollamaEnvRoundSummaryFn(input: HostRoundFacts): Promise<HostRoundSummary> {
    return await postJson<HostRoundSummary>('/api/host/roundsummary', input, '回合总结请求失败')
}
