import type { Action } from "./Action"

export interface EnvironmentInitState{
    resourceTotal:number,//总资源量（稀缺or丰富）
    regenerationRate:number,//资源再生速度
    competitionReward:number,//竞争收益
    cooperationReward:number,//合作收益
    betrayalBonus: number,//背叛收益
    riskLevel: number,//外部风险（灾难概率）
    informationNoise:number,//信息不确定性
    mode:'year'|'month'|'day',
    round:number

}
export interface EnvironmentRoundState{
    round:number,
    timeLeft:number,
    currentSource:number,
    // aliveAgent 存的是存活 agent 的 id 列表
    aliveAgent: string[],
    // envUpdates 可用于记录每轮环境产生的更新（目前在 store 里先用空数组）
    envUpdates: Action[]
}