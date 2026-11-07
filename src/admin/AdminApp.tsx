import { useCallback, useEffect, useMemo, useState } from 'react'
import { onAuthStateChanged, signOut, type User } from 'firebase/auth'
import { auth } from '../lib/firebase'
import { Login, Splash, VerifyEmail } from './AuthScreens'
import DashboardPage from './DashboardPage'
import { AuditPage, CustomersPage, DocumentsPage, RequestsPage } from './Pages'
import SettingsPage from './SettingsPage'
import { Frame, Header, MobileDrawer, NAV, Sidebar } from './Shell'
import { RequestSheet } from './Sheets'
import { ToastHost } from '../ui'
import { isAdminEmail, statusOf, useAdminData, type Customer, type Data, type Rec } from './data'

const readRoute = () => ({ path: location.pathname.replace(/\/+$/, '') || '/admin', search: location.search })
const savedCollapsed = () => { try { return localStorage.getItem('admin.sidebar') === 'collapsed' } catch { return false } }

function Console({ user }: { user: User }) {
  return <ConsoleView user={user} d={useAdminData()} />
}

/** Presentational shell. Takes the live data as a prop so layouts can be previewed without Firebase. */
export function ConsoleView({ user, d }: { user: Pick<User, 'email' | 'emailVerified' | 'metadata'>; d: Data }) {
  const email = user.email ?? ''
  const [route, setRoute] = useState(readRoute)
  const [collapsed, setCollapsed] = useState(savedCollapsed)
  const [menu, setMenu] = useState(false)
  const [openRec, setOpenRec] = useState<Rec | null>(null)
  const [custId, setCustId] = useState<string | null>(null)

  useEffect(() => { const f = () => setRoute(readRoute()); addEventListener('popstate', f); return () => removeEventListener('popstate', f) }, [])
  const go = useCallback((to: string) => {
    history.pushState({}, '', to)
    setRoute(readRoute())
    setMenu(false)
    window.scrollTo({ top: 0 })
  }, [])

  const page = NAV.find((n) => n.path === route.path) ?? NAV[0]
  useEffect(() => { document.title = `${page.label} · Askus Insurance Admin` }, [page])

  // keep the open drawers live: they re-read from the snapshot so status changes show instantly
  const current = useMemo(() => (openRec ? [...d.offline, ...d.uploads].find((r) => r.kind === openRec.kind && r.id === openRec.id) ?? openRec : null), [openRec, d.offline, d.uploads])
  const customer: Customer | null = custId ? d.customers.find((c) => c.id === custId) ?? null : null
  const newCount = useMemo(() => [...d.offline, ...d.uploads].filter((r) => statusOf(r) === 'new').length, [d.offline, d.uploads])
  const initialStatus = new URLSearchParams(route.search).get('status') ?? 'all'
  const closeRec = useCallback(() => setOpenRec(null), [])

  const body = {
    '/admin': <DashboardPage d={d} email={email} go={go} onOpen={setOpenRec} />,
    '/admin/requests': <RequestsPage key={route.search} d={d} admin={email} onOpen={setOpenRec} initialStatus={initialStatus} />,
    '/admin/customers': <CustomersPage d={d} selected={customer} onSelect={(c) => setCustId(c?.id ?? null)} onOpen={setOpenRec} />,
    '/admin/documents': <DocumentsPage d={d} onOpen={setOpenRec} />,
    '/admin/audit-logs': <AuditPage d={d} />,
    '/admin/settings': <SettingsPage user={user as User} d={d} onSignOut={() => signOut(auth)} />,
  }[page.path]

  return (
    <div className="app-root flex min-h-dvh bg-zinc-50 text-zinc-900">
      <Sidebar path={page.path} go={go} collapsed={collapsed} setCollapsed={setCollapsed} newCount={newCount} />
      <MobileDrawer open={menu} onClose={() => setMenu(false)} path={page.path} go={go} newCount={newCount} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Header page={page} email={email} data={d} go={go} onMenu={() => setMenu(true)} onRecord={setOpenRec}
          onCustomer={(c) => { setCustId(c.id); go('/admin/customers') }} onSignOut={() => signOut(auth)} />
        <main className="flex-1">
          <Frame>
            {d.error && <p role="alert" className="mb-5 rounded-xl border border-rose-200 bg-rose-50 p-3.5 text-sm text-rose-800">{d.error}</p>}
            <div key={page.path} className="admin-slide-up">{body}</div>
          </Frame>
        </main>
      </div>
      {current && <RequestSheet key={current.kind + current.id} rec={current} admin={email} onClose={closeRec} />}
      <ToastHost />
    </div>
  )
}

export default function AdminApp() {
  const [user, setUser] = useState<User | null | undefined>(undefined)
  const [notice, setNotice] = useState('')
  useEffect(() => onAuthStateChanged(auth, async (u) => {
    if (u && (!isAdminEmail(u.email) || !u.providerData.some((p) => p.providerId === 'password'))) {
      setNotice('That account is not an administrator account.')
      await signOut(auth)
      return
    }
    setUser(u)
  }), [])
  if (user === undefined) return <Splash />
  if (!user) return <Login notice={notice} />
  if (!user.emailVerified) return <VerifyEmail user={user} />
  return <Console user={user} />
}
