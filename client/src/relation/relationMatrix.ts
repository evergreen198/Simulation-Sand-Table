import type { AgentMemory } from "../memoryManagement/memoTypes"
import type { AgentRelationSnapshot, CoRelation } from "../types/EnvironmentType"

const RELATION_MIN = -100
const RELATION_MAX = 100

const WEIGHT_COOPERATE = 12
const WEIGHT_ATTACK = -10
const WEIGHT_BETRAY = -22
const WEIGHT_ACTIVE_CO_RELATION = 8

/** 7 档热力图配色：红 → 半红 → 浅红 → 灰 → 浅绿 → 半绿 → 绿 */
const STAGE_COLORS = [
  "#dc2626",
  "#ef4444",
  "#fca5a5",
  "#71717a",
  "#86efac",
  "#22c55e",
  "#16a34a",
] as const

function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v))
}

/** 无序对 key，与 coRelationKey 一致 */
function pairKey(a: string, b: string): string {
  return a < b ? `${a}-${b}` : `${b}-${a}`
}

/**
 * 初始化空关系快照
 * @param memberIds 参与仿真的 agent id 列表
 */
export function createEmptyRelationSnapshot(
  memberIds: string[],
): AgentRelationSnapshot {
  const n = memberIds.length
  const matrix = Array.from({ length: n }, (_, i) =>
    Array.from({ length: n }, (_, j) => (i === j ? 0 : 0)),
  )
  return { memberIds: [...memberIds], matrix }
}

/**
 * 从社交记忆与合作状态全量重算对称关系矩阵
 * @param memberIds 当前仿真成员（含自定义 agent）
 * @param agentsMemory useAgentMemo 中的记忆
 * @param coRelations 当前活跃合作关系
 */
export function computeRelationSnapshot(
  memberIds: string[],
  agentsMemory: AgentMemory[],
  coRelations: CoRelation[],
): AgentRelationSnapshot {
  const snapshot = createEmptyRelationSnapshot(memberIds)
  if (memberIds.length === 0) return snapshot

  const idToIndex = new Map(memberIds.map((id, i) => [id, i]))
  const pairScores = new Map<string, number>()

  const addPairScore = (a: string, b: string, delta: number) => {
    if (a === b) return
    if (!idToIndex.has(a) || !idToIndex.has(b)) return
    const key = pairKey(a, b)
    pairScores.set(key, (pairScores.get(key) ?? 0) + delta)
  }

  for (const mem of agentsMemory) {
    const self = mem.agentId
    for (const entry of mem.socialMemory.cooperate_to) {
      addPairScore(self, entry.agentId, WEIGHT_COOPERATE)
    }
    for (const entry of mem.socialMemory.cooperate_by) {
      addPairScore(self, entry.agentId, WEIGHT_COOPERATE)
    }
    for (const entry of mem.socialMemory.attack_to) {
      addPairScore(self, entry.agentId, WEIGHT_ATTACK)
    }
    for (const entry of mem.socialMemory.attack_by) {
      addPairScore(self, entry.agentId, WEIGHT_ATTACK)
    }
    for (const entry of mem.socialMemory.betray_to) {
      addPairScore(self, entry.agentId, WEIGHT_BETRAY)
    }
    for (const entry of mem.socialMemory.betray_by) {
      addPairScore(self, entry.agentId, WEIGHT_BETRAY)
    }
  }

  for (const rel of coRelations) {
    if (!rel.active) continue
    addPairScore(rel.agentA, rel.agentB, WEIGHT_ACTIVE_CO_RELATION)
  }

  for (let i = 0; i < memberIds.length; i++) {
    for (let j = i + 1; j < memberIds.length; j++) {
      const raw = pairScores.get(pairKey(memberIds[i]!, memberIds[j]!))
      if (raw === undefined) continue
      const value = clamp(raw, RELATION_MIN, RELATION_MAX)
      snapshot.matrix[i]![j] = value
      snapshot.matrix[j]![i] = value
    }
  }

  return snapshot
}

/**
 * 关系值映射到 7 档（0=强敌对 … 6=强友好）
 * @param value -100 ~ 100
 */
export function valueToRelationStage(value: number): number {
  const v = clamp(value, RELATION_MIN, RELATION_MAX)
  if (v <= -60) return 0
  if (v <= -30) return 1
  if (v <= -5) return 2
  if (v < 5) return 3
  if (v < 30) return 4
  if (v < 60) return 5
  return 6
}

/** 7 档对应填充色 */
export function stageToHeatColor(stage: number): string {
  return STAGE_COLORS[clamp(stage, 0, 6)] ?? STAGE_COLORS[3]
}
