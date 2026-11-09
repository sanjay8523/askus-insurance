/**
 * Our own document reader. Everything runs on the customer's device and nothing is sent anywhere to be read:
 *  - Digital PDFs (mParivahan, DigiLocker, insurer e-policies): the text built into the PDF is read with pdf.js. Exact, instant.
 *  - Photos and scanned PDFs: PaddleOCR (open source) runs in a background worker in this tab.
 * Each piece of text keeps its position on the page, so rcParse.ts can pair every label with its value
 * whether the value sits next to the label or under it.
 */
import { textOf } from './docLayout'
import { countFound, extractPolicy, extractRc, type Cell, type PolicyFields, type RcFields } from './rcParse'
import type { WorkerReply, WorkerRequest } from './ocrWorker'

export type ScanKind = 'rc' | 'policy'
export type ScanOutcome =
  | { ok: true; fields: RcFields & PolicyFields; found: number; via: 'pdf-text' | 'ocr' }
  | { ok: false; reason: 'locked' | 'failed' }

/* ------------------------------ OCR worker ------------------------------ */
let worker: Worker | null = null
let nextId = 1
const waiting = new Map<number, (r: WorkerReply) => void>()
let queue: Promise<unknown> = Promise.resolve()

function getWorker() {
  if (!worker) {
    worker = new Worker(new URL('./ocrWorker.ts', import.meta.url), { type: 'module' })
    worker.onmessage = (e: MessageEvent<WorkerReply>) => { waiting.get(e.data.id)?.(e.data); waiting.delete(e.data.id) }
    worker.onerror = () => { waiting.forEach((done, id) => done({ id, ok: false, error: 'worker crashed' })); waiting.clear(); worker?.terminate(); worker = null }
  }
  return worker
}

/** One job at a time (the model is shared), with a time limit so a stuck download never blocks the form. */
type Job = WorkerRequest extends infer R ? (R extends WorkerRequest ? Omit<R, 'id'> : never) : never
function ask(req: Job, transfer: Transferable[] = [], timeoutMs = 120_000): Promise<WorkerReply> {
  const run = () => new Promise<WorkerReply>((resolve) => {
    const id = nextId++
    const timer = setTimeout(() => { waiting.delete(id); resolve({ id, ok: false, error: 'timeout' }) }, timeoutMs)
    waiting.set(id, (r) => { clearTimeout(timer); resolve(r) })
    getWorker().postMessage({ ...req, id } as WorkerRequest, transfer)
  })
  const p = queue.then(run, run)
  queue = p.catch(() => undefined)
  return p
}

/** Starts downloading the reader in the background (call when the upload step opens), so the first scan is quicker. */
export function warmUpReader() {
  if (typeof Worker === 'undefined') return
  void ask({ type: 'warm' })
}

async function readPicture(image: ImageBitmap, rotate: 0 | 90 | 180 | 270 = 0): Promise<Cell[] | null> {
  const copy = await createImageBitmap(image)
  const r = await ask({ type: 'read', image: copy, rotate }, [copy])
  return r.ok ? r.cells : null
}

/* ------------------------------ helpers ------------------------------ */
type Fields = RcFields & PolicyFields
const parse = (kind: ScanKind, cells: Cell[]) => (kind === 'rc' ? extractRc(cells) : extractPolicy(cells)) as Fields
const letters = (s: string) => (s.match(/[A-Za-z0-9]/g) ?? []).length

/** Reads a picture; if little is found it tries it turned sideways and upside down (photos are often taken rotated). */
async function readBestRotation(kind: ScanKind, image: ImageBitmap) {
  let best: { cells: Cell[]; fields: Fields; found: number } | null = null
  for (const rotate of [0, 90, 270, 180] as const) {
    const cells = await readPicture(image, rotate)
    if (cells === null) { if (rotate === 0) return null; continue }
    const fields = parse(kind, cells)
    const found = countFound(fields)
    if (!best || found > best.found) best = { cells, fields, found }
    if (best.found >= 3) break
  }
  return best
}

/* ------------------------------ PDFs ------------------------------ */
type PdfDoc = import('pdfjs-dist').PDFDocumentProxy
type PdfPage = import('pdfjs-dist').PDFPageProxy

async function openPdf(file: File): Promise<{ doc: PdfDoc; close: () => void } | 'locked'> {
  const pdfjs = await import('pdfjs-dist')
  if (!pdfjs.GlobalWorkerOptions.workerSrc) pdfjs.GlobalWorkerOptions.workerSrc = (await import('pdfjs-dist/build/pdf.worker.min.mjs?url')).default
  const task = pdfjs.getDocument({ data: new Uint8Array(await file.arrayBuffer()) })
  try {
    return { doc: await task.promise, close: () => void task.destroy() }
  } catch (e) {
    void task.destroy()
    if ((e as { name?: string })?.name === 'PasswordException') return 'locked'
    throw e
  }
}

/** The text built into a PDF page, each piece with its box (top-left origin), placed `top` units down the document. */
async function pageCells(page: PdfPage, top: number) {
  const viewport = page.getViewport({ scale: 1 })
  const content = await page.getTextContent()
  const cells: Cell[] = []
  for (const it of content.items) {
    if (!('str' in it) || !it.str.trim()) continue
    const [a, b, c, d, e, f] = it.transform as number[]
    if (Math.abs(b) > Math.abs(a)) continue // vertical text (stamps, margins)
    const h = Math.hypot(c, d) || it.height || 10
    const [x, y] = viewport.convertToViewportPoint(e, f)
    cells.push({ text: it.str, x, y: top + y - h, w: it.width || it.str.length * h * 0.5, h })
  }
  return { cells, height: viewport.height }
}

async function renderPage(page: PdfPage) {
  const base = page.getViewport({ scale: 1 })
  const viewport = page.getViewport({ scale: Math.min(3, 2200 / Math.max(base.width, base.height)) })
  const canvas = document.createElement('canvas')
  canvas.width = Math.ceil(viewport.width)
  canvas.height = Math.ceil(viewport.height)
  const ctx = canvas.getContext('2d')!
  ctx.fillStyle = '#fff'
  ctx.fillRect(0, 0, canvas.width, canvas.height)
  // 'print' renders in one go; the default waits for animation frames, which stop while the tab is in the background
  await page.render({ canvas, canvasContext: ctx, viewport, intent: 'print' }).promise
  return createImageBitmap(canvas)
}

async function readPdf(kind: ScanKind, file: File): Promise<ScanOutcome> {
  const opened = await openPdf(file)
  if (opened === 'locked') return { ok: false, reason: 'locked' }
  const { doc, close } = opened
  try {
    const all: Cell[] = []
    let top = 0
    for (let i = 1; i <= Math.min(doc.numPages, 4); i++) {
      const { cells, height } = await pageCells(await doc.getPage(i), top)
      all.push(...cells)
      top += height + 40
    }
    if (letters(textOf(all)) >= 40) {
      const fields = parse(kind, all)
      return { ok: true, fields, found: countFound(fields), via: 'pdf-text' }
    }
    // A scanned PDF (just pictures of pages): read the first two pages as pictures.
    let best: { fields: Fields; found: number } | null = null
    const pages: Cell[] = []
    let offset = 0
    for (let i = 1; i <= Math.min(doc.numPages, 2); i++) {
      const bmp = await renderPage(await doc.getPage(i))
      const r = await readBestRotation(kind, bmp)
      const pageHeight = Math.max(bmp.width, bmp.height)
      bmp.close()
      if (!r) continue
      if (!best || r.found > best.found) best = r
      pages.push(...r.cells.map((c) => ({ ...c, y: c.y + offset })))
      offset += pageHeight + 100
    }
    if (!best) return { ok: false, reason: 'failed' }
    // RC front and back are often separate pages: read both pages together as well and keep the better result.
    const joined = parse(kind, pages)
    const joinedFound = countFound(joined)
    return joinedFound >= best.found ? { ok: true, fields: joined, found: joinedFound, via: 'ocr' } : { ok: true, fields: best.fields, found: best.found, via: 'ocr' }
  } finally {
    close()
  }
}

/* ------------------------------ entry point ------------------------------ */
/** Reads an RC or policy (photo or PDF) on this device and returns the details it found. Never throws. */
export async function scanDocument(file: File, kind: ScanKind): Promise<ScanOutcome> {
  try {
    if (file.type === 'application/pdf' || /\.pdf$/i.test(file.name)) return await readPdf(kind, file)
    const bmp = await createImageBitmap(file, { imageOrientation: 'from-image' })
    try {
      const r = await readBestRotation(kind, bmp)
      return r ? { ok: true, fields: r.fields, found: r.found, via: 'ocr' } : { ok: false, reason: 'failed' }
    } finally {
      bmp.close()
    }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}
