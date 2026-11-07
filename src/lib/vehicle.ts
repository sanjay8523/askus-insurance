import { auth } from './firebase'

/** Indian RTO state / UT codes (first two letters of a registration number). */
export const STATE_CODES: Record<string, string> = {
  AN: 'Andaman & Nicobar', AP: 'Andhra Pradesh', AR: 'Arunachal Pradesh', AS: 'Assam', BR: 'Bihar', CH: 'Chandigarh',
  CG: 'Chhattisgarh', DD: 'Daman & Diu', DL: 'Delhi', DN: 'Dadra & Nagar Haveli', GA: 'Goa', GJ: 'Gujarat', HP: 'Himachal Pradesh',
  HR: 'Haryana', JH: 'Jharkhand', JK: 'Jammu & Kashmir', KA: 'Karnataka', KL: 'Kerala', LA: 'Ladakh', LD: 'Lakshadweep',
  MH: 'Maharashtra', ML: 'Meghalaya', MN: 'Manipur', MP: 'Madhya Pradesh', MZ: 'Mizoram', NL: 'Nagaland', OD: 'Odisha',
  OR: 'Odisha', PB: 'Punjab', PY: 'Puducherry', RJ: 'Rajasthan', SK: 'Sikkim', TN: 'Tamil Nadu', TR: 'Tripura', TS: 'Telangana',
  UK: 'Uttarakhand', UP: 'Uttar Pradesh', WB: 'West Bengal',
}

const STANDARD = /^([A-Z]{2})(\d{1,2})([A-Z]{1,3})(\d{1,4})$/
const BHARAT = /^(\d{2})(BH)(\d{1,4})([A-Z]{0,2})$/

/** Upper-case, drop everything except letters and digits. */
export const cleanReg = (v: string) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 11)

/**
 * Formats while the user types: ka12s2367 → KA12S 2367, 22bh1234aa → 22BH 1234 AA.
 * Anything that does not (yet) look like a plate is just upper-cased and left unspaced.
 */
export function formatReg(input: string): string {
  const v = cleanReg(input)
  const s = v.match(STANDARD)
  if (s) return `${s[1]}${s[2]}${s[3]} ${s[4]}`
  const b = v.match(BHARAT)
  if (b) return [`${b[1]}${b[2]}`, b[3], b[4]].filter(Boolean).join(' ')
  return v
}

export type RegInfo =
  | { ok: true; series: 'standard' | 'bharat'; state: string; rto: string; complete: boolean }
  | { ok: false; hint: string }

/** Free, offline check of a plate: shape, state and RTO office code. Does not prove the vehicle exists. */
export function describeReg(input: string): RegInfo {
  const v = cleanReg(input)
  if (!v) return { ok: false, hint: '' }
  const b = v.match(BHARAT)
  if (b) return { ok: true, series: 'bharat', state: 'Bharat (BH) series, valid in all states', rto: '', complete: b[3].length === 4 && b[4].length > 0 }
  const s = v.match(STANDARD)
  if (s) {
    const state = STATE_CODES[s[1]]
    if (!state) return { ok: false, hint: `"${s[1]}" is not an Indian state code.` }
    return { ok: true, series: 'standard', state, rto: `${s[1]}-${s[2].padStart(2, '0')}`, complete: s[4].length === 4 }
  }
  if (/^[A-Z]{2}/.test(v) && !STATE_CODES[v.slice(0, 2)] && v.length >= 2) return { ok: false, hint: `"${v.slice(0, 2)}" is not an Indian state code.` }
  return { ok: false, hint: 'Format: state code, RTO number, series letters, 4 digits (for example KA12S 2367).' }
}

export type VehicleLookup = { makeModel?: string; variant?: string; fuel?: string; registrationDate?: string; manufactureMonth?: string; prevInsurer?: string; prevExpiry?: string }

/**
 * Asks our server to look the plate up with a paid RC-data provider (if one is configured).
 * Returns null when lookup is unavailable or finds nothing, so the form simply stays manual.
 */
export async function lookupVehicle(regNumber: string): Promise<VehicleLookup | null> {
  try {
    const token = await auth.currentUser?.getIdToken()
    if (!token) return null
    const res = await fetch('/api/vehicle/lookup', {
      method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ regNumber: cleanReg(regNumber) }),
    })
    if (!res.ok) return null
    const body = (await res.json()) as { vehicle?: VehicleLookup }
    return body.vehicle && Object.values(body.vehicle).some(Boolean) ? body.vehicle : null
  } catch { return null }
}
