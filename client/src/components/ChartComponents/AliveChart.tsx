import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { useStore } from '../../store/useStore';
import { useEffect, useState, type ComponentProps } from 'react';

const margin = {
  top: 12,
  right: 36,
  left: -8,
  bottom: 8,
}

const AXIS = { stroke: "#52525b", fontSize: 10, fill: "#a1a1aa" }
const BAR_FILL = "#818cf8"
// #endregion

const formatAxisTick = (value: number | string): string => `${value}`

const renderCustomBarLabel = (props: {
  x?: string | number
  y?: string | number
  width?: string | number
  height?: string | number
  value?: number
}) => {
  const x = Number(props.x ?? 0)
  const y = Number(props.y ?? 0)
  const width = Number(props.width ?? 0)
  const height = Number(props.height ?? 0)
  const { value } = props
  return (
    <text
      x={x + width + 6}
      y={y + height / 2}
      fill="#a1a1aa"
      textAnchor="start"
      dominantBaseline="middle"
    >{`${value ?? ""}`}</text>
  )
}

export default function CustomizeLabels() {

  const [data, setData] = useState<{ name: string; aliveRond: number }[]>([])
  useEffect(() => {
    const apply = (AliveData: { name: string; aliveRond: number }[]) => {
      setData(AliveData)
    }
    apply(useStore.getState().agentAliveRound)
    return useStore.subscribe(s => s.agentAliveRound, apply)
  }, [])

  
  return (
    <BarChart
      width={420}
      height={Math.max(120, data.length * 36)}
      data={data}
      margin={margin}
      layout="vertical"
    >
      <XAxis
        type="number"
        tick={AXIS}
        axisLine={{ stroke: "#3f3f46" }}
        tickLine={false}
      />
      <YAxis
        type="category"
        dataKey="name"
        tick={AXIS}
        axisLine={false}
        tickLine={false}
        tickFormatter={formatAxisTick}
        width={28}
      />
      <Bar
        dataKey="aliveRond"
        fill={BAR_FILL}
        radius={[0, 3, 3, 0]}
        label={
          renderCustomBarLabel as unknown as ComponentProps<
            typeof Bar
          >["label"]
        }
        barSize={12}  // 可选的：设置条形宽度
      />
      {/* <RechartsDevtools /> */}
    </BarChart>
  );
}