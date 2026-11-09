/**
 * Turns what we read from an Indian RC (registration certificate) or a motor policy into form fields.
 * `extractRc` / `extractPolicy` use where each piece of text sits on the page (see docLayout.ts), so they work for
 * smart-card grids, two-column PDFs, mParivahan screenshots and "Label: value" lists alike. `parseRc` / `parsePolicy`
 * read plain text line by line and fill whatever the layout reading missed.
 * Every value is checked before it is used (a real date, a known fuel, a plausible name), so a wrong guess is left empty
 * rather than filled with something odd. The customer always checks the fields.
 */
import { readLayout, type Cell, type LabelDef, type Layout } from './docLayout'

export type { Cell } from './docLayout'

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
  prevExpiry?: string // yyyy-mm-dd, "Insurance upto" on mParivahan / DigiLocker RCs
  prevInsurer?: string
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
const today = () => new Date().toISOString().slice(0, 10)
const yearsFromNow = (n: number) => { const d = new Date(); d.setFullYear(d.getFullYear() + n); return d.toISOString().slice(0, 10) }

/** Normal title case for names and places: "NEW DELHI" -> "New Delhi". */
export const properCase = (s: string) => s.toLowerCase().replace(/(^|[\s(\-'/.,])([a-z])/g, (_, p: string, c: string) => p + c.toUpperCase())

/** Variant and engine codes that stay in capitals ("SPLENDOR PLUS" → "Splendor Plus", but "CRDI" stays "CRDI"). */
const CODES = new Set(['CRDI', 'VTVT', 'DDIS', 'SHVS', 'MPFI', 'TGDI', 'GTDI', 'DOHC', 'SOHC', 'CBU', 'CKD'])
/** Title case for vehicle models: short codes like VXI, ZX, 4V stay upper case. */
export function title(s: string) {
  return s.toLowerCase().split(' ').filter(Boolean)
    .map((w) => (w.length <= 3 || /\d/.test(w) || CODES.has(w.toUpperCase()) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1))).join(' ')
}

/* ------------------------------ value checkers ------------------------------ */

/** dd-mm-yyyy, dd/mm/yy, 12-May-2020, 12 MAY 2020 → yyyy-mm-dd (or undefined). */
export function toIsoDate(s: string): string | undefined {
  let m = s.match(/\b(\d{1,2})[/\-. ](\d{1,2})[/\-. ](\d{2,4})\b/)
  if (m) {
    const y = m[3].length === 2 ? `20${m[3]}` : m[3]
    const d = Number(m[1]), mo = Number(m[2])
    if (d >= 1 && d <= 31 && mo >= 1 && mo <= 12 && y.length === 4) return `${y}-${pad(mo)}-${pad(d)}`
  }
  m = s.match(/\b(\d{1,2})[\s\-/]*([A-Za-z]{3,9})[\s\-/,]*(\d{4})\b/)
  if (m) {
    const mo = MONTHS[m[2].slice(0, 4).toUpperCase()] ?? MONTHS[m[2].slice(0, 3).toUpperCase()]
    if (mo && Number(m[1]) >= 1 && Number(m[1]) <= 31) return `${m[3]}-${mo}-${pad(m[1])}`
  }
  return undefined
}

const DATE_ANY = /\b\d{1,2}[/\-. ](?:\d{1,2}|[A-Za-z]{3,9})[/\-. ,]*\d{2,4}\b/g

/** The latest date written in `s`, within [min, max]. "From 10-12-2025 To 09-12-2026" → 2026-12-09. */
function latestDate(s: string, min: string, max: string) {
  const all = [...s.matchAll(DATE_ANY)].map((m) => toIsoDate(m[0])).filter((d): d is string => !!d && d >= min && d <= max)
  return all.sort().at(-1)
}

const regDateOf = (s: string) => { const d = toIsoDate(s); return d && d >= '1950-01-01' && d <= today() ? d : undefined }

/** "05/2019", "MAY-2019", "May 2019", "2019" → yyyy-mm. */
export function monthYearOf(s: string): string | undefined {
  const m1 = s.match(/\b(\d{1,2})[/\-.](\d{4})\b/)
  const m2 = s.match(/\b([A-Za-z]{3,9})[\s\-/,]*(\d{4})\b/)
  const m3 = s.match(/\b(19[5-9]\d|20\d{2})\b/)
  let out: string | undefined
  if (m1 && Number(m1[1]) >= 1 && Number(m1[1]) <= 12) out = `${m1[2]}-${pad(m1[1])}`
  else if (m2 && MONTHS[m2[1].slice(0, 3).toUpperCase()]) out = `${m2[2]}-${MONTHS[m2[1].slice(0, 3).toUpperCase()]}`
  else if (m3) out = `${m3[1]}-01`
  return out && out >= '1950-01' && out <= today().slice(0, 7) ? out : undefined
}

/** Finds a plate number anywhere in the text: KA12S2367, KA 12 AB 1234, 22BH1234AA. */
export function findRegNumber(text: string): string | undefined {
  const t = text.toUpperCase()
  const bh = t.match(/\b(\d{2})\s?BH\s?(\d{4})\s?([A-Z]{1,2})\b/)
  if (bh) return `${bh[1]}BH${bh[2]}${bh[3]}`
  const re = /\b([A-Z]{2})[\s.-]?(\d{1,2})[\s.-]?([A-Z]{1,3})[\s.-]?(\d{4})\b/g
  for (const m of t.matchAll(re)) if (STATE_CODES.has(m[1])) return `${m[1]}${m[2].padStart(2, '0')}${m[3]}${m[4]}`
  return undefined
}

const FUELS: [RegExp, string][] = [[/ELECTRIC|BATTERY|\bEV\b/i, 'Electric'], [/CNG/i, 'CNG'], [/LPG/i, 'LPG'], [/DIESEL/i, 'Diesel'], [/PETROL|GASOLINE/i, 'Petrol']]
const fuelOf = (s: string) => FUELS.find(([re]) => re.test(s))?.[1]

/** Words that are never part of a name, an address or a model (labels and common values of other fields). */
const LABEL_STOP = /\b(chassis|engine|maker|model|fuel|regn|registration|colou?r|class|mfg|manufactur|seating|owner|validity|body|tax|emission|insurance|serial|wheel|cubic|unladen)\b/i
const NOT_A_NAME = /\b(LTD|LIMITED|PVT|PRIVATE|INDIA|MOTORS?|GOVERNMENT|GOVT|CERTIFICATE|REGISTRATION|TRANSPORT|AUTHORITY|DEPARTMENT|PETROL|DIESEL|CNG|LPG|ELECTRIC|LMV|MCWG|SALOON|SEDAN|HATCHBACK|BHARAT|STAGE|NUMBER|DATE|ADDRESS|NAME)\b/i
const VEHICLE_CLASS = /\b(LMV(?:-?NT)?|MCWG|MCWOG|M[\s-]?CYCLE(?:\s*\/\s*SCOOTER)?|SCOOTER|MOTOR\s*CAR|MOTOR\s*CYCLE|HGV|HMV|LGV|MGV|NON[\s-]?TRANSPORT|TRANSPORT|INVALID\s*CARRIAGE)\b/gi

/** Owner name without Mr/Smt or "S/O ...", plus a gender hint from those words. */
function ownerOf(raw: string): { name: string; gender?: 'Male' | 'Female' } | undefined {
  const rel = raw.match(/\b(S\/O|D\/O|W\/O|SON OF|DAUGHTER OF|WIFE OF)\b/i)
  let owner = raw.split(/\b(?:S\s*\/\s*W\s*\/\s*D|S\/O|D\/O|W\/O|SON OF|DAUGHTER OF|WIFE OF|C\/O)\b/i)[0].replace(/[,:;|.]+$/, '').trim()
  const honorific = owner.match(/^(MR|MRS|MS|SHRI|SRI|SMT|KUMARI|KM|DR)\.?\s+/i)
  if (honorific) owner = owner.slice(honorific[0].length)
  if (!/^[A-Za-z][A-Za-z .'-]{1,79}$/.test(owner) || LABEL_STOP.test(owner) || NOT_A_NAME.test(owner) || (owner.match(/[A-Za-z]/g) ?? []).length < 3) return undefined
  const hint = (rel?.[1] ?? honorific?.[1] ?? '').toUpperCase()
  let gender: 'Male' | 'Female' | undefined
  if (/^(S\/O|SON OF|MR|SHRI|SRI)$/.test(hint)) gender = 'Male'
  else if (/^(D\/O|W\/O|DAUGHTER OF|WIFE OF|MRS|MS|SMT|KUMARI|KM)$/.test(hint)) gender = 'Female'
  return { name: properCase(owner.replace(/\s+/g, ' ')), gender }
}

/** Gender from a relation label: "S/O" or "Son of" → Male, "D/O", "W/O" → Female, "S/W/D of" → unknown. */
function genderOfRelation(label: string): 'Male' | 'Female' | undefined {
  const l = label.toUpperCase().replace(/\s+/g, '')
  if (/^(S\/W\/D|SON\/WIFE\/DAUGHTER|SON\/DAUGHTER\/WIFE|C\/O|FATHER|GUARDIAN)/.test(l)) return undefined
  if (/^(S\/O|SON)/.test(l)) return 'Male'
  if (/^(D\/O|W\/O|DAUGHTER|WIFE)/.test(l)) return 'Female'
  return undefined
}

/** Address text → address, city and pincode. Needs a house number, a comma or a pincode to count as an address. */
function addressOf(text: string): Pick<RcFields, 'address' | 'city' | 'pincode'> | undefined {
  const raw = text.replace(/\s*,\s*,+/g, ', ').replace(/^,\s*/, '').trim()
    // OCR often reads the comma before the state as a full stop: "MANGALURU. KARNATAKA"
    .replace(STATE_AFTER_DOT, ', ')
  if ((raw.match(/[A-Za-z]/g) ?? []).length < 6 || !/\d|,/.test(raw) || LABEL_STOP.test(raw.slice(0, 12))) return undefined
  const out: Pick<RcFields, 'address' | 'city' | 'pincode'> = {}
  const pin = raw.match(/\b([1-9]\d{5})\b/)
  if (pin) out.pincode = pin[1]
  const segs = raw.replace(/\b[1-9]\d{5}\b/, '').split(/[,\n]/).map((x) => x.replace(/[-–.;:]+\s*$/, '').replace(/^[-–.;:\s]+/, '').trim()).filter(Boolean)
  const kept = segs.filter((x) => !STATES.includes(x.toUpperCase().replace(/[.\s]+$/, '')))
  const city = [...kept].reverse().find((x) => /^[A-Za-z][A-Za-z .()-]{1,40}$/.test(x))
  if (city) out.city = properCase(city.replace(/\b(DIST|DISTRICT|TQ|TALUK)\.?\s*/i, ''))
  if (kept.length) out.address = properCase(kept.join(', '))
  return out.address ? out : undefined
}

/** Manufacturer names on RCs → the brand people know ("MARUTI SUZUKI INDIA LTD" → "Maruti Suzuki"). */
const BRANDS: [RegExp, string][] = [
  [/maruti/i, 'Maruti Suzuki'], [/hyundai/i, 'Hyundai'], [/\btata\b/i, 'Tata'], [/mahindra/i, 'Mahindra'], [/toyota/i, 'Toyota'], [/\bkia\b/i, 'Kia'],
  [/\bmg\s*motor|morris\s*garages/i, 'MG'], [/renault/i, 'Renault'], [/nissan/i, 'Nissan'], [/datsun/i, 'Datsun'], [/volkswagen|\bvw\b/i, 'Volkswagen'],
  [/skoda/i, 'Skoda'], [/\bford\b/i, 'Ford'], [/\bjeep\b/i, 'Jeep'], [/citroen/i, 'Citroen'], [/\bbmw\b/i, 'BMW'], [/mercedes/i, 'Mercedes-Benz'],
  [/\baudi\b/i, 'Audi'], [/volvo/i, 'Volvo'], [/jaguar|land\s*rover/i, 'Jaguar Land Rover'], [/\bbyd\b/i, 'BYD'], [/\bfiat\b/i, 'Fiat'],
  [/chevrolet|general\s*motors/i, 'Chevrolet'], [/mitsubishi/i, 'Mitsubishi'], [/force\s*motors/i, 'Force'], [/isuzu/i, 'Isuzu'],
  [/hero\s*moto\s*corp|hero\s*honda|\bhero\b/i, 'Hero'], [/honda/i, 'Honda'], [/bajaj/i, 'Bajaj'], [/\btvs\b/i, 'TVS'], [/royal\s*enfield|eicher/i, 'Royal Enfield'],
  [/yamaha/i, 'Yamaha'], [/suzuki/i, 'Suzuki'], [/\bktm\b/i, 'KTM'], [/\bather\b/i, 'Ather'], [/\bola\b/i, 'Ola'], [/\bjawa\b|classic\s*legends/i, 'Jawa'],
  [/kawasaki/i, 'Kawasaki'], [/harley/i, 'Harley-Davidson'], [/triumph/i, 'Triumph'], [/piaggio|vespa|aprilia/i, 'Piaggio'], [/okinawa/i, 'Okinawa'],
  [/revolt/i, 'Revolt'], [/\bampere\b/i, 'Ampere'], [/\bbenelli\b/i, 'Benelli'],
]

function makerOf(raw: string): string | undefined {
  const s = raw.replace(VEHICLE_CLASS, ' ').replace(/\(.*?\)/g, ' ').replace(/\s+/g, ' ').trim()
  if (!s || LABEL_STOP.test(s)) return undefined
  const brand = BRANDS.find(([re]) => re.test(s))?.[1]
  if (brand) return brand
  const clean = s.replace(/\b(LTD|LIMITED|PVT|PRIVATE|INDIA|CO|COMPANY|CORPORATION|CORP)\b\.?/gi, '').replace(/[.,]+/g, ' ').replace(/\s+/g, ' ').trim()
  return /^[A-Za-z][A-Za-z &-]{1,30}$/.test(clean) ? title(clean) : undefined
}

function modelOf(raw: string): string | undefined {
  const s = raw.replace(VEHICLE_CLASS, ' ').replace(/\bBS[\s-]?(?:[IVX]+|\d)\b/gi, ' ').replace(/\s+/g, ' ').trim()
  if (!s || s.length > 40 || LABEL_STOP.test(s) || !/[A-Za-z0-9]/.test(s)) return undefined
  return title(s)
}

/** "Maruti Suzuki" + "Swift VXI" → "Maruti Suzuki Swift VXI" (without repeating the brand). */
function makeModelOf(maker?: string, model?: string) {
  let m = model
  if (maker && m && m.split(' ')[0].toLowerCase() === maker.split(' ')[0].toLowerCase()) m = m.split(' ').slice(1).join(' ')
  const out = [maker, m].filter(Boolean).join(' ').trim()
  return out.length >= 2 ? out : undefined
}

/** Canonical names match the "Previous insurer" options in the form. */
const INSURER_ALIASES: [RegExp, string][] = [
  [/acko\s*general|\backo\b/i, 'Acko General'], [/bajaj\s*allianz|bajaj\s*general/i, 'Bajaj Allianz'], [/cholamandalam|\bchola\b/i, 'Cholamandalam MS'],
  [/go\s*digit|digit\s*general/i, 'Digit'], [/future\s*generali|generali\s*central/i, 'Future Generali'], [/hdfc\s*ergo/i, 'HDFC ERGO'],
  [/icici\s*lombard/i, 'ICICI Lombard'], [/iffco[\s-]*tokio/i, 'IFFCO Tokio'], [/kotak\s*(?:mahindra\s*)?general/i, 'Kotak General'],
  [/liberty\s*(?:videocon\s*)?general/i, 'Liberty General'], [/national\s*insurance/i, 'National Insurance'],
  [/new\s*india\s*assurance/i, 'New India Assurance'], [/oriental\s*insurance/i, 'Oriental Insurance'], [/raheja\s*qbe/i, 'Raheja QBE'],
  [/reliance\s*general/i, 'Reliance General'], [/royal\s*sundaram/i, 'Royal Sundaram'], [/sbi\s*general/i, 'SBI General'],
  [/shriram\s*general/i, 'Shriram General'], [/tata\s*aig/i, 'Tata AIG'], [/united\s*india/i, 'United India'],
  [/universal\s*sompo/i, 'Universal Sompo'], [/zuno|edelweiss\s*general/i, 'Zuno General'],
]
export const INSURER_NAMES = INSURER_ALIASES.map(([, n]) => n)
const insurerOf = (s: string) => INSURER_ALIASES.find(([re]) => re.test(s))?.[1]

function ncbOf(s: string) {
  const m = s.match(/(?:^|[^\d.,])(\d{1,2})\s*%/) ?? s.match(/^\s*(\d{1,2})\s*$/)
  return m && ['0', '20', '25', '35', '45', '50'].includes(String(Number(m[1]))) ? `${Number(m[1])}%` : undefined
}

/* ------------------------------ labels ------------------------------ */
// Only the English words of each label are matched (Hindi or regional text is removed first).
// Order matters: the first label that fits a box wins.

type RcField = 'regNumber' | 'regDate' | 'mfg' | 'owner' | 'relation' | 'address' | 'makerModel' | 'maker' | 'model' | 'fuel' | 'insExpiry' | 'insurer' | 'other'
const A = "'?" // optional apostrophe (straightened from ’ before matching)

const RC_LABELS: LabelDef<RcField>[] = [
  { field: 'makerModel', re: new RegExp(`^(?:maker|make|manufacturer)${A}s?\\.?\\s*(?:name)?\\s*[/&]\\s*model(?:\\s*name)?\\.?`, 'i') },
  { field: 'regDate', re: /^(?:date\s*of\s*(?:regn|registration|reg)\.?|regn?\.?\s*(?:date|dt)\.?|registration\s*date|regd\.?\s*(?:on|date)|registered\s*on|d\.?\s*o\.?\s*r\.?)/i },
  { field: 'other', re: /^(?:regn?\.?\s*valid(?:ity)?(?:\s*(?:upto|up\s*to|till))?|registration\s*valid(?:ity)?(?:\s*(?:upto|up\s*to|till))?|valid(?:ity)?\s*(?:upto|up\s*to|till)|regn?\.?\s*upto|fitness(?:\s*(?:upto|up\s*to|valid(?:ity)?))?|fit\.?\s*upto|tax\s*(?:upto|up\s*to|valid(?:ity)?|paid(?:\s*upto)?)|puc(?:c)?\s*(?:upto|up\s*to|valid(?:ity)?))\.?/i },
  { field: 'regNumber', re: /^(?:regn?|registration|reg|vehicle)\.?\s*(?:no|number|num|mark)\.?/i },
  { field: 'maker', re: new RegExp(`^(?:maker|manufacturer)${A}s?\\.?(?:\\s*name)?\\.?`, 'i') },
  { field: 'maker', re: /^make\.?(?:\s*name)?/i, strict: true },
  { field: 'mfg', re: /^(?:month|mon)\.?\s*(?:[/&]|and)?\s*(?:year|yr)\.?\s*of\s*(?:mfg|manufacture)\.?|^(?:date|year|month)\s*of\s*(?:mfg|manufacture)\.?|^(?:mfg|mfd|manufactur(?:ing|e))\.?\s*(?:date|dt|month|mon|year|yr)?\.?(?:\s*(?:[/&]|and)\s*(?:year|yr)\.?)?/i },
  { field: 'owner', re: new RegExp(`^(?:owner${A}s?\\s*name|name\\s*of\\s*(?:the\\s*)?(?:registered\\s*)?owner|registered\\s*owner(?:${A}s)?(?:\\s*name)?)\\.?`, 'i') },
  { field: 'owner', re: /^(?:owner|name)\.?/i, strict: true },
  { field: 'relation', re: new RegExp(`^(?:s\\s*/\\s*w\\s*/\\s*d|son\\s*/\\s*wife\\s*/\\s*daughter|son\\s*/\\s*daughter\\s*/\\s*wife|s\\s*/\\s*o|d\\s*/\\s*o|w\\s*/\\s*o|c\\s*/\\s*o|son|daughter|wife|father${A}s?(?:\\s*/\\s*husband${A}s?)?|husband${A}s?|guardian${A}s?)\\b\\.?(?:\\s*(?:of|name))?`, 'i') },
  { field: 'address', re: new RegExp(`^(?:present\\s*|permanent\\s*|current\\s*|communication\\s*|residential\\s*|owner${A}s?\\s*)?address(?:\\s*of\\s*(?:the\\s*)?owner)?\\.?`, 'i') },
  { field: 'model', re: /^(?:model\s*name|vehicle\s*model|model\s*\/\s*variant)\.?/i },
  { field: 'model', re: /^model\.?/i, strict: true },
  { field: 'fuel', re: /^fuel(?:\s*used|\s*type)?\.?/i },
  { field: 'insExpiry', re: /^insurance\s*(?:upto|up\s*to|valid(?:ity)?(?:\s*(?:upto|up\s*to|till))?|expiry(?:\s*date)?|exp\.?\s*date|end\s*date)\.?/i },
  { field: 'insurer', re: new RegExp(`^(?:insurance\\s*company(?:\\s*name)?|insurer${A}s?(?:\\s*name)?|insurance\\s*provider|insured\\s*with)\\.?`, 'i') },
  { field: 'other', re: /^(?:chassis|chasis|vin)\.?(?:\s*(?:no|number))?\.?|^(?:engine|eng\.)(?:\s*[/&]\s*motor)?\.?(?:\s*(?:no|number))?\.?|^motor\s*(?:no|number)\.?/i },
  { field: 'other', re: /^(?:vehicle\s*class|class\s*of\s*vehicle|vehicle\s*category|vehicle\s*type|type\s*of\s*vehicle|vehicle\s*description|vehicle\s*age|colou?r|body\s*type|type\s*of\s*body|seating(?:\s*capacity)?|seat(?:ing)?\s*cap\.?|standing\s*capacity|sleeper(?:\s*capacity)?|unladen(?:\s*weight)?|laden\s*weight|gross\s*(?:vehicle\s*)?weight|cubic\s*cap(?:acity)?\.?|horse\s*power|wheel\s*base|emission(?:\s*norms)?|norms|ownership(?:\s*(?:type|serial))?|owner\s*(?:sr|serial)\.?(?:\s*no\.?)?|serial\s*(?:no|number)|financ(?:ier|er|ed\s*by)|hypothecat\w*|registering\s*authority|registration\s*authority|issuing\s*authority|signature|issued\s*(?:on|by)|no\.?\s*of\s*cyl\w*|cylinders?|permit|pollution|blacklist\w*|national\s*permit|certificate\s*of\s*registration)\.?/i },
  { field: 'other', re: /^(?:class|type|cc|body|status|rto|noc|puc|tax)\.?/i, strict: true },
]

type PolicyField = 'odExpiry' | 'expiry' | 'start' | 'ncb' | 'regNumber' | 'other'
const POLICY_LABELS: LabelDef<PolicyField>[] = [
  { field: 'odExpiry', re: /^(?:od|own\s*damage)\s*(?:cover|policy|insurance)?\s*(?:period|end\s*date|expiry(?:\s*date)?|valid\s*(?:till|upto))\.?/i },
  { field: 'other', re: /^(?:tp|third\s*party|liability|act)\s*(?:cover|policy|insurance)?\s*(?:period|end\s*date|expiry(?:\s*date)?|valid\s*(?:till|upto)|start\s*date)\.?/i },
  { field: 'expiry', re: /^(?:policy\s*)?(?:end|expiry|expiration)\s*date\.?|^(?:policy\s*)?(?:expires?|expiring)\s*on\.?|^valid\s*(?:till|upto|up\s*to)\.?|^(?:period\s*of\s*(?:insurance|cover)|policy\s*period|insurance\s*period|cover(?:age)?\s*period)\.?/i },
  { field: 'expiry', re: /^(?:to|end)\.?/i, strict: true },
  { field: 'start', re: /^(?:policy\s*)?(?:start|issue|issuance|commencement|inception)\s*date\.?|^(?:valid\s*)?from\.?/i },
  { field: 'ncb', re: /^(?:ncb|no\s*claim\s*bonus)(?:\s*\(\s*ncb\s*\))?(?:\s*(?:%|percentage|discount|applicable))?\.?/i },
  { field: 'regNumber', re: /^(?:vehicle\s*)?(?:regn?|registration|reg|vehicle)\.?\s*(?:no|number|num|mark)\.?/i },
  { field: 'other', re: /^(?:policy\s*(?:no|number)|certificate\s*(?:no|number)|insured\s*(?:name|declared\s*value)|idv|total\s*idv|premium|net\s*premium|gross\s*premium|engine|chassis|make|model|cubic|seating|year\s*of\s*(?:mfg|manufacture)|nominee|financier|hypothecation)\.?/i },
]

/* ------------------------------ layout-aware readers ------------------------------ */

function pickFrom<F extends string>(doc: Layout<F>) {
  return <T,>(field: F, fn: (s: string) => T | undefined, lines = 1): T | undefined => {
    for (const v of doc.values(field, lines)) {
      const r = fn(v)
      if (r !== undefined && r !== '') return r
    }
    return undefined
  }
}

const merged = <T extends object>(primary: T, fallback: T): T => {
  const out = { ...fallback } as Record<string, unknown>
  for (const [k, v] of Object.entries(primary)) if (v !== undefined && v !== '') out[k] = v
  for (const k of Object.keys(out)) if (out[k] === undefined || out[k] === '') delete out[k]
  return out as T
}

/** RC fields from positioned text (OCR boxes or PDF text). */
export function extractRc(cells: Cell[]): RcFields {
  const doc = readLayout(cells, RC_LABELS)
  const pick = pickFrom(doc)
  const out: RcFields = {}
  out.regNumber = pick('regNumber', findRegNumber)
  const owner = pick('owner', ownerOf)
  if (owner) { out.ownerName = owner.name; out.gender = owner.gender }
  out.gender ??= doc.labels('relation').map(genderOfRelation).find(Boolean)
  Object.assign(out, pick('address', addressOf, 4))
  const both = pick('makerModel', (s) => {
    const [mk, ...md] = s.split(/\s*[/|]\s*/)
    const r = { maker: makerOf(mk), model: modelOf(md.join(' ')) }
    return r.maker || r.model ? r : undefined
  })
  out.makeModel = makeModelOf(both?.maker ?? pick('maker', makerOf), both?.model ?? pick('model', modelOf))
  out.fuel = pick('fuel', fuelOf)
  out.registrationDate = pick('regDate', regDateOf)
  out.manufactureMonth = pick('mfg', monthYearOf)
  out.prevExpiry = pick('insExpiry', (s) => latestDate(s, '2000-01-01', yearsFromNow(6)))
  out.prevInsurer = pick('insurer', insurerOf)
  return merged(out, parseRc(doc.text))
}

/** Previous-policy fields from positioned text (OCR boxes or PDF text). */
export function extractPolicy(cells: Cell[]): PolicyFields {
  const doc = readLayout(cells, POLICY_LABELS)
  const pick = pickFrom(doc)
  const range = (s: string) => latestDate(s, '2000-01-01', yearsFromNow(6))
  return merged({
    prevExpiry: pick('odExpiry', range) ?? pick('expiry', range),
    ncb: pick('ncb', ncbOf),
    regNumber: pick('regNumber', findRegNumber),
  }, parsePolicy(doc.text))
}

/* ------------------------------ plain-text readers (fallback) ------------------------------ */

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

export function parseRc(text: string): RcFields {
  const lines = linesOf(text.replace(/[’‘`´]/g, "'"))
  const out: RcFields = {}

  const labelledReg = valueAfter(lines, /\b(?:regn|registration|reg)\.?\s*(?:no|number|num)\b\.?/i)
  out.regNumber = (labelledReg && findRegNumber(labelledReg)) || findRegNumber(text)

  const ownerRaw = valueAfter(lines, /\b(?:owner'?s?\s*name|name\s*of\s*(?:the\s*)?(?:registered\s*)?owner|registered\s*owner)\b/i)
  const owner = ownerRaw ? ownerOf(ownerRaw) : undefined
  if (owner) { out.ownerName = owner.name; if (owner.gender) out.gender = owner.gender }

  // Address: lines after "Address" until the next label (at most 4 lines)
  const ai = lines.findIndex((l) => /\b(?:present\s*|permanent\s*)?address\b/i.test(l))
  if (ai >= 0) {
    const parts = [lines[ai].replace(/^.*?\baddress\b[\s:.\-–]*/i, '')]
    for (let j = ai + 1; j < lines.length && parts.length < 5; j++) {
      if (LABEL_STOP.test(lines[j]) && !/\d{6}/.test(lines[j])) break
      parts.push(lines[j])
      if (/\b[1-9]\d{5}\b/.test(lines[j])) break
    }
    Object.assign(out, addressOf(parts.filter(Boolean).join(', ')))
  }

  // "Maker / Model: HYUNDAI MOTOR INDIA LTD / I20 ASTA" on one line, or separate "Maker" and "Model" lines
  const combined = valueAfter(lines, /\bmaker'?s?\s*(?:name)?\s*\/\s*model(?:\s*name)?\b/i)
  const makerRaw = combined ?? valueAfter(lines, /\bmaker'?s?\s*(?:name|class)?\b/i)
  const modelRaw = combined?.includes('/') ? combined.split('/').slice(1).join(' ') : valueAfter(lines, /\b(?:model\s*name|model)\b/i)
  out.makeModel = makeModelOf(makerRaw ? makerOf(makerRaw.split(/\s*\/\s*/)[0]) : undefined, modelRaw ? modelOf(modelRaw) : undefined)

  const fuel = valueAfter(lines, /\bfuel(?:\s*used|\s*type)?\b/i)
  out.fuel = fuel ? fuelOf(fuel) : undefined

  const reg = valueAfter(lines, /\b(?:date\s*of\s*(?:regn|registration)|regn\.?\s*date|reg\.?\s*date|registration\s*date|d\.?o\.?r)\b/i, 2)
  out.registrationDate = reg ? regDateOf(reg) : undefined

  const mfg = valueAfter(lines, /\b(?:month\s*(?:&|and)?\s*year\s*of\s*(?:mfg|manufacture)|mfg\.?\s*(?:date|month|year|mm\/yyyy)?|manufactur(?:ing|e)\s*(?:date|month|year)|year\s*of\s*(?:mfg|manufacture))\b/i, 2)
  out.manufactureMonth = mfg ? monthYearOf(mfg) : undefined
  return merged(out, {})
}

export function parsePolicy(text: string): PolicyFields {
  const out: PolicyFields = {}
  out.prevInsurer = insurerOf(text)

  if (/standalone\s*own\s*damage|own\s*damage\s*only|\bSAOD\b|\bOD\s*only\b/i.test(text)) out.prevPolicyType = 'Own Damage only'
  else if (/package\s*policy|comprehensive|\bpackage\b/i.test(text)) out.prevPolicyType = 'Comprehensive'
  else if (/third\s*party|liability\s*only|act\s*only|\bTP\s*only\b/i.test(text)) out.prevPolicyType = 'Third Party'

  // Expiry: the latest date that follows "to / till / until / expiry / midnight of"
  const flat = text.replace(/\s+/g, ' ')
  const candidates: string[] = []
  for (const m of flat.matchAll(DATE_ANY)) {
    const before = flat.slice(Math.max(0, (m.index ?? 0) - 45), m.index)
    if (/\b(to|till|until|upto|up to|expiry|expires?|expiring|midnight\s*(?:of|on))\b[^0-9]*$/i.test(before)) {
      const iso = toIsoDate(m[0])
      if (iso && iso >= '2000-01-01' && iso <= yearsFromNow(6)) candidates.push(iso)
    }
  }
  out.prevExpiry = candidates.sort().at(-1)

  const ncb = flat.match(/\b(?:NCB|no\s*claim\s*bonus)\b[^0-9%]{0,30}(\d{1,2})\s*%/i)
  out.ncb = ncb ? ncbOf(`${ncb[1]}%`) : undefined

  out.regNumber = findRegNumber(text)
  return merged(out, {})
}

/** How many fields were actually found. */
export const countFound = (f: object) => Object.values(f).filter((v) => typeof v === 'string' && v.trim()).length
