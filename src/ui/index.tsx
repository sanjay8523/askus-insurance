import { useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { AlertTriangle, CheckCircle2, Inbox, Loader2, X, type LucideIcon } from 'lucide-react'
import './ui.css'

/** Admin design system: neutral zinc surfaces, one indigo accent, 8px controls, 12px cards, hairline borders. */
export const cn = (...a: (string | false | null | undefined)[]) => a.filter(Boolean).join(' ')

/* ------------------------------ buttons ------------------------------ */
type BtnProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'; size?: 'sm' | 'md'; icon?: LucideIcon; loading?: boolean
}
const BTN = {
  primary: 'bg-indigo-600 text-white hover:bg-indigo-700 shadow-[0_1px_2px_rgba(16,24,40,.12)]',
  secondary: 'border border-zinc-200 bg-white text-zinc-800 hover:bg-zinc-50 shadow-[0_1px_2px_rgba(16,24,40,.04)]',
  ghost: 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900',
  danger: 'bg-rose-600 text-white hover:bg-rose-700',
}
export function Button({ variant = 'secondary', size = 'md', icon: Icon, loading, className, children, disabled, ...p }: BtnProps) {
  return (
    <button {...p} disabled={disabled || loading}
      className={cn('inline-flex shrink-0 items-center justify-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-50',
        size === 'sm' ? 'h-8 px-3 max-md:h-10' : 'h-9 px-3.5 max-md:h-11', BTN[variant], className)}>
      {loading ? <Loader2 size={15} className="animate-spin" /> : Icon && <Icon size={15} />}{children}
    </button>
  )
}
export function IconButton({ label, icon: Icon, className, ...p }: ButtonHTMLAttributes<HTMLButtonElement> & { label: string; icon: LucideIcon }) {
  return (
    <button {...p} aria-label={label} title={label}
      className={cn('grid size-9 shrink-0 place-items-center rounded-lg text-zinc-500 transition-colors hover:bg-zinc-100 hover:text-zinc-900 max-md:size-11', className)}>
      <Icon size={18} />
    </button>
  )
}

/* ------------------------------ surfaces ------------------------------ */
export const Card = ({ children, className }: { children: ReactNode; className?: string }) => (
  <div className={cn('rounded-xl border border-zinc-200 bg-white shadow-[0_1px_2px_rgba(16,24,40,.04)]', className)}>{children}</div>
)
export const CardHeader = ({ title, hint, action }: { title: string; hint?: string; action?: ReactNode }) => (
  <div className="flex items-start justify-between gap-3 px-5 pb-0 pt-4">
    <div className="min-w-0"><h2 className="mb-0 text-sm font-semibold text-zinc-900">{title}</h2>{hint && <p className="mt-0.5 text-xs text-zinc-500">{hint}</p>}</div>{action}
  </div>
)
export function PageHeader({ title, description, actions }: { title: string; description?: string; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0"><h1 className="text-xl font-semibold tracking-tight text-zinc-900">{title}</h1>
        {description && <p className="mt-1 max-w-2xl text-sm text-zinc-500">{description}</p>}</div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  )
}

/* ------------------------------ badges ------------------------------ */
const TONES = {
  neutral: 'bg-zinc-100 text-zinc-700 ring-zinc-200', blue: 'bg-blue-50 text-blue-700 ring-blue-200', amber: 'bg-amber-50 text-amber-800 ring-amber-200',
  violet: 'bg-violet-50 text-violet-700 ring-violet-200', green: 'bg-emerald-50 text-emerald-700 ring-emerald-200', red: 'bg-rose-50 text-rose-700 ring-rose-200',
}
const DOTS = { neutral: 'bg-zinc-400', blue: 'bg-blue-500', amber: 'bg-amber-500', violet: 'bg-violet-500', green: 'bg-emerald-500', red: 'bg-rose-500' }
export type Tone = keyof typeof TONES
export const Badge = ({ tone = 'neutral', dot = true, children }: { tone?: Tone; dot?: boolean; children: ReactNode }) => (
  <span className={cn('inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-medium capitalize ring-1 ring-inset', TONES[tone])}>
    {dot && <span className={cn('size-1.5 rounded-full', DOTS[tone])} />}{children}
  </span>
)
export const STATUS_TONE: Record<string, Tone> = { new: 'blue', contacted: 'amber', quoted: 'violet', issued: 'green', closed: 'neutral' }
export const StatusBadge = ({ status }: { status?: string }) => <Badge tone={STATUS_TONE[status ?? 'new'] ?? 'neutral'}>{status ?? 'new'}</Badge>

export function Avatar({ name, size = 32 }: { name?: string; size?: number }) {
  const t = (name || '?').trim().split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?'
  return <span style={{ width: size, height: size, fontSize: size * 0.38 }} className="grid shrink-0 place-items-center rounded-full bg-indigo-50 font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">{t}</span>
}

/* ------------------------------ states ------------------------------ */
export const Skeleton = ({ className }: { className?: string }) => <div aria-hidden className={cn('animate-pulse rounded-md bg-zinc-100', className)} />
export function EmptyState({ icon: Icon = Inbox, title, hint, action }: { icon?: LucideIcon; title: string; hint?: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center px-6 py-14 text-center">
      <span className="grid size-10 place-items-center rounded-full bg-zinc-100 text-zinc-500"><Icon size={18} /></span>
      <p className="mt-3 text-sm font-medium text-zinc-900">{title}</p>
      {hint && <p className="mt-1 max-w-sm text-sm text-zinc-500">{hint}</p>}{action && <div className="mt-4">{action}</div>}
    </div>
  )
}
export const ErrorState = ({ message }: { message: string }) => (
  <div role="alert" className="flex items-start gap-3 rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-800">
    <AlertTriangle size={18} className="mt-0.5 shrink-0" /><p>{message}</p>
  </div>
)

/* ------------------------------ form controls ------------------------------ */
export const inputCls = 'block w-full rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-900 shadow-[0_1px_2px_rgba(16,24,40,.04)] placeholder:text-zinc-400 hover:border-zinc-300 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 h-9 max-md:h-11 max-md:text-base'
export const Field = ({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) => (
  <label className="block"><span className="mb-1.5 block text-xs font-medium text-zinc-700">{label}</span>{children}{hint && <span className="mt-1 block text-xs text-zinc-500">{hint}</span>}</label>
)

/* ------------------------------ definition lists ------------------------------ */
export function Props({ rows }: { rows: [string, unknown][] }) {
  const shown = rows.filter(([, v]) => v !== undefined && v !== null && v !== '')
  if (!shown.length) return <p className="text-sm text-zinc-500">Nothing provided.</p>
  return (
    <dl className="divide-y divide-zinc-100 text-sm">
      {shown.map(([k, v]) => (
        <div key={k} className="flex justify-between gap-6 py-2"><dt className="shrink-0 text-zinc-500">{k}</dt><dd className="min-w-0 break-words text-right font-medium text-zinc-900">{typeof v === 'boolean' ? (v ? 'Yes' : 'No') : String(v)}</dd></div>
      ))}
    </dl>
  )
}

/* ------------------------------ popover / tooltip ------------------------------ */
export function Popover({ label, button, buttonClass, panelClass, phone = 'top', children }: {
  label: string; button: ReactNode; buttonClass?: string; panelClass?: string; phone?: 'top' | 'bottom'; children: (close: () => void) => ReactNode
}) {
  const [open, setOpen] = useState(false)
  const box = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const down = (e: PointerEvent) => { if (!box.current?.contains(e.target as Node)) setOpen(false) }
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('pointerdown', down); document.addEventListener('keydown', key)
    return () => { document.removeEventListener('pointerdown', down); document.removeEventListener('keydown', key) }
  }, [open])
  return (
    <div ref={box} className="relative">
      <button type="button" aria-label={label} aria-haspopup="menu" aria-expanded={open} onClick={() => setOpen((o) => !o)} className={buttonClass}>{button}</button>
      {open && phone === 'bottom' && <div aria-hidden className="admin-fade fixed inset-0 z-40 bg-zinc-900/30 sm:hidden" />}
      {open && (
        <div role="menu" className={cn('admin-pop absolute right-0 top-full z-50 mt-2 overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-[0_12px_32px_-8px_rgba(16,24,40,.18),0_2px_6px_rgba(16,24,40,.06)] max-sm:fixed max-sm:inset-x-3 max-sm:mt-0 max-sm:w-auto',
          phone === 'top' ? 'max-sm:top-14' : 'max-sm:bottom-[max(.75rem,env(safe-area-inset-bottom))] max-sm:top-auto', panelClass)}>
          {children(() => setOpen(false))}
        </div>
      )}
    </div>
  )
}
export const MenuItem = ({ icon: Icon, children, onClick, danger, href }: { icon?: LucideIcon; children: ReactNode; onClick?: () => void; danger?: boolean; href?: string }) => {
  const cls = cn('flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-sm max-md:py-3', danger ? 'text-rose-700 hover:bg-rose-50' : 'text-zinc-700 hover:bg-zinc-100')
  const inner = <>{Icon && <Icon size={16} className="shrink-0 text-zinc-400" />}{children}</>
  return href ? <a role="menuitem" href={href} className={cls}>{inner}</a> : <button role="menuitem" type="button" onClick={onClick} className={cls}>{inner}</button>
}

export const Tooltip = ({ text, children, show = true }: { text: string; children: ReactNode; show?: boolean }) => (
  <span className="group relative flex">
    {children}
    {show && <span role="tooltip" className="pointer-events-none absolute left-full top-1/2 z-50 ml-2 -translate-y-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">{text}</span>}
  </span>
)

/* ------------------------------ sheet (right drawer, full screen on phones) ------------------------------ */
export function Sheet({ title, subtitle, onClose, children, footer }: { title: string; subtitle?: string; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    document.addEventListener('keydown', key)
    return () => { document.body.style.overflow = prev; document.removeEventListener('keydown', key) }
  }, [onClose])
  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <button aria-label="Close panel" tabIndex={-1} onClick={onClose} className="admin-fade absolute inset-0 bg-zinc-900/40" />
      <aside role="dialog" aria-modal="true" aria-label={title} className="admin-slide relative flex h-full w-full flex-col bg-white shadow-2xl sm:max-w-[540px] sm:border-l sm:border-zinc-200">
        <header className="flex items-start justify-between gap-3 border-b border-zinc-200 px-5 py-4">
          <div className="min-w-0"><h2 className="mb-0 truncate text-base font-semibold text-zinc-900">{title}</h2>{subtitle && <p className="mt-0.5 truncate text-xs text-zinc-500">{subtitle}</p>}</div>
          <IconButton label="Close" icon={X} onClick={onClose} autoFocus />
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="border-t border-zinc-200 bg-zinc-50/60 px-5 py-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">{footer}</footer>}
      </aside>
    </div>
  )
}

/* ------------------------------ toasts ------------------------------ */
type T = { id: number; msg: string; tone: 'ok' | 'err' }
const listeners = new Set<(t: T) => void>()
export const toast = (msg: string, tone: T['tone'] = 'ok') => listeners.forEach((l) => l({ id: Date.now() + Math.random(), msg, tone }))
export function ToastHost() {
  const [items, setItems] = useState<T[]>([])
  useEffect(() => {
    const on = (t: T) => { setItems((p) => [...p, t]); setTimeout(() => setItems((p) => p.filter((x) => x.id !== t.id)), 4000) }
    listeners.add(on)
    return () => { listeners.delete(on) }
  }, [])
  return (
    <div aria-live="polite" className="pointer-events-none fixed inset-x-3 bottom-3 z-[60] flex flex-col items-center gap-2 sm:inset-x-auto sm:right-4 sm:items-end">
      {items.map((t) => (
        <div key={t.id} role="status" className="admin-slide-up pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-lg bg-zinc-900 px-3.5 py-2.5 text-sm text-white shadow-xl">
          {t.tone === 'ok' ? <CheckCircle2 size={16} className="shrink-0 text-emerald-400" /> : <AlertTriangle size={16} className="shrink-0 text-rose-400" />}{t.msg}
        </div>
      ))}
    </div>
  )
}
