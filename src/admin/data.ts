import { useEffect, useState } from 'react'
import { addDoc, collection, doc, limit, onSnapshot, orderBy, query, serverTimestamp, updateDoc, type Timestamp } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'

/** Same two administrators and the same rule as Askus Fin: Firebase password account + this allowlist.
 *  Firestore rules and the Pages Function repeat the check server-side. */
export const ADMIN_EMAILS = ['sanjaympatel8523@gmail.com', 'rajesh8523@gmail.com', 'rajeshchatgpt1@gmail.com']
export const isAdminEmail = (e: string | null | undefined) => Boolean(e && ADMIN_EMAILS.includes(e.trim().toLowerCase()))
export const STATUSES = ['new', 'contacted', 'quoted', 'issued', 'closed'] as const
export type Status = (typeof STATUSES)[number]

export type DocRef = { name: string; size: number; mimeType: string; publicId: string; format: string; kind?: 'rc' | 'policy' }
export type Rec = {
  id: string; kind: 'offline' | 'upload'
  uid?: string; createdAt?: Timestamp; status?: string; adminNote?: string; updatedBy?: string; updatedAt?: Timestamp
  vehicleType?: 'car' | 'bike'; cashbackUpTo?: number
  applicant?: Record<string, string>; vehicle?: Record<string, string | boolean>
  policy?: Record<string, string>; plan?: { insurers?: string[]; addons?: string[]; preferredIdv?: string; ayushPay?: boolean }
  documents?: DocRef[]
  name?: string; mobile?: string; type?: string; files?: DocRef[]
}
export type Customer = { id: string; name?: string; email?: string; mobile?: string; address?: string; city?: string; pincode?: string; createdAt?: Timestamp; updatedAt?: Timestamp }
export type Audit = { id: string; at?: Timestamp; by: string; action: string; target: string; from?: string; to?: string; note?: string }

/* ------------------------------ helpers ------------------------------ */
export const dateOf = (t?: Timestamp | null): Date | null => (t?.toDate ? t.toDate() : null)
export const secs = (t?: Timestamp | null) => t?.seconds ?? 0
export const when = (t?: Timestamp) => { const d = dateOf(t); return d ? d.toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—' }
export const shortDate = (t?: Timestamp) => { const d = dateOf(t); return d ? d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—' }
export function ago(t?: Timestamp): string {
  const d = dateOf(t)
  if (!d) return 'just now'
  const s = Math.max(0, (Date.now() - d.getTime()) / 1000)
  if (s < 60) return 'just now'
  if (s < 3600) return `${Math.floor(s / 60)}m ago`
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`
  if (s < 86400 * 7) return `${Math.floor(s / 86400)}d ago`
  return shortDate(t)
}
export const docsOf = (r: Rec) => (r.kind === 'offline' ? r.documents : r.files) ?? []
export const nameOf = (r: Rec) => r.applicant?.name ?? r.name ?? '—'
export const mobileOf = (r: Rec) => r.applicant?.mobile ?? r.mobile ?? '—'
export const refOf = (r: { id: string }) => r.id.slice(0, 8).toUpperCase()
export const titleOf = (r: Rec) => (r.kind === 'offline' ? `Offline ${r.vehicleType ?? ''} insurance`.replace('  ', ' ') : `Documents · ${r.type ?? 'upload'}`)
export const statusOf = (r: { status?: string }): Status => (STATUSES.includes(r.status as Status) ? (r.status as Status) : 'new')
export const matchesRec = (r: Rec, q: string) => !q.trim() || JSON.stringify([nameOf(r), mobileOf(r), r.vehicle?.regNumber, r.id, r.applicant?.city]).toLowerCase().includes(q.trim().toLowerCase())
export const kb = (n: number) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : `${Math.max(1, Math.round(n / 1024))} KB`)

export async function openDocument(d: DocRef) {
  const token = await auth.currentUser!.getIdToken()
  const res = await fetch('/api/documents/download', {
    method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ publicId: d.publicId }),
  })
  const body = await res.json().catch(() => ({} as { error?: string; url?: string }))
  if (!res.ok || !body.url) throw new Error(body.error || 'Could not open the document.')
  window.open(body.url, '_blank', 'noopener')
}

/** Updates a request and records it in the audit trail (same writes as before the redesign). */
export async function saveRequest(rec: Rec, patch: { status: string; adminNote: string }, admin: string) {
  const col = rec.kind === 'offline' ? 'offlineRequests' : 'documentRequests'
  const note = patch.adminNote.trim()
  await updateDoc(doc(db, col, rec.id), { status: patch.status, adminNote: note, updatedAt: serverTimestamp(), updatedBy: admin })
  await addDoc(collection(db, 'auditLogs'), {
    at: serverTimestamp(), by: admin, action: 'update_request', target: `${col}/${refOf(rec)}`,
    from: rec.status ?? 'new', to: patch.status, note: note.slice(0, 300),
  })
}

/* ------------------------------ live data ------------------------------ */
export type Data = ReturnType<typeof useAdminData>

export function useAdminData() {
  const [offline, setOffline] = useState<Rec[]>([])
  const [uploads, setUploads] = useState<Rec[]>([])
  const [customers, setCustomers] = useState<Customer[]>([])
  const [audit, setAudit] = useState<Audit[]>([])
  const [ready, setReady] = useState<Record<string, boolean>>({})
  const [error, setError] = useState('')
  useEffect(() => {
    const bad = () => setError('Could not load data. Check you are signed in as an admin and the Firestore rules are deployed.')
    const w = <T,>(name: string, order: string, n: number, set: (v: T[]) => void, extra: object = {}) =>
      onSnapshot(query(collection(db, name), orderBy(order, 'desc'), limit(n)),
        (s) => { set(s.docs.map((d) => ({ id: d.id, ...extra, ...(d.data() as object) }) as T)); setReady((p) => ({ ...p, [name]: true })) }, bad)
    const subs = [
      w<Rec>('offlineRequests', 'createdAt', 300, setOffline, { kind: 'offline' }),
      w<Rec>('documentRequests', 'createdAt', 300, setUploads, { kind: 'upload' }),
      w<Customer>('users', 'createdAt', 500, setCustomers),
      w<Audit>('auditLogs', 'at', 200, setAudit),
    ]
    return () => subs.forEach((u) => u())
  }, [])
  const loading = !error && Object.keys(ready).length < 4
  return { offline, uploads, customers, audit, error, loading }
}

/* ------------------------------ analytics (real data only) ------------------------------ */
export type Trend = { current: number; previous: number; pct: number | null }
/** Compares the last `days` days with the `days` before them. pct is null when there is no earlier data to compare. */
export function trendOf(stamps: (Date | null)[], days: number): Trend {
  const now = Date.now(), span = days * 86400000
  let current = 0, previous = 0
  for (const d of stamps) {
    if (!d) continue
    const age = now - d.getTime()
    if (age < span) current++
    else if (age < span * 2) previous++
  }
  return { current, previous, pct: previous > 0 ? Math.round(((current - previous) / previous) * 100) : null }
}

/** Counts per calendar day for the last `days` days (oldest first). */
export function perDay(series: { stamps: (Date | null)[] }[], days: number) {
  const out = Array.from({ length: days }, (_, i) => {
    const d = new Date(); d.setHours(0, 0, 0, 0); d.setDate(d.getDate() - (days - 1 - i))
    return { date: d, counts: series.map(() => 0) }
  })
  const start = out[0].date.getTime()
  series.forEach((s, si) => s.stamps.forEach((d) => {
    if (!d) return
    const idx = Math.floor((new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime() - start) / 86400000)
    if (idx >= 0 && idx < days) out[idx].counts[si]++
  }))
  return out
}

export function toCsv(rows: Rec[]) {
  const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`
  const head = ['Reference', 'Received', 'Type', 'Status', 'Customer', 'Mobile', 'City', 'Registration', 'Vehicle', 'Policy type', 'Insurers', 'Documents']
  const lines = rows.map((r) => [
    refOf(r), dateOf(r.createdAt)?.toISOString() ?? '', titleOf(r), statusOf(r), nameOf(r), mobileOf(r), r.applicant?.city ?? '',
    r.vehicle?.regNumber ?? '', [r.vehicle?.makeModel, r.vehicle?.variant].filter(Boolean).join(' '), r.policy?.policyType ?? '',
    r.plan?.insurers?.join('; ') ?? '', docsOf(r).length,
  ].map(q).join(','))
  return [head.map(q).join(','), ...lines].join('\n')
}
