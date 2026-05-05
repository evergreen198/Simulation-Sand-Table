import { Bar, BarChart, XAxis, YAxis } from 'recharts';
import { useStore } from '../../store/useStore';
import { useEffect, useState, type ComponentProps } from 'react';

const margin = {
  top: 20,
  right: 30,
  left: -20,
  bottom: 25,
};
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
      fill="#666"
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
      width={325}
      height={200}
      data={data}
      margin={margin}
      layout="vertical"  // 关键：设置为垂直布局，交换X/Y轴
    >
      <XAxis
        type="number"  // X轴现在显示数值
        label={{ position: 'insideBottom', value: '存活周期', offset: -5 }}
      />
      <YAxis
        type="category"  // Y轴现在显示分类名称
        dataKey="name"
        tickFormatter={formatAxisTick}
        label={{ position: 'insideTopLeft', value: 'YAxis title', angle: -90, dy: 60 }}
      />
      <Bar
        dataKey="aliveRond"
        fill="#8884d8"
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