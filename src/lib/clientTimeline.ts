export function timelinePeriod(date: string | null) {
  if (!date || !/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  return { year: Number(date.slice(0, 4)), quarter: Math.floor((Number(date.slice(5, 7)) - 1) / 3) + 1 }
}
export function inTimelinePeriod(date: string | null, year: number, quarter: string) {
  const period = timelinePeriod(date)
  if (quarter === 'legacy') return period === null
  if (!period) return quarter === 'all'
  return period.year === year && (quarter === 'all' || period.quarter === Number(quarter))
}
