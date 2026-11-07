import { errorResponse, json, verifyFirebaseToken, type CloudflareEnv } from '../../_shared'

type Env = CloudflareEnv & { VEHICLE_API_URL?: string; VEHICLE_API_KEY?: string }

const FUELS: Record<string, string> = { PETROL: 'Petrol', DIESEL: 'Diesel', CNG: 'CNG', LPG: 'LPG', ELECTRIC: 'Electric', EV: 'Electric', BATTERY: 'Electric' }
const str = (v: unknown) => (typeof v === 'string' ? v.trim() : '')

/** Maps a provider's RC record onto our form fields. Written for Surepass `rc-full`; other providers need a small tweak here. */
function mapRecord(d: Record<string, unknown>) {
  const fuelRaw = str(d.fuel_type).toUpperCase()
  const fuel = Object.entries(FUELS).find(([k]) => fuelRaw.includes(k))?.[1] ?? ''
  const reg = str(d.registration_date).slice(0, 10)
  const mfg = str(d.manufacturing_date_formatted) || str(d.manufacturing_date)
  const mm = mfg.match(/^(\d{4})-(\d{2})/) ?? mfg.match(/^(\d{1,2})[/-](\d{4})/)
  const manufactureMonth = !mm ? '' : mm[1].length === 4 ? `${mm[1]}-${mm[2]}` : `${mm[2]}-${mm[1].padStart(2, '0')}`
  const expiry = str(d.insurance_upto).slice(0, 10)
  return {
    makeModel: [str(d.maker_description), str(d.maker_model)].filter(Boolean).join(' '),
    variant: '',
    fuel,
    registrationDate: /^\d{4}-\d{2}-\d{2}$/.test(reg) ? reg : '',
    manufactureMonth,
    prevInsurer: str(d.insurance_company),
    prevExpiry: /^\d{4}-\d{2}-\d{2}$/.test(expiry) ? expiry : '',
  }
}

/**
 * Looks up a registration number with a third-party RC-data provider.
 * There is no free public API for this in India (Parivahan/VAHAN is not open), so it only works once
 * VEHICLE_API_URL and VEHICLE_API_KEY are set; otherwise it answers 501 and the form stays manual.
 */
export async function onRequestPost({ request, env }: { request: Request; env: Env }) {
  try {
    await verifyFirebaseToken(request, env)
  } catch (e) { return errorResponse(e instanceof Error ? e.message : 'Sign in is required.', 401) }
  if (!env.VEHICLE_API_URL || !env.VEHICLE_API_KEY) return errorResponse('Vehicle lookup is not configured.', 501)
  const { regNumber } = (await request.json().catch(() => ({}))) as { regNumber?: unknown }
  const reg = typeof regNumber === 'string' ? regNumber.toUpperCase().replace(/[^A-Z0-9]/g, '') : ''
  if (!/^[A-Z]{2}\d{1,2}[A-Z]{1,3}\d{1,4}$/.test(reg) && !/^\d{2}BH\d{4}[A-Z]{1,2}$/.test(reg)) return errorResponse('Enter a valid registration number.', 400)
  try {
    const res = await fetch(env.VEHICLE_API_URL, {
      method: 'POST', headers: { Authorization: `Bearer ${env.VEHICLE_API_KEY}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ id_number: reg }),
    })
    if (!res.ok) return errorResponse('No details found for this number.', 404)
    const body = (await res.json()) as { data?: Record<string, unknown> }
    if (!body.data) return errorResponse('No details found for this number.', 404)
    // Owner name and other personal fields are deliberately not passed to the browser.
    return json({ vehicle: mapRecord(body.data) })
  } catch (e) {
    console.error('Vehicle lookup failed', e instanceof Error ? e.message : 'unknown')
    return errorResponse('Vehicle lookup is unavailable right now.', 502)
  }
}
