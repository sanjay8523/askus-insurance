import { useMemo, useState } from 'react'
import { ArrowRight, BadgeCheck, ClipboardList, Copy, Download, ExternalLink, FileCheck2, FileText, History, Paperclip, Phone, Send, Users, XCircle } from 'lucide-react'
import { DataTable, type Column, type RowAction } from './table'
import { Avatar, Badge, Button, PageHeader, StatusBadge, cn, inputCls, toast } from '../ui'
import { CustomerSheet } from './Sheets'
import {
  STATUSES, ago, docsOf, kb, matchesRec, mobileOf, nameOf, openDocument, refOf, saveRequest, secs, shortDate, statusOf, titleOf, toCsv, when,
  type Audit, type Customer, type Data, type DocRef, type Rec,
} from './data'

const mono = 'font-mono text-xs text-zinc-500'
const copy = (text: string, what: string) => navigator.clipboard?.writeText(text).then(() => toast(`${what} copied.`), () => toast('Could not copy.', 'err'))

/* ------------------------------ requests ------------------------------ */
export function RequestsPage({ d, admin, onOpen, initialStatus }: { d: Data; admin: string; onOpen: (r: Rec) => void; initialStatus: string }) {
  const [q, setQ] = useState('')
  const [status, setStatus] = useState(initialStatus)
  const [type, setType] = useState('all')
  const all = useMemo(() => [...d.offline, ...d.uploads], [d.offline, d.uploads])
  const typed = useMemo(() => all.filter((r) => type === 'all' || (type === 'uploads' ? r.kind === 'upload' : r.vehicleType === type)), [all, type])
  const rows = useMemo(() => typed.filter((r) => (status === 'all' || statusOf(r) === status) && matchesRec(r, q)), [typed, status, q])
  const counts = (s: string) => (s === 'all' ? typed.length : typed.filter((r) => statusOf(r) === s).length)

  async function quick(r: Rec, s: string) {
    try { await saveRequest(r, { status: s, adminNote: r.adminNote ?? '' }, admin); toast(`${nameOf(r)} marked ${s}.`) } catch { toast('Could not update. Are the Firestore rules deployed?', 'err') }
  }
  function exportCsv() {
    const url = URL.createObjectURL(new Blob([toCsv(rows)], { type: 'text/csv;charset=utf-8' }))
    const a = Object.assign(document.createElement('a'), { href: url, download: `askus-requests-${new Date().toISOString().slice(0, 10)}.csv` })
    a.click(); URL.revokeObjectURL(url); toast(`Exported ${rows.length} requests.`)
  }

  const columns: Column<Rec>[] = [
    { key: 'customer', header: 'Customer', sort: (a, b) => nameOf(a).localeCompare(nameOf(b)), cell: (r) => (
      <div className="flex items-center gap-3"><Avatar name={nameOf(r)} size={30} /><div className="min-w-0"><p className="truncate font-medium text-zinc-900">{nameOf(r)}</p><p className="text-xs text-zinc-500">{mobileOf(r)}</p></div></div>) },
    { key: 'request', header: 'Request', cell: (r) => (<div><p className="capitalize text-zinc-800">{titleOf(r)}</p><p className="text-xs text-zinc-500">{r.vehicle?.regNumber ? String(r.vehicle.regNumber) : r.kind === 'offline' ? 'New vehicle' : 'Upload'}</p></div>) },
    { key: 'ref', header: 'Reference', hideBelow: 'lg', cell: (r) => <span className={mono}>{refOf(r)}</span> },
    { key: 'received', header: 'Received', sort: (a, b) => secs(a.createdAt) - secs(b.createdAt), hideBelow: 'lg', cell: (r) => <span title={when(r.createdAt)} className="whitespace-nowrap text-zinc-600">{ago(r.createdAt)}</span> },
    { key: 'docs', header: 'Files', sort: (a, b) => docsOf(a).length - docsOf(b).length, hideBelow: 'xl', cell: (r) => <span className="inline-flex items-center gap-1 text-zinc-600"><Paperclip size={13} className="text-zinc-400" />{docsOf(r).length}</span> },
    { key: 'status', header: 'Status', sort: (a, b) => STATUSES.indexOf(statusOf(a)) - STATUSES.indexOf(statusOf(b)), cell: (r) => <StatusBadge status={statusOf(r)} /> },
  ]
  const actions = (r: Rec): RowAction<Rec>[] => [
    { label: 'Open details', icon: ArrowRight, onClick: onOpen },
    { label: 'Copy reference', icon: Copy, onClick: (x) => copy(refOf(x), 'Reference') },
    ...(statusOf(r) !== 'contacted' ? [{ label: 'Mark contacted', icon: Phone, onClick: (x: Rec) => quick(x, 'contacted') }] : []),
    ...(statusOf(r) !== 'quoted' ? [{ label: 'Mark quoted', icon: Send, onClick: (x: Rec) => quick(x, 'quoted') }] : []),
    ...(statusOf(r) !== 'issued' ? [{ label: 'Mark issued', icon: BadgeCheck, onClick: (x: Rec) => quick(x, 'issued') }] : []),
    ...(statusOf(r) !== 'closed' ? [{ label: 'Close request', icon: XCircle, onClick: (x: Rec) => quick(x, 'closed'), danger: true }] : []),
  ]

  return (
    <>
      <PageHeader title="Requests" description="Offline car and bike insurance requests and customer document uploads, with owner, vehicle and quote preferences."
        actions={<Button icon={Download} disabled={!rows.length} onClick={exportCsv}>Export CSV</Button>} />
      <div role="group" aria-label="Filter by status" className="mb-3 flex flex-wrap gap-1.5">
        {['all', ...STATUSES].map((s) => (
          <button key={s} type="button" aria-pressed={status === s} onClick={() => setStatus(s)}
            className={cn('inline-flex h-8 items-center gap-1.5 rounded-full border px-3 text-xs font-medium capitalize transition-colors max-md:h-10', status === s ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50')}>
            {s}<span className={cn('tabular', status === s ? 'text-zinc-300' : 'text-zinc-400')}>{counts(s)}</span></button>
        ))}
      </div>
      <DataTable rows={rows} columns={columns} rowKey={(r) => r.kind + r.id} loading={d.loading} error={d.error} onRowClick={onOpen} actions={actions} noun="requests"
        search={{ value: q, onChange: setQ, placeholder: 'Search name, mobile, vehicle or reference' }} initialSort={{ key: 'received', dir: 'desc' }}
        filters={
          <select value={type} onChange={(e) => setType(e.target.value)} aria-label="Request type" className={cn(inputCls, 'w-auto min-w-36')}>
            <option value="all">All types</option><option value="car">Car</option><option value="bike">Bike</option><option value="uploads">Document uploads</option>
          </select>}
        empty={{ icon: ClipboardList, title: 'No requests yet', hint: 'Requests appear here the moment a customer submits one.' }}
        card={(r) => (
          <div>
            <div className="flex items-center justify-between gap-2"><p className="truncate font-medium text-zinc-900">{nameOf(r)}</p><StatusBadge status={statusOf(r)} /></div>
            <p className="mt-0.5 truncate text-sm capitalize text-zinc-600">{titleOf(r)}{r.vehicle?.regNumber ? ` · ${r.vehicle.regNumber}` : ''}</p>
            <p className="mt-1 text-xs text-zinc-400">{mobileOf(r)} · {ago(r.createdAt)} · {refOf(r)}</p>
          </div>)} />
    </>
  )
}

/* ------------------------------ customers ------------------------------ */
export function CustomersPage({ d, selected, onSelect, onOpen }: { d: Data; selected: Customer | null; onSelect: (c: Customer | null) => void; onOpen: (r: Rec) => void }) {
  const [q, setQ] = useState('')
  const all = useMemo(() => [...d.offline, ...d.uploads], [d.offline, d.uploads])
  const countFor = useMemo(() => { const m = new Map<string, number>(); all.forEach((r) => r.uid && m.set(r.uid, (m.get(r.uid) ?? 0) + 1)); return m }, [all])
  const rows = d.customers.filter((c) => !q.trim() || JSON.stringify([c.name, c.mobile, c.email, c.city]).toLowerCase().includes(q.trim().toLowerCase()))
  const columns: Column<Customer>[] = [
    { key: 'name', header: 'Customer', sort: (a, b) => (a.name ?? '').localeCompare(b.name ?? ''), cell: (c) => (
      <div className="flex items-center gap-3"><Avatar name={c.name || c.email} size={30} /><div className="min-w-0"><p className="truncate font-medium text-zinc-900">{c.name || 'Unnamed'}</p><p className="truncate text-xs text-zinc-500 lg:hidden">{c.mobile || c.email || ''}</p></div></div>) },
    { key: 'mobile', header: 'Mobile', hideBelow: 'lg', cell: (c) => <span className="text-zinc-700">{c.mobile || '—'}</span> },
    { key: 'email', header: 'Email', hideBelow: 'xl', cell: (c) => <span className="text-zinc-600">{c.email || '—'}</span> },
    { key: 'city', header: 'City', hideBelow: 'xl', cell: (c) => <span className="text-zinc-600">{c.city || '—'}</span> },
    { key: 'joined', header: 'Joined', sort: (a, b) => secs(a.createdAt) - secs(b.createdAt), hideBelow: 'lg', cell: (c) => <span className="whitespace-nowrap text-zinc-600">{shortDate(c.createdAt)}</span> },
    { key: 'requests', header: 'Requests', sort: (a, b) => (countFor.get(a.id) ?? 0) - (countFor.get(b.id) ?? 0), cell: (c) => <Badge tone={countFor.get(c.id) ? 'blue' : 'neutral'} dot={false}>{countFor.get(c.id) ?? 0}</Badge> },
  ]
  const actions = (c: Customer): RowAction<Customer>[] => [
    { label: 'View profile', icon: ArrowRight, onClick: onSelect },
    ...(c.mobile ? [{ label: 'Copy mobile number', icon: Copy, onClick: (x: Customer) => copy(x.mobile ?? '', 'Mobile number') }] : []),
    ...(c.email ? [{ label: 'Copy email', icon: Copy, onClick: (x: Customer) => copy(x.email ?? '', 'Email') }] : []),
  ]
  return (
    <>
      <PageHeader title="Customers" description="Every registered customer. Accounts require Indian mobile OTP verification." />
      <DataTable rows={rows} columns={columns} rowKey={(c) => c.id} loading={d.loading} error={d.error} onRowClick={onSelect} actions={actions} noun="customers"
        search={{ value: q, onChange: setQ, placeholder: 'Search name, mobile, email or city' }} initialSort={{ key: 'joined', dir: 'desc' }}
        empty={{ icon: Users, title: 'No customers yet', hint: 'Customers appear after they sign in with their mobile number.' }}
        card={(c) => (
          <div className="flex items-center gap-3"><Avatar name={c.name || c.email} size={36} />
            <div className="min-w-0"><p className="truncate font-medium text-zinc-900">{c.name || 'Unnamed'}</p><p className="truncate text-sm text-zinc-500">{c.mobile || c.email || '—'}</p>
              <p className="text-xs text-zinc-400">Joined {shortDate(c.createdAt)} · {countFor.get(c.id) ?? 0} requests</p></div></div>)} />
      {selected && <CustomerSheet customer={selected} requests={all.filter((r) => r.uid === selected.id)} onClose={() => onSelect(null)} onOpen={onOpen} />}
    </>
  )
}

/* ------------------------------ documents ------------------------------ */
type DocItem = { key: string; r: Rec; f: DocRef }
function OpenButton({ f }: { f: DocRef }) {
  const [busy, setBusy] = useState(false)
  return (
    <Button size="sm" icon={ExternalLink} loading={busy} onClick={async (e) => {
      e.stopPropagation(); setBusy(true)
      try { await openDocument(f) } catch (err) { toast(err instanceof Error ? err.message : 'Could not open the document.', 'err') } finally { setBusy(false) }
    }}>Open</Button>
  )
}
export function DocumentsPage({ d, onOpen }: { d: Data; onOpen: (r: Rec) => void }) {
  const [q, setQ] = useState('')
  const rows = useMemo<DocItem[]>(() => [...d.offline, ...d.uploads].filter((r) => matchesRec(r, q)).flatMap((r) => docsOf(r).map((f) => ({ key: r.id + f.publicId, r, f }))), [d.offline, d.uploads, q])
  const columns: Column<DocItem>[] = [
    { key: 'file', header: 'File', sort: (a, b) => a.f.name.localeCompare(b.f.name), cell: ({ f }) => (
      <div className="flex items-center gap-3"><span className="grid size-8 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-500"><FileText size={15} /></span>
        <div className="min-w-0"><p className="max-w-[16rem] truncate font-medium text-zinc-900">{f.name}</p><p className="text-xs uppercase text-zinc-500">{f.format} · {kb(f.size)}</p></div></div>) },
    { key: 'customer', header: 'Customer', sort: (a, b) => nameOf(a.r).localeCompare(nameOf(b.r)), cell: ({ r }) => <span className="text-zinc-700">{nameOf(r)}</span> },
    { key: 'request', header: 'Request', hideBelow: 'lg', cell: ({ r }) => <span className="capitalize text-zinc-600">{titleOf(r)}</span> },
    { key: 'status', header: 'Status', hideBelow: 'xl', cell: ({ r }) => <StatusBadge status={statusOf(r)} /> },
    { key: 'received', header: 'Received', sort: (a, b) => secs(a.r.createdAt) - secs(b.r.createdAt), hideBelow: 'lg', cell: ({ r }) => <span className="whitespace-nowrap text-zinc-600">{ago(r.createdAt)}</span> },
    { key: 'open', header: '', align: 'right', cell: ({ f }) => <OpenButton f={f} /> },
  ]
  return (
    <>
      <PageHeader title="Documents" description="Every file customers uploaded. Files stay private and open through short-lived signed links." />
      <DataTable rows={rows} columns={columns} rowKey={(x) => x.key} loading={d.loading} error={d.error} onRowClick={(x) => onOpen(x.r)} noun="files"
        actions={() => [{ label: 'View request', icon: ArrowRight, onClick: (i: DocItem) => onOpen(i.r) }, { label: 'Copy file name', icon: Copy, onClick: (i: DocItem) => copy(i.f.name, 'File name') }]}
        search={{ value: q, onChange: setQ, placeholder: 'Search customer, vehicle or reference' }} initialSort={{ key: 'received', dir: 'desc' }}
        empty={{ icon: FileCheck2, title: 'No documents yet', hint: 'Uploaded RC copies, policies and ID proofs will be listed here.' }}
        card={({ r, f }) => (
          <div className="flex items-center gap-3"><span className="grid size-9 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-500"><FileText size={16} /></span>
            <div className="min-w-0 flex-1"><p className="truncate font-medium text-zinc-900">{f.name}</p><p className="truncate text-xs text-zinc-500">{nameOf(r)} · {kb(f.size)} · {ago(r.createdAt)}</p></div></div>)} />
    </>
  )
}

/* ------------------------------ audit log ------------------------------ */
export function AuditPage({ d }: { d: Data }) {
  const [q, setQ] = useState('')
  const rows = d.audit.filter((a) => !q.trim() || JSON.stringify([a.by, a.target, a.note, a.from, a.to]).toLowerCase().includes(q.trim().toLowerCase()))
  const columns: Column<Audit>[] = [
    { key: 'at', header: 'When', sort: (a, b) => secs(a.at) - secs(b.at), cell: (a) => <span title={when(a.at)} className="whitespace-nowrap text-zinc-600">{ago(a.at)}</span> },
    { key: 'by', header: 'Admin', sort: (a, b) => a.by.localeCompare(b.by), cell: (a) => <div className="flex items-center gap-2"><Avatar name={a.by} size={24} /><span className="text-zinc-800">{a.by.split('@')[0]}</span></div> },
    { key: 'target', header: 'Target', hideBelow: 'lg', cell: (a) => <span className={mono}>{a.target}</span> },
    { key: 'change', header: 'Change', cell: (a) => <span className="inline-flex items-center gap-1.5"><StatusBadge status={a.from} /><ArrowRight size={13} className="text-zinc-300" /><StatusBadge status={a.to} /></span> },
    { key: 'note', header: 'Note', hideBelow: 'xl', cell: (a) => <span className="line-clamp-1 max-w-xs text-zinc-500">{a.note || '—'}</span> },
  ]
  return (
    <>
      <PageHeader title="Audit log" description="A permanent record of every change administrators make to requests." />
      <DataTable rows={rows} columns={columns} rowKey={(a) => a.id} loading={d.loading} error={d.error} noun="entries" pageSize={12}
        search={{ value: q, onChange: setQ, placeholder: 'Search admin, reference or note' }} initialSort={{ key: 'at', dir: 'desc' }}
        empty={{ icon: History, title: 'No admin actions recorded yet', hint: 'Status changes and notes are logged here automatically.' }}
        card={(a) => (
          <div><div className="flex items-center justify-between gap-2"><p className="truncate text-sm font-medium text-zinc-900">{a.by.split('@')[0]}</p><span className="text-xs text-zinc-400">{ago(a.at)}</span></div>
            <p className="mt-1.5 flex items-center gap-1.5"><StatusBadge status={a.from} /><ArrowRight size={13} className="text-zinc-300" /><StatusBadge status={a.to} /></p>
            <p className="mt-1.5 truncate text-xs text-zinc-500"><span className="font-mono">{a.target}</span>{a.note ? ` · ${a.note}` : ''}</p></div>)} />
    </>
  )
}

