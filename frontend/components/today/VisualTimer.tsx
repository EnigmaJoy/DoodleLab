// components/today/VisualTimer.tsx
'use client'

import { useEffect, useId, useRef, useState } from 'react'
import {
  TIMER_PRESETS_MIN, createTimer, formatRemaining, pauseTimer, progress,
  remainingMs, resetTimer, startTimer, tickTimer,
} from '@/lib/today/timer'
import type { TimerStatus } from '@/lib/today/timer'
import { getTimerStore } from '@/lib/today/timer-store'
import { SegmentedControl } from '@/design-system/SegmentedControl'
import { IconButton } from '@/design-system/IconButton'
import { useRepository } from './shared'

// ── Close icon ───────────────────────────────────────────────────────────────

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" focusable="false">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

// ── Reduced motion hook ──────────────────────────────────────────────────────

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return false
    return (
      window.matchMedia('(prefers-reduced-motion: reduce)').matches ||
      !!document.documentElement.dataset.reduceMotion
    )
  })
  useEffect(() => {
    if (typeof window === 'undefined' || !window.matchMedia) return
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)')
    const check = () => setReduced(
      mq.matches || !!document.documentElement.dataset.reduceMotion
    )
    mq.addEventListener('change', check)
    return () => mq.removeEventListener('change', check)
  }, [])
  return reduced
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function primaryLabel(status: TimerStatus): string {
  if (status === 'running') return 'Pausa'
  if (status === 'paused')  return 'Riprendi'
  return 'Avvia'
}

function statusText(status: TimerStatus, minutes: number): string {
  if (status === 'idle')    return `pronto, ${minutes} minuti`
  if (status === 'running') return `restano, su ${minutes}`
  if (status === 'paused')  return `in pausa, su ${minutes}`
  return `su ${minutes} minuti`
}

// ── VisualTimer ──────────────────────────────────────────────────────────────

export function VisualTimer({ onClose }: { onClose: () => void }) {
  const store  = useRepository(getTimerStore())
  const timer  = store.state
  const [now,  setNow]         = useState(() => Date.now())
  const [showSeconds, setShowSeconds] = useState(() => {
    if (typeof window === 'undefined') return false
    try { return localStorage.getItem('today.timer.showSeconds') === 'true' } catch { return false }
  })
  const [announceText, setAnnounceText] = useState('')
  const lastAnnouncedMin = useRef<number>(Infinity)
  const reducedMotion    = useReducedMotion()

  // 1 s interval: tick store + refresh now for display/sand
  useEffect(() => {
    if (timer.status !== 'running') return
    setNow(Date.now())
    const id = setInterval(() => {
      const t = Date.now()
      setNow(t)
      store.update(prev => tickTimer(prev, t))
    }, 1000)
    return () => clearInterval(id)
  }, [timer.status, timer.endsAt, store])

  // Aria-live announcements at 5-min boundaries and finish
  useEffect(() => {
    if (timer.status === 'finished') {
      setAnnounceText('Tempo finito')
      lastAnnouncedMin.current = 0
      return
    }
    if (timer.status === 'running') {
      const leftMin = Math.ceil(remainingMs(timer, now) / 60_000)
      if (leftMin % 5 === 0 && leftMin > 0 && leftMin !== lastAnnouncedMin.current) {
        setAnnounceText(`${leftMin} minuti rimanenti`)
        lastAnnouncedMin.current = leftMin
      }
    }
  }, [timer, now])

  const minutes    = timer.durationMs / 60_000
  const leftMs     = remainingMs(timer, now)
  const elapsed    = progress(timer, now)
  const isFinished = timer.status === 'finished'
  const isRunning  = timer.status === 'running'

  // In reduced motion snap sand to minute boundaries (spec: "update once per minute")
  const displayElapsed = reducedMotion && !isFinished
    ? 1 - Math.ceil(remainingMs(timer, now) / 60_000) / minutes
    : elapsed

  const timeText = isFinished
    ? 'Tempo finito'
    : showSeconds
    ? formatRemaining(leftMs)
    : (() => {
        const m = Math.ceil(leftMs / 60_000)
        return m === 1 ? '1 minuto' : `${m} minuti`
      })()

  function pickPreset(m: number) {
    store.update(() => createTimer(m), null)
    lastAnnouncedMin.current = Infinity
  }

  function handlePrimary() {
    const t = Date.now()
    setNow(t)
    if (timer.status === 'idle' || timer.status === 'paused') {
      setAnnounceText(`Timer avviato, ${minutes} minuti`)
      lastAnnouncedMin.current = minutes
    }
    store.update(prev => prev.status === 'running' ? pauseTimer(prev, t) : startTimer(prev, t))
  }

  function handleReset() {
    store.update(resetTimer)
    lastAnnouncedMin.current = Infinity
  }

  return (
    <div className="today-timer">
      <div
        className="today-timer-halo-wrap"
        data-finished={isFinished || undefined}
      >
        <Hourglass
          elapsed={displayElapsed}
          running={isRunning}
          finished={isFinished}
          reducedMotion={reducedMotion}
        />
      </div>

      <div className="today-timer-right">
        <div className="today-timer-header-row">
          <div>
            <p className="today-timer-time">{timeText}</p>
            <p className="today-timer-status">{statusText(timer.status, minutes)}</p>
          </div>
          <IconButton
            label="Chiudi il timer"
            icon={<CloseIcon />}
            onClick={onClose}
          />
        </div>

        <SegmentedControl
          options={TIMER_PRESETS_MIN.map(m => ({ value: String(m), label: `${m} min` }))}
          value={String(minutes)}
          onChange={v => pickPreset(Number(v))}
          label="Durata"
          variant="solid-active"
          disabled={isRunning}
        />

        {!isFinished && (
          <div className="today-timer-controls-row">
            <button
              type="button"
              className="today-timer-pill"
              onClick={handlePrimary}
              aria-label={`${primaryLabel(timer.status)} timer, ${timeText}`}
            >
              {primaryLabel(timer.status)}
            </button>
            {timer.status !== 'idle' && (
              <button
                type="button"
                className="today-timer-pill today-timer-pill--glass"
                onClick={handleReset}
              >
                Ricomincia
              </button>
            )}
          </div>
        )}

        {isFinished && (
          <div className="today-timer-finished-bar" role="status">
            <p><b>Tempo finito.</b> Fermati un attimo: com'è andata?</p>
            <div className="today-timer-controls-row">
              <button
                type="button"
                className="today-timer-pill"
                onClick={() => {
                  store.startFor(5, store.label)
                  lastAnnouncedMin.current = 5
                }}
              >
                Altri 5 minuti
              </button>
              <button
                type="button"
                className="today-timer-pill today-timer-pill--glass"
                onClick={() => { handleReset(); onClose() }}
              >
                Chiudi
              </button>
            </div>
          </div>
        )}

        <button
          type="button"
          role="switch"
          aria-checked={showSeconds}
          className="today-timer-seconds-toggle"
          onClick={() => {
            const v = !showSeconds
            setShowSeconds(v)
            try { localStorage.setItem('today.timer.showSeconds', String(v)) } catch {}
          }}
        >
          {showSeconds ? 'Mostra i minuti' : 'Mostra i secondi'}
        </button>

        {/* aria-live: announces at start, 5-min boundaries, and finish only */}
        <span className="sr-only" aria-live="polite" aria-atomic="true">
          {announceText}
        </span>
      </div>
    </div>
  )
}

// ── Hourglass ────────────────────────────────────────────────────────────────

export interface HourglassProps {
  elapsed:       number   // 0..1
  running:       boolean
  finished:      boolean
  reducedMotion: boolean
}

export function Hourglass({ elapsed, running, finished, reducedMotion }: HourglassProps) {
  const id    = useId()
  const topId = `${id}-clip-top`
  const botId = `${id}-clip-bottom`

  const clampedElapsed = Math.max(0, Math.min(1, elapsed))
  const remaining = 1 - clampedElapsed

  const topH    = 78 * remaining
  const topY    = 92 - topH
  const bottomH = 78 * clampedElapsed
  const bottomY = 182 - bottomH

  const sandTransition = reducedMotion ? undefined : 'y 1s linear, height 1s linear'
  const streamOpacity  = running && !finished ? 0.85 : 0

  return (
    <svg
      viewBox="0 0 130 196"
      width={130}
      height={196}
      aria-hidden="true"
      focusable="false"
    >
      <defs>
        <clipPath id={topId}>
          <path d="M14 14h102c0 34-30 52-44 78h-14C44 66 14 48 14 14z" />
        </clipPath>
        <clipPath id={botId}>
          <path d="M58 104h14c14 26 44 44 44 78H14c0-34 30-52 44-78z" />
        </clipPath>
      </defs>

      {/* Glass body */}
      <path
        d="M14 14h102c0 34-30 52-44 78v12c14 26 44 44 44 78H14c0-34 30-52 44-78V92C44 66 14 48 14 14z"
        fill="rgba(255,255,255,0.14)"
      />

      {/* Top sand */}
      <rect
        data-sand=""
        x={0}
        width={130}
        style={{
          y:          `${topY}px`,
          height:     `${topH}px`,
          fill:       'var(--glow-3)',
          transition: sandTransition,
        } as React.CSSProperties}
        clipPath={`url(#${topId})`}
      />

      {/* Bottom sand */}
      <rect
        data-sand=""
        x={0}
        width={130}
        style={{
          y:          `${bottomY}px`,
          height:     `${bottomH}px`,
          fill:       'var(--glow-3)',
          transition: sandTransition,
        } as React.CSSProperties}
        clipPath={`url(#${botId})`}
      />

      {/* Stream */}
      <rect
        data-stream=""
        x={63.5}
        y={92}
        width={3}
        height={88}
        rx={1.5}
        style={{
          fill:    'var(--glow-3)',
          opacity: streamOpacity,
        }}
      />

      {/* Caps */}
      <rect x={6}  y={6}   width={118} height={8} rx={4} fill="#FFFDF5" />
      <rect x={6}  y={182} width={118} height={8} rx={4} fill="#FFFDF5" />
    </svg>
  )
}
