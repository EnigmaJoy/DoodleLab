// components/RadialMenu.tsx
'use client'

import { useEffect, type RefObject } from 'react'
import Link from 'next/link'
import { APP_NAME, MENU_ITEMS } from '@/lib/constants'
import { RadialMenuItem } from './RadialMenuItem'

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
  // If the event originated inside .palette-switcher, the PaletteSwitcher
  // handles it independently - the radial menu must not also close.
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
      className="screen radial-menu"
      aria-label="Navigazione principale"
      data-hidden={!visible || undefined}
      inert={!visible || undefined}
      aria-hidden={!visible || undefined}
    >
      <div className="radial-bg" aria-hidden="true" />

      {/* Items container: inert when closed so Tab reaches only the center button.
          Both layouts live here and inherit the inert state.
          CSS toggles which layout is visible. */}
      <div
        className="radial-items"
        id="radial-items"
        inert={!isOpen || undefined}
      >
        {/* Radial layout: visible above the fallback breakpoint (500px provisional) */}
        <div className="radial-items-radial">
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

        {/* Linear fallback: visible below the fallback breakpoint.
            firstFallbackItemRef attached to first link for focus management. */}
        <ul className="radial-items-fallback" aria-label="Navigazione - lista">
          {MENU_ITEMS.map((item, index) => (
            <li key={item.id}>
              <Link
                href={`/${item.id}`}
                aria-label={item.label}
                ref={index === 0 ? firstFallbackItemRef : undefined}
              >
                {item.label}
              </Link>
            </li>
          ))}
        </ul>
      </div>

      <button
        ref={centerButtonRef}
        className="radial-center"
        type="button"
        onClick={isOpen ? onClose : onOpen}
        aria-expanded={isOpen}
        aria-controls="radial-items"
        aria-label={isOpen ? 'Chiudi menu' : 'Apri menu'}
      >
        <span
          className="app-name"
          data-hidden={!isOpen || undefined}
          aria-hidden={!isOpen || undefined}
        >
          {APP_NAME}
        </span>
        <span
          className="compact-icon"
          data-hidden={isOpen || undefined}
          aria-hidden={isOpen || undefined}
        >
          <svg
            width="20" height="20" viewBox="0 0 20 20"
            fill="currentColor" aria-hidden="true" focusable="false"
          >
            <rect x="2" y="4"  width="16" height="2" rx="1" />
            <rect x="2" y="9"  width="16" height="2" rx="1" />
            <rect x="2" y="14" width="16" height="2" rx="1" />
          </svg>
        </span>
      </button>
    </nav>
  )
}
