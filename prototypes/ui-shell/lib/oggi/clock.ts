// lib/oggi/clock.ts
// Wall clock for day-boundary checks. In development a manual offset can be
// set from the browser console to exercise midnight without waiting:
//   window.__oggiDev.setClockOffsetMinutes(n)

let offsetMs = 0

export function clockNow(): Date {
  return new Date(Date.now() + offsetMs)
}

export function setClockOffsetMinutes(minutes: number): void {
  if (process.env.NODE_ENV === 'production') return
  offsetMs = minutes * 60_000
}
