import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Check, CheckCircle2, Copy, Headphones, ShieldCheck, X } from 'lucide-react'
import { useAuth } from '../context/AuthContext'
import { HELPLINE, inr } from '../lib/products'
import {
  ADDON_OPTIONS, INSURERS, NCB_OPTIONS, OFFLINE_CASHBACK, PREV_POLICY_TYPES, QUOTE_INSURERS, emptyForm, submitOfflineRequest, validateStep, type OfflineForm, type OfflineType,
} from '../lib/offline'
import { describeReg, formatReg, lookupVehicle } from '../lib/vehicle'
import { Button, cn } from '../ui'
import {
  Chips, Collapse, Dropzone, Group, Option, PlateInput, Progress, Question, ReviewCard, Row, Segmented, Two, ctl, ctlArea, STEPS,
} from './offline/parts'

type Screen = 'entry' | 'vehicle' | 'quotes' | 'owner' | 'kyc' | 'done'
const ORDER: Exclude<Screen, 'done'>[] = ['entry', 'vehicle', 'quotes', 'owner', 'kyc']
const MAX_FILE = 10 * 1024 * 1024
const MAX_FILES = 6
const OK_TYPES = ['image/jpeg', 'image/png', 'application/pdf']

const Heading = ({ step, title, sub }: { step: number; title: string; sub: string }) => (
  <header className="mb-7">
    <p className="text-xs font-semibold uppercase tracking-[.08em] text-indigo-600 max-lg:hidden">Step {step + 1} of {STEPS.length} · {STEPS[step]}</p>
    <h1 tabIndex={-1} className="mt-2 text-[26px] font-semibold leading-tight tracking-tight text-zinc-900 outline-none sm:text-3xl">{title}</h1>
    <p className="mt-2 max-w-xl text-[15px] leading-relaxed text-zinc-500">{sub}</p>
  </header>
)

export default function OfflineModal({ type, initialReg = '', onClose }: { type: OfflineType; initialReg?: string; onClose: () => void }) {
  const { user } = useAuth()
  const noun = type === 'car' ? 'Car' : 'Bike'
  const vehicle = type === 'car' ? 'car' : 'bike'
  const dlg = useRef<HTMLDialogElement>(null)
  const [screen, setScreen] = useState<Screen>('entry')
  const [ayush, setAyush] = useState(false)
  const [usedVehicle, setUsedVehicle] = useState(false)
  const [f, setF] = useState<OfflineForm>(() => ({
    ...emptyForm(),
    regNumber: formatReg(initialReg),
    name: user?.displayName ?? '',
    mobile: (user?.phoneNumber ?? '').replace(/^\+91/, ''),
    email: user?.email ?? '',
  }))
  const [files, setFiles] = useState<File[]>([])
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [doneId, setDoneId] = useState<string | null>(null)
  const [looking, setLooking] = useState(false)
  const [prefilled, setPrefilled] = useState(false)
  const [copied, setCopied] = useState(false)
  const reg = describeReg(f.regNumber)

  useEffect(() => {
    const d = dlg.current!
    d.showModal()
    return () => d.close()
  }, [])
  useEffect(() => {
    dlg.current?.scrollTo({ top: 0 })
    dlg.current?.querySelector<HTMLElement>('h1')?.focus({ preventScroll: true })
  }, [screen])

  const set = <K extends keyof OfflineForm>(k: K, v: OfflineForm[K]) => setF((p) => ({ ...p, [k]: v }))
  const bind = (k: keyof OfflineForm) => ({ value: f[k] as string, onChange: (e: { target: { value: string } }) => set(k, e.target.value as never) })
  const go = (s: Screen) => { setError(null); setScreen(s) }
  const toggle = (k: 'insurers' | 'addons', v: string) => set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v])
  const step = screen === 'done' ? STEPS.length : ORDER.indexOf(screen)
  const plate = f.isNew ? 'New vehicle' : formatReg(f.regNumber)
  const year = f.registrationDate ? f.registrationDate.slice(0, 4) : f.manufactureMonth.slice(0, 4)

  function addFiles(list: FileList | null) {
    if (!list) return
    const incoming = Array.from(list)
    const bad = incoming.find((x) => !OK_TYPES.includes(x.type) || x.size > MAX_FILE)
    if (bad) return setError(`${bad.name}: only JPG, PNG or PDF up to 10MB.`)
    setError(null)
    setFiles((p) => [...p, ...incoming].slice(0, MAX_FILES))
  }

  /** Validates the plate, then tries to prefill vehicle details (only if a lookup provider is configured). */
  async function startQuote() {
    const bad = validateStep(1, f)
    if (bad) return setError(bad)
    setError(null)
    setPrefilled(false)
    if (user && !f.isNew) {
      setLooking(true)
      const v = await lookupVehicle(f.regNumber)
      setLooking(false)
      if (v) {
        setF((p) => ({
          ...p,
          makeModel: p.makeModel || v.makeModel || '', variant: p.variant || v.variant || '',
          fuel: v.fuel || p.fuel, registrationDate: p.registrationDate || v.registrationDate || '',
          manufactureMonth: p.manufactureMonth || v.manufactureMonth || '',
          prevInsurer: p.prevInsurer || v.prevInsurer || '', prevExpiry: p.prevExpiry || v.prevExpiry || '',
        }))
        setPrefilled(true)
      }
    }
    go('vehicle')
  }

  async function submit() {
    const bad = validateStep(4, f)
    if (bad) return setError(bad)
    if (!user) return setError('Please sign in to submit.')
    setError(null)
    setBusy(true)
    try {
      setDoneId(await submitOfflineRequest(user.uid, type, f, files))
      setScreen('done')
    } catch (e) {
      setError(e instanceof Error && e.message ? e.message : 'Could not submit. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const stepErr = (n: number, next: Screen) => { const bad = validateStep(n, f); if (bad) setError(bad); else go(next) }
  const ref = doneId?.slice(0, 8).toUpperCase() ?? ''
  const cashback = inr(OFFLINE_CASHBACK[type])

  /* ------------------------------ side summary ------------------------------ */
  const Receipt = () => (
    <dl className="space-y-3 text-sm">
      {([
        ['Vehicle', f.makeModel ? `${f.makeModel}${f.variant ? ` ${f.variant}` : ''}` : noun],
        ['Registration', `${plate}${year ? ` · ${year}` : ''}`],
        ['Fuel', f.fuel],
        ['Policy type', f.policyType],
        ['Insurers', f.insurers.length ? f.insurers.join(', ') : 'Best of all'],
        ['No Claim Bonus', f.isNew ? 'NA' : f.ncb],
        ['Preferred IDV', f.idv ? `₹${f.idv}` : ''],
        ['Add-ons', f.addons.join(', ')],
      ] as [string, string][]).filter(([, v]) => v).map(([k, v]) => (
        <div key={k} className="flex justify-between gap-5 border-b border-dashed border-zinc-200 pb-3 last:border-0 last:pb-0"><dt className="shrink-0 text-zinc-500">{k}</dt><dd className="min-w-0 break-words text-right font-medium text-zinc-900">{v}</dd></div>
      ))}
    </dl>
  )
  const Next = () => (
    <ol className="space-y-3 text-sm text-zinc-600">
      {['Tell us about the vehicle and the cover you want', 'Share owner details and any documents', 'We call you within 24 hours with exact quotes'].map((t, i) => (
        <li key={t} className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-100 text-[11px] font-semibold text-zinc-600">{i + 1}</span>{t}</li>
      ))}
    </ol>
  )
  const Cashback = () => (
    <div className="rounded-xl bg-zinc-900 p-5 text-white">
      <p className="text-xs font-medium uppercase tracking-[.08em] text-zinc-400">Offline offer</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight">Up to {cashback} cashback</p>
      <p className="mt-1.5 text-sm leading-relaxed text-zinc-400">On your {vehicle} insurance, credited once your policy is confirmed.</p>
    </div>
  )

  const footer = screen !== 'done' && (
    <div className="sticky bottom-0 z-10 border-t border-zinc-200 bg-white/95 backdrop-blur">
      <div className="mx-auto max-w-[1080px] px-4 pb-[max(.75rem,env(safe-area-inset-bottom))] pt-3 sm:px-6">
        {error && <p role="alert" className="mb-3 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800"><X size={16} className="mt-0.5 shrink-0" />{error}</p>}
        <div className="flex gap-3">
          {screen !== 'entry' && <Button size="sm" className="h-12 px-5 text-[15px]" icon={ArrowLeft} disabled={busy} onClick={() => go(ORDER[step - 1])}>Back</Button>}
          <Button variant="primary" size="sm" loading={looking || busy} className="h-12 flex-1 text-[15px] sm:ml-auto sm:flex-none sm:px-8"
            onClick={() => {
              if (screen === 'entry') void startQuote()
              else if (screen === 'vehicle') stepErr(2, 'quotes')
              else if (screen === 'quotes') setAyush(true)
              else if (screen === 'owner') stepErr(3, 'kyc')
              else void submit()
            }}>
            {screen === 'entry' ? (looking ? 'Checking…' : 'Continue') : screen === 'vehicle' ? 'Choose cover' : screen === 'quotes' ? 'Continue' : screen === 'owner' ? 'Review & documents' : busy ? 'Submitting…' : 'Submit request'}
            {!(looking || busy) && <ArrowRight size={17} />}
          </Button>
        </div>
      </div>
    </div>
  )

  const aside: ReactNode = screen === 'entry' ? (
    <div className="space-y-5">
      <Cashback />
      <div className="rounded-xl border border-zinc-200 bg-white p-5"><h2 className="mb-4 text-sm font-semibold text-zinc-900">How offline works</h2><Next /></div>
    </div>
  ) : (
    <div className="space-y-5">
      <div className="rounded-xl border border-zinc-200 bg-white p-5"><h2 className="mb-4 text-sm font-semibold text-zinc-900">Your request</h2><Receipt /></div>
      <Cashback />
    </div>
  )

  return (
    <dialog ref={dlg} aria-label={`${noun} insurance, offline`} onCancel={(e) => { e.preventDefault(); if (ayush) setAyush(false); else onClose() }}
      className="app-root m-0 h-dvh max-h-none w-full max-w-none flex-col overflow-y-auto overflow-x-hidden rounded-none border-0 bg-zinc-50 p-0 text-zinc-900 shadow-none [&[open]]:flex">
      <header className="sticky top-0 z-20 border-b border-zinc-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1080px] items-center gap-4 px-4 sm:px-6">
          <span className="flex items-center gap-2.5">
            <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white"><ShieldCheck size={17} /></span>
            <span className="text-sm font-semibold max-sm:hidden">Askus Insurance</span>
          </span>
          <div className="min-w-0 flex-1 lg:flex lg:justify-center">{screen !== 'done' && <Progress step={step} onJump={(i) => go(ORDER[i])} />}</div>
          <a href={`tel:+91${HELPLINE}`} className="hidden h-9 items-center gap-2 rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 lg:inline-flex"><Headphones size={16} />{HELPLINE}</a>
          <button type="button" aria-label="Close" onClick={onClose} className="grid size-10 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100 hover:text-zinc-900"><X size={20} /></button>
        </div>
        {screen !== 'done' && <div className="h-0.5 bg-zinc-100"><div className="h-full bg-indigo-600 transition-[width] duration-300 ease-out" style={{ width: `${((step + 1) / STEPS.length) * 100}%` }} /></div>}
      </header>

      {screen === 'done' ? (
        <main className="mx-auto w-full max-w-[640px] flex-1 px-4 py-12 sm:px-6 sm:py-16">
          <div className="text-center">
            <span className="mx-auto grid size-14 place-items-center rounded-full bg-emerald-50 text-emerald-600 ring-8 ring-emerald-50/50"><CheckCircle2 size={28} /></span>
            <h1 tabIndex={-1} className="mt-6 text-3xl font-semibold tracking-tight outline-none">Request received{f.name.trim() ? `, ${f.name.trim().split(' ')[0]}` : ''}</h1>
            <p className="mt-3 text-[15px] leading-relaxed text-zinc-500">Your offline {vehicle} insurance request is with our team. We'll call <b className="font-medium text-zinc-800">{f.mobile}</b> within 24 hours with exact quotes.</p>
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
        <div className="mx-auto grid w-full max-w-[1080px] flex-1 grid-cols-[minmax(0,1fr)] content-start gap-8 px-4 py-8 sm:px-6 sm:py-10 lg:grid-cols-[minmax(0,1fr)_330px] lg:gap-12">
          <main className="min-w-0">
            {screen !== 'entry' && <div className="mb-6"><Collapse title={`Your request · ${plate}`}><Receipt /></Collapse></div>}

            {/* 1. Vehicle number */}
            {screen === 'entry' && (
              <form onSubmit={(e) => { e.preventDefault(); void startQuote() }}>
                <Heading step={0} title={`Insure your ${vehicle} in minutes`} sub="Enter your registration number and share a few details. Our team arranges the best quote and handles the paperwork." />
                {type === 'car' && <div className="mb-5"><Segmented label="Vehicle status" value={usedVehicle ? 'Used vehicle' : 'Existing vehicle'} options={['Existing vehicle', 'Used vehicle'] as const} onChange={(v) => setUsedVehicle(v === 'Used vehicle')} /></div>}
                <PlateInput label={`${noun} number`} placeholder={`Enter ${vehicle} number, e.g. KA12S 2367`} value={f.regNumber} onChange={(v) => set('regNumber', formatReg(v))} disabled={f.isNew || looking} />
                <p className={cn('mt-3 min-h-5 text-sm', reg.ok ? 'font-medium text-emerald-700' : 'text-zinc-500')} aria-live="polite">
                  {f.isNew ? 'Registration number not needed for a new vehicle.' : f.regNumber ? (reg.ok ? `${reg.rto ? `${reg.rto} · ` : ''}${reg.state}${reg.complete ? '' : ' · keep typing…'}` : reg.hint) : 'Letters and numbers only. We format it as you type.'}
                </p>
                <div className="mt-6 border-t border-zinc-200 pt-5">
                  {f.isNew
                    ? <button type="button" onClick={() => set('isNew', false)} className="text-sm font-medium text-indigo-600 hover:underline">I have a registration number</button>
                    : <button type="button" onClick={() => { set('isNew', true); set('regNumber', ''); go('vehicle') }} className="text-sm font-medium text-indigo-600 hover:underline">No registration number yet? Insure a brand-new {vehicle}</button>}
                </div>
                <button type="submit" className="sr-only">Continue</button>
              </form>
            )}

            {/* 2. Vehicle details + previous policy */}
            {screen === 'vehicle' && (
              <div className="space-y-9">
                <Heading step={1} title="Vehicle and policy details" sub={prefilled ? 'We filled in what we could from the registration number. Please check each field.' : 'These help us find the right insurers and price your cover accurately.'} />
                <Group title="Cover you want">
                  <Segmented label="Policy type" value={f.policyType === 'Limited Third Party' ? 'Third Party' : f.policyType} options={['Comprehensive', 'Third Party'] as const} onChange={(v) => set('policyType', v)} />
                </Group>
                <Group title="Vehicle" hint={f.isNew ? 'Brand-new vehicle: no registration yet.' : plate}>
                  <Two>
                    <Row label="Make and model"><input className={ctl} placeholder={type === 'car' ? 'e.g. Maruti Alto 800' : 'e.g. TVS Apache'} {...bind('makeModel')} /></Row>
                    <Row label="Variant" optional><input className={ctl} placeholder="e.g. RTR 200 4V FI (200 CC)" {...bind('variant')} /></Row>
                  </Two>
                  <Row label="Fuel type"><select className={ctl} value={f.fuel} onChange={(e) => set('fuel', e.target.value)}>{['Petrol', 'Diesel', 'CNG', 'Electric', 'LPG'].map((x) => <option key={x}>{x}</option>)}</select></Row>
                  {!f.isNew && (
                    <Two>
                      <Row label="Registration date"><input type="date" className={ctl} max={new Date().toISOString().slice(0, 10)} {...bind('registrationDate')} /></Row>
                      <Row label="Manufacturing month"><input type="month" className={ctl} max={new Date().toISOString().slice(0, 7)} {...bind('manufactureMonth')} /></Row>
                    </Two>
                  )}
                </Group>
                {!f.isNew && (
                  <Group title="Previous policy" hint="From your current or last insurance policy.">
                    <Question label="Did your policy expire more than 90 days ago?"><Segmented label="Expired over 90 days" value={f.expiredOver90} options={['No', 'Yes'] as const} onChange={(v) => set('expiredOver90', v)} /></Question>
                    <Two>
                      <Row label="Previous policy type"><select className={ctl} value={f.prevPolicyType} onChange={(e) => set('prevPolicyType', e.target.value)}><option value="">Select</option>{PREV_POLICY_TYPES.map((x) => <option key={x}>{x}</option>)}</select></Row>
                      <Row label="Previous insurer"><select className={ctl} value={f.prevInsurer} onChange={(e) => set('prevInsurer', e.target.value)}><option value="">Select</option>{INSURERS.map((x) => <option key={x}>{x}</option>)}</select></Row>
                    </Two>
                    <Row label="Existing policy expiry date"><input type="date" className={ctl} {...bind('prevExpiry')} /></Row>
                    <Question label="Did you make a claim in your policy?"><Segmented label="Claim made" value={f.claimMade} options={['No', 'Yes'] as const} onChange={(v) => set('claimMade', v)} /></Question>
                    <Question label="Previous year No Claim Bonus (NCB)"><Chips label="NCB" value={f.ncb} options={NCB_OPTIONS} onChange={(v) => set('ncb', v)} /></Question>
                    <Two>
                      <Question label="Owner type"><Segmented label="Owner type" value={f.ownerType} options={['Individual', 'Corporate'] as const} onChange={(v) => set('ownerType', v)} /></Question>
                      <Question label="Did the ownership change?"><Segmented label="Ownership changed" value={f.ownershipChanged} options={['No', 'Yes'] as const} onChange={(v) => set('ownershipChanged', v)} /></Question>
                    </Two>
                  </Group>
                )}
              </div>
            )}

            {/* 3. Plan preferences */}
            {screen === 'quotes' && (
              <div className="space-y-9">
                <Heading step={2} title="Choose your cover" sub="Tell us which insurers and extras you'd like quoted. Leave insurers blank to compare all." />
                <Group title="Policy type">
                  <Segmented label="Policy type" value={f.policyType} options={['Comprehensive', 'Third Party', 'Limited Third Party'] as const} onChange={(v) => set('policyType', v)} />
                </Group>
                <Group title="Insurers" hint="Exact premium and IDV are shared by our team after your request.">
                  <div className="space-y-2.5">
                    {QUOTE_INSURERS.map((ins, i) => <Option key={ins.id} monogram index={i} title={ins.name} selected={f.insurers.includes(ins.name)} onToggle={() => toggle('insurers', ins.name)} />)}
                  </div>
                </Group>
                <Group title="Insured value (IDV)">
                  <Row label="Preferred IDV" optional hint="Leave blank and we'll quote the best-value IDV.">
                    <div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">₹</span><input className={cn(ctl, 'pl-8')} inputMode="numeric" placeholder="e.g. 350000" {...bind('idv')} /></div>
                  </Row>
                </Group>
                <Group title="Add-ons">
                  <div className="grid gap-2.5 sm:grid-cols-2">{ADDON_OPTIONS.map((a) => <Option key={a} title={a} selected={f.addons.includes(a)} onToggle={() => toggle('addons', a)} />)}</div>
                </Group>
              </div>
            )}

            {/* 4. Owner */}
            {screen === 'owner' && (
              <div className="space-y-9">
                <Heading step={3} title="Owner details" sub="Use the name exactly as it appears on the RC so the policy and any claim match." />
                <Group title="Owner">
                  <Row label="Full name (as on RC)"><input className={ctl} autoComplete="name" {...bind('name')} /></Row>
                  <Question label="Gender"><Segmented label="Gender" value={f.gender} options={['Male', 'Female'] as const} onChange={(v) => set('gender', v)} /></Question>
                  <Two>
                    <Row label="Mobile number"><input className={ctl} inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile" {...bind('mobile')} /></Row>
                    <Row label="Email address" optional><input className={ctl} type="email" autoComplete="email" {...bind('email')} /></Row>
                  </Two>
                </Group>
                <Group title="Address for communication">
                  <Row label="Address"><textarea className={ctlArea} autoComplete="street-address" value={f.address} onChange={(e) => set('address', e.target.value)} /></Row>
                  <Two>
                    <Row label="City"><input className={ctl} autoComplete="address-level2" {...bind('city')} /></Row>
                    <Row label="Pincode"><input className={ctl} inputMode="numeric" maxLength={6} autoComplete="postal-code" {...bind('pincode')} /></Row>
                  </Two>
                </Group>
                <Group title="Loan">
                  <Question label={`Is the ${vehicle === 'car' ? 'car' : 'two-wheeler'} on loan?`}><Segmented label="On loan" value={f.onLoan} options={['No', 'Yes'] as const} onChange={(v) => set('onLoan', v)} /></Question>
                </Group>
              </div>
            )}

            {/* 5. Documents + review */}
            {screen === 'kyc' && (
              <div className="space-y-9">
                <Heading step={4} title="Documents and review" sub="Add documents to speed things up, then check everything before you submit." />
                <Group title="Documents" hint="Optional, but quotes are faster when we already have them.">
                  <Dropzone files={files} max={MAX_FILES} onAdd={addFiles} onRemove={(i) => setFiles((p) => p.filter((_, j) => j !== i))} />
                </Group>
                <Group title="Review your request">
                  <div className="space-y-3">
                    <ReviewCard title="Vehicle" onEdit={() => go('vehicle')} rows={[['Registration', plate], ['Make and model', `${f.makeModel}${f.variant ? ` · ${f.variant}` : ''}`], ['Fuel', f.fuel], ['Registered', f.registrationDate]]} />
                    <ReviewCard title="Cover" onEdit={() => go('quotes')} rows={[['Policy type', f.policyType], ['Insurers', f.insurers.length ? f.insurers.join(', ') : 'Best of all'], ['Add-ons', f.addons.join(', ')], ['Preferred IDV', f.idv ? `₹${f.idv}` : ''], ['AyushPay', f.ayushPay ? 'Added' : '']]} />
                    <ReviewCard title="Owner" onEdit={() => go('owner')} rows={[['Name', f.name.trim()], ['Mobile', f.mobile], ['Email', f.email.trim()], ['Address', `${f.address.trim()}, ${f.city.trim()} ${f.pincode.trim()}`], ['Vehicle on loan', f.onLoan]]} />
                  </div>
                </Group>
                <section className="rounded-xl border border-zinc-200 bg-white p-5">
                  <h2 className="text-sm font-semibold text-zinc-900">Declaration</h2>
                  <ol className="mt-3 list-decimal space-y-2 pl-5 text-[13px] leading-relaxed text-zinc-500">
                    <li>In line with the IRDAI Master Guidelines on Anti-Money Laundering / Counter Financing of Terrorism (AML/CFT), customer information is taken for KYC implementation for insurers. By agreeing you consent to the use of your information for the KYC check as per the IRDAI mandate.</li>
                    <li>The owner name on the policy document will be as per KYC-verified data. If it differs from the owner name on the RC, the insurer may reject claims.</li>
                    <li>I am not related to, or myself, a politically exposed person.</li>
                  </ol>
                  <label className="mt-4 flex cursor-pointer items-start gap-3 rounded-lg bg-zinc-50 p-3.5 text-sm font-medium text-zinc-900">
                    <input type="checkbox" checked={f.consent} onChange={(e) => set('consent', e.target.checked)} className="mt-0.5 size-5 shrink-0 accent-indigo-600" />I agree with the aforementioned declarations
                  </label>
                </section>
                <p className="text-xs text-zinc-400">Final premium, IDV and insurer are confirmed by our team before anything is issued. Nothing is charged on this form.</p>
              </div>
            )}
          </main>
          <aside className="hidden lg:block"><div className="sticky top-28">{aside}</div></aside>
        </div>
      )}
      {footer}

      {/* optional add-on shown between "Choose cover" and "Owner" */}
      {screen === 'quotes' && ayush && (
        <div className="fixed inset-0 z-30 grid place-items-end bg-zinc-900/50 sm:place-items-center sm:p-4" role="dialog" aria-modal="true" aria-label="AyushPay Parivar Kavach">
          <div className="app-root admin-slide-up relative max-h-[92dvh] w-full overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:max-w-lg sm:rounded-2xl">
            <button type="button" aria-label="Close" onClick={() => setAyush(false)} className="absolute right-3 top-3 grid size-10 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100"><X size={18} /></button>
            <div className="px-6 pb-2 pt-7">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700"><ShieldCheck size={13} />Optional add-on · Backed by IndusInd</span>
              <h2 className="mt-3 text-xl font-semibold tracking-tight">AyushPay Parivar Kavach</h2>
              <p className="mt-1 text-[15px] text-zinc-500">0% interest loan for hospital bills.</p>
              <div className="mt-5 flex items-center justify-between gap-4 rounded-xl border border-indigo-600 bg-indigo-50/50 p-4 ring-1 ring-indigo-600">
                <div><p className="text-[15px] font-semibold">Self · 1 member</p><p className="text-sm text-zinc-500">Loan up to ₹25,000</p></div>
                <p className="text-2xl font-semibold tabular-nums">₹299<span className="text-sm font-normal text-zinc-500">/yr</span></p>
              </div>
              <p className="mb-2 mt-5 text-sm font-semibold">What you get for ₹299 <span className="font-normal text-zinc-400">· valid 1 year</span></p>
              <ul className="grid gap-2 sm:grid-cols-2">
                {[['₹25,000 medical loan', '0% interest EMIs'], ['₹1,000 cashback', 'Up to 35% back on medicines & tests'], ['₹1,500 instant credit', 'For medicines & tests'], ['Doctor on video', '24×7 general physician']].map(([t, s]) => (
                  <li key={t} className="rounded-lg border border-zinc-200 p-3"><p className="text-sm font-medium">{t}</p><p className="mt-0.5 text-xs text-zinc-500">{s}</p></li>
                ))}
              </ul>
              <p className="mt-3 text-xs text-zinc-400">Optional add-on. Price and availability are confirmed by our team.</p>
            </div>
            <div className="mt-4 flex gap-3 border-t border-zinc-100 bg-zinc-50 p-4 pb-[max(1rem,env(safe-area-inset-bottom))]">
              <Button className="h-12 flex-1 text-[15px]" onClick={() => { set('ayushPay', false); setAyush(false); go('owner') }}>Skip</Button>
              <Button variant="primary" className="h-12 flex-1 text-[15px]" onClick={() => { set('ayushPay', true); setAyush(false); go('owner') }}>Add & continue</Button>
            </div>
          </div>
        </div>
      )}
    </dialog>
  )
}
