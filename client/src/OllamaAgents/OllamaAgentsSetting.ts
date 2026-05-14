export type AgentLLMConfig={
    model:string
    temperature:number
    systemPrompt:string
}

export const agentLLMMap: Record<string, AgentLLMConfig>={
    
}
//新增直接赋值
agentLLMMap['hh']={
    model:'s',
    temperature:2,
    systemPrompt:'23'
}