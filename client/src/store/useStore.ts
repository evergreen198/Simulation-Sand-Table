import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import type { Agent } from "../types/AgentType"
import type {
  EnvironmentInitState,
  EnvironmentRoundState,
} from "../types/EnvironmentType"
import type {
  AgentAction,
  AgentAliveRoundData,
  SourceLineData,
} from "./simulation"
import { createRoundContext, simulateRound } from "./simulation"
import {
  // ollamaDecisionFn,
  ollamaEnvFinalSummaryFn,
  ollamaEnvRoundSummaryFn,
} from "../llmClient.ts"
import { ollamaDecisionFn } from "../llmClient"
import type { AgentLLMConfig } from "../OllamaAgents/OllamaAgentsSetting"
import { agentLLMMap } from "../OllamaAgents/OllamaAgentsSetting"
import useAgentMemoStore from "./useAgentMemo"
import useEnvMemoStore from "./useEnvMemo"
import {
  buildFinalFacts,
  buildRoundFactsFromTick,
  computeWinners,
} from "../hostSummary/hostStats"
import {
  computeRelationSnapshot,
  createEmptyRelationSnapshot,
} from "../relation/relationMatrix"
/** 深拷贝参与仿真的 Agent，避免改写模板对象 */
export function cloneAgent(a: Agent): Agent {
  return structuredClone(a)
}

export type { SourceLineData } from "./simulation"

type Store = {
  agents: Agent[]
  envInit: EnvironmentInitState
  envRound: EnvironmentRoundState
  agentActions: AgentAction[]
  totalRound: number
  sourceLineData: SourceLineData[]
  agentAliveRound: AgentAliveRoundData[]
  /** UI：是否勾选「启用自定义成员」 */
  customAgentEnabled: boolean
  /** 用户在 AgentsSetting 确认后的自定义 Agent（id 为用户输入名称） */
  customAgent: Agent | null
  setCustomAgentEnabled: (enabled: boolean) => void
  setCustomAgent: (agent: Agent | null) => void
  setCustonOllama: (id: string, config: AgentLLMConfig) => void
  init: (agents: Agent[], envInit: EnvironmentInitState, totalRound: number) => void
  tick: () => Promise<void>
}

const createAgentActions = (agents: Agent[]): AgentAction[] =>
  agents.map(agent => ({
    id: agent.id,
    actions: [],
  }))

//===========================状态创建====================================

export const useStore = create<Store>()(
  subscribeWithSelector((set, get) => ({
    agents: [],
    envInit: {} as EnvironmentInitState,
    envRound: {
      round: 0,
      timeLeft: 100,
      currentSource: 100,
      aliveAgent: [],
      envUpdates: [],
      coRelations: [],
      agentRelations: { memberIds: [], matrix: [] },
    },
    agentActions: [],
    totalRound: 0,
    sourceLineData: [],
    agentAliveRound: [],
    customAgentEnabled: false,
    customAgent: null,
    setCustomAgentEnabled: (enabled) => set({ customAgentEnabled: enabled }),
    setCustomAgent: (agent) => set({ customAgent: agent }),
    setCustonOllama: (id: string, config: AgentLLMConfig) => {
      agentLLMMap[id] = config
    },
    init: (agents, envInit, totalRound) => {
      useAgentMemoStore.getState().init(agents.map((a) => a.id))
      useEnvMemoStore.getState().init()
      const memberIds = agents.map(a => a.id)
      set(() => ({
        agents,
        envInit,
        envRound: {
          round: 0,
          timeLeft: 100,
          currentSource: envInit.resourceTotal,
          aliveAgent: agents.map(a => a.id),
          envUpdates: [],
          coRelations: [],
          agentRelations: createEmptyRelationSnapshot(memberIds),
        },
        agentActions: createAgentActions(agents),
        totalRound,
        sourceLineData: [{
          round: '0',
          Env: envInit.resourceTotal,
          agentResources: Object.fromEntries(agents.map(a => [a.id, 0])),
        }],
        agentAliveRound: agents.map(a => ({ name: a.id, aliveRond: 0 })),
      }))
    },

    tick: async () => {
      const state = get()
      const settledRound = state.envRound.round
      const context = createRoundContext(state)
      const result = await simulateRound(context, ollamaDecisionFn)

      const agentsMemory = useAgentMemoStore.getState().agentsMemory
      const memberIds = result.agents.map(a => a.id)

      set((current) => ({
        agents: result.agents,
        envRound: {
          ...result.envRound,
          agentRelations: computeRelationSnapshot(
            memberIds,
            agentsMemory,
            result.envRound.coRelations,
          ),
        },
        agentActions: result.agentActions,
        sourceLineData: [...current.sourceLineData, result.sourceLineData],
        agentAliveRound: result.agentAliveRound,
      }))
      const roundFacts = buildRoundFactsFromTick(
        settledRound,
        result,
        state.envInit,
        result.agentActions,
        agentsMemory,
      )
      const roundSummary = await ollamaEnvRoundSummaryFn(roundFacts)
      useEnvMemoStore.getState().appendRoundSummary(roundSummary)

      const ended =
        result.envRound.round >= state.envInit.round ||
        result.envRound.timeLeft <= 0 ||
        result.envRound.aliveAgent.length === 0

      if (ended) {
        const after = get()
        const finalFacts = buildFinalFacts(
          after.agents,
          after.envInit,
          after.envRound,
          after.agentActions,
          agentsMemory,
        )
        const winners = computeWinners(
          after.agents,
          after.agentAliveRound,
          agentsMemory,
        )
        const finalSummary = await ollamaEnvFinalSummaryFn({
          facts: finalFacts,
          winners,
        })
        useEnvMemoStore.getState().setFinalSummary(finalSummary)
      }
    },
  })),
)
