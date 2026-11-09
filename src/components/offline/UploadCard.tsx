import { useRef, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, FileText, Sparkles, UploadCloud, X } from 'lucide-react'
import { cn } from '../../ui'

export type ScanStatus = 'reading' | 'done' | 'none' | 'unavailable' | 'failed' | 'too_large'
export type ScannedFile = { id: string; file: File; status: ScanStatus; found: number }

const size = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

function StatusLine({ e, what }: { e: ScannedFile; what: string }) {
  if (e.status === 'reading') return (
    <span className="flex items-center gap-2 text-xs font-medium text-violet-700">
      <span className="ai-ring relative grid size-3.5 place-items-center rounded-full"><span className="size-2.5 rounded-full bg-white" /></span>Reading your {what} with AI…
    </span>
  )
  if (e.status === 'done') return <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700"><CheckCircle2 size={13} />{e.found} detail{e.found === 1 ? '' : 's'} filled in for you</span>
  const text = e.status === 'none' ? `Saved. We couldn't spot the details, you'll fill them next.`
    : e.status === 'too_large' ? 'Saved. Too large to read automatically, you\'ll fill the details next.'
      : e.status === 'unavailable' ? 'Saved. Auto-fill is not switched on yet, you\'ll fill the details next.'
        : 'Saved. We couldn\'t read it automatically, you\'ll fill the details next.'
  return <span className="flex items-start gap-1.5 text-xs text-amber-700"><AlertCircle size={13} className="mt-px shrink-0" />{text}</span>
}

/** Upload box for the RC or the previous policy. Each file is read straight away and the details fill the next step. */
export default function UploadCard({ title, what, hint, required, icon, items, max, onAdd, onRemove, footer }: {
  title: string; what: string; hint: string; required?: boolean; icon: ReactNode; items: ScannedFile[]; max: number
  onAdd: (list: FileList | null) => void; onRemove: (id: string) => void; footer?: ReactNode
}) {
  const input = useRef<HTMLInputElement>(null)
  const [over, setOver] = useState(false)
  const full = items.length >= max
  return (
    <section className={cn('rounded-2xl border bg-white p-4 sm:p-5', required && !items.length ? 'border-rose-200' : 'border-zinc-200')}>
      <div className="flex items-start gap-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-zinc-100 text-zinc-600">{icon}</span>
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-zinc-900">{title}
            {required ? <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700 ring-1 ring-inset ring-rose-200">Required</span>
              : <span className="rounded-full bg-zinc-100 px-2 py-0.5 text-[11px] font-medium text-zinc-600">Optional</span>}
          </p>
          <p className="mt-0.5 text-sm text-zinc-500">{hint}</p>
        </div>
        <span className="hidden shrink-0 items-center gap-1 rounded-full bg-violet-50 px-2 py-1 text-[11px] font-medium text-violet-700 ring-1 ring-inset ring-violet-200 sm:inline-flex"><Sparkles size={12} />AI auto-fill</span>
      </div>

      {items.length > 0 && (
        <ul className="mt-4 space-y-2">
          {items.map((e) => (
            <li key={e.id} className="flex items-center gap-3 rounded-xl border border-zinc-200 bg-zinc-50/60 p-2.5">
              <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-white text-zinc-500 ring-1 ring-zinc-200"><FileText size={16} /></span>
              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-baseline gap-1.5 text-sm"><span className="truncate font-medium text-zinc-900">{e.file.name}</span><span className="shrink-0 text-zinc-400">· {size(e.file.size)}</span></span>
                <StatusLine e={e} what={what} />
              </span>
              <button type="button" aria-label={`Remove ${e.file.name}`} onClick={() => onRemove(e.id)} disabled={e.status === 'reading'} className="grid size-9 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 disabled:opacity-40"><X size={16} /></button>
            </li>
          ))}
        </ul>
      )}

      {!full && (
        <div role="button" tabIndex={0} onClick={() => input.current?.click()} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); input.current?.click() } }}
          onDragOver={(ev) => { ev.preventDefault(); setOver(true) }} onDragLeave={() => setOver(false)} onDrop={(ev) => { ev.preventDefault(); setOver(false); onAdd(ev.dataTransfer.files) }}
          className={cn('mt-4 flex cursor-pointer items-center justify-center gap-2.5 rounded-xl border-2 border-dashed px-4 py-4 text-sm transition-colors',
            over ? 'border-indigo-500 bg-indigo-50 text-indigo-700' : 'border-zinc-300 text-zinc-600 hover:border-zinc-400 hover:bg-zinc-50')}>
          <UploadCloud size={18} className="text-indigo-600" />
          <span><b className="font-medium text-indigo-600">{items.length ? 'Add another file' : 'Upload photo or PDF'}</b><span className="max-sm:hidden"> or drag it here</span></span>
          <input ref={input} type="file" accept=".jpg,.jpeg,.png,.pdf,image/jpeg,image/png,application/pdf" multiple={max > 1} hidden onChange={(ev) => { onAdd(ev.target.files); ev.target.value = '' }} />
        </div>
      )}
      {footer}
    </section>
  )
}
