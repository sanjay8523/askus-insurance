import { errorResponse, json, verifyFirebaseToken, type CloudflareEnv } from '../../_shared'
import { countFound, parsePolicy, parseRc } from '../../../src/lib/rcParse'

type Env = CloudflareEnv & { GOOGLE_VISION_API_KEY?: string }

const TYPES = ['image/jpeg', 'image/png', 'application/pdf']
/** Google Vision accepts requests up to 10MB; base64 grows files by a third, so ~7MB of file at most. */
const MAX_BASE64 = 9_400_000

type VisionPage = { fullTextAnnotation?: { text?: string }; error?: { message?: string } }

/**
 * Reads an RC or a previous policy with Google Cloud Vision (document text detection) and returns form fields.
 * The API key stays on the server. The raw text is never stored or returned, only the parsed fields.
 * Answers 501 until GOOGLE_VISION_API_KEY is set, and the form then simply stays manual.
 */
export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  let phone = ''
  try { phone = (await verifyFirebaseToken(request, env)).phoneNumber } catch (e) { return errorResponse(e instanceof Error ? e.message : 'Sign in is required.', 401) }
  if (!phone) return errorResponse('Verify your mobile number before uploading documents.', 403)
  if (!env.GOOGLE_VISION_API_KEY) return errorResponse('Document reading is not configured yet.', 501)

  let body: { kind?: unknown; mimeType?: unknown; data?: unknown }
  try { body = await request.json() } catch { return errorResponse('The request is invalid.', 400) }
  const { kind, mimeType, data } = body
  if (kind !== 'rc' && kind !== 'policy') return errorResponse('The request is invalid.', 400)
  if (typeof mimeType !== 'string' || !TYPES.includes(mimeType)) return errorResponse('Upload a PDF, JPG or PNG file.', 400)
  if (typeof data !== 'string' || !data || data.length > MAX_BASE64 || !/^[A-Za-z0-9+/=]+$/.test(data.slice(0, 200))) {
    return errorResponse('This file is too large to read automatically.', 413)
  }

  const isPdf = mimeType === 'application/pdf'
  const features = [{ type: 'DOCUMENT_TEXT_DETECTION' }]
  const imageContext = { languageHints: ['en', 'hi'] }
  const payload = isPdf
    ? { requests: [{ inputConfig: { mimeType, content: data }, features, imageContext }] } // first 5 pages by default
    : { requests: [{ image: { content: data }, features, imageContext }] }

  let res: Response
  try {
    res = await fetch(`https://vision.googleapis.com/v1/${isPdf ? 'files' : 'images'}:annotate?key=${encodeURIComponent(env.GOOGLE_VISION_API_KEY)}`, {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload),
    })
  } catch {
    return errorResponse('We could not read this document right now.', 502)
  }
  if (!res.ok) {
    console.error('Google Vision request failed', res.status)
    return errorResponse('We could not read this document right now.', 502)
  }
  const out = (await res.json()) as { responses?: (VisionPage & { responses?: VisionPage[] })[] }
  const pages: VisionPage[] = isPdf ? out.responses?.[0]?.responses ?? [] : out.responses ? [out.responses[0]] : []
  const text = pages.map((p) => p?.fullTextAnnotation?.text ?? '').join('\n')

  const fields = kind === 'rc' ? parseRc(text) : parsePolicy(text)
  return json({ fields, found: countFound(fields) })
}
