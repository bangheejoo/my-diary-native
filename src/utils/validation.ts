export function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function isValidPassword(pw: string): boolean {
  return pw.length >= 8 && /[a-zA-Z]/.test(pw) && /[0-9]/.test(pw)
}

export function isValidNickname(nickname: string): boolean {
  const t = nickname.trim()
  return t.length >= 2 && t.length <= 12
}

export function isValidPhone(phone: string): boolean {
  return /^01[0-9]{8,9}$/.test(phone.replace(/-/g, ''))
}

export function isValidBirthdate(dateStr: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return false
  const d = new Date(dateStr)
  return d instanceof Date && !isNaN(d.getTime())
}
