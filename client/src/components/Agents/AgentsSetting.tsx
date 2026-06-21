import { useState } from "react"
import { Bot, UserPlus } from "lucide-react"
import { Input } from "../ui/input"
import { Button } from "../ui/button"
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectTrigger,
  SelectValue,
} from "../ui/select"
import { Checkbox } from "../ui/checkbox"
import type { Agent } from "../../../../shared/types/AgentType"
import { Label } from "../ui/label"
import { useStore } from "../../store/useStore"
import {
  ParamSlider,
  SettingPanel,
  settingsInputClass,
  settingsSelectTriggerClass,
} from "../settings/settings-ui"
import { cn } from "../../lib/utils"

const BUILTIN_IDS = new Set(["A", "B", "C", "D"])

const BUILTIN_AGENTS = [
  {
    id: "A",
    title: "贪婪掠夺者",
    description: "优先攻击资源多的目标",
    accent: "border-l-rose-500/70",
    dot: "bg-rose-400",
  },
  {
    id: "B",
    title: "合作理想主义者",
    description: "强烈倾向合作，很少攻击",
    accent: "border-l-sky-500/70",
    dot: "bg-sky-400",
  },
  {
    id: "C",
    title: "保守生存者",
    description: "行为稳定，很少主动攻击",
    accent: "border-l-emerald-500/70",
    dot: "bg-emerald-400",
  },
  {
    id: "D",
    title: "机会主义者",
    description: "看到弱者才攻击，会短暂合作",
    accent: "border-l-amber-500/70",
    dot: "bg-amber-400",
  },
] as const

function AgentsSetting() {
  const [risk, setRisk] = useState(50)
  const [greed, setGreed] = useState(50)
  const [social, setSocial] = useState(50)
  const [aggression, setAggression] = useState(50)
  type AgentGoal = Agent["goal"]
  const [goal, setGoal] = useState<AgentGoal>("survive")
  const [userName, setUserName] = useState("")
  const [characterDescription, setCharacterDescription] = useState("")

  const customAgentEnabled = useStore(s => s.customAgentEnabled)
  const setCustomAgentEnabled = useStore(s => s.setCustomAgentEnabled)
  const setCustomAgent = useStore(s => s.setCustomAgent)
  const setCustonOllama = useStore(s => s.setCustonOllama)

  const onGoalChange = (value: string) => {
    if (value === "survive" || value === "maximize_resource") {
      setGoal(value)
    }
  }

  const SetUserAgent = () => {
    const id = userName.trim()
    if (!id) {
      window.alert("请填写自定义成员名称")
      return
    }
    if (BUILTIN_IDS.has(id)) {
      window.alert("名称与内置角色 A/B/C/D 冲突，请换一个")
      return
    }

    const socialNorm = social / 100
    const agent: Agent = {
      id,
      traits: {
        risk: risk / 100,
        greed: greed / 100,
        social: socialNorm,
        aggression: aggression / 100,
        beAcceptedBase: socialNorm,
      },
      goal,
      state: {
        resource: 0,
        hp: 10,
        alive: true,
        beAcceptedCurrent: socialNorm,
      },
    }
    setCustomAgent(agent)
    setCustonOllama(id, {
      model: "qwen2.5:3b",
      temperature: 0.1,
      systemPrompt:
        `你是 agent ${id}，性格描述为${characterDescription}。\n` +
        `你的性格参数：risk=${risk / 100}，greed=${greed / 100}，social=${socialNorm}，aggression=${aggression / 100}。\n` +
        `你的目标：${goal}\n` +
        `你必须返回一行纯 JSON，不要任何解释文字。`,
    })
  }

  return (
    <>
      <SettingPanel
        title="内置角色"
        description="仿真默认参与的四种 archetype"
        icon={Bot}
      >
        <ul className="space-y-2">
          {BUILTIN_AGENTS.map(agent => (
            <li
              key={agent.id}
              className={cn(
                "rounded-lg border border-white/[0.06] border-l-2 bg-black/20 px-3 py-2.5",
                agent.accent,
              )}
            >
              <div className="flex items-center gap-2">
                <span
                  className={cn("size-1.5 shrink-0 rounded-full", agent.dot)}
                />
                <span className="font-mono text-[10px] text-zinc-600">
                  {agent.id}
                </span>
                <span className="text-[12px] font-medium text-zinc-200">
                  {agent.title}
                </span>
              </div>
              <p className="mt-1 pl-3.5 text-[11px] leading-relaxed text-zinc-500">
                {agent.description}
              </p>
            </li>
          ))}
        </ul>
      </SettingPanel>

      <SettingPanel
        title="自定义成员"
        description="启用后参与仿真，由 Ollama 驱动决策"
        icon={UserPlus}
      >
        <div className="mb-4 flex items-center gap-2.5 rounded-lg border border-white/[0.06] bg-white/[0.02] px-3 py-2.5">
          <Checkbox
            id="isUserExist"
            checked={customAgentEnabled}
            onCheckedChange={v => setCustomAgentEnabled(v === true)}
            className="border-white/20 data-[state=checked]:border-indigo-500 data-[state=checked]:bg-indigo-500"
          />
          <Label
            htmlFor="isUserExist"
            className="cursor-pointer text-[12px] text-zinc-300"
          >
            启用自定义成员
          </Label>
        </div>

        <div
          className={cn(
            "space-y-3",
            !customAgentEnabled && "pointer-events-none opacity-45",
          )}
        >
          <div className="space-y-1.5">
            <Label
              htmlFor="user_agent_name"
              className="text-[10px] text-zinc-500"
            >
              名称（仿真 id）
            </Label>
            <Input
              id="user_agent_name"
              className={settingsInputClass}
              placeholder="例如：探索者"
              value={userName}
              onChange={e => setUserName(e.target.value)}
              disabled={!customAgentEnabled}
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="user_agent_character_description"
              className="text-[10px] text-zinc-500"
            >
              性格描述
            </Label>
            <Input
              id="user_agent_character_description"
              className={settingsInputClass}
              placeholder="简要描述行为倾向…"
              value={characterDescription}
              onChange={e => setCharacterDescription(e.target.value)}
              disabled={!customAgentEnabled}
            />
          </div>

          <div className="space-y-1.5">
            <span className="text-[10px] text-zinc-500">目标</span>
            <Select value={goal} onValueChange={onGoalChange}>
              <SelectTrigger
                className={settingsSelectTriggerClass}
                disabled={!customAgentEnabled}
              >
                <SelectValue placeholder="选择目标" />
              </SelectTrigger>
              <SelectContent className="border-white/[0.08] bg-zinc-900">
                <SelectGroup>
                  <SelectLabel>目标</SelectLabel>
                  <SelectItem value="maximize_resource">资源最大化</SelectItem>
                  <SelectItem value="survive">生存优先</SelectItem>
                </SelectGroup>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-3 border-t border-white/[0.06] pt-3">
            <ParamSlider
              label="冒险程度"
              value={risk}
              onValueChange={setRisk}
              disabled={!customAgentEnabled}
            />
            <ParamSlider
              label="贪心程度"
              value={greed}
              onValueChange={setGreed}
              disabled={!customAgentEnabled}
            />
            <ParamSlider
              label="社交指数"
              value={social}
              onValueChange={setSocial}
              disabled={!customAgentEnabled}
            />
            <ParamSlider
              label="侵略性"
              value={aggression}
              onValueChange={setAggression}
              disabled={!customAgentEnabled}
            />
          </div>

          <Button
            className="mt-1 w-full border border-indigo-500/40 bg-indigo-500/15 text-indigo-100 hover:bg-indigo-500/25"
            onClick={SetUserAgent}
            disabled={!customAgentEnabled}
          >
            确认自定义成员
          </Button>
        </div>
      </SettingPanel>
    </>
  )
}

export default AgentsSetting
