import { useEffect, useRef } from 'react'
import { ArrowRight, Check, ClipboardList, X, Zap } from 'lucide-react'
import { inr } from '../lib/products'
import { OFFLINE_CASHBACK, type OfflineType } from '../lib/offline'
import type { Product } from '../lib/products'
import { cn } from '../ui'

/** "How would you like to buy?" Online (partner journey) or Offline (we collect details and process it). */
export default function ModeChoice({
  product, onOnline, onOffline, onClose,
}: { product: Product; onOnline: () => void; onOffline: () => void; onClose: () => void }) {
  const type = product.id as OfflineType
  const dlg = useRef<HTMLDialogElement>(null)
  const label = product.name.replace(' Insurance', '').toLowerCase()
  const online = type === 'car' ? '₹300' : '₹100'
  useEffect(() => {
    const d = dlg.current!
    d.showModal()
    return () => d.close()
  }, [])

  const options = [
    {
      key: 'online', icon: Zap, tag: 'Instant quotes', title: 'Buy online', go: onOnline, cta: 'Continue online',
      text: 'Compare live quotes from insurers and buy right now.',
      points: ['Instant quotes from top insurers', `${online} cashback once your policy is confirmed`],
    },
    {
      key: 'offline', icon: ClipboardList, tag: `Up to ${inr(OFFLINE_CASHBACK[type]).replace('.00', '')} cashback`, title: 'Let our team handle it', go: onOffline, cta: 'Continue offline',
      text: 'Share your details and documents. Our team gets you the best quote and handles the rest.',
      points: [`Up to ${inr(OFFLINE_CASHBACK[type])} cashback on ${label} insurance`, 'We call you within 24 hours'],
    },
  ]

  return (
    <dialog ref={dlg} aria-label={product.name} onCancel={(e) => { e.preventDefault(); onClose() }} onClick={(e) => { if (e.target === dlg.current) onClose() }}
      className="app-root m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[680px] overflow-y-auto rounded-2xl border-0 bg-white p-0 text-zinc-900 shadow-[0_24px_64px_-12px_rgba(16,24,40,.35)] backdrop:bg-zinc-900/50">
      <div className="p-6 sm:p-8">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[.08em] text-indigo-600">{product.name}</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight">How would you like to buy?</h2>
            <p className="mt-1.5 text-[15px] text-zinc-500">Choose how you'd like to buy your {label} insurance.</p>
          </div>
          <button type="button" aria-label="Close" onClick={onClose} className="-mr-2 -mt-2 grid size-10 shrink-0 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100"><X size={20} /></button>
        </div>
        <div className="mt-6 grid gap-3 sm:grid-cols-2">
          {options.map((o) => (
            <button key={o.key} type="button" onClick={o.go}
              className={cn('group flex flex-col rounded-xl border p-5 text-left transition-all hover:-translate-y-px hover:shadow-[0_8px_24px_-8px_rgba(16,24,40,.18)]', o.key === 'offline' ? 'border-zinc-300 hover:border-indigo-500' : 'border-zinc-200 hover:border-indigo-500')}>
              <span className="flex items-center justify-between gap-2">
                <span className="grid size-10 place-items-center rounded-lg bg-indigo-50 text-indigo-600"><o.icon size={19} /></span>
                <span className="rounded-full bg-zinc-100 px-2.5 py-1 text-[11px] font-medium text-zinc-700">{o.tag}</span>
              </span>
              <span className="mt-4 text-lg font-semibold tracking-tight">{o.title}</span>
              <span className="mt-1.5 text-sm leading-relaxed text-zinc-500">{o.text}</span>
              <ul className="mt-4 space-y-2 text-sm text-zinc-700">
                {o.points.map((p) => <li key={p} className="flex gap-2"><Check size={16} className="mt-0.5 shrink-0 text-emerald-600" />{p}</li>)}
              </ul>
              <span className="mt-5 inline-flex items-center gap-1.5 text-sm font-medium text-indigo-600">{o.cta}<ArrowRight size={16} className="transition-transform group-hover:translate-x-0.5" /></span>
            </button>
          ))}
        </div>
        <p className="mt-5 text-xs leading-relaxed text-zinc-400">Cashback is credited once your policy is confirmed. Amounts shown are the maximum and depend on the insurer and plan.</p>
      </div>
    </dialog>
  )
}
