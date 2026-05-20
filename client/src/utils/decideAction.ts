import type { Agent } from "../types/AgentType"
import type { EnvironmentInitState, EnvironmentRoundState } from "../types/EnvironmentType"
import type { Action } from "../types/Action"

export function decideAction(
  agent: Agent,
  agents: Agent[],
  envInit: EnvironmentInitState,
  envRound: EnvironmentRoundState
): Action {
  if (!agent.state.alive) return { type: "wait" }

  const others = agents.filter(a => a.id !== agent.id && a.state.alive)

  // 找目标辅助函数
  const getWeakest = () =>
    others.reduce((a, b) =>
      a.state.resource < b.state.resource ? a : b
    )

  const getRichest = () =>
    others.reduce((a, b) =>
      a.state.resource > b.state.resource ? a : b
    )

  const weakest = others.length ? getWeakest() : null
  const richest = others.length ? getRichest() : null

  // 基础参数
  const { risk, greed, social, aggression } = agent.traits
  const { resource, hp } = agent.state

  const {
    competitionReward,
    cooperationReward,
    betrayalBonus,
    riskLevel,
  } = envInit

  const resourceScarcity =
    1 - envRound.currentSource / (envInit.resourceTotal + 1)

  // 信息噪声（干扰决策）

  // =========================
  // gather
  // =========================
  const gatherScore =
    greed * envRound.currentSource * 0.1 -
    riskLevel * (1 - risk) * 0.2 -
    resourceScarcity * 0.5 

  // =========================
  // attack
  // =========================
  let attackScore = -Infinity
  let attackTarget: string | null = null

  if (weakest) {
    const target = weakest

    const gain = competitionReward * aggression
    const riskCost = riskLevel * (1 - risk)
    const revengeRisk = target.traits.aggression * 0.5

    attackScore =
      gain -
      riskCost -
      revengeRisk +
      greed * 0.3 +
      (target.state.resource < resource ? 0.2 : -0.2) 

    attackTarget = target.id
  }

  // =========================
  // cooperate
  // =========================
  let coopScore = -Infinity
  let coopTarget: string | null = null

  if (richest) {
    const target = richest

    const baseGain =
      cooperationReward * (social + target.traits.social)

    const betrayalRisk =
      betrayalBonus * (1 - social)

    coopScore =
      baseGain -
      betrayalRisk +
      social * 0.5 +
      (agent.goal === "survive" ? 0.3 : 0) 

    coopTarget = target.id
  }

  // =========================
  // defend
  // =========================
  const defendScore =
    riskLevel * (1 - risk) +
    (hp < 30 ? 0.5 : 0) +
    (resource < 20 ? 0.3 : 0) 

  // =========================
  // wait
  // =========================
  const waitScore =
    (agent.goal === "survive" ? 0.3 : 0) -
    aggression * 0.2 

  // =========================
  // 选最大
  // =========================
  type ScoreRow =
    | { type: "gather"; score: number }
    | { type: "attack"; score: number; target: string }
    | { type: "cooperate"; score: number; target: string }
    | { type: "defend"; score: number }
    | { type: "wait"; score: number }

  const scores: ScoreRow[] = [
    { type: "gather", score: gatherScore },
    ...(attackTarget
      ? [{ type: "attack" as const, score: attackScore, target: attackTarget }]
      : []),
    ...(coopTarget
      ? [{ type: "cooperate" as const, score: coopScore, target: coopTarget }]
      : []),
    { type: "defend", score: defendScore },
    { type: "wait", score: waitScore },
  ]

  scores.sort((a, b) => b.score - a.score)

  const best = scores[0]!

  // 返回 Action
  switch (best.type) {
    case "attack":
      return { type: "attack", target: best.target }
    case "cooperate":
      return { type: "cooperate", target: best.target }
    case "defend":
      return { type: "defend" }
    case "wait":
      return { type: "wait" }
    default:
      return { type: "gather" }
  }
}