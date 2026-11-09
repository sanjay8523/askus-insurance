/**
 * Accepts a photo in any format, or a PDF, and returns a file that every part of the site can use:
 *  - JPG, PNG, WebP and PDF are kept as they are (only the file name's extension is corrected).
 *  - Any other image (iPhone HEIC/HEIF, AVIF, TIFF scans, BMP, GIF, SVG, ...) is turned into a JPEG on this device,
 *    so the reader can read it, it stores like any photo, and our team can open it in any browser.
 *  - Very large photos are made smaller (sharp enough to read, at most 3200px on the long side) instead of being refused.
 * The type is worked out from the file's first bytes, not only its name, because phones often send odd names and types.
 */

/** For <input type="file" accept>: every image type plus PDF (the extensions help pickers that ignore image/*). */
export const ACCEPT = 'image/*,.heic,.heif,.avif,.webp,.tif,.tiff,.bmp,.gif,.jfif,.jpg,.jpeg,.png,application/pdf,.pdf'

/** Largest file we store (Cloudinary's limit). Photos above it are made smaller; PDFs above it are refused. */
export const MAX_UPLOAD = 10 * 1024 * 1024
/** Largest file we try to open at all (memory on phones). */
const MAX_INPUT = 60 * 1024 * 1024
const MAX_SIDE = 3200

type Kind = 'pdf' | 'jpeg' | 'png' | 'webp' | 'heic' | 'avif' | 'tiff' | 'gif' | 'bmp' | 'ico' | 'svg' | 'image' | 'other'
const KEEP: Partial<Record<Kind, { ext: string; mime: string }>> = {
  pdf: { ext: 'pdf', mime: 'application/pdf' }, jpeg: { ext: 'jpg', mime: 'image/jpeg' },
  png: { ext: 'png', mime: 'image/png' }, webp: { ext: 'webp', mime: 'image/webp' },
}

export type Prepared = { ok: true; file: File; converted: boolean } | { ok: false; error: string }

const baseName = (name: string) => (name.replace(/\.[^./\\]{1,5}$/, '') || 'document').slice(0, 80)
const ascii = (b: Uint8Array, from: number, to: number) => String.fromCharCode(...b.slice(from, to))

/** The real type of a file, from its first bytes (falls back to its declared type and extension). */
async function sniff(file: File): Promise<Kind> {
  const b = new Uint8Array(await file.slice(0, 1024).arrayBuffer())
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpeg'
  if (b[0] === 0x89 && ascii(b, 1, 4) === 'PNG') return 'png'
  if (ascii(b, 0, 4) === 'RIFF' && ascii(b, 8, 12) === 'WEBP') return 'webp'
  if (ascii(b, 0, 4) === 'GIF8') return 'gif'
  if (ascii(b, 0, 2) === 'BM') return 'bmp'
  if ((b[0] === 0x49 && b[1] === 0x49 && b[2] === 0x2a && b[3] === 0) || (b[0] === 0x4d && b[1] === 0x4d && b[2] === 0 && b[3] === 0x2a)) return 'tiff'
  if (ascii(b, 4, 8) === 'ftyp') {
    const brands = ascii(b, 8, Math.min(b.length, 64))
    if (/avif|avis/.test(brands)) return 'avif'
    if (/heic|heix|hevc|hevx|heim|heis|hevm|hevs|mif1|msf1/.test(brands)) return 'heic'
  }
  if (b[0] === 0 && b[1] === 0 && b[2] === 1 && b[3] === 0) return 'ico'
  if (ascii(b, 0, b.length).includes('%PDF-')) return 'pdf' // may follow a few bytes of junk
  if (/^\s*(?:<\?xml[^>]*>\s*)?(?:<!--[\s\S]*?-->\s*)*<svg/i.test(ascii(b, 0, b.length))) return 'svg'
  if (file.type.startsWith('image/') || /\.(heic|heif|avif|tiff?|bmp|gif|jxl|ico|svg)$/i.test(file.name)) return 'image'
  return 'other'
}

/** Decodes with the browser itself: an ImageBitmap (keeps the photo upright), or an <img> for types it only shows that way. */
async function decodeNative(blob: Blob): Promise<CanvasImageSource & { width: number; height: number } | null> {
  try {
    return await createImageBitmap(blob, { imageOrientation: 'from-image' })
  } catch { /* try an <img> */ }
  const url = URL.createObjectURL(blob)
  try {
    const img = new Image()
    img.src = url
    await img.decode()
    if (!img.naturalWidth || !img.naturalHeight) return null
    return Object.assign(img, { width: img.naturalWidth, height: img.naturalHeight })
  } catch {
    return null
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
}

/** iPhone photos: Safari opens HEIC itself; other browsers use libheif (loaded only when needed). */
async function decodeHeic(file: File) {
  const native = await decodeNative(file)
  if (native) return native
  try {
    const { heicTo } = await import('heic-to/csp')
    return await heicTo({ blob: file, type: 'bitmap' })
  } catch {
    return null
  }
}

/** Frees a canvas's memory straight away (phones have little to spare). */
const release = (c: HTMLCanvasElement) => { c.width = 0; c.height = 0 }

/**
 * TIFF scans: Safari opens them itself; elsewhere UTIF decodes them. Two-page scans (RC front and back) are stacked.
 * Each page is drawn straight into the final, already-reduced picture and freed, so memory stays low.
 */
async function decodeTiff(file: File) {
  const native = await decodeNative(file)
  if (native) return native
  try {
    const mod = await import('utif2')
    const UTIF = (mod as unknown as { default?: typeof mod }).default ?? mod
    const buf = await file.arrayBuffer()
    const tag = (p: object, t: string) => Number(((p as Record<string, unknown>)[t] as number[] | undefined)?.[0] ?? 0)
    const pages = UTIF.decode(buf).filter((p) => tag(p, 't256') && tag(p, 't257')).slice(0, 2)
    if (!pages.length) return null
    const gap = 40
    const fullW = Math.max(...pages.map((p) => tag(p, 't256')))
    const fullH = pages.reduce((h, p) => h + tag(p, 't257'), 0) + gap * (pages.length - 1)
    const scale = Math.min(1, MAX_SIDE / Math.max(fullW, fullH))
    const out = document.createElement('canvas')
    out.width = Math.max(1, Math.round(fullW * scale))
    out.height = Math.max(1, Math.round(fullH * scale))
    const g = out.getContext('2d')!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, out.width, out.height)
    g.imageSmoothingQuality = 'high'
    let y = 0
    for (const page of pages) {
      UTIF.decodeImage(buf, page)
      if (!page.width || !page.height) continue
      const rgba = UTIF.toRGBA8(page)
      const c = document.createElement('canvas')
      c.width = page.width
      c.height = page.height
      c.getContext('2d', { willReadFrequently: true })!.putImageData(new ImageData(new Uint8ClampedArray(rgba.buffer as ArrayBuffer, rgba.byteOffset, rgba.byteLength), page.width, page.height), 0, 0)
      if (blank(c)) { release(c); release(out); return null } // out of memory
      g.drawImage(c, 0, y * scale, page.width * scale, page.height * scale)
      release(c)
      y += page.height + gap
    }
    return out
  } catch {
    return null
  }
}

/** True when a drawn canvas came out empty: the browser ran out of canvas memory and drew nothing. */
function blank(c: HTMLCanvasElement) {
  const g = c.getContext('2d')!
  const first = g.getImageData(0, 0, 1, 1).data.join()
  for (let i = 1; i <= 24; i++) {
    const x = Math.floor((c.width - 1) * ((i * 7) % 25) / 24), y = Math.floor((c.height - 1) * i / 24)
    if (g.getImageData(x, y, 1, 1).data.join() !== first) return false
  }
  return first === '0,0,0,0' || first === '0,0,0,255'
}

/** Draws the picture on white (for transparent images), at most MAX_SIDE on the long side, and saves it as JPEG. */
async function toJpeg(src: CanvasImageSource & { width: number; height: number }): Promise<Blob | null> {
  for (const [side, quality] of [[MAX_SIDE, 0.9], [2600, 0.82], [2000, 0.75]] as const) {
    const scale = Math.min(1, side / Math.max(src.width, src.height))
    const c = document.createElement('canvas')
    c.width = Math.max(1, Math.round(src.width * scale))
    c.height = Math.max(1, Math.round(src.height * scale))
    const g = c.getContext('2d', { willReadFrequently: true })!
    g.fillStyle = '#fff'
    g.fillRect(0, 0, c.width, c.height)
    g.imageSmoothingQuality = 'high'
    g.drawImage(src, 0, 0, c.width, c.height)
    if (blank(c)) { release(c); continue } // out of memory: try again smaller
    const blob = await new Promise<Blob | null>((res) => c.toBlob(res, 'image/jpeg', quality))
    release(c)
    if (blob && blob.size <= MAX_UPLOAD) return blob
  }
  return null
}

/** Checks one picked file and returns the file to read and upload (or a message for the customer). */
export async function prepareUpload(file: File): Promise<Prepared> {
  const name = file.name || 'document'
  if (!file.size) return { ok: false, error: `${name} is empty. Please pick the file again.` }
  if (file.size > MAX_INPUT) return { ok: false, error: `${name} is too large (over 60 MB).` }
  const kind = await sniff(file)
  if (kind === 'other') return { ok: false, error: `${name}: please upload a photo (any image type) or a PDF.` }
  if (kind === 'pdf' && file.size > MAX_UPLOAD) return { ok: false, error: `${name} is over 10 MB. Please upload a smaller PDF, or photos of the pages.` }

  const keep = KEEP[kind]
  if (keep && file.size <= MAX_UPLOAD) {
    // same bytes, with a name and type that match what the file really is ("IMG_01.jfif" → "IMG_01.jpg")
    const fixed = file.type === keep.mime && name.toLowerCase().endsWith(`.${keep.ext}`)
    return { ok: true, converted: false, file: fixed ? file : new File([file], `${baseName(name)}.${keep.ext}`, { type: keep.mime, lastModified: file.lastModified }) }
  }

  const img = kind === 'heic' ? await decodeHeic(file) : kind === 'tiff' ? await decodeTiff(file) : await decodeNative(file)
  if (!img) return { ok: false, error: `We couldn't open ${name}. Please upload it as a JPG photo or a PDF.` }
  try {
    const jpeg = await toJpeg(img)
    if (!jpeg) return { ok: false, error: `We couldn't prepare ${name}. Please try another photo.` }
    return { ok: true, converted: true, file: new File([jpeg], `${baseName(name)}.jpg`, { type: 'image/jpeg', lastModified: file.lastModified }) }
  } finally {
    (img as { close?: () => void }).close?.() // free the decoded bitmap's memory
    if (img instanceof HTMLCanvasElement) release(img)
  }
}
