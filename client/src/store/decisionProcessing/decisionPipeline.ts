import type { Action } from "../../types/Action"
import type { Agent } from "../../types/AgentType"
import type { EnvironmentInitState, EnvironmentRoundState } from "../../types/EnvironmentType"
import { decideAction } from "../../utils/decideAction"
import type { DecisionFn, DecisionInput, DecisionOutput } from "./decisionInterface"
import { fallback, validateDecision } from "./decisionValidator"

// ============================================================
// 内置基于评分函数的决策引擎（旧 decideAction 的封装）
// 后期可替换为外部 agent 决策（LLM / API / 脚本），
// 只需更换 decisionFn 即可，管道逻辑不变。
// ============================================================
//action 获取函数
const builtinDecision: DecisionFn = (input: DecisionInput): Action => {
  return decideAction(
    input.agentStage,
    input.agents,
    input.envInit,
    input.envRound,
  )
}

// 决策管道：组装输入 → 调用决策函数 → 校验 → 返回 DecisionOutput
//
// 后期要切换决策引擎时，只需：
//   1. 实现 DecisionFn 签名的函数
//   2. 调用 runDecisionPipeline(input, myDecisionFn)
export async function runDecisionPipeline(
  input: DecisionInput,
  decisionFn: DecisionFn = builtinDecision,
): Promise<DecisionOutput> {
  try {
    const rawAction =await decisionFn(input)
    return  validateDecision(input, rawAction)
  } catch (err: unknown) {
    // 决策函数抛异常 → 降级为 wait
    const message = err instanceof Error ? err.message : String(err)
    return fallback(input.agentStage.id, {
      type: "EXECUTION_ERROR",
      message,
    })
  }
}

// 便利函数：为一个 agent 构建 DecisionInput
export function buildDecisionInput(
  agent: Agent,
  agents: Agent[],
  envInit: EnvironmentInitState,
  envRound: EnvironmentRoundState,
): DecisionInput {
  return {
    agentStage: agent,
    agents,
    envInit,
    envRound,
  }
}

// 便利函数：对所有存活 agent 并行决策
// （当前为串行调用；后期如需并行需要替换为 Promise.all）
export async function decideAll(
  agents: Agent[],
  envInit: EnvironmentInitState,
  envRound: EnvironmentRoundState,
  decisionFn?: DecisionFn,
): Promise<DecisionOutput[]> {
  return await Promise.all(agents.map(agent =>
    runDecisionPipeline(
      buildDecisionInput(agent, agents, envInit, envRound),
      decisionFn,
    ),
  ))
}

//最终实现：decideAll投入agents数组和decision函数