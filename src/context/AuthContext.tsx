import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import {
  GoogleAuthProvider,
  RecaptchaVerifier,
  linkWithPhoneNumber,
  onAuthStateChanged,
  signInWithPhoneNumber,
  signInWithPopup,
  signOut,
  updateProfile,
  type ConfirmationResult,
  type User,
} from 'firebase/auth'
import { doc, serverTimestamp, setDoc } from 'firebase/firestore'
import { auth, db } from '../lib/firebase'
import { normMobile } from '../lib/validate'

const hasPhone = (u: User | null) => Boolean(u?.phoneNumber && u.providerData.some((p) => p.providerId === 'phone'))

type Ctx = {
  /** Fully signed-in user (mobile verified). */
  user: User | null
  /** Signed in with Google but mobile number still missing: must add it to continue. */
  pendingGoogleUser: User | null
  loading: boolean
  requestOtp: (mobile: string) => Promise<void>
  confirmOtp: (code: string, name?: string) => Promise<void>
  googleSignIn: () => Promise<void>
  logout: () => Promise<void>
}
const AuthCtx = createContext<Ctx | null>(null)

export function authMessage(e: unknown) {
  const code = (e as { code?: string })?.code ?? ''
  const map: Record<string, string> = {
    'auth/invalid-verification-code': 'Incorrect OTP. Please check and try again.',
    'auth/code-expired': 'This OTP has expired. Request a new one.',
    'auth/too-many-requests': 'Too many attempts. Try again in a few minutes.',
    'auth/invalid-phone-number': 'Enter a valid 10-digit Indian mobile number.',
    'auth/credential-already-in-use': 'This mobile number is already linked to another account.',
    'auth/account-exists-with-different-credential': 'This number belongs to a different account.',
    'auth/popup-closed-by-user': 'Google sign-in was cancelled.',
    'auth/popup-blocked': 'Your browser blocked the Google sign-in popup.',
    'auth/network-request-failed': 'Network error. Check your connection.',
    'auth/captcha-check-failed': 'Verification failed. Refresh the page and try again.',
  }
  return map[code] ?? (e instanceof Error && e.message.startsWith('Enter ') ? e.message : 'Something went wrong. Please try again.')
}

let confirmation: ConfirmationResult | null = null
let verifier: RecaptchaVerifier | null = null

function getVerifier() {
  if (!verifier) {
    const el = document.getElementById('recaptcha-container')
    if (!el) throw new Error('Phone verification is unavailable right now.')
    verifier = new RecaptchaVerifier(auth, el, { size: 'invisible' })
  }
  return verifier
}
function resetRecaptcha() {
  verifier?.clear()
  verifier = null
  confirmation = null
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [current, setCurrent] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [, bump] = useState(0)

  useEffect(
    () =>
      onAuthStateChanged(auth, (u) => {
        setCurrent(u)
        setLoading(false)
      }),
    [],
  )

  async function saveProfile(u: User, name?: string) {
    await setDoc(
      doc(db, 'users', u.uid),
      {
        name: name?.trim() || u.displayName || '',
        email: u.email ?? null,
        mobile: normMobile((u.phoneNumber ?? '').replace('+91', '')),
        updatedAt: serverTimestamp(),
      },
      { merge: true },
    )
  }

  const value: Ctx = {
    user: hasPhone(current) ? current : null,
    pendingGoogleUser: current && !hasPhone(current) && current.providerData.some((p) => p.providerId === 'google.com') ? current : null,
    loading,
    async requestOtp(mobile) {
      const national = normMobile(mobile)
      if (!/^[6-9]\d{9}$/.test(national)) throw new Error('Enter a valid 10-digit Indian mobile number.')
      const phone = `+91${national}`
      try {
        confirmation = auth.currentUser
          ? await linkWithPhoneNumber(auth.currentUser, phone, getVerifier())
          : await signInWithPhoneNumber(auth, phone, getVerifier())
      } catch (e) {
        resetRecaptcha()
        throw e
      }
    },
    async confirmOtp(code, name) {
      if (!confirmation) throw new Error('Enter a new OTP request first.')
      const cred = await confirmation.confirm(code)
      confirmation = null
      if (name && !cred.user.displayName) await updateProfile(cred.user, { displayName: name.trim() })
      await cred.user.reload()
      await saveProfile(auth.currentUser!, name)
      setCurrent(auth.currentUser)
      bump((n) => n + 1) // linking a phone doesn't fire onAuthStateChanged
    },
    async googleSignIn() {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider())
      if (hasPhone(cred.user)) await saveProfile(cred.user)
    },
    async logout() {
      resetRecaptcha()
      await signOut(auth)
    },
  }
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>
}

export const useAuth = () => {
  const c = useContext(AuthCtx)
  if (!c) throw new Error('useAuth outside AuthProvider')
  return c
}
