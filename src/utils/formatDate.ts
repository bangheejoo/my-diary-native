export function toDateString(date: Date | string): string {
  const d = date instanceof Date ? date : new Date(date)
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function toKoreanDate(dateStr: string): string {
  if (!dateStr) return ''
  const [y, m, d] = dateStr.split('-')
  return `${y}년 ${parseInt(m)}월 ${parseInt(d)}일`
}

export function toShortDate(dateStr: string): string {
  if (!dateStr) return ''
  const [, m, d] = dateStr.split('-')
  return `${m}/${d}`
}

export function today(): string {
  return toDateString(new Date())
}

export function fromTimestamp(ts: { toDate?: () => Date } | null): string {
  if (!ts) return ''
  const d = ts.toDate ? ts.toDate() : new Date(ts as unknown as string)
  return toDateString(d)
}

export function isPastOrToday(dateStr: string): boolean {
  return dateStr <= today()
}

export function timeAgoFromDate(date: Date): string {
  const diff = Math.floor((Date.now() - date.getTime()) / 1000)
  if (diff < 60) return '방금 전'
  if (diff < 3600) return `${Math.floor(diff / 60)}분 전`
  if (diff < 86400) return `${Math.floor(diff / 3600)}시간 전`
  return `${Math.floor(diff / 86400)}일 전`
}

export function formatPhone(phone: string | undefined | null): string {
  if (!phone) return ''
  const d = phone.replace(/\D/g, '')
  if (d.length === 11) return `${d.slice(0, 3)}-${d.slice(3, 7)}-${d.slice(7)}`
  if (d.length === 10) return `${d.slice(0, 3)}-${d.slice(3, 6)}-${d.slice(6)}`
  return phone
}

export function isBirthday(birthdate: string | undefined | null): boolean {
  if (!birthdate) return false
  const now = new Date()
  const [, m, d] = birthdate.split('-')
  return parseInt(m) === now.getMonth() + 1 && parseInt(d) === now.getDate()
}

export function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export function lastDateOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}
