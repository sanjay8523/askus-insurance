/**
 * Turns the raw text that OCR reads from an Indian RC (registration certificate) or a motor policy into form fields.
 * Pure functions: used by the server (Cloudflare function) after Google Vision returns the text.
 * Layouts differ by state and insurer, so every field is best-effort and the customer always checks them.
 */

export type RcFields = {
  regNumber?: string
  ownerName?: string
  gender?: 'Male' | 'Female'
  address?: string
  city?: string
  pincode?: string
  makeModel?: string
  fuel?: string
  registrationDate?: string // yyyy-mm-dd
  manufactureMonth?: string // yyyy-mm
}

export type PolicyFields = {
  prevInsurer?: string
  prevPolicyType?: string
  prevExpiry?: string // yyyy-mm-dd
  ncb?: string
  regNumber?: string
}

const STATE_CODES = new Set('AN AP AR AS BR CH CG DD DL DN GA GJ HP HR JH JK KA KL LA LD MH ML MN MP MZ NL OD OR PB PY RJ SK TN TR TS UK UP WB'.split(' '))
const STATES = ['ANDAMAN', 'ANDHRA PRADESH', 'ARUNACHAL PRADESH', 'ASSAM', 'BIHAR', 'CHANDIGARH', 'CHHATTISGARH', 'DELHI', 'GOA', 'GUJARAT', 'HARYANA',
  'HIMACHAL PRADESH', 'JAMMU', 'KASHMIR', 'JHARKHAND', 'KARNATAKA', 'KERALA', 'LADAKH', 'MADHYA PRADESH', 'MAHARASHTRA', 'MANIPUR', 'MEGHALAYA',
  'MIZORAM', 'NAGALAND', 'ODISHA', 'ORISSA', 'PUDUCHERRY', 'PONDICHERRY', 'PUNJAB', 'RAJASTHAN', 'SIKKIM', 'TAMIL NADU', 'TELANGANA', 'TRIPURA',
  'UTTAR PRADESH', 'UTTARAKHAND', 'WEST BENGAL', 'INDIA']
const STATE_AFTER_DOT = new RegExp(String.raw`\.\s+(?=(?:${STATES.join('|')})\b)`, 'gi')
const MONTHS: Record<string, string> = { JAN: '01', FEB: '02', MAR: '03', APR: '04', MAY: '05', JUN: '06', JUL: '07', AUG: '08', SEP: '09', SEPT: '09', OCT: '10', NOV: '11', DEC: '12' }

const pad = (n: number | string) => String(n).padStart(2, '0')
const linesOf = (text: string) => text.replace(/\r/g, '').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter(Boolean)

/** Normal title case for names and places: "NEW DELHI" -> "New Delhi". */
export const properCase = (s: string) => s.toLowerCase().replace(/(^|[\s(\-'/.,])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())

/** Title case for vehicle models: short codes like VXI, ZX, 4V stay upper case. */
export function title(s: string) {
  return s.toLowerCase().split(' ').filter(Boolean)
    .map((w) => (w.length <= 3 || /\d/.test(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(' ')
}

/** dd-mm-yyyy, dd/mm/yy, 12-May-2020, 12 MAY 2020 → yyyy-mm-dd (or undefined). */
export function toIsoDate(s: string): string | undefined {
  let m = s.match(/\b(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2,4})\b/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    const d = Number(m[1]), mo = Number(m[2])
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12) return `${y}-${pad(mo)}-${pad(d)}`
  }
  m = s.match(/\b(\d{1,2})[\s\-/]*([A-Za-z]{3,9})[\s\-/,]*(\d{4})\b/)
  if (m) {
    const mo = MONTHS[m[2].slice(0, 4).toUpperCase()] ?? MONTHS[m[2].slice(0, 3).toUpperCase()]
    if (mo && Number(m[1]) >= 1 && Number(m[1]) <= 31) return `${m[3]}-${mo}-${pad(m[1])}`
  }
  return undefined
}

/** Value written after a label: on the same line (after ":" or "-") or on the next line. */
function valueAfter(lines: string[], label: RegExp, maxLook = 1): string | undefined {
  for (let i = 0; i < lines.length; i++) {
    const m = lines[i].match(label)
    if (!m) continue
    const rest = lines[i].slice((m.index ?? 0) + m[0].length).replace(/^[\s:.\-–|]+/, '').trim()
    if (rest) return rest
    for (let j = 1; j <= maxLook && i + j < lines.length; j++) if (lines[i + j]) return lines[i + j]
  }
  return undefined
}

/** Finds a plate number anywhere in the text: KA12S2367, KA 12 AB 1234, 22BH1234AA. */
export function findRegNumber(text: string): string | undefined {
  const t = text.toUpperCase()
  const bh = t.match(/\b(\d{2})\s?BH\s?(\d{4})\s?([A-Z]{1,2})\b/)
  if (bh) return `${bh[1]}BH${bh[2]}${bh[3]}`
  const re = /\b([A-Z]{2})[\s-]?(\d{1,2})[\s-]?([A-Z]{1,3})[\s-]?(\d{4})\b/g
  for (const m of t.matchAll(re)) if (STATE_CODES.has(m[1])) return `${m[1]}${m[2].padStart(2, '0')}${m[3]}${m[4]}`
  return undefined
}

const FUELS: [RegExp, string][] = [[/ELECTRIC|BATTERY|\bEV\b/i, 'Electric'], [/CNG/i, 'CNG'], [/LPG/i, 'LPG'], [/DIESEL/i, 'Diesel'], [/PETROL|GASOLINE/i, 'Petrol']]
const LABEL_STOP = /\b(chassis|engine|maker|model|fuel|regn|registration|colou?r|class|mfg|manufactur|seating|owner|validity|body|tax|emission|insurance|serial|wheel|cubic|unladen)\b/i

export function parseRc(text: string): RcFields {
  const lines = linesOf(text)
  const out: RcFields = {}

  const labelledReg = valueAfter(lines, /\b(?:regn|registration|reg)\.?\s*(?:no|number|num)\b\.?/i)
  out.regNumber = (labelledReg && findRegNumber(labelledReg)) || findRegNumber(text)

  // Owner name (and a gender hint from Mr/Mrs/Shri/Smt or S/O, D/O, W/O)
  let owner = valueAfter(lines, /\b(?:owner[’'`]?s?\s*name|name\s*of\s*(?:the\s*)?(?:registered\s*)?owner|registered\s*owner)\b/i)
  if (owner) {
    const rel = owner.match(/\b(S\/O|D\/O|W\/O|SON OF|DAUGHTER OF|WIFE OF)\b/i)
    owner = owner.split(/\b(?:S\/W\/D|S\/O|D\/O|W\/O|SON OF|DAUGHTER OF|WIFE OF|C\/O)\b/i)[0].replace(/[,:;|]+$/, '').trim()
    const honorific = owner.match(/^(MR|MRS|MS|SHRI|SRI|SMT|KUMARI|KM)\.?\s+/i)
    if (honorific) owner = owner.slice(honorific[0].length)
    const hint = (rel?.[1] ?? honorific?.[1] ?? '').toUpperCase()
    if (/^(S\/O|SON OF|MR|SHRI|SRI)$/.test(hint)) out.gender = 'Male'
    else if (/^(D\/O|W\/O|DAUGHTER OF|WIFE OF|MRS|MS|SMT|KUMARI|KM)$/.test(hint)) out.gender = 'Female'
    if (!out.gender && rel) out.gender = /S\/O|SON/i.test(rel[1]) ? 'Male' : 'Female'
    if (/^[A-Za-z][A-Za-z .'-]{1,79}$/.test(owner) && !LABEL_STOP.test(owner)) out.ownerName = properCase(owner)
  }

  // Address: lines after "Address" until the next label (at most 4 lines)
  const ai = lines.findIndex((l) => /\b(?:present\s*|permanent\s*)?address\b/i.test(l))
  if (ai >= 0) {
    const first = lines[ai].replace(/^.*?\baddress\b[\s:.\-–]*/i, '')
    const parts = [first]
    for (let j = ai + 1; j < lines.length && parts.length < 5; j++) {
      if (LABEL_STOP.test(lines[j]) && !/\d{6}/.test(lines[j])) break
      parts.push(lines[j])
      if (/\b[1-9]\d{5}\b/.test(lines[j])) break
    }
    const raw = parts.join(', ').replace(/\s*,\s*,+/g, ', ').replace(/^,\s*/, '').trim()
      // OCR often reads the comma before the state as a full stop: "MANGALURU. KARNATAKA"
      .replace(STATE_AFTER_DOT, ', ')
    const pin = raw.match(/\b([1-9]\d{5})\b/)
    if (pin) out.pincode = pin[1]
    const segs = raw.replace(/\b[1-9]\d{5}\b/, '').split(/[,\n]/).map((x) => x.replace(/[-–.;:]+\s*$/, '').trim()).filter(Boolean)
    const kept = segs.filter((x) => !STATES.includes(x.toUpperCase().replace(/[.\s]+$/, '')))
    const city = [...kept].reverse().find((x) => /^[A-Za-z][A-Za-z .()-]{1,40}$/.test(x))
    if (city) out.city = properCase(city.replace(/\b(DIST|DISTRICT|TQ|TALUK)\.?\s*/i, ''))
    if (kept.length) out.address = properCase(kept.join(', '))
  }

  // Maker and model
  // "Maker / Model: HYUNDAI MOTOR INDIA LTD / I20 ASTA" on one line, or separate "Maker" and "Model" lines
  const combined = valueAfter(lines, /\bmaker[’'`]?s?\s*(?:name)?\s*\/\s*model(?:\s*name)?\b/i)
  const maker = combined ?? valueAfter(lines, /\bmaker[’'`]?s?\s*(?:name|class)?\b/i)
  const model = valueAfter(lines, /\b(?:model\s*name|model)\b/i)
  const cleanMaker = maker?.split(/\s*\/\s*/)[0].replace(/\b(LTD|LIMITED|PVT|PRIVATE|INDIA|CO)\b\.?/gi, '').replace(/\s+/g, ' ').trim()
  const cleanModel = (maker?.includes('/') ? maker.split('/').slice(1).join(' ') : model)?.replace(/\b(BS\s?[IVX\d]+)\b/i, '').trim()
  const mm = [cleanMaker, cleanModel].filter((x) => x && !LABEL_STOP.test(x)).join(' ').trim()
  if (mm.length >= 2) out.makeModel = title(mm)

  const fuel = valueAfter(lines, /\bfuel(?:\s*used|\s*type)?\b/i)
  const fuelHit = FUELS.find(([re]) => re.test(fuel ?? ''))
  if (fuelHit) out.fuel = fuelHit[1]

  const reg = valueAfter(lines, /\b(?:date\s*of\s*(?:regn|registration)|regn\.?\s*date|reg\.?\s*date|registration\s*date|d\.?o\.?r)\b/i, 2)
  const regIso = reg && toIsoDate(reg)
  if (regIso) out.registrationDate = regIso

  const mfg = valueAfter(lines, /\b(?:month\s*(?:&|and)?\s*year\s*of\s*(?:mfg|manufacture)|mfg\.?\s*(?:date|month|year|mm\/yyyy)?|manufactur\w*\s*(?:date|month|year)|year\s*of\s*(?:mfg|manufacture))\b/i, 2)
  if (mfg) {
    const m1 = mfg.match(/\b(\d{1,2})[/\-.](\d{4})\b/)
    const m2 = mfg.match(/\b([A-Za-z]{3,9})[\s\-/,]*(\d{4})\b/)
    const m3 = mfg.match(/\b(19|20)(\d{2})\b/)
    if (m1 && Number(m1[1]) >= 1 && Number(m1[1]) <= 12) out.manufactureMonth = `${m1[2]}-${pad(m1[1])}`
    else if (m2 && MONTHS[m2[1].slice(0, 3).toUpperCase()]) out.manufactureMonth = `${m2[2]}-${MONTHS[m2[1].slice(0, 3).toUpperCase()]}`
    else if (m3) out.manufactureMonth = `${m3[1]}${m3[2]}-01`
  }
  return out
}

/** Canonical names match the "Previous insurer" options in the form. */
const INSURER_ALIASES: [RegExp, string][] = [
  [/acko\s*general/i, 'Acko General'], [/bajaj\s*allianz/i, 'Bajaj Allianz'], [/cholamandalam|\bchola\b/i, 'Cholamandalam MS'],
  [/go\s*digit|digit\s*general/i, 'Digit'], [/future\s*generali/i, 'Future Generali'], [/hdfc\s*ergo/i, 'HDFC ERGO'],
  [/icici\s*lombard/i, 'ICICI Lombard'], [/iffco[\s-]*tokio/i, 'IFFCO Tokio'], [/kotak\s*(?:mahindra\s*)?general/i, 'Kotak General'],
  [/liberty\s*(?:videocon\s*)?general/i, 'Liberty General'], [/national\s*insurance/i, 'National Insurance'],
  [/new\s*india\s*assurance/i, 'New India Assurance'], [/oriental\s*insurance/i, 'Oriental Insurance'], [/raheja\s*qbe/i, 'Raheja QBE'],
  [/reliance\s*general/i, 'Reliance General'], [/royal\s*sundaram/i, 'Royal Sundaram'], [/sbi\s*general/i, 'SBI General'],
  [/shriram\s*general/i, 'Shriram General'], [/tata\s*aig/i, 'Tata AIG'], [/united\s*india/i, 'United India'],
  [/universal\s*sompo/i, 'Universal Sompo'], [/zuno|edelweiss\s*general/i, 'Zuno General'],
]
export const INSURER_NAMES = INSURER_ALIASES.map(([, n]) => n)

export function parsePolicy(text: string): PolicyFields {
  const out: PolicyFields = {}
  const hit = INSURER_ALIASES.find(([re]) => re.test(text))
  if (hit) out.prevInsurer = hit[1]

  if (/standalone\s*own\s*damage|own\s*damage\s*only|\bSAOD\b|\bOD\s*only\b/i.test(text)) out.prevPolicyType = 'Own Damage only'
  else if (/package\s*policy|comprehensive|\bpackage\b/i.test(text)) out.prevPolicyType = 'Comprehensive'
  else if (/third\s*party|liability\s*only|act\s*only|\bTP\s*only\b/i.test(text)) out.prevPolicyType = 'Third Party'

  // Expiry: the latest date that follows "to / till / until / expiry / midnight of"
  const flat = text.replace(/\s+/g, ' ')
  const dateRe = /\b\d{1,2}[/\-. ](?:\d{1,2}|[A-Za-z]{3,9})[/\-. ,]*\d{2,4}\b/g
  const candidates: string[] = []
  for (const m of flat.matchAll(dateRe)) {
    const before = flat.slice(Math.max(0, (m.index ?? 0) - 45), m.index)
    if (/\b(to|till|until|upto|up to|expiry|expires?|expiring|midnight\s*(?:of|on))\b[^0-9]*$/i.test(before)) {
      const iso = toIsoDate(m[0])
      if (iso) candidates.push(iso)
    }
  }
  if (candidates.length) out.prevExpiry = candidates.sort().at(-1)

  const ncb = flat.match(/\b(?:NCB|no\s*claim\s*bonus)\b[^0-9%]{0,30}(\d{1,2})\s*%/i)
  if (ncb && ['0', '20', '25', '35', '45', '50'].includes(String(Number(ncb[1])))) out.ncb = `${Number(ncb[1])}%`

  out.regNumber = findRegNumber(text)
  return out
}

/** How many fields were actually found (used to tell the customer what was filled). */
export const countFound = (f: object) => Object.values(f).filter((v) => typeof v === 'string' && v.trim()).length
