import EnvHost from "./Agents/EnvHost"
import AgentsSetting from "./Agents/AgentsSetting"

function SettingSection() {
  return (
    <div className="setting-section min-h-full bg-[#09090b] text-zinc-100">
      <header className="sticky top-0 z-10 border-b border-white/[0.06] bg-[#09090b]/85 px-5 py-4 backdrop-blur-xl">
        <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-zinc-500">
          Control
        </p>
        <h1 className="mt-1 text-base font-semibold tracking-tight text-zinc-50">
          仿真设置
        </h1>
        <p className="mt-1.5 text-[11px] leading-relaxed text-zinc-500">
          配置环境参数、内置角色与自定义 Agent
        </p>
      </header>

      <div className="space-y-3 p-4 pb-8">
        <EnvHost />
        <AgentsSetting />
      </div>
    </div>
  )
}

export default SettingSection
