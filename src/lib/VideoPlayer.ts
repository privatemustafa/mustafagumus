import * as THREE from 'three'

/**
 * iOS Safari only reliably decodes/plays a <video> that lives in the DOM.
 * We keep a single off-screen, non-interactive host and park every texture
 * video inside it (1x1, invisible) so playback is rock-solid on mobile.
 */
let videoHost: HTMLDivElement | null = null
function getVideoHost(): HTMLDivElement {
  if (!videoHost) {
    videoHost = document.createElement('div')
    videoHost.setAttribute('aria-hidden', 'true')
    Object.assign(videoHost.style, {
      position: 'fixed',
      top: '0',
      left: '0',
      width: '1px',
      height: '1px',
      overflow: 'hidden',
      opacity: '0',
      pointerEvents: 'none',
      zIndex: '-1',
    } as Partial<CSSStyleDeclaration>)
    document.body.appendChild(videoHost)
  }
  return videoHost
}

export class VideoPlayer {
  readonly element: HTMLVideoElement
  readonly texture: THREE.VideoTexture
  private ready = false
  private disposed = false
  private _active = false   // track state — avoid redundant DOM calls

  constructor(src: string, preload: 'auto' | 'metadata' = 'auto') {
    const video = document.createElement('video')
    video.muted = true
    video.defaultMuted = true
    video.loop = true
    video.playsInline = true
    video.autoplay = false
    video.controls = false
    video.preload = preload
    video.crossOrigin = 'anonymous'
    // iOS / Safari inline playback + keep the OS media UI out of the way
    video.setAttribute('webkit-playsinline', 'true')
    video.setAttribute('playsinline', 'true')
    video.setAttribute('muted', '')
    video.disablePictureInPicture = true
    // disableRemotePlayback is non-standard but valid on Safari/Chrome
    ;(video as HTMLVideoElement & { disableRemotePlayback?: boolean }).disableRemotePlayback = true
    video.src = src
    // Keep it tiny & invisible but in the DOM for iOS playback reliability
    video.style.width = '1px'
    video.style.height = '1px'
    getVideoHost().appendChild(video)

    this.element = video
    this.texture = new THREE.VideoTexture(video)
    this.texture.colorSpace = THREE.SRGBColorSpace
    this.texture.minFilter = THREE.LinearFilter
    this.texture.magFilter = THREE.LinearFilter
    this.texture.generateMipmaps = false
  }

  load(): Promise<void> {
    if (this.disposed) return Promise.reject(new Error('disposed'))
    return new Promise((resolve, reject) => {
      // loadeddata fires once the first frame is available; fall back to a
      // timeout so a stalled mobile network never wedges the load queue.
      const TIMEOUT_MS = 12000
      let timer = 0
      const onReady = () => { cleanup(); this.ready = true; resolve() }
      const onError = () => { cleanup(); reject(new Error('video load failed')) }
      const cleanup = () => {
        if (timer) clearTimeout(timer)
        this.element.removeEventListener('loadeddata', onReady)
        this.element.removeEventListener('canplay', onReady)
        this.element.removeEventListener('error', onError)
      }
      this.element.addEventListener('loadeddata', onReady, { once: true })
      this.element.addEventListener('canplay', onReady, { once: true })
      this.element.addEventListener('error', onError, { once: true })
      timer = window.setTimeout(onError, TIMEOUT_MS)
      this.element.load()
    })
  }

  get isReady() {
    return this.ready
  }

  play() {
    if (this.disposed || !this.ready || this._active) return
    this._active = true
    const p = this.element.play()
    if (p && typeof p.catch === 'function') {
      p.catch(() => { this._active = false })
    }
  }

  pause() {
    if (this.disposed || !this._active) return
    this._active = false
    this.element.pause()
  }

  /** Call every frame — only triggers DOM when state changes */
  setActive(active: boolean) {
    if (active === this._active) return
    if (active) this.play()
    else this.pause()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this._active = false
    this.element.pause()
    this.texture.dispose()
    this.element.removeAttribute('src')
    this.element.load()
    this.element.remove()
  }
}
