// components/oggi/VisualTimer.tsx
'use client'

import { useEffect, useRef, useState } from 'react'
import {
  TIMER_PRESETS_MIN, createTimer, formatRemaining, pauseTimer, progress, remainingMs,
  resetTimer, startTimer, tickTimer,
} from '@/lib/oggi/timer'
import { getTimerStore } from '@/lib/oggi/timer-store'
import { useRepository } from './shared'

export function VisualTimer() {
  // State lives in the shared store so time blocks can load it ("Avvia timer")
  const store   = useRepository(getTimerStore())
  const timer   = store.state
  const [now,    setNow]    = useState(() => Date.now())
  const [notice, setNotice] = useState('')
  const lastStatus = useRef(timer.status)

  useEffect(() => {
    if (timer.status !== 'running') return
    setNow(Date.now())
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      store.update(prev => tickTimer(prev, t))
    }, 250)
    return () => clearInterval(id)
  }, [timer.status, timer.endsAt, store])

  // Announce transitions only (started from elsewhere, finished)
  useEffect(() => {
    if (lastStatus.current !== 'finished' && timer.status === 'finished') setNotice('Tempo finito.')
    if (lastStatus.current !== 'running' && timer.status === 'running' && store.label) {
      setNotice(`Timer avviato per ${store.label}`)
    }
    lastStatus.current = timer.status
  }, [timer.status, store.label])

  const minutes = timer.durationMs / 60_000
  const left    = remainingMs(timer, now)
  const done    = progress(timer, now)

  function pickPreset(m: number) {
    store.update(() => createTimer(m), null)
    setNotice('')
  }

  function primary() {
    const t = Date.now()
    setNow(t)
    setNotice('')
    store.update(prev => prev.status === 'running' ? pauseTimer(prev, t) : startTimer(prev, t))
  }

  const primaryLabel =
    timer.status === 'running' ? 'Pausa'
    : timer.status === 'paused' ? 'Riprendi'
    : timer.status === 'finished' ? 'Ricomincia'
    : 'Avvia'

  return (
    <div className="oggi-timer">
      <Hourglass progress={done} running={timer.status === 'running'} />
      <div className="oggi-timer-controls">
        <p className="oggi-timer-time" aria-hidden="true">{formatRemaining(left)}</p>
        <p className="oggi-muted">
          {timer.status === 'finished' ? `Finiti i ${minutes} minuti` : `rimasti su ${minutes} minuti`}
          {store.label && <> · {store.label}</>}
        </p>
        {/* Announce state changes, not every second */}
        <p className="sr-only" role="status">
          {notice || (timer.status === 'paused' ? `In pausa, ${formatRemaining(left)} rimasti` : '')}
        </p>
        <div className="oggi-presets" role="group" aria-label="Durata">
          {TIMER_PRESETS_MIN.map(m => (
            <button key={m} type="button" className="oggi-preset"
                    aria-pressed={minutes === m}
                    disabled={timer.status === 'running'}
                    onClick={() => pickPreset(m)}>
              {m} min
            </button>
          ))}
        </div>
        <div className="oggi-form-actions oggi-form-actions--start">
          <button type="button" className="oggi-btn oggi-btn--dark" onClick={primary}
                  aria-label={`${primaryLabel} timer, ${formatRemaining(left)} rimasti`}>
            {primaryLabel}
          </button>
          {timer.status !== 'idle' && (
            <button type="button" className="oggi-btn oggi-btn--quiet"
                    onClick={() => { store.update(resetTimer); setNotice('') }}>
              Azzera
            </button>
          )}
        </div>
      </div>
    </div>
  )
}

/** Sand level reflects real progress; the falling stream is decorative only */
function Hourglass({ progress: p, running }: { progress: number; running: boolean }) {
  const top    = 1 - p   // fraction of sand still in the top bulb
  // Bulb interiors: top y 10..46, bottom y 54..90
  const topH   = 34 * top
  const bottomH = 34 * p
  return (
    <svg className="oggi-hourglass" viewBox="0 0 64 100" width="72" height="112"
         aria-hidden="true" focusable="false">
      <defs>
        <clipPath id="oggi-hg-top"><path d="M12 10 H52 C52 30 34 40 32 48 C30 40 12 30 12 10Z" /></clipPath>
        <clipPath id="oggi-hg-bottom"><path d="M32 52 C34 60 52 70 52 90 H12 C12 70 30 60 32 52Z" /></clipPath>
      </defs>
      <rect clipPath="url(#oggi-hg-top)" x="0" y={46 - topH} width="64" height={topH} className="oggi-sand" />
      <rect clipPath="url(#oggi-hg-bottom)" x="0" y={90 - bottomH} width="64" height={bottomH} className="oggi-sand" />
      {running && p < 1 && <line x1="32" y1="48" x2="32" y2={90 - bottomH} className="oggi-sand-stream" />}
      <path d="M12 10 H52 C52 30 34 40 32 50 C34 60 52 70 52 90 H12 C12 70 30 60 32 50 C30 40 12 30 12 10Z"
            className="oggi-hourglass-glass" />
      <path d="M6 6 H58 M6 94 H58" className="oggi-hourglass-frame" />
    </svg>
  )
}
