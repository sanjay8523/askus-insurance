import { auth } from './firebase'

export type UploadedDoc = {
  name: string
  size: number
  mimeType: string
  publicId: string
  assetId: string
  format: string
  version: number
}

async function readJson<T>(res: Response, what: string): Promise<T> {
  const text = await res.text()
  if (!text.trim()) throw new Error(`${what} returned an empty response. Start "npm run dev" and "npm run dev:api", then open http://localhost:8788.`)
  try {
    return JSON.parse(text) as T
  } catch {
    throw new Error(`${what} returned an unexpected response (HTTP ${res.status}). Start "npm run dev" and "npm run dev:api", then open http://localhost:8788.`)
  }
}

/** Uploads one file privately to Cloudinary using a server-signed request. */
export async function uploadDocument(requestId: string, index: number, file: File): Promise<UploadedDoc> {
  const user = auth.currentUser
  if (!user) throw new Error('Sign in before uploading documents.')
  const extension = file.name.split('.').pop()?.toLowerCase() ?? ''

  const signRes = await fetch('/api/documents/sign', {
    method: 'POST',
    headers: { Authorization: `Bearer ${await user.getIdToken()}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ requestId, index, extension }),
  })
  const c = await readJson<{ error?: string; cloudName: string; apiKey: string; timestamp: number; signature: string; publicId: string; deliveryType: string }>(signRes, 'Upload service')
  if (!signRes.ok) throw new Error(c.error || 'Upload could not be prepared.')

  const form = new FormData()
  form.append('file', file)
  form.append('api_key', c.apiKey)
  form.append('timestamp', String(c.timestamp))
  form.append('signature', c.signature)
  form.append('public_id', c.publicId)
  form.append('type', c.deliveryType)

  const upRes = await fetch(`https://api.cloudinary.com/v1_1/${encodeURIComponent(c.cloudName)}/raw/upload`, { method: 'POST', body: form })
  const r = await readJson<Record<string, unknown>>(upRes, 'Cloudinary')
  if (!upRes.ok || typeof r.asset_id !== 'string' || typeof r.public_id !== 'string') {
    const msg = typeof r.error === 'object' && r.error && 'message' in r.error ? String((r.error as { message: unknown }).message) : 'Cloudinary upload failed.'
    throw new Error(msg)
  }
  return {
    name: file.name,
    size: file.size,
    mimeType: file.type || 'application/octet-stream',
    publicId: r.public_id,
    assetId: r.asset_id,
    format: String(r.format || extension),
    version: Number(r.version || 0),
  }
}
