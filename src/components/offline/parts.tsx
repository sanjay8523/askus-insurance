import { useRef, useState, type ReactNode } from 'react'
import { Check, ChevronDown, FileText, Pencil, Sparkles, UploadCloud, X } from 'lucide-react'
import { cn } from '../../ui'
import { ACCEPT } from '../../lib/uploadFiles'

/** Presentational building blocks for the offline insurance journey. No business logic lives here. */

export const STEPS = ['Vehicle', 'Details', 'IDV & owner'] as const

/** Shared control look: 44px tall for easy touch, hairline border, indigo focus ring. */
export const ctl = 'block w-full h-11 rounded-lg border border-zinc-300 bg-white px-3.5 text-base text-zinc-900 placeholder:text-zinc-400 hover:border-zinc-400 focus:border-indigo-500 focus:outline-none focus:ring-4 focus:ring-indigo-500/15 disabled:bg-zinc-50 disabled:text-zinc-500 sm:text-[15px]'
export const ctlArea = ctl.replace('h-11', 'min-h-24 py-2.5')

export function Group({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0 border-0 p-0">
      <legend className="p-0 text-[15px] font-semibold text-zinc-900">{title}</legend>
      {hint && <p className="mt-0.5 text-sm text-zinc-500">{hint}</p>}
      <div className="mt-4 space-y-4">{children}</div>
    </fieldset>
  )
}

export function Row({ label, hint, optional, badge, children }: { label: string; hint?: string; optional?: boolean; badge?: ReactNode; children: ReactNode }) {
  return (
    <label className="block min-w-0">
      <span className="mb-1.5 flex items-center justify-between gap-2 text-sm font-medium text-zinc-800"><span className="flex items-center gap-2">{label}{badge}</span>{optional && <span className="text-xs font-normal text-zinc-400">Optional</span>}</span>
      {children}
      {hint && <span className="mt-1.5 block text-xs text-zinc-500">{hint}</span>}
    </label>
  )
}

export const Two = ({ children }: { children: ReactNode }) => <div className="grid gap-4 sm:grid-cols-2">{children}</div>

export function Question({ label, badge, children }: { label: string; badge?: ReactNode; children: ReactNode }) {
  return <div><p className="mb-2 flex items-center gap-2 text-sm font-medium text-zinc-800">{label}{badge}</p>{children}</div>
}

/** Small "filled from your RC / policy" marker next to a field. */
export function AutoTag({ from }: { from?: 'rc' | 'policy' | 'lookup' }) {
  if (!from) return null
  return (
    <span className="inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full bg-violet-50 px-2 py-0.5 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200">
      <Sparkles size={11} />{from === 'policy' ? 'From policy' : from === 'rc' ? 'From RC' : 'Auto-filled'}
    </span>
  )
}

export function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T | ''; options: readonly T[]; onChange: (v: T) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex w-full rounded-lg bg-zinc-100 p-0.5 sm:inline-flex sm:w-auto">
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
          className={cn('min-h-10 min-w-0 flex-1 rounded-md px-5 py-1.5 text-sm font-medium leading-tight transition-all max-sm:px-2 sm:flex-none sm:whitespace-nowrap', value === o ? 'bg-white text-zinc-900 shadow-[0_1px_2px_rgba(16,24,40,.12)]' : 'text-zinc-600 hover:text-zinc-900')}>{o}</button>
      ))}
    </div>
  )
}

export function Chips({ label, value, options, onChange }: { label: string; value: string; options: readonly string[]; onChange: (v: string) => void }) {
  return (
    <div role="radiogroup" aria-label={label} className="flex flex-wrap gap-2">
      {options.map((o) => (
        <button key={o} type="button" role="radio" aria-checked={value === o} onClick={() => onChange(o)}
          className={cn('h-10 min-w-14 rounded-lg border px-3.5 text-sm font-medium transition-colors', value === o ? 'border-indigo-600 bg-indigo-50 text-indigo-700' : 'border-zinc-300 bg-white text-zinc-700 hover:border-zinc-400')}>{o}</button>
      ))}
    </div>
  )
}

/** Registration-plate styled input (blue IND strip, heavy letter-spacing). */
export function PlateInput({ value, onChange, disabled, placeholder, label }: { value: string; onChange: (v: string) => void; disabled?: boolean; placeholder: string; label: string }) {
  return (
    <div className={cn('flex overflow-hidden rounded-xl border-2 bg-white transition-shadow focus-within:ring-4 focus-within:ring-indigo-500/20', disabled ? 'border-zinc-200 opacity-60' : 'border-zinc-900')}>
      <span aria-hidden className="grid w-11 shrink-0 place-content-center bg-blue-700 text-center text-[10px] font-bold leading-tight tracking-wider text-white"><span className="mb-0.5 block text-sm leading-none">◉</span>IND</span>
      <input aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} disabled={disabled} autoCapitalize="characters" autoComplete="off" autoCorrect="off" spellCheck={false} maxLength={14} inputMode="text"
        className="h-16 min-w-0 flex-1 bg-transparent px-4 text-[22px] font-bold uppercase tracking-[.14em] text-zinc-900 placeholder:font-semibold placeholder:normal-case placeholder:tracking-normal placeholder:text-zinc-300 focus:outline-none sm:h-[72px] sm:text-[28px]" />
    </div>
  )
}

const TONES = ['bg-indigo-50 text-indigo-700', 'bg-sky-50 text-sky-700', 'bg-emerald-50 text-emerald-700', 'bg-amber-50 text-amber-800', 'bg-violet-50 text-violet-700', 'bg-rose-50 text-rose-700', 'bg-zinc-100 text-zinc-700']
export function Option({ selected, onToggle, title, sub, index = 0, monogram }: { selected: boolean; onToggle: () => void; title: string; sub?: string; index?: number; monogram?: boolean }) {
  const initials = title.replace(/^The /, '').split(/\s+/).slice(0, 2).map((w) => w[0]).join('').toUpperCase()
  return (
    <button type="button" role="checkbox" aria-checked={selected} onClick={onToggle}
      className={cn('flex w-full items-center gap-3.5 rounded-xl border p-3.5 text-left transition-colors', selected ? 'border-indigo-600 bg-indigo-50/50 ring-1 ring-indigo-600' : 'border-zinc-200 bg-white hover:border-zinc-300')}>
      {monogram && <span className={cn('grid size-10 shrink-0 place-items-center rounded-lg text-xs font-bold', TONES[index % TONES.length])}>{initials}</span>}
      <span className="min-w-0 flex-1"><span className="block truncate text-[15px] font-medium text-zinc-900">{title}</span>{sub && <span className="mt-0.5 block text-xs text-zinc-500">{sub}</span>}</span>
      <span className={cn('grid size-5 shrink-0 place-items-center rounded-md border transition-colors', selected ? 'border-indigo-600 bg-indigo-600 text-white' : 'border-zinc-300 bg-white')}>{selected && <Check size={13} strokeWidth={3} />}</span>
    </button>
  )
}

export function Dropzone({ files, max, onAdd, onRemove }: { files: File[]; max: number; onAdd: (l: FileList | null) => void; onRemove: (i: number) => void }) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const size = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)
  return (
    <div>
      <div role="button" tabIndex={0} onClick={() => input.current?.click()} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.current?.click() } }}
        onDragOver={(e) => { e.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={(e) => { e.preventDefault(); setOver(false); onAdd(e.dataTransfer.files) }}
        className={cn('flex cursor-pointer flex-col items-center rounded-xl border-2 border-dashed px-4 py-8 text-center transition-colors', over ? 'border-indigo-500 bg-indigo-50' : 'border-zinc-300 bg-zinc-50/50 hover:border-zinc-400 hover:bg-zinc-50')}>
        <span className="grid size-11 place-items-center rounded-full bg-white text-indigo-600 shadow-[0_1px_2px_rgba(16,24,40,.1)] ring-1 ring-zinc-200"><UploadCloud size={20} /></span>
        <p className="mt-3 text-[15px] font-medium text-zinc-900"><span className="text-indigo-600">Choose files</span><span className="max-sm:hidden"> or drag them here</span></p>
        <p className="mt-1 text-xs text-zinc-500">RC, previous policy, Aadhaar/PAN · a photo in any format or a PDF · max {max} files</p>
        <input ref={input} type="file" multiple accept={ACCEPT} hidden onChange={(e) => { onAdd(e.target.files); e.target.value = '' }} />
      </div>
      {files.length > 0 && (
        <ul className="mt-3 space-y-2">
          {files.map((f, i) => (
            <li key={f.name + i} className="flex items-center gap-3 rounded-lg border border-zinc-200 bg-white p-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-500"><FileText size={16} /></span>
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-zinc-900">{f.name}</span><span className="text-xs text-zinc-500">{size(f.size)}</span></span>
              <button type="button" aria-label={`Remove ${f.name}`} onClick={() => onRemove(i)} className="grid size-9 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"><X size={16} /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export function ReviewCard({ title, onEdit, rows }: { title: string; onEdit: () => void; rows: [string, string | undefined][] }) {
  const shown = rows.filter(([, v]) => v)
  return (
    <section className="rounded-xl border border-zinc-200 bg-white">
      <header className="flex items-center justify-between border-b border-zinc-100 px-4 py-2.5">
        <h3 className="text-sm font-semibold text-zinc-900">{title}</h3>
        <button type="button" onClick={onEdit} className="inline-flex h-8 items-center gap-1.5 rounded-md px-2 text-sm font-medium text-indigo-600 hover:bg-indigo-50"><Pencil size={13} />Edit</button>
      </header>
      <dl className="divide-y divide-zinc-100 px-4 text-sm">
        {shown.map(([k, v]) => <div key={k} className="flex justify-between gap-6 py-2"><dt className="shrink-0 text-zinc-500">{k}</dt><dd className="min-w-0 break-words text-right font-medium text-zinc-900">{v}</dd></div>)}
      </dl>
    </section>
  )
}

/** Step indicator: numbered rail on wide screens, "Step n of 5" with a bar on phones. */
export function Progress({ step, onJump }: { step: number; onJump: (i: number) => void }) {
  return (
    <>
      <ol className="hidden items-center gap-1 lg:flex" aria-label="Progress">
        {STEPS.map((s, i) => {
          const done = i < step, now = i === step
          return (
            <li key={s} className="flex items-center gap-1">
              <button type="button" aria-disabled={!done} tabIndex={done ? 0 : -1} onClick={() => { if (done) onJump(i) }} aria-current={now ? 'step' : undefined}
                className={cn('flex h-8 items-center gap-2 rounded-full pl-1 pr-3 text-sm transition-colors', now ? 'bg-zinc-900 text-white' : done ? 'text-zinc-700 hover:bg-zinc-100' : 'cursor-default text-zinc-400')}>
                <span className={cn('grid size-6 place-items-center rounded-full text-xs font-semibold', now ? 'bg-white text-zinc-900' : done ? 'bg-indigo-600 text-white' : 'bg-zinc-100 text-zinc-500')}>{done ? <Check size={13} strokeWidth={3} /> : i + 1}</span>{s}
              </button>
              {i < STEPS.length - 1 && <span aria-hidden className={cn('h-px w-5', i < step ? 'bg-indigo-600' : 'bg-zinc-200')} />}
            </li>
          )
        })}
      </ol>
      <p className="text-sm font-medium text-zinc-700 lg:hidden">Step {step + 1} of {STEPS.length} <span className="text-zinc-400">· {STEPS[step]}</span></p>
    </>
  )
}

export function Collapse({ title, children }: { title: string; children: ReactNode }) {
  const [open, setOpen] = useState(false)
  return (
    <div className="rounded-xl border border-zinc-200 bg-white lg:hidden">
      <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex h-12 w-full items-center justify-between px-4 text-sm font-medium text-zinc-800">{title}<ChevronDown size={17} className={cn('text-zinc-400 transition-transform', open && 'rotate-180')} /></button>
      {open && <div className="border-t border-zinc-100 p-4">{children}</div>}
    </div>
  )
}
