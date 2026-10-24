// dev/PaletteSwitcher.tsx
'use client'

/*
 * DEVELOPMENT TOOL
 * Controlled by NEXT_PUBLIC_SHOW_PALETTE_SWITCHER environment variable.
 * To remove permanently: delete this file and the conditional in app/layout.tsx.
 * Hide the overlay via "Nascondi overlay" - the active palette remains set.
 * Restore by reloading the page (no persistent storage).
 */

import { useState, useEffect } from 'react'
import { PALETTES, PALETTE_COUNT } from '@/lib/palettes'

export function PaletteSwitcher() {
  const [isVisible, setIsVisible]   = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  // Initialize to 1 so server and client render identically during hydration.
  // useEffect reads the real palette from the DOM after hydration completes.
  const [activePaletteId, setActivePaletteId] = useState<number>(1)

  useEffect(() => {
    const current = parseInt(document.documentElement.dataset.palette ?? '1', 10)
    if (current >= 1 && current <= PALETTE_COUNT) setActivePaletteId(current)
  }, [])

  if (!isVisible) return null

  function selectPalette(id: number) {
    document.documentElement.dataset.palette = String(id)
    setActivePaletteId(id)
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'Escape') {
      setIsExpanded(false)
    }
  }

  return (
    <aside
      role="region"
      aria-label="Strumenti sviluppo - selettore palette"
      className="palette-switcher"
      onKeyDown={handleKeyDown}
    >
      {isExpanded && (
        <div id="palette-switcher-panel" className="palette-switcher-panel">
          {PALETTES.map(palette => (
            <button
              key={palette.id}
              type="button"
              className="palette-switcher-item"
              aria-pressed={activePaletteId === palette.id}
              aria-label={`Palette ${palette.id}: ${palette.label} (provvisorio)`}
              onClick={() => selectPalette(palette.id)}
            >
              {palette.id}. {palette.label}
            </button>
          ))}
          <button
            type="button"
            className="palette-switcher-item"
            onClick={() => setIsVisible(false)}
          >
            Nascondi overlay
          </button>
        </div>
      )}
      <button
        type="button"
        className="palette-switcher-toggle"
        aria-expanded={isExpanded}
        aria-controls="palette-switcher-panel"
        onClick={() => setIsExpanded(prev => !prev)}
      >
        P{activePaletteId}
      </button>
    </aside>
  )
}
