import { CardTitle, Card, CardContent } from "./ui/card"
import LineChartExample from "./ChartComponents/ResourceChart"
import CustomizeLabels from "./ChartComponents/AliveChart"
import RelationHeatmap from "./ChartComponents/HeatmapChart"
import { useStore } from "../store/useStore"
import { useEffect, useState } from "react"
import type { Agent } from "../types/AgentType"

/** 内置四角色的展示标题；自定义成员直接使用用户输入的 id 作为标题 */
const ARCHETYPE_TITLE: Record<string, string> = {
  A: "贪婪掠夺者",
  B: "合作理想主义者",
  C: "保守生存者",
  D: "机会主义者",
}

type AgentCardState = {
  id: string
  resource: number
  hp: number
  alive: boolean
}

function DataShowSection() {
  const [agentsView, setAgentsView] = useState<AgentCardState[]>([])

  useEffect(() => {
    const mapAgents = (agents: Agent[]) =>
      agents.map(a => ({
        id: a.id,
        resource: a.state.resource,
        hp: a.state.hp,
        alive: a.state.alive,
      }))
    const apply = (agents: Agent[]) => {
      setAgentsView(agents.length > 0 ? mapAgents(agents) : [])
    }
    apply(useStore.getState().agents)
    return useStore.subscribe(s => s.agents, apply)
  }, [])

  return (
    <div className="p-2">
      <Card className="bg-gray-50 my-2">
        所有agent存活、淘汰周期
        <CustomizeLabels />
      </Card>
      <div className=" flex flex-wrap justify-between">
        {agentsView.map(agent => (
          <div key={agent.id} className="w-1/2 box-border my-1 odd:pr-2">
            <Card className="">
              <CardTitle>
                {ARCHETYPE_TITLE[agent.id] ?? agent.id}
              </CardTitle>
              <CardContent>
                <span>资源</span>
                {agent.resource}
                <span>血量</span>
                {agent.hp}
                <span>状态</span>
                {agent.alive ? "存活" : "死亡"}
                <div>行动</div>
              </CardContent>
            </Card>
          </div>
        ))}
      </div>
      <Card className=" my-2">
        各个agent每轮资源/hp状态-每轮行动曲线-环境资源变化曲线
        <LineChartExample />
      </Card>
      <Card className=" my-2 bg-blue-100 flex justify-center items-center">
        <RelationHeatmap />
      </Card>
      <Card className=" my-2">主持人模拟结论</Card>
    </div>
  )
}

export default DataShowSection
