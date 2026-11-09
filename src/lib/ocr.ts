/**
 * Our own document reader. Everything runs on the customer's device and nothing is sent anywhere to be read:
 *  - Digital PDFs (mParivahan, DigiLocker, insurer e-policies): the text built into the PDF is read with pdf.js. Exact, instant.
 *  - Photos and scanned PDFs: PaddleOCR (open source) runs in a background worker in this tab.
 * The text is then handed to our own RC / policy parsers in rcParse.ts.
 */
import { countFound, parsePolicy, parseRc, type PolicyFields, type RcFields } from './rcParse'
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

async function readPicture(image: ImageBitmap, rotate: 0 | 90 | 180 | 270 = 0): Promise<string | null> {
  const copy = await createImageBitmap(image)
  const r = await ask({ type: 'read', image: copy, rotate }, [copy])
  return r.ok ? r.text : null
}

/* ------------------------------ helpers ------------------------------ */
const parse = (kind: ScanKind, text: string) => (kind === 'rc' ? parseRc(text) : parsePolicy(text)) as RcFields & PolicyFields
const letters = (s: string) => (s.match(/[A-Za-z0-9]/g) ?? []).length

/** Reads a picture; if little is found it tries it turned sideways and upside down (photos are often taken rotated). */
async function readBestRotation(kind: ScanKind, image: ImageBitmap) {
  let best = { text: '', fields: {} as RcFields & PolicyFields, found: 0 }
  let anyRead = false
  for (const rotate of [0, 90, 270, 180] as const) {
    const text = await readPicture(image, rotate)
    if (text === null) { if (rotate === 0) return null; continue }
    anyRead = true
    const fields = parse(kind, text)
    const found = countFound(fields)
    if (found > best.found) best = { text, fields, found }
    if (best.found >= 3) break
  }
  return anyRead ? best : null
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

/** Text built into a PDF page, rebuilt line by line (pieces on the same baseline joined left to right). */
async function pageText(page: PdfPage) {
  const content = await page.getTextContent()
  const rows: { y: number; parts: { x: number; s: string }[] }[] = []
  for (const it of content.items) {
    if (!('str' in it) || !it.str.trim()) continue
    const x = it.transform[4], y = it.transform[5]
    const row = rows.find((r) => Math.abs(r.y - y) <= Math.max(2, (it.height || 8) * 0.4))
    if (row) row.parts.push({ x, s: it.str })
    else rows.push({ y, parts: [{ x, s: it.str }] })
  }
  return rows.sort((a, b) => b.y - a.y).map((r) => r.parts.sort((a, b) => a.x - b.x).map((p) => p.s.trim()).join(' ')).join('\n')
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
    const pages = Math.min(doc.numPages, 4)
    const texts: string[] = []
    for (let i = 1; i <= pages; i++) texts.push(await pageText(await doc.getPage(i)))
    const text = texts.join('\n')
    if (letters(text) >= 40) {
      const fields = parse(kind, text)
      return { ok: true, fields, found: countFound(fields), via: 'pdf-text' }
    }
    // A scanned PDF (just pictures of pages): read the first two pages as pictures.
    let best: { fields: RcFields & PolicyFields; found: number } | null = null
    const ocrTexts: string[] = []
    for (let i = 1; i <= Math.min(doc.numPages, 2); i++) {
      const bmp = await renderPage(await doc.getPage(i))
      const r = await readBestRotation(kind, bmp)
      bmp.close()
      if (r) { ocrTexts.push(r.text); if (!best || r.found > best.found) best = r }
    }
    if (!best) return { ok: false, reason: 'failed' }
    // RC front and back are often separate pages: parse both pages together as well and keep the better result.
    const joined = parse(kind, ocrTexts.join('\n'))
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
