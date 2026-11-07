// components/Settings.tsx
'use client'

import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { usePreferences } from '@/lib/PreferencesContext'
import { PALETTES } from '@/lib/palettes'
import { AppHeader } from '@/design-system/AppHeader'
import styles from './Settings.module.css'

export function Settings() {
  const { data: session } = useSession()
  const {
    preferences,
    setPaletteId,
    setVisualEffects,
    setAutoLockMinutes,
  } = usePreferences()

  const email           = session?.user?.email ?? ''
  const initials        = email.slice(0, 2).toUpperCase()
  const selectedPalette = PALETTES.find(p => p.id === preferences.paletteId)

  return (
    <div
      className={styles.root}
    >
      {/* Decorative glows */}
      <div className={`${styles.glow} ${styles.glow1}`} data-glow aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow2}`} data-glow aria-hidden="true" />
      <div className={`${styles.glow} ${styles.glow3}`} data-glow aria-hidden="true" />

      <AppHeader
        returnVariant="back"
        title="Impostazioni"
      />

      {/* Cards row */}
      <div className={styles.cardsRow}>

        {/* Left card: Aspetto */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Aspetto</p>

          {/* Palette grid */}
          <div role="radiogroup" aria-label="Palette colore" className={styles.paletteGrid}>
            {PALETTES.map(palette => (
              <button
                key={palette.id}
                role="radio"
                aria-checked={preferences.paletteId === palette.id}
                aria-label={palette.label}
                title={palette.label}
                className={styles.paletteTile}
                style={{ background: `linear-gradient(135deg, ${palette.from}, ${palette.to})` }}
                onClick={() => setPaletteId(palette.id)}
              />
            ))}
          </div>
          <p className={styles.paletteSelectedName}>
            Palette selezionata: <strong>{selectedPalette?.label ?? '—'}</strong>
          </p>

          {/* Effetti visivi toggle */}
          <div className={styles.toggleRow}>
            <span className={styles.toggleLabel}>Effetti visivi</span>
            <button
              role="switch"
              aria-checked={preferences.visualEffects}
              aria-label="Effetti visivi"
              className={styles.toggle}
              onClick={() => setVisualEffects(!preferences.visualEffects)}
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>

          {/* Tema scuro toggle (stub) */}
          <div className={styles.toggleRow}>
            <div>
              <div className={styles.toggleLabel}>Tema scuro</div>
              <div className={styles.toggleSubLabel}>(prossimamente)</div>
            </div>
            <button
              role="switch"
              aria-checked={false}
              aria-label="Tema scuro"
              className={styles.toggle}
              disabled
            >
              <span className={styles.toggleThumb} />
            </button>
          </div>
        </div>

        {/* Right card: Generali */}
        <div className={styles.card}>
          <p className={styles.cardTitle}>Generali</p>

          {/* Auto-lock segmented control */}
          <p className={styles.segmentLabel}>Blocco automatico</p>
          <div role="radiogroup" aria-label="Blocco automatico" className={styles.segmentedControl}>
            {([1, 5, 30, null] as const).map(minutes => {
              const label    = minutes === null ? 'Mai' : `${minutes} min`
              const isActive = preferences.autoLockMinutes === minutes
              return (
                <button
                  key={label}
                  role="radio"
                  aria-checked={isActive}
                  aria-label={label}
                  className={styles.segment}
                  onClick={() => setAutoLockMinutes(minutes)}
                >
                  {label}
                </button>
              )
            })}
          </div>

          {/* Account row */}
          <hr className={styles.accountDivider} />
          <div className={styles.accountRow}>
            <div className={styles.avatar} aria-hidden="true">{initials}</div>
            <span className={styles.accountEmail}>{email}</span>
            <span className={styles.accountChevron} aria-hidden="true">›</span>
          </div>

          {/* Privacy link
          <Link href="/privacy" className={styles.privacyLink}>
            Informativa sulla privacy
          </Link>*/}
        </div>

      </div>
    </div>
  )
}
