'use client'

import styles from './PeriodStepper.module.css'

interface PeriodStepperProps {
  label:   string
  onPrev:  () => void
  onNext:  () => void
  onToday: () => void
}

export function PeriodStepper({ label, onPrev, onNext, onToday }: PeriodStepperProps) {
  return (
    <nav className={styles.root} aria-label="Navigazione periodo">
      <button
        type="button"
        className={styles.arrow}
        onClick={onPrev}
        aria-label="Mese precedente"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M10 12L6 8L10 4" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>

      <button
        type="button"
        className={styles.today}
        onClick={onToday}
        aria-label="Vai a oggi"
      >
        {label}
      </button>

      <button
        type="button"
        className={styles.arrow}
        onClick={onNext}
        aria-label="Mese successivo"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
          <path d="M6 4L10 8L6 12" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
      </button>
    </nav>
  )
}
