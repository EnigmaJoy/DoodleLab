// dev/PaletteSwitcher.tsx
'use client'

/*
 * DEVELOPMENT TOOL
 * Controlled by NEXT_PUBLIC_SHOW_PALETTE_SWITCHER environment variable.
 * To remove permanently: delete this file and the conditional in app/layout.tsx.
 * Hide the overlay via "Nascondi overlay" - the active palette remains set.
 * The chosen palette is persisted in localStorage (agenda.palette) and restored on reload.
 */

import { useState, useEffect } from 'react'
import { DEFAULT_PALETTE_ID, PALETTES, type PaletteId } from '@/lib/palettes'
import { applyPalette, readStoredPaletteId } from '@/lib/palettePreference'

export function PaletteSwitcher() {
  const [isVisible, setIsVisible]   = useState(true)
  const [isExpanded, setIsExpanded] = useState(false)
  // Initialize to the default so server and client render identically during hydration.
  // useEffect syncs the stored palette after hydration completes.
  const [activePaletteId, setActivePaletteId] = useState<PaletteId>(DEFAULT_PALETTE_ID)

  useEffect(() => {
    setActivePaletteId(readStoredPaletteId())
  }, [])

  if (!isVisible) return null

  function selectPalette(id: PaletteId) {
    applyPalette(id)
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
              aria-label={`Palette ${palette.name}`}
              onClick={() => selectPalette(palette.id)}
            >
              {palette.name}
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
        {PALETTES.find(p => p.id === activePaletteId)?.name}
      </button>
    </aside>
  )
}
