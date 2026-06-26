import { useEffect, useRef, useCallback } from 'react'
import * as THREE from 'three'
import { VideoPlayer } from '../lib/VideoPlayer'
import { getDeviceCapabilities } from '../lib/deviceCapabilities'

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

function pickGrayscaleSet(imageIndices: number[]): Set<number> {
  const n = Math.max(1, Math.round(imageIndices.length * BW_RATIO))
  return new Set(shuffle(imageIndices).slice(0, n))
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

    const caps = getDeviceCapabilities()
    const VIDEO_LOAD_RANGE = caps.videoLoadRange
    const VIDEO_UNLOAD_RANGE = caps.videoUnloadRange
    const MAX_CONCURRENT_VIDEOS = caps.maxConcurrentVideos
    const VIDEO_PRELOAD: 'auto' | 'metadata' = caps.isMobile ? 'metadata' : 'auto'

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
      // Lets the browser drop the GL context under memory pressure instead of crashing
      failIfMajorPerformanceCaveat: false,
    })
    renderer.setSize(width, height)
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, caps.pixelRatio))
    renderer.outputColorSpace = THREE.SRGBColorSpace
    container.appendChild(renderer.domElement)

    const loader = new THREE.TextureLoader()
    const meshes: THREE.Mesh[] = []
    const loadState = new Map<number, 'pending' | 'loading' | 'loaded'>()
    const videoPlayers = new Map<number, VideoPlayer>()

    const imageIndices = media
      .map((m, i) => (m.type === 'video' ? -1 : i))
      .filter((i) => i >= 0)

    let layouts = assignRandomLayout(count)
    let grayscaleSet = pickGrayscaleSet(imageIndices)

    const reshuffleMesh = (i: number) => {
      const neighbors: SlotPos[] = []
      meshes.forEach((m, j) => {
        if (j === i) return
        const sc = m.userData.scatter as Scatter
        neighbors.push({ x: sc.x, y: sc.y, scale: sc.scale })
      })
      const scatter = randomScatter(neighbors)
      const slot = Math.floor(Math.random() * DEPTH_LAYERS)
      layouts[i] = { slot, scatter }
      const mesh = meshes[i]
      mesh.userData.slot = slot
      mesh.userData.scatter = scatter
      if (!mesh.userData.isVideo) {
        setGrayscale(mesh, Math.random() < BW_RATIO)
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
        videoPlayers.set(i, videoPlayer)
      }

      const mesh = meshes[i]
      mesh.geometry.dispose()
      ;(mesh.material as THREE.MeshBasicMaterial).dispose()
      mesh.geometry = new THREE.PlaneGeometry(w, h)
      mesh.material = mat
      mesh.userData.isPlaceholder = false
      mesh.userData.isVideo = !!videoPlayer
      setGrayscale(mesh, !videoPlayer && grayscaleSet.has(i))
      mesh.userData.slot = slot
      mesh.userData.scatter = scatter
      loadState.set(i, 'loaded')
    }

    // Revert a (video) mesh back to an invisible placeholder so its decoder
    // and texture memory are freed when it scrolls far off-screen.
    const revertToPlaceholder = (i: number) => {
      const mesh = meshes[i]
      const scatter = mesh.userData.scatter as Scatter
      const size = 5.4 * Math.max(scatter.scale, 0.35)
      const mat = mesh.material as MediaMaterial
      mat.map?.dispose()
      mat.dispose()
      mesh.geometry.dispose()
      mesh.geometry = new THREE.PlaneGeometry(size * 0.85, size)
      mesh.material = new THREE.MeshBasicMaterial({
        color: 0x111111,
        transparent: true,
        opacity: 0,
      })
      mesh.userData.isPlaceholder = true
      mesh.userData.isVideo = false
    }

    const unloadVideo = (i: number) => {
      const player = videoPlayers.get(i)
      if (!player) return
      videoPlayers.delete(i)
      player.dispose()
      revertToPlaceholder(i)
      loadState.set(i, 'pending')
    }

    const loadTexture = (i: number) => {
      if (loadState.get(i) !== 'pending') return
      loadState.set(i, 'loading')

      const item = media[i]
      const scatter = layouts[i].scatter
      const slot = layouts[i].slot

      if (item.type === 'video' && item.videoSrc) {
        const player = new VideoPlayer(item.videoSrc, VIDEO_PRELOAD)
        player
          .load()
          .then(() => {
            // Mesh may have scrolled away while the video was buffering.
            if (loadState.get(i) !== 'loading') {
              player.dispose()
              return
            }
            applyTexture(i, player.texture, scatter, slot, player)
          })
          .catch(() => {
            if (loadState.get(i) !== 'loading') return
            // Video yoksa / yüklenmediyse poster görseline düş
            loader.load(
              item.src,
              (texture) => applyTexture(i, texture, scatter, slot),
              undefined,
              () => loadState.set(i, 'pending'),
            )
          })
        return
      }

      loader.load(
        item.src,
        (texture) => applyTexture(i, texture, scatter, slot),
        undefined,
        () => loadState.set(i, 'pending'),
      )
    }

    // Images load progressively in the background; videos load lazily by
    // proximity inside the animation loop so only a few decoders live at once.
    const imageQueue = media
      .map((m, i) => ({ i, video: m.type === 'video' }))
      .filter((x) => !x.video)
      .map((x) => x.i)

    const EAGER = Math.min(16, imageQueue.length)
    for (let e = 0; e < EAGER; e++) loadTexture(imageQueue[e])

    const loadQueue = imageQueue.slice(EAGER)
    let loadCursor = 0
    const BATCH = caps.tier === 'low' ? 4 : 8
    const BATCH_INTERVAL = caps.tier === 'low' ? 200 : 120 // ms

    const batchTimer = setInterval(() => {
      const end = Math.min(loadCursor + BATCH, loadQueue.length)
      for (let b = loadCursor; b < end; b++) loadTexture(loadQueue[b])
      loadCursor = end
      if (loadCursor >= loadQueue.length) clearInterval(batchTimer)
    }, BATCH_INTERVAL)

    document.addEventListener('pointerdown', tryPlayVideos, { once: true })

    let animId = 0
    let running = true
    let contextLost = false

    type VideoCandidate = { i: number; dist: number; player: VideoPlayer }
    const videoCandidates: VideoCandidate[] = []

    const animate = () => {
      animId = requestAnimationFrame(animate)
      if (!running || contextLost) return

      const st = stateRef.current

      st.velocity *= FRICTION
      st.travel += st.velocity

      // Seamless wrap — no global reshuffle (avoids visible loop pop)
      if (st.travel >= trackLength) st.travel -= trackLength
      else if (st.travel < 0) st.travel += trackLength

      st.camX += (st.mouseX * PARALLAX_X - st.camX) * PARALLAX_LERP
      st.camY += (st.mouseY * PARALLAX_Y - st.camY) * PARALLAX_LERP
      camera.position.set(st.camX, st.camY, BASE_CAMERA_Z)

      videoCandidates.length = 0

      meshes.forEach((mesh, i) => {
        const slot = mesh.userData.slot as number
        const sc = mesh.userData.scatter as Scatter
        const isVideoItem = media[i].type === 'video'

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
          const loadRange = isVideoItem ? VIDEO_LOAD_RANGE : LOAD_RANGE
          if (dist < loadRange && loadState.get(i) === 'pending') loadTexture(i)
          return
        }

        mat.opacity = alpha

        // Reshuffle only when far off-screen — invisible, smooth loop handoff
        if (z < -VISIBLE_RANGE + 10 && alpha < 0.05) {
          const cd = (mesh.userData.reshuffleCooldown as number) ?? 0
          if (cd <= 0) {
            reshuffleMesh(i)
            mesh.userData.reshuffleCooldown = 45
          } else {
            mesh.userData.reshuffleCooldown = cd - 1
          }
        }

        const player = (mat as MediaMaterial).userData.videoPlayer
        if (player) {
          // Free the decoder once it scrolls well out of view
          if (dist > VIDEO_UNLOAD_RANGE) {
            unloadVideo(i)
            return
          }
          if (dist < VIDEO_PLAY_RANGE && alpha > 0.12) {
            videoCandidates.push({ i, dist, player })
          } else {
            player.setActive(false)
          }
        }
      })

      // Only let the nearest N videos play — bounds simultaneous decoders so
      // even low-end phones / iOS Safari stay smooth.
      if (videoCandidates.length > MAX_CONCURRENT_VIDEOS) {
        videoCandidates.sort((a, b) => a.dist - b.dist)
      }
      for (let v = 0; v < videoCandidates.length; v++) {
        videoCandidates[v].player.setActive(v < MAX_CONCURRENT_VIDEOS)
      }

      renderer.render(scene, camera)
    }

    animate()

    // Pause the whole loop + all videos when the tab/app is backgrounded.
    const onVisibility = () => {
      const hidden = document.hidden
      running = !hidden
      if (hidden) {
        videoPlayers.forEach((p) => p.setActive(false))
      }
    }
    document.addEventListener('visibilitychange', onVisibility)

    // Recover gracefully if the browser drops the WebGL context (common on
    // mobile under memory pressure) instead of showing a dead black canvas.
    const glCanvas = renderer.domElement
    const onContextLost = (e: Event) => {
      e.preventDefault()
      contextLost = true
      videoPlayers.forEach((p) => p.setActive(false))
    }
    const onContextRestored = () => {
      contextLost = false
    }
    glCanvas.addEventListener('webglcontextlost', onContextLost as EventListener, false)
    glCanvas.addEventListener('webglcontextrestored', onContextRestored as EventListener, false)

    let resizeTimer = 0
    const applyResize = () => {
      const w = container.clientWidth
      const h = container.clientHeight
      if (w === 0 || h === 0) return
      camera.aspect = w / h
      camera.updateProjectionMatrix()
      renderer.setSize(w, h)
    }
    // Debounce — mobile URL-bar show/hide fires resize continuously while scrolling.
    const onResize = () => {
      if (resizeTimer) clearTimeout(resizeTimer)
      resizeTimer = window.setTimeout(applyResize, 150)
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
      running = false
      if (resizeTimer) clearTimeout(resizeTimer)
      clearInterval(batchTimer)
      cancelAnimationFrame(animId)
      document.removeEventListener('pointerdown', tryPlayVideos)
      document.removeEventListener('visibilitychange', onVisibility)
      glCanvas.removeEventListener('webglcontextlost', onContextLost as EventListener)
      glCanvas.removeEventListener('webglcontextrestored', onContextRestored as EventListener)
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
