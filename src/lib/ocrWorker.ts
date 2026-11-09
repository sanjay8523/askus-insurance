/// <reference lib="webworker" />
/**
 * Background worker that turns a picture into text with PaddleOCR (PP-OCRv6 tiny, open source), running on the
 * customer's own device. Nothing is uploaded: the picture stays in this browser tab.
 * The model files (about 6 MB) are downloaded once on first use and then come from the browser cache.
 *
 * Before reading, each picture is cleaned up the way a scanner app would:
 *  1. resized so small print is big enough to read (long side 2000-2400px),
 *  2. straightened (phone photos are usually a few degrees tilted, which mixes up the rows),
 *  3. turned grey with the contrast stretched (shadows and uneven light).
 * Every text box is then read on its own and returned with its position.
 */
import { PaddleOcrService, V6_TINY_MODEL, type FlattenedPaddleOcrResult } from 'ppu-paddle-ocr/web'
import type { Cell } from './docLayout'

export type WorkerRequest = { id: number; type: 'warm' } | { id: number; type: 'read'; image: ImageBitmap; rotate: 0 | 90 | 180 | 270 }
/** Every piece of text read, with its box on the straightened picture (used to pair labels with values). */
export type WorkerReply = { id: number; ok: true; cells: Cell[]; confidence: number } | { id: number; ok: false; error: string }

const MIN_SIDE = 2000
const MAX_SIDE = 2400

let ready: Promise<PaddleOcrService> | null = null
function service() {
  if (!ready) {
    const s = new PaddleOcrService({ model: V6_TINY_MODEL, session: { executionProviders: ['wasm'], graphOptimizationLevel: 'all' } })
    ready = s.initialize().then(() => s)
    ready.catch(() => { ready = null }) // a failed download can be retried on the next file
  }
  return ready
}

/** Draws the picture turned by `rotate` degrees, scaled so its long side is between MIN_SIDE and MAX_SIDE. */
function place(image: ImageBitmap, rotate: number) {
  const long = Math.max(image.width, image.height)
  const scale = long > MAX_SIDE ? MAX_SIDE / long : long < MIN_SIDE ? Math.min(3, MIN_SIDE / long) : 1
  const w = Math.round(image.width * scale), h = Math.round(image.height * scale)
  const sideways = rotate === 90 || rotate === 270
  const canvas = new OffscreenCanvas(sideways ? h : w, sideways ? w : h)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  ctx.translate(canvas.width / 2, canvas.height / 2)
  ctx.rotate((rotate * Math.PI) / 180)
  ctx.drawImage(image, -w / 2, -h / 2, w, h)
  return canvas
}

/**
 * Small tilt of the text in degrees (-10 to 10). Finds dark ink pixels on a small copy, then picks the angle at which
 * the ink lines up into the sharpest horizontal rows (projection profile).
 */
function skewAngle(src: OffscreenCanvas): number {
  const sc = Math.min(1, 700 / Math.max(src.width, src.height))
  const w = Math.round(src.width * sc), h = Math.round(src.height * sc)
  const small = new OffscreenCanvas(w, h)
  const sg = small.getContext('2d')!
  sg.drawImage(src, 0, 0, w, h)
  const d = sg.getImageData(0, 0, w, h).data
  const g = new Float32Array(w * h)
  for (let i = 0; i < w * h; i++) g[i] = 0.299 * d[i * 4] + 0.587 * d[i * 4 + 1] + 0.114 * d[i * 4 + 2]
  const R = 6
  const xs: number[] = [], ys: number[] = []
  for (let y = R; y < h - R; y++) for (let x = R; x < w - R; x++) {
    const around = (g[(y - R) * w + x] + g[(y + R) * w + x] + g[y * w + x - R] + g[y * w + x + R]) / 4
    if (around - g[y * w + x] > 28) { xs.push(x - w / 2); ys.push(y - h / 2) }
  }
  if (xs.length < 200) return 0
  let best = 0, bestScore = -1
  const bins = new Float32Array(h * 2)
  for (let a = -10; a <= 10.001; a += 0.25) {
    const t = (a * Math.PI) / 180, c = Math.cos(t), s = Math.sin(t)
    bins.fill(0)
    for (let i = 0; i < xs.length; i++) { const yy = Math.round(-xs[i] * s + ys[i] * c + h); if (yy >= 0 && yy < bins.length) bins[yy]++ }
    let score = 0
    for (let i = 1; i < bins.length; i++) { const dl = bins[i] - bins[i - 1]; score += dl * dl }
    if (score > bestScore) { bestScore = score; best = a }
  }
  return best
}

/** Straightens the picture and turns it into high-contrast grey. */
function clean(src: OffscreenCanvas) {
  const angle = skewAngle(src)
  const out = new OffscreenCanvas(src.width, src.height)
  const g = out.getContext('2d')!
  g.fillStyle = '#fff'
  g.fillRect(0, 0, out.width, out.height)
  g.translate(out.width / 2, out.height / 2)
  g.rotate((-angle * Math.PI) / 180)
  g.drawImage(src, -src.width / 2, -src.height / 2)
  g.setTransform(1, 0, 0, 1, 0, 0)
  const img = g.getImageData(0, 0, out.width, out.height)
  const p = img.data
  const hist = new Uint32Array(256)
  for (let i = 0; i < p.length; i += 4) { const v = (0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]) | 0; p[i] = v; hist[v]++ }
  const n = p.length / 4
  let lo = 0, hi = 255, acc = 0
  for (let i = 0; i < 256; i++) { acc += hist[i]; if (acc > n * 0.01) { lo = i; break } }
  acc = 0
  for (let i = 255; i >= 0; i--) { acc += hist[i]; if (acc > n * 0.01) { hi = i; break } }
  const k = 255 / Math.max(1, hi - lo)
  for (let i = 0; i < p.length; i += 4) { const v = Math.max(0, Math.min(255, (p[i] - lo) * k)); p[i] = p[i + 1] = p[i + 2] = v }
  g.putImageData(img, 0, 0)
  return out
}

const post = (r: WorkerReply) => (self as unknown as DedicatedWorkerGlobalScope).postMessage(r)

self.onmessage = async (e: MessageEvent<WorkerRequest>) => {
  const m = e.data
  try {
    const ocr = await service()
    if (m.type === 'warm') return post({ id: m.id, ok: true, cells: [], confidence: 0 })
    const canvas = clean(place(m.image, m.rotate))
    m.image.close()
    const r = (await ocr.recognize(canvas, { flatten: true, strategy: 'per-box', minimumConfidence: 0.3 })) as FlattenedPaddleOcrResult
    const cells = (r.results ?? []).filter((i) => i.text.trim()).map((i) => ({ text: i.text.trim(), x: i.box.x, y: i.box.y, w: i.box.width, h: i.box.height }))
    post({ id: m.id, ok: true, cells, confidence: r.confidence ?? 0 })
  } catch (err) {
    post({ id: m.id, ok: false, error: err instanceof Error ? err.message : String(err) })
  }
}
