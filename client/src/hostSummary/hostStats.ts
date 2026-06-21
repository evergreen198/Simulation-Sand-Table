import type { AgentMemory, SocialMemoryPattern } from "../../../shared/types/memoTypes"
import { socialMemoryPatternList } from "../../../shared/types/memoTypes"
import type { Agent } from "../../../shared/types/AgentType"
import type {
  ActionCounts,
  HostAgentSnapshot,
  HostFinalFacts,
  HostGlobalSituation,
  HostRoundFacts,
  HostWinners,
} from "../../../shared/host/host-types"
import type { AgentAction, AgentAliveRoundData, SimulateRoundResult } from "../store/simulation"
import type { EnvironmentInitState, EnvironmentRoundState } from "../../../shared/types/EnvironmentType"

const PATTERN_LABEL: Record<SocialMemoryPattern, string> = {
  attack_by: "被攻击",
  attack_to: "攻击",
  betray_by: "被背叛",
  betray_to: "背叛",
  cooperate_by: "被合作",
  cooperate_to: "发起合作",
}

/** 统计指定回合各 agent 的行动计数 */
function countActionsForRound(
  agentActions: AgentAction[],
  round: number,
): ActionCounts {
  const counts: ActionCounts = {
    gather: 0,
    attack: 0,
    cooperate: 0,
    defend: 0,
    wait: 0,
  }
  for (const row of agentActions) {
    const hit = row.actions.find(e => e.round === round)
    if (!hit) continue
    const t = hit.action.type
    if (t in counts) counts[t as keyof ActionCounts] += 1
  }
  return counts
}

/** 从社交记忆提取指定回合的可读事件 */
function eventsFromSocialMemory(
  agentsMemory: AgentMemory[],
  round: number,
): string[] {
  const events: string[] = []
  for (const mem of agentsMemory) {
    for (const pattern of socialMemoryPatternList) {
      for (const entry of mem.socialMemory[pattern]) {
        if (entry.atRound !== round) continue
        events.push(
          `${mem.agentId} ${PATTERN_LABEL[pattern]} ${entry.agentId}（第${round}回合）`,
        )
      }
    }
  }
  return events
}

/** 从回合记忆提取死亡事件 */
function deathEventsFromRoundMemory(
  agentsMemory: AgentMemory[],
  round: number,
): string[] {
  const events: string[] = []
  for (const mem of agentsMemory) {
    const rm = mem.roundMemory.find(r => r.round === round)
    if (!rm) continue
    if (rm.beforeState.alive && !rm.afterState.alive) {
      events.push(`${mem.agentId} 阵亡（第${round}回合）`)
    }
  }
  return events
}

/**
 * 构建单回合事实
 * @param round 刚结算完的回合号（simulateRound 入参 envRound.round）
 * @param agents 结算后 agent 状态
 * @param envInit 环境初始参数
 * @param envRound 结算后环境回合状态
 * @param agentActions 含本轮行动的历史
 * @param agentsMemory 已更新的 agent 记忆
 */
export function buildRoundFacts(
  round: number,
  agents: Agent[],
  envInit: EnvironmentInitState,
  envRound: EnvironmentRoundState,
  agentActions: AgentAction[],
  agentsMemory: AgentMemory[],
): HostRoundFacts {
  const resourceTotal = Math.max(envInit.resourceTotal, 1)
  const resourceRatio = envRound.currentSource / resourceTotal

  const socialEvents = eventsFromSocialMemory(agentsMemory, round)
  const deathEvents = deathEventsFromRoundMemory(agentsMemory, round)
  const roundEvents = [...new Set([...socialEvents, ...deathEvents])]

  const agentSnapshots: HostAgentSnapshot[] = agents.map(a => {
    const row = agentActions.find(r => r.id === a.id)
    const act = row?.actions.find(e => e.round === round)?.action ?? null
    return {
      id: a.id,
      hp: a.state.hp,
      resource: a.state.resource,
      alive: a.state.alive,
      action: act,
    }
  })

  return {
    round,
    aliveCount: agents.filter(a => a.state.alive).length,
    currentSource: envRound.currentSource,
    resourceTotal,
    resourceRatio,
    actionCounts: countActionsForRound(agentActions, round),
    roundEvents,
    agentSnapshots,
  }
}

/**
 * 便捷：从 tick 后的 store 切片 + simulateRound 结果构建回合事实
 */
export function buildRoundFactsFromTick(
  settledRound: number,
  result: SimulateRoundResult,
  envInit: EnvironmentInitState,
  agentActions: AgentAction[],
  agentsMemory: AgentMemory[],
): HostRoundFacts {
  return buildRoundFacts(
    settledRound,
    result.agents,
    envInit,
    result.envRound,
    agentActions,
    agentsMemory,
  )
}

/** 全历史行动分布与主导策略描述 */
export function computeActionDistribution(agentActions: AgentAction[]): {
  counts: ActionCounts
  dominant: string
  ratioText: string
} {
  const counts: ActionCounts = {
    gather: 0,
    attack: 0,
    cooperate: 0,
    defend: 0,
    wait: 0,
  }
  let total = 0
  for (const row of agentActions) {
    for (const e of row.actions) {
      const t = e.action.type
      if (t in counts) {
        counts[t as keyof ActionCounts] += 1
        total += 1
      }
    }
  }
  if (total === 0) {
    return { counts, dominant: "无", ratioText: "尚无行动记录" }
  }
  const entries = Object.entries(counts) as [keyof ActionCounts, number][]
  entries.sort((a, b) => b[1] - a[1])
  const [dominant, n] = entries[0]!
  const pct = ((n / total) * 100).toFixed(0)
  const ratioText = entries
    .filter(([, v]) => v > 0)
    .map(([k, v]) => `${k} ${((v / total) * 100).toFixed(0)}%`)
    .join("，")
  return { dominant, counts, ratioText: `${ratioText}（主导：${dominant} ${pct}%）` }
}

/** 最近 recentRounds 轮是否策略收敛（单一行动类型 >70%） */
function isStrategyConverged(
  agentActions: AgentAction[],
  recentRounds: number,
): boolean {
  const rounds = new Set<number>()
  for (const row of agentActions) {
    for (const e of row.actions) rounds.add(e.round)
  }
  const sorted = [...rounds].sort((a, b) => b - a).slice(0, recentRounds)
  if (sorted.length === 0) return false

  for (const r of sorted) {
    const c = countActionsForRound(agentActions, r)
    const total = Object.values(c).reduce((s, v) => s + v, 0)
    if (total === 0) continue
    const max = Math.max(...Object.values(c))
    if (max / total > 0.7) return true
  }
  return false
}

/** 资源领先者描述 */
function describeLeader(agents: Agent[]): string {
  if (agents.length === 0) return "无 agent"
  const sorted = [...agents].sort((a, b) => b.state.resource - a.state.resource)
  const first = sorted[0]!
  const second = sorted[1]
  if (!second) return `${first.id} 独占资源领先`
  const ratio = second.state.resource > 0
    ? first.state.resource / second.state.resource
    : Infinity
  if (ratio >= 1.5) {
    return `${first.id} 明显领先（资源 ${first.state.resource}，第二名 ${second.id} ${second.state.resource}）`
  }
  return `${first.id} 略领先（资源 ${first.state.resource}）`
}

/** 博弈张力：交互行动 vs 采集的比例差 */
function describeTension(counts: ActionCounts): string {
  const interactive = counts.attack + counts.cooperate
  const gather = counts.gather
  const total = interactive + gather + counts.defend + counts.wait
  if (total === 0) return "尚无足够行动数据"
  const iPct = ((interactive / total) * 100).toFixed(0)
  const gPct = ((gather / total) * 100).toFixed(0)
  const diff = interactive - gather
  if (diff > 0) return `冲突/合作偏强（交互 ${iPct}% vs 采集 ${gPct}%）`
  if (diff < 0) return `采集偏稳（采集 ${gPct}% vs 交互 ${iPct}%）`
  return `采集与交互大致均衡（各约 ${gPct}% / ${iPct}%）`
}

/** 汇总全局局势指标 */
export function buildGlobalSituation(
  agents: Agent[],
  envInit: EnvironmentInitState,
  envRound: EnvironmentRoundState,
  agentActions: AgentAction[],
): HostGlobalSituation {
  const resourceTotal = Math.max(envInit.resourceTotal, 1)
  const ratio = envRound.currentSource / resourceTotal
  const { ratioText, counts } = computeActionDistribution(agentActions)

  const resourceStatus =
    ratio < 0.2
      ? `资源枯竭（剩余 ${envRound.currentSource}/${resourceTotal}，${(ratio * 100).toFixed(0)}%）`
      : ratio < 0.5
        ? `资源偏紧（剩余 ${envRound.currentSource}/${resourceTotal}）`
        : `资源尚可（剩余 ${envRound.currentSource}/${resourceTotal}）`

  return {
    resourceStatus,
    actionRatio: ratioText,
    strategyConvergence: isStrategyConverged(agentActions, 2)
      ? "近期出现策略收敛（单一行动类型占比 >70%）"
      : "策略仍较分散，未明显收敛",
    leader: describeLeader(agents),
    tension: describeTension(counts),
  }
}

/** 遍历全部记忆，收集去重后的特殊事件描述 */
export function collectAllSpecialEvents(agentsMemory: AgentMemory[]): string[] {
  const events = new Set<string>()
  for (const mem of agentsMemory) {
    for (const pattern of socialMemoryPatternList) {
      for (const entry of mem.socialMemory[pattern]) {
        events.add(
          `${mem.agentId} ${PATTERN_LABEL[pattern]} ${entry.agentId}（第${entry.atRound}回合）`,
        )
      }
    }
    for (const rm of mem.roundMemory) {
      if (rm.beforeState.alive && !rm.afterState.alive) {
        events.add(`${mem.agentId} 阵亡（第${rm.round}回合）`)
      }
    }
  }
  return [...events]
}

/** 取某 agent 合作相关记忆条数 */
function coopScore(mem: AgentMemory): number {
  return (
    mem.socialMemory.cooperate_to.length +
    mem.socialMemory.cooperate_by.length
  )
}

/** 取某 agent 攻击发起条数 */
function attackScore(mem: AgentMemory): number {
  return mem.socialMemory.attack_to.length
}

/** 在并列最高分者中取资源最高者 */
function tieBreakByResource(ids: string[], agents: Agent[]): string {
  const byId = new Map(agents.map(a => [a.id, a]))
  return ids.sort(
    (a, b) =>
      (byId.get(b)?.state.resource ?? 0) - (byId.get(a)?.state.resource ?? 0),
  )[0]!
}

/** 多维胜利者（确定性计算） */
export function computeWinners(
  agents: Agent[],
  agentAliveRound: AgentAliveRoundData[],
  agentsMemory: AgentMemory[],
): HostWinners {
  if (agents.length === 0) {
    return {
      resource: "—",
      survival: "—",
      cooperation: "—",
      attack: "—",
      composite: "—",
    }
  }

  const topRes = Math.max(...agents.map(a => a.state.resource))
  const resourceIds = agents.filter(a => a.state.resource === topRes).map(a => a.id)
  const resource = tieBreakByResource(resourceIds, agents)

  const aliveMap = new Map(agentAliveRound.map(r => [r.name, r.aliveRond]))
  const topAlive = Math.max(...agentAliveRound.map(r => r.aliveRond))
  const survivalIds = agentAliveRound
    .filter(r => r.aliveRond === topAlive)
    .map(r => r.name)
  const survival = tieBreakByResource(survivalIds, agents)

  const coopScores = agentsMemory.map(m => ({
    id: m.agentId,
    score: coopScore(m),
    accepted: agents.find(a => a.id === m.agentId)?.state.beAcceptedCurrent ?? 0,
  }))
  const topCoop = Math.max(...coopScores.map(c => c.score))
  const coopIds = coopScores
    .filter(c => c.score === topCoop)
    .sort((a, b) => b.accepted - a.accepted)
    .map(c => c.id)
  const cooperation = coopIds[0] ?? agents[0]!.id

  const atkScores = agentsMemory.map(m => ({
    id: m.agentId,
    score: attackScore(m),
  }))
  const topAtk = Math.max(...atkScores.map(c => c.score))
  const atkIds = atkScores.filter(c => c.score === topAtk).map(c => c.id)
  const attack = tieBreakByResource(atkIds, agents)

  const compositeScores = agents.map(a => {
    const mem = agentsMemory.find(m => m.agentId === a.id)
    const aliveRond = aliveMap.get(a.id) ?? 0
    const coop = mem ? coopScore(mem) : 0
    const atk = mem ? attackScore(mem) : 0
    const score =
      a.state.resource * 0.35 +
      aliveRond * 0.25 +
      coop * 0.2 +
      atk * 0.1 +
      a.state.hp * 0.1
    return { id: a.id, score }
  })
  const topComposite = Math.max(...compositeScores.map(c => c.score))
  const compositeIds = compositeScores
    .filter(c => c.score === topComposite)
    .map(c => c.id)
  const composite = tieBreakByResource(compositeIds, agents)

  return { resource, survival, cooperation, attack, composite }
}

/**
 * 构建终局事实（不含 winners，winners 单独传入 LLM）
 */
export function buildFinalFacts(
  agents: Agent[],
  envInit: EnvironmentInitState,
  envRound: EnvironmentRoundState,
  agentActions: AgentAction[],
  agentsMemory: AgentMemory[],
): HostFinalFacts {
  const resourceTotal = Math.max(envInit.resourceTotal, 1)
  const agentSnapshots: HostAgentSnapshot[] = agents.map(a => {
    const row = agentActions.find(r => r.id === a.id)
    const last = row?.actions[row.actions.length - 1]
    return {
      id: a.id,
      hp: a.state.hp,
      resource: a.state.resource,
      alive: a.state.alive,
      action: last?.action ?? null,
    }
  })

  return {
    totalRounds: envRound.round,
    aliveCount: agents.filter(a => a.state.alive).length,
    currentSource: envRound.currentSource,
    resourceTotal,
    resourceRatio: envRound.currentSource / resourceTotal,
    globalSituation: buildGlobalSituation(agents, envInit, envRound, agentActions),
    specialEvents: collectAllSpecialEvents(agentsMemory),
    agentSnapshots,
  }
}
