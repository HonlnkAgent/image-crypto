// 图密 · Image Crypto —— 空间相关 XOR（连续色块，无方块边界）
// 不切块。每个像素各自异或，但异或字节随坐标缓慢变化，形成"流动偏色场"。
// 相邻像素异或值接近 -> 视觉上聚成连续色块；远处差异大 -> 色块颜色不同。
// 加密后能看到原图的明暗结构，但颜色被扭曲成连续色块，无格子边界。

// ---- 密钥 -> 种子 ----
function keyToSeed(key) {
  let h = 0x811c9dc5
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i)
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0 || 1
}

// ---- 加载图片 File -> HTMLImageElement ----
function loadImage(file) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.onload = () => { URL.revokeObjectURL(url); resolve(img) }
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('图片加载失败')) }
    img.src = url
  })
}

// ---- 文件 -> Canvas + ImageData ----
// 不切块，无需 padding。
export async function fileToImageData(file) {
  const img = await loadImage(file)
  const w = img.width
  const h = img.height
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  ctx.drawImage(img, 0, 0)
  const imageData = ctx.getImageData(0, 0, w, h)
  return { canvas, ctx, imageData, width: w, height: h }
}

// ---- 空间相关 XOR 核心 ----
// scale 控制色块大小（值越大，色块越大、过渡越平缓）。
// 用多频正弦混合 + 密钥种子，生成随坐标平滑变化的 [r,g,b] 异或字节。
// XOR 对称：加密与解密是同一操作。
export function smoothXor(imageData, key, scale) {
  const { width, height, data } = imageData
  const seed = keyToSeed(key)

  const freq1 = (2 * Math.PI) / Math.max(1, scale)
  const freq2 = freq1 * 1.7320508
  const freq3 = freq1 * 2.4142135

  const phaseR = (seed & 0xff) / 255 * Math.PI * 2
  const phaseG = ((seed >> 8) & 0xff) / 255 * Math.PI * 2
  const phaseB = ((seed >> 16) & 0xff) / 255 * Math.PI * 2

  const out = new Uint8ClampedArray(data.length)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4

      const rField =
        0.5 + 0.5 * (0.6 * Math.sin(freq1 * x + phaseR) + 0.4 * Math.sin(freq2 * y + phaseR * 1.3))
      const gField =
        0.5 + 0.5 * (0.6 * Math.sin(freq2 * (x + y) + phaseG) + 0.4 * Math.sin(freq3 * x + phaseG * 0.7))
      const bField =
        0.5 + 0.5 * (0.6 * Math.sin(freq3 * y + phaseB) + 0.4 * Math.sin(freq1 * (x - y) + phaseB * 1.7))

      const br = (rField * 255) & 0xff
      const bg = (gField * 255) & 0xff
      const bb = (bField * 255) & 0xff

      out[i]     = data[i]     ^ br
      out[i + 1] = data[i + 1] ^ bg
      out[i + 2] = data[i + 2] ^ bb
      out[i + 3] = data[i + 3]
    }
  }

  return new ImageData(out, width, height)
}

// ---- Canvas -> Blob URL ----
// 加密图固定用 PNG（无损，避免 JPEG 伪影导致解密失真）
// 解密图用原文件格式（JPEG/PNG/WEBP），避免 JPEG→PNG 膨胀
export function canvasToBlobUrl(canvas, mimeType = 'image/png', quality) {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) { reject(new Error('导出失败')); return }
      resolve(URL.createObjectURL(blob))
    }, mimeType, quality)
  })
}

// ---- 根据原文件类型选择导出格式 ----
// JPEG/WEBP 有损 -> 解密后保持原格式，用 quality 0.92 控制质量
// PNG/其他 -> 保持 PNG 无损
export function pickExportMime(originalType) {
  if (originalType === 'image/jpeg' || originalType === 'image/jpg') {
    return { mime: 'image/jpeg', quality: 0.92 }
  }
  if (originalType === 'image/webp') {
    return { mime: 'image/webp', quality: 0.92 }
  }
  return { mime: 'image/png', quality: undefined }
}
