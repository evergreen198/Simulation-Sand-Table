import { useMemo, useEffect, useState } from "react"
import { useStore } from "../../store/useStore"
import type { Agent } from "../../types/AgentType"

function getColor(value: number) {
  const t = value / 100
  const r = Math.round(99 + (129 - 99) * t)
  const g = Math.round(102 + (140 - 102) * t)
  const b = Math.round(241 + (248 - 241) * t)
  const a = 0.15 + t * 0.75
  return `rgba(${r},${g},${b},${a})`
}

export default function Heatmap() {
  const [members, setMembers] = useState<string[]>(["A", "B", "C", "D"])

  useEffect(() => {
    const apply = (agents: Agent[]) => {
      const ids = agents.map(a => a.id).filter(Boolean)
      setMembers(ids.length > 0 ? ids : ["A", "B", "C", "D"])
    }
    apply(useStore.getState().agents)
    return useStore.subscribe(s => s.agents, apply)
  }, [])

  const size = 300
  const cell = size / (members.length + 1)

  const data = useMemo(() => {
    const result: { x: number; y: number; value: number }[] = []
    members.forEach((_, i) => {
      members.forEach((_, j) => {
        if (i === j) return
        result.push({
          x: i + 1,
          y: j + 1,
          value: Math.random() * 100,
        })
      })
    })
    return result
  }, [members])

  return (
    <div>
      <svg width={size} height={size}>
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

        {data.map((d, idx) => (
          <rect
            key={idx}
            x={d.x * cell}
            y={d.y * cell}
            width={cell}
            height={cell}
            fill={getColor(d.value)}
            stroke="#27272a"
            rx={2}
          />
        ))}
      </svg>
    </div>
  )
}
