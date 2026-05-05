import { create } from "zustand"

interface Agent {
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

type UserAgentStore = Agent & {
    init: (data: Partial<Agent>) => void
}

export const useUserAgent = create<UserAgentStore>((set, _get) => ({
    id:'user',

    traits: {
        risk:0,
        greed:0,
        social: 0,
        aggression: 0,
    },
    goal: 'survive',
    state: {
        resource: 0,
        hp:10,
        alive: true,
    },
    init: (data: Partial<Agent>) => {
        set(state => ({ ...state, ...data }))
    },
}))
