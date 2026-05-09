import { useEffect, useRef } from "react"
import { Application, Container, Graphics, Text, TextStyle } from "pixi.js"
import { Viewport } from "pixi-viewport"
import type { Action } from "../types/Action"
import type { Agent } from "../types/AgentType"
import { useStore } from "../store/useStore"

/** 固定世界尺寸（world coordinates） */
const WORLD_W = 2000
const WORLD_H = 2000
const WORLD_CX = WORLD_W / 2
const WORLD_CY = WORLD_H / 2

/**
 * 目标版本 pixi.js 10.9.2：当前 npm latest 为 8.x，尚无 10.9.2。
 * 实现基于现有 pixi.js v8 API（与仓库内 ST-copy 一致）；升级依赖后如遇类型差异再微调即可。
 */

const AGENT_PALETTE = [
  0xe74c3c, 0x3498db, 0x2ecc71, 0x9b59b6, 0xf39c12, 0x1abc9c, 0xe91e63,
]

function hashId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) h = (h << 5) - h + id.charCodeAt(i)
  return Math.abs(h)
}

function agentWorldPos(agent: Agent, index: number, total: number) {
  const base = (index / Math.max(total, 1)) * Math.PI * 2
  const jitter = (hashId(agent.id) % 360) * (Math.PI / 180) * 0.15
  const angle = base + jitter
  const ring = 520 + (hashId(agent.id) % 180)
  return {
    x: WORLD_CX + Math.cos(angle) * ring,
    y: WORLD_CY + Math.sin(angle) * ring,
  }
}

function poolRadius(current: number, refMax: number): number {
  const t = Math.max(0, Math.min(1, current / Math.max(refMax, 1)))
  return 36 + t * 160
}

function agentRadius(resource: number): number {
  const t = Math.max(0, Math.min(1, resource / 80))
  return 14 + t * 42
}

function actionForRound(
  agentActions: { id: string; actions: { round: number; action: Action }[] }[],
  round: number,
): Map<string, Action> {
  const m = new Map<string, Action>()
  for (const aa of agentActions) {
    const hit = aa.actions.filter((e) => e.round === round)
    if (hit.length) m.set(aa.id, hit[hit.length - 1].action)
  }
  return m
}

type HaloKind = "defend" | "wait" | "gather" | "none"

function haloFromAction(a: Action | undefined): HaloKind {
  if (!a) return "none"
  switch (a.type) {
    case "defend":
      return "defend"
    case "wait":
      return "wait"
    case "gather":
      return "gather"
    default:
      return "none"
  }
}

type AttackFx = { attackerId: string; targetId: string; until: number }
type CooperateFx = { aId: string; bId: string; untilRound: number }
type DeathFx = { x: number; y: number; until: number }
type BurstFx = { x: number; y: number; until: number }

export default function SandTableSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<Application | null>(null)

  useEffect(() => {
    const host = containerRef.current
    if (!host) return

    let destroyed = false
    let appDestroyed = false

    const destroyApp = (instance?: Application) => {
      if (appDestroyed) return
      const target = instance ?? appRef.current
      if (!target) return
      appDestroyed = true
      // 与 ST-copy 一致；不用 resizeTo，避免 ResizePlugin 与二次 destroy 竞态导致 _cancelResize 非函数
      target.destroy({ removeView: true })
      if (appRef.current === target) appRef.current = null
    }

    const agentPositions = new Map<string, { x: number; y: number }>()
    const haloTransition = new Map<
      string,
      { from: HaloKind; to: HaloKind; start: number }
    >()
    const prevHaloKind = new Map<string, HaloKind>()
    const shakeUntil = new Map<string, number>()
    const flashUntil = new Map<string, number>()

    let prevRound = -1
    let prevAlive = new Map<string, boolean>()

    const attackFx: AttackFx[] = []
    const cooperateFx: CooperateFx[] = []
    const deathFx: DeathFx[] = []
    const burstFx: BurstFx[] = []

    const syncPositions = (agents: Agent[]) => {
      const n = agents.length
      agents.forEach((a, i) => {
        if (!agentPositions.has(a.id)) {
          agentPositions.set(a.id, agentWorldPos(a, i, n))
        }
      })
    }

    const pushAttack = (attackerId: string, targetId: string) => {
      attackFx.push({
        attackerId,
        targetId,
        until: performance.now() + 1300,
      })
      shakeUntil.set(targetId, performance.now() + 1300)
      flashUntil.set(targetId, performance.now() + 1300)
    }

    const processRoundTransition = (
      round: number,
      agentActions: {
        id: string
        actions: { round: number; action: Action }[]
      }[],
      agents: Agent[],
    ) => {
      if (round <= 0) return
      const actionRound = round - 1
      const map = actionForRound(agentActions, actionRound)
      for (const [id, action] of map) {
        if (action.type === "attack") pushAttack(id, action.target)
        if (action.type === "cooperate") {
          cooperateFx.push({
            aId: id,
            bId: action.target,
            untilRound: round,
          })
        }
      }

      const aliveNow = new Map(agents.map((a) => [a.id, a.state.alive]))
      for (const a of agents) {
        const was = prevAlive.get(a.id) ?? true
        const pos = agentPositions.get(a.id)
        if (was && !a.state.alive && pos) {
          deathFx.push({ x: pos.x, y: pos.y, until: performance.now() + 900 })
          burstFx.push({ x: pos.x, y: pos.y, until: performance.now() + 750 })
        }
      }
      prevAlive = aliveNow
    }

    const onStore = (state: ReturnType<typeof useStore.getState>) => {
      const r = state.envRound.round
      syncPositions(state.agents)
      cooperateFx.splice(
        0,
        cooperateFx.length,
        ...cooperateFx.filter((c) => c.untilRound >= r),
      )
      if (r !== prevRound) {
        if (prevRound >= 0) {
          processRoundTransition(r, state.agentActions, state.agents)
        } else {
          prevAlive = new Map(state.agents.map((a) => [a.id, a.state.alive]))
        }
        prevRound = r
      }
    }

    {
      const s = useStore.getState()
      syncPositions(s.agents)
      prevAlive = new Map(s.agents.map((a) => [a.id, a.state.alive]))
      prevRound = s.envRound.round
    }

    const unsubStore = useStore.subscribe(onStore)

    const boomStyle = new TextStyle({
      fontSize: 22,
      fill: 0xffaa66,
      fontWeight: "bold",
    })

    const app = new Application()

    const init = async () => {
      const rw = Math.max(1, host.clientWidth || 800)
      const rh = Math.max(1, host.clientHeight || 600)
      await app.init({
        width: rw,
        height: rh,
        backgroundColor: 0x141414,
        antialias: true,
        autoDensity: true,
        resolution: typeof window !== "undefined" ? window.devicePixelRatio : 1,
      })
      if (destroyed) {
        destroyApp(app)
        return
      }

      appRef.current = app
      host.appendChild(app.canvas)

      const viewport = new Viewport({
        screenWidth: host.clientWidth,
        screenHeight: host.clientHeight,
        worldWidth: WORLD_W,
        worldHeight: WORLD_H,
        events: app.renderer.events,
        ticker: app.ticker,
      })

      viewport.sortableChildren = true
      app.stage.addChild(viewport)

      viewport.drag().pinch().wheel({ percent: 1.15 }).decelerate()
      viewport.clampZoom({ minScale: 0.15, maxScale: 4 })
      viewport.fitWorld(true)
      viewport.moveCenter(WORLD_CX, WORLD_CY)

      const mapLayer = new Container()
      mapLayer.eventMode = "none"
      mapLayer.interactiveChildren = false

      const resourceLayer = new Container()
      resourceLayer.eventMode = "none"

      const haloLayer = new Container()
      const relationLayer = new Container()
      const agentLayer = new Container()
      const fxLayer = new Container()

      ;[mapLayer, resourceLayer, haloLayer, relationLayer, agentLayer, fxLayer].forEach(
        (c, i) => {
          c.zIndex = i
        },
      )
      viewport.sortableChildren = true
      viewport.addChild(mapLayer, resourceLayer, haloLayer, relationLayer, agentLayer, fxLayer)

      const mapBg = new Graphics()
      mapBg.rect(0, 0, WORLD_W, WORLD_H)
      mapBg.fill(0x1e1e1e)
      mapLayer.addChild(mapBg)

      const grid = new Graphics()
      const step = 40
      for (let x = 0; x <= WORLD_W; x += step) {
        for (let y = 0; y <= WORLD_H; y += step) {
          grid.circle(x, y, 1.2)
          grid.fill({ color: 0x3a3a3a, alpha: 0.55 })
        }
      }
      mapLayer.addChild(grid)

      const boundary = new Graphics()
      boundary.rect(0, 0, WORLD_W, WORLD_H)
      boundary.stroke({ width: 3, color: 0x7f8c8d, alpha: 0.95 })
      mapLayer.addChild(boundary)

      const poolGfx = new Graphics()
      resourceLayer.addChild(poolGfx)

      const gatherLineGfx = new Graphics()
      relationLayer.addChild(gatherLineGfx)

      const coopGfx = new Graphics()
      relationLayer.addChild(coopGfx)

      const attackGfx = new Graphics()
      relationLayer.addChild(attackGfx)

      type AgentGraphics = {
        root: Container
        halo: Graphics
        body: Graphics
      }
      const agentGfx = new Map<string, AgentGraphics>()

      const ensureAgentGfx = (id: string) => {
        let g = agentGfx.get(id)
        if (g) return g
        const root = new Container()
        root.sortableChildren = true
        const halo = new Graphics()
        halo.zIndex = 0
        const body = new Graphics()
        body.zIndex = 1
        root.addChild(halo, body)
        agentLayer.addChild(root)
        g = { root, halo, body }
        agentGfx.set(id, g)
        return g
      }

      const fxParticles = new Container()
      fxLayer.addChild(fxParticles)

      const resizeObs = new ResizeObserver(() => {
        const w = Math.max(1, host.clientWidth)
        const h = Math.max(1, host.clientHeight)
        app.renderer.resize(w, h)
        viewport.resize(w, h)
      })
      resizeObs.observe(host)

      app.ticker.add(() => {
        const state = useStore.getState()
        const { agents, envRound, envInit, agentActions } = state
        const now = performance.now()
        const t = now / 1000

        syncPositions(agents)

        const refMax = Math.max(envInit.resourceTotal, envRound.currentSource, 1)
        const poolR = poolRadius(envRound.currentSource, refMax)
        poolGfx.clear()
        poolGfx.circle(WORLD_CX, WORLD_CY, poolR)
        poolGfx.fill({ color: 0xffcc00, alpha: 0.92 })
        poolGfx.stroke({ width: 2, color: 0xffee88, alpha: 0.35 })

        const actionMap =
          envRound.round > 0
            ? actionForRound(agentActions, envRound.round - 1)
            : new Map<string, Action>()

        gatherLineGfx.clear()
        for (const agent of agents) {
          if (!agent.state.alive) continue
          const act = actionMap.get(agent.id)
          if (act?.type !== "gather") continue
          const pos = agentPositions.get(agent.id)
          if (!pos) continue
          const idx = agents.findIndex((x) => x.id === agent.id)
          const col = AGENT_PALETTE[idx % AGENT_PALETTE.length]
          const dx = pos.x - WORLD_CX
          const dy = pos.y - WORLD_CY
          const len = Math.max(Math.hypot(dx, dy), 1)
          const ux = dx / len
          const uy = dy / len
          const x0 = WORLD_CX + ux * poolR
          const y0 = WORLD_CY + uy * poolR
          const x1 = pos.x - ux * 12
          const y1 = pos.y - uy * 12
          const mx = (x0 + x1) / 2
          const my = (y0 + y1) / 2
          gatherLineGfx.moveTo(x0, y0)
          gatherLineGfx.lineTo(mx, my)
          gatherLineGfx.stroke({ width: 6, color: 0xffdd44, alpha: 0.88 })
          gatherLineGfx.moveTo(mx, my)
          gatherLineGfx.lineTo(x1, y1)
          gatherLineGfx.stroke({ width: 6, color: col, alpha: 0.88 })
        }

        coopGfx.clear()
        const coopPhase = t * 2.5
        for (const c of cooperateFx) {
          const pa = agentPositions.get(c.aId)
          const pb = agentPositions.get(c.bId)
          if (!pa || !pb) continue
          const mx = (pa.x + pb.x) / 2
          const my = (pa.y + pb.y) / 2
          const dx = pb.x - pa.x
          const dy = pb.y - pa.y
          const len = Math.max(Math.hypot(dx, dy), 1)
          const nx = (-dy / len) * 120
          const ny = (dx / len) * 120
          const cx = mx + nx
          const cy = my + ny
          coopGfx.moveTo(pa.x, pa.y)
          coopGfx.quadraticCurveTo(cx, cy, pb.x, pb.y)
          coopGfx.stroke({
            width: 3,
            color: 0x58d68d,
            alpha: 0.35 + Math.sin(coopPhase) * 0.12,
          })
        }

        attackGfx.clear()
        attackFx.splice(
          0,
          attackFx.length,
          ...attackFx.filter((a) => a.until > now),
        )
        for (const atk of attackFx) {
          const pa = agentPositions.get(atk.attackerId)
          const pb = agentPositions.get(atk.targetId)
          if (!pa || !pb) continue
          const dx = pb.x - pa.x
          const dy = pb.y - pa.y
          const dist = Math.max(Math.hypot(dx, dy), 1)
          const ux = dx / dist
          const uy = dy / dist
          const shorten = 28
          const x1 = pa.x + ux * 22
          const y1 = pa.y + uy * 22
          const x2 = pb.x - ux * shorten
          const y2 = pb.y - uy * shorten
          attackGfx.moveTo(x1, y1)
          attackGfx.lineTo(x2, y2)
          attackGfx.stroke({ width: 3, color: 0xe74c3c, alpha: 0.95 })
          const ah = 14
          const aw = 10
          const bx = x2
          const by = y2
          attackGfx.moveTo(bx, by)
          attackGfx.lineTo(bx - ux * ah + (-uy) * aw, by - uy * ah + ux * aw)
          attackGfx.lineTo(bx - ux * ah - (-uy) * aw, by - uy * ah - ux * aw)
          attackGfx.closePath()
          attackGfx.fill({ color: 0xff4444, alpha: 1 })
        }

        const idsUsed = new Set<string>()
        agents.forEach((agent, idx) => {
          idsUsed.add(agent.id)
          const color = AGENT_PALETTE[idx % AGENT_PALETTE.length]
          const { root, halo, body } = ensureAgentGfx(agent.id)
          const base = agentPositions.get(agent.id)!
          root.visible = true

          let ox = 0
          let oy = 0
          const su = shakeUntil.get(agent.id)
          if (su && now < su) {
            const wane = (su - now) / 1300
            ox = Math.sin(now * 0.09) * 6 * wane
            oy = Math.cos(now * 0.11) * 6 * wane
          }

          root.position.set(base.x + ox, base.y + oy)

          const act = actionMap.get(agent.id)
          const hk = haloFromAction(act)
          const prev = prevHaloKind.get(agent.id) ?? "none"
          if (hk !== prev) {
            haloTransition.set(agent.id, { from: prev, to: hk, start: now })
            prevHaloKind.set(agent.id, hk)
          }
          let haloAlpha = 1
          const tr = haloTransition.get(agent.id)
          if (tr && now - tr.start < 300) {
            const u = (now - tr.start) / 300
            haloAlpha = u
          }

          const rBody = agentRadius(agent.state.resource)
          halo.clear()

          if (agent.state.alive && hk !== "none") {
            const pulse =
              hk === "defend"
                ? 1 + Math.sin(t * 6) * 0.06
                : hk === "wait"
                  ? 1 + Math.sin(t * 2.2) * 0.08
                  : 1 - Math.sin(t * 5) * 0.06
            const baseR = rBody + 14
            const haloR = baseR * pulse
            let hc = 0x3498db
            if (hk === "wait") hc = 0x2ecc71
            if (hk === "gather") hc = 0xf4d03f
            halo.circle(0, 0, haloR)
            halo.stroke({
              width: hk === "gather" ? 5 : 4,
              color: hc,
              alpha: 0.55 * haloAlpha,
            })
          }

          body.clear()
          if (!agent.state.alive) {
            body.circle(0, 0, rBody)
            body.fill({ color: 0x777777, alpha: 0.85 })
            halo.clear()
          } else {
            let alpha = 1
            const fu = flashUntil.get(agent.id)
            if (fu && now < fu) {
              alpha = 0.35 + Math.abs(Math.sin(now * 0.02)) * 0.65
            }
            if (agent.state.resource <= 0) {
              alpha *= 0.3 + Math.abs(Math.sin(now * 0.012)) * 0.7
            }
            body.circle(0, 0, rBody)
            body.fill({ color, alpha })
            body.stroke({ width: 2, color: 0xffffff, alpha: 0.12 * alpha })
          }
        })

        for (const id of agentGfx.keys()) {
          if (!idsUsed.has(id)) {
            agentGfx.get(id)!.root.visible = false
          }
        }

        deathFx.splice(0, deathFx.length, ...deathFx.filter((d) => d.until > now))
        burstFx.splice(0, burstFx.length, ...burstFx.filter((d) => d.until > now))

        fxParticles.removeChildren()
        for (const d of deathFx) {
          const elapsed = 1 - (d.until - now) / 900
          const label = new Text({
            text: "×",
            style: boomStyle,
          })
          label.anchor.set(0.5)
          label.alpha = 1 - elapsed
          label.scale.set(1 + elapsed * 2)
          label.position.set(d.x, d.y - elapsed * 40)
          fxParticles.addChild(label)
        }
        for (const b of burstFx) {
          const elapsed = 1 - (b.until - now) / 750
          const ring = new Graphics()
          ring.circle(b.x, b.y, 20 + elapsed * 90)
          ring.stroke({
            width: 4,
            color: 0xff9933,
            alpha: (1 - elapsed) * 0.85,
          })
          fxParticles.addChild(ring)
          for (let i = 0; i < 7; i++) {
            const ang = (i / 7) * Math.PI * 2 + elapsed * 3
            const spark = new Graphics()
            const dist = elapsed * 110
            spark.circle(
              b.x + Math.cos(ang) * dist,
              b.y + Math.sin(ang) * dist,
              4 * (1 - elapsed),
            )
            spark.fill({ color: 0xffdd88, alpha: (1 - elapsed) * 0.9 })
            fxParticles.addChild(spark)
          }
        }
      })

      return () => {
        resizeObs.disconnect()
      }
    }

    let resizeCleanup: (() => void) | undefined

    init().then((fn) => {
      resizeCleanup = fn
    })

    return () => {
      destroyed = true
      unsubStore()
      resizeCleanup?.()
      destroyApp()
    }
  }, [])

  return (
    <div
      ref={containerRef}
      className="h-full w-full min-h-[400px] bg-[#121212]"
    />
  )
}
