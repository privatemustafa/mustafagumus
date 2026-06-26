/**
 * Detects partial / split / letterboxed Instagram junk frames.
 * Shared by filter-manifest.mjs
 */
import sharp from 'sharp'

function lumAt(data, width, channels, x, y) {
  const i = (y * width + x) * channels
  return 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2]
}

function isContentPixel(lum) {
  return lum > 22 && lum < 238
}

/**
 * Returns true when the image should be dropped (partial crop, grid split, etc.)
 */
export async function isBadCrop(filePath) {
  const meta = await sharp(filePath).metadata()
  const { width = 0, height = 0 } = meta
  if (width < 8 || height < 8) return true

  const aspect = width / height
  // IG portrait / landscape sane bounds
  if (aspect < 0.52 || aspect > 2.35) return true
  // Classic grid column strip
  if (aspect < 0.72) return true

  const { data, info } = await sharp(filePath)
    .resize(240, 240, { fit: 'inside', withoutEnlargement: true })
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true })

  const w = info.width
  const h = info.height
  const ch = info.channels

  const colContent = new Uint16Array(w)
  const rowContent = new Uint16Array(h)
  let contentPixels = 0

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const lum = lumAt(data, w, ch, x, y)
      if (isContentPixel(lum)) {
        colContent[x]++
        rowContent[y]++
        contentPixels++
      }
    }
  }

  if (contentPixels < w * h * 0.08) return true

  const colThresh = Math.max(3, Math.floor(h * 0.12))
  const rowThresh = Math.max(3, Math.floor(w * 0.12))

  let minX = w
  let maxX = 0
  let minY = h
  let maxY = 0

  for (let x = 0; x < w; x++) {
    if (colContent[x] >= colThresh) {
      minX = Math.min(minX, x)
      maxX = Math.max(maxX, x)
    }
  }
  for (let y = 0; y < h; y++) {
    if (rowContent[y] >= rowThresh) {
      minY = Math.min(minY, y)
      maxY = Math.max(maxY, y)
    }
  }

  if (maxX <= minX || maxY <= minY) return true

  const boxW = maxX - minX + 1
  const boxH = maxY - minY + 1
  const marginLeft = minX / w
  const marginRight = (w - 1 - maxX) / w
  const marginTop = minY / h
  const marginBottom = (h - 1 - maxY) / h

  // Content pushed to one side with a large empty margin (half-photo strips)
  if (
    (marginLeft > 0.2 && marginRight < 0.07 && boxW / w < 0.72) ||
    (marginRight > 0.2 && marginLeft < 0.07 && boxW / w < 0.72)
  ) {
    return true
  }
  if (
    (marginTop > 0.2 && marginBottom < 0.07 && boxH / h < 0.72) ||
    (marginBottom > 0.2 && marginTop < 0.07 && boxH / h < 0.72)
  ) {
    return true
  }

  // One-sided white / black letterbox (carousel grid seam)
  const stripW = Math.max(4, Math.floor(w * 0.16))
  let leftBlank = 0
  let rightBlank = 0
  let topBlank = 0
  let bottomBlank = 0
  const samples = Math.min(64, h)

  for (let i = 0; i < samples; i++) {
    const y = Math.floor((i / samples) * (h - 1))
    let lSum = 0
    let rSum = 0
    for (let dx = 0; dx < stripW; dx++) {
      lSum += lumAt(data, w, ch, dx, y)
      rSum += lumAt(data, w, ch, w - 1 - dx, y)
    }
    if (lSum / stripW > 235 || lSum / stripW < 18) leftBlank++
    if (rSum / stripW > 235 || rSum / stripW < 18) rightBlank++
  }

  const rowSamples = Math.min(64, w)
  for (let i = 0; i < rowSamples; i++) {
    const x = Math.floor((i / rowSamples) * (w - 1))
    let tSum = 0
    let bSum = 0
    for (let dy = 0; dy < stripW; dy++) {
      tSum += lumAt(data, w, ch, x, dy)
      bSum += lumAt(data, w, ch, x, h - 1 - dy)
    }
    if (tSum / stripW > 235 || tSum / stripW < 18) topBlank++
    if (bSum / stripW > 235 || bSum / stripW < 18) bottomBlank++
  }

  const sideBlankRatio = Math.max(leftBlank, rightBlank, topBlank, bottomBlank) / samples
  if (sideBlankRatio > 0.72 && boxW / w < 0.82) return true

  // Vertical white seam through the middle (split grid)
  const mid = Math.floor(w / 2)
  let midWhite = 0
  for (let y = 0; y < h; y += 2) {
    if (lumAt(data, w, ch, mid, y) > 235) midWhite++
  }
  if (midWhite / Math.ceil(h / 2) > 0.45 && aspect < 0.98) return true

  // Uneven column energy — empty column beside real content (grid split)
  const bands = 5
  const bandEnergy = []
  for (let b = 0; b < bands; b++) {
    const x0 = Math.floor((b / bands) * w)
    const x1 = Math.floor(((b + 1) / bands) * w)
    let e = 0
    let n = 0
    for (let y = 0; y < h; y += 3) {
      for (let x = x0; x < x1; x += 3) {
        const lum = lumAt(data, w, ch, x, y)
        e += Math.abs(lum - 128)
        n++
      }
    }
    bandEnergy.push(e / Math.max(1, n))
  }
  const maxE = Math.max(...bandEnergy)
  const minE = Math.min(...bandEnergy)
  const emptyBands = bandEnergy.filter((e) => e < maxE * 0.18).length
  if (maxE > 8 && emptyBands >= 2 && boxW / w < 0.8) return true

  return false
}
