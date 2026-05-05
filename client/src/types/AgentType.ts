export interface Agent {
    id: string,

    traits: {
        risk: number,
        greed: number,
        social: number,
        aggression: number,
    }
    goal: 'survive' | 'maximize_resource',
    state: {
        resource: number,
        hp:number,
        alive: boolean,
    }
} 

const agentA: Agent = {
    id: 'A',
    traits: {
        risk: 0.7,
        greed: 0.9,
        social: 0.1,
        aggression: 0.8
    },
    goal: 'maximize_resource',
    state: {
        resource: 0,
        hp:10,
        alive: true
    }
}

const agentB: Agent = {
    id: 'B',
    traits: {
        risk: 0.2,
        greed: 0.4,
        social: 0.5,
        aggression: 0.1
    },
    goal: 'survive', 
    state: {
        resource: 0,
        hp:10,
        alive: true
    }
}

const agentC: Agent = {
    id: 'C',
    traits: {
        risk: 0.6,
        greed: 0.7,
        social: 0.4,
        aggression: 0.5
    },
    goal: 'maximize_resource',
    state: {
        resource: 0,
        hp:10,
        alive: true
    }
}

const agentD: Agent = {
    id: 'D',
    traits: {
        risk: 0.3,
        greed: 0.3,
        social: 0.9,
        aggression: 0.1
    },
    goal: 'survive', 
    state: {
        resource: 0,
        hp:10,
        alive: true
    }
}
export {agentA,agentB,agentC,agentD}