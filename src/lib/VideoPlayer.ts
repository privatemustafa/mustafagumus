import * as THREE from 'three'

export class VideoPlayer {
  readonly element: HTMLVideoElement
  readonly texture: THREE.VideoTexture
  private ready = false
  private disposed = false
  private _active = false   // track state — avoid redundant DOM calls

  constructor(src: string) {
    const video = document.createElement('video')
    video.src = src
    video.muted = true
    video.loop = true
    video.playsInline = true
    video.autoplay = false
    video.preload = 'auto'
    video.setAttribute('webkit-playsinline', 'true')

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
      const onReady = () => { cleanup(); this.ready = true; resolve() }
      const onError = () => { cleanup(); reject(new Error('video load failed')) }
      const cleanup = () => {
        this.element.removeEventListener('loadeddata', onReady)
        this.element.removeEventListener('error', onError)
      }
      this.element.addEventListener('loadeddata', onReady, { once: true })
      this.element.addEventListener('error', onError, { once: true })
      this.element.load()
    })
  }

  play() {
    if (this.disposed || !this.ready || this._active) return
    this._active = true
    this.element.play().catch(() => { this._active = false })
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
  }
}
