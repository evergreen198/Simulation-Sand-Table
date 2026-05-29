import {
  LineChart,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  Line,
} from "recharts"
import { useStore, type SourceLineData } from "../../store/useStore"
import { useEffect, useMemo, useState } from "react"

const LINE_COLORS = [
  "#f472b6",
  "#38bdf8",
  "#34d399",
  "#a78bfa",
  "#fbbf24",
  "#2dd4bf",
  "#fb923c",
  "#e879f9",
]

const CHART_THEME = {
  grid: "#27272a",
  axis: "#71717a",
  env: "#818cf8",
}

function flattenRows(rows: SourceLineData[]) {
  return rows.map(row => ({
    round: row.round,
    Env: row.Env,
    ...row.agentResources,
  }))
}

function LineChartExample({ isAnimationActive = true }) {
  const [flatData, setFlatData] = useState<
    Record<string, string | number>[]
  >([])
  const [agentIds, setAgentIds] = useState<string[]>([])

  const sync = useMemo(
    () => (rows: SourceLineData[]) => {
      setFlatData(flattenRows(rows))
      const first = rows[0]
      setAgentIds(first ? Object.keys(first.agentResources) : [])
    },
    [],
  )

  useEffect(() => {
    sync(useStore.getState().sourceLineData)
    return useStore.subscribe(s => s.sourceLineData, sync)
  }, [sync])

  return (
    <LineChart
      style={{
        width: "100%",
        maxWidth: "700px",
        maxHeight: "70vh",
        aspectRatio: 1.618,
      }}
      responsive
      data={flatData}
      margin={{
        top: 5,
        right: 30,
        left: 20,
        bottom: 5,
      }}
    >
      <CartesianGrid stroke={CHART_THEME.grid} strokeDasharray="3 3" />
      <XAxis
        dataKey="round"
        tick={{ fill: CHART_THEME.axis, fontSize: 10 }}
        axisLine={{ stroke: "#3f3f46" }}
        tickLine={false}
      />
      <YAxis
        width="auto"
        tick={{ fill: CHART_THEME.axis, fontSize: 10 }}
        axisLine={{ stroke: "#3f3f46" }}
        tickLine={false}
      />
      <Tooltip
        contentStyle={{
          background: "#18181b",
          border: "1px solid rgba(255,255,255,0.08)",
          borderRadius: 8,
          fontSize: 11,
          color: "#e4e4e7",
        }}
        labelStyle={{ color: "#a1a1aa" }}
      />
      <Legend
        wrapperStyle={{ fontSize: 10, color: "#a1a1aa", paddingTop: 8 }}
      />
      <Line
        type="monotone"
        dataKey="Env"
        stroke={CHART_THEME.env}
        strokeWidth={2}
        dot={false}
        isAnimationActive={isAnimationActive}
      />
      {agentIds.map((id, i) => (
        <Line
          key={id}
          type="monotone"
          dataKey={id}
          name={id}
          stroke={LINE_COLORS[i % LINE_COLORS.length]}
          strokeWidth={1.5}
          dot={false}
          isAnimationActive={isAnimationActive}
        />
      ))}
    </LineChart>
  )
}

export default LineChartExample
