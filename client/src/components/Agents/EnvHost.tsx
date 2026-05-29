import { useMemo, useState, useEffect, useRef } from "react"
import { Globe2 } from "lucide-react"
import type { EnvironmentInitState } from "../../types/EnvironmentType"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import { cloneAgent, useStore } from "../../store/useStore"
import { agentA, agentB, agentC, agentD } from "../../types/AgentType"
import {
  ParamSlider,
  SettingPanel,
  SimControlButton,
  settingsSelectTriggerClass,
} from "../settings/settings-ui"
import { cn } from "../../lib/utils"

const ENV_SLIDERS: {
  key: keyof Pick<
    EnvironmentInitState,
    | "resourceTotal"
    | "regenerationRate"
    | "competitionReward"
    | "cooperationReward"
    | "betrayalBonus"
    | "riskLevel"
  >
  label: string
}[] = [
  { key: "resourceTotal", label: "总资源量" },
  { key: "regenerationRate", label: "资源再生速度" },
  { key: "competitionReward", label: "竞争收益" },
  { key: "cooperationReward", label: "合作收益" },
  { key: "betrayalBonus", label: "背叛收益" },
  { key: "riskLevel", label: "外部风险" },
]

function EnvHost() {
  const [resourceTotal, setResourceTotal] = useState(75)
  const [regenerationRate, setRegenerationRate] = useState(75)
  const [competitionReward, setCompetitionReward] = useState(75)
  const [cooperationReward, setCooperationReward] = useState(75)
  const [betrayalBonus, setBetrayalBonus] = useState(75)
  const [riskLevel, setRiskLevel] = useState(75)

  const [mode, setMode] = useState<EnvironmentInitState["mode"]>("year")
  const [round, setRound] = useState<EnvironmentInitState["round"]>(5)

  const customAgentEnabled = useStore(s => s.customAgentEnabled)
  const customAgent = useStore(s => s.customAgent)

  const setters: Record<string, (v: number) => void> = {
    resourceTotal: setResourceTotal,
    regenerationRate: setRegenerationRate,
    competitionReward: setCompetitionReward,
    cooperationReward: setCooperationReward,
    betrayalBonus: setBetrayalBonus,
    riskLevel: setRiskLevel,
  }

  const values: Record<string, number> = {
    resourceTotal,
    regenerationRate,
    competitionReward,
    cooperationReward,
    betrayalBonus,
    riskLevel,
  }

  const HostSetting: EnvironmentInitState = useMemo(
    () => ({
      resourceTotal,
      regenerationRate,
      competitionReward,
      cooperationReward,
      betrayalBonus,
      riskLevel,
      mode,
      round,
    }),
    [
      resourceTotal,
      regenerationRate,
      competitionReward,
      cooperationReward,
      betrayalBonus,
      riskLevel,
      mode,
      round,
    ],
  )

  const init = useStore(s => s.init)
  const tick = useStore(s => s.tick)
  const agents = useStore(s => s.agents)
  const envRound = useStore(s => s.envRound)
  const envInit = useStore(s => s.envInit)

  const initialAgents = useMemo(() => [agentA, agentB, agentC, agentD], [])
  const [running, setRunning] = useState(false)
  const tickInFlight = useRef(false)

  const buildAgentsForSim = () => {
    const base = initialAgents.map(cloneAgent)
    const hasCustom = customAgentEnabled && customAgent != null
    return hasCustom ? [...base, cloneAgent(customAgent)] : base
  }

  const handleReset = () => {
    setRunning(false)
    tickInFlight.current = false
    init(buildAgentsForSim(), HostSetting, round)
  }

  const canContinue =
    agents.length > 0 &&
    envRound.round < envInit.round &&
    envRound.timeLeft > 0 &&
    envRound.aliveAgent.length > 0

  const handlePauseContinue = () => {
    if (running) {
      setRunning(false)
      return
    }
    if (canContinue) setRunning(true)
  }

  useEffect(() => {
    if (!running) return

    const timer = setInterval(() => {
      if (tickInFlight.current) return
      tickInFlight.current = true
      void tick()
        .then(() => {
          const { envRound, envInit } = useStore.getState()
          if (
            envRound.round >= envInit.round ||
            envRound.timeLeft <= 0 ||
            envRound.aliveAgent.length === 0
          ) {
            setRunning(false)
          }
        })
        .finally(() => {
          tickInFlight.current = false
        })
    }, 2000)

    return () => clearInterval(timer)
  }, [running, tick])

  const modeLabel =
    mode === "year" ? "年" : mode === "month" ? "月" : "日"

  return (
    <SettingPanel
      title="环境设置"
      description="资源、收益与风险参数；控制仿真运行"
      icon={Globe2}
    >
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span
          className={cn(
            "rounded-full border px-2 py-0.5 text-[10px] font-medium",
            running
              ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
              : "border-zinc-600/40 bg-zinc-800/40 text-zinc-500",
          )}
        >
          {running ? "运行中" : agents.length > 0 ? "已暂停" : "未开始"}
        </span>
        {agents.length > 0 ? (
          <span className="font-mono text-[10px] text-zinc-500">
            R{envRound.round}/{envInit.round ?? round} · {modeLabel}
          </span>
        ) : null}
      </div>

      <div className="mb-4 grid grid-cols-2 gap-2">
        <div className="space-y-1.5">
          <span className="text-[10px] text-zinc-500">时间模式</span>
          <Select
            value={mode}
            onValueChange={v =>
              v === "year" || v === "month" || v === "day" ? setMode(v) : null
            }
          >
            <SelectTrigger className={settingsSelectTriggerClass}>
              <SelectValue placeholder="选择模式" />
            </SelectTrigger>
            <SelectContent className="border-white/[0.08] bg-zinc-900">
              <SelectGroup>
                <SelectLabel>模式</SelectLabel>
                <SelectItem value="year">年</SelectItem>
                <SelectItem value="month">月</SelectItem>
                <SelectItem value="day">日</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
        <div className="space-y-1.5">
          <span className="text-[10px] text-zinc-500">仿真轮次</span>
          <Select
            value={String(round)}
            onValueChange={v => setRound(Number(v))}
          >
            <SelectTrigger className={settingsSelectTriggerClass}>
              <SelectValue placeholder="选择轮次" />
            </SelectTrigger>
            <SelectContent className="border-white/[0.08] bg-zinc-900">
              <SelectGroup>
                <SelectLabel>轮次</SelectLabel>
                <SelectItem value="3">3</SelectItem>
                <SelectItem value="4">4</SelectItem>
                <SelectItem value="5">5</SelectItem>
                <SelectItem value="6">6</SelectItem>
                <SelectItem value="10">10</SelectItem>
              </SelectGroup>
            </SelectContent>
          </Select>
        </div>
      </div>

      <div className="space-y-3 border-t border-white/[0.06] pt-4">
        {ENV_SLIDERS.map(({ key, label }) => (
          <ParamSlider
            key={key}
            label={label}
            value={values[key]}
            onValueChange={setters[key]}
          />
        ))}
      </div>

      <div className="mt-5 flex flex-wrap gap-2 border-t border-white/[0.06] pt-4">
        <SimControlButton
          label="开始"
          variant="primary"
          onClick={() => {
            init(buildAgentsForSim(), HostSetting, round)
            setRunning(true)
          }}
        />
        <SimControlButton
          label={running ? "暂停" : "继续"}
          disabled={agents.length === 0 || (!running && !canContinue)}
          onClick={handlePauseContinue}
        />
        <SimControlButton
          label="结束"
          variant="danger"
          disabled={agents.length === 0}
          onClick={() => setRunning(false)}
        />
        <SimControlButton
          label="重置"
          variant="ghost"
          onClick={handleReset}
        />
      </div>
    </SettingPanel>
  )
}

export default EnvHost
