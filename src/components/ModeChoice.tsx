import { useEffect, useRef } from 'react'
import { ArrowRight, Check, X } from 'lucide-react'
import { inr } from '../lib/products'
import { OFFLINE_CASHBACK, type OfflineType } from '../lib/offline'
import type { Product } from '../lib/products'
import '../ui/ui.css' // shared resets and the Inter font for .app-root
import MoneyBanner from './MoneyBanner'
import cardCar from '../assets/img/acko/card-car.webp'
import cardBike from '../assets/img/acko/card-bike.webp'

const PHOTO: Record<string, { img: string; tint: string }> = {
  car: { img: cardCar, tint: '#e3ebfb' },
  bike: { img: cardBike, tint: '#e2f2e9' },
}

/** "How would you like to buy?" Online (partner journey) or Offline (we collect details and process it). */
export default function ModeChoice({
  product, onOnline, onOffline, onClose,
}: { product: Product; onOnline: () => void; onOffline: () => void; onClose: () => void }) {
  const type = product.id as OfflineType
  const dlg = useRef<HTMLDialogElement>(null)
  const label = product.name.replace(' Insurance', '').toLowerCase()
  const cashback = inr(OFFLINE_CASHBACK[type])
  const photo = PHOTO[product.id]
  useEffect(() => {
    const d = dlg.current!
    d.showModal()
    return () => d.close()
  }, [])

  const options = [
    {
      key: 'online', title: 'Buy Online', go: onOnline, cta: 'Continue online', accent: 'bg-indigo-600 group-hover:bg-indigo-700', ring: 'hover:border-indigo-400', tick: 'bg-indigo-50 text-indigo-600',
      text: 'Compare live quotes and buy right now.',
      points: [`Compare & save up to 91%+ on ${product.name}`, 'Get policy in 10 minutes'],
      banner: <MoneyBanner variant="online" label="Save up to" stat="91%+" caption="Pay less, cover more" />,
    },
    {
      key: 'offline', title: 'Buy Offline', go: onOffline, cta: 'Continue offline', accent: 'bg-emerald-600 group-hover:bg-emerald-700', ring: 'hover:border-emerald-400', tick: 'bg-emerald-50 text-emerald-600',
      text: 'Share your details, our team does the rest.',
      points: ['Best quote arranged by our team', 'We call you within 24 hours'],
      banner: <MoneyBanner variant="offline" label="Earn up to" stat={cashback} caption={`cashback on ${label} insurance`} />,
    },
  ]

  return (
    <dialog ref={dlg} aria-label={product.name} onCancel={(e) => { e.preventDefault(); onClose() }} onClick={(e) => { if (e.target === dlg.current) onClose() }}
      style={{ background: 'linear-gradient(180deg,#eef2ff 0,#ffffff 230px)' }}
      className="app-root m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[700px] overflow-y-auto rounded-3xl border-0 p-0 text-zinc-900 shadow-[0_24px_64px_-12px_rgba(16,24,40,.4)] backdrop:bg-zinc-900/55">
      <div className="p-5 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 pt-1">
            <p className="inline-flex items-center rounded-full bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[.08em] text-indigo-600 shadow-[0_1px_2px_rgba(16,24,40,.08)] ring-1 ring-indigo-100">{product.name}</p>
            <h2 className="mt-3 text-2xl font-semibold tracking-tight sm:text-[28px]">How would you like to buy?</h2>
            <p className="mt-1.5 text-[15px] text-zinc-500">Pick the way that suits you. Both get you covered.</p>
          </div>
          <div className="flex shrink-0 items-start gap-2">
            {photo && (
              <span className="hidden h-24 w-36 place-items-end overflow-hidden rounded-2xl sm:grid" style={{ background: photo.tint }}>
                <img src={photo.img} alt="" className="h-full w-full object-contain object-bottom p-2" />
              </span>
            )}
            <button type="button" aria-label="Close" onClick={onClose} className="grid size-10 shrink-0 place-items-center rounded-full bg-white text-zinc-500 shadow-[0_1px_2px_rgba(16,24,40,.1)] ring-1 ring-zinc-200 hover:text-zinc-900"><X size={18} /></button>
          </div>
        </div>

        <div className="mt-6 grid gap-4 sm:grid-cols-2">
          {options.map((o) => (
            <button key={o.key} type="button" onClick={o.go}
              className={`group flex flex-col overflow-hidden rounded-2xl border border-zinc-200 bg-white p-0 text-left shadow-[0_2px_8px_-2px_rgba(16,24,40,.08)] transition-all hover:-translate-y-1 hover:shadow-[0_18px_40px_-14px_rgba(16,24,40,.28)] ${o.ring}`}>
              {o.banner}
              <span className="flex flex-1 flex-col p-5">
                <span className="text-xl font-semibold tracking-tight">{o.title}</span>
                <span className="mt-0.5 text-[13px] text-zinc-500">{o.text}</span>
                <ul className="mt-4 space-y-2.5 text-sm text-zinc-700">
                  {o.points.map((p) => (
                    <li key={p} className="flex items-start gap-2.5"><span className={`mt-px grid size-5 shrink-0 place-items-center rounded-full ${o.tick}`}><Check size={12} strokeWidth={3} /></span>{p}</li>
                  ))}
                </ul>
                <span className="mt-auto block pt-5">
                  <span className={`flex h-11 w-full items-center justify-center gap-2 rounded-xl text-[15px] font-medium text-white transition-colors ${o.accent}`}>
                    {o.cta}<ArrowRight size={17} className="transition-transform group-hover:translate-x-0.5" />
                  </span>
                </span>
              </span>
            </button>
          ))}
        </div>
        <p className="mt-5 text-center text-xs leading-relaxed text-zinc-400">Cashback is credited once your policy is confirmed. Amounts shown are the maximum and depend on the insurer and plan.</p>
      </div>
    </dialog>
  )
}
