import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ArrowLeft, CheckCircle2, ShieldCheck, X } from 'lucide-react'
import OtpInput from './OtpInput'
import { authMessage, useAuth } from '../context/AuthContext'
import { validMobile } from '../lib/validate'
import { Button, cn } from '../ui'

const GoogleG = () => (
  <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden>
    <path fill="#4285F4" d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.8-2.4 3.65v3h3.88c2.27-2.09 3.66-5.17 3.66-9.09z" />
    <path fill="#34A853" d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.1C3.28 21.43 7.35 24 12 24z" />
    <path fill="#FBBC05" d="M5.28 14.32c-.25-.72-.38-1.49-.38-2.32s.13-1.6.38-2.32V6.58H1.25C.45 8.18 0 9.99 0 12s.45 3.82 1.25 5.42l4.03-3.1z" />
    <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.35 0 3.28 2.57 1.25 6.58l4.03 3.1c.95-2.83 3.6-4.93 6.72-4.93z" />
  </svg>
)

/**
 * Sign in / sign up. A verified Indian mobile number is mandatory for every account:
 *  1. Mobile number  → 6-box OTP
 *  2. Google         → (mobile number is then requested)  → 6-box OTP, which links the number to the Google account
 * `onClose('done')` fires once the user is fully signed in; `onClose('cancel')` when they dismiss it.
 */
export default function AuthModal({ onClose }: { onClose: (reason?: 'done' | 'cancel') => void }) {
  const { user, pendingGoogleUser, requestOtp, confirmOtp, googleSignIn, logout } = useAuth()
  const dlg = useRef<HTMLDialogElement>(null)
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [mobile, setMobile] = useState('')
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const google = Boolean(pendingGoogleUser)

  useEffect(() => {
    const d = dlg.current!
    d.showModal()
    return () => d.close()
  }, [])
  // fully signed in (mobile verified): done
  useEffect(() => { if (user) onClose('done') }, [user, onClose])
  useEffect(() => {
    if (!cooldown) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const run = async (fn: () => Promise<void>) => {
    setError(null)
    setBusy(true)
    try { await fn() } catch (e) { setError(authMessage(e)) } finally { setBusy(false) }
  }

  function sendOtp(e: FormEvent) {
    e.preventDefault()
    const bad = validMobile(mobile)
    if (bad) return setError(bad)
    setCode('')
    run(async () => { await requestOtp(mobile); setStep('otp'); setCooldown(30) })
  }

  function verify(digits = code) {
    if (!/^\d{6}$/.test(digits)) return setError('Enter the 6-digit OTP.')
    run(async () => {
      try { await confirmOtp(digits) } catch (e) { setCode(''); throw e }
    })
  }
  // verify as soon as the sixth digit lands (typed, pasted or SMS autofill)
  useEffect(() => { if (step === 'otp' && code.length === 6 && !busy) verify(code) }, [code]) // eslint-disable-line react-hooks/exhaustive-deps

  const resend = () => run(async () => { setCode(''); await requestOtp(mobile); setCooldown(30) })
  const back = () => { setStep('phone'); setCode(''); setError(null) }
  const close = () => onClose('cancel')

  const title = step === 'otp' ? 'Verify your mobile' : google ? 'Add your mobile number' : 'Sign in or create account'
  const field = (
    <div className={cn('flex h-14 items-center rounded-xl border-2 bg-white px-3.5 transition-colors focus-within:border-indigo-600 focus-within:ring-4 focus-within:ring-indigo-500/15', error && step === 'phone' ? 'border-rose-400' : 'border-zinc-300')}>
      <span className="mr-2.5 rounded-md bg-zinc-100 px-1.5 py-0.5 text-[11px] font-semibold text-zinc-600">IN</span>
      <span className="border-r border-zinc-200 pr-3 text-base font-medium text-zinc-800">+91</span>
      <input type="tel" inputMode="numeric" autoComplete="tel-national" autoFocus value={mobile} aria-label="Mobile number" aria-invalid={Boolean(error)}
        onChange={(e) => { setMobile(e.target.value.replace(/\D/g, '').slice(0, 10)); if (error) setError(null) }} placeholder="10-digit mobile number"
        className="h-full min-w-0 flex-1 border-0 bg-transparent pl-3 text-lg font-semibold tracking-wide text-zinc-900 outline-none placeholder:text-base placeholder:font-normal placeholder:tracking-normal placeholder:text-zinc-400" />
    </div>
  )

  return (
    <dialog ref={dlg} aria-label={title} onCancel={(e) => { e.preventDefault(); close() }} onClick={(e) => { if (e.target === dlg.current) close() }}
      className="app-root m-auto max-h-[calc(100dvh-1.5rem)] w-[calc(100%-1.5rem)] max-w-[420px] overflow-y-auto rounded-2xl border-0 bg-white p-0 text-zinc-900 shadow-[0_24px_64px_-12px_rgba(16,24,40,.35)] backdrop:bg-zinc-900/50">
      <div className="p-6 sm:p-8">
        <div className="mb-6 flex items-center justify-between">
          {step === 'otp'
            ? <button type="button" onClick={back} className="-ml-2 inline-flex h-9 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"><ArrowLeft size={16} />Back</button>
            : <span className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[.08em] text-indigo-600"><ShieldCheck size={16} />Askus Insurance</span>}
          <button type="button" aria-label="Close" onClick={close} className="-mr-2 grid size-9 place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"><X size={18} /></button>
        </div>

        {step === 'phone' && !google && (
          <form onSubmit={sendOtp} noValidate>
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">Enter your mobile number. We'll text you a 6-digit OTP to verify it.</p>
            <div className="mt-6">{field}</div>
            {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
            <Button type="submit" variant="primary" loading={busy} className="mt-5 h-12 w-full text-[15px]">{busy ? 'Sending OTP…' : 'Get OTP'}</Button>
            <div className="my-6 flex items-center gap-3 text-xs font-medium uppercase tracking-widest text-zinc-400"><span className="h-px flex-1 bg-zinc-200" />or<span className="h-px flex-1 bg-zinc-200" /></div>
            <Button type="button" disabled={busy} className="h-12 w-full gap-3 text-[15px]" onClick={() => run(googleSignIn)}><GoogleG />Continue with Google</Button>
            <p className="mt-6 text-center text-xs leading-relaxed text-zinc-400">A verified mobile number is required for every account, including Google sign-in. By continuing you agree to the Terms of Use and Privacy Policy.</p>
          </form>
        )}

        {step === 'phone' && google && (
          <form onSubmit={sendOtp} noValidate>
            <div className="mb-5 flex items-start gap-3 rounded-xl border border-indigo-100 bg-indigo-50/60 p-4">
              <CheckCircle2 size={20} className="mt-0.5 shrink-0 text-indigo-600" />
              <div className="min-w-0"><p className="text-sm font-medium text-zinc-900">Signed in with Google</p><p className="truncate text-sm text-zinc-600">{pendingGoogleUser?.email}</p></div>
            </div>
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">One last step: every account needs a verified Indian mobile number. We'll text you an OTP to link it.</p>
            <div className="mt-6">{field}</div>
            {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
            <Button type="submit" variant="primary" loading={busy} className="mt-5 h-12 w-full text-[15px]">{busy ? 'Sending OTP…' : 'Send OTP'}</Button>
            <button type="button" onClick={() => { void logout() }} className="mt-4 w-full text-center text-sm font-medium text-zinc-500 hover:text-zinc-800">Use a different account</button>
          </form>
        )}

        {step === 'otp' && (
          <form onSubmit={(e) => { e.preventDefault(); verify() }} noValidate>
            <h2 className="text-2xl font-semibold tracking-tight">{title}</h2>
            <p className="mt-2 text-[15px] leading-relaxed text-zinc-500">Enter the 6-digit code we sent by SMS to <b className="font-semibold text-zinc-900">+91 {mobile}</b>.{google ? ' This links your mobile to your Google account.' : ''}</p>
            <div className="mt-6"><OtpInput value={code} onChange={(v) => { setCode(v); if (error) setError(null) }} disabled={busy} invalid={Boolean(error)} /></div>
            {error && <p role="alert" className="mt-3 text-sm text-rose-700">{error}</p>}
            <Button type="submit" variant="primary" loading={busy} disabled={code.length < 6} className="mt-5 h-12 w-full text-[15px]">{busy ? 'Verifying…' : google ? 'Verify and continue' : 'Verify and sign in'}</Button>
            <div className="mt-5 flex items-center justify-between text-sm text-zinc-500">
              <button type="button" onClick={back} className="font-medium text-zinc-600 hover:text-zinc-900">Change number</button>
              <button type="button" onClick={resend} disabled={cooldown > 0 || busy} className="font-medium text-indigo-600 hover:underline disabled:text-zinc-400 disabled:no-underline">
                {cooldown > 0 ? `Resend OTP in ${cooldown}s` : 'Resend OTP'}
              </button>
            </div>
          </form>
        )}
      </div>
    </dialog>
  )
}
