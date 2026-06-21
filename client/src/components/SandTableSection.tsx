import { useEffect, useRef } from "react"
import {
  Application,
  Container,
  Graphics,
  Point,
  Rectangle,
  Text,
  TextStyle,
} from "pixi.js"
import { Viewport } from "pixi-viewport"
import type { Action } from "../../../shared/types/Action"
import type { Agent } from "../../../shared/types/AgentType"
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

/** 与 DataShowSection 一致的低饱和未来感色板 */
const AGENT_PALETTE = [
  0xf472b6, 0x38bdf8, 0x34d399, 0xa78bfa, 0xfbbf24, 0x2dd4bf, 0xfb923c,
]

const COLOR_HALO_DEFEND = 0x818cf8
const COLOR_HALO_WAIT = 0x34d399
const COLOR_HALO_GATHER = 0xfbbf24

type StarSpec = {
  x: number
  y: number
  r: number
  color: number
  alpha: number
  twinkleSpeed: number
  twinklePhase: number
}

function seededRandom(seed: number) {
  let s = seed % 2147483646
  if (s <= 0) s += 2147483645
  return () => {
    s = (s * 16807) % 2147483647
    return (s - 1) / 2147483646
  }
}

function generateStars(count: number, seed: number): StarSpec[] {
  const rand = seededRandom(seed)
  const stars: StarSpec[] = []
  for (let i = 0; i < count; i++) {
    const bright = rand() > 0.93
    stars.push({
      x: rand() * WORLD_W,
      y: rand() * WORLD_H,
      r: bright ? 1.1 + rand() * 1.4 : 0.35 + rand() * 0.85,
      color:
        rand() < 0.72
          ? 0xffffff
          : rand() < 0.55
            ? 0xc4d4ff
            : 0xfff0d4,
      alpha: bright ? 0.65 + rand() * 0.35 : 0.12 + rand() * 0.55,
      twinkleSpeed: 0.4 + rand() * 1.8,
      twinklePhase: rand() * Math.PI * 2,
    })
  }
  return stars
}

/** 银河带状星尘：沿对角线分布的密集星点 */
function generateGalaxyBandStars(count: number, seed: number): StarSpec[] {
  const rand = seededRandom(seed)
  const stars: StarSpec[] = []
  const bandAngle = Math.PI * 0.28
  const cos = Math.cos(bandAngle)
  const sin = Math.sin(bandAngle)
  for (let i = 0; i < count; i++) {
    const along = (rand() - 0.5) * WORLD_W * 1.35
    const perp = (rand() - 0.5) * 140 * (0.3 + rand() * 0.7)
    stars.push({
      x: WORLD_CX + along * cos - perp * sin,
      y: WORLD_CY + along * sin + perp * cos,
      r: 0.25 + rand() * 0.65,
      color: rand() < 0.6 ? 0xe0e7ff : 0xf5d0fe,
      alpha: 0.08 + rand() * 0.35,
      twinkleSpeed: 0.2 + rand() * 0.9,
      twinklePhase: rand() * Math.PI * 2,
    })
  }
  return stars
}

function drawStars(g: Graphics, stars: StarSpec[], t: number) {
  for (const s of stars) {
    const twinkle = 0.5 + 0.5 * Math.sin(t * s.twinkleSpeed + s.twinklePhase)
    const a = s.alpha * twinkle
    g.circle(s.x, s.y, s.r)
    g.fill({ color: s.color, alpha: a })
    if (s.r > 1 && twinkle > 0.75) {
      g.circle(s.x, s.y, s.r * 2.8)
      g.fill({ color: s.color, alpha: a * 0.12 })
    }
  }
}

function drawWorldBoundary(g: Graphics) {
  g.rect(0, 0, WORLD_W, WORLD_H)
  g.stroke({ width: 1, color: 0xffffff, alpha: 0.1 })
  g.rect(-3, -3, WORLD_W + 6, WORLD_H + 6)
  g.stroke({ width: 1, color: 0x818cf8, alpha: 0.06 })
}

function drawResourcePool(g: Graphics, poolR: number, t: number) {
  const breath = 0.94 + Math.sin(t * 1.6) * 0.06
  const r = poolR * breath
  const layers = [
    { scale: 1.38, alpha: 0.04, color: 0x818cf8 },
    { scale: 1.22, alpha: 0.07, color: 0x6366f1 },
    { scale: 1.08, alpha: 0.1, color: 0xfbbf24 },
  ]
  for (const layer of layers) {
    g.circle(WORLD_CX, WORLD_CY, r * layer.scale)
    g.fill({ color: layer.color, alpha: layer.alpha * breath })
  }
  g.circle(WORLD_CX, WORLD_CY, r)
  g.fill({ color: 0xfbbf24, alpha: 0.22 + Math.sin(t * 2.1) * 0.06 })
  g.circle(WORLD_CX, WORLD_CY, r * 0.42)
  g.fill({ color: 0x818cf8, alpha: 0.38 + Math.sin(t * 2.5 + 1) * 0.08 })
  g.circle(WORLD_CX, WORLD_CY, r)
  g.stroke({ width: 1, color: 0xe0e7ff, alpha: 0.18 })
}

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
      const rw = Math.max(50, host.clientWidth || 800)
      const rh = Math.max(50, host.clientHeight || 600)
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
        screenWidth: rw,
        screenHeight: rh,
        worldWidth: WORLD_W,
        worldHeight: WORLD_H,
        events: app.renderer.events,
        ticker: app.ticker,
        allowPreserveDragOutside: true,
      })

      viewport.sortableChildren = true
      app.stage.addChild(viewport)

      // 缩放/捏合；留白区平移走 DOM 手势（无 drag/decelerate 惯性）
      viewport.pinch().wheel({ percent: 1.15 })
      viewport.clampZoom({ minScale: 0.15, maxScale: 4 })
      viewport.clamp({
        direction: "all",
        left: true,
        right: true,
        top: true,
        bottom: true,
        underflow: "none",
      })
      // 平移边界由 applyViewportBounds 手动处理，避免 clamp 插件把视口弹回居中
      viewport.plugins.pause("clamp")
      viewport.fitWorld(true)
      viewport.moveCenter(WORLD_CX, WORLD_CY)

      /** 扩展命中区域到整块画布，否则留白区无法接收 pointer 事件 */
      const syncFullScreenHitArea = () => {
        const rect = host.getBoundingClientRect()
        const tl = new Point()
        const br = new Point()
        app.renderer.events.mapPositionToPoint(tl, rect.left, rect.top)
        app.renderer.events.mapPositionToPoint(br, rect.right, rect.bottom)
        const wtl = viewport.toWorld(tl)
        const wbr = viewport.toWorld(br)
        viewport.forceHitArea = new Rectangle(
          Math.min(wtl.x, wbr.x),
          Math.min(wtl.y, wbr.y),
          Math.abs(wbr.x - wtl.x),
          Math.abs(wbr.y - wtl.y),
        )
      }
      syncFullScreenHitArea()

      /** 世界框在屏幕(client)坐标下的矩形 */
      const getWorldClientRect = () => {
        const tl = viewport.toScreen(new Point(0, 0))
        const br = viewport.toScreen(new Point(WORLD_W, WORLD_H))
        return {
          minX: Math.min(tl.x, br.x),
          maxX: Math.max(tl.x, br.x),
          minY: Math.min(tl.y, br.y),
          maxY: Math.max(tl.y, br.y),
        }
      }

      /** 是否在世界框外的留白区（使用 client 坐标，与 toScreen 一致） */
      const isLetterboxAt = (clientX: number, clientY: number) => {
        const r = getWorldClientRect()
        return (
          clientX < r.minX ||
          clientX > r.maxX ||
          clientY < r.minY ||
          clientY > r.maxY
        )
      }

      let letterboxPanActive = false
      let clampPausedForPan = false
      let lastClientX = 0
      let lastClientY = 0

      /** 手动边界：世界小于屏幕时用像素偏移范围；放大后用世界边界 */
      const applyViewportBounds = () => {
        const maxOffsetX = Math.max(
          0,
          viewport.screenWidth - viewport.screenWorldWidth,
        )
        const maxOffsetY = Math.max(
          0,
          viewport.screenHeight - viewport.screenWorldHeight,
        )

        if (maxOffsetX > 0 || maxOffsetY > 0) {
          viewport.x = Math.min(maxOffsetX, Math.max(0, viewport.x))
          viewport.y = Math.min(maxOffsetY, Math.max(0, viewport.y))
        } else {
          if (viewport.left < 0) viewport.x = 0
          else if (viewport.right > viewport.worldWidth) {
            viewport.x =
              -viewport.worldWidth * viewport.scale.x + viewport.screenWidth
          }
          if (viewport.top < 0) viewport.y = 0
          else if (viewport.bottom > viewport.worldHeight) {
            viewport.y =
              -viewport.worldHeight * viewport.scale.y + viewport.screenHeight
          }
        }
        viewport.dirty = true
      }

      const stopLetterboxPan = () => {
        letterboxPanActive = false
        window.removeEventListener("pointermove", onWindowPointerMove)
        window.removeEventListener("pointerup", onWindowPointerUp)
        window.removeEventListener("pointercancel", onWindowPointerUp)
        if (clampPausedForPan) {
          applyViewportBounds()
          clampPausedForPan = false
        }
      }

      const onWindowPointerMove = (ev: PointerEvent) => {
        if (!letterboxPanActive) return
        const dx = ev.clientX - lastClientX
        const dy = ev.clientY - lastClientY
        viewport.x += dx
        viewport.y += dy
        applyViewportBounds()
        lastClientX = ev.clientX
        lastClientY = ev.clientY
      }

      const onWindowPointerUp = () => {
        stopLetterboxPan()
      }

      const onWindowPointerDown = (ev: PointerEvent) => {
        const target = ev.target as Node | null
        const inSandTable =
          target != null &&
          (host === target || host.contains(target) || target === app.canvas)
        if (!inSandTable) return
        if (!isLetterboxAt(ev.clientX, ev.clientY)) return
        ev.preventDefault()
        viewport.plugins.pause("clamp")
        clampPausedForPan = true
        letterboxPanActive = true
        lastClientX = ev.clientX
        lastClientY = ev.clientY
        window.addEventListener("pointermove", onWindowPointerMove)
        window.addEventListener("pointerup", onWindowPointerUp)
        window.addEventListener("pointercancel", onWindowPointerUp)
      }
      applyViewportBounds()

      window.addEventListener("pointerdown", onWindowPointerDown, true)

      viewport.on("moved", (payload: { type?: string }) => {
        if (payload?.type === "wheel" || payload?.type === "pinch") {
          applyViewportBounds()
        }
      })

      const mapLayer = new Container()
      const resourceLayer = new Container()

      const haloLayer = new Container()
      const relationLayer = new Container()
      const agentLayer = new Container()
      const fxLayer = new Container()

        ;[mapLayer, resourceLayer, haloLayer, relationLayer, agentLayer, fxLayer].forEach(
          (c, i) => {
            c.zIndex = i
            c.eventMode = "none"
            c.interactiveChildren = false
          },
        )
      viewport.sortableChildren = true
      viewport.addChild(mapLayer, resourceLayer, haloLayer, relationLayer, agentLayer, fxLayer)

      const mapBg = new Graphics()
      mapBg.rect(0, 0, WORLD_W, WORLD_H)
      mapBg.fill(0x09090b)
      mapLayer.addChild(mapBg)

      const skyStars = generateStars(520, 7919)
      const bandStars = generateGalaxyBandStars(280, 12011)
      const starGfx = new Graphics()
      mapLayer.addChild(starGfx)

      const boundary = new Graphics()
      drawWorldBoundary(boundary)
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
        syncFullScreenHitArea()
      })
      resizeObs.observe(host)

      app.ticker.add(() => {
        const state = useStore.getState()
        const { agents, envRound, envInit, agentActions } = state
        const now = performance.now()
        const t = now / 1000

        syncPositions(agents)

        starGfx.clear()
        drawStars(starGfx, skyStars, t)
        drawStars(starGfx, bandStars, t)

        const refMax = Math.max(envInit.resourceTotal, envRound.currentSource, 1)
        const poolR = poolRadius(envRound.currentSource, refMax)
        poolGfx.clear()
        drawResourcePool(poolGfx, poolR, t)

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
          gatherLineGfx.stroke({ width: 4, color: COLOR_HALO_GATHER, alpha: 0.55 })
          gatherLineGfx.moveTo(mx, my)
          gatherLineGfx.lineTo(x1, y1)
          gatherLineGfx.stroke({ width: 4, color: col, alpha: 0.72 })
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
            color: 0x34d399,
            alpha: 0.28 + Math.sin(coopPhase) * 0.1,
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
          attackGfx.stroke({ width: 2, color: 0xf472b6, alpha: 0.85 })
          const ah = 14
          const aw = 10
          const bx = x2
          const by = y2
          attackGfx.moveTo(bx, by)
          attackGfx.lineTo(bx - ux * ah + (-uy) * aw, by - uy * ah + ux * aw)
          attackGfx.lineTo(bx - ux * ah - (-uy) * aw, by - uy * ah - ux * aw)
          attackGfx.closePath()
          attackGfx.fill({ color: 0xf472b6, alpha: 0.9 })
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
            let hc = COLOR_HALO_DEFEND
            if (hk === "wait") hc = COLOR_HALO_WAIT
            if (hk === "gather") hc = COLOR_HALO_GATHER
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
            body.fill({ color: 0x52525b, alpha: 0.7 })
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
        stopLetterboxPan()
        window.removeEventListener("pointerdown", onWindowPointerDown, true)
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
      className="h-screen w-full overflow-hidden bg-[#09090b]"
      style={{ height: "100dvh" }}
    />
  )
}
