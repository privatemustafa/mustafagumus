import { useEffect, useRef, useState } from 'react'

/**
 * Minimal, Apple-like custom cursor for the Motion page.
 * A small circle containing left/right arrows that trails the mouse and
 * emphasizes the relevant arrow while scrubbing horizontally.
 * Renders only on fine-pointer (desktop) devices.
 */
export function MotionCursor() {
  const [enabled, setEnabled] = useState(false)
  const dotRef = useRef<HTMLDivElement>(null)
  const leftRef = useRef<HTMLSpanElement>(null)
  const rightRef = useRef<HTMLSpanElement>(null)

  // Gate on fine pointer (desktop). Keep it reactive in case the pointer type changes.
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(pointer: fine)')
    const apply = () => setEnabled(mq.matches)
    apply()
    mq.addEventListener?.('change', apply)
    return () => mq.removeEventListener?.('change', apply)
  }, [])

  useEffect(() => {
    if (!enabled) return

    // Hide the native cursor everywhere on the motion screen.
    const prevCursor = document.body.style.cursor
    document.body.style.cursor = 'none'

    const target = { x: window.innerWidth / 2, y: window.innerHeight / 2 }
    const pos = { x: target.x, y: target.y }
    let pressed = false
    // -1 = left emphasis, 1 = right emphasis, 0 = idle. Decays back to 0.
    let dir = 0
    let lastX = target.x
    let lastMoveTs = 0
    let raf = 0
    let visible = false

    const onMove = (e: MouseEvent) => {
      target.x = e.clientX
      target.y = e.clientY
      const dx = e.clientX - lastX
      if (Math.abs(dx) > 0.5) {
        dir = dx > 0 ? 1 : -1
        lastMoveTs = performance.now()
      }
      lastX = e.clientX
      if (!visible && dotRef.current) {
        visible = true
        dotRef.current.style.opacity = '1'
      }
    }

    const onDown = () => {
      pressed = true
    }
    const onUp = () => {
      pressed = false
    }
    const onWheel = (e: WheelEvent) => {
      const d = Math.abs(e.deltaX) > Math.abs(e.deltaY) ? e.deltaX : e.deltaY
      if (Math.abs(d) > 0.5) {
        dir = d > 0 ? 1 : -1
        lastMoveTs = performance.now()
      }
    }
    const onLeave = () => {
      visible = false
      if (dotRef.current) dotRef.current.style.opacity = '0'
    }
    const onEnter = () => {
      visible = true
      if (dotRef.current) dotRef.current.style.opacity = '1'
    }

    const tick = () => {
      // Smooth trailing follow.
      pos.x += (target.x - pos.x) * 0.18
      pos.y += (target.y - pos.y) * 0.18

      const scale = pressed ? 0.9 : 1
      if (dotRef.current) {
        dotRef.current.style.transform = `translate3d(${pos.x}px, ${pos.y}px, 0) translate(-50%, -50%) scale(${scale})`
      }

      // Decay emphasis back to idle ~140ms after the last horizontal motion.
      const active = performance.now() - lastMoveTs < 140
      const restLeft = active && dir < 0 ? 0.9 : 0.32
      const restRight = active && dir > 0 ? 0.9 : 0.32
      if (leftRef.current) leftRef.current.style.opacity = String(restLeft)
      if (rightRef.current) rightRef.current.style.opacity = String(restRight)

      raf = requestAnimationFrame(tick)
    }

    window.addEventListener('mousemove', onMove, { passive: true })
    window.addEventListener('mousedown', onDown, { passive: true })
    window.addEventListener('mouseup', onUp, { passive: true })
    window.addEventListener('wheel', onWheel, { passive: true })
    document.addEventListener('mouseleave', onLeave)
    document.addEventListener('mouseenter', onEnter)
    raf = requestAnimationFrame(tick)

    return () => {
      cancelAnimationFrame(raf)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mousedown', onDown)
      window.removeEventListener('mouseup', onUp)
      window.removeEventListener('wheel', onWheel)
      document.removeEventListener('mouseleave', onLeave)
      document.removeEventListener('mouseenter', onEnter)
      document.body.style.cursor = prevCursor
    }
  }, [enabled])

  if (!enabled) return null

  return (
    <div
      ref={dotRef}
      aria-hidden
      style={{
        position: 'fixed',
        left: 0,
        top: 0,
        width: 42,
        height: 42,
        borderRadius: '9999px',
        border: '1px solid rgba(255,255,255,0.35)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        pointerEvents: 'none',
        zIndex: 2500,
        opacity: 0,
        willChange: 'transform, opacity',
        transition: 'opacity 200ms ease, transform 60ms linear',
        backdropFilter: 'blur(1px)',
      }}
    >
      <span
        ref={leftRef}
        style={{
          color: '#fff',
          opacity: 0.32,
          fontSize: 12,
          lineHeight: 1,
          fontWeight: 300,
          transition: 'opacity 140ms ease',
        }}
      >
        ←
      </span>
      <span
        ref={rightRef}
        style={{
          color: '#fff',
          opacity: 0.32,
          fontSize: 12,
          lineHeight: 1,
          fontWeight: 300,
          transition: 'opacity 140ms ease',
        }}
      >
        →
      </span>
    </div>
  )
}
