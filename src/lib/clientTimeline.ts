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

export function timelineDate(deadline:string|null,quarterStart:string|null|undefined,createdAt:string) {
 const value=deadline||quarterStart
 if(value)return value
 const date=new Date(createdAt)
 if(!Number.isFinite(date.getTime()))return null
 return new Intl.DateTimeFormat('en-CA',{timeZone:'America/Sao_Paulo',year:'numeric',month:'2-digit',day:'2-digit'}).format(date)
}
export function quarterBounds(year:number,quarter:number) {
 if(!Number.isInteger(year)||year<2000||year>2100||![1,2,3,4].includes(quarter))throw Error('invalid_quarter')
 const start=`${year}-${String((quarter-1)*3+1).padStart(2,'0')}-01`
 const end=new Date(Date.UTC(year,quarter*3,0)).toISOString().slice(0,10)
 return {start,end}
}
