// components/today/VisualTimer.tsx
'use client'

import { useId } from 'react'

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

// ── VisualTimer (stub — rebuilt in Task 5) ───────────────────────────────────

export function VisualTimer({ onClose }: { onClose: () => void }) {
  return <div className="today-timer"><Hourglass elapsed={0} running={false} finished={false} reducedMotion={false} /></div>
}
