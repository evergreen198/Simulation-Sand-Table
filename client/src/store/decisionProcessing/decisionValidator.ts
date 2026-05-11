import type { Action } from "../../types/Action"
import type {
  DecisionError,
  DecisionInput,
  DecisionOutput,
} from "./decisionInterface"

// ============================================================
// 合法 Action.type 集合
// ============================================================
const VALID_ACTION_TYPES = new Set<string>([
  "gather",
  "attack",
  "cooperate",
  "defend",
  "wait",
  "dead",
])

// ============================================================
// 需要携带 target 的 action type
// ============================================================
const TARGETED_ACTIONS = new Set<string>(["attack", "cooperate"])

// ============================================================
// 校验入口：对决策函数的原始返回值做全面合法性检查，
// 合法则包装为 status="success"，否则降级为 safe fallback。
// ============================================================
export function validateDecision(
  input: DecisionInput,
  rawAction: Action | null | undefined,
  rawString?: string,
): DecisionOutput {
  const { agentStage, agents } = input

  // ---------- 1. 原始值为 null / undefined ----------
  if (rawAction == null) {
    return fallback(agentStage.id, {
      type: "NULL_OR_UNDEFINED",
    }, rawString)
  }

  // ---------- 2. action 类型不合法 ----------
  if (
    typeof (rawAction as Record<string, unknown>).type !== "string" ||
    !VALID_ACTION_TYPES.has((rawAction as Action).type)
  ) {
    return fallback(agentStage.id, {
      type: "INVALID_ACTION_TYPE",
      detail: JSON.stringify(rawAction),
    }, rawString)
  }

  const action = rawAction as Action

  // ---------- 3. death agent 试图发非 dead/wait 动作 ----------
  if (!agentStage.state.alive && action.type !== "dead" && action.type !== "wait") {
    return fallback(agentStage.id, {
      type: "DEAD_AGENT_ACTING",
      actionType: action.type,
    }, rawString)
  }

  // ---------- 4. attack / cooperate 缺少 target ----------
  if (TARGETED_ACTIONS.has(action.type)) {
    const targeted = action as { type: "attack" | "cooperate"; target?: string }

    if (!targeted.target || typeof targeted.target !== "string") {
      return fallback(agentStage.id, {
        type: "MISSING_TARGET",
        actionType: action.type as "attack" | "cooperate",
      }, rawString)
    }

    // ---------- 5. target 是 agent 自己 ----------
    if (targeted.target === agentStage.id) {
      return fallback(agentStage.id, {
        type: "SELF_TARGET",
        actionType: action.type as "attack" | "cooperate",
      }, rawString)
    }

    // ---------- 6. target 在所有 agent 中不存在 ----------
    const targetAgent = agents.find(a => a.id === targeted.target)
    if (!targetAgent) {
      return fallback(agentStage.id, {
        type: "TARGET_NOT_FOUND",
        target: targeted.target,
      }, rawString)
    }

    // ---------- 7. target 已死亡 ----------
    if (!targetAgent.state.alive) {
      return fallback(agentStage.id, {
        type: "TARGET_NOT_ALIVE",
        target: targeted.target,
      }, rawString)
    }
  }

  // ---------- 全部通过 → 合法决策 ----------
  return {
    id: agentStage.id,
    action,
    status: "success",
    raw: rawString,
    runtimeStatus: agentStage.state.alive ? "acting" : "dead",
  }
}

// ============================================================
// 安全降级：统一返回 wait 动作，附带降级原因
// ============================================================
export function fallback(
  agentId: string,
  error: DecisionError,
  raw?: string,
): DecisionOutput {
  const reason = formatError(error)
  return {
    id: agentId,
    action: { type: "wait" },
    status: "fallback",
    reason,
    raw,
    runtimeStatus: "fallback_wait",
  }
}

// ============================================================
// 将 DecisionError 转为可读字符串
// ============================================================
function formatError(e: DecisionError): string {
  switch (e.type) {
    case "INVALID_ACTION_TYPE":
      return `Invalid action type: ${e.detail}`
    case "MISSING_TARGET":
      return `Action "${e.actionType}" is missing target`
    case "TARGET_NOT_FOUND":
      return `Target "${e.target}" not found in agent list`
    case "TARGET_NOT_ALIVE":
      return `Target "${e.target}" is not alive`
    case "SELF_TARGET":
      return `Agent cannot "${e.actionType}" itself`
    case "DEAD_AGENT_ACTING":
      return `Dead agent attempted action "${e.actionType}"`
    case "NULL_OR_UNDEFINED":
      return "Decision function returned null or undefined"
    case "EXECUTION_ERROR":
      return `Decision execution error: ${e.message}`
  }
}