import { create } from "zustand"

interface EnvState{
    currentSource:number,
    TimeLeft:number,
    aliveAgent:number,
    incrementSource:()=>void,
    decrementSource:()=>void,
    decrementTime:()=>void,
    decrementAlive:()=>void
}

 const useEnvStore =create<EnvState>((set)=>({
    currentSource:0,
    TimeLeft:0,
    aliveAgent:0,
    incrementSource:()=>set((state)=>({currentSource:state.currentSource+1})),
    decrementSource:()=>set((state)=>({currentSource:state.currentSource-1})),
    decrementTime:()=>set(state=>({TimeLeft:state.TimeLeft-1})),
    decrementAlive:()=>set(state=>({aliveAgent:state.aliveAgent-1}))
 }))

 export default useEnvStore