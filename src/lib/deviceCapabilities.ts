/**
 * Runtime device capability detection.
 * Tunes renderer + video load so the universe stays smooth from
 * flagship desktops down to low-end phones on Safari/Chrome.
 */

export type DeviceTier = 'low' | 'mid' | 'high'

export interface DeviceCapabilities {
  tier: DeviceTier
  isMobile: boolean
  isIOS: boolean
  isSafari: boolean
  /** Hard cap for renderer.setPixelRatio */
  pixelRatio: number
  /** Max simultaneously playing <video> elements */
  maxConcurrentVideos: number
  /** Distance (world units) within which a video is instantiated */
  videoLoadRange: number
  /** Distance beyond which a video element is disposed to free a decoder */
  videoUnloadRange: number
  /** Copies of the video set interleaved into the universe */
  videoCopies: number
  /** Hard cap on total meshes (images + video copies) */
  maxMeshes: number
  /** Grain overlay refresh rate (fps) */
  grainFps: number
  /** Honor reduced-motion preference */
  reducedMotion: boolean
}

function detect(): DeviceCapabilities {
  if (typeof navigator === 'undefined' || typeof window === 'undefined') {
    return {
      tier: 'high',
      isMobile: false,
      isIOS: false,
      isSafari: false,
      pixelRatio: 1.5,
      maxConcurrentVideos: 8,
      videoLoadRange: 55,
      videoUnloadRange: 150,
      videoCopies: 3,
      maxMeshes: 600,
      grainFps: 10,
      reducedMotion: false,
    }
  }

  const ua = navigator.userAgent
  const isIOS =
    /iP(hone|od|ad)/.test(ua) ||
    // iPadOS reports as Mac with touch support
    (/Macintosh/.test(ua) && (navigator.maxTouchPoints ?? 0) > 1)
  const isAndroid = /Android/.test(ua)
  const isMobile =
    isIOS ||
    isAndroid ||
    /Mobi|Tablet/.test(ua) ||
    (navigator.maxTouchPoints ?? 0) > 1 && window.matchMedia('(pointer: coarse)').matches
  const isSafari = /^((?!chrome|android|crios|fxios).)*safari/i.test(ua)

  const cores = navigator.hardwareConcurrency ?? (isMobile ? 4 : 8)
  // deviceMemory is Chrome-only; undefined on Safari → assume mid
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches

  let tier: DeviceTier
  if (!isMobile && cores >= 8) {
    tier = 'high'
  } else if (
    (memory !== undefined && memory <= 3) ||
    cores <= 4 ||
    (isMobile && window.devicePixelRatio > 2.5)
  ) {
    tier = 'low'
  } else {
    tier = 'mid'
  }

  switch (tier) {
    case 'high':
      return {
        tier,
        isMobile,
        isIOS,
        isSafari,
        pixelRatio: Math.min(window.devicePixelRatio, 1.75),
        maxConcurrentVideos: 8,
        videoLoadRange: 60,
        videoUnloadRange: 160,
        videoCopies: 3,
        maxMeshes: 600,
        grainFps: 10,
        reducedMotion,
      }
    case 'mid':
      return {
        tier,
        isMobile,
        isIOS,
        isSafari,
        pixelRatio: Math.min(window.devicePixelRatio, 1.5),
        maxConcurrentVideos: 4,
        videoLoadRange: 50,
        videoUnloadRange: 130,
        videoCopies: isMobile ? 1 : 2,
        maxMeshes: isMobile ? 240 : 420,
        grainFps: isMobile ? 7 : 9,
        reducedMotion,
      }
    case 'low':
    default:
      return {
        tier: 'low',
        isMobile,
        isIOS,
        isSafari,
        pixelRatio: Math.min(window.devicePixelRatio, 1.25),
        maxConcurrentVideos: 2,
        videoLoadRange: 42,
        videoUnloadRange: 110,
        videoCopies: 1,
        maxMeshes: 150,
        grainFps: 6,
        reducedMotion,
      }
  }
}

let cached: DeviceCapabilities | null = null

export function getDeviceCapabilities(): DeviceCapabilities {
  if (!cached) cached = detect()
  return cached
}
