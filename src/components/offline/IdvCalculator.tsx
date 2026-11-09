import { useEffect, useMemo, useRef } from 'react'
import { Calculator, Info } from 'lucide-react'
import { ageInMonths, calculateIdv, formatAge, rupees } from '../../lib/idv'
import { cn } from '../../ui'
import { ctl } from './parts'

const digits = (v: string) => v.replace(/\D/g, '').slice(0, 9)

/**
 * IDV calculator: ex-showroom price minus IRDAI depreciation for the vehicle's age (plus accessories, depreciated the same way).
 * The result can be fine-tuned within the range insurers usually allow. `value` is the IDV that will be sent.
 */
export default function IdvCalculator({ vehicle, isNew, registrationDate, manufactureMonth, value, onChange, price, setPrice, accessories, setAccessories, direct, setDirect }: {
  vehicle: string; isNew: boolean; registrationDate: string; manufactureMonth: string; value: string; onChange: (v: string) => void
  price: string; setPrice: (v: string) => void; accessories: string; setAccessories: (v: string) => void; direct: boolean; setDirect: (v: boolean) => void
}) {

  const from = registrationDate || manufactureMonth
  const ageMonths = isNew ? 0 : from ? ageInMonths(from) : null
  const result = useMemo(() => (ageMonths === null ? null : calculateIdv({ exShowroom: Number(price), accessories: Number(accessories || 0), ageMonths })), [price, accessories, ageMonths])

  // a new calculation replaces the chosen IDV with the recommended one (but coming back to this step keeps the choice)
  const lastIdv = useRef(value ? result?.idv : undefined)
  useEffect(() => {
    if (result?.idv === lastIdv.current) return
    lastIdv.current = result?.idv
    if (result && !direct) onChange(String(result.idv))
  }, [result?.idv]) // eslint-disable-line react-hooks/exhaustive-deps

  const chosen = Number(value) || 0
  const pct = result ? Math.round(((chosen - result.min) / Math.max(1, result.max - result.min)) * 100) : 0

  return (
    <section className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
      <header className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3.5 sm:px-5" style={{ background: "linear-gradient(90deg,#eef2ff,#ffffff)" }}>
        <span className="grid size-9 place-items-center rounded-xl bg-indigo-600 text-white"><Calculator size={18} /></span>
        <div className="min-w-0 flex-1"><p className="text-[15px] font-semibold text-zinc-900">IDV calculator</p><p className="text-xs text-zinc-500">The value your {vehicle} is insured for. Claims for total loss or theft are paid up to this amount.</p></div>
      </header>

      <div className="space-y-4 p-4 sm:p-5">
        {!direct && (
          <>
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 block text-sm font-medium text-zinc-800">Ex-showroom price</span>
                <div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">₹</span>
                  <input className={cn(ctl, 'pl-8')} inputMode="numeric" placeholder="e.g. 650000" value={price} onChange={(e) => setPrice(digits(e.target.value))} /></div>
                <span className="mt-1.5 block text-xs text-zinc-500">{Number(price) ? rupees(Number(price)) : 'Price of the same model and variant, without registration and insurance.'}</span>
              </label>
              <label className="block">
                <span className="mb-1.5 flex items-baseline justify-between text-sm font-medium text-zinc-800">Accessories value<span className="text-xs font-normal text-zinc-400">Optional</span></span>
                <div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">₹</span>
                  <input className={cn(ctl, 'pl-8')} inputMode="numeric" placeholder="e.g. 20000" value={accessories} onChange={(e) => setAccessories(digits(e.target.value))} /></div>
                <span className="mt-1.5 block text-xs text-zinc-500">Fitted after purchase: music system, alloys, CNG kit.</span>
              </label>
            </div>

            <div className="flex flex-wrap items-center gap-x-5 gap-y-1 rounded-xl bg-zinc-50 px-3.5 py-2.5 text-sm">
              <span className="text-zinc-500">Vehicle age <b className="font-semibold text-zinc-900">{ageMonths === null ? '—' : formatAge(ageMonths)}</b></span>
              {ageMonths !== null && <span className="text-zinc-500">Depreciation <b className="font-semibold text-zinc-900">{result?.dep.pct ?? calculateIdv({ exShowroom: 1, ageMonths })!.dep.pct}%</b> <span className="text-xs">({calculateIdv({ exShowroom: 1, ageMonths })!.dep.label})</span></span>}
              {ageMonths === null && <span className="text-xs text-amber-700">Add the registration date in step 2 to work out the age.</span>}
            </div>

            {result && (
              <div className="rounded-2xl bg-indigo-600 p-4 text-white sm:p-5">
                <div className="flex flex-wrap items-end justify-between gap-3">
                  <div><p className="text-xs font-medium uppercase tracking-[.08em] text-indigo-200">Your IDV</p><p className="mt-1 text-[32px] font-bold leading-none tabular-nums text-white">{rupees(chosen || result.idv)}</p></div>
                  <p className="text-right text-xs text-indigo-100">Recommended {rupees(result.idv)}<br />{rupees(Number(price))} − {result.dep.pct}%{result.accessoriesIdv ? ` + accessories ${rupees(result.accessoriesIdv)}` : ''}</p>
                </div>
                <input type="range" min={result.min} max={result.max} step={1000} value={Math.min(result.max, Math.max(result.min, chosen || result.idv))}
                  onChange={(e) => onChange(e.target.value)} aria-label="Choose your IDV"
                  className="mt-5 w-full accent-white" style={{ background: `linear-gradient(90deg,#fff ${pct}%,rgba(255,255,255,.3) ${pct}%)`, height: 6, borderRadius: 99, appearance: 'none' }} />
                <div className="mt-2 flex justify-between text-xs text-indigo-100 tabular-nums"><span>{rupees(result.min)}</span><span>{rupees(result.max)}</span></div>
                <p className="mt-3 text-xs text-indigo-100">Higher IDV means a bigger payout for theft or total loss, and a slightly higher premium.</p>
              </div>
            )}
            {result && !result.dep.official && (
              <p className="flex items-start gap-2 text-xs text-zinc-500"><Info size={14} className="mt-px shrink-0" />For vehicles older than 5 years the IDV is agreed with the insurer. This is an estimate to guide you.</p>
            )}
          </>
        )}

        {direct && (
          <label className="block">
            <span className="mb-1.5 block text-sm font-medium text-zinc-800">IDV you want</span>
            <div className="relative"><span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-zinc-500">₹</span>
              <input className={cn(ctl, 'pl-8')} inputMode="numeric" placeholder="e.g. 350000" value={value} onChange={(e) => onChange(digits(e.target.value))} /></div>
            <span className="mt-1.5 block text-xs text-zinc-500">{Number(value) ? rupees(Number(value)) : 'Your last policy shows the IDV it was insured for.'}</span>
          </label>
        )}
        <button type="button" onClick={() => { setDirect(!direct); onChange(''); setPrice(''); setAccessories('') }} className="text-sm font-medium text-indigo-600 hover:underline">
          {direct ? 'Use the calculator instead' : 'Already know your IDV? Enter it directly'}
        </button>
      </div>
    </section>
  )
}
