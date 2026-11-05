import { useEffect, useRef, useState, type FormEvent } from 'react'
import Modal from './Modal'
import Ic from './Ic'
import { authMessage, useAuth } from '../context/AuthContext'
import { validMobile, validName } from '../lib/validate'

export default function AuthModal({ onClose }: { onClose: () => void }) {
  const { user, pendingGoogleUser, requestOtp, confirmOtp, googleSignIn } = useAuth()
  const [step, setStep] = useState<'phone' | 'otp'>('phone')
  const [mobile, setMobile] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [cooldown, setCooldown] = useState(0)
  const nameRef = useRef('')

  // Close as soon as the user is fully signed in (mobile verified)
  useEffect(() => { if (user) onClose() }, [user, onClose])
  useEffect(() => {
    if (!cooldown) return
    const t = setTimeout(() => setCooldown((c) => c - 1), 1000)
    return () => clearTimeout(t)
  }, [cooldown])

  const needsName = !pendingGoogleUser
  const run = async (fn: () => Promise<void>) => {
    setError(null)
    setBusy(true)
    try { await fn() } catch (e) { setError(authMessage(e)) } finally { setBusy(false) }
  }

  function sendOtp(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const f = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const bad = (needsName ? validName(f.name ?? '') : null) ?? validMobile(f.mobile)
    if (bad) return setError(bad)
    setMobile(f.mobile)
    nameRef.current = f.name ?? ''
    run(async () => { await requestOtp(f.mobile); setStep('otp'); setCooldown(30) })
  }

  function verify(e: FormEvent<HTMLFormElement>) {
    e.preventDefault()
    const code = String(new FormData(e.currentTarget).get('code') ?? '').trim()
    if (!/^\d{6}$/.test(code)) return setError('Enter the 6-digit OTP.')
    run(() => confirmOtp(code, nameRef.current))
  }

  return (
    <Modal
      title={pendingGoogleUser ? 'Add your mobile number' : step === 'otp' ? 'Verify OTP' : 'Sign in or sign up'}
      eyebrow="ASKUS INSURANCE"
      onClose={onClose}
      className="auth-modal"
    >
      {step === 'phone' ? (
        <form onSubmit={sendOtp} noValidate>
          {pendingGoogleUser && (
            <p className="modal-note">Signed in as {pendingGoogleUser.email}. A verified mobile number is required to continue.</p>
          )}
          <div className="form-grid">
            {needsName && <label className="field full-width"><span>Full name</span><input name="name" autoComplete="name" placeholder="Your name" /></label>}
            <label className="field full-width"><span>Mobile number</span>
              <input name="mobile" type="tel" inputMode="numeric" autoComplete="tel-national" placeholder="10-digit mobile number" defaultValue={mobile} />
            </label>
          </div>
          {error && <p role="alert" style={{ color: '#d93025', margin: '12px 0 0' }}>{error}</p>}
          <div className="form-footer">
            <p>We'll text you a 6-digit OTP. Standard SMS rates may apply.</p>
            <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Sending…' : 'Send OTP'} <Ic n="arrow-right" /></button>
          </div>
          {!pendingGoogleUser && (
            <>
              <p className="center" style={{ margin: '18px 0 10px' }}>or</p>
              <button type="button" className="outline-button" style={{ width: '100%' }} disabled={busy} onClick={() => run(googleSignIn)}>
                Continue with Google
              </button>
            </>
          )}
        </form>
      ) : (
        <form onSubmit={verify} noValidate>
          <p className="modal-note">Enter the 6-digit code sent to +91 {mobile}.</p>
          <div className="form-grid">
            <label className="field full-width"><span>OTP</span>
              <input name="code" inputMode="numeric" autoComplete="one-time-code" maxLength={6} placeholder="------" autoFocus />
            </label>
          </div>
          {error && <p role="alert" style={{ color: '#d93025', margin: '12px 0 0' }}>{error}</p>}
          <div className="form-footer">
            <p>
              <button type="button" className="text-link" onClick={() => { setStep('phone'); setError(null) }}>Change number</button>{' · '}
              <button type="button" className="text-link" disabled={cooldown > 0 || busy}
                onClick={() => run(async () => { await requestOtp(mobile); setCooldown(30) })}>
                {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend OTP'}
              </button>
            </p>
            <button className="primary-button" type="submit" disabled={busy}>{busy ? 'Verifying…' : 'Verify'} <Ic n="arrow-right" /></button>
          </div>
        </form>
      )}
    </Modal>
  )
}
