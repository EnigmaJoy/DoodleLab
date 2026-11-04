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
  firstItemRef:         RefObject<HTMLAnchorElement | null>
  firstFallbackItemRef: RefObject<HTMLAnchorElement | null>
  centerButtonRef:      RefObject<HTMLButtonElement | null>
}

export function RadialMenu({
  visible,
  isOpen,
  onOpen,
  onClose,
  firstItemRef,
  firstFallbackItemRef,
  centerButtonRef,
}: RadialMenuProps) {
  // Escape closes the menu only when isOpen is true.
  // If the event originated inside .palette-switcher the PaletteSwitcher
  // handles it independently — the radial menu must not also close.
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
        '--bg-from': 'var(--gradient-start, #581c87)',
        '--bg-to':   'var(--gradient-end,   #be123c)',
        '--glow-1':  'var(--gradient-start, #581c87)',
        '--glow-2':  'var(--gradient-end,   #be123c)',
        '--glow-3':  'color-mix(in srgb, var(--gradient-start) 60%, var(--gradient-end))',
      } as CSSProperties}
    >
      {/* Decorative glows */}
      <div className={`${styles.glow} ${styles.glow1}`} aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow2}`} aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow3}`} aria-hidden="true" />

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
                aria-label={item.label}
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
        {/* Hamburger bars animate to X via CSS targeting aria-expanded="true" */}
        <span className={styles.bars} aria-hidden="true">
          <span className={`${styles.bar} ${styles.barTop}`}    />
          <span className={`${styles.bar} ${styles.barMid}`}    />
          <span className={`${styles.bar} ${styles.barBottom}`} />
        </span>
      </button>
    </nav>
  )
}
