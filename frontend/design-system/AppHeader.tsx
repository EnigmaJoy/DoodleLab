// design-system/AppHeader.tsx
'use client'

import { useRef, useState, useEffect, type RefObject } from 'react'
import { useRouter } from 'next/navigation'
import { SegmentedControl } from './SegmentedControl'
import { PeriodStepper }    from './PeriodStepper'
import { IconButton }       from './IconButton'
import styles from './AppHeader.module.css'

// ── Types ────────────────────────────────────────────────────────────────────

type ReturnVariant = 'menu' | 'back'

interface SegmentedControlConfig {
  kind:     'segmented'
  options:  { value: string; label: string }[]
  value:    string
  onChange: (value: string) => void
}

interface PeriodStepperConfig {
  kind:    'stepper'
  label:   string
  onPrev:  () => void
  onNext:  () => void
  onToday: () => void
}

type ViewControl = SegmentedControlConfig | PeriodStepperConfig

type ActionItem =
  | { kind: 'icon';      label: string; icon: React.ReactNode; onClick: () => void }
  | { kind: 'secondary'; label: string; onClick: () => void }
  | { kind: 'primary';   label: string; onClick: () => void }

export interface AppHeaderProps {
  returnVariant:  ReturnVariant
  onMenuOpen?:    () => void
  title:          string
  meta?:          string
  subtitle?:      string
  viewControl?:   ViewControl
  actions?:       ActionItem[]
  titleLive?:     boolean
  subtitleLive?:  boolean
}

// ── Scroll hook ──────────────────────────────────────────────────────────────

function useScrolled(sentinelRef: RefObject<HTMLDivElement | null>): boolean {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const el = sentinelRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    const io = new IntersectionObserver(([e]) => setScrolled(!e.isIntersecting))
    io.observe(el)
    return () => io.disconnect()
  }, [sentinelRef])
  return scrolled
}

// ── Component ────────────────────────────────────────────────────────────────

export function AppHeader({
  returnVariant,
  onMenuOpen,
  title,
  meta,
  subtitle,
  viewControl,
  actions,
  titleLive,
  subtitleLive,
}: AppHeaderProps) {
  const router      = useRouter()
  const sentinelRef = useRef<HTMLDivElement>(null)
  const scrolled    = useScrolled(sentinelRef)

  return (
    <>
      <header
        className={styles.root}
        data-scrolled={scrolled || undefined}
      >
        {/* Slot A — Return */}
        <button
          type="button"
          className={styles.returnBtn}
          onClick={returnVariant === 'menu' ? onMenuOpen : () => router.back()}
          aria-label={returnVariant === 'menu' ? 'Apri menu' : 'Indietro'}
        >
          <svg
            width="18"
            height="18"
            viewBox="0 0 18 18"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M11 14L6 9L11 4"
              stroke="currentColor"
              strokeWidth="1.6"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
          <span className={styles.returnLabel}>
            {returnVariant === 'menu' ? 'Menu' : 'Indietro'}
          </span>
        </button>

        {/* Slot B — Title */}
        <div className={styles.titleBlock}>
          {meta && <p className={styles.meta}>{meta}</p>}
          <h1
            className={styles.title}
            aria-live={titleLive ? 'polite' : undefined}
            aria-atomic={titleLive ? 'true' : undefined}
          >
            {title}
          </h1>
          {subtitle && (
            <p
              className={styles.subtitle}
              aria-live={subtitleLive ? 'polite' : undefined}
              aria-atomic={subtitleLive ? 'true' : undefined}
            >
              {subtitle}
            </p>
          )}
        </div>

        {/* Slot C — View control */}
        {viewControl && (
          <div className={styles.viewControl}>
            {viewControl.kind === 'segmented' ? (
              <SegmentedControl
                options={viewControl.options}
                value={viewControl.value}
                onChange={viewControl.onChange}
              />
            ) : (
              <PeriodStepper
                label={viewControl.label}
                onPrev={viewControl.onPrev}
                onNext={viewControl.onNext}
                onToday={viewControl.onToday}
              />
            )}
          </div>
        )}

        {/* Slot D — Actions */}
        {actions && actions.length > 0 && (
          <div className={styles.actions}>
            {actions.map(action => {
              if (action.kind === 'icon') {
                return (
                  <IconButton
                    key={action.label}
                    label={action.label}
                    icon={action.icon}
                    onClick={action.onClick}
                  />
                )
              }
              return (
                <button
                  key={action.label}
                  type="button"
                  className={
                    action.kind === 'primary' ? styles.primaryBtn : styles.secondaryBtn
                  }
                  onClick={action.onClick}
                >
                  {action.label}
                </button>
              )
            })}
          </div>
        )}
      </header>

      {/* Sentinel for scroll detection — 1px div right after the sticky header */}
      <div ref={sentinelRef} className={styles.sentinel} aria-hidden="true" />
    </>
  )
}
