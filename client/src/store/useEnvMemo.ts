// 主持人轮次摘要与终局报告状态
import { create } from "zustand"
import { subscribeWithSelector } from "zustand/middleware"
import type { HostFinalSummary, HostRoundSummary } from "../../../shared/host/host-types"

interface EnvMemoState {
  /** 每回合主持人摘要，按回合顺序追加 */
  roundSummaries: HostRoundSummary[]
  /** 仿真结束后的全局报告；未结束时为 null */
  finalSummary: HostFinalSummary | null
  /** 新局清空 */
  init: () => void
  appendRoundSummary: (item: HostRoundSummary) => void
  setFinalSummary: (item: HostFinalSummary) => void
}

const useEnvMemoStore = create<EnvMemoState>()(
  subscribeWithSelector(set => ({
    roundSummaries: [],
    finalSummary: null,
    init: () => set({ roundSummaries: [], finalSummary: null }),
    appendRoundSummary: item =>
      set(state => ({
        roundSummaries: [...state.roundSummaries, item],
      })),
    setFinalSummary: item => set({ finalSummary: item }),
  })),
)

export default useEnvMemoStore
