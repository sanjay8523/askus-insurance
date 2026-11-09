import { useState, type FormEvent } from 'react'
import { ArrowRight, BadgeIndianRupee, CarTaxiFront, Clock3, ShieldCheck, Truck } from 'lucide-react'
import { PlateInput, Segmented } from '../offline/parts'
import { OFFLINE_CASHBACK, emptyForm, validateStep, type OfflineType } from '../../lib/offline'
import { describeReg, formatReg } from '../../lib/vehicle'
import { PRODUCTS, inr } from '../../lib/products'
import { cn } from '../../ui'
import cardCar from '../../assets/img/acko/card-car.webp'
import cardBike from '../../assets/img/acko/card-bike.webp'
import cardHealth from '../../assets/img/acko/card-health.webp'
import cardTerm from '../../assets/img/acko/card-term.webp'
import heroCar from '../../assets/img/acko/icon-car.webp'
import fileClaim from '../../assets/img/acko/icon-file-claim.webp'
import trackClaim from '../../assets/img/acko/icon-track-claim.webp'

/** Home page top section: vehicle-number search, product tiles and claims. Clicks on [data-product] / [data-service] are handled by App. */

export function Hero({ onSearch }: { onSearch: (type: OfflineType, reg: string) => void }) {
  const [type, setType] = useState<'Car' | 'Bike'>('Car')
  const [reg, setReg] = useState('')
  const [error, setError] = useState<string | null>(null)
  const info = describeReg(reg)

  function submit(e: FormEvent) {
    e.preventDefault()
    const bad = validateStep(1, { ...emptyForm(), regNumber: reg })
    if (bad) return setError(bad)
    setError(null)
    onSearch(type === 'Car' ? 'car' : 'bike', reg)
  }

  return (
    <section className="app-root border-b border-zinc-200 bg-[#f6f8fb]" aria-labelledby="hero-title">
      <div className="mx-auto grid max-w-[1140px] items-center gap-10 px-4 py-10 sm:px-6 sm:py-14 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,.9fr)] lg:py-[72px]">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[.1em] text-indigo-600">Car · Bike · Health · Term</p>
          <h1 id="hero-title" className="mt-3 text-[32px] font-semibold leading-[1.12] tracking-tight text-zinc-900 sm:text-5xl">
            Insurance that is easy to buy and easy to manage
          </h1>
          <p className="mt-4 max-w-xl text-base leading-relaxed text-zinc-600 sm:text-lg">
            Compare plans online, or share your details and let our team handle the quote and paperwork. Offline requests earn up to {inr(OFFLINE_CASHBACK.car)} cashback.
          </p>

          <form onSubmit={submit} noValidate className="mt-7 max-w-xl rounded-2xl border border-zinc-200 bg-white p-4 shadow-[0_8px_30px_-12px_rgba(16,24,40,.18)] sm:p-5">
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="text-sm font-medium text-zinc-800">Get a quote for your</span>
              <Segmented label="Vehicle type" value={type} options={['Car', 'Bike'] as const} onChange={setType} />
            </div>
            <PlateInput label={`${type} number`} placeholder="e.g. KA12S 2367" value={reg} onChange={(v) => { setReg(formatReg(v)); setError(null) }} />
            <p className={cn('mt-2 min-h-5 text-sm', error ? 'text-rose-700' : info.ok ? 'font-medium text-emerald-700' : 'text-zinc-500')} aria-live="polite" role={error ? 'alert' : undefined}>
              {error ?? (reg ? (info.ok ? `${info.rto ? `${info.rto} · ` : ''}${info.state}${info.complete ? '' : ' · keep typing…'}` : info.hint) : 'We format it as you type.')}
            </p>
            <button type="submit" className="mt-3 inline-flex h-12 w-full items-center justify-center gap-2 rounded-lg bg-indigo-600 text-[15px] font-medium text-white transition-colors hover:bg-indigo-700">
              Get quote <ArrowRight size={17} />
            </button>
            <p className="mt-3 text-center text-sm text-zinc-500">No registration number yet? <a href="#products" className="font-medium text-indigo-600 hover:underline">Browse all insurance</a></p>
          </form>

          <ul className="mt-6 flex flex-wrap gap-x-6 gap-y-3 text-sm text-zinc-700">
            {([[BadgeIndianRupee, `Up to ${inr(OFFLINE_CASHBACK.car)} cashback`], [Clock3, 'We call within 24 hours'], [ShieldCheck, 'Verified mobile sign-in']] as const).map(([Icon, t]) => (
              <li key={t} className="flex items-center gap-2"><Icon size={17} className="text-indigo-600" />{t}</li>
            ))}
          </ul>
        </div>

        <div className="relative hidden lg:block" aria-hidden>
          <img src={heroCar} alt="" width={600} height={336} className="w-full rounded-3xl object-cover shadow-[0_24px_60px_-20px_rgba(16,24,40,.35)]" />
          <div className="absolute -bottom-5 -left-5 flex items-center gap-3 rounded-xl border border-zinc-200 bg-white px-4 py-3 shadow-lg">
            <span className="grid size-9 place-items-center rounded-lg bg-emerald-50 text-emerald-600"><BadgeIndianRupee size={18} /></span>
            <span className="text-sm"><b className="block font-semibold text-zinc-900">Cashback offer</b><span className="text-zinc-500">Once your policy is confirmed</span></span>
          </div>
        </div>
      </div>
    </section>
  )
}

const TILES: Record<string, { img: string; tint: string }> = {
  car: { img: cardCar, tint: '#e9f0fb' },
  bike: { img: cardBike, tint: '#e9f5ee' },
  health: { img: cardHealth, tint: '#fdeef1' },
  term: { img: cardTerm, tint: '#f2eefb' },
}

export function ProductTiles() {
  const photo = PRODUCTS.filter((p) => TILES[p.id])
  const slim = PRODUCTS.filter((p) => !TILES[p.id])
  return (
    <section id="products" className="app-root scroll-mt-24" aria-labelledby="tiles-title">
      <div className="mx-auto max-w-[1140px] px-4 py-12 sm:px-6 sm:py-16">
        <h2 id="tiles-title" className="mb-0 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Choose the cover you need</h2>
        <p className="mt-2 text-[15px] text-zinc-500">Pick a product to compare plans online or let our team handle it.</p>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
          {photo.map((p) => (
            <button key={p.id} type="button" data-product={p.id} className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_12px_30px_-12px_rgba(16,24,40,.22)]">
              <span className="relative block h-36 sm:h-48" style={{ background: TILES[p.id].tint }}>
                <img src={TILES[p.id].img} alt="" loading="lazy" decoding="async" className="absolute bottom-0 right-0 h-full w-full object-contain object-bottom p-2 transition-transform duration-300 group-hover:scale-[1.03] sm:p-3" />
              </span>
              <span className="flex flex-1 flex-col p-3.5 sm:p-4">
                <span className="text-[15px] font-semibold text-zinc-900 sm:text-base">{p.name}</span>
                <span className="mt-0.5 text-[13px] text-zinc-500 sm:text-sm">{p.tag}</span>
                <span className="mt-3 flex items-center justify-between gap-2 text-xs text-zinc-600 sm:text-[13px]">
                  <span>{p.startingAt ? <>From <b className="font-semibold text-zinc-900">{inr(p.startingAt)}*</b></> : 'Compare sample plans'}</span>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-indigo-600 group-hover:text-white"><ArrowRight size={15} /></span>
                </span>
              </span>
            </button>
          ))}
        </div>

        <div className="mt-3 grid gap-3 sm:mt-4 sm:grid-cols-2 sm:gap-4">
          {slim.map((p) => {
            const Icon = p.id === 'commercial' ? Truck : CarTaxiFront
            return (
              <button key={p.id} type="button" data-product={p.id} className="group flex items-center gap-4 rounded-2xl border border-zinc-200 bg-white p-4 text-left transition-colors hover:border-zinc-300">
                <span className="grid size-12 shrink-0 place-items-center rounded-xl bg-amber-50 text-amber-700"><Icon size={24} /></span>
                <span className="min-w-0 flex-1"><span className="block text-[15px] font-semibold text-zinc-900">{p.name}</span><span className="block text-sm text-zinc-500">{p.tag}{p.startingAt ? ` · from ${inr(p.startingAt)}*` : ''}</span></span>
                <ArrowRight size={18} className="shrink-0 text-zinc-400 transition-transform group-hover:translate-x-0.5" />
              </button>
            )
          })}
        </div>
        <p className="mt-5 text-xs leading-relaxed text-zinc-400">*Starting third-party premium before 18% GST. Motor tiles show the lowest figure for the category; your actual premium depends on the vehicle, engine size and insurer.</p>
      </div>
    </section>
  )
}

export function ClaimsBand() {
  const cards = [
    { service: 'claim', title: 'File a new claim', text: 'Start a claim and our team will guide you through the documents.', img: fileClaim },
    { service: 'track', title: 'Track an existing claim', text: 'Check where your claim stands and what happens next.', img: trackClaim },
  ]
  return (
    <section className="app-root" aria-labelledby="claims-title">
      <div className="mx-auto max-w-[1140px] px-4 pb-12 sm:px-6 sm:pb-16">
        <h2 id="claims-title" className="mb-0 text-xl font-semibold tracking-tight text-zinc-900 sm:text-2xl">Claims, made simple</h2>
        <div className="mt-6 grid gap-3 sm:grid-cols-2 sm:gap-4">
          {cards.map((c) => (
            <button key={c.service} type="button" data-service={c.service} className="group relative flex min-h-[148px] items-stretch overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left transition-colors hover:border-zinc-300">
              <span className="relative z-10 flex flex-1 flex-col justify-center p-5 pr-2 sm:p-6">
                <span className="text-base font-semibold text-zinc-900">{c.title}</span>
                <span className="mt-1 max-w-[16rem] text-sm text-zinc-500">{c.text}</span>
                <span className="mt-3 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600">Get started <ArrowRight size={15} className="transition-transform group-hover:translate-x-0.5" /></span>
              </span>
              <img src={c.img} alt="" loading="lazy" decoding="async" className="absolute inset-y-0 right-0 h-full w-[55%] object-cover object-left" />
            </button>
          ))}
        </div>
      </div>
    </section>
  )
}
