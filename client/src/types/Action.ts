export type Action =
  | { type: 'gather' }                          // 收集资源（推荐替代 earn）
  | { type: 'attack'; target: string }
  | { type: 'cooperate'; target: string }
  | { type: 'defend' }                          // 防御（不需要target）
  | { type: 'wait' }
  | { type: 'dead' }