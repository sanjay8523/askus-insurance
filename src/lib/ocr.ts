import { auth } from './firebase'
import type { PolicyFields, RcFields } from './rcParse'

export type ScanKind = 'rc' | 'policy'
export type ScanOutcome =
  | { ok: true; fields: RcFields & PolicyFields; found: number }
  | { ok: false; reason: 'unavailable' | 'too_large' | 'failed' }

const MAX_PDF = 6_500_000

async function toBase64(blob: Blob): Promise<string> {
  const bytes = new Uint8Array(await blob.arrayBuffer())
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

/** Phone photos are often 5-10MB: resize to at most 2200px (plenty for reading text) before sending. */
async function shrinkImage(file: File): Promise<{ blob: Blob; mimeType: string }> {
  try {
    const bmp = await createImageBitmap(file)
    const scale = Math.min(1, 2200 / Math.max(bmp.width, bmp.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(bmp.width * scale)
    canvas.height = Math.round(bmp.height * scale)
    canvas.getContext('2d')!.drawImage(bmp, 0, 0, canvas.width, canvas.height)
    const blob = await new Promise<Blob | null>((res) => canvas.toBlob(res, 'image/jpeg', 0.88))
    if (blob) return { blob, mimeType: 'image/jpeg' }
  } catch { /* fall back to the original file */ }
  return { blob: file, mimeType: file.type }
}

/** Reads an RC or policy file with Google Vision (through our server) and returns the fields it found. Never throws. */
export async function scanDocument(file: File, kind: ScanKind): Promise<ScanOutcome> {
  const user = auth.currentUser
  if (!user) return { ok: false, reason: 'failed' }
  const isPdf = file.type === 'application/pdf'
  if (isPdf && file.size > MAX_PDF) return { ok: false, reason: 'too_large' }
  const { blob, mimeType } = isPdf ? { blob: file as Blob, mimeType: 'application/pdf' } : await shrinkImage(file)
  try {
    const res = await fetch('/api/ocr/scan', {
      method: 'POST',
      headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ kind, mimeType, data: await toBase64(blob) }),
    })
    if (res.status === 501) return { ok: false, reason: 'unavailable' }
    if (res.status === 413) return { ok: false, reason: 'too_large' }
    if (!res.ok) return { ok: false, reason: 'failed' }
    const body = (await res.json()) as { fields?: RcFields & PolicyFields; found?: number }
    return { ok: true, fields: body.fields ?? {}, found: body.found ?? 0 }
  } catch {
    return { ok: false, reason: 'failed' }
  }
}
