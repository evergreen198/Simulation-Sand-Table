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
  "#FFCDD2",
  "#FFF9C4",
  "#C8E6C9",
  "#BBDEFB",
  "#E1BEE7",
  "#B2DFDB",
  "#D1C4E9",
  "#FFCCBC",
]

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
      <CartesianGrid strokeDasharray="3 3" />
      <XAxis dataKey="round" />
      <YAxis width="auto" />
      <Tooltip />
      <Legend />
      <Line
        type="monotone"
        dataKey="Env"
        stroke="#8884d8"
        isAnimationActive={isAnimationActive}
      />
      {agentIds.map((id, i) => (
        <Line
          key={id}
          type="monotone"
          dataKey={id}
          name={id}
          stroke={LINE_COLORS[i % LINE_COLORS.length]}
          isAnimationActive={isAnimationActive}
        />
      ))}
    </LineChart>
  )
}

export default LineChartExample
