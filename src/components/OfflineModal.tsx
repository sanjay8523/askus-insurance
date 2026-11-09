import { useEffect, useRef, useState } from 'react'
import { AlertTriangle, ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Headphones, HeartPulse, IdCard, ScrollText, ShieldCheck, Sparkles, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { HELPLINE, inr } from '../lib/products'
import {
  ADDON_OPTIONS, INSURERS, NCB_OPTIONS, OFFLINE_CASHBACK, PREV_POLICY_TYPES, emptyForm, normReg, submitOfflineRequest, validateStep,
  type OfflineForm, type OfflineType,
} from '../lib/offline'
import { scanDocument, warmUpReader, type ScanKind } from '../lib/ocr'
import { prepareUpload } from '../lib/uploadFiles'
import type { PolicyFields, RcFields } from '../lib/rcParse'
import { describeReg, formatReg, lookupVehicle } from '../lib/vehicle'
import { Button, cn } from '../ui'
import IdvCalculator from './offline/IdvCalculator'
import OfferBar from './offline/OfferBar'
import UploadCard, { type ScannedFile } from './offline/UploadCard'
import { AutoTag, Chips, Group, Option, PlateInput, Progress, Question, Row, Segmented, Two, ctl, ctlArea, STEPS } from './offline/parts'

type Screen = 'entry' | 'details' | 'owner' | 'done'
type Source = 'rc' | 'policy' | 'lookup'
const ORDER: Exclude<Screen, 'done'>[] = ['entry', 'details', 'owner']
const PER_KIND = 2
let seq = 0
const nextId = () => `f${++seq}`

const Heading = ({ step, title, sub }: { step: number; title: string; sub: string }) => (
  <header className="mb-7">
    <p className="text-xs font-semibold uppercase tracking-[.08em] text-indigo-600 max-lg:hidden">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
    <h1 tabIndex={-1} className="mt-2 text-[26px] font-semibold leading-tight tracking-tight text-zinc-900 outline-none sm:text-3xl">{title}</h1>
    <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-zinc-500">{sub}</p>
  </header>
)

export default function OfflineModal({ type, onClose }: { type: OfflineType; onClose: () => void }) {
  const { user } = useAuth()
  const noun = type === 'car' ? 'Car' : 'Bike'
  const vehicle = type === 'car' ? 'car' : 'bike'
  const dlg = useRef<HTMLDialogElement>(null)
  const [screen, setScreen] = useState<Screen>('entry')
  const [usedVehicle, setUsedVehicle] = useState(false)
  const [f, setF] = useState<OfflineForm>(() => ({
    ...emptyForm(),
    name: user?.displayName ?? '',
    mobile: (user?.phoneNumber ?? '').replace(/^\+91/, ''),
    email: user?.email ?? '',
  }))
  const fRef = useRef(f)
  fRef.current = f
  /** Fields the customer typed themselves: documents never overwrite these. */
  const touched = useRef(new Set<keyof OfflineForm>())
  const [auto, setAuto] = useState<Partial<Record<keyof OfflineForm, Source>>>({})
  const [rcFiles, setRcFiles] = useState<ScannedFile[]>([])
  const [policyFiles, setPolicyFiles] = useState<ScannedFile[]>([])
  const [rcFound, setRcFound] = useState<RcFields>({})
  const [policyReg, setPolicyReg] = useState<string | undefined>()
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [doneId, setDoneId] = useState<string | null>(null)
  const [looking, setLooking] = useState(false)
  const [copied, setCopied] = useState(false)
  const reg = describeReg(f.regNumber)

  useEffect(() => {
    const d = dlg.current!
    d.showModal()
    warmUpReader() // start loading the document reader while the customer types the number
    return () => d.close()
  }, [])
  // the form can open before sign-in has finished loading (e.g. from a link): fill the contact details once it has
  useEffect(() => {
    if (!user) return
    const cur = fRef.current
    const free = (k: 'name' | 'mobile' | 'email') => !cur[k] && !touched.current.has(k)
    const mobile = (user.phoneNumber ?? '').replace(/^\+91/, '')
    const add: Partial<OfflineForm> = {
      ...(free('name') && user.displayName ? { name: user.displayName } : {}),
      ...(free('mobile') && mobile ? { mobile } : {}),
      ...(free('email') && user.email ? { email: user.email } : {}),
    }
    if (Object.keys(add).length) { fRef.current = { ...cur, ...add }; setF((p) => ({ ...p, ...add })) }
  }, [user])
  useEffect(() => {
    dlg.current?.scrollTo({ top: 0 })
    dlg.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
  }, [screen])

  const set = <K extends keyof OfflineForm>(k: K, v: OfflineForm[K]) => {
    touched.current.add(k)
    setAuto((a) => { if (!a[k]) return a; const n = { ...a }; delete n[k]; return n })
    setF((p) => ({ ...p, [k]: v }))
  }
  const bind = (k: keyof OfflineForm) => ({ value: f[k] as string, onChange: (e: { target: { value: string } }) => set(k, e.target.value as never) })
  const go = (s: Screen) => { setError(null); setScreen(s) }
  const toggle = (k: 'addons', v: string) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v])
  const step = screen === 'done' ? STEPS.length : ORDER.indexOf(screen)
  const cashback = inr(OFFLINE_CASHBACK[type])

  /**
   * Puts values read from documents into the form, except where the customer has typed something
   * (or, with `onlyEmpty`, anywhere a value is already filled). Returns how many fields it filled.
   */
  function fill(updates: Partial<OfflineForm>, from: Source, onlyEmpty = false) {
    const cur = fRef.current
    const apply: Partial<OfflineForm> = {}
    for (const [k, v] of Object.entries(updates) as [keyof OfflineForm, OfflineForm[keyof OfflineForm]][]) {
      if (v === undefined || v === '') continue
      if (touched.current.has(k) && cur[k]) continue
      if (onlyEmpty && cur[k] && k !== 'expiredOver90') continue
      ;(apply as Record<string, unknown>)[k] = v
    }
    if (onlyEmpty && apply.expiredOver90 && !apply.prevExpiry) delete apply.expiredOver90 // follows the expiry date it was worked out from
    const keys = (Object.keys(apply) as (keyof OfflineForm)[]).filter((k) => k !== 'addressSource' && k !== 'expiredOver90')
    if (!Object.keys(apply).length) return 0
    fRef.current = { ...fRef.current, ...apply }
    setF((p) => ({ ...p, ...apply }))
    setAuto((a) => ({ ...a, ...Object.fromEntries(keys.map((k) => [k, from])) }))
    return keys.length
  }

  /** Previous-policy fields in the form's own wording (only values the dropdowns offer). */
  const policyUpdates = (p: PolicyFields): Partial<OfflineForm> => ({
    prevInsurer: p.prevInsurer && INSURERS.includes(p.prevInsurer) ? p.prevInsurer : undefined,
    prevPolicyType: p.prevPolicyType && PREV_POLICY_TYPES.includes(p.prevPolicyType) ? p.prevPolicyType : undefined,
    prevExpiry: p.prevExpiry,
    expiredOver90: p.prevExpiry ? (Date.now() - new Date(p.prevExpiry).getTime() > 90 * 86400000 ? 'Yes' : 'No') : undefined,
    ncb: p.ncb && NCB_OPTIONS.includes(p.ncb) ? p.ncb : undefined,
  })

  function applyRc(r: RcFields) {
    setRcFound((prev) => {
      const n = { ...prev } as Record<string, string>
      for (const [k, v] of Object.entries(r)) if (v && !n[k]) n[k] = v
      return n as RcFields
    })
    let filled = fill({
      regNumber: r.regNumber ? formatReg(r.regNumber) : undefined,
      makeModel: r.makeModel, fuel: r.fuel, registrationDate: r.registrationDate, manufactureMonth: r.manufactureMonth,
      name: r.ownerName, gender: r.gender,
    }, 'rc')
    if ((r.address || r.city || r.pincode) && fRef.current.addressSource !== 'new') {
      filled += fill({ address: r.address, city: r.city, pincode: r.pincode, addressSource: 'rc' }, 'rc')
    }
    // mParivahan / DigiLocker RCs also show the insurer and "Insurance upto": use them unless the policy already did
    if (r.prevExpiry || r.prevInsurer) filled += fill(policyUpdates({ prevExpiry: r.prevExpiry, prevInsurer: r.prevInsurer }), 'rc', true)
    return filled
  }

  function applyPolicy(p: PolicyFields) {
    if (p.regNumber) setPolicyReg(p.regNumber)
    return fill(policyUpdates(p), 'policy')
  }

  /** Adds files (a photo in any format, or a PDF), prepares each one and reads it straight away. */
  function addFiles(kind: ScanKind, list: FileList | null) {
    if (!list?.length) return
    const incoming = Array.from(list)
    setError(null)
    const setList = kind === 'rc' ? setRcFiles : setPolicyFiles
    const room = PER_KIND - (kind === 'rc' ? rcFiles : policyFiles).length
    const entries: ScannedFile[] = incoming.slice(0, Math.max(0, room)).map((file) => ({ id: nextId(), file, status: 'reading', found: 0 }))
    if (incoming.length > entries.length) setError(`You can add up to ${PER_KIND} files here.`)
    if (!entries.length) return
    setList((p) => [...p, ...entries])
    for (const e of entries) {
      void (async () => {
        // HEIC, TIFF and other formats become a JPEG here; JPG, PNG, WebP and PDF stay as they are
        const prepared = await prepareUpload(e.file)
        if (!prepared.ok) {
          setList((p) => p.filter((x) => x.id !== e.id))
          setError(prepared.error)
          return
        }
        setList((p) => p.map((x) => (x.id === e.id ? { ...x, file: prepared.file } : x)))
        const r = await scanDocument(prepared.file, kind)
        // the count shown is what actually went into the form (not fields the customer already typed)
        const filled = r.ok && r.found ? (kind === 'rc' ? applyRc(r.fields) : applyPolicy(r.fields)) : 0
        setList((p) => p.map((x) => (x.id === e.id ? { ...x, status: r.ok ? (r.found ? 'done' : 'none') : r.reason, found: filled } : x)))
      })()
    }
  }

  const reading = [...rcFiles, ...policyFiles].some((e) => e.status === 'reading')
  const rcPlate = rcFound.regNumber
  const plateMismatch = !f.isNew && !!rcPlate && !!f.regNumber && normReg(f.regNumber) !== rcPlate
  const policyMismatch = !f.isNew && !!policyReg && !!f.regNumber && normReg(f.regNumber) !== policyReg
  const filledCount = Object.keys(auto).length
  const fromSources = [...new Set(Object.values(auto))].map((s) => (s === 'rc' ? 'RC' : s === 'policy' ? 'policy' : 'vehicle records')).join(' and ')

  async function continueFromEntry() {
    const bad = validateStep(1, f)
    if (bad) return setError(bad)
    if (!f.isNew && !rcFiles.length) return setError('Upload your RC (a photo or PDF) to continue.')
    if (reading) return setError('One moment, we are still reading your documents.')
    setError(null)
    if (user && !f.isNew) {
      // optional paid vehicle lookup (only if configured on the server); fills only what is still empty
      setLooking(true)
      const v = await lookupVehicle(f.regNumber)
      setLooking(false)
      if (v) fill({ makeModel: v.makeModel, variant: v.variant, fuel: v.fuel, registrationDate: v.registrationDate, manufactureMonth: v.manufactureMonth, prevInsurer: v.prevInsurer, prevExpiry: v.prevExpiry }, 'lookup')
    }
    go('details')
  }

  async function submit() {
    const bad = validateStep(3, f)
    if (bad) return setError(bad)
    if (!user) return setError('Please sign in to submit.')
    setError(null)
    setBusy(true)
    try {
      const docs = [...rcFiles.map((e) => ({ kind: 'rc' as const, file: e.file })), ...policyFiles.map((e) => ({ kind: 'policy' as const, file: e.file }))]
      setDoneId(await submitOfflineRequest(user.uid, type, f, docs))
      setScreen('done')
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not submit. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  function addressMode(mode: 'rc' | 'new') {
    if (mode === 'new') {
      for (const k of ['address', 'city', 'pincode'] as const) touched.current.add(k)
      setF((p) => ({ ...p, address: '', city: '', pincode: '', addressSource: 'new' }))
    } else {
      for (const k of ['address', 'city', 'pincode'] as const) touched.current.delete(k)
      setF((p) => ({ ...p, address: rcFound.address ?? '', city: rcFound.city ?? '', pincode: rcFound.pincode ?? '', addressSource: 'rc' }))
    }
    setAuto((a) => { const n = { ...a }; delete n.address; delete n.city; delete n.pincode; return mode === 'rc' ? { ...n, address: 'rc', city: 'rc', pincode: 'rc' } : n })
  }

  const stepErr = (n: number, next: Screen) => { const bad = validateStep(n, f); if (bad) setError(bad); else go(next) }
  const ref = doneId?.slice(0, 8).toUpperCase() ?? ''
  const hasRcAddress = !!(rcFound.address || rcFound.city || rcFound.pincode)
  const addons = f.policyType === 'Comprehensive' ? ADDON_OPTIONS : ADDON_OPTIONS.filter((a) => a === 'Personal Accident Cover')

  const footer = screen !== 'done' && (
    <div className="sticky bottom-0 z-10 border-t border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-[760px] px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        {error && <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"><X size={16} className="mt-0.5 shrink-0" />{error}</p>}
        <div className="flex gap-3">
          {screen !== 'entry' && <Button size="sm" className="h-12 px-5 text-[15px]" icon={ArrowLeft} disabled={busy} onClick={() => go(ORDER[step - 1])}>Back</Button>}
          <Button variant="primary" size="sm" loading={looking || busy} className="h-12 flex-1 text-[15px] sm:ml-auto sm:flex-none sm:px-8"
            onClick={() => {
              if (screen === 'entry') void continueFromEntry()
              else if (screen === 'details') stepErr(2, 'owner')
              else void submit()
            }}>
            {screen === 'entry' ? (looking ? 'Checking…' : reading ? 'Reading documents…' : 'Continue') : screen === 'details' ? 'Next' : busy ? 'Submitting…' : 'Submit request'}
            {!(looking || busy) && <ArrowRight size={17} />}
          </Button>
        </div>
      </div>
    </div>
  )

  return (
    <dialog ref={dlg} aria-label={`${noun} insurance, offline`} onCancel={(e) => { e.preventDefault(); onClose() }}
      className="app-root m-0 h-dvh max-h-none w-full max-w-none flex-col overflow-y-auto overflow-x-hidden rounded-none border-0 bg-zinc-50 p-0 text-zinc-900 shadow-none [&[open]]:flex">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center gap-4 px-4 sm:px-6">
          <span className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white"><ShieldCheck size={17} /></span>
            <span className="text-sm font-semibold max-sm:hidden">Askus Insurance</span>
          </span>
          <div className="min-w-0 flex-1 lg:flex lg:justify-center">{screen !== 'done' && <Progress step={step} onJump={(i) => go(ORDER[i])} />}</div>
          <a href={`tel:+91${HELPLINE}`} className="hidden h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 lg:inline-flex"><Headphones size={16} />{HELPLINE}</a>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-10 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"><X size={20} /></button>
        </div>
        {screen !== 'done' && <OfferBar amount={cashback} vehicle={vehicle} step={step + 1} total={STEPS.length} />}
      </header>

      {screen === 'done' ? (
        <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-12 sm:px-6 sm:py-16">
          <div className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50"><CheckCircle2 size={28} /></span>
            <h1 tabIndex={-1} className="mt-6 text-3xl font-semibold tracking-tight outline-none">Request received{f.name.trim() ? `, ${f.name.trim().split(' ')[0]}` : ''}</h1>
            <p className="mt-4 text-lg font-semibold leading-relaxed text-zinc-900 sm:text-xl">Your offline {vehicle} insurance request is with our team. We&apos;ll call {f.mobile} within 24 hours with exact quotes.</p>
          </div>
          <div className="mt-8 flex items-center justify-between gap-4 rounded-xl border border-zinc-200 bg-white p-4">
            <div><p className="text-xs font-medium text-zinc-500">Reference</p><p className="mt-0.5 font-mono text-xl font-semibold tracking-wider">{ref}</p></div>
            <Button size="sm" icon={copied ? Check : Copy} onClick={() => navigator.clipboard?.writeText(ref).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000) }, () => {})}>{copied ? 'Copied' : 'Copy'}</Button>
          </div>
          <section className="mt-6 rounded-xl border border-zinc-200 bg-white p-5">
            <h2 className="mb-4 text-sm font-semibold">What happens next</h2>
            <ol className="space-y-5">
              {[['Our team reviews your request', 'We check your vehicle, policy history and documents.'], ['We call you with exact quotes', `Within 24 hours on ${f.mobile}.`], ['Your policy is issued', `You're eligible for up to ${cashback} cashback once it is confirmed.`]].map(([t, s], i) => (
                <li key={t} className="relative flex gap-3.5">
                  {i < 2 && <span className="absolute left-[11px] top-6 h-[calc(100%+.5rem)] w-px bg-zinc-200" />}
                  <span className={cn('relative grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold', i === 0 ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500')}>{i === 0 ? <Check size={13} strokeWidth={3} /> : i + 1}</span>
                  <div><p className="text-sm font-medium text-zinc-900">{t}</p><p className="mt-0.5 text-sm text-zinc-500">{s}</p></div>
                </li>
              ))}
            </ol>
          </section>
          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
            <a href="/account#requests" className="inline-flex h-12 items-center justify-center rounded-lg bg-indigo-600 px-6 text-[15px] font-medium text-white hover:bg-indigo-700">Track in my account</a>
            <Button className="h-12 px-6 text-[15px]" onClick={onClose}>Done</Button>
          </div>
        </main>
      ) : (
        <main className="mx-auto w-full max-w-[760px] flex-1 px-4 py-8 sm:px-6 sm:py-10">

          {/* 1. Vehicle number + documents */}
          {screen === 'entry' && (
            <form onSubmit={(e) => { e.preventDefault(); void continueFromEntry() }}>
              <Heading step={0} title={`Insure your ${vehicle} in minutes`} sub="Enter your number and upload your RC. Our AI reads your documents and fills in the details for you." />
              {type === 'car' && <div className="mb-5"><Segmented label="Vehicle status" value={usedVehicle ? 'Used vehicle' : 'Existing vehicle'} options={['Existing vehicle', 'Used vehicle'] as const} onChange={(v) => setUsedVehicle(v === 'Used vehicle')} /></div>}
              <PlateInput label={`${noun} number`} placeholder={`Enter ${vehicle} number, e.g. KA12S 2367`} value={f.regNumber} onChange={(v) => set('regNumber', formatReg(v))} disabled={f.isNew || looking} />
              <p className={cn('mt-3 min-h-5 text-sm', reg.ok ? 'font-medium text-emerald-700' : 'text-zinc-500')} aria-live="polite">
                {f.isNew ? 'Registration number not needed for a new vehicle.' : f.regNumber ? (reg.ok ? `${reg.rto ? `${reg.rto} · ` : ''}${reg.state}${reg.complete ? '' : ' · keep typing…'}` : reg.hint) : 'Letters and numbers only. We format it as you type.'}
              </p>

              {f.isNew ? (
                <div className="mt-6 border-t border-zinc-200 pt-5"><button type="button" onClick={() => set('isNew', false)} className="text-sm font-medium text-indigo-600 hover:underline">I have a registration number</button></div>
              ) : (
                <div className="mt-8 space-y-4">
                  <div>
                    <h2 className="flex items-center gap-2 text-[17px] font-semibold text-zinc-900">Upload your documents <Sparkles size={16} className="text-violet-600" /></h2>
                    <p className="mt-1 text-sm text-zinc-500">A clear photo or PDF works best. We fill in the next step from them, so there is less to type.</p>
                  </div>
                  <UploadCard title="RC (registration certificate)" what="RC" required icon={<IdCard size={19} />} max={PER_KIND}
                    hint="Front and back as photos, or the PDF from mParivahan or DigiLocker."
                    items={rcFiles} onAdd={(l) => addFiles('rc', l)} onRemove={(id) => setRcFiles((p) => p.filter((e) => e.id !== id))}
                    footer={plateMismatch && (
                      <p className="mt-3 flex flex-wrap items-center gap-x-2 gap-y-1 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                        <AlertTriangle size={15} className="shrink-0" />Your RC shows <b className="font-semibold">{formatReg(rcPlate!)}</b>.
                        <button type="button" onClick={() => set('regNumber', formatReg(rcPlate!))} className="font-medium text-indigo-700 underline">Use this number</button>
                      </p>
                    )} />
                  <UploadCard title="Previous policy" what="policy" icon={<ScrollText size={19} />} max={PER_KIND}
                    hint="Your current or last policy copy. Fills in the insurer, expiry date and NCB."
                    items={policyFiles} onAdd={(l) => addFiles('policy', l)} onRemove={(id) => setPolicyFiles((p) => p.filter((e) => e.id !== id))} />
                  <p className="flex items-start gap-2 text-xs text-zinc-500"><ShieldCheck size={14} className="mt-px shrink-0 text-emerald-600" />Your documents are stored privately and seen only by you and our team. Details are read on your own device to fill in this form, not sent anywhere else.</p>
                  <div className="border-t border-zinc-200 pt-5">
                    <button type="button" onClick={() => { set('isNew', true); set('regNumber', ''); go('details') }} className="text-sm font-medium text-indigo-600 hover:underline">No registration number yet? Insure a brand-new {vehicle}</button>
                  </div>
                </div>
              )}
              <button type="submit" className="sr-only">Continue</button>
            </form>
          )}

          {/* 2. Vehicle and previous policy details (auto-filled from the documents), then the cover */}
          {screen === 'details' && (
            <div className="space-y-9">
              <Heading step={1} title="Vehicle and policy details" sub={filledCount ? 'We filled in what we could read from your documents. Please check each detail.' : 'These help us find the right insurers and price your cover accurately.'} />
              {filledCount > 0 && (
                <div className="-mt-3 flex items-start gap-3 rounded-2xl border border-violet-200 p-4 text-sm text-violet-950" style={{ background: 'linear-gradient(90deg,#f5f3ff,#fdf4ff)' }}>
                  <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-violet-600 text-white"><Sparkles size={16} /></span>
                  <p className="text-violet-950"><b className="font-semibold">{filledCount} detail{filledCount === 1 ? '' : 's'} filled in for you</b> from your {fromSources}. Fields marked <AutoTag from="rc" /> or <AutoTag from="policy" /> came from your documents.</p>
                </div>
              )}
              <Group title="Vehicle" hint={f.isNew ? 'Brand-new vehicle: no registration yet.' : formatReg(f.regNumber)}>
                <Two>
                  <Row label="Make and model" badge={<AutoTag from={auto.makeModel} />}><input className={ctl} placeholder={type === 'car' ? 'e.g. Maruti Alto 800' : 'e.g. TVS Apache'} {...bind('makeModel')} /></Row>
                  <Row label="Variant" optional badge={<AutoTag from={auto.variant} />}><input className={ctl} placeholder="e.g. RTR 200 4V FI (200 CC)" {...bind('variant')} /></Row>
                </Two>
                <Row label="Fuel type" badge={<AutoTag from={auto.fuel} />}><select className={ctl} value={f.fuel} onChange={(e) => set('fuel', e.target.value)}>{['Petrol', 'Diesel', 'CNG', 'Electric', 'LPG'].map((x) => <option key={x}>{x}</option>)}</select></Row>
                {!f.isNew && (
                  <Two>
                    <Row label="Registration date" badge={<AutoTag from={auto.registrationDate} />}><input type="date" className={ctl} max={new Date().toISOString().slice(0, 10)} {...bind('registrationDate')} /></Row>
                    <Row label="Manufacturing month" badge={<AutoTag from={auto.manufactureMonth} />}><input type="month" className={ctl} max={new Date().toISOString().slice(0, 7)} {...bind('manufactureMonth')} /></Row>
                  </Two>
                )}
              </Group>
              {!f.isNew && (
                <Group title="Previous policy" hint={policyFiles.length ? 'From your current or last insurance policy.' : 'No policy uploaded, so please fill these in from your current or last policy.'}>
                  {policyMismatch && <p className="flex items-center gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900"><AlertTriangle size={15} className="shrink-0" />The policy you uploaded is for {formatReg(policyReg!)}, not {formatReg(f.regNumber)}. Please check it.</p>}
                  <Question label="Did your policy expire more than 90 days ago?" badge={<AutoTag from={auto.expiredOver90} />}><Segmented label="Expired over 90 days" value={f.expiredOver90} options={['No', 'Yes'] as const} onChange={(v) => set('expiredOver90', v)} /></Question>
                  <Two>
                    <Row label="Previous policy type" badge={<AutoTag from={auto.prevPolicyType} />}><select className={ctl} value={f.prevPolicyType} onChange={(e) => set('prevPolicyType', e.target.value)}><option value="">Select</option>{PREV_POLICY_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Row>
                    <Row label="Previous insurer" badge={<AutoTag from={auto.prevInsurer} />}><select className={ctl} value={f.prevInsurer} onChange={(e) => set('prevInsurer', e.target.value)}><option value="">Select</option>{INSURERS.map((x) => <option key={x}>{x}</option>)}</select></Row>
                  </Two>
                  <Row label="Existing policy expiry date" badge={<AutoTag from={auto.prevExpiry} />}><input type="date" className={ctl} {...bind('prevExpiry')} /></Row>
                  <Question label="Did you make a claim in your policy?"><Segmented label="Claim made" value={f.claimMade} options={['No', 'Yes'] as const} onChange={(v) => set('claimMade', v)} /></Question>
                  <Question label="Previous year No Claim Bonus (NCB)" badge={<AutoTag from={auto.ncb} />}><Chips label="NCB" value={f.ncb} options={NCB_OPTIONS} onChange={(v) => set('ncb', v)} /></Question>
                  <Two>
                    <Question label="Owner type"><Segmented label="Owner type" value={f.ownerType} options={['Individual', 'Corporate'] as const} onChange={(v) => set('ownerType', v)} /></Question>
                    <Question label="Did the ownership change?"><Segmented label="Ownership changed" value={f.ownershipChanged} options={['No', 'Yes'] as const} onChange={(v) => set('ownershipChanged', v)} /></Question>
                  </Two>
                </Group>
              )}
              <Group title="Cover you want" hint="Comprehensive covers your own vehicle too. Third Party covers only damage you cause to others.">
                <Segmented label="Policy type" value={f.policyType === 'Limited Third Party' ? 'Third Party' : f.policyType} options={['Comprehensive', 'Third Party'] as const} onChange={(v) => set('policyType', v)} />
              </Group>
            </div>
          )}

          {/* 3. IDV, add-ons, owner, address, declaration */}
          {screen === 'owner' && (
            <div className="space-y-9">
              <Heading step={2} title="IDV and owner details" sub="Set the value of your cover, pick any add-ons, and confirm the owner's details." />
              {f.policyType === 'Comprehensive' ? (
                <IdvCalculator vehicle={vehicle} isNew={f.isNew} registrationDate={f.registrationDate} manufactureMonth={f.manufactureMonth} value={f.idv} onChange={(v) => set('idv', v)}
                  price={f.exShowroom} setPrice={(v) => set('exShowroom', v)} accessories={f.accessoriesValue} setAccessories={(v) => set('accessoriesValue', v)}
                  direct={f.idvMode === 'direct'} setDirect={(d) => set('idvMode', d ? 'direct' : 'calc')} />
              ) : (
                <p className="rounded-2xl border border-zinc-200 bg-white p-4 text-sm text-zinc-600">You chose Third Party cover, so no IDV is needed: it pays for damage you cause to others, not for your own {vehicle}.</p>
              )}

              <Group title="Add-ons" hint="Optional extras our team will include in your quotes.">
                <div className="grid gap-2.5 sm:grid-cols-2">{addons.map((a) => <Option key={a} title={a} selected={f.addons.includes(a)} onToggle={() => toggle('addons', a)} />)}</div>
                <button type="button" role="checkbox" aria-checked={f.ayushPay} onClick={() => set('ayushPay', !f.ayushPay)}
                  className={cn('flex w-full items-start gap-3.5 rounded-xl border p-4 text-left transition-colors', f.ayushPay ? 'border-emerald-600 bg-emerald-50/60 ring-1 ring-emerald-600' : 'border-zinc-200 bg-white hover:border-zinc-300')}>
                  <span className="grid size-10 shrink-0 place-items-center rounded-lg bg-emerald-50 text-emerald-700"><HeartPulse size={19} /></span>
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2 text-[15px] font-medium text-zinc-900">AyushPay Parivar Kavach <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-semibold text-emerald-800">₹299/yr</span></span>
                    <span className="mt-0.5 block text-xs text-zinc-500">0% interest loan for hospital bills up to ₹25,000, ₹1,000 cashback on medicines and tests, 24×7 doctor on video. Backed by IndusInd. Price confirmed by our team.</span>
                  </span>
                  <span className={cn('mt-1 grid size-5 shrink-0 place-items-center rounded-md border', f.ayushPay ? 'border-emerald-600 bg-emerald-600 text-white' : 'border-zinc-300 bg-white')}>{f.ayushPay && <Check size={13} strokeWidth={3} />}</span>
                </button>
              </Group>

              <Group title="Owner" hint="As on the RC, so the policy and any claim match.">
                <Row label="Full name (as on RC)" badge={<AutoTag from={auto.name} />}><input className={ctl} autoComplete="name" {...bind('name')} /></Row>
                <Question label="Gender" badge={<AutoTag from={auto.gender} />}><Segmented label="Gender" value={f.gender} options={['Male', 'Female'] as const} onChange={(v) => set('gender', v)} /></Question>
                <Two>
                  <Row label="Mobile number"><input className={ctl} inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile" {...bind('mobile')} /></Row>
                  <Row label="Email address"><input className={ctl} type="email" autoComplete="email" placeholder="you@example.com" {...bind('email')} /></Row>
                </Two>
              </Group>

              <Group title="Address for communication" hint={hasRcAddress ? 'We read this from your RC. Choose "New address" if you have moved since.' : 'Where we should send your policy documents.'}>
                {hasRcAddress && <Segmented label="Address" value={f.addressSource === 'new' ? 'New address' : 'Address on RC'} options={['Address on RC', 'New address'] as const} onChange={(v) => addressMode(v === 'New address' ? 'new' : 'rc')} />}
                <Row label="Address" badge={<AutoTag from={auto.address} />}><textarea className={ctlArea} autoComplete="street-address" value={f.address} onChange={(e) => set('address', e.target.value)} /></Row>
                <Two>
                  <Row label="City" badge={<AutoTag from={auto.city} />}><input className={ctl} autoComplete="address-level2" {...bind('city')} /></Row>
                  <Row label="Pincode" badge={<AutoTag from={auto.pincode} />}><input className={ctl} inputMode="numeric" maxLength={6} autoComplete="postal-code" {...bind('pincode')} /></Row>
                </Two>
                <Question label={`Is the ${vehicle === 'car' ? 'car' : 'two-wheeler'} on loan?`}><Segmented label="On loan" value={f.onLoan} options={['No', 'Yes'] as const} onChange={(v) => set('onLoan', v)} /></Question>
              </Group>

              <section className="rounded-xl border border-zinc-200 bg-white p-5">
                <h2 className="text-sm font-semibold text-zinc-900">Declaration</h2>
                <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-zinc-500">
                  <li>In line with the IRDAI Master Guidelines on Anti-Money Laundering / Counter Financing of Terrorism (AML/CFT), customer information is taken for KYC implementation for insurers. By agreeing, you consent to the use of your information for the KYC check as per the IRDAI mandate.</li>
                  <li>The owner name on the policy document will be as per KYC-verified data. If it differs from the owner name on the RC, the insurer may reject claims.</li>
                </ol>
                <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg bg-zinc-50 p-3.5 text-sm font-medium text-zinc-900">
                  <input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-indigo-600" />I agree with the declarations above
                </label>
              </section>
              <p className="text-xs text-zinc-400">Final premium, IDV and insurer are confirmed by our team before anything is issued. Nothing is charged on this form.</p>
            </div>
          )}
        </main>
      )}
      {footer}
    </dialog>
  )
}
