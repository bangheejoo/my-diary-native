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

export function firstDayOfMonth(year: number, month: number): number {
  return new Date(year, month, 1).getDay()
}

export function lastDateOfMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate()
}
