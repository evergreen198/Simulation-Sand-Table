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
import { ollamaDecisionFn } from "../OllamaAgents/OllamaAgents"
import type {AgentLLMConfig} from "../OllamaAgents/OllamaAgentsSetting"
import { agentLLMMap } from "../OllamaAgents/OllamaAgentsSetting"
import useAgentMemoStore from "./useAgentMemo"
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

    tick: async() => {
      const state = get()
      const context = createRoundContext(state)
      const result =await simulateRound(context,ollamaDecisionFn)

      set((current) => ({
        agents: result.agents,
        envRound: result.envRound,
        agentActions: result.agentActions,
        sourceLineData: [...current.sourceLineData, result.sourceLineData],
        agentAliveRound: result.agentAliveRound,
      }))
    },
  })),
)
