import { cloudinarySignature, errorResponse, json, verifyFirebaseToken, type CloudflareEnv } from '../../_shared'

/**
 * Returns a short-lived (10 min) signed Cloudinary link to one private document: admins can open any,
 * customers can open only their own (path insurance/{their uid}/...).
 * Customers' uploads live under insurance/{uid}/{requestId}/doc_{n}.{ext} as `authenticated` raw assets.
 */
export async function onRequestPost({ request, env }: { request: Request; env: CloudflareEnv }) {
  try {
    const identity = await verifyFirebaseToken(request, env)
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      return errorResponse('Cloudinary is not configured (set CLOUDINARY_* secrets).', 503)
    }
    const { publicId } = (await request.json()) as { publicId?: unknown }
    if (typeof publicId !== 'string' || !/^insurance\/[A-Za-z0-9_-]+\/[0-9a-f-]{36}\/doc_\d\.(pdf|jpg|png|webp)$/i.test(publicId)) {
      return errorResponse('That document reference is not valid.', 400)
    }
    if (!identity.isAdmin && publicId.split('/')[1] !== identity.uid) return errorResponse('You cannot open this document.', 403)
    const format = publicId.split('.').pop() as string
    const now = Math.floor(Date.now() / 1000)
    const params = { expires_at: now + 600, format, public_id: publicId, timestamp: now, type: 'authenticated' }
    const signature = await cloudinarySignature(params, env.CLOUDINARY_API_SECRET)
    const url = new URL(`https://api.cloudinary.com/v1_1/${encodeURIComponent(env.CLOUDINARY_CLOUD_NAME)}/raw/download`)
    for (const [k, v] of Object.entries(params)) url.searchParams.set(k, String(v))
    url.searchParams.set('signature', signature)
    url.searchParams.set('api_key', env.CLOUDINARY_API_KEY)
    return json({ url: url.toString() })
  } catch (error) {
    console.error('Document download authorization failed', error instanceof Error ? error.message : 'unknown')
    return errorResponse(error instanceof Error ? error.message : 'Could not authorize document access.', 401)
  }
}
