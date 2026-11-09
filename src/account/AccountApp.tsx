import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from 'react'
import { signOut } from 'firebase/auth'
import { collection, doc, getDoc, onSnapshot, query, serverTimestamp, setDoc, where } from 'firebase/firestore'
import {
  ArrowRight, ChevronDown, ClipboardList, ExternalLink, FileText, IdCard, LayoutDashboard, Lock, LogOut, Phone, Plus, ShieldCheck, TriangleAlert,
} from 'lucide-react'
import { auth, db } from '../lib/firebase'
import { useAuth } from '../context/AuthContext'
import AuthModal from '../components/AuthModal'
import { validEmail, validName } from '../lib/validate'
import {
  Avatar, Badge, Button, Card, CardHeader, EmptyState, Field, MenuItem, PageHeader, Popover, Props, Skeleton, StatusBadge, ToastHost, cn, inputCls, toast,
} from '../ui'
import { ago, kb, secs, statusOf, when, type Rec } from '../admin/data'

type Req = Rec & { documents?: Rec['documents']; files?: Rec['files'] }
type Profile = { name: string; email: string; address: string; city: string; pincode: string }
const EMPTY: Profile = { name: '', email: '', address: '', city: '', pincode: '' }
const docsOf = (r: Req) => (r.kind === 'offline' ? r.documents : r.files) ?? []
const titleOf = (r: Req) => (r.kind === 'offline' ? `Offline ${r.vehicleType ?? ''} insurance` : `Documents · ${r.type ?? 'upload'}`)
const refOf = (r: Req) => r.id.slice(0, 8).toUpperCase()

const STEP: Record<string, string> = {
  new: 'Received. Our team will call you within 24 hours.',
  contacted: 'We have contacted you. Quotes are being prepared.',
  quoted: 'Quotes have been shared with you.',
  issued: 'Policy issued. Your cashback is on its way.',
  closed: 'This request is closed.',
}
const FLOW = ['new', 'contacted', 'quoted', 'issued'] as const
const FLOW_LABEL = { new: 'Received', contacted: 'Contacted', quoted: 'Quotes shared', issued: 'Issued' }

type TabId = 'overview' | 'requests' | 'documents' | 'profile'
const TABS: { id: TabId; label: string; icon: typeof LayoutDashboard }[] = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'requests', label: 'Requests', icon: ClipboardList },
  { id: 'documents', label: 'Documents', icon: FileText },
  { id: 'profile', label: 'Profile', icon: IdCard },
]

/* ------------------------------ pieces ------------------------------ */
function Stepper({ status }: { status: string }) {
  if (status === 'closed') return <div className="mt-4"><Badge>Closed</Badge></div>
  const at = Math.max(0, FLOW.indexOf(status as (typeof FLOW)[number]))
  return (
    <ol className="mt-4 grid grid-cols-4 gap-1.5" aria-label="Progress">
      {FLOW.map((k, i) => (
        <li key={k}>
          <div className={cn('h-1.5 rounded-full', i <= at ? 'bg-indigo-600' : 'bg-zinc-200')} />
          <span className={cn('mt-1.5 block truncate text-[11px] font-medium', i <= at ? 'text-indigo-700' : 'text-zinc-400')}>{FLOW_LABEL[k]}</span>
        </li>
      ))}
    </ol>
  )
}

function OpenDoc({ id, name }: { id: string; name: string }) {
  const [busy, setBusy] = useState(false)
  async function open() {
    setBusy(true)
    try {
      const token = await auth.currentUser!.getIdToken()
      const res = await fetch('/api/documents/download', { method: 'POST', headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' }, body: JSON.stringify({ publicId: id }) })
      const body = await res.json().catch(() => ({} as { url?: string; error?: string }))
      if (!res.ok || !body.url) throw new Error(body.error || 'Could not open the document.')
      window.open(body.url, '_blank', 'noopener')
    } catch (e) { toast(e instanceof Error ? e.message : 'Could not open the document.', 'err') } finally { setBusy(false) }
  }
  return <Button size="sm" icon={ExternalLink} loading={busy} onClick={open} aria-label={`Open ${name}`}>Open</Button>
}

const FileRow = ({ d }: { d: NonNullable<Req['documents']>[number] }) => (
  <li className="flex items-center gap-3 rounded-lg border border-zinc-200 p-3">
    <span className="grid size-9 shrink-0 place-items-center rounded-md bg-zinc-100 text-zinc-500"><FileText size={17} /></span>
    <span className="min-w-0 flex-1"><span className="block truncate text-sm font-medium text-zinc-900">{d.name}</span>{d.size ? <span className="block text-xs text-zinc-500">{d.kind ? `${d.kind === 'rc' ? 'RC' : 'Policy'} · ` : ''}{kb(d.size)}</span> : null}</span>
    <OpenDoc id={d.publicId} name={d.name} />
  </li>
)

/* ------------------------------ overview ------------------------------ */
function Overview({ rows, loading, go, profileGaps, name }: { rows: Req[]; loading: boolean; go: (t: TabId) => void; profileGaps: boolean; name: string }) {
  const active = rows.filter((r) => !['issued', 'closed'].includes(statusOf(r))).length
  const issued = rows.filter((r) => statusOf(r) === 'issued').length
  const docs = rows.reduce((n, r) => n + docsOf(r).length, 0)
  const latest = rows[0]
  const tiles: [number, string, TabId][] = [[rows.length, 'Requests', 'requests'], [active, 'In progress', 'requests'], [issued, 'Policies issued', 'requests'], [docs, 'Documents', 'documents']]
  return (
    <div className="space-y-5">
      <PageHeader title={`Hello${name ? `, ${name.split(' ')[0]}` : ''}`} description="Track your insurance requests and keep your documents in one place."
        actions={<Button variant="primary" icon={Plus} onClick={() => { location.href = '/' }}>New request</Button>} />
      {profileGaps && (
        <button type="button" onClick={() => go('profile')} className="flex w-full items-center gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-left text-sm text-amber-900">
          <TriangleAlert size={18} className="shrink-0" /><span className="flex-1"><b className="font-medium">Complete your profile.</b> Add your address so our team can prepare your quotes faster.</span><ArrowRight size={16} />
        </button>
      )}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {tiles.map(([n, label, to]) => (
          <button key={label} type="button" onClick={() => go(to)} className="rounded-xl border border-zinc-200 bg-white p-4 text-left shadow-[0_1px_2px_rgba(16,24,40,.04)] transition-colors hover:border-zinc-300">
            <span className="block text-xs font-medium text-zinc-500">{label}</span>
            {loading ? <Skeleton className="mt-2 h-8 w-10" /> : <span className="mt-1.5 block text-[28px] font-semibold leading-none tracking-tight text-zinc-900 tabular">{n}</span>}
          </button>
        ))}
      </div>
      <Card>
        <CardHeader title="Latest request" action={latest ? <Button size="sm" variant="ghost" onClick={() => go('requests')}>View all</Button> : undefined} />
        <div className="px-5 pb-5 pt-3">
          {loading ? <Skeleton className="h-20 w-full" /> : latest ? (
            <>
              <div className="flex items-start justify-between gap-3"><div className="min-w-0"><p className="truncate text-sm font-medium capitalize text-zinc-900">{titleOf(latest)}</p>
                <p className="text-xs text-zinc-500">Ref {refOf(latest)} · {when(latest.createdAt)}</p></div><StatusBadge status={statusOf(latest)} /></div>
              {latest.kind === 'offline' && <Stepper status={statusOf(latest)} />}
              <p className="mt-3 text-sm text-zinc-600">{STEP[statusOf(latest)]}</p>
            </>
          ) : <EmptyState icon={ClipboardList} title="No requests yet" hint="Choose Car or Bike insurance on the home page and pick Offline to start one." action={<Button variant="primary" onClick={() => { location.href = '/' }}>Get a quote</Button>} />}
        </div>
      </Card>
    </div>
  )
}

/* ------------------------------ requests ------------------------------ */
function Requests({ rows, loading }: { rows: Req[]; loading: boolean }) {
  const [filter, setFilter] = useState<'all' | 'active' | 'done'>('all')
  const [open, setOpen] = useState<string | null>(null)
  const list = rows.filter((r) => filter === 'all' || (filter === 'active' ? !['issued', 'closed'].includes(statusOf(r)) : ['issued', 'closed'].includes(statusOf(r))))
  return (
    <>
      <PageHeader title="My requests" description="Every request you have made, with the latest update from our team." />
      <div role="group" aria-label="Filter" className="mb-4 flex flex-wrap gap-1.5">
        {([['all', 'All'], ['active', 'In progress'], ['done', 'Completed']] as const).map(([k, l]) => (
          <button key={k} type="button" aria-pressed={filter === k} onClick={() => setFilter(k)}
            className={cn('h-8 rounded-full border px-3 text-xs font-medium transition-colors max-md:h-10', filter === k ? 'border-zinc-900 bg-zinc-900 text-white' : 'border-zinc-200 bg-white text-zinc-600 hover:bg-zinc-50')}>{l}</button>
        ))}
      </div>
      {loading && <Skeleton className="h-32 w-full" />}
      {!loading && list.length === 0 && <Card><EmptyState icon={ClipboardList} title={rows.length ? 'Nothing in this view' : 'No requests yet'} hint={rows.length ? 'Try another filter.' : 'Choose Car or Bike insurance on the home page and pick Offline to start one.'} /></Card>}
      <ul className="space-y-3">
        {!loading && list.map((r) => {
          const key = r.kind + r.id, isOpen = open === key, docs = docsOf(r), s = statusOf(r)
          return (
            <li key={key}>
              <Card className="p-5">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0"><p className="truncate text-sm font-semibold capitalize text-zinc-900">{titleOf(r)}</p>
                    <p className="mt-0.5 text-xs text-zinc-500">Ref {refOf(r)} · {when(r.createdAt)}{r.vehicle?.regNumber ? ` · ${r.vehicle.regNumber}` : ''}</p></div>
                  <StatusBadge status={s} />
                </div>
                {r.kind === 'offline' && <Stepper status={s} />}
                <p className="mt-3 text-sm text-zinc-600">{STEP[s]}</p>
                {r.adminNote && <div className="mt-3 rounded-lg border border-indigo-100 bg-indigo-50/60 p-3 text-sm text-zinc-700"><b className="font-medium text-indigo-900">Message from our team</b><p className="mt-0.5">{r.adminNote}</p></div>}
                {r.cashbackUpTo ? <p className="mt-3 text-xs text-emerald-700">Eligible for up to ₹{r.cashbackUpTo} cashback once your policy is confirmed.</p> : null}
                <button type="button" onClick={() => setOpen(isOpen ? null : key)} aria-expanded={isOpen} className="mt-3 inline-flex h-8 items-center gap-1 text-sm font-medium text-indigo-600 hover:underline max-md:h-10">
                  {isOpen ? 'Hide details' : `View details${docs.length ? ` · ${docs.length} file${docs.length > 1 ? 's' : ''}` : ''}`}<ChevronDown size={15} className={cn('transition-transform', isOpen && 'rotate-180')} /></button>
                {isOpen && (
                  <div className="admin-slide-up mt-3 space-y-5 border-t border-zinc-100 pt-4">
                    {r.kind === 'offline' ? (
                      <>
                        <Block title="Vehicle"><Props rows={[['Registration', r.vehicle?.isNew ? 'New vehicle' : r.vehicle?.regNumber], ['Make & model', r.vehicle?.makeModel], ['Variant', r.vehicle?.variant], ['Fuel', r.vehicle?.fuel], ['Registered', r.vehicle?.registrationDate]]} /></Block>
                        <Block title="Policy you asked for"><Props rows={[['Type', r.policy?.policyType], ['Previous insurer', r.policy?.prevInsurer], ['Previous expiry', r.policy?.prevExpiry], ['NCB', r.policy?.ncb],
                          ['Insurers', r.plan?.insurers?.length ? r.plan.insurers.join(', ') : 'Compare all'], ['Add-ons', r.plan?.addons?.join(', ')]]} /></Block>
                        <Block title="Contact"><Props rows={[['Name', r.applicant?.name], ['Mobile', r.applicant?.mobile], ['City', r.applicant?.city]]} /></Block>
                      </>
                    ) : <Block title="Details"><Props rows={[['Name', r.name], ['Mobile', r.mobile], ['Insurance type', r.type]]} /></Block>}
                    <Block title={`Documents (${docs.length})`}>
                      {docs.length === 0 ? <p className="text-sm text-zinc-500">No documents uploaded.</p> : <ul className="space-y-2">{docs.map((d) => <FileRow key={d.publicId} d={d} />)}</ul>}
                    </Block>
                  </div>
                )}
              </Card>
            </li>
          )
        })}
      </ul>
    </>
  )
}
const Block = ({ title, children }: { title: string; children: ReactNode }) => (
  <section><h3 className="mb-1 text-xs font-medium uppercase tracking-wider text-zinc-400">{title}</h3>{children}</section>
)

/* ------------------------------ documents ------------------------------ */
function Documents({ rows, loading }: { rows: Req[]; loading: boolean }) {
  const groups = rows.filter((r) => docsOf(r).length)
  return (
    <>
      <PageHeader title="My documents" description="Everything you have uploaded. Files are private and links expire after 10 minutes." />
      {loading && <Skeleton className="h-32 w-full" />}
      {!loading && groups.length === 0 && <Card><EmptyState icon={FileText} title="No documents yet" hint="RC copies, previous policies and ID proofs you upload will appear here." /></Card>}
      <div className="space-y-4">
        {!loading && groups.map((r) => (
          <Card key={r.kind + r.id}>
            <CardHeader title={titleOf(r)} hint={`Ref ${refOf(r)} · ${ago(r.createdAt)}`} action={<StatusBadge status={statusOf(r)} />} />
            <ul className="space-y-2 px-5 pb-5 pt-3">{docsOf(r).map((d) => <FileRow key={d.publicId} d={d} />)}</ul>
          </Card>
        ))}
      </div>
      {!loading && groups.length > 0 && <p className="mt-3 flex items-center gap-2 text-xs text-zinc-400"><ShieldCheck size={14} />Only you and the Askus team can open these files.</p>}
    </>
  )
}

/* ------------------------------ profile ------------------------------ */
function ProfileForm({ uid, onLoaded }: { uid: string; onLoaded: (p: Profile) => void }) {
  const { user } = useAuth()
  const [p, setP] = useState<Profile>(EMPTY)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  useEffect(() => {
    getDoc(doc(db, 'users', uid)).then((s) => {
      const d = (s.data() ?? {}) as Partial<Profile>
      const next = { ...EMPTY, ...d, name: d.name || user?.displayName || '', email: d.email || user?.email || '' }
      setP(next); onLoaded(next)
    }).catch(() => setError('Could not load your profile.')).finally(() => setLoading(false))
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps
  const set = (k: keyof Profile, v: string) => setP((x) => ({ ...x, [k]: v }))

  async function save(e: FormEvent) {
    e.preventDefault()
    const bad = validName(p.name) ?? (p.email.trim() ? validEmail(p.email) : null) ?? (p.pincode && !/^\d{6}$/.test(p.pincode.trim()) ? 'Enter a valid 6-digit pincode.' : null)
    if (bad) return setError(bad)
    setBusy(true); setError('')
    try {
      await setDoc(doc(db, 'users', uid), { name: p.name.trim(), email: p.email.trim().toLowerCase(), address: p.address.trim(), city: p.city.trim(), pincode: p.pincode.trim(), updatedAt: serverTimestamp() }, { merge: true })
      onLoaded(p); toast('Profile updated.')
    } catch { setError('Could not save. Please try again.') } finally { setBusy(false) }
  }
  const mobile = (user?.phoneNumber ?? '').replace('+91', '')
  return (
    <>
      <PageHeader title="Profile" description="Your details are used to prepare quotes and contact you about your requests." />
      <Card>
        <form onSubmit={save} className="space-y-5 p-5" noValidate>
          <div>
            <span className="mb-1.5 block text-xs font-medium text-zinc-700">Mobile number</span>
            <div className="flex h-9 items-center gap-2.5 rounded-lg border border-zinc-200 bg-zinc-50 px-3 text-sm max-md:h-11"><Phone size={15} className="text-zinc-400" /><span className="flex-1 font-medium text-zinc-800">+91 {mobile || '—'}</span>
              <Lock size={14} className="text-zinc-400" aria-label="Cannot be edited" /><Badge tone="green">Verified</Badge></div>
          </div>
          {loading ? <Skeleton className="h-40 w-full" /> : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="Full name"><input className={inputCls} value={p.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" /></Field>
                <Field label="Email (optional)"><input type="email" className={inputCls} value={p.email} onChange={(e) => set('email', e.target.value)} autoComplete="email" /></Field>
              </div>
              <Field label="Address"><input className={inputCls} value={p.address} onChange={(e) => set('address', e.target.value)} autoComplete="street-address" /></Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="City"><input className={inputCls} value={p.city} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" /></Field>
                <Field label="Pincode"><input className={inputCls} inputMode="numeric" maxLength={6} value={p.pincode} onChange={(e) => set('pincode', e.target.value)} autoComplete="postal-code" /></Field>
              </div>
            </>
          )}
          {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p>}
          <Button type="submit" variant="primary" loading={busy} disabled={loading}>Save changes</Button>
        </form>
      </Card>
    </>
  )
}

/* ------------------------------ shell ------------------------------ */
const Brand = () => (
  <a href="/" className="flex items-center gap-2.5" aria-label="Askus Insurance home">
    <span className="grid size-8 place-items-center rounded-lg bg-indigo-600 text-white"><ShieldCheck size={17} /></span>
    <span className="leading-tight"><span className="block text-sm font-semibold text-zinc-900">Askus Insurance</span><span className="block text-[11px] text-zinc-500">My account</span></span>
  </a>
)

function Frame({ user, children }: { user?: { name: string; mobile: string } | null; children: ReactNode }) {
  return (
    <div className="app-root min-h-dvh bg-zinc-50 text-zinc-900">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between gap-3 border-b border-zinc-200 bg-white/85 px-4 backdrop-blur sm:px-6">
        <Brand />
        <div className="flex items-center gap-2">
          <a href="/" className="hidden h-9 items-center rounded-lg px-3 text-sm font-medium text-zinc-600 hover:bg-zinc-100 sm:inline-flex">Back to site</a>
          {user && (
            <Popover label="Account menu" button={<Avatar name={user.name || user.mobile} size={30} />} buttonClass="rounded-lg p-1 hover:bg-zinc-100 max-md:p-1.5" panelClass="sm:w-60">
              {() => (
                <div>
                  <div className="flex items-center gap-3 border-b border-zinc-100 px-4 py-3"><Avatar name={user.name || user.mobile} size={36} />
                    <div className="min-w-0"><p className="truncate text-sm font-semibold text-zinc-900">{user.name || 'Customer'}</p><p className="truncate text-xs text-zinc-500">+91 {user.mobile}</p></div></div>
                  <div className="p-1.5"><MenuItem icon={ExternalLink} href="/">Back to site</MenuItem><MenuItem icon={LogOut} danger onClick={() => signOut(auth).then(() => (location.href = '/'))}>Sign out</MenuItem></div>
                </div>
              )}
            </Popover>
          )}
        </div>
      </header>
      {children}
      <ToastHost />
    </div>
  )
}

export default function AccountApp() {
  const { user, loading } = useAuth()
  const [tab, setTab] = useState<TabId>(() => (TABS.find((t) => t.id === location.hash.slice(1))?.id ?? 'overview'))
  const [signIn, setSignIn] = useState(false)
  const [offline, setOffline] = useState<Req[]>([])
  const [uploads, setUploads] = useState<Req[]>([])
  const [ready, setReady] = useState({ offline: false, uploads: false })
  const [profile, setProfile] = useState<Profile | null>(null)
  const uid = user?.uid

  useEffect(() => {
    if (!uid) return
    // Single-field filters need no composite index; sort in the browser.
    const watch = (name: string, kind: Req['kind'], key: 'offline' | 'uploads', set: (r: Req[]) => void) =>
      onSnapshot(query(collection(db, name), where('uid', '==', uid)),
        (s) => { set(s.docs.map((d) => ({ id: d.id, kind, ...(d.data() as object) }) as Req)); setReady((p) => ({ ...p, [key]: true })) },
        () => setReady((p) => ({ ...p, [key]: true })))
    const a = watch('offlineRequests', 'offline', 'offline', setOffline)
    const b = watch('documentRequests', 'upload', 'uploads', setUploads)
    return () => { a(); b() }
  }, [uid])
  useEffect(() => { history.replaceState(null, '', tab === 'overview' ? location.pathname : `#${tab}`) }, [tab])

  const all = useMemo(() => [...offline, ...uploads].sort((a, b) => secs(b.createdAt) - secs(a.createdAt)), [offline, uploads])
  const dataLoading = !(ready.offline && ready.uploads)

  if (loading) return <Frame><div className="mx-auto max-w-md space-y-3 p-6"><Skeleton className="h-6 w-40" /><Skeleton className="h-24 w-full" /></div></Frame>
  if (!user) {
    return (
      <Frame>
        <main className="mx-auto grid max-w-md place-items-center px-4 py-20 text-center">
          <span className="grid size-12 place-items-center rounded-full bg-indigo-50 text-indigo-600"><IdCard size={22} /></span>
          <h1 className="mt-5 text-xl font-semibold tracking-tight">Your account</h1>
          <p className="mt-2 text-sm text-zinc-500">Sign in with your mobile number to see your requests, documents and profile.</p>
          <Button variant="primary" className="mt-6 w-full max-w-xs" onClick={() => setSignIn(true)}>Sign in</Button>
          {signIn && <AuthModal onClose={() => setSignIn(false)} />}
        </main>
      </Frame>
    )
  }

  const name = profile?.name || user.displayName || ''
  const mobile = (user.phoneNumber ?? '').replace('+91', '')
  const gaps = profile !== null && (!profile.address.trim() || !profile.city.trim() || !/^\d{6}$/.test(profile.pincode.trim()))
  const counts: Partial<Record<TabId, number>> = { requests: all.length, documents: all.reduce((n, r) => n + docsOf(r).length, 0) }

  return (
    <Frame user={{ name, mobile }}>
      <div className="mx-auto grid max-w-[1100px] grid-cols-[minmax(0,1fr)] gap-6 px-4 py-6 pb-28 sm:px-6 md:grid-cols-[210px_minmax(0,1fr)] md:pb-10">
        {/* desktop side navigation */}
        <div role="navigation" aria-label="Account" className="hidden md:block">
          <ul className="sticky top-20 space-y-0.5">
            {TABS.map((t) => (
              <li key={t.id}>
                <button type="button" onClick={() => setTab(t.id)} aria-current={tab === t.id ? 'page' : undefined}
                  className={cn('flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-sm transition-colors', tab === t.id ? 'bg-white font-medium text-zinc-900 shadow-[0_1px_2px_rgba(16,24,40,.06)] ring-1 ring-zinc-200' : 'text-zinc-600 hover:bg-zinc-100')}>
                  <t.icon size={17} className={tab === t.id ? 'text-indigo-600' : 'text-zinc-400'} />{t.label}
                  {counts[t.id] ? <span className="ml-auto rounded-full bg-zinc-100 px-1.5 text-[11px] font-medium leading-5 text-zinc-600 tabular">{counts[t.id]}</span> : null}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <main key={tab} className="admin-slide-up min-w-0">
          {tab === 'overview' && <Overview rows={all} loading={dataLoading} go={setTab} profileGaps={gaps} name={name} />}
          {tab === 'requests' && <Requests rows={all} loading={dataLoading} />}
          {tab === 'documents' && <Documents rows={all} loading={dataLoading} />}
          {tab === 'profile' && <ProfileForm uid={user.uid} onLoaded={setProfile} />}
        </main>
      </div>
      {/* the profile form also loads name/address for the banner; mount it silently when another tab is open */}
      {tab !== 'profile' && profile === null && <ProfileLoader uid={user.uid} onLoaded={setProfile} />}

      {/* phone bottom navigation */}
      <div role="navigation" aria-label="Account" className="fixed inset-x-0 bottom-0 z-30 border-t border-zinc-200 bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur md:hidden">
        <ul className="grid grid-cols-4">
          {TABS.map((t) => (
            <li key={t.id}>
              <button type="button" onClick={() => { setTab(t.id); window.scrollTo({ top: 0 }) }} aria-current={tab === t.id ? 'page' : undefined}
                className={cn('flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium', tab === t.id ? 'text-indigo-600' : 'text-zinc-500')}>
                <t.icon size={20} />{t.label}</button>
            </li>
          ))}
        </ul>
      </div>
    </Frame>
  )
}

function ProfileLoader({ uid, onLoaded }: { uid: string; onLoaded: (p: Profile) => void }) {
  const { user } = useAuth()
  useEffect(() => {
    getDoc(doc(db, 'users', uid)).then((s) => {
      const d = (s.data() ?? {}) as Partial<Profile>
      onLoaded({ ...EMPTY, ...d, name: d.name || user?.displayName || '', email: d.email || user?.email || '' })
    }).catch(() => onLoaded({ ...EMPTY, name: user?.displayName || '', email: user?.email || '', address: 'unknown', city: 'unknown', pincode: '000000' }))
  }, [uid]) // eslint-disable-line react-hooks/exhaustive-deps
  return null
}
