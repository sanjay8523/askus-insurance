import { useState, type ReactNode } from 'react'
import { sendPasswordResetEmail, type User } from 'firebase/auth'
import { BadgeCheck, KeyRound, LogOut, MonitorSmartphone } from 'lucide-react'
import { auth } from '../lib/firebase'
import { Avatar, Badge, Button, Card, CardHeader, PageHeader, Props, toast } from '../ui'
import { ADMIN_EMAILS, type Data } from './data'

const Block = ({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) => (
  <Card><CardHeader title={title} hint={hint} /><div className="px-5 pb-4 pt-3">{children}</div></Card>
)

export default function SettingsPage({ user, d, onSignOut }: { user: User; d: Data; onSignOut: () => void }) {
  const [busy, setBusy] = useState(false)
  const email = user.email ?? ''
  const lastIn = user.metadata.lastSignInTime ? new Date(user.metadata.lastSignInTime).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : ''
  const created = user.metadata.creationTime ? new Date(user.metadata.creationTime).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : ''

  async function reset() {
    setBusy(true)
    try { await sendPasswordResetEmail(auth, email); toast(`Password reset email sent to ${email}.`) }
    catch { toast('Could not send the reset email. Try again in a minute.', 'err') }
    finally { setBusy(false) }
  }
  const clearLocal = () => { try { localStorage.removeItem('admin.sidebar'); localStorage.removeItem('admin.notifSeen') } catch { /* ignore */ } toast('Layout and notification preferences reset.') }

  return (
    <>
      <PageHeader title="Settings" description="Your administrator account, who else has access, and how this console is connected." />
      <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-2">
        <Block title="Your account">
          <div className="mb-3 flex items-center gap-3"><Avatar name={email} size={44} /><div className="min-w-0"><p className="truncate text-sm font-medium text-zinc-900">{email}</p><Badge tone="blue" dot={false}>Administrator</Badge></div></div>
          <Props rows={[['Email verified', user.emailVerified], ['Sign-in method', 'Email and password'], ['Account created', created], ['Last sign-in', lastIn]]} />
          <div className="mt-4 flex flex-wrap gap-2"><Button icon={KeyRound} loading={busy} onClick={reset}>Send password reset email</Button><Button icon={LogOut} onClick={onSignOut}>Sign out</Button></div>
        </Block>

        <Block title="Administrators" hint="Only these emails can open the console. The allowlist is also enforced by Firestore rules and the API.">
          <ul className="divide-y divide-zinc-100">
            {ADMIN_EMAILS.map((a) => (
              <li key={a} className="flex items-center gap-3 py-2.5"><Avatar name={a} size={28} /><span className="min-w-0 flex-1 truncate text-sm text-zinc-800">{a}</span>
                {a === email.toLowerCase() && <Badge tone="green">You</Badge>}</li>))}
          </ul>
          <p className="mt-3 text-xs text-zinc-500">To add or remove an administrator, update the allowlist in the code and the deployed Firestore rules.</p>
        </Block>

        <Block title="Connection" hint="Live data this console is reading right now.">
          <Props rows={[['Status', d.error ? 'Error' : d.loading ? 'Connecting…' : 'Connected'], ['Offline requests loaded', d.offline.length], ['Document uploads loaded', d.uploads.length], ['Customers loaded', d.customers.length], ['Audit entries loaded', d.audit.length]]} />
          <p className="mt-3 flex items-start gap-2 text-xs text-zinc-500"><BadgeCheck size={14} className="mt-0.5 shrink-0 text-emerald-600" />The console shows the latest 300 requests, 500 customers and 200 audit entries.</p>
        </Block>

        <Block title="This device" hint="Preferences are stored only in this browser.">
          <p className="mb-3 flex items-start gap-2 text-sm text-zinc-600"><MonitorSmartphone size={16} className="mt-0.5 shrink-0 text-zinc-400" />Sidebar state and which notifications you've read are remembered here.</p>
          <Button onClick={clearLocal}>Reset preferences</Button>
        </Block>
      </div>
    </>
  )
}
