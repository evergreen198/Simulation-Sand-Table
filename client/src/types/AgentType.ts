export interface Agent {
    id: string,

    traits: {
        risk: number,
        greed: number,
        social: number,
        aggression: number,
        /** 原始被接受度（固有属性，由 social 决定，不变） */
        beAcceptedBase: number,
    }
    goal: 'survive' | 'maximize_resource',
    state: {
        resource: number,
        hp:number,
        alive: boolean,
        /** 当前被接受度修正（受背叛/合作行为影响） */
        beAcceptedCurrent: number,
    }
} 

const agentA: Agent = {
    id: 'A',
    traits: {
        risk: 0.7,
        greed: 0.9,
        social: 0.1,
        aggression: 0.8,
        beAcceptedBase: 0.1,
    },
    goal: 'maximize_resource',
    state: {
        resource: 0,
        hp:10,
        alive: true,
        beAcceptedCurrent: 0.1,
    }
}

const agentB: Agent = {
    id: 'B',
    traits: {
        risk: 0.2,
        greed: 0.4,
        social: 0.5,
        aggression: 0.1,
        beAcceptedBase: 0.5,
    },
    goal: 'survive', 
    state: {
        resource: 0,
        hp:10,
        alive: true,
        beAcceptedCurrent: 0.5,
    }
}

const agentC: Agent = {
    id: 'C',
    traits: {
        risk: 0.6,
        greed: 0.7,
        social: 0.4,
        aggression: 0.5,
        beAcceptedBase: 0.4,
    },
    goal: 'maximize_resource',
    state: {
        resource: 0,
        hp:10,
        alive: true,
        beAcceptedCurrent: 0.4,
    }
}

const agentD: Agent = {
    id: 'D',
    traits: {
        risk: 0.3,
        greed: 0.3,
        social: 0.9,
        aggression: 0.1,
        beAcceptedBase: 0.9,
    },
    goal: 'survive', 
    state: {
        resource: 0,
        hp:10,
        alive: true,
        beAcceptedCurrent: 0.9,
    }
}
export {agentA,agentB,agentC,agentD}