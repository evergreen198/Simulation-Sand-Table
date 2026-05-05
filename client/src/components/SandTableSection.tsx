import { useEffect, useRef } from "react"
import * as PIXI from "pixi.js"

export default function SandTableSection() {
  const containerRef = useRef<HTMLDivElement>(null)
  const appRef = useRef<PIXI.Application | null>(null)

  useEffect(() => {
    let destroyed = false

    const init = async () => {
      const app = new PIXI.Application()
      await app.init({
        width: 900,
        height: 1051,
        backgroundColor: 0x111111,
      })

      if (destroyed) {
        app.destroy({ removeView: true })
        return
      }

      appRef.current = app
      containerRef.current?.appendChild(app.canvas)

      // 创建3个agent
      const agents = [
        { x: 100, y: 100, targetX: 200, targetY: 200, resource: 50 },
        { x: 300, y: 200, targetX: 100, targetY: 300, resource: 80 },
        { x: 200, y: 300, targetX: 400, targetY: 100, resource: 30 },
      ]

      const circles: PIXI.Graphics[] = []

      agents.forEach(agent => {
        const g = new PIXI.Graphics()
        // ✅ v8 绘制 API
        g.circle(0, 0, 10)
        g.fill(0xffffff)

        g.x = agent.x
        g.y = agent.y

        app.stage.addChild(g)
        circles.push(g)
      })

      // 动画循环
      app.ticker.add(() => {
        agents.forEach((agent, i) => {
          agent.x += (agent.targetX - agent.x) * 0.02
          agent.y += (agent.targetY - agent.y) * 0.02

          if (Math.abs(agent.x - agent.targetX) < 1) {
            agent.targetX = Math.random() * 600
            agent.targetY = Math.random() * 400
          }

          agent.resource += (Math.random() - 0.5) * 0.5
          if (agent.resource < 10) agent.resource = 10
          if (agent.resource > 100) agent.resource = 100

          const g = circles[i]
          g.x = agent.x
          g.y = agent.y

          const scale = agent.resource / 50
          g.scale.set(scale)
        })
      })
    }

    init()


    
    return () => {
      destroyed = true
      if (appRef.current) {
        appRef.current.destroy({ removeView: true })
        appRef.current = null
      }
    }
  }, [])

  return <div ref={containerRef} />
}