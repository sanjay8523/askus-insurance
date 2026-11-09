import { ArrowRight } from 'lucide-react'
import { OFFLINE_CASHBACK } from '../../lib/offline'
import { PRODUCTS, inr } from '../../lib/products'
import cardCar from '../../assets/img/acko/card-car.webp'
import cardAuto from '../../assets/img/stock/auto.webp'
import cardCommercial from '../../assets/img/stock/commercial.webp'
import cardBike from '../../assets/img/acko/card-bike.webp'
import cardHealth from '../../assets/img/acko/card-health.webp'
import cardTerm from '../../assets/img/acko/card-term.webp'
import fileClaim from '../../assets/img/acko/icon-file-claim.webp'
import trackClaim from '../../assets/img/acko/icon-track-claim.webp'

/** Home page product tiles and claims. Clicks on [data-product] / [data-service] are handled by App. */

const TILES: Record<string, { img: string; tint: string }> = {
  car: { img: cardCar, tint: '#e9f0fb' },
  bike: { img: cardBike, tint: '#e9f5ee' },
  auto: { img: cardAuto, tint: '#fdf3e0' },
  commercial: { img: cardCommercial, tint: '#edf0f5' },
  health: { img: cardHealth, tint: '#fdeef1' },
  term: { img: cardTerm, tint: '#f2eefb' },
}

export function ProductTiles() {
  const photo = PRODUCTS.filter((p) => TILES[p.id])
  return (
    <section id="products" className="app-root scroll-mt-24" aria-labelledby="tiles-title">
      <div className="mx-auto max-w-[1140px] px-4 py-12 sm:px-6 sm:py-16">
        <h2 id="tiles-title" className="mb-0 text-2xl font-semibold tracking-tight text-zinc-900 sm:text-3xl">Choose the cover you need</h2>
        <p className="mt-2 text-[15px] text-zinc-500">Pick a product to compare plans online or let our team handle it.</p>

        <div className="mt-8 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-3">
          {photo.map((p) => (
            <button key={p.id} type="button" data-product={p.id} className="group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white text-left transition-all hover:-translate-y-0.5 hover:border-zinc-300 hover:shadow-[0_12px_30px_-12px_rgba(16,24,40,.22)]">
              <span className="relative block h-36 sm:h-48 lg:h-56" style={{ background: TILES[p.id].tint }}>
                <img src={TILES[p.id].img} alt="" loading="lazy" decoding="async" className="absolute bottom-0 right-0 h-full w-full object-contain object-bottom p-2 transition-transform duration-300 group-hover:scale-[1.03] sm:p-3" />
              </span>
              <span className="flex flex-1 flex-col p-3.5 sm:p-4">
                <span className="text-[15px] font-semibold text-zinc-900 sm:text-base">{p.name}</span>
                <span className="mt-0.5 text-[13px] text-zinc-500 sm:text-sm">{p.id === 'car' || p.id === 'bike' ? `Up to ${inr(OFFLINE_CASHBACK[p.id])} cashback` : p.tag}</span>
                <span className="mt-3 flex items-center justify-between gap-2 text-xs text-zinc-600 sm:text-[13px]">
                  <span>{p.startingAt ? <>From <b className="font-semibold text-zinc-900">{inr(p.startingAt)}*</b></> : 'Compare sample plans'}</span>
                  <span className="grid size-8 shrink-0 place-items-center rounded-full bg-zinc-100 text-zinc-700 transition-colors group-hover:bg-indigo-600 group-hover:text-white"><ArrowRight size={15} /></span>
                </span>
              </span>
            </button>
          ))}
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
