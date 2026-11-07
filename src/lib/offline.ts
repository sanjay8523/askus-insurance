import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { db } from './firebase'
import { uploadDocument, type UploadedDoc } from './cloudinary'
import { normMobile } from './validate'
import { describeReg } from './vehicle'

export type OfflineType = 'car' | 'bike'

/** "Up to" cashback shown for offline requests. */
export const OFFLINE_CASHBACK: Record<OfflineType, number> = { car: 500, bike: 300 }

export const INSURERS = [
  'Acko General', 'Bajaj Allianz', 'Cholamandalam MS', 'Digit', 'Future Generali', 'HDFC ERGO', 'ICICI Lombard',
  'IFFCO Tokio', 'Kotak General', 'Liberty General', 'National Insurance', 'New India Assurance', 'Oriental Insurance',
  'Raheja QBE', 'Reliance General', 'Royal Sundaram', 'SBI General', 'Shriram General', 'Tata AIG', 'United India',
  'Universal Sompo', 'Zuno General', 'Other / not sure',
]
export const PREV_POLICY_TYPES = ['Comprehensive', 'Third Party', 'Own Damage only', 'Not sure']
export const NCB_OPTIONS = ['0%', '20%', '25%', '35%', '45%', '50%']

export type OfflineForm = {
  // step 1: vehicle number
  regNumber: string
  isNew: boolean
  // step 2: vehicle + previous policy
  makeModel: string
  variant: string
  fuel: string
  registrationDate: string
  manufactureMonth: string
  policyType: 'Comprehensive' | 'Third Party' | 'Limited Third Party'
  expiredOver90: 'Yes' | 'No'
  prevPolicyType: string
  prevInsurer: string
  prevExpiry: string
  claimMade: 'Yes' | 'No'
  ncb: string
  ownerType: 'Individual' | 'Corporate'
  ownershipChanged: 'Yes' | 'No'
  // quotes step (what the customer would like us to quote)
  insurers: string[]
  addons: string[]
  idv: string
  ayushPay: boolean
  // owner (proposal form)
  name: string
  gender: 'Male' | 'Female' | ''
  mobile: string
  email: string
  address: string
  city: string
  pincode: string
  onLoan: 'Yes' | 'No'
  // step 4
  consent: boolean
}

export const emptyForm = (): OfflineForm => ({
  regNumber: '', isNew: false,
  makeModel: '', variant: '', fuel: 'Petrol', registrationDate: '', manufactureMonth: '',
  policyType: 'Comprehensive', expiredOver90: 'No', prevPolicyType: '', prevInsurer: '', prevExpiry: '',
  claimMade: 'No', ncb: '0%', ownerType: 'Individual', ownershipChanged: 'No',
  insurers: [], addons: [], idv: '', ayushPay: false,
  name: '', gender: '', mobile: '', email: '', address: '', city: '', pincode: '', onLoan: 'No',
  consent: false,
})

export const normReg = (v: string) => v.toUpperCase().replace(/[\s-]/g, '')
/** Standard (KA12S2367 / KA12AB1234) and Bharat series (22BH1234AA) registration numbers. */
export const validReg = (v: string) => /^[A-Z]{2}\d{1,2}[A-Z]{0,3}\d{4}$/.test(v) || /^\d{2}BH\d{4}[A-Z]{1,2}$/.test(v)

export function validateStep(step: number, f: OfflineForm): string | null {
  const today = new Date().toISOString().slice(0, 10)
  if (step === 1) {
    if (f.isNew) return null
    const r = describeReg(f.regNumber)
    if (!r.ok && r.hint.includes('state code')) return r.hint
    return validReg(normReg(f.regNumber)) ? null : 'Enter a valid registration number (for example KA12S 2367).'
  }
  if (step === 2) {
    if (f.makeModel.trim().length < 2) return 'Enter the vehicle make and model.'
    if (!f.isNew) {
      if (!f.registrationDate || f.registrationDate > today) return 'Enter the registration date.'
      if (!f.manufactureMonth) return 'Enter the manufacturing month.'
      if (!f.prevPolicyType) return 'Select the previous policy type.'
      if (!f.prevInsurer) return 'Select the previous insurer.'
      if (!f.prevExpiry) return 'Enter the existing policy expiry date.'
    }
    return null
  }
  if (step === 3) {
    if (f.name.trim().length < 2 || !/^[\p{L}][\p{L} .'-]*$/u.test(f.name.trim())) return "Enter the owner's full name as on the RC."
    if (!f.gender) return "Select the owner's gender."
    if (!/^[6-9]\d{9}$/.test(normMobile(f.mobile))) return 'Enter a valid 10-digit mobile number.'
    if (f.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(f.email.trim())) return 'Enter a valid email address.'
    if (f.address.trim().length < 5) return 'Enter the address for communication.'
    if (f.city.trim().length < 2) return 'Enter the city.'
    if (!/^\d{6}$/.test(f.pincode.trim())) return 'Enter a valid 6-digit pincode.'
    return null
  }
  if (step === 4 && !f.consent) return 'Please accept the declaration to continue.'
  return null
}

export async function submitOfflineRequest(uid: string, type: OfflineType, f: OfflineForm, files: File[]) {
  const requestId = crypto.randomUUID()
  const documents: UploadedDoc[] = []
  for (const [i, file] of files.entries()) documents.push(await uploadDocument(requestId, i, file))
  const t = (v: string) => v.trim()
  await setDoc(doc(db, 'offlineRequests', requestId), {
    uid,
    vehicleType: type,
    status: 'new',
    source: 'offline',
    cashbackUpTo: OFFLINE_CASHBACK[type],
    createdAt: serverTimestamp(),
    applicant: {
      name: t(f.name), gender: f.gender, mobile: normMobile(f.mobile), email: t(f.email),
      address: t(f.address), city: t(f.city), pincode: t(f.pincode), onLoan: f.onLoan,
    },
    vehicle: {
      isNew: f.isNew, regNumber: f.isNew ? '' : normReg(f.regNumber), makeModel: t(f.makeModel), variant: t(f.variant),
      fuel: f.fuel, registrationDate: f.registrationDate, manufactureMonth: f.manufactureMonth,
    },
    policy: {
      policyType: f.policyType, expiredOver90: f.expiredOver90, prevPolicyType: f.prevPolicyType,
      prevInsurer: f.prevInsurer, prevExpiry: f.prevExpiry, claimMade: f.claimMade, ncb: f.ncb,
      ownerType: f.ownerType, ownershipChanged: f.ownershipChanged,
    },
    plan: { insurers: f.insurers, addons: f.addons, preferredIdv: f.idv.trim(), ayushPay: f.ayushPay },
    documents,
  })
  return requestId
}

/** Insurers shown on the quotes step (ids are the logo ids in the partner's image set). */
export const QUOTE_INSURERS: { id: number; name: string }[] = [
  { id: 139, name: 'United India Insurance' },
  { id: 107, name: 'The New India Assurance' },
  { id: 145, name: 'Shriram General Insurance' },
  { id: 111, name: 'TATA AIG' },
  { id: 194, name: 'ICICI Lombard' },
  { id: 101, name: 'Bajaj Allianz General Insurance' },
  { id: 151, name: 'Digit Insurance' },
]
export const ADDON_OPTIONS = ['Zero Depreciation', '24x7 Roadside Assistance', 'Engine Protection Cover', 'Consumables', 'Personal Accident Cover']
export const insurerLogo = (id: number) => `https://static.pbcdn.in/pbp-cdn/tw/tw2.0/insurer/${id}.png`
