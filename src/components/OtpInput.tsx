import { useEffect, useRef } from 'react'
import { cn } from '../ui'

/** Six separate digit boxes. Supports typing, backspace, arrow keys, paste, and SMS autofill (iOS/Android one-time-code). */
export default function OtpInput({ value, onChange, disabled, invalid, autoFocus = true }: {
  value: string; onChange: (v: string) => void; disabled?: boolean; invalid?: boolean; autoFocus?: boolean
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([])
  // Always holds the newest code, even before React re-renders. Focus moves right after onChange, so anything
  // that decides where focus may go must read this, not the (stale) `value` prop.
  const latest = useRef(value)
  latest.current = value
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? '')

  const focus = (i: number) => { const el = refs.current[Math.max(0, Math.min(5, i))]; el?.focus(); el?.select() }
  const commit = (next: string) => { latest.current = next; onChange(next) }

  useEffect(() => { if (autoFocus) focus(0) }, []) // eslint-disable-line react-hooks/exhaustive-deps
  // when the parent clears the code (wrong OTP, resend) put the cursor back on the first box
  useEffect(() => { if (value === '') focus(0) }, [value])

  function set(i: number, raw: string) {
    const clean = raw.replace(/\D/g, '')
    const cur = latest.current
    if (!clean) { commit(cur.slice(0, i) + cur.slice(i + 1)); return } // box emptied: close the gap
    if (clean.length === 1) {
      // one digit typed into box i (replacing what was there): digits are entered left to right
      const at = Math.min(i, cur.length)
      commit((cur.slice(0, at) + clean + cur.slice(at + 1)).slice(0, 6))
      focus(at + 1)
      return
    }
    // several digits at once = paste or SMS autofill: a full code starts at the first box, a partial one continues from here
    const start = clean.length >= 6 ? 0 : Math.min(i, cur.length)
    const next = (cur.slice(0, start) + clean).slice(0, 6)
    commit(next)
    focus(next.length)
  }

  return (
    <div className="grid grid-cols-6 gap-2 sm:gap-2.5" role="group" aria-label="6-digit OTP">
      {digits.map((d, i) => (
        <input key={i} ref={(el) => { refs.current[i] = el }} value={d} disabled={disabled} aria-label={`Digit ${i + 1}`}
          type="text" inputMode="numeric" pattern="[0-9]*" autoComplete={i === 0 ? 'one-time-code' : 'off'} maxLength={i === 0 ? 6 : 1}
          onChange={(e) => set(i, e.target.value)}
          onFocus={(e) => { if (i > latest.current.length) focus(latest.current.length); else e.target.select() }}
          onKeyDown={(e) => {
            const cur = latest.current
            if (e.key === 'Backspace' && !digits[i] && i > 0) { e.preventDefault(); commit(cur.slice(0, i - 1) + cur.slice(i)); focus(i - 1) }
            else if (e.key === 'ArrowLeft') { e.preventDefault(); focus(i - 1) }
            else if (e.key === 'ArrowRight') { e.preventDefault(); focus(i + 1) }
          }}
          onPaste={(e) => { e.preventDefault(); set(i, e.clipboardData.getData('text')) }}
          className={cn('h-14 min-w-0 rounded-xl border-2 bg-white text-center text-xl font-semibold text-zinc-900 outline-none transition-colors disabled:bg-zinc-50 sm:h-16 sm:text-2xl',
            invalid ? 'border-rose-400 bg-rose-50/40 focus:border-rose-500 focus:ring-4 focus:ring-rose-500/15'
              : d ? 'border-zinc-900 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/15' : 'border-zinc-300 focus:border-indigo-600 focus:ring-4 focus:ring-indigo-500/15')} />
      ))}
    </div>
  )
}
