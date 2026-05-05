import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import type { Agent } from "../types/AgentType"
import type { Action } from "../types/Action"
import type {
  EnvironmentInitState,
  EnvironmentRoundState,
} from "../types/EnvironmentType"
import { decideAction } from "../utils/decideAction"

/** 深拷贝参与仿真的 Agent，避免改写模板对象 */
export function cloneAgent(a: Agent): Agent {
  return structuredClone(a)
}

interface AgentAction {
  id: string
  actions: {
    round: number
    action: Action
  }[]
}

/** 折线图一行：环境资源 + 各 agent id 对应的资源快照 */
export type SourceLineData = {
  round: string
  Env: number
  agentResources: Record<string, number>
}

interface AgentAliveRoundData {
  name: string,
  aliveRond: number,
}

type ResolvedAction = {
  id: string
  action: Action
}

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
  init: (agents: Agent[], envInit: EnvironmentInitState, totalRound: number) => void
  tick: () => void
}

const createAgentActions = (agents: Agent[]): AgentAction[] =>
  agents.map(agent => ({
    id: agent.id,
    actions: [],
  }))

export const computeNextAgentAliveRound = (
  prev: AgentAliveRoundData[],
  agents: Agent[],
): AgentAliveRoundData[] => {
  if (prev.length === 0) return prev
  const byId = new Map(agents.map((a) => [a.id, a]))
  return prev.map((row) => {
    const agent = byId.get(row.name)
    if (!agent?.state.alive) return row
    return { ...row, aliveRond: row.aliveRond + 1 }
  })
}

const recordAgentActions = (
  agentActions: AgentAction[],
  actions: ResolvedAction[],
  round: number,
): AgentAction[] =>
  agentActions.map(agentAction => {
    const currentAction = actions.find(action => action.id === agentAction.id)

    if (!currentAction) {
      return agentAction
    }

    return {
      ...agentAction,
      actions: [
        ...agentAction.actions,
        {
          round,
          action: currentAction.action,
        },
      ],
    }
  })

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
    },
    agentActions: [],
    totalRound: 0,
    sourceLineData: [],
    agentAliveRound: [],
    customAgentEnabled: false,
    customAgent: null,
    setCustomAgentEnabled: (enabled) => set({ customAgentEnabled: enabled }),
    setCustomAgent: (agent) => set({ customAgent: agent }),
    init: (agents, envInit, totalRound) => {
      set(() => ({
        agents,
        envInit,
        envRound: {
          round: 0,
          timeLeft: 100,
          currentSource: envInit.resourceTotal,
          aliveAgent: agents.map(a => a.id),
          envUpdates: [],
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

    tick: () => {
      const { agents, envInit, envRound, agentActions } = get()

      const serializeAgents = (list: Agent[]) =>
        list.map(a => ({
          id: a.id,
          resource: a.state.resource,
          hp: a.state.hp,
          alive: a.state.alive,
        }))

      const actions: ResolvedAction[] = agents.map(agent => ({
        id: agent.id,
        action: decideAction(agent, agents, envInit, envRound),
      }))

      const nextAgentActions = recordAgentActions(
        agentActions,
        actions,
        envRound.round,
      )

      console.log(`\n[Simulation] Round ${envRound.round}`)
      console.log("[Simulation] actions:", agentActions)
      console.log("[Simulation] state(before):", serializeAgents(agents))

      const newAgents = agents.map(a => ({
        ...a,
        state: { ...a.state },
      }))

      actions.forEach(({ id, action }) => {
        const actor = newAgents.find(a => a.id === id)
        if (!actor || !actor.state.alive) return

        switch (action.type) {
          case "gather":
            actor.state.resource += envRound.currentSource * 0.05
            break

          case "attack": {
            const target = newAgents.find(a => a.id === action.target)
            if (!target || !target.state.alive) break

            const dmg = envInit.competitionReward * actor.traits.aggression
            target.state.resource -= dmg
            actor.state.resource += dmg * 0.5
            break
          }

          case "cooperate": {
            const target = newAgents.find(a => a.id === action.target)
            if (!target || !target.state.alive) break

            const gain =
              envInit.cooperationReward *
              (actor.traits.social + target.traits.social)

            actor.state.resource += gain
            target.state.resource += gain
            break
          }

          case "defend":
            actor.state.hp += 1
            break

          case "wait":
            actor.state.hp += 0.2
            break

          case "dead":
            break
        }
      })

      newAgents.forEach(a => {
        if (a.state.resource <= 0) {
          a.state.hp -= 1
        }
        if (a.state.hp <= 0) {
          a.state.alive = false
        }
      })

      const aliveAgent = newAgents.filter(a => a.state.alive).map(a => a.id)

      const nextEnvRound = {
        ...envRound,
        round: envRound.round + 1,
        timeLeft: envRound.timeLeft - 1,
        aliveAgent,
        currentSource:
          envRound.currentSource +
          envInit.regenerationRate -
          newAgents.length * 0.5,
      }

      console.log("[Simulation] state(after):", serializeAgents(newAgents))
      console.log("[Simulation] envRound(after):", nextEnvRound)
      const newSourceLineData: SourceLineData = {
        round: `${envRound.round + 1}`,
        Env: envRound.currentSource,
        agentResources: Object.fromEntries(
          newAgents.map(a => [a.id, a.state.resource]),
        ),
      }


      set((state) => ({
        agents: newAgents,
        envRound: nextEnvRound,
        agentActions: nextAgentActions,
        sourceLineData: [...state.sourceLineData, newSourceLineData],
        agentAliveRound: computeNextAgentAliveRound(
          state.agentAliveRound,
          newAgents,
        ),
      }))
    },
  })),
)
