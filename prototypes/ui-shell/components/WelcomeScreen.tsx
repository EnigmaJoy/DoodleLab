// components/WelcomeScreen.tsx
'use client'

import { useState, useEffect } from 'react'

// Must match the total CSS animation duration (0.3s delay + 3.6s last keyframe end).
const ANIM_TOTAL_MS = 4000

interface WelcomeScreenProps {
  visible: boolean
  onStart: () => void
}

export function WelcomeScreen({ visible, onStart }: WelcomeScreenProps) {
  const [animKey,     setAnimKey]     = useState(0)
  const [buttonReady, setButtonReady] = useState(false)

  useEffect(() => {
    setButtonReady(false)

    const prefersReduced =
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches

    // Reduced-motion: CSS jumps to final state instantly, so button is
    // immediately interactive.
    if (prefersReduced) {
      setButtonReady(true)
      return
    }

    const t = window.setTimeout(() => setButtonReady(true), ANIM_TOTAL_MS)
    return () => window.clearTimeout(t)
  }, [animKey])

  return (
    <div
      className="screen welcome-screen"
      data-hidden={!visible || undefined}
      inert={!visible || undefined}
      aria-hidden={!visible || undefined}
    >
      <main className="welcome-main">
        {/* Accessible heading: screen readers announce "Welcome", visual text is decorative */}
        <h1 className="sr-only">Welcome</h1>

        {/* Tap / click anywhere on the text to replay from the beginning */}
        <button
          className="welcome-replay-btn"
          type="button"
          onClick={() => setAnimKey(k => k + 1)}
          aria-label="Riproduci l'animazione di benvenuto"
        >
          <div className="welcome-text-wrapper" aria-hidden="true">
            {/* Changing key remounts each span, restarting its CSS animation */}
            <span key={`stroke-${animKey}`} className="welcome-stroke">Welcome</span>
            <span key={`fill-${animKey}`}   className="welcome-fill">Welcome</span>
          </div>
        </button>

        {/* key remounts the button so its appear animation restarts on replay */}
        <button
          key={`inizia-${animKey}`}
          className={`inizia-button${buttonReady ? ' ready' : ''}`}
          type="button"
          onClick={onStart}
          tabIndex={buttonReady ? 0 : -1}
          aria-hidden={buttonReady ? undefined : true}
        >
          Inizia
        </button>
      </main>
    </div>
  )
}
