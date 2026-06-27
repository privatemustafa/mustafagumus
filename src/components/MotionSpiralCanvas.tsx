import { useEffect, useRef } from 'react'
import * as THREE from 'three'
import type { MotionEntry } from '../data/motion'
import { VideoPlayer } from '../lib/VideoPlayer'
import { getDeviceCapabilities } from '../lib/deviceCapabilities'

type MotionSpiralCanvasProps = {
  items: MotionEntry[]
  /** 0 → 1 scroll progress from parent (Lenis or native) */
  scrollProgress: number
}

const HELIX_RADIUS = 6.8
const HELIX_Y_STEP = 5
const HELIX_TURNS = 2.2

type Slot = {
  mesh: THREE.Mesh
  mat: THREE.MeshBasicMaterial
  videoPlayer?: VideoPlayer
  loadState: 'idle' | 'loading' | 'ready'
}

export function MotionSpiralCanvas({ items, scrollProgress }: MotionSpiralCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const progressRef = useRef(scrollProgress)
  progressRef.current = scrollProgress

  useEffect(() => {
    const container = containerRef.current
    if (!container || items.length === 0) return

    const caps = getDeviceCapabilities()
    const count = items.length

    const scene = new THREE.Scene()
    scene.background = null
    scene.fog = new THREE.FogExp2(0x000000, 0.014)

    const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 180)
    camera.position.set(0, 0, 13)

    const renderer = new THREE.WebGLRenderer({
      antialias: false,
      alpha: true,
      powerPreference: 'high-performance',
    })
    renderer.setClearColor(0x000000, 1)
    container.appendChild(renderer.domElement)

    const helix = new THREE.Group()
    scene.add(helix)

    const loader = new THREE.TextureLoader()
    const slots: Slot[] = []

    const helixAngle = (i: number) => (i / Math.max(1, count - 1)) * Math.PI * 2 * HELIX_TURNS
    const helixY = (i: number) => -i * HELIX_Y_STEP

    items.forEach((item, i) => {
      const mat = new THREE.MeshBasicMaterial({
        transparent: true,
        opacity: 0.85,
        side: THREE.DoubleSide,
        color: 0x222222,
      })
      const mesh = new THREE.Mesh(new THREE.PlaneGeometry(3.6, 2.0), mat)
      const angle = helixAngle(i)
      mesh.position.set(Math.cos(angle) * HELIX_RADIUS, helixY(i), Math.sin(angle) * HELIX_RADIUS)
      helix.add(mesh)
      slots.push({ mesh, mat, loadState: 'idle' })

      loader.load(
        item.poster || item.src,
        (tex) => {
          tex.colorSpace = THREE.SRGBColorSpace
          const img = tex.image as HTMLImageElement
          const aspect = img?.width && img?.height ? img.width / img.height : 16 / 9
          const h = 2.8
          mesh.geometry.dispose()
          mesh.geometry = new THREE.PlaneGeometry(h * aspect, h)
          mat.map = tex
          mat.color.set(0xffffff)
          mat.needsUpdate = true
        },
        undefined,
        () => {},
      )
    })

    const loadVideo = (i: number) => {
      const slot = slots[i]
      if (!slot || slot.loadState !== 'idle') return
      slot.loadState = 'loading'
      const player = new VideoPlayer(items[i].src, 'metadata')
      player
        .load()
        .then(() => {
          if (slot.loadState !== 'loading') {
            player.dispose()
            return
          }
          slot.videoPlayer = player
          if (slot.mat.map && slot.mat.map !== player.texture) slot.mat.map.dispose()
          slot.mat.map = player.texture
          slot.mat.needsUpdate = true
          slot.loadState = 'ready'
        })
        .catch(() => {
          slot.loadState = 'idle'
        })
    }

    loadVideo(0)

    let animId = 0
    let running = true
    const worldPos = new THREE.Vector3()

    const resize = () => {
      const w = container.clientWidth || window.innerWidth
      const h = container.clientHeight || window.innerHeight
      renderer.setSize(w, h)
      renderer.setPixelRatio(Math.min(window.devicePixelRatio, caps.pixelRatio))
      camera.aspect = w / h
      camera.updateProjectionMatrix()
    }
    resize()
    window.addEventListener('resize', resize)

    const animate = () => {
      animId = requestAnimationFrame(animate)
      if (!running) return

      const progress = progressRef.current
      const floatIndex = progress * Math.max(0, count - 1)
      const active = Math.round(floatIndex)

      if (slots[active]?.loadState === 'idle') loadVideo(active)
      if (active > 0 && slots[active - 1]?.loadState === 'idle') loadVideo(active - 1)
      if (active < count - 1 && slots[active + 1]?.loadState === 'idle') loadVideo(active + 1)

      helix.rotation.y = progress * Math.PI * 2 * HELIX_TURNS
      helix.position.y = progress * (count - 1) * HELIX_Y_STEP * 0.9

      slots.forEach((slot, i) => {
        const angle = helixAngle(i)
        slot.mesh.position.set(
          Math.cos(angle) * HELIX_RADIUS,
          helixY(i),
          Math.sin(angle) * HELIX_RADIUS,
        )
        slot.mesh.lookAt(camera.position)

        const focus = Math.abs(i - floatIndex)
        const scale = THREE.MathUtils.lerp(1.05, 0.5, Math.min(1, focus * 0.85))
        slot.mesh.scale.setScalar(scale)
        slot.mat.opacity = THREE.MathUtils.clamp(1.1 - focus * 0.45, 0.15, 1)

        slot.mesh.getWorldPosition(worldPos)
        const near = worldPos.distanceTo(camera.position) < 18
        if (slot.videoPlayer) {
          const play = focus < 0.65 && near
          slot.videoPlayer.setActive(play)
          if (play) slot.videoPlayer.play()
        }
      })

      renderer.render(scene, camera)
    }
    animate()

    const unlock = () => slots.forEach((s) => s.videoPlayer?.play())
    document.addEventListener('pointerdown', unlock, { once: true })

    return () => {
      running = false
      cancelAnimationFrame(animId)
      window.removeEventListener('resize', resize)
      document.removeEventListener('pointerdown', unlock)
      slots.forEach((s) => {
        s.videoPlayer?.dispose()
        s.mat.map?.dispose()
        s.mat.dispose()
        s.mesh.geometry.dispose()
      })
      renderer.dispose()
      container.removeChild(renderer.domElement)
    }
  }, [items])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full"
      style={{ zIndex: 0, pointerEvents: 'none' }}
    />
  )
}

export const MOTION_SECTION_VH = 100

export function motionPageHeight(itemCount: number): number {
  return Math.max(1, itemCount) * MOTION_SECTION_VH
}
