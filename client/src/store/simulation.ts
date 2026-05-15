import type { Agent } from "../types/AgentType"
import type { Action } from "../types/Action"
import type {
  EnvironmentInitState,
  EnvironmentRoundState,
} from "../types/EnvironmentType"
import type { DecisionFn } from "./decisionProcessing/decisionInterface"
import { decideAll } from "./decisionProcessing/decisionPipeline"

/** 单 agent 行为历史，结构与 store 一致 */
export interface AgentAction {
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

export interface AgentAliveRoundData {
  name: string
  aliveRond: number
}

export type ResolvedAction = {
  id: string
  action: Action
}

/** 仿真一步所需的最小 state 切片，避免与 zustand Store 循环依赖 */
export type SimulationStateSnapshot = {
  agents: Agent[]
  envInit: EnvironmentInitState
  envRound: EnvironmentRoundState
  agentActions: AgentAction[]
  agentAliveRound: AgentAliveRoundData[]
}

export type RoundContext = SimulationStateSnapshot

export function createRoundContext(state: SimulationStateSnapshot): RoundContext {
  return {
    agents: state.agents,
    envInit: state.envInit,
    envRound: state.envRound,
    agentActions: state.agentActions,
    agentAliveRound: state.agentAliveRound,
  }
}

export async function resolveRoundActions(
  context: RoundContext,
  decisionFn?: DecisionFn,
): Promise<ResolvedAction[]> {
  const { agents, envInit, envRound } = context
  return await decideAll(agents, envInit, envRound, decisionFn)
}

export function recordAgentActions(
  agentActions: AgentAction[],
  actions: ResolvedAction[],
  round: number,
): AgentAction[] {
  return agentActions.map(agentAction => {
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
}

export function applyResolvedActions(
  agents: Agent[],
  actions: ResolvedAction[],
  envInit: EnvironmentInitState,
  envRound: EnvironmentRoundState,
): Agent[] {
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

  return newAgents
}

export function applySurvivalRules(agents: Agent[]): Agent[] {
  return agents.map(a => {
    const state = { ...a.state }
    if (state.resource <= 0) {
      state.hp -= 1
    }
    if (state.hp <= 0) {
      state.alive = false
    }
    return { ...a, state }
  })
}

export function computeNextEnvRound(
  envRound: EnvironmentRoundState,
  envInit: EnvironmentInitState,
  agents: Agent[],
): EnvironmentRoundState {
  const aliveAgent = agents.filter(a => a.state.alive).map(a => a.id)
  return {
    ...envRound,
    round: envRound.round + 1,
    timeLeft: envRound.timeLeft - 1,
    aliveAgent,
    currentSource:
      envRound.currentSource +
      envInit.regenerationRate -
      agents.length * 0.5,
  }
}

export function createSourceLineData(
  envRound: EnvironmentRoundState,
  agents: Agent[],
): SourceLineData {
  return {
    round: `${envRound.round + 1}`,
    Env: envRound.currentSource,
    agentResources: Object.fromEntries(
      agents.map(a => [a.id, a.state.resource]),
    ),
  }
}

export const computeNextAgentAliveRound = (
  prev: AgentAliveRoundData[],
  agents: Agent[],
): AgentAliveRoundData[] => {
  if (prev.length === 0) return prev
  const byId = new Map(agents.map(a => [a.id, a]))
  return prev.map(row => {
    const agent = byId.get(row.name)
    if (!agent?.state.alive) return row
    return { ...row, aliveRond: row.aliveRond + 1 }
  })
}

function serializeAgents(list: Agent[]) {
  return list.map(a => ({
    id: a.id,
    resource: a.state.resource,
    hp: a.state.hp,
    alive: a.state.alive,
  }))
}

export type SimulateRoundResult = {
  agents: Agent[]
  envRound: EnvironmentRoundState
  agentActions: AgentAction[]
  sourceLineData: SourceLineData
  agentAliveRound: AgentAliveRoundData[]
}

export async function simulateRound(
  context: RoundContext,
  decisionFn?: DecisionFn,
): Promise<SimulateRoundResult> {
  const { agents, envInit, envRound, agentActions, agentAliveRound } = context

  const actions = await resolveRoundActions(context, decisionFn)
  const nextAgentActions = recordAgentActions(
    agentActions,
    actions,
    envRound.round,
  )

  console.log(`\n[Simulation] Round ${envRound.round}`)
  console.log("[Simulation] actions:", agentActions)
  console.log("[Simulation] state(before):", serializeAgents(agents))

  const afterActions = applyResolvedActions(
    agents,
    actions,
    envInit,
    envRound,
  )
  const newAgents = applySurvivalRules(afterActions)
  const nextEnvRound = computeNextEnvRound(envRound, envInit, newAgents)
  const sourceLineData = createSourceLineData(envRound, newAgents)

  console.log("[Simulation] state(after):", serializeAgents(newAgents))
  console.log("[Simulation] envRound(after):", nextEnvRound)

  const nextAgentAliveRound = computeNextAgentAliveRound(
    agentAliveRound,
    newAgents,
  )

  return {
    agents: newAgents,
    envRound: nextEnvRound,
    agentActions: nextAgentActions,
    sourceLineData,
    agentAliveRound: nextAgentAliveRound,
  }
}
