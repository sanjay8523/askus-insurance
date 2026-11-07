import { useEffect, useState, type FormEvent, type ReactNode } from 'react'
import { sendEmailVerification, sendPasswordResetEmail, signInWithEmailAndPassword, signOut, type User } from 'firebase/auth'
import { CheckCircle2, Eye, EyeOff, Loader2, Lock, Mail, MailCheck, ShieldCheck } from 'lucide-react'
import { auth } from '../lib/firebase'
import { Button, Field, cn, inputCls } from '../ui'
import { isAdminEmail } from './data'

function AuthFrame({ children }: { children: ReactNode }) {
  return (
    <div className="app-root grid min-h-dvh bg-zinc-50 text-zinc-900 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <aside className="relative hidden flex-col justify-between overflow-hidden bg-zinc-950 p-12 text-zinc-300 lg:flex">
        <div className="flex items-center gap-2.5"><span className="grid size-9 place-items-center rounded-lg bg-indigo-600 text-white"><ShieldCheck size={19} /></span>
          <span className="text-sm font-semibold text-white">Askus Insurance</span></div>
        <div className="max-w-md">
          <h2 className="mb-0 text-3xl font-semibold leading-tight tracking-tight text-white">Every request, document and customer in one place.</h2>
          <ul className="mt-8 space-y-4 text-sm">
            {['Respond to offline car and bike requests within 24 hours', 'Open customer documents through private, expiring links', 'Every change is written to a permanent audit log'].map((t) => (
              <li key={t} className="flex gap-3"><CheckCircle2 size={18} className="mt-0.5 shrink-0 text-indigo-400" />{t}</li>))}
          </ul>
        </div>
        <p className="text-xs text-zinc-500">Restricted to authorised administrators.</p>
        <div aria-hidden className="pointer-events-none absolute -right-24 -top-24 size-80 rounded-full bg-indigo-600/10 blur-3xl" />
      </aside>
      <main className="grid place-items-center px-4 py-10 sm:px-8">
        <div className="w-full max-w-[400px]">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden"><span className="grid size-9 place-items-center rounded-lg bg-indigo-600 text-white"><ShieldCheck size={19} /></span>
            <span className="text-sm font-semibold">Askus Insurance <span className="font-normal text-zinc-500">· Admin</span></span></div>
          {children}
        </div>
      </main>
    </div>
  )
}

export function Splash() {
  return (
    <div className="app-root grid min-h-dvh place-items-center bg-zinc-50" role="status" aria-label="Loading">
      <div className="flex flex-col items-center gap-3 text-zinc-500"><span className="grid size-10 place-items-center rounded-xl bg-indigo-600 text-white"><ShieldCheck size={20} /></span><Loader2 size={18} className="animate-spin" /></div>
    </div>
  )
}

export function Login({ notice }: { notice?: string }) {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [show, setShow] = useState(false)
  const [error, setError] = useState(notice ?? '')
  const [info, setInfo] = useState('')
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setError(''); setInfo('')
    if (!isAdminEmail(email)) return setError('This email is not on the administrator list.')
    setBusy(true)
    try { await signInWithEmailAndPassword(auth, email.trim().toLowerCase(), password) }
    catch { setError('Incorrect email or password.') }
    finally { setBusy(false) }
  }
  async function reset() {
    setError(''); setInfo('')
    if (!isAdminEmail(email)) return setError('Enter your admin email above first.')
    try { await sendPasswordResetEmail(auth, email.trim().toLowerCase()); setInfo('Password reset email sent. Check your inbox and spam folder.') }
    catch { setError('Could not send the reset email. Is the account created in Firebase?') }
  }
  return (
    <AuthFrame>
      <h1 className="text-2xl font-semibold tracking-tight">Sign in to the admin console</h1>
      <p className="mt-2 text-sm text-zinc-500">Use your administrator email and password. Only allowlisted accounts can enter.</p>
      <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
        <Field label="Email">
          <div className="relative"><Mail size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input required type="email" autoComplete="username" inputMode="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="you@company.com" className={cn(inputCls, 'pl-9')} /></div>
        </Field>
        <Field label="Password">
          <div className="relative"><Lock size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-zinc-400" />
            <input required type={show ? 'text' : 'password'} autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className={cn(inputCls, 'px-9')} />
            <button type="button" onClick={() => setShow((s) => !s)} aria-label={show ? 'Hide password' : 'Show password'} className="absolute right-1 top-1/2 grid size-9 -translate-y-1/2 place-items-center rounded-md text-zinc-400 hover:text-zinc-700 max-md:size-11">{show ? <EyeOff size={16} /> : <Eye size={16} />}</button></div>
        </Field>
        {error && <p role="alert" className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-800">{error}</p>}
        {info && <p role="status" className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-sm text-emerald-800">{info}</p>}
        <Button type="submit" variant="primary" loading={busy} className="w-full">{busy ? 'Signing in…' : 'Sign in'}</Button>
      </form>
      <div className="mt-5 flex items-center justify-between text-sm">
        <button type="button" onClick={reset} className="font-medium text-indigo-600 hover:underline">Forgot password?</button>
        <a href="/" className="text-zinc-500 hover:text-zinc-900">Return to site</a>
      </div>
    </AuthFrame>
  )
}

export function VerifyEmail({ user }: { user: User }) {
  const [msg, setMsg] = useState('')
  const [err, setErr] = useState(false)
  const [busy, setBusy] = useState(false)
  const [wait, setWait] = useState(0)

  async function send() {
    setBusy(true); setErr(false)
    try {
      await sendEmailVerification(user, { url: `${location.origin}/admin` })
      setMsg(`Verification link sent to ${user.email}.`)
      setWait(30)
    } catch { setErr(true); setMsg('Could not send the email right now. Wait a minute and try again.') }
    finally { setBusy(false) }
  }
  async function check(manual = false) {
    await user.reload()
    if (auth.currentUser?.emailVerified) {
      await user.getIdToken(true) // new token carries email_verified = true
      location.reload()
    } else if (manual) { setErr(true); setMsg('Not verified yet. Open the link in the email first.') }
  }
  // send the link the first time, then keep checking: when you return to this tab after clicking the link it continues on its own
  useEffect(() => { void send() }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (wait <= 0) return; const t = setTimeout(() => setWait((w) => w - 1), 1000); return () => clearTimeout(t) }, [wait])
  useEffect(() => {
    const t = setInterval(() => void check(), 4000)
    const back = () => { if (document.visibilityState === 'visible') void check() }
    document.addEventListener('visibilitychange', back)
    window.addEventListener('focus', back)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', back); window.removeEventListener('focus', back) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <AuthFrame>
      <span className="grid size-11 place-items-center rounded-full bg-indigo-50 text-indigo-600"><MailCheck size={22} /></span>
      <h1 className="mt-5 text-2xl font-semibold tracking-tight">Verify your email</h1>
      <p className="mt-2 text-sm text-zinc-500">For security, admin access needs a verified email address (<span className="font-medium text-zinc-800">{user.email}</span>). This is a one-time step.</p>
      {msg && <p role="status" className={cn('mt-5 rounded-lg border px-3 py-2.5 text-sm', err ? 'border-rose-200 bg-rose-50 text-rose-800' : 'border-indigo-100 bg-indigo-50 text-indigo-900')}>{msg}</p>}
      <ol className="mt-5 space-y-2.5 text-sm text-zinc-600">
        <li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-medium">1</span>Open the email from Firebase and click the link.</li>
        <li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-medium">2</span>Can't find it? Check Spam and Promotions, and allow a few minutes.</li>
        <li className="flex gap-3"><span className="grid size-5 shrink-0 place-items-center rounded-full bg-zinc-100 text-xs font-medium">3</span>Come back to this tab. You'll continue automatically.</li>
      </ol>
      <p className="mt-5 flex items-center gap-2 text-xs text-zinc-500"><Loader2 size={13} className="animate-spin" />Waiting for you to click the link…</p>
      <div className="mt-5 flex flex-wrap gap-2">
        <Button variant="primary" loading={busy} disabled={wait > 0} onClick={send}>{wait > 0 ? `Resend in ${wait}s` : 'Resend email'}</Button>
        <Button onClick={() => void check(true)}>I've verified</Button>
      </div>
      <button type="button" onClick={() => signOut(auth)} className="mt-6 text-sm text-zinc-500 underline-offset-2 hover:text-zinc-900 hover:underline">Sign out</button>
    </AuthFrame>
  )
}
