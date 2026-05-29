# Implementation Plan

[Overview]
修复 `useAgentMemoStore` 及其相关文件（memoTypes.ts, memoConstructor.ts, useAgentMemo.ts, simulation.ts, useStore.ts, decisionPipeline.ts, AgentType.ts）中存在的逻辑错误、性能浪费和代码质量问题，记忆系统暂不接入 LLM 决策。

本次修复聚焦于已识别的 7 个具体问题，按严重程度和依赖关系排序。记忆系统（socialMemory / roundMemory）当前仅在结算阶段写入但未被任何消费端读取（memoSearcher.ts 为空文件，LLM 决策函数不读取 store），修复方案确认记忆系统为预留功能，本次仅消除其负面影响（内存膨胀、冗余状态更新）而不接入 LLM。核心修改涉及无界内存增长的控制、减少不必要的 LLM API 调用、优化 zustand 状态更新频率，以及清理混入类型文件的测试数据。

[Types]
无新增类型定义，仅对现有类型进行边界约束。

- `AgentRoundMemory`（memoTypes.ts:3-17）：保持现有结构不变，但 `roundMemory` 数组需在消费端添加 MAX_ROUND_MEMORY 上限常量。
- `AgentSocialMemory`（memoTypes.ts:19-44）：保持现有结构不变，但六个数组字段需在消费端添加去重逻辑和上限常量。
- 新增常量：
  - `MAX_ROUND_MEMORY = 50`（保留最近 50 回合记忆）
  - `MAX_SOCIAL_MEMORY_PER_PATTERN = 30`（每种社交记忆最多保留 30 条）

[Files]
涉及 6 个文件的修改和 1 个文件的删除。

**新建文件：**
- 无

**修改文件：**



√ 2. **`client/src/memoryManagement/memoConstructor.ts`** — 三个修改点：
   - 添加 `MAX_ROUND_MEMORY` 和 `MAX_SOCIAL_MEMORY_PER_PATTERN` 常量导出。
   - `updateAgentRoundMemory`（第 42 行）：追加新记录后，如果数组长度超过 `MAX_ROUND_MEMORY`，使用 `slice(-MAX_ROUND_MEMORY)` 保留最近 N 条。
   - `updateCooperateMemory`（第 76 行）：追加新记录前先检查 `oldSocialMemory[pattern]` 中是否已存在相同的 `(agentId, round)` 记录以避免重复；追加后如果超过 `MAX_SOCIAL_MEMORY_PER_PATTERN` 则 `slice` 保留最近 N 条。

√ 3. **`client/src/store/useAgentMemo.ts`** — 两个修改点：
   - `updateCooperateState`（第 57-76 行）：替换 `events.filter(e => e.agentId === mem.agentId)` 的 O(n×m) 嵌套循环为预处理分组（先按 `agentId` group by 到 `Map<string, SocialMemoryEvent[]>`，再遍历 memories 查找对应数组），将复杂度从 O(n²) 降至 O(n+m)。
   - `init`（第 32 行）：确认当前 `init` 已用 `new Map` 构建，无需修改。

√ 4. **`client/src/store/simulation.ts`** — 三个修改点：
   - 第 643-653 行：合并两次 zustand `set()` 调用。当前先调 `updateCooperateState` 再调 `updateRoundState`，触发两次状态更新。改为将所有记忆更新合并为一次原子操作：在 `simulateRound` 中直接构建新的 `agentsMemory`，或合并 `updateRoundState` 与 `updateCooperateState` 为一个合并方法。
   - 在 `applyResolvedActions` 的 Phase 4/5 中（第 270-397 行），`socialEvents` 对双方各自推送事件（如 attacker→toAttack + target→beAttack），确认逻辑正确性（已验证正确，无需修改）。

6. **`client/src/store/useStore.ts`** — 无需功能修改，但需验证 `init` 方法（第 75 行）中 `useAgentMemoStore.getState().init(agents.map(a => a.id))` 的调用在记忆系统修改后仍正确（预期无需改动）。

**删除文件：**
- 不删除任何文件（`memoSearcher.ts` 为预留空文件，保留以表明意图）。

**配置更新：**
- 无

[Functions]
涉及 5 个函数的修改和 0 个函数的删除。

**修改函数：**

1. **`updateAgentRoundMemory`**（`client/src/memoryManagement/memoConstructor.ts:42-65`）
   - 修改内容：在 `return [...]` 后添加 `slice(-MAX_ROUND_MEMORY)` 调用限制数组长度。
   - 签名不变。

2. **`updateCooperateMemory`**（`client/src/memoryManagement/memoConstructor.ts:76-92`）
   - 修改内容：追加前检查 `oldSocialMemory[pattern].some(e => e.agentId === initiatorAgentId && e.atRound === round)` 避免重复；追加后限制数组长度。
   - 签名不变。

3. **`updateCooperateState`**（`client/src/store/useAgentMemo.ts:57-76`）
   - 修改内容：添加预处理分组步骤，将嵌套过滤改为 Map 查找。
   - 签名不变。

4. **`simulateRound`**（`client/src/store/simulation.ts:623-677`）
   - 修改内容：
     - 第 637 行日志输出从 `agentActions`（完整历史）改为 `actions`（本轮决策）。
     - 合并 `updateCooperateState` 和 `updateRoundState` 两次 store 写为一次合并操作。
   - 签名不变。

5. **`decideAll`**（`client/src/store/decisionProcessing/decisionPipeline.ts:62-74`）
   - 修改内容：在 `agents.map(...)` 前添加 `.filter(a => a.state.alive)`。
   - 签名不变。

**删除函数：**
- 无（但 `AgentType.ts` 中的 `export {agentA,agentB,agentC,agentD}` 需删除）。

[Classes]
无类定义修改（项目使用函数式/接口类型风格，不使用 class）。

[Dependencies]
无新增或修改依赖。

- 无需新增 npm 包。
- 无需修改 `package.json`。

[Testing]
本任务不包含自动化测试编写。验证策略：

1. **逻辑正确性验证：**
   - 启动仿真，观察 `decideAll` 不再为已死亡 agent 调用 LLM（通过 console.log 或网络面板确认）。
   - 观察 `agentAliveRound` 列表中已死亡 agent 的 `aliveRond` 不再增加（确认 `computeNextAgentAliveRound` 早于本次修改已正确处理）。

2. **性能验证：**
   - 运行 60+ 回合仿真，观察浏览器内存面板确认 `agentsMemory` 大小不再线性增长。
   - 使用 React DevTools Profiler 确认每回合触发渲染次数减少（合并 store 更新后）。

3. **回归验证：**
   - 确认 UI 图表（资源折线图、存活时间柱状图）在修改前后数据一致。
   - 确认合作/攻击/背叛的社交事件记录仍然正确写入记忆（虽然暂不消费）。

[Implementation Order]
按依赖关系和风险由低到高排序的 7 个修改步骤：

1. **删除 `AgentType.ts` 中的测试数据**（第 22-93 行）— 无依赖，独立操作。同时检查项目中是否有文件导入这些常量并更新引用。

2. **修复 `decideAll` 跳过死亡 agent**（`decisionPipeline.ts:62-74`）— 无依赖，独立操作。添加 `.filter(a => a.state.alive)` 在 `agents.map(...)` 之前。

3. **添加记忆裁剪逻辑**（`memoConstructor.ts`）— 添加 `MAX_ROUND_MEMORY` 和 `MAX_SOCIAL_MEMORY_PER_PATTERN` 常量，修改 `updateAgentRoundMemory` 和 `updateCooperateMemory` 函数添加长度限制和去重。

4. **优化 `updateCooperateState` 嵌套循环**（`useAgentMemo.ts:57-76`）— 将 O(n×m) 过滤改为 O(n+m) 分组查找。依赖步骤 3 的常量导出，但逻辑独立。

5. **修复 `simulation.ts` 日志输出**（第 637 行）— 将 `agentActions` 参数改为 `actions`。独立操作。

6. **合并 `simulateRound` 中的两次 store 更新**（`simulation.ts:643-653`）— 将 `updateCooperateState` 和 `updateRoundState` 合并为一次原子操作。依赖于 `useAgentMemo.ts` 的现有接口（可在 store 中新增一个合并方法，或直接将记忆构建逻辑移到 simulation.ts 中后一次性 set）。

7. **最终集成验证** — 运行完整仿真流程，确认所有修改协同工作正常，无回归问题。