/**
 * IDV (Insured Declared Value) calculator.
 * IDV = manufacturer's listed selling price (ex-showroom, without registration and insurance) minus depreciation for the
 * vehicle's age, per the IRDAI depreciation schedule. Accessories fitted later are depreciated the same way and added.
 * For vehicles older than 5 years IRDAI leaves the value to agreement between insurer and owner, so we show an estimate.
 */

export type DepRow = { upToMonths: number; pct: number; label: string; official: boolean }

export const DEPRECIATION: DepRow[] = [
  { upToMonths: 6, pct: 5, label: 'Not exceeding 6 months', official: true },
  { upToMonths: 12, pct: 15, label: '6 months to 1 year', official: true },
  { upToMonths: 24, pct: 20, label: '1 to 2 years', official: true },
  { upToMonths: 36, pct: 30, label: '2 to 3 years', official: true },
  { upToMonths: 48, pct: 40, label: '3 to 4 years', official: true },
  { upToMonths: 60, pct: 50, label: '4 to 5 years', official: true },
  // beyond 5 years: no official rate, insurer and owner agree a value. Indicative only.
  { upToMonths: 72, pct: 55, label: '5 to 6 years, estimate', official: false },
  { upToMonths: 84, pct: 60, label: '6 to 7 years, estimate', official: false },
  { upToMonths: 96, pct: 65, label: '7 to 8 years, estimate', official: false },
  { upToMonths: 108, pct: 70, label: '8 to 9 years, estimate', official: false },
  { upToMonths: Infinity, pct: 75, label: '9 years and above, estimate', official: false },
]

/** Whole months from a yyyy-mm-dd (or yyyy-mm) date to today. */
export function ageInMonths(from: string, now = new Date()): number | null {
  const m = from.match(/^(\d{4})-(\d{2})(?:-(\d{2}))?$/)
  if (!m) return null
  const start = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3] ?? 1))
  if (Number.isNaN(start.getTime()) || start > now) return start > now ? 0 : null
  let months = (now.getFullYear() - start.getFullYear()) * 12 + (now.getMonth() - start.getMonth())
  if (now.getDate() < start.getDate()) months -= 1
  return Math.max(0, months)
}

export const depreciationFor = (ageMonths: number) => DEPRECIATION.find((r) => ageMonths < r.upToMonths || (r.upToMonths === Infinity))!

export type IdvResult = {
  ageMonths: number
  dep: DepRow
  vehicleIdv: number
  accessoriesIdv: number
  idv: number
  /** Range insurers usually let you choose within (about 15% either side), rounded to ₹1,000. */
  min: number
  max: number
}

const round1000 = (n: number) => Math.round(n / 1000) * 1000

export function calculateIdv({ exShowroom, accessories = 0, ageMonths }: { exShowroom: number; accessories?: number; ageMonths: number }): IdvResult | null {
  if (!Number.isFinite(exShowroom) || exShowroom <= 0) return null
  const dep = depreciationFor(ageMonths)
  const keep = (100 - dep.pct) / 100
  const vehicleIdv = Math.round(exShowroom * keep)
  const accessoriesIdv = Math.round(Math.max(0, accessories) * keep)
  const idv = round1000(vehicleIdv + accessoriesIdv)
  return { ageMonths, dep, vehicleIdv, accessoriesIdv, idv, min: round1000(idv * 0.85), max: round1000(idv * 1.15) }
}

export const formatAge = (months: number) => {
  const y = Math.floor(months / 12), m = months % 12
  return [y ? `${y} yr${y > 1 ? 's' : ''}` : '', m ? `${m} mo` : ''].filter(Boolean).join(' ') || 'Less than a month'
}

/** ₹6,50,000 style (Indian digit grouping). */
export const rupees = (n: number) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)
