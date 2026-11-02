export function timelinePeriod(date: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return { year: Number(date.slice(0, 4)), quarter: Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1 }
}
export function inTimelinePeriod(date: string | null, year: number, quarter: string) {
  const period = timelinePeriod(date)
  if (quarter === 'legacy') return period === null
  if (!period) return false
  return period.year === year && (quarter === 'all' || period.quarter === Number(quarter))
}
export function previousMonth(date = new Date()) {
  const first = new Date(date.getFullYear(), date.getMonth() - 1, 1)
  const last = new Date(date.getFullYear(), date.getMonth(), 0)
  const day = (value: Date) => `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  return { start: day(first), end: day(last), month: day(first).slice(0, 7) }
}
