import { useEffect, useMemo, useState, type ComponentType, type ReactNode } from "react"
import {
  Activity,
  BarChart3,
  Grid3x3,
  Sparkles,
  Users,
} from "lucide-react"
import LineChartExample from "./ChartComponents/ResourceChart"
import CustomizeLabels from "./ChartComponents/AliveChart"
import RelationHeatmap from "./ChartComponents/HeatmapChart"
import { useStore } from "../store/useStore"
import type { Agent } from "../types/AgentType"
import type { Action } from "../types/Action"
import type { AgentAction } from "../store/simulation"
import { cn } from "../lib/utils"

/** 内置四角色的展示标题；自定义成员直接使用用户输入的 id 作为标题 */
const ARCHETYPE_TITLE: Record<string, string> = {
  A: "贪婪掠夺者",
  B: "合作理想主义者",
  C: "保守生存者",
  D: "机会主义者",
}

const AGENT_ACCENT: Record<string, string> = {
  A: "from-rose-500/80 to-orange-500/60",
  B: "from-sky-500/80 to-cyan-400/60",
  C: "from-emerald-500/80 to-teal-400/60",
  D: "from-violet-500/80 to-fuchsia-400/60",
}

const HP_MAX = 10

type AgentCardState = {
  id: string
  resource: number
  hp: number
  alive: boolean
}

function formatAction(action: Action | null): string {
  if (!action) return "—"
  switch (action.type) {
    case "gather":
      return "采集"
    case "attack":
      return `攻击 · ${action.target}`
    case "cooperate":
      return `合作 · ${action.target}`
    case "defend":
      return "防御"
    case "wait":
      return "等待"
    case "dead":
      return "阵亡"
    default:
      return "—"
  }
}

function latestActionByAgent(
  agentActions: AgentAction[],
  id: string,
): Action | null {
  const row = agentActions.find(a => a.id === id)
  if (!row?.actions.length) return null
  return row.actions[row.actions.length - 1].action
}

function Panel({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string
  description?: string
  icon: ComponentType<{ className?: string }>
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]",
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
          <Icon className="size-3.5 text-zinc-400" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-medium tracking-tight text-zinc-100">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="p-3">{children}</div>
    </section>
  )
}

function MetricBar({
  label,
  value,
  max,
  accentClass,
}: {
  label: string
  value: number
  max: number
  accentClass: string
}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-zinc-500">{label}</span>
        <span className="tabular-nums text-zinc-300">
          {value}
          <span className="text-zinc-600"> / {max}</span>
        </span>
      </div>
      <div className="h-1 overflow-hidden rounded-full bg-white/[0.06]">
        <div
          className={cn("h-full rounded-full bg-gradient-to-r", accentClass)}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

function AgentStatCard({
  agent,
  actionLabel,
}: {
  agent: AgentCardState
  actionLabel: string
}) {
  const title = ARCHETYPE_TITLE[agent.id] ?? agent.id
  const accent =
    AGENT_ACCENT[agent.id] ?? "from-indigo-500/80 to-blue-400/60"

  return (
    <article
      className={cn(
        "rounded-lg border border-white/[0.06] bg-black/20 p-3 transition-colors",
        !agent.alive && "opacity-55",
      )}
    >
      <div className="mb-2.5 flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-medium text-zinc-200">
            {title}
          </p>
          <p className="mt-0.5 font-mono text-[10px] text-zinc-600">
            {agent.id}
          </p>
        </div>
        <span
          className={cn(
            "shrink-0 rounded-full border px-1.5 py-0.5 text-[9px] font-medium uppercase tracking-wider",
            agent.alive
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-zinc-600/40 bg-zinc-800/50 text-zinc-500",
          )}
        >
          {agent.alive ? "存活" : "淘汰"}
        </span>
      </div>

      <div className="space-y-2">
        <MetricBar
          label="血量"
          value={agent.hp}
          max={HP_MAX}
          accentClass={accent}
        />
        <div className="flex items-center justify-between text-[10px]">
          <span className="text-zinc-500">资源</span>
          <span className="tabular-nums font-medium text-zinc-200">
            {agent.resource}
          </span>
        </div>
      </div>

      <div className="mt-2.5 border-t border-white/[0.05] pt-2">
        <p className="mb-1 text-[9px] uppercase tracking-widest text-zinc-600">
          上轮行动
        </p>
        <p className="truncate text-[11px] text-zinc-400">{actionLabel}</p>
      </div>
    </article>
  )
}

function DataShowSection() {
  const [agentsView, setAgentsView] = useState<AgentCardState[]>([])
  const [agentActions, setAgentActions] = useState<AgentAction[]>([])
  const [round, setRound] = useState(0)
  const [totalRound, setTotalRound] = useState(0)

  useEffect(() => {
    const mapAgents = (agents: Agent[]) =>
      agents.map(a => ({
        id: a.id,
        resource: a.state.resource,
        hp: a.state.hp,
        alive: a.state.alive,
      }))
    const applyAgents = (agents: Agent[]) => {
      setAgentsView(agents.length > 0 ? mapAgents(agents) : [])
    }
    const s = useStore.getState()
    applyAgents(s.agents)
    setAgentActions(s.agentActions)
    setRound(s.envRound.round)
    setTotalRound(s.totalRound)

    const unsubAgents = useStore.subscribe(st => st.agents, applyAgents)
    const unsubActions = useStore.subscribe(
      st => st.agentActions,
      setAgentActions,
    )
    const unsubRound = useStore.subscribe(st => st.envRound.round, setRound)
    const unsubTotal = useStore.subscribe(st => st.totalRound, setTotalRound)
    return () => {
      unsubAgents()
      unsubActions()
      unsubRound()
      unsubTotal()
    }
  }, [])

  const actionMap = useMemo(() => {
    const m = new Map<string, string>()
    for (const a of agentsView) {
      m.set(a.id, formatAction(latestActionByAgent(agentActions, a.id)))
    }
    return m
  }, [agentsView, agentActions])

  const aliveCount = agentsView.filter(a => a.alive).length

  return (
    <div className="data-show min-h-full bg-[#09090b] text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#09090b]/85 px-5 py-4 backdrop-blur-xl">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
              Simulation
            </p>
            <h1 className="mt-1 text-base font-semibold tracking-tight text-zinc-50">
              数据面板
            </h1>
          </div>
          <div className="flex flex-col items-end gap-1">
            <span className="rounded-md border border-white/[0.08] bg-white/[0.03] px-2 py-1 font-mono text-[11px] text-zinc-300">
              R{round}
              {totalRound > 0 ? (
                <span className="text-zinc-600"> / {totalRound}</span>
              ) : null}
            </span>
            <span className="text-[10px] text-zinc-500">
              {aliveCount} / {agentsView.length} 存活
            </span>
          </div>
        </div>
      </header>

      <div className="space-y-3 p-4 pb-8">
        <Panel
          title="存活周期"
          description="各 Agent 累计存活轮数"
          icon={BarChart3}
        >
          <div className="overflow-x-auto -mx-1 px-1">
            <CustomizeLabels />
          </div>
        </Panel>

        {agentsView.length > 0 ? (
          <Panel
            title="Agent 状态"
            description="资源、血量与最近决策"
            icon={Users}
          >
            <div className="grid grid-cols-2 gap-2">
              {agentsView.map(agent => (
                <AgentStatCard
                  key={agent.id}
                  agent={agent}
                  actionLabel={actionMap.get(agent.id) ?? "—"}
                />
              ))}
            </div>
          </Panel>
        ) : (
          <Panel title="Agent 状态" icon={Users}>
            <p className="py-6 text-center text-[12px] text-zinc-600">
              启动仿真后显示 Agent 指标
            </p>
          </Panel>
        )}

        <Panel
          title="资源曲线"
          description="环境资源与各 Agent 资源随轮次变化"
          icon={Activity}
        >
          <div className="w-full overflow-x-auto">
            <LineChartExample />
          </div>
        </Panel>

        <Panel
          title="关系热力图"
          description="Agent 间互动强度（示意）"
          icon={Grid3x3}
          className="flex flex-col items-center"
        >
          <RelationHeatmap />
        </Panel>

        <Panel
          title="模拟结论"
          description="主持人对本轮局势的解读"
          icon={Sparkles}
        >
          <div className="rounded-lg border border-dashed border-white/[0.08] bg-gradient-to-b from-white/[0.02] to-transparent px-4 py-8 text-center">
            <Sparkles
              className="mx-auto mb-2 size-4 text-zinc-600"
              strokeWidth={1.5}
            />
            <p className="text-[12px] text-zinc-500">
              结论模块待接入
            </p>
            <p className="mt-1 text-[10px] text-zinc-600">
              仿真结束后将在此展示摘要与分析
            </p>
          </div>
        </Panel>
      </div>
    </div>
  )
}

export default DataShowSection
