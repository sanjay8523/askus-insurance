import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import {
  Bell, ChevronsLeft, ChevronsRight, ClipboardList, ExternalLink, FileCheck2, History, LayoutDashboard, LogOut, Menu, Search, Settings, ShieldCheck, UserRound, Users, X, type LucideIcon,
} from 'lucide-react'
import { Avatar, Badge, MenuItem, Popover, StatusBadge, cn } from '../ui'
import { ago, matchesRec, nameOf, refOf, secs, statusOf, titleOf, type Customer, type Data, type Rec } from './data'

export type NavItem = { path: string; label: string; icon: LucideIcon; group: 'Workspace' | 'System' }
export const NAV: NavItem[] = [
  { path: '/admin', label: 'Dashboard', icon: LayoutDashboard, group: 'Workspace' },
  { path: '/admin/requests', label: 'Requests', icon: ClipboardList, group: 'Workspace' },
  { path: '/admin/customers', label: 'Customers', icon: Users, group: 'Workspace' },
  { path: '/admin/documents', label: 'Documents', icon: FileCheck2, group: 'Workspace' },
  { path: '/admin/audit-logs', label: 'Audit log', icon: History, group: 'System' },
  { path: '/admin/settings', label: 'Settings', icon: Settings, group: 'System' },
]

const store = {
  get: (k: string) => { try { return localStorage.getItem(k) } catch { return null } },
  set: (k: string, v: string) => { try { localStorage.setItem(k, v) } catch { /* private mode */ } },
}

const Brand = ({ labelClass }: { labelClass?: string }) => (
  <div className="flex items-center gap-2.5">
    <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-indigo-600 text-white shadow-[0_1px_2px_rgba(16,24,40,.2)]"><ShieldCheck size={17} /></span>
    <span className={cn('min-w-0 leading-tight', labelClass)}><span className="block text-sm font-semibold text-zinc-900">Askus Insurance</span><span className="block text-[11px] text-zinc-500">Admin console</span></span>
  </div>
)

/* ------------------------------ sidebar ------------------------------ */
function NavList({ path, go, collapsed, newCount }: { path: string; go: (p: string) => void; collapsed: boolean; newCount: number }) {
  // md: always an icon rail. lg: full width unless the user collapsed it. Inside the phone drawer `collapsed` is false and labels always show.
  const label = collapsed ? 'hidden' : 'max-lg:hidden'
  return (
    <div role="navigation" aria-label="Admin" className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
      {(['Workspace', 'System'] as const).map((g) => (
        <div key={g}>
          <p className={cn('mb-1.5 px-2.5 text-[11px] font-medium uppercase tracking-wider text-zinc-400', label)}>{g}</p>
          <ul className="space-y-0.5">
            {NAV.filter((n) => n.group === g).map((n) => {
              const active = n.path === path
              return (
                <li key={n.path} className="group relative">
                  <button type="button" onClick={() => go(n.path)} aria-current={active ? 'page' : undefined}
                    className={cn('relative flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm transition-colors max-md:h-11',
                      active ? 'bg-zinc-100 font-medium text-zinc-900' : 'text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900')}>
                    {active && <span className="absolute -left-3 top-2 h-5 w-[3px] rounded-r bg-indigo-600" />}
                    <n.icon size={18} className={cn('shrink-0', active ? 'text-indigo-600' : 'text-zinc-400 group-hover:text-zinc-600')} />
                    <span className={cn('flex-1 truncate text-left', label)}>{n.label}</span>
                    {n.path === '/admin/requests' && newCount > 0 && <span className={cn('rounded-full bg-indigo-600 px-1.5 text-[11px] font-medium leading-5 text-white tabular', label)}>{newCount}</span>}
                    {n.path === '/admin/requests' && newCount > 0 && <span className={cn('absolute right-1.5 top-1.5 size-2 rounded-full bg-indigo-600 ring-2 ring-white', collapsed ? '' : 'lg:hidden', 'md:block hidden')} />}
                  </button>
                  <span role="tooltip" className={cn('pointer-events-none absolute left-full top-1/2 z-50 ml-3 hidden -translate-y-1/2 whitespace-nowrap rounded-md bg-zinc-900 px-2 py-1 text-xs font-medium text-white opacity-0 shadow-lg transition-opacity group-hover:opacity-100 group-focus-within:opacity-100', collapsed ? 'md:block' : 'md:block lg:hidden')}>{n.label}</span>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </div>
  )
}

export function Sidebar({ path, go, collapsed, setCollapsed, newCount }: { path: string; go: (p: string) => void; collapsed: boolean; setCollapsed: (v: boolean) => void; newCount: number }) {
  return (
    <aside className={cn('sticky top-0 hidden h-screen shrink-0 flex-col border-r border-zinc-200 bg-white transition-[width] duration-200 ease-out md:flex md:w-[68px]', collapsed ? 'lg:w-[68px]' : 'lg:w-[248px]')}>
      <div className={cn('flex h-14 items-center px-[18px]', 'border-b border-zinc-100')}><Brand labelClass={collapsed ? 'hidden' : 'max-lg:hidden'} /></div>
      <NavList path={path} go={go} collapsed={collapsed} newCount={newCount} />
      <div className="space-y-0.5 border-t border-zinc-100 p-3">
        <a href="/" className="group relative flex h-9 items-center gap-3 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900">
          <ExternalLink size={18} className="shrink-0 text-zinc-400" /><span className={cn('truncate', collapsed ? 'hidden' : 'max-lg:hidden')}>Return to site</span>
        </a>
        <button type="button" onClick={() => { setCollapsed(!collapsed); store.set('admin.sidebar', collapsed ? 'open' : 'collapsed') }} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 max-lg:hidden">
          {collapsed ? <ChevronsRight size={18} className="shrink-0 text-zinc-400" /> : <ChevronsLeft size={18} className="shrink-0 text-zinc-400" />}
          <span className={collapsed ? 'hidden' : ''}>Collapse</span>
        </button>
      </div>
    </aside>
  )
}

export function MobileDrawer({ open, onClose, path, go, newCount }: { open: boolean; onClose: () => void; path: string; go: (p: string) => void; newCount: number }) {
  useEffect(() => {
    if (!open) return
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    document.addEventListener('keydown', key)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', key); document.body.style.overflow = '' }
  }, [open, onClose])
  return (
    <div className={cn('fixed inset-0 z-50 md:hidden', open ? '' : 'pointer-events-none')} aria-hidden={!open}>
      <button tabIndex={-1} aria-label="Close menu" onClick={onClose} className={cn('absolute inset-0 bg-zinc-900/40 transition-opacity duration-200', open ? 'opacity-100' : 'opacity-0')} />
      <aside role="dialog" aria-modal="true" aria-label="Navigation" className={cn('absolute inset-y-0 left-0 flex w-[280px] max-w-[85vw] flex-col bg-white shadow-2xl transition-transform duration-200 ease-out', open ? 'translate-x-0' : '-translate-x-full')}>
        <div className="flex h-14 items-center justify-between border-b border-zinc-100 px-4"><Brand /><button type="button" onClick={onClose} aria-label="Close menu" className="grid size-11 place-items-center rounded-lg text-zinc-500 hover:bg-zinc-100"><X size={18} /></button></div>
        <NavList path={path} go={(p) => { go(p); onClose() }} collapsed={false} newCount={newCount} />
        <div className="border-t border-zinc-100 p-3 pb-[max(.75rem,env(safe-area-inset-bottom))]">
          <a href="/" className="flex h-11 items-center gap-3 rounded-lg px-2.5 text-sm text-zinc-600 hover:bg-zinc-50"><ExternalLink size={18} className="text-zinc-400" />Return to site</a>
        </div>
      </aside>
    </div>
  )
}

/* ------------------------------ global search (Ctrl/⌘ K) ------------------------------ */
type Hit = { key: string; label: string; sub: string; kind: 'rec' | 'cust'; rec?: Rec; cust?: Customer }

function SearchPalette({ data, onClose, onRecord, onCustomer }: { data: Data; onClose: () => void; onRecord: (r: Rec) => void; onCustomer: (c: Customer) => void }) {
  const [q, setQ] = useState('')
  const [active, setActive] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  useEffect(() => input.current?.focus(), [])
  const hits = useMemo<Hit[]>(() => {
    const s = q.trim().toLowerCase()
    if (s.length < 2) return []
    const recs = [...data.offline, ...data.uploads].filter((r) => matchesRec(r, s)).slice(0, 6)
      .map((r): Hit => ({ key: r.kind + r.id, label: nameOf(r), sub: `${titleOf(r)} · ${r.vehicle?.regNumber ? `${r.vehicle.regNumber} · ` : ''}${refOf(r)}`, kind: 'rec', rec: r }))
    const custs = data.customers.filter((c) => JSON.stringify([c.name, c.mobile, c.email]).toLowerCase().includes(s)).slice(0, 4)
      .map((c): Hit => ({ key: 'c' + c.id, label: c.name || 'Unnamed customer', sub: [c.mobile, c.email].filter(Boolean).join(' · '), kind: 'cust', cust: c }))
    return [...recs, ...custs]
  }, [q, data])
  useEffect(() => setActive(0), [q])
  const pick = (h: Hit) => { onClose(); if (h.rec) onRecord(h.rec); else if (h.cust) onCustomer(h.cust) }
  return (
    <div className="fixed inset-0 z-[55]" role="dialog" aria-modal="true" aria-label="Search">
      <button tabIndex={-1} aria-label="Close search" onClick={onClose} className="admin-fade absolute inset-0 bg-zinc-900/40" />
      <div className="admin-pop relative mx-auto mt-[8vh] w-[calc(100%-1.5rem)] max-w-xl overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-2xl">
        <div className="flex items-center gap-3 border-b border-zinc-200 px-4">
          <Search size={17} className="shrink-0 text-zinc-400" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search requests, customers, vehicle numbers…" aria-label="Search"
            onKeyDown={(e) => {
              if (e.key === 'Escape') onClose()
              else if (e.key === 'ArrowDown') { e.preventDefault(); setActive((a) => Math.min(a + 1, hits.length - 1)) }
              else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
              else if (e.key === 'Enter' && hits[active]) pick(hits[active])
            }}
            className="h-12 min-w-0 flex-1 bg-transparent text-base text-zinc-900 placeholder:text-zinc-400 focus:outline-none sm:text-sm" />
          <button type="button" onClick={onClose} className="grid size-8 place-items-center rounded-md text-zinc-400 hover:bg-zinc-100 sm:hidden" aria-label="Close"><X size={16} /></button>
          <kbd className="hidden rounded border border-zinc-200 px-1.5 py-0.5 text-[11px] text-zinc-500 sm:block">Esc</kbd>
        </div>
        <div className="max-h-[60vh] overflow-y-auto p-1.5">
          {q.trim().length < 2 && <p className="px-3 py-8 text-center text-sm text-zinc-500">Type a name, mobile number, vehicle number or reference.</p>}
          {q.trim().length >= 2 && hits.length === 0 && <p className="px-3 py-8 text-center text-sm text-zinc-500">No results for “{q.trim()}”.</p>}
          {hits.map((h, i) => (
            <button key={h.key} type="button" onMouseEnter={() => setActive(i)} onClick={() => pick(h)}
              className={cn('flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left', i === active ? 'bg-zinc-100' : '')}>
              {h.kind === 'rec' ? <ClipboardList size={16} className="shrink-0 text-zinc-400" /> : <UserRound size={16} className="shrink-0 text-zinc-400" />}
              <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-zinc-900">{h.label}</span><span className="block truncate text-xs text-zinc-500">{h.sub}</span></span>
              {h.rec ? <StatusBadge status={statusOf(h.rec)} /> : <Badge>Customer</Badge>}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}

/* ------------------------------ header ------------------------------ */
export function Header({ page, email, data, onMenu, go, onRecord, onCustomer, onSignOut }: {
  page: NavItem; email: string; data: Data; onMenu: () => void; go: (p: string) => void
  onRecord: (r: Rec) => void; onCustomer: (c: Customer) => void; onSignOut: () => void
}) {
  const [search, setSearch] = useState(false)
  const [seen, setSeen] = useState(() => Number(store.get('admin.notifSeen') ?? 0))
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setSearch((s) => !s) } }
    document.addEventListener('keydown', key)
    return () => document.removeEventListener('keydown', key)
  }, [])
  const fresh = useMemo(() => [...data.offline, ...data.uploads].filter((r) => statusOf(r) === 'new').sort((a, b) => secs(b.createdAt) - secs(a.createdAt)), [data.offline, data.uploads])
  const unread = fresh.filter((r) => secs(r.createdAt) > seen).length
  const markRead = () => { const t = Math.floor(Date.now() / 1000); setSeen(t); store.set('admin.notifSeen', String(t)) }
  const name = email.split('@')[0]
  return (
    <>
      <header className="sticky top-0 z-30 flex h-14 items-center gap-2 border-b border-zinc-200 bg-white/85 px-3 backdrop-blur sm:px-6">
        <button type="button" onClick={onMenu} aria-label="Open menu" className="grid size-11 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 md:hidden"><Menu size={20} /></button>
        <div role="navigation" aria-label="Breadcrumb" className="flex min-w-0 items-center gap-2 text-sm">
          <span className="text-zinc-400 max-sm:hidden">Admin</span><span className="text-zinc-300 max-sm:hidden">/</span>
          <span className="truncate font-medium text-zinc-900">{page.label}</span>
        </div>
        <div className="ml-auto flex items-center gap-1 sm:gap-2">
          <button type="button" onClick={() => setSearch(true)} aria-label="Search" className="hidden h-9 w-64 items-center gap-2 rounded-lg border border-zinc-200 bg-white px-3 text-sm text-zinc-400 shadow-[0_1px_2px_rgba(16,24,40,.04)] hover:border-zinc-300 lg:flex">
            <Search size={15} /><span className="flex-1 text-left">Search…</span><kbd className="rounded border border-zinc-200 px-1.5 text-[11px] text-zinc-500">Ctrl K</kbd>
          </button>
          <button type="button" onClick={() => setSearch(true)} aria-label="Search" className="grid size-11 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 lg:hidden"><Search size={19} /></button>

          <Popover label="Notifications" buttonClass="relative grid size-9 place-items-center rounded-lg text-zinc-600 hover:bg-zinc-100 max-md:size-11"
            button={<><Bell size={19} />{unread > 0 && <span className="absolute right-1.5 top-1.5 grid min-w-4 place-items-center rounded-full bg-indigo-600 px-1 text-[10px] font-semibold leading-4 text-white ring-2 ring-white tabular">{unread > 9 ? '9+' : unread}</span>}</>}
            panelClass="sm:w-[22rem]">
            {(close) => (
              <div>
                <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3"><p className="text-sm font-semibold text-zinc-900">Notifications</p>
                  <button type="button" onClick={markRead} disabled={!unread} className="text-xs font-medium text-indigo-600 hover:underline disabled:text-zinc-400 disabled:no-underline">Mark all read</button></div>
                <ul className="max-h-80 overflow-y-auto p-1.5">
                  {fresh.slice(0, 6).map((r) => (
                    <li key={r.kind + r.id}><button type="button" onClick={() => { close(); markRead(); onRecord(r) }} className="flex w-full items-start gap-3 rounded-lg px-2.5 py-2.5 text-left hover:bg-zinc-50">
                      <span className={cn('mt-1.5 size-2 shrink-0 rounded-full', secs(r.createdAt) > seen ? 'bg-indigo-600' : 'bg-transparent')} />
                      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-zinc-900">New request from {nameOf(r)}</span><span className="block truncate text-xs text-zinc-500">{titleOf(r)} · {ago(r.createdAt)}</span></span></button></li>
                  ))}
                  {fresh.length === 0 && <li className="px-3 py-8 text-center text-sm text-zinc-500">You're all caught up. New requests will appear here.</li>}
                </ul>
                <div className="border-t border-zinc-100 p-1.5"><button type="button" onClick={() => { close(); go('/admin/requests') }} className="w-full rounded-lg px-3 py-2 text-center text-sm font-medium text-zinc-700 hover:bg-zinc-50">View all requests</button></div>
              </div>
            )}
          </Popover>

          <Popover label="Account menu" buttonClass="flex items-center gap-2 rounded-lg p-1 hover:bg-zinc-100 max-md:p-1.5" button={<Avatar name={name} size={30} />} panelClass="sm:w-64">
            {(close) => (
              <div>
                <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3"><Avatar name={name} size={36} />
                  <div className="min-w-0"><p className="truncate text-sm font-semibold capitalize text-zinc-900">{name}</p><p className="truncate text-xs text-zinc-500">{email}</p></div></div>
                <div className="p-1.5">
                  <MenuItem icon={Settings} onClick={() => { close(); go('/admin/settings') }}>Settings</MenuItem>
                  <MenuItem icon={ExternalLink} href="/">Return to site</MenuItem>
                  <MenuItem icon={LogOut} danger onClick={onSignOut}>Sign out</MenuItem>
                </div>
              </div>
            )}
          </Popover>
        </div>
      </header>
      {search && <SearchPalette data={data} onClose={() => setSearch(false)} onRecord={onRecord} onCustomer={onCustomer} />}
    </>
  )
}

export function Frame({ children }: { children: ReactNode }) {
  return <div className="mx-auto w-full max-w-[1280px] px-4 py-5 sm:px-6 sm:py-7">{children}</div>
}

