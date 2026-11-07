import { useState } from 'react'
import { cn } from '../ui'

/** Dependency-free SVG charts. Colours: one indigo family for volume, status colours only where status is the point. */

export function Sparkline({ data, className }: { data: number[]; className?: string }) {
  const max = Math.max(...data, 1)
  const w = 80, h = 28
  const pts = data.map((v, i) => [(i / Math.max(data.length - 1, 1)) * w, h - 2 - (v / max) * (h - 6)] as const)
  const line = pts.map(([x, y], i) => `${i ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ')
  return (
    <svg viewBox={`0 0 ${w} ${h}`} className={cn('h-7 w-20', className)} aria-hidden>
      <path d={`${line} L${w},${h} L0,${h} Z`} fill="currentColor" opacity=".08" />
      <path d={line} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

export type DayPoint = { date: Date; counts: number[] }
/** Stacked daily columns with a hover/focus read-out. `names` labels each stacked series. */
export function DailyBars({ days, names }: { days: DayPoint[]; names: string[] }) {
  const [hot, setHot] = useState<number | null>(null)
  const totals = days.map((d) => d.counts.reduce((a, b) => a + b, 0))
  const max = Math.max(...totals, 1)
  const niceMax = max <= 4 ? 4 : Math.ceil(max / 4) * 4
  const fills = ['fill-indigo-600', 'fill-indigo-300']
  const W = 640, H = 200, L = 28, B = 22, T = 8
  const cw = (W - L) / days.length
  const bw = Math.min(26, cw * 0.62)
  const hotDay = hot === null ? null : days[hot]
  const every = days.length > 20 ? 5 : days.length > 10 ? 2 : 1
  return (
    <div className="relative">
      <svg viewBox={`0 0 ${W} ${H}`} className="h-52 w-full" role="img" aria-label={`Requests per day: ${names.join(' and ')}`}>
        {[0, 1, 2, 3, 4].map((i) => {
          const y = T + ((H - T - B) * i) / 4
          return (
            <g key={i}>
              <line x1={L} x2={W} y1={y} y2={y} className="stroke-zinc-100" />
              <text x={L - 6} y={y + 3} textAnchor="end" className="fill-zinc-400 text-[10px]">{Math.round(niceMax - (niceMax * i) / 4)}</text>
            </g>
          )
        })}
        {days.map((d, i) => {
          const x = L + i * cw + (cw - bw) / 2
          let y = H - B
          return (
            <g key={i} onMouseEnter={() => setHot(i)} onMouseLeave={() => setHot(null)} onFocus={() => setHot(i)} onBlur={() => setHot(null)} tabIndex={0}
              aria-label={`${d.date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}: ${totals[i]} requests`}>
              <rect x={L + i * cw} y={T} width={cw} height={H - T - B} fill="transparent" />
              {d.counts.map((c, si) => {
                const bh = (c / niceMax) * (H - T - B)
                y -= bh
                return c ? <rect key={si} x={x} y={y} width={bw} height={bh} rx={2} className={cn(fills[si] ?? fills[0], hot !== null && hot !== i && 'opacity-40', 'transition-opacity')} /> : null
              })}
              {i % every === 0 && <text x={x + bw / 2} y={H - 6} textAnchor="middle" className="fill-zinc-400 text-[10px]">{d.date.getDate()} {d.date.toLocaleDateString('en-IN', { month: 'short' })}</text>}
            </g>
          )
        })}
      </svg>
      {hotDay && hot !== null && (
        <div className="pointer-events-none absolute top-1 z-10 rounded-lg border border-zinc-200 bg-white px-3 py-2 text-xs shadow-lg" style={{ left: `clamp(0px, calc(${((L + hot * cw + cw / 2) / W) * 100}% - 70px), calc(100% - 150px))` }}>
          <p className="font-medium text-zinc-900">{hotDay.date.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</p>
          {names.map((n, i) => <p key={n} className="mt-0.5 flex items-center gap-1.5 text-zinc-600"><span className={cn('size-2 rounded-sm', i === 0 ? 'bg-indigo-600' : 'bg-indigo-300')} />{n}<b className="ml-auto pl-3 tabular text-zinc-900">{hotDay.counts[i]}</b></p>)}
        </div>
      )}
      <div className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-xs text-zinc-500">
        {names.map((n, i) => <span key={n} className="flex items-center gap-1.5"><span className={cn('size-2 rounded-sm', i === 0 ? 'bg-indigo-600' : 'bg-indigo-300')} />{n}</span>)}
      </div>
    </div>
  )
}

export type Slice = { label: string; value: number; color: string }
export function Donut({ slices, centerLabel }: { slices: Slice[]; centerLabel: string }) {
  const total = slices.reduce((a, s) => a + s.value, 0)
  const r = 42, c = 2 * Math.PI * r
  let off = 0
  return (
    <div className="flex flex-wrap items-center gap-6">
      <div className="relative size-36 shrink-0">
        <svg viewBox="0 0 100 100" className="size-full -rotate-90" role="img" aria-label="Requests by status">
          <circle cx="50" cy="50" r={r} fill="none" strokeWidth="12" className="stroke-zinc-100" />
          {total > 0 && slices.filter((s) => s.value > 0).map((s) => {
            const len = (s.value / total) * c
            const el = <circle key={s.label} cx="50" cy="50" r={r} fill="none" strokeWidth="12" stroke={s.color} strokeDasharray={`${Math.max(len - 1.5, 0.5)} ${c}`} strokeDashoffset={-off} />
            off += len
            return el
          })}
        </svg>
        <div className="absolute inset-0 grid place-content-center text-center"><span className="text-2xl font-semibold tabular text-zinc-900">{total}</span><span className="text-[11px] text-zinc-500">{centerLabel}</span></div>
      </div>
      <ul className="min-w-[8rem] flex-1 space-y-2 text-sm">
        {slices.map((s) => (
          <li key={s.label} className="flex items-center gap-2"><span className="size-2.5 rounded-sm" style={{ background: s.color }} /><span className="capitalize text-zinc-600">{s.label}</span>
            <b className="ml-auto tabular text-zinc-900">{s.value}</b><span className="w-9 text-right text-xs tabular text-zinc-400">{total ? Math.round((s.value / total) * 100) : 0}%</span></li>
        ))}
      </ul>
    </div>
  )
}

export function BarList({ items, empty }: { items: { label: string; value: number }[]; empty: string }) {
  const max = Math.max(...items.map((i) => i.value), 1)
  if (!items.length) return <p className="py-6 text-center text-sm text-zinc-500">{empty}</p>
  return (
    <ul className="space-y-3">
      {items.map((i) => (
        <li key={i.label}>
          <div className="mb-1 flex justify-between gap-3 text-sm"><span className="truncate text-zinc-700">{i.label}</span><b className="tabular text-zinc-900">{i.value}</b></div>
          <div className="h-1.5 rounded-full bg-zinc-100"><div className="h-full rounded-full bg-indigo-600" style={{ width: `${(i.value / max) * 100}%` }} /></div>
        </li>
      ))}
    </ul>
  )
}
