import { cloudinarySignature, errorResponse, json, verifyFirebaseToken, type CloudflareEnv } from '../../_shared'

/**
 * Returns a short-lived signed upload payload for one private (authenticated) Cloudinary asset.
 * The API secret stays on the server; the browser uploads the file straight to Cloudinary.
 */
export async function onRequestPost({ request, env }: { request: Request; env: CloudflareEnv }) {
  try {
    const identity = await verifyFirebaseToken(request, env)
    if (!identity.phoneNumber) return errorResponse('Verify your mobile number before uploading documents.', 403)
    const { requestId, index, extension } = (await request.json()) as Record<string, unknown>
    if (typeof requestId !== 'string' || !/^[0-9a-f-]{36}$/i.test(requestId)) return errorResponse('The upload request is invalid.', 400)
    if (!Number.isInteger(index) || (index as number) < 0 || (index as number) > 9) return errorResponse('The upload request is invalid.', 400)
    const ext = String(extension || '').toLowerCase()
    // the site turns every other image type (HEIC, TIFF, AVIF, ...) into JPEG before uploading
    if (!['pdf', 'jpg', 'jpeg', 'png', 'webp'].includes(ext)) return errorResponse('Upload a photo or a PDF.', 400)
    if (!env.CLOUDINARY_CLOUD_NAME || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_API_SECRET) {
      return errorResponse('Cloudinary is not configured (set CLOUDINARY_* secrets).', 503)
    }
    const publicId = `insurance/${identity.uid}/${requestId}/doc_${index}.${ext === 'jpeg' ? 'jpg' : ext}`
    const timestamp = Math.floor(Date.now() / 1000)
    const signature = await cloudinarySignature({ public_id: publicId, timestamp, type: 'authenticated' }, env.CLOUDINARY_API_SECRET)
    return json({
      cloudName: env.CLOUDINARY_CLOUD_NAME,
      apiKey: env.CLOUDINARY_API_KEY,
      timestamp,
      signature,
      publicId,
      deliveryType: 'authenticated',
      resourceType: 'raw',
    })
  } catch (error) {
    console.error('Cloudinary signature failed', error instanceof Error ? error.message : 'unknown')
    return errorResponse(error instanceof Error ? error.message : 'Secure upload could not be prepared.', 401)
  }
}
