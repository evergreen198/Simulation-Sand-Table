import { useMemo, useEffect, useState } from "react"
import { useStore } from "../../store/useStore"
import type { AgentRelationSnapshot } from "../../../../shared/types/EnvironmentType"
import {
  stageToHeatColor,
  valueToRelationStage,
} from "../../../../shared/relation/relationMatrix"

const EMPTY_RELATIONS: AgentRelationSnapshot = {
  memberIds: [],
  matrix: [],
}

export default function Heatmap() {
  const [relations, setRelations] = useState<AgentRelationSnapshot>(EMPTY_RELATIONS)

  useEffect(() => {
    const apply = (snapshot: AgentRelationSnapshot) => setRelations(snapshot)
    apply(useStore.getState().envRound.agentRelations)
    return useStore.subscribe(
      s => s.envRound.agentRelations,
      apply,
    )
  }, [])

  const members = relations.memberIds
  const size = Math.min(360, Math.max(200, 56 * (members.length + 1)))
  const cell = members.length > 0 ? size / (members.length + 1) : size

  const cells = useMemo(() => {
    const result: {
      x: number
      y: number
      value: number
      rowId: string
      colId: string
    }[] = []
    members.forEach((rowId, i) => {
      members.forEach((colId, j) => {
        if (i === j) return
        const value = relations.matrix[i]?.[j] ?? 0
        result.push({ x: j + 1, y: i + 1, value, rowId, colId })
      })
    })
    return result
  }, [members, relations.matrix])

  if (members.length === 0) {
    return (
      <p className="py-8 text-center text-[11px] text-zinc-600">
        启动仿真后显示 agent 关系热力图
      </p>
    )
  }

  return (
    <div>
      <svg width={size} height={size} className="mx-auto block">
        {members.map((m, i) => (
          <text
            key={`col-${m}`}
            x={(i + 1) * cell + cell / 2}
            y={cell / 2}
            textAnchor="middle"
            fontSize={11}
            fill="#a1a1aa"
          >
            {m}
          </text>
        ))}

        {members.map((m, i) => (
          <text
            key={`row-${m}`}
            x={cell / 2}
            y={(i + 1) * cell + cell / 2}
            textAnchor="middle"
            fontSize={11}
            fill="#a1a1aa"
          >
            {m}
          </text>
        ))}

        {cells.map((d, idx) => {
          const stage = valueToRelationStage(d.value)
          return (
            <rect
              key={idx}
              x={d.x * cell}
              y={d.y * cell}
              width={cell}
              height={cell}
              fill={stageToHeatColor(stage)}
              stroke="#27272a"
              rx={2}
            >
              <title>
                {d.rowId} ↔ {d.colId}：{d.value}
              </title>
            </rect>
          )
        })}
      </svg>
    </div>
  )
}
