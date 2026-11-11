'use client'

import styles from './SegmentedControl.module.css'

interface Option {
  value: string
  label: string
}

interface SegmentedControlProps {
  options:   Option[]
  value:     string
  onChange:  (value: string) => void
  label?:    string
  variant?:  'solid-active'
  disabled?: boolean
}

export function SegmentedControl({ options, value, onChange, label, variant, disabled }: SegmentedControlProps) {
  return (
    <div
      className={styles.root}
      role="radiogroup"
      aria-label={label}
    >
      {options.map(opt => {
        const isActive = opt.value === value
        const cls = [
          styles.segment,
          isActive && variant === 'solid-active' ? styles.solidActive : '',
        ].filter(Boolean).join(' ')
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={isActive}
            className={cls}
            data-active={isActive || undefined}
            disabled={disabled}
            onClick={() => onChange(opt.value)}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
