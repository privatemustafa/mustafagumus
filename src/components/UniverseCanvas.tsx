import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { VideoPlayer } from '../lib/VideoPlayer'

export interface UniverseMedia {
  id: number
  src: string
  type?: 'image' | 'video'
  videoSrc?: string
}

/** @deprecated use UniverseMedia */
export type UniverseImage = UniverseMedia

interface UniverseCanvasProps {
  media: UniverseMedia[]
}

const SPACING = 8
const DEPTH_LAYERS = 100
const MAX_PER_LAYER = 2
const SCROLL_SENSITIVITY = 0.006
const DRAG_SENSITIVITY = 0.013
const FRICTION = 0.94
const VISIBLE_RANGE = 150
const LOAD_RANGE = 55
const VIDEO_PLAY_RANGE = 75
const PARALLAX_X = 3.4
const PARALLAX_Y = 2.2
const PARALLAX_LERP = 0.06
const BASE_CAMERA_Z = 12
const SPAWN_Z = -28
const NEAR_DEPTH = 11
const FAR_DEPTH = 95
const NEAR_SCALE = 1.28
const FAR_SCALE = 0.09
const BW_RATIO = 0.25

type Scatter = { x: number; y: number; scale: number; zJitter: number }

type MediaMaterial = THREE.MeshBasicMaterial & {
  userData: {
    grayUniform?: { value: number }
    videoPlayer?: VideoPlayer
  }
}

function shuffle<T>(arr: T[]): T[] {
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

type SlotPos = { x: number; y: number; scale: number }

function randomScatter(existing: SlotPos[] = []): Scatter {
  const minGap = 9.5

  for (let attempt = 0; attempt < 16; attempt++) {
    const edge = Math.random() < 0.55 ? 0.9 + Math.random() * 0.8 : 0.35 + Math.random() * 0.55
    const scaleRoll = Math.random()
    let scale = 0.35 + Math.random() * 0.7
    if (scaleRoll < 0.28) scale = 0.14 + Math.random() * 0.22
    if (scaleRoll > 0.85) scale = 0.72 + Math.random() * 0.32

    const scatter: Scatter = {
      x: (Math.random() - 0.5) * 44 * edge,
      y: (Math.random() - 0.5) * 28 * edge,
      scale,
      zJitter: (Math.random() - 0.5) * 1.8,
    }

    const radius = minGap + scale * 3.2
    const overlaps = existing.some((o) => {
      const dx = scatter.x - o.x
      const dy = scatter.y - o.y
      const need = radius + o.scale * 3.2
      return dx * dx + dy * dy < need * need
    })

    if (!overlaps) return scatter
  }

  return {
    x: (Math.random() - 0.5) * 38,
    y: (Math.random() - 0.5) * 24,
    scale: 0.3 + Math.random() * 0.45,
    zJitter: (Math.random() - 0.5) * 1.8,
  }
}

function assignRandomLayout(count: number) {
  const slotCounts = new Uint16Array(DEPTH_LAYERS)
  // Pre-allocate slot positions: max 2 per slot × DEPTH_LAYERS slots
  const slotPos = new Float32Array(DEPTH_LAYERS * MAX_PER_LAYER * 3) // x,y,scale

  const getSlotPositions = (slot: number): SlotPos[] => {
    const base = slot * MAX_PER_LAYER * 3
    const n = slotCounts[slot]
    const result: SlotPos[] = []
    for (let k = 0; k < n; k++) {
      result.push({ x: slotPos[base + k * 3], y: slotPos[base + k * 3 + 1], scale: slotPos[base + k * 3 + 2] })
    }
    return result
  }

  return Array.from({ length: count }, () => {
    // Pick a random slot that isn't full
    let slot = Math.floor(Math.random() * DEPTH_LAYERS)
    if (slotCounts[slot] >= MAX_PER_LAYER) {
      // Find least-occupied slot (simple linear scan — fast at 100 slots)
      let minSlot = 0
      for (let s = 1; s < DEPTH_LAYERS; s++) {
        if (slotCounts[s] < slotCounts[minSlot]) { minSlot = s; if (slotCounts[s] === 0) break }
      }
      slot = minSlot
    }

    const scatter = randomScatter(getSlotPositions(slot))
    const base = slot * MAX_PER_LAYER * 3
    const k = slotCounts[slot]
    slotPos[base + k * 3] = scatter.x
    slotPos[base + k * 3 + 1] = scatter.y
    slotPos[base + k * 3 + 2] = scatter.scale
    slotCounts[slot]++
    return { slot, scatter }
  })
}

function pickGrayscaleSet(count: number): Set<number> {
  const n = Math.max(1, Math.round(count * BW_RATIO))
  return new Set(shuffle([...Array(count).keys()]).slice(0, n))
}

// One shared onBeforeCompile — all materials share the same GL program
function attachGrayscaleShader(mat: MediaMaterial) {
  const grayUniform = { value: 0 }
  mat.userData.grayUniform = grayUniform

  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uGray = grayUniform
    shader.fragmentShader = `uniform float uGray;\n${shader.fragmentShader}`
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <color_fragment>',
      `#include <color_fragment>
       float lum = dot(diffuseColor.rgb, vec3(0.299, 0.587, 0.114));
       lum = clamp(lum * 1.12, 0.0, 1.0);
       diffuseColor.rgb = mix(diffuseColor.rgb, vec3(lum), uGray);`,
    )
  }
  // Constant cache key → all materials reuse the same compiled GL program
  mat.customProgramCacheKey = () => 'universe-media-gray-v1'
}

function mediaDimensions(img: HTMLImageElement | HTMLVideoElement) {
  if (img instanceof HTMLVideoElement) {
    return { w: img.videoWidth || 1, h: img.videoHeight || 1 }
  }
  return { w: img.naturalWidth || img.width || 1, h: img.naturalHeight || img.height || 1 }
}

function planeSizeFromTexture(tex: THREE.Texture, scale: number) {
  const img = tex.image as HTMLImageElement | HTMLVideoElement
  const { w: iw, h: ih } = mediaDimensions(img)
  const aspect = iw / ih
  const maxEdge = 5.4 * Math.max(scale, 0.35)
  if (aspect >= 1) return { w: maxEdge, h: maxEdge / aspect }
  return { w: maxEdge * aspect, h: maxEdge }
}

function setGrayscale(mesh: THREE.Mesh, enabled: boolean) {
  const mat = mesh.material as MediaMaterial
  if (mat.userData.grayUniform) {
    mat.userData.grayUniform.value = enabled ? 1 : 0
  }
}

// Placeholder mesh shown while texture loads
function createPlaceholder(scatter: Scatter, slot: number): THREE.Mesh {
  const scale = scatter.scale
  const size = 5.4 * Math.max(scale, 0.35)
  const mat = new THREE.MeshBasicMaterial({
    color: 0x111111,
    transparent: true,
    opacity: 0,
  })
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(size * 0.85, size), mat)
  mesh.userData.slot = slot
  mesh.userData.scatter = scatter
  mesh.userData.isPlaceholder = true
  return mesh
}

export function UniverseCanvas({ media }: UniverseCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null)
  const stateRef = useRef({
    travel: 0,
    velocity: 0,
    mouseX: 0,
    mouseY: 0,
    camX: 0,
    camY: 0,
  })

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    stateRef.current.velocity += e.deltaY * SCROLL_SENSITIVITY
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container || media.length === 0) return

    const width = container.clientWidth
    const height = container.clientHeight
    const count = media.length
    const trackLength = DEPTH_LAYERS * SPACING

    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x000000)
    scene.fog = new THREE.FogExp2(0x000000, 0.008)

    const camera = new THREE.PerspectiveCamera(58, width / height, 0.1, 300)
    camera.position.set(0, 0, BASE_CAMERA_Z)

    const renderer = new THREE.WebGLRenderer({
      antialias: false,  // off for perf; grain overlay hides any aliasing
      powerPreference: 'high-performance',
      alpha: false,
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const loader = new THREE.TextureLoader()
    const meshes: THREE.Mesh[] = []
    const loadState = new Map<number, 'pending' | 'loading' | 'loaded'>()
    const videoPlayers: VideoPlayer[] = []

    let layouts = assignRandomLayout(count)
    let grayscaleSet = pickGrayscaleSet(count)

    let reshufflePending = false
    const reshuffleAll = () => {
      if (reshufflePending) return
      reshufflePending = true
      // Defer heavy layout work off the render frame
      const doReshuffle = () => {
        layouts = assignRandomLayout(count)
        grayscaleSet = pickGrayscaleSet(count)
        meshes.forEach((mesh, i) => {
          mesh.userData.slot = layouts[i].slot
          mesh.userData.scatter = layouts[i].scatter
          setGrayscale(mesh, grayscaleSet.has(i))
        })
        reshufflePending = false
      }
      if (typeof requestIdleCallback !== 'undefined') {
        requestIdleCallback(doReshuffle, { timeout: 200 })
      } else {
        setTimeout(doReshuffle, 0)
      }
    }

    // Create placeholder meshes for all items immediately (no texture load yet)
    media.forEach((_, i) => {
      const scatter = layouts[i].scatter
      const slot = layouts[i].slot
      const mesh = createPlaceholder(scatter, slot)
      scene.add(mesh)
      meshes.push(mesh)
      loadState.set(i, 'pending')
    })

    const tryPlayVideos = () => {
      videoPlayers.forEach((player) => player.play())
    }

    const applyTexture = (
      i: number,
      texture: THREE.Texture,
      scatter: Scatter,
      slot: number,
      videoPlayer?: VideoPlayer,
    ) => {
      texture.colorSpace = THREE.SRGBColorSpace
      texture.minFilter = THREE.LinearFilter
      texture.magFilter = THREE.LinearFilter
      texture.generateMipmaps = false

      const { w, h } = planeSizeFromTexture(texture, scatter.scale)
      const mat = new THREE.MeshBasicMaterial({
        map: texture,
        transparent: true,
        side: THREE.FrontSide,
        depthWrite: false,
      }) as MediaMaterial
      attachGrayscaleShader(mat)
      if (videoPlayer) {
        mat.userData.videoPlayer = videoPlayer
        videoPlayers.push(videoPlayer)
      }

      const mesh = meshes[i]
      mesh.geometry.dispose()
      ;(mesh.material as THREE.MeshBasicMaterial).dispose()
      mesh.geometry = new THREE.PlaneGeometry(w, h)
      mesh.material = mat
      mesh.userData.isPlaceholder = false
      mesh.userData.isVideo = !!videoPlayer
      setGrayscale(mesh, grayscaleSet.has(i))
      mesh.userData.slot = slot
      mesh.userData.scatter = scatter
      loadState.set(i, 'loaded')
    }

    const loadTexture = (i: number) => {
      if (loadState.get(i) !== 'pending') return
      loadState.set(i, 'loading')

      const item = media[i]
      const scatter = layouts[i].scatter
      const slot = layouts[i].slot

      if (item.type === 'video' && item.videoSrc) {
        const player = new VideoPlayer(item.videoSrc)
        player
          .load()
          .then(() => {
            applyTexture(i, player.texture, scatter, slot, player)
            player.play()
          })
          .catch(() => {
            // Video yoksa poster görseline düş
            loader.load(item.src, (texture) => applyTexture(i, texture, scatter, slot))
          })
        return
      }

      loader.load(item.src, (texture) => applyTexture(i, texture, scatter, slot))
    }

    const videoFirst = media
      .map((m, i) => ({ i, video: m.type === 'video' }))
      .sort((a, b) => Number(b.video) - Number(a.video))
      .map((x) => x.i)

    const EAGER = Math.min(20, count)
    for (let e = 0; e < EAGER; e++) loadTexture(videoFirst[e])

    let loadQueue = videoFirst.slice(EAGER)
    let loadCursor = 0
    const BATCH = 8
    const BATCH_INTERVAL = 120 // ms

    const batchTimer = setInterval(() => {
      const end = Math.min(loadCursor + BATCH, loadQueue.length)
      for (let b = loadCursor; b < end; b++) loadTexture(loadQueue[b])
      loadCursor = end
      if (loadCursor >= loadQueue.length) clearInterval(batchTimer)
    }, BATCH_INTERVAL)

    document.addEventListener('pointerdown', tryPlayVideos, { once: true })

    let animId = 0
    const animate = () => {
      animId = requestAnimationFrame(animate)
      const st = stateRef.current

      st.velocity *= FRICTION
      st.travel += st.velocity

      if (st.travel >= trackLength) {
        st.travel -= trackLength
        reshuffleAll()
      } else if (st.travel < 0) {
        st.travel += trackLength
        reshuffleAll()
      }

      st.camX += (st.mouseX * PARALLAX_X - st.camX) * PARALLAX_LERP
      st.camY += (st.mouseY * PARALLAX_Y - st.camY) * PARALLAX_LERP
      camera.position.set(st.camX, st.camY, BASE_CAMERA_Z)

      meshes.forEach((mesh, i) => {
        const slot = mesh.userData.slot as number
        const sc = mesh.userData.scatter as Scatter

        let z = SPAWN_Z - slot * SPACING + st.travel + sc.zJitter
        while (z > 12) z -= trackLength
        while (z < -VISIBLE_RANGE) z += trackLength

        mesh.position.set(sc.x, sc.y, z)

        const viewDepth = BASE_CAMERA_Z - z
        const depthT = THREE.MathUtils.clamp(
          (viewDepth - NEAR_DEPTH) / (FAR_DEPTH - NEAR_DEPTH),
          0,
          1,
        )
        const depthScale = THREE.MathUtils.lerp(NEAR_SCALE, FAR_SCALE, Math.pow(depthT, 0.72))
        mesh.scale.set(depthScale, depthScale, 1)

        const dist = Math.abs(z)
        const alpha = THREE.MathUtils.clamp(1.25 - dist / 58, 0.1, 1)
        const mat = mesh.material as THREE.MeshBasicMaterial

        if (mesh.userData.isPlaceholder) {
          mat.opacity = 0
          if (dist < LOAD_RANGE && loadState.get(i) === 'pending') loadTexture(i)
          return
        }

        mat.opacity = alpha

        const player = (mat as MediaMaterial).userData.videoPlayer
        if (player) {
          player.setActive(dist < VIDEO_PLAY_RANGE && alpha > 0.12)
        }
      })

      renderer.render(scene, camera)
    }

    animate()

    const onResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }

    const onMouseMove = (e: MouseEvent) => {
      const rect = container.getBoundingClientRect()
      stateRef.current.mouseX = THREE.MathUtils.clamp(
        ((e.clientX - rect.left) / rect.width) * 2 - 1, -1, 1,
      )
      stateRef.current.mouseY = THREE.MathUtils.clamp(
        -(((e.clientY - rect.top) / rect.height) * 2 - 1), -1, 1,
      )
    }

    const onMouseLeave = () => {
      stateRef.current.mouseX = 0
      stateRef.current.mouseY = 0
    }

    window.addEventListener('resize', onResize)
    container.addEventListener('wheel', handleWheel, { passive: false })
    container.addEventListener('mousemove', onMouseMove)
    container.addEventListener('mouseleave', onMouseLeave)

    const canvas = renderer.domElement
    canvas.style.cursor = 'grab'
    let dragging = false
    let lastY = 0

    const onPointerDown = (e: PointerEvent) => {
      dragging = true
      lastY = e.clientY
      canvas.style.cursor = 'grabbing'
      canvas.setPointerCapture(e.pointerId)
      tryPlayVideos()
    }
    const onPointerMove = (e: PointerEvent) => {
      if (!dragging) return
      stateRef.current.velocity += (e.clientY - lastY) * DRAG_SENSITIVITY
      lastY = e.clientY
    }
    const onPointerUp = () => {
      dragging = false
      canvas.style.cursor = 'grab'
    }

    canvas.addEventListener('pointerdown', onPointerDown)
    canvas.addEventListener('pointermove', onPointerMove)
    canvas.addEventListener('pointerup', onPointerUp)
    canvas.addEventListener('pointercancel', onPointerUp)

    return () => {
      clearInterval(batchTimer)
      cancelAnimationFrame(animId)
      document.removeEventListener('pointerdown', tryPlayVideos)
      window.removeEventListener('resize', onResize)
      container.removeEventListener('wheel', handleWheel)
      container.removeEventListener('mousemove', onMouseMove)
      container.removeEventListener('mouseleave', onMouseLeave)
      canvas.removeEventListener('pointerdown', onPointerDown)
      canvas.removeEventListener('pointermove', onPointerMove)
      canvas.removeEventListener('pointerup', onPointerUp)
      renderer.dispose()
      if (container.contains(canvas)) container.removeChild(canvas)
      videoPlayers.forEach((p) => p.dispose())
      meshes.forEach((mesh) => {
        mesh.geometry.dispose()
        const mat = mesh.material as THREE.MeshBasicMaterial
        mat.map?.dispose()
        mat.dispose()
      })
    }
  }, [media, handleWheel])

  return (
    <div
      ref={containerRef}
      className="fixed inset-0 w-full h-full touch-none"
      style={{ zIndex: 'var(--z-canvas)' }}
    />
  )
}
