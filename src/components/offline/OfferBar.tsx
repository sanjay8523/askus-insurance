import { Gift, Sparkles } from 'lucide-react'
import { cn } from '../../ui'

/** Red cashback bar shown at the top of every step of the offline journey. */
export default function OfferBar({ amount, vehicle, step, total }: { amount: string; vehicle: string; step: number; total: number }) {
  return (
    <div className="relative overflow-hidden text-white" style={{ background: 'linear-gradient(90deg,#9f1239 0%,#e11d48 38%,#dc2626 68%,#ea580c 100%)' }} role="note" aria-label={`Offer: up to ${amount} cashback`}>
      <div aria-hidden className="offer-sheen pointer-events-none absolute inset-0" />
      <div aria-hidden className="pointer-events-none absolute -right-10 -top-12 size-40 rounded-full bg-white/10 blur-2xl" />
      <div className="relative mx-auto flex max-w-[1080px] items-center gap-3 px-4 py-2.5 sm:px-6">
        <span className="offer-pulse grid size-9 shrink-0 place-items-center rounded-full bg-white/15 ring-1 ring-white/35"><Gift size={18} /></span>
        <p className="min-w-0 flex-1 leading-tight text-white">
          <span className="block text-[15px] font-semibold sm:inline">Your offer: up to {amount} cashback</span>
          <span className="block text-[12px] text-white/85 sm:ml-2 sm:inline sm:text-[13px]">on this {vehicle} insurance, credited once your policy is confirmed</span>
        </p>
        <span className="flex shrink-0 items-center gap-2 rounded-full bg-black/20 px-2.5 py-1 text-[11px] font-medium ring-1 ring-white/20 sm:px-3 sm:text-xs">
          <Sparkles size={13} className="max-sm:hidden" />
          <span className="max-sm:hidden">Step {step} of {total}</span>
          <span className="flex gap-1" aria-hidden>{Array.from({ length: total }, (_, i) => <span key={i} className={cn('h-1.5 w-4 rounded-full', i < step ? 'bg-white' : 'bg-white/35')} />)}</span>
        </span>
      </div>
    </div>
  )
}
