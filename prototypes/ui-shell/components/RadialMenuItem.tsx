// components/RadialMenuItem.tsx
import { forwardRef, type CSSProperties } from 'react'
import Link from 'next/link'
import { ITEM_STAGGER_MS } from '@/lib/constants'
import type { MENU_ITEMS } from '@/lib/constants'

type MenuItem = (typeof MENU_ITEMS)[number]

interface RadialMenuItemProps {
  item:   MenuItem
  index:  number
  isOpen: boolean
}

export const RadialMenuItem = forwardRef<HTMLAnchorElement, RadialMenuItemProps>(
  function RadialMenuItem({ item, index, isOpen }, ref) {
    return (
      <Link
        href={`/${item.id}`}
        ref={ref}
        className="radial-item"
        data-id={item.id}
        data-open={isOpen || undefined}
        style={{
          '--tx-unit': item.txUnit,
          '--ty-unit': item.tyUnit,
          '--stagger': `${index * ITEM_STAGGER_MS}ms`,
        } as CSSProperties}
        aria-label={item.label}
      >
        <span className="item-circle">
          <ItemIcon id={item.id} />
        </span>
        <span className="item-label" aria-hidden="true">
          {item.label}
        </span>
      </Link>
    )
  },
)

// Provisional icon shapes - to be replaced with final SVGs during visual review.
function ItemIcon({ id }: { id: string }) {
  switch (id) {
    case 'oggi':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"
             aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2"    x2="12" y2="5"    stroke="currentColor" strokeWidth="2" />
          <line x1="12" y1="19"   x2="12" y2="22"   stroke="currentColor" strokeWidth="2" />
          <line x1="2"  y1="12"   x2="5"  y2="12"   stroke="currentColor" strokeWidth="2" />
          <line x1="19" y1="12"   x2="22" y2="12"   stroke="currentColor" strokeWidth="2" />
          <line x1="4.93"  y1="4.93"  x2="7.05"  y2="7.05"  stroke="currentColor" strokeWidth="2" />
          <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" stroke="currentColor" strokeWidth="2" />
          <line x1="4.93"  y1="19.07" x2="7.05"  y2="16.95" stroke="currentColor" strokeWidth="2" />
          <line x1="16.95" y1="7.05"  x2="19.07" y2="4.93"  stroke="currentColor" strokeWidth="2" />
        </svg>
      )
    case 'calendario':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="3"  y1="9"  x2="21" y2="9" />
          <line x1="8"  y1="2"  x2="8"  y2="6" />
          <line x1="16" y1="2"  x2="16" y2="6" />
          <rect x="7" y="13" width="3" height="3" fill="currentColor" />
        </svg>
      )
    case 'lavagna':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
          <rect x="3"  y="3"  width="8" height="8" rx="1" />
          <rect x="13" y="3"  width="8" height="8" rx="1" />
          <rect x="3"  y="13" width="8" height="8" rx="1" />
          <rect x="13" y="13" width="8" height="8" rx="1" />
        </svg>
      )
    case 'inbox':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
          <path d="M3 12h4l2 3h6l2-3h4" />
          <rect x="3" y="12" width="18" height="9" rx="1" />
          <line x1="12" y1="3" x2="12" y2="9" />
          <polyline points="9,6 12,9 15,6" />
        </svg>
      )
    case 'quaderno':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="12" y1="6" x2="12" y2="18" />
        </svg>
      )
    case 'esercizi':
      return (
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" strokeWidth="1.5" aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="11" />
        </svg>
      )
    default:
      return (
        <svg width="24" height="24" viewBox="0 0 24 24"
             aria-hidden="true" focusable="false">
          <circle cx="12" cy="12" r="6" fill="currentColor" />
        </svg>
      )
  }
}
