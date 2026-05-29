import type { Action } from "./Action"

export interface EnvironmentInitState{
    resourceTotal:number,//总资源量（稀缺or丰富）
    regenerationRate:number,//资源再生速度
    competitionReward:number,//竞争收益
    cooperationReward:number,//合作收益
    betrayalBonus: number,//背叛收益
    riskLevel: number,//外部风险（灾难概率）
    mode:'year'|'month'|'day',
    round:number

}

/** 合作关系存档 */
export interface CoRelation {
    /** 标准化 key，如 "A-B"（按 id 字母序） */
    id: string
    agentA: string
    agentB: string
    /** 建立回合 */
    establishedRound: number

    validUntilRound: number
    /** 当前是否有效 */
    active: boolean
}

export interface EnvironmentRoundState{
    round:number,
    timeLeft:number,
    currentSource:number,
    // aliveAgent 存的是存活 agent 的 id 列表
    aliveAgent: string[],
    // envUpdates 可用于记录每轮环境产生的更新（目前在 store 里先用空数组）
    envUpdates: Action[],
    /** 合作关系存档列表 */
    coRelations: CoRelation[],
}
