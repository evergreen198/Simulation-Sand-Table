import { useMemo, useState, useEffect } from 'react'
import type {
    EnvironmentInitState,
    // EnvironmentRoundState
} from '../../types/EnvironmentType'
import { Button } from "../ui/button"
import { CardTitle, Card, CardFooter } from "../ui/card"
import { Slider } from "../ui/slider"
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "../ui/select"
import { cloneAgent, useStore } from '../../store/useStore'
import { agentA, agentB, agentC, agentD } from '../../types/AgentType'

function EnvHost() {
    // 所有环境参数：使用 useState 分别管理，确保 Slider/Select 都能拿到最新值
    const [resourceTotal, setResourceTotal] = useState(75) // 总资源量（稀缺or丰富）
    const [regenerationRate, setRegenerationRate] = useState(75) // 资源再生速度
    const [competitionReward, setCompetitionReward] = useState(75) // 竞争收益
    const [cooperationReward, setCooperationReward] = useState(75) // 合作收益
    const [betrayalBonus, setBetrayalBonus] = useState(75) // 背叛收益
    const [riskLevel, setRiskLevel] = useState(75) // 外部风险（灾难概率）
    const [informationNoise, setInformationNoise] = useState(75) // 信息不确定性

    const [mode, setMode] = useState<EnvironmentInitState['mode']>('year')
    const [round, setRound] = useState<EnvironmentInitState['round']>(5)

    const customAgentEnabled = useStore(s => s.customAgentEnabled)
    const customAgent = useStore(s => s.customAgent)

    const HostSetting: EnvironmentInitState = useMemo(
        () => ({
            resourceTotal,
            regenerationRate,
            competitionReward,
            cooperationReward,
            betrayalBonus,
            riskLevel,
            informationNoise,
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
            informationNoise,
            mode,
            round,
        ],
    )

    const init = useStore(s => s.init)
    const tick = useStore(s => s.tick)

    const initialAgents = useMemo(() => [agentA, agentB, agentC, agentD], [])
    const [running, setRunning] = useState(false)

    // 控制仿真定时器：只有在 running=true 时才会启动 tick
    useEffect(() => {
        if (!running) return

        const timer = setInterval(() => {
            tick()

            // 当达到设定轮次/时间耗尽/无人存活时，自动停止仿真
            const { envRound, envInit } = useStore.getState()
            if (
                envRound.round >= envInit.round ||
                envRound.timeLeft <= 0 ||
                envRound.aliveAgent.length === 0
            ) {
                setRunning(false)
            }
        }, 1000)

        return () => clearInterval(timer)
    }, [running, tick])



    return <div className='env-host p-2'>
        <Card className='flex p-2  bg-gray-50' >
            <CardTitle>环境设置</CardTitle>
            <Select value={mode} onValueChange={(v) => v === 'year' || v === 'month' || v === 'day' ? setMode(v) : null}>
                <SelectTrigger className="w-full max-w-48">
                    <SelectValue placeholder="选择模式" />
                </SelectTrigger>
                <SelectContent>
                    <SelectGroup>
                        <SelectLabel>模式</SelectLabel>
                        <SelectItem value="year">年</SelectItem>
                        <SelectItem value="month">月</SelectItem>
                        <SelectItem value="day">日</SelectItem>
                    </SelectGroup>
                </SelectContent>
            </Select>
            <Select value={String(round)} onValueChange={(v) => setRound(Number(v))}>
                <SelectTrigger className="w-full max-w-48">
                    <SelectValue placeholder="选择轮次" />
                </SelectTrigger>
                <SelectContent>
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
            <div className="slider-group">
                总资源量<Slider
                    value={[resourceTotal]}
                    onValueChange={(v) => setResourceTotal(v[0] ?? resourceTotal)}
                    max={100}
                    step={1}
                    className="mx-auto w-full max-w-xs py-2"
                />
                资源再生速度<Slider
                    value={[regenerationRate]}
                    onValueChange={(v) => setRegenerationRate(v[0] ?? regenerationRate)}
                    max={100}
                    step={1}
                    className="mx-auto w-full max-w-xs py-2"
                />
                竞争收益<Slider
                    value={[competitionReward]}
                    onValueChange={(v) => setCompetitionReward(v[0] ?? competitionReward)}
                    max={100}
                    step={1}
                    className="mx-auto w-full max-w-xs py-2"
                />
                合作收益<Slider
                    value={[cooperationReward]}
                    onValueChange={(v) => setCooperationReward(v[0] ?? cooperationReward)}
                    max={100}
                    step={1}
                    className="mx-auto w-full max-w-xs py-2"
                />
                背叛收益<Slider
                    value={[betrayalBonus]}
                    onValueChange={(v) => setBetrayalBonus(v[0] ?? betrayalBonus)}
                    max={100}
                    step={1}
                    className="mx-auto w-full max-w-xs py-2"
                />
                外部风险<Slider
                    value={[riskLevel]}
                    onValueChange={(v) => setRiskLevel(v[0] ?? riskLevel)}
                    max={100}
                    step={1}
                    className="mx-auto w-full max-w-xs py-2"
                />
                信息不确定性<Slider
                    value={[informationNoise]}
                    onValueChange={(v) => setInformationNoise(v[0] ?? informationNoise)}
                    max={100}
                    step={1}
                    className="mx-auto w-full max-w-xs py-2"
                />
            </div>

            <CardFooter className=" w-full env-btn flex flex-wrap justify-between items-center md:flex-row">
                {/* {styles['start-btn']} */}
                <Button
                    variant="outline"
                    className="w-1/4"
                    onClick={() => {
                        const base = initialAgents.map(cloneAgent)
                        const hasCustom =
                            customAgentEnabled && customAgent != null
                        const agentsForSim = hasCustom
                            ? [...base, cloneAgent(customAgent)]
                            : base
                        init(
                            agentsForSim,
                            HostSetting,
                            round,
                        )
                        setRunning(true)
                    }}
                >
                    start
                </Button>
                <Button variant="outline" className="pause-btn w-1/4" onClick={() => setRunning(false)}>
                    pause
                </Button>
                <Button variant="outline" className="end-btn w-1/4" onClick={() => setRunning(false)}>
                    end
                </Button>
                <Button variant="outline" className="end-btn w-1/4" onClick={() => setRunning(false)}>
                    reset
                </Button>
            </CardFooter>
        </Card>

    </div>
}

export default EnvHost