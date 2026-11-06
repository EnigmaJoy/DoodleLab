// components/RadialMenu.tsx
'use client'

import { useEffect, type RefObject, type CSSProperties } from 'react'
import Link from 'next/link'
import { MENU_ITEMS } from '@/lib/constants'
import { RadialMenuItem, ItemIcon } from './RadialMenuItem'
import styles from './RadialMenu.module.css'

interface RadialMenuProps {
  visible:              boolean
  isOpen:               boolean
  onOpen:               () => void
  onClose:              () => void
  onExitRequest:        () => void
  firstItemRef:         RefObject<HTMLAnchorElement | null>
  firstFallbackItemRef: RefObject<HTMLAnchorElement | null>
  centerButtonRef:      RefObject<HTMLButtonElement | null>
}

export function RadialMenu({
  visible,
  isOpen,
  onOpen,
  onClose,
  onExitRequest,
  firstItemRef,
  firstFallbackItemRef,
  centerButtonRef,
}: RadialMenuProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape' && isOpen) {
        const switcher = document.querySelector('.palette-switcher')
        if (switcher?.contains(e.target as Node)) return
        onClose()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen, onClose])

  return (
    <nav
      className={`screen ${styles.root}`}
      aria-label="Navigazione principale"
      data-hidden={!visible || undefined}
      inert={!visible || undefined}
      aria-hidden={!visible || undefined}
      style={{
        '--bg-from': 'var(--gradient-start, #1E3A8A)',
        '--bg-to':   'var(--gradient-end,   #6D28D9)',
      } as CSSProperties}
    >
      {/* Decorative glows */}
      <div className={`${styles.glow} ${styles.glow1}`} data-glow aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow2}`} data-glow aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow3}`} data-glow aria-hidden="true" />

      {/* Items — inert when closed so Tab only reaches the center button */}
      <div
        className={styles.items}
        id="radial-items"
        inert={!isOpen || undefined}
      >
        {/* Radial layout: visible above 500 px */}
        <div className={styles.radialLayout}>
          {MENU_ITEMS.map((item, index) => (
            <RadialMenuItem
              key={item.id}
              item={item}
              index={index}
              isOpen={isOpen}
              ref={index === 0 ? firstItemRef : undefined}
            />
          ))}
        </div>

        {/* Linear fallback: visible below 500 px */}
        <ul className={styles.fallback} aria-label="Navigazione - lista">
          {MENU_ITEMS.map((item, index) => (
            <li key={item.id} className={styles.fallbackItem}>
              <Link
                href={`/${item.id}`}
                ref={index === 0 ? firstFallbackItemRef : undefined}
              >
                <span aria-hidden="true"><ItemIcon id={item.id} /></span>
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      {/* Center toggle button */}
      <button
        ref={centerButtonRef}
        className={styles.center}
        type="button"
        onClick={isOpen ? onClose : onOpen}
        aria-expanded={isOpen}
        aria-controls="radial-items"
        aria-label={isOpen ? 'Chiudi menu' : 'Apri menu'}
      >
        <span className={styles.bars} aria-hidden="true">
          <span className={`${styles.bar} ${styles.barTop}`}    />
          <span className={`${styles.bar} ${styles.barMid}`}    />
          <span className={`${styles.bar} ${styles.barBottom}`} />
        </span>
      </button>

      {/* Satellite row — visible only when menu is open */}
      {isOpen && (
        <div className={styles.satelliteRow}>
          <Link href="/settings" className={styles.satellite} aria-label="Impostazioni">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
          <button
            type="button"
            className={styles.satellite}
            onClick={onExitRequest}
            aria-label="Esci"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.35" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
          </button>
        </div>
      )}
    </nav>
  )
}
