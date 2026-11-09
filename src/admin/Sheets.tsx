import { useState } from 'react'
import { Check, ExternalLink, FileText, Phone } from 'lucide-react'
import { Badge, Button, EmptyState, Field, Props, Sheet, StatusBadge, Avatar, cn, inputCls, toast } from '../ui'
import {
  STATUSES, docsOf, kb, mobileOf, nameOf, openDocument, refOf, saveRequest, secs, shortDate, statusOf, titleOf, when, type Customer, type DocRef, type Rec,
} from './data'

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="mb-6"><h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400">{title}</h3>{children}</section>
)
const label = (k: string) => k.replace(/([A-Z])/g, ' $1').replace(/^./, (c) => c.toUpperCase())
const entries = (o?: Record<string, unknown>): [string, unknown][] => Object.entries(o ?? {}).map(([k, v]) => [label(k), v])

export function DocRow({ d }: { d: DocRef }) {
  const [busy, setBusy] = useState(false)
  async function open() {
    setBusy(true)
    try { await openDocument(d) } catch (e) { toast(e instanceof Error ? e.message : 'Could not open the document.', 'err') } finally { setBusy(false) }
  }
  return (
    <li className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3">
      <span className="grid size-9 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-500"><FileText size={17} /></span>
      <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-zinc-900">{d.name}</span><span className="block text-xs uppercase text-zinc-500">{d.kind ? `${d.kind === 'rc' ? 'RC' : 'Policy'} · ` : ''}{d.format} · {kb(d.size)}</span></span>
      <Button size="sm" icon={ExternalLink} loading={busy} onClick={open}>Open</Button>
    </li>
  )
}

export function RequestSheet({ rec, admin, onClose }: { rec: Rec; admin: string; onClose: () => void }) {
  const [status, setStatus] = useState(statusOf(rec))
  const [note, setNote] = useState(rec.adminNote ?? '')
  const [saving, setSaving] = useState(false)
  const docs = docsOf(rec)
  const dirty = status !== statusOf(rec) || note.trim() !== (rec.adminNote ?? '').trim()
  const mobile = mobileOf(rec)

  async function save() {
    setSaving(true)
    try { await saveRequest(rec, { status, adminNote: note }, admin); toast('Request updated.') }
    catch { toast('Could not save. Are the Firestore rules deployed?', 'err') }
    finally { setSaving(false) }
  }

  return (
    <Sheet title={nameOf(rec)} subtitle={`${titleOf(rec)} · Ref ${refOf(rec)} · ${when(rec.createdAt)}`} onClose={onClose}
      footer={
        <div className="flex items-center justify-between gap-3">
          <span className="min-w-0 truncate text-xs text-zinc-500">{rec.updatedBy ? `Last updated by ${rec.updatedBy}` : 'Not updated yet'}</span>
          <Button variant="primary" icon={Check} loading={saving} disabled={!dirty} onClick={save}>Save changes</Button>
        </div>
      }>
      <div className="mb-6 flex flex-wrap items-center gap-2">
        <StatusBadge status={statusOf(rec)} />
        {rec.cashbackUpTo ? <Badge tone="green" dot={false}>Cashback up to ₹{rec.cashbackUpTo}</Badge> : null}
        {/^\d{10}$/.test(mobile) && <a href={`tel:+91${mobile}`} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-sm font-medium text-zinc-800 hover:bg-zinc-50 max-md:h-10"><Phone size={14} />Call {mobile}</a>}
      </div>

      <Section title="Process">
        <div role="radiogroup" aria-label="Status" className="mb-3 grid grid-cols-5 gap-1 rounded-lg bg-zinc-100 p-0.5 text-xs font-medium">
          {STATUSES.map((s) => (
            <button key={s} type="button" role="radio" aria-checked={status === s} onClick={() => setStatus(s)}
              className={cn('rounded-md px-1 py-1.5 capitalize transition-colors max-md:min-h-10', status === s ? 'bg-white text-zinc-900 shadow-sm' : 'text-zinc-500 hover:text-zinc-800')}>{s}</button>
          ))}
        </div>
        <Field label="Message to customer and team" hint="Customers see this note under their request.">
          <textarea rows={3} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Called customer, quote shared, etc." className={cn(inputCls, 'h-auto py-2')} />
        </Field>
      </Section>

      {rec.kind === 'offline' ? (
        <>
          <Section title="Owner"><Props rows={entries(rec.applicant)} /></Section>
          <Section title="Vehicle"><Props rows={entries(rec.vehicle)} /></Section>
          <Section title="Previous policy"><Props rows={entries(rec.policy)} /></Section>
          <Section title="Quote preferences"><Props rows={[
            ['Insurers', rec.plan?.insurers?.length ? rec.plan.insurers.join(', ') : 'Compare all'], ['Add-ons', rec.plan?.addons?.join(', ')],
            ['Preferred IDV', rec.plan?.preferredIdv], ['Ex-showroom price', (rec.plan as Record<string, unknown> | undefined)?.exShowroom as string | undefined], ['Accessories value', (rec.plan as Record<string, unknown> | undefined)?.accessoriesValue as string | undefined], ['AyushPay interest', rec.plan?.ayushPay ?? false],
          ]} /></Section>
        </>
      ) : (
        <Section title="Customer"><Props rows={[['Name', rec.name], ['Mobile', rec.mobile], ['Insurance type', rec.type]]} /></Section>
      )}

      <Section title={`Documents (${docs.length})`}>
        {docs.length === 0 ? <p className="text-sm text-zinc-500">No documents were uploaded.</p> : <ul className="space-y-2">{docs.map((d) => <DocRow key={d.publicId} d={d} />)}</ul>}
        {docs.length > 0 && <p className="mt-2 text-xs text-zinc-400">Links are private and expire after 10 minutes.</p>}
      </Section>
    </Sheet>
  )
}

export function CustomerSheet({ customer, requests, onClose, onOpen }: { customer: Customer; requests: Rec[]; onClose: () => void; onOpen: (r: Rec) => void }) {
  const theirs = [...requests].sort((a, b) => secs(b.createdAt) - secs(a.createdAt))
  return (
    <Sheet title={customer.name || 'Unnamed customer'} subtitle={`Joined ${shortDate(customer.createdAt)}`} onClose={onClose}>
      <div className="mb-6 flex items-center gap-3"><Avatar name={customer.name || customer.email} size={44} />
        <div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-900">{customer.name || 'Unnamed customer'}</p><p className="truncate text-xs text-zinc-500">{customer.email || 'No email on file'}</p></div>
        {customer.mobile && <a href={`tel:+91${customer.mobile}`} className="ml-auto inline-flex h-8 items-center gap-1.5 rounded-lg border border-zinc-200 px-3 text-sm font-medium hover:bg-zinc-50 max-md:h-10"><Phone size={14} />Call</a>}
      </div>
      <Section title="Profile"><Props rows={[['Mobile', customer.mobile], ['Email', customer.email], ['Address', customer.address], ['City', customer.city], ['Pincode', customer.pincode], ['Joined', when(customer.createdAt)]]} /></Section>
      <Section title={`Requests (${theirs.length})`}>
        {theirs.length === 0 ? <EmptyState title="No requests yet" hint="This customer hasn't submitted anything." /> : (
          <ul className="space-y-2">{theirs.map((r) => (
            <li key={r.kind + r.id}><button type="button" onClick={() => { onClose(); onOpen(r) }} className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-200 p-3 text-left hover:bg-zinc-50">
              <span className="min-w-0"><span className="block truncate text-sm font-medium capitalize text-zinc-900">{titleOf(r)}</span><span className="block text-xs text-zinc-500">{when(r.createdAt)}</span></span><StatusBadge status={statusOf(r)} /></button></li>
          ))}</ul>
        )}
      </Section>
    </Sheet>
  )
}
