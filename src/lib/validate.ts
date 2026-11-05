export const normMobile = (v: string) => v.replace(/[\s-]/g, '').replace(/^(\+91|0)(?=\d{10}$)/, '')

export const validName = (v: string) => {
  const t = v.trim()
  if (t.length < 2 || t.length > 60) return 'Enter your name (2 to 60 characters).'
  return /^[\p{L}][\p{L} .'-]*$/u.test(t) ? null : 'Name can only contain letters and spaces.'
}
export const validEmail = (v: string) =>
  v.length <= 120 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(v.trim()) ? null : 'Enter a valid email address.'
export const validMobile = (v: string) =>
  /^[6-9]\d{9}$/.test(normMobile(v)) ? null : 'Enter a valid 10-digit Indian mobile number.'
export const validPassword = (v: string) =>
  v.length < 8 || v.length > 64
    ? 'Password must be 8 to 64 characters long.'
    : !/[A-Za-z]/.test(v) || !/\d/.test(v)
      ? 'Password must include at least one letter and one number.'
      : null
