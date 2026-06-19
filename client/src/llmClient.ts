//前端Api请求函数
import type { DecisionInput } from "./store/decisionProcessing/decisionInterface"
import type { Action } from "./types/Action" 
import type { HostFinalFacts, HostWinners, HostFinalSummary, HostRoundFacts, HostRoundSummary } from "./hostSummary/hostTypes"
import type { Agent } from "./types/AgentType"
import type { EnvironmentInitState } from "./types/EnvironmentType"
import type { EnvironmentRoundState } from "./types/EnvironmentType"

type CooperateInviteInput = {
    target: Agent
    inviter: Agent
    envInit: EnvironmentInitState
    envRound: EnvironmentRoundState
  }

  /**
 * 基于 Ollama 本地 LLM 的异步决策函数。
 * 替代 utils/decideAction.ts 的确定性评分逻辑，由大模型推理做出决策。
 *
 * 签名符合 DecisionFn = (input) => Promise<Action>
 * 如果 LLM 返回不合法，抛异常 → 由 decisionPipeline 的 try/catch 自动 fallback 到 wait。
 * @params
 * agentStage: 当前 决策agent
 * agents: 所有agent
 * envInit: 环境初始化状态
 * envRound: 环境当前状态
 * 返回值：Action 
 * @returns Action
 */
export const ollamaDecisionFn = async (input: DecisionInput): Promise<Action> => {
  const response = await fetch('/api/decision/action', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!response.ok) {
    throw new Error(`决策请求失败: ${response.status} ${response.statusText}`)
  }
  return (await response.json()) as Action
}

export async function ollamaCooperateDecisionFn(input: CooperateInviteInput): Promise<"accept" | "reject">{
    const response = await fetch('/api/decision/cooperate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!response.ok) {
      throw new Error(`合作决策请求失败: ${response.status} ${response.statusText}`)
    }
    return (await response.json()) as "accept" | "reject"
  } 

/**
 * 仿真终局主持人报告
 * @param input.facts 全局事实（buildFinalFacts）
 * @param input.winners 代码计算的多维胜利者，LLM 不得修改
 */
export async function ollamaEnvFinalSummaryFn(input: {
    facts: HostFinalFacts
    winners: HostWinners
  }): Promise<HostFinalSummary>{
    const response = await fetch('/api/host/finalsummary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!response.ok) {
      throw new Error(`终局总结请求失败: ${response.status} ${response.statusText}`)
    }
    return (await response.json()) as HostFinalSummary
  }

    /**
 * 每回合主持人摘要：基于代码提取的 facts 生成可读总结
 * @param facts 本轮结构化事实（buildRoundFacts）
 * @returns 含 summary、events、memberDynamics 的回合摘要
 */
export async function ollamaEnvRoundSummaryFn(input: HostRoundFacts): Promise<HostRoundSummary>{
    const response = await fetch('/api/host/roundsummary', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(input),
    })
    if (!response.ok) {
      throw new Error(`回合总结请求失败: ${response.status} ${response.statusText}`)
    }
    return (await response.json()) as HostRoundSummary
  } 
