import type { Agent } from "../types/AgentType"
import type { Action } from "../types/Action"
import type {
  CoRelation,
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

// ─────────────────────────────────────────────────
// 暴露度 → 环境风险倍率映射（临时变量，不进持久化）
// ─────────────────────────────────────────────────
type ExposureLevel = "ultraLow" | "low" | "medium" | "high"
const EXPOSURE_MULTIPLIER: Record<ExposureLevel, number> = {
  ultraLow: 0.1,
  low: 0.3,
  medium: 0.7,
  high: 1.0,
}

/** 标准化合作关系 key："A-B"（按 id 字母序） */
function coRelationKey(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

/** 检查二人是否存在活跃合作关系 */
function hasActiveCoRelation(
  a: string,
  b: string,
  relMap: Map<string, CoRelation>,
): boolean {
  return relMap.get(coRelationKey(a, b))?.active === true
}

/** 取消活跃合作关系 */
function deactivateCoRelation(
  a: string,
  b: string,
  relMap: Map<string, CoRelation>,
): void {
  const rel = relMap.get(coRelationKey(a, b))
  if (rel?.active) rel.active = false
}

/** 建立/更新合作关系（3 回合收益窗口，每次结算自动续约 1 回合） */
function upsertCoRelation(
  a: string,
  b: string,
  round: number,
  relMap: Map<string, CoRelation>,
): void {
  const key = coRelationKey(a, b)
  const existing = relMap.get(key)
  if (existing) {
    existing.active = true
    existing.establishedRound = round
    existing.validUntilRound = Math.min(existing.validUntilRound + 1, round + 3)
  } else {
    relMap.set(key, {
      id: key,
      agentA: a,
      agentB: b,
      establishedRound: round,
      validUntilRound: round + 3,
      active: true,
    })
  }
}

/** 辅助：值裁剪到 [min, max] */
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

// ════════════════════════════════════════════════════
// applyResolvedActions ─ 八阶段结算流水线
//
// 入参:
//   agents       — 当前 Agent 状态
//   actions      — 本轮各 agent 决策结果
//   envInit      — 环境初始参数
//   envRound     — 环境回合状态（含 coRelations）
//
// 出参:
//   { agents[], coRelations[] }
//
// 临时变量:
//   exposure     Map<id, ExposureLevel>  暴露度，函数返回即销毁
//   shield       Set<id>                 本回合护盾标记
//   coopAccepted Set<key>                本轮双向合作成功的 pair
// ════════════════════════════════════════
export function applyResolvedActions(
  agents: Agent[],
  actions: ResolvedAction[],
  envInit: EnvironmentInitState,
  envRound: EnvironmentRoundState,
): { agents: Agent[]; coRelations: CoRelation[] } {
  // ── 拷贝 agents（浅复制 + state 深一层）──
  const newAgents = agents.map(a => ({
    ...a,
    state: { ...a.state },
  }))

  // ── agent 索引：避免 Phase 4/5/6 中 O(n) 的 find ──
  const agentMap = new Map(newAgents.map(a => [a.id, a]))

  // ── 环境参数缩放：UI 保持 0~100，结算层统一 ÷20 对齐 hp=10/resource=0 尺度 ──
  const scaledCompetition = envInit.competitionReward / 20
  const scaledCooperation = envInit.cooperationReward / 20
  const scaledBetrayal    = envInit.betrayalBonus    / 20
  const scaledRisk        = envInit.riskLevel         / 20

  // ── Phase 0 快照：Phase 6 结算统一使用上轮末值，消除顺序依赖 ──
  const resourceSnapshot = new Map(newAgents.map(a => [a.id, a.state.resource]))
  const hpSnapshot = new Map(newAgents.map(a => [a.id, a.state.hp]))

  // ── coRelations 工作副本：Map 索引 + 条目浅复制 ──
  //    替代 structuredClone，一次遍历同时完成索引构建与数据复制
  const relMap = new Map<string, CoRelation>(
    envRound.coRelations.map(r => [r.id, { ...r }]),
  )

  // ── 临时变量 ──
  const exposure = new Map<string, ExposureLevel>()
  const shield = new Set<string>()
  const coopAccepted = new Set<string>() // key: normalized "A-B"

  const actionMap = new Map(actions.map(a => [a.id, a]))

  // ═══════════════════════════════════════
  // Phase 1 — 基础代谢
  // ═══════════════════════════════════════
  for (const agent of newAgents) {
    if (!agent.state.alive) continue
    // 固定消耗
    agent.state.resource -= 1
    // 自然回血 / 扣血
    if (agent.state.resource > 0) {
      const baseRegen = Math.min(agent.state.resource * 0.02, 0.5)
      const regen = baseRegen / (1 + agent.state.resource * 0.01)
      agent.state.hp += regen
    } else {
      agent.state.hp -= 1
    }
  }

  // ═══════════════════════════════════════
  // Phase 2 — 等待 & 防御
  // ═══════════════════════════════════════
  for (const agent of newAgents) {
    if (!agent.state.alive) continue
    const act = actionMap.get(agent.id)?.action
    if (act?.type === "wait") {
      agent.state.hp += 0.15
      exposure.set(agent.id, "ultraLow")
    } else if (act?.type === "defend") {
      agent.state.hp += 0.3
      shield.add(agent.id)
      exposure.set(agent.id, "low")
    }
  }

  // ═══════════════════════════════════════
  // Phase 3 — 搜集资源
  // ═══════════════════════════════════════
  for (const agent of newAgents) {
    if (!agent.state.alive) continue
    const act = actionMap.get(agent.id)?.action
    if (act?.type === "gather") {
      agent.state.resource += envRound.currentSource * 0.02
      exposure.set(agent.id, "medium")
    }
  }

  // ═══════════════════════════════════════
  // Phase 4 — 合作邀请 · target 判定
  //
  // 接受概率 = reputation(由 inviter 信誉决定)
  //          + disposition(由 target 性格决定)
  //          + relationBonus(已有合作关系加成)
  //          + pressure(由 target 生存压力决定)
  //
  // inviter.beAcceptedBase × beAcceptedCurrent → "inviter 在群体中的口碑"
  // target.social / aggression         → "target 的合作门槛"
  // ═══════════════════════════════════════
  for (const agent of newAgents) {
    if (!agent.state.alive) continue
    const act = actionMap.get(agent.id)?.action
    if (act?.type !== "cooperate" || !act.target) continue
    const inviter = agent
    const target = agentMap.get(act.target)
    if (target && !target.state.alive) continue
    if (!target) continue

    // 规则：若 target 本轮攻击 inviter → 自动拒绝
    const targetAct = actionMap.get(target.id)?.action
    if (
      targetAct?.type === "attack" &&
      targetAct.target === inviter.id
    ) {
      continue // 拒绝
    }

    // ── 分量 1：inviter 信誉信号（主效应）──
    // beAcceptedBase × beAcceptedCurrent 刻画"这个 agent 在群体中的口碑"
    // 历史上常背叛的 agent，beAcceptedCurrent 持续走低 →
    // 越来越难发起新合作
    const reputation =
      inviter.traits.beAcceptedBase *
      inviter.state.beAcceptedCurrent *
      0.5

    // ── 分量 2：target 性格过滤器（调节效应）──
    // social 高的 target 更开放，aggression 高的更封闭
    const disposition =
      target.traits.social * 0.25 -
      target.traits.aggression * 0.2

    // ── 分量 3：关系历史加成（情境效应）──
    // 已有活跃 coRelation → 信任惯性
    const relationBonus =
      hasActiveCoRelation(inviter.id, target.id, relMap) ? 0.35 : 0

    // ── 分量 4：target 生存压力（紧急效应）──
    // HP 越低、资源越少 → 越倾向接受合作（求生驱动），量级控制在 ~0.15
    const hpPressure = (1 - target.state.hp / 10) * 0.1
    const resourcePressure = Math.max(0, 1 - target.state.resource / 50) * 0.05
    const pressure = clamp(hpPressure + resourcePressure, 0, 0.15)

    const acceptanceProb = clamp(
      reputation + disposition + relationBonus + pressure,
      0,
      1,
    )

    if (Math.random() < acceptanceProb) {
      coopAccepted.add(coRelationKey(inviter.id, target.id))
      // 发起者暴露度
      exposure.set(inviter.id, "medium")
    }
  }

  // ═══════════════════════════════════════
  // Phase 5 — 攻击（含背叛判定）
  // ═══════════════════════════════════════
  for (const agent of newAgents) {
    if (!agent.state.alive) continue
    const act = actionMap.get(agent.id)?.action
    if (act?.type !== "attack" || !act.target) continue
    const attacker = agent
    const target = agentMap.get(act.target)
    if (target && !target.state.alive) continue
    if (!target) continue

    // 背叛判定：已有关系（relMap）或本回合新建立但尚未结算的关系（coopAccepted）
    const isBetrayal =
      hasActiveCoRelation(attacker.id, target.id, relMap) ||
      coopAccepted.has(coRelationKey(attacker.id, target.id))

    let damage: number
    let gain: number
    let targetLoss: number

    if (isBetrayal) {
      // 背叛收益
      damage = scaledBetrayal * attacker.traits.aggression * 1.5
      gain = damage * 0.7
      targetLoss = damage * 1.2
      // 背叛后果
      deactivateCoRelation(attacker.id, target.id, relMap)
      attacker.state.beAcceptedCurrent = clamp(attacker.state.beAcceptedCurrent - 0.15, 0, 1)
      target.state.beAcceptedCurrent = clamp(target.state.beAcceptedCurrent + 0.03, 0, 1)
      // 移除合作资格
      coopAccepted.delete(coRelationKey(attacker.id, target.id))
    } else {
      // 普通攻击
      damage = scaledCompetition * attacker.traits.aggression * 2.0
      gain = damage * 0.5
      targetLoss = damage
    }

    // 防御减伤
    if (shield.has(target.id)) {
      const factor = 0.6
      targetLoss *= factor
      gain *= factor
    }

    attacker.state.resource += gain
    target.state.resource -= targetLoss
    target.state.hp -= targetLoss * 0.2

    exposure.set(attacker.id, "high")
  }

  // ═══════════════════════════════════════
  // Phase 6 — 合作结算（三段式：收集 → 快照计算 → 统一写回）
  //
  // 规则：
  //   - 新关系从下一回合起参与结算，本回合只结算 relMap 中已 active 的对
  //   - 所有结算指标使用 Phase 0 快照值，消除顺序依赖
  //   - 边际递减：同一 agent 参与 k 对合作，收益 × 1/(1+(k-1)×0.25)
  //   - beAcceptedCurrent 每回合上限 +0.03
  // ═══════════════════════════════════════

  // 6a. 收集所有可结算合作对（仅已有 active 关系，不含本回合新关系）
  const settlePairs: [string, string][] = []
  for (const rel of relMap.values()) {
    if (!rel.active) continue
    if (rel.validUntilRound < envRound.round) continue
    const A = agentMap.get(rel.agentA)
    const B = agentMap.get(rel.agentB)
    if (!A?.state.alive || !B?.state.alive) continue
    settlePairs.push([rel.agentA, rel.agentB])
  }

  // 6b. 基于 Phase 0 快照批量计算每对的结算结果
  type SettleDelta = { resource: number; hp: number }
  const deltas = new Map<string, SettleDelta>()
  // 统计每个 agent 参与的合作对数（用于边际递减）
  const pairCount = new Map<string, number>()

  for (const [aId, bId] of settlePairs) {
    const A = agentMap.get(aId)!
    const B = agentMap.get(bId)!

    // 使用快照值（上轮末状态）
    const snapResA = resourceSnapshot.get(aId)!
    const snapResB = resourceSnapshot.get(bId)!
    const snapHpA = hpSnapshot.get(aId)!
    const snaphpB = hpSnapshot.get(bId)!

    // --- 层 1：共同产出 ---
    const layer1 = scaledCooperation * (A.traits.social + B.traits.social) * 1.5

    // --- 层 2：强者均衡弱者（上限 富者 30%）---
    const maxTransfer = Math.max(snapResA, snapResB) * 0.3

    // 血量均衡（基于快照）
    const hpDiff = Math.abs(snapHpA - snaphpB)
    const hpTransfer = Math.min(hpDiff * 0.1 * scaledCooperation, maxTransfer)
    const hpDeltaA = snapHpA > snaphpB ? -hpTransfer : +hpTransfer
    const hpDeltaB = snapHpA > snaphpB ? +hpTransfer : -hpTransfer

    // 资源均衡（基于快照）
    const resDiff = Math.abs(snapResA - snapResB)
    const resTransfer = Math.min(resDiff * 0.1 * scaledCooperation, maxTransfer)
    const resDeltaA = snapResA > snapResB ? -resTransfer : +resTransfer
    const resDeltaB = snapResA > snapResB ? +resTransfer : -resTransfer

    // 记录 delta（待边际递减后应用）
    const curA = deltas.get(aId) ?? { resource: 0, hp: 0 }
    const curB = deltas.get(bId) ?? { resource: 0, hp: 0 }
    curA.resource += layer1 + resDeltaA
    curA.hp += hpDeltaA
    curB.resource += layer1 + resDeltaB
    curB.hp += hpDeltaB
    deltas.set(aId, curA)
    deltas.set(bId, curB)

    pairCount.set(aId, (pairCount.get(aId) ?? 0) + 1)
    pairCount.set(bId, (pairCount.get(bId) ?? 0) + 1)

    // 续约
    upsertCoRelation(aId, bId, envRound.round, relMap)
    exposure.set(aId, "medium")
    exposure.set(bId, "medium")
  }

  // 6c. 边际递减 + 统一写回 + beAcceptedCurrent 上限
  const reputationGained = new Set<string>()
  for (const [agentId, delta] of deltas) {
    const k = pairCount.get(agentId) ?? 1
    const factor = 1 / (1 + (k - 1) * 0.25)
    const agent = agentMap.get(agentId)!
    agent.state.resource += delta.resource * factor
    agent.state.hp += delta.hp * factor

    // beAcceptedCurrent 每回合最多 +0.03（无论多少对合作）
    if (!reputationGained.has(agentId)) {
      agent.state.beAcceptedCurrent = clamp(agent.state.beAcceptedCurrent + 0.03, 0, 1)
      reputationGained.add(agentId)
    }
  }

  // ═══════════════════════════════════════
  // Phase 7 — 环境风险注入
  // ═══════════════════════════════════════
  for (const agent of newAgents) {
    if (!agent.state.alive) continue
    const exp = exposure.get(agent.id)
    if (!exp) continue // 未行动则不触发

    const effectiveRisk = scaledRisk * 0.1 * EXPOSURE_MULTIPLIER[exp]
    if (Math.random() < effectiveRisk) {
      let envDamage = scaledRisk * 0.3
      if (shield.has(agent.id)) envDamage *= 0.6
      agent.state.hp -= envDamage
      agent.state.resource -= envDamage * 0.5
    }
  }

  // 清理过期合作关系
  for (const rel of relMap.values()) {
    if (rel.validUntilRound < envRound.round) {
      rel.active = false
    }
  }

  // ═══════════════════════════════════════
  // Phase 8 — 边界裁剪
  // ═══════════════════════════════════════
  for (const agent of newAgents) {
    agent.state.resource = Math.max(0, agent.state.resource)
    agent.state.hp = Math.max(0, agent.state.hp)
    agent.state.beAcceptedCurrent = clamp(agent.state.beAcceptedCurrent, 0, 1)
  }

  return { agents: newAgents, coRelations: Array.from(relMap.values()) }
}

// ─────────────────────────────────────────────────
// applySurvivalRules — 仅处理死亡判定
//
// 入参: agents[]
// 出参: agents[]（alive 已更新）
// ─────────────────────────────────────────────────
export function applySurvivalRules(agents: Agent[]): Agent[] {
  return agents.map(a => {
    if (a.state.alive && a.state.hp <= 0) {
      return { ...a, state: { ...a.state, alive: false } }
    }
    return a
  })
}

// ─────────────────────────────────────────────────
// computeNextEnvRound
//
// 入参: envRound, envInit, agents[], coRelations[]
// 出参: EnvironmentRoundState（回合 +1，timeLeft -1，
//       更新 aliveAgent / currentSource / coRelations）
// ─────────────────────────────────────────────────
export function computeNextEnvRound(
  envRound: EnvironmentRoundState,
  envInit: EnvironmentInitState,
  agents: Agent[],
  coRelations: CoRelation[],
): EnvironmentRoundState {
  const aliveAgent = agents.filter(a => a.state.alive).map(a => a.id)
  return {
    ...envRound,
    round: envRound.round + 1,
    timeLeft: envRound.timeLeft - 1,
    aliveAgent,
    currentSource:
      envRound.currentSource +
      envInit.regenerationRate / 20 -
      agents.length * 0.5,
    coRelations,
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

// ─────────────────────────────────────────────────
// simulateRound — 整轮仿真入口
//
// 入参: context (RoundContext), decisionFn?
// 出参: SimulateRoundResult
// 流程: 决策 → 记录 → 八阶段结算 → 死亡判定 → 推进环境
// ─────────────────────────────────────────────────
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

  const { agents: afterActions, coRelations: nextCoRelations } =
    applyResolvedActions(agents, actions, envInit, envRound)

  const newAgents = applySurvivalRules(afterActions)
  const nextEnvRound = computeNextEnvRound(
    envRound,
    envInit,
    newAgents,
    nextCoRelations,
  )
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