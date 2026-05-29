import type { ComponentType, ReactNode } from "react"
import { Slider } from "../ui/slider"
import { cn } from "../../lib/utils"

/** 设置侧栏暗色控件样式（与 DataShowSection 一致） */
export const settingsInputClass =
  "border-white/[0.08] bg-white/[0.03] text-zinc-100 placeholder:text-zinc-600 focus-visible:border-indigo-500/40 focus-visible:ring-indigo-500/20"

export const settingsSelectTriggerClass =
  "w-full border-white/[0.08] bg-white/[0.03] text-zinc-200 hover:bg-white/[0.06]"

export const settingsSliderClass =
  "[&_[data-slot=slider-track]]:bg-white/[0.08] [&_[data-slot=slider-range]]:bg-indigo-500 [&_[data-slot=slider-thumb]]:border-indigo-400/50 [&_[data-slot=slider-thumb]]:bg-zinc-100"

export function SettingPanel({
  title,
  description,
  icon: Icon,
  children,
  className,
}: {
  title: string
  description?: string
  icon: ComponentType<{ className?: string }>
  children: ReactNode
  className?: string
}) {
  return (
    <section
      className={cn(
        "overflow-hidden rounded-xl border border-white/[0.06] bg-white/[0.02] shadow-[0_0_0_1px_rgba(255,255,255,0.02)_inset]",
        className,
      )}
    >
      <div className="flex items-start gap-3 border-b border-white/[0.06] px-4 py-3">
        <div className="flex size-8 shrink-0 items-center justify-center rounded-lg border border-white/[0.08] bg-white/[0.04]">
          <Icon className="size-3.5 text-zinc-400" strokeWidth={1.75} />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-[13px] font-medium tracking-tight text-zinc-100">
            {title}
          </h2>
          {description ? (
            <p className="mt-0.5 text-[11px] leading-relaxed text-zinc-500">
              {description}
            </p>
          ) : null}
        </div>
      </div>
      <div className="p-4">{children}</div>
    </section>
  )
}

export function ParamSlider({
  label,
  value,
  onValueChange,
  disabled,
}: {
  label: string
  value: number
  onValueChange: (v: number) => void
  disabled?: boolean
}) {
  return (
    <div className={cn("space-y-2", disabled && "opacity-45")}>
      <div className="flex items-center justify-between text-[11px]">
        <span className="text-zinc-400">{label}</span>
        <span className="tabular-nums font-mono text-zinc-300">{value}</span>
      </div>
      <Slider
        value={[value]}
        onValueChange={v => onValueChange(v[0] ?? value)}
        max={100}
        step={1}
        disabled={disabled}
        className={cn("w-full", settingsSliderClass)}
      />
    </div>
  )
}

export function SimControlButton({
  label,
  onClick,
  disabled,
  variant = "default",
}: {
  label: string
  onClick: () => void
  disabled?: boolean
  variant?: "primary" | "default" | "danger" | "ghost"
}) {
  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        "h-8 flex-1 min-w-[4.5rem] rounded-lg border text-[11px] font-medium transition-colors disabled:pointer-events-none disabled:opacity-40",
        variant === "primary" &&
          "border-indigo-500/40 bg-indigo-500/15 text-indigo-200 hover:bg-indigo-500/25",
        variant === "default" &&
          "border-white/[0.08] bg-white/[0.03] text-zinc-300 hover:bg-white/[0.06]",
        variant === "danger" &&
          "border-rose-500/30 bg-rose-500/10 text-rose-300 hover:bg-rose-500/20",
        variant === "ghost" &&
          "border-transparent bg-transparent text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-300",
      )}
    >
      {label}
    </button>
  )
}
