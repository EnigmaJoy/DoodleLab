// components/RadialMenuItem.tsx
import { forwardRef, type CSSProperties } from 'react'
import Link from 'next/link'
import { OPEN_STAGGER_MS, CLOSE_STAGGER_MS, MENU_ITEMS } from '@/lib/constants'
import styles from './RadialMenu.module.css'

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
        className={styles.item}
        data-id={item.id}
        data-open={isOpen || undefined}
        style={{
          '--angle':         `${item.angle - 90}deg`,
          '--stagger':       `${index * OPEN_STAGGER_MS}ms`,
          '--stagger-close': `${(MENU_ITEMS.length - 1 - index) * CLOSE_STAGGER_MS}ms`,
        } as CSSProperties}
        aria-label={item.label}
      >
        <span className={styles.itemIcon} aria-hidden="true">
          <ItemIcon id={item.id} />
        </span>
      </Link>
    )
  },
)

/** Stroke-only icons, strokeWidth 1.35. Exported for use in the fallback list. */
export function ItemIcon({ id }: { id: string }) {
  const common = {
    width: 20, height: 20,
    viewBox: '0 0 24 24',
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 1.35,
    strokeLinecap: 'round' as const,
    strokeLinejoin: 'round' as const,
    'aria-hidden': true,
    focusable: false,
  }
  switch (id) {
    case 'today':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="4" />
          <line x1="12" y1="2"  x2="12" y2="5" />
          <line x1="12" y1="19" x2="12" y2="22" />
          <line x1="2"  y1="12" x2="5"  y2="12" />
          <line x1="19" y1="12" x2="22" y2="12" />
          <line x1="4.93"  y1="4.93"  x2="7.05"  y2="7.05" />
          <line x1="16.95" y1="16.95" x2="19.07" y2="19.07" />
          <line x1="4.93"  y1="19.07" x2="7.05"  y2="16.95" />
          <line x1="16.95" y1="7.05"  x2="19.07" y2="4.93" />
        </svg>
      )
    case 'calendar':
      return (
        <svg {...common}>
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <line x1="3"  y1="9"  x2="21" y2="9" />
          <line x1="8"  y1="2"  x2="8"  y2="6" />
          <line x1="16" y1="2"  x2="16" y2="6" />
          <line x1="8.5" y1="13.5" x2="8.5" y2="13.5" strokeWidth={2} />
        </svg>
      )
    case 'board':
      return (
        <svg {...common}>
          <rect x="3"  y="3"  width="8" height="8" rx="1" />
          <rect x="13" y="3"  width="8" height="8" rx="1" />
          <rect x="3"  y="13" width="8" height="8" rx="1" />
          <rect x="13" y="13" width="8" height="8" rx="1" />
        </svg>
      )
    case 'inbox':
      return (
        <svg {...common}>
          <path d="M3 12h4l2 3h6l2-3h4" />
          <rect x="3" y="12" width="18" height="9" rx="1" />
          <line x1="12" y1="3" x2="12" y2="9" />
          <polyline points="9,6 12,9 15,6" />
        </svg>
      )
    case 'notebook':
      return (
        <svg {...common}>
          <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
          <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
          <line x1="12" y1="6" x2="12" y2="18" />
        </svg>
      )
    case 'exercises':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="3" />
          <circle cx="12" cy="12" r="7" />
          <circle cx="12" cy="12" r="11" />
        </svg>
      )
    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="6" />
        </svg>
      )
  }
}
