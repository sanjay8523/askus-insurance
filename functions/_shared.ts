export interface CloudflareEnv {
  FIREBASE_PROJECT_ID: string
  CLOUDINARY_CLOUD_NAME: string
  CLOUDINARY_API_KEY: string
  CLOUDINARY_API_SECRET: string
}

export interface FirebaseIdentity {
  uid: string
  phoneNumber: string
}

let signingKeys: Promise<JsonWebKey[]> | undefined

export function json(data: unknown, status = 200) {
  return Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } })
}

export function errorResponse(message: string, status: number) {
  return json({ error: message }, status)
}

const b64 = (part: string) => {
  const base64 = part.replace(/-/g, '+').replace(/_/g, '/')
  return Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0))
}

/** Verifies a Firebase ID token (RS256) against Google's public keys. Same approach as askus-fintech. */
export async function verifyFirebaseToken(request: Request, env: CloudflareEnv): Promise<FirebaseIdentity> {
  const bearer = request.headers.get('Authorization') || ''
  const token = bearer.startsWith('Bearer ') ? bearer.slice(7) : ''
  if (!token) throw new Error('Sign in is required.')
  const parts = token.split('.')
  if (parts.length !== 3) throw new Error('Your sign-in session is invalid. Sign in again.')
  const decode = (p: string) => JSON.parse(new TextDecoder().decode(b64(p))) as Record<string, unknown>
  const header = decode(parts[0])
  const claims = decode(parts[1])
  if (header.alg !== 'RS256' || typeof header.kid !== 'string') throw new Error('Your sign-in session is invalid. Sign in again.')
  signingKeys ||= fetch('https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com').then(async (r) => {
    if (!r.ok) throw new Error('Could not verify Firebase sign-in.')
    return ((await r.json()) as { keys: JsonWebKey[] }).keys
  })
  const keys = await signingKeys
  const jwk = keys.find((k) => (k as JsonWebKey & { kid?: string }).kid === header.kid)
  if (!jwk) throw new Error('Your sign-in session is invalid. Sign in again.')
  const key = await crypto.subtle.importKey('jwk', jwk, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['verify'])
  const ok = await crypto.subtle.verify('RSASSA-PKCS1-v1_5', key, b64(parts[2]), new TextEncoder().encode(`${parts[0]}.${parts[1]}`))
  const now = Math.floor(Date.now() / 1000)
  if (
    !ok ||
    claims.aud !== env.FIREBASE_PROJECT_ID ||
    claims.iss !== `https://securetoken.google.com/${env.FIREBASE_PROJECT_ID}` ||
    typeof claims.sub !== 'string' || !claims.sub ||
    typeof claims.exp !== 'number' || claims.exp <= now ||
    typeof claims.iat !== 'number' || claims.iat > now + 60
  ) throw new Error('Your sign-in session is invalid or expired. Sign in again.')
  return { uid: claims.sub, phoneNumber: typeof claims.phone_number === 'string' ? claims.phone_number : '' }
}

export async function sha1(value: string) {
  const digest = await crypto.subtle.digest('SHA-1', new TextEncoder().encode(value))
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
}

export async function cloudinarySignature(params: Record<string, string | number | boolean>, secret: string) {
  const canonical = Object.entries(params)
    .filter(([, v]) => v !== '' && v !== null && v !== undefined)
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([k, v]) => `${k}=${v}`)
    .join('&')
  return sha1(`${canonical}${secret}`)
}
