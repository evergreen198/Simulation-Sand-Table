import { Card, CardTitle, CardDescription } from "../ui/card"
import { Slider } from "../ui/slider"
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
import type { Agent } from "../../types/AgentType"
import { useState } from "react"
import { Label } from "../ui/label"
import { useStore } from "../../store/useStore"

const BUILTIN_IDS = new Set(["A", "B", "C", "D"])

function AgentsSetting() {
  const [risk, setRisk] = useState(50)
  const [greed, setGreed] = useState(50)
  const [social, setSocial] = useState(50)
  const [aggression, setAggression] = useState(50)
  type AgentGoal = Agent["goal"]
  const [goal, setGoal] = useState<AgentGoal>("survive")
  const [userName, setUserName] = useState("")

  const customAgentEnabled = useStore(s => s.customAgentEnabled)
  const setCustomAgentEnabled = useStore(s => s.setCustomAgentEnabled)
  const setCustomAgent = useStore(s => s.setCustomAgent)

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
  }

  return (
    <div className="px-2">
      <Card className="my-2 p-2 bg-pink-100">
        <CardTitle>贪婪掠夺者</CardTitle>
        <CardDescription>优先攻击资源多的目标</CardDescription>
      </Card>
      <Card className="my-2 p-2 bg-sky-50">
        <CardTitle>合作理想主义者</CardTitle>
        <CardDescription>强烈倾向合作,很少攻击</CardDescription>
      </Card>
      <Card className="my-2 p-2 bg-green-50">
        <CardTitle>保守生存者</CardTitle>
        <CardDescription>行为稳定,很少主动攻击</CardDescription>
      </Card>
      <Card className="my-2 p-2 bg-yellow-50">
        <CardTitle>机会主义者</CardTitle>
        <CardDescription>看到弱者才攻击,会短暂合作</CardDescription>
      </Card>

      <Card className="my-2 px-2 pt-5">
        <div className="flex gap-2 items-center">
          <Checkbox
            id="isUserExist"
            checked={customAgentEnabled}
            onCheckedChange={v => setCustomAgentEnabled(v === true)}
          />
          <Label htmlFor="isUserExist">启用自定义成员</Label>
        </div>
        <Input
          className="my-2"
          placeholder="自定义名称（将作为仿真中的 id）"
          value={userName}
          onChange={e => setUserName(e.target.value)}
          disabled={!customAgentEnabled}
        />
        <Select value={goal} onValueChange={onGoalChange}>
          <SelectTrigger className="w-full max-w-48">
            <SelectValue placeholder="选择目标" />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              <SelectLabel>目标</SelectLabel>
              <SelectItem value="maximize_resource">资源</SelectItem>
              <SelectItem value="survive">生存</SelectItem>
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className="text-sm text-muted-foreground ">冒险程度</div>
        <Slider
          value={[risk]}
          onValueChange={v => setRisk(v[0] ?? risk)}
          min={0}
          max={100}
          step={1}
          disabled={!customAgentEnabled}
        />
        <div className="text-sm text-muted-foreground  ">贪心程度</div>
        <Slider
          value={[greed]}
          onValueChange={v => setGreed(v[0] ?? greed)}
          min={0}
          max={100}
          step={1}
          disabled={!customAgentEnabled}
        />
        <div className="text-sm text-muted-foreground  ">社交指数</div>
        <Slider
          value={[social]}
          onValueChange={v => setSocial(v[0] ?? social)}
          min={0}
          max={100}
          step={1}
          disabled={!customAgentEnabled}
        />
        <div className="text-sm text-muted-foreground ">侵略性</div>
        <Slider
          value={[aggression]}
          onValueChange={v => setAggression(v[0] ?? aggression)}
          min={0}
          max={100}
          step={1}
          disabled={!customAgentEnabled}
        />
        <Button
          className=""
          onClick={SetUserAgent}
          disabled={!customAgentEnabled}
        >
          确认自定义成员
        </Button>
      </Card>
    </div>
  )
}

export default AgentsSetting
