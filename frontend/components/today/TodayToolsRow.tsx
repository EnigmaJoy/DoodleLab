'use client'

import { useEffect, useState } from 'react'
import type { DayKey } from '@/lib/day'
import { EnergyActivities } from './EnergyActivities'
import { CheckIn } from './CheckIn'
import { VisualTimer } from './VisualTimer'
import { DiaryPanel } from './DiaryPanel'
import { BoltIcon, SmileIcon, HourglassIcon, FeatherIcon } from './icons'

type PanelId = 'energy' | 'checkin' | 'timer' | 'diary'

const TOOLS: Array<{ id: PanelId; label: string; Icon: React.FC<{ size?: number }> }> = [
  { id: 'energy',  label: 'Energia',      Icon: BoltIcon },
  { id: 'checkin', label: 'Umore',        Icon: SmileIcon },
  { id: 'timer',   label: 'Timer',        Icon: HourglassIcon },
  { id: 'diary',   label: 'Pensieri',     Icon: FeatherIcon },
]

function CloseIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" focusable="false">
      <path d="M18 6L6 18M6 6l12 12" />
    </svg>
  )
}

export function TodayToolsRow({ day }: { day: DayKey }) {
  const [activePanel, setActivePanel] = useState<PanelId | null>(null)

  // "Inizia 25 minuti" on the focus card dispatches this event to open the timer tray
  useEffect(() => {
    function onOpenPanel(e: Event) {
      const id = (e as CustomEvent<string>).detail as PanelId
      if (TOOLS.some(t => t.id === id)) setActivePanel(id)
    }
    window.addEventListener('today:open-panel', onOpenPanel)
    return () => window.removeEventListener('today:open-panel', onOpenPanel)
  }, [])

  function toggle(id: PanelId) {
    setActivePanel(prev => prev === id ? null : id)
  }

  const closePanel = () => setActivePanel(null)

  return (
    <div className="todayb-tools-section">
      {/* Tray — always render VisualTimer so its state persists even when closed */}
      <div
        className="todayb-tools-tray"
        data-open={activePanel !== null || undefined}
        aria-hidden={activePanel === null}
      >
        <div className="todayb-tools-tray-inner">
          <div style={{ display: activePanel === 'energy' ? 'block' : 'none' }}>
            <EnergyActivities day={day} />
          </div>
          <div style={{ display: activePanel === 'checkin' ? 'block' : 'none' }}>
            <CheckIn day={day} />
          </div>
          {/* VisualTimer always mounted to preserve timer state */}
          <div style={{ display: activePanel === 'timer' ? 'block' : 'none' }}>
            <VisualTimer onClose={closePanel} />
          </div>
          <div style={{ display: activePanel === 'diary' ? 'block' : 'none' }}>
            <DiaryPanel day={day} />
          </div>
        </div>

        {/* Show generic close only for non-timer panels; timer renders its own */}
        {activePanel !== null && activePanel !== 'timer' && (
          <button
            type="button"
            className="todayb-tools-tray-close"
            onClick={closePanel}
            aria-label="Chiudi pannello"
          >
            <CloseIcon />
          </button>
        )}
      </div>

      {/* Tool buttons grid */}
      <div className="todayb-tools-grid" role="group" aria-label="Strumenti">
        {TOOLS.map(({ id, label, Icon }) => (
          <button
            key={id}
            type="button"
            className="todayb-tool-btn"
            aria-pressed={activePanel === id}
            onClick={() => toggle(id)}
          >
            <Icon size={20} />
            <span>{label}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
