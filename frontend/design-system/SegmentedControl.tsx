'use client'

import styles from './SegmentedControl.module.css'

interface Option {
  value: string
  label: string
}

interface SegmentedControlProps {
  options:  Option[]
  value:    string
  onChange: (value: string) => void
  label?:   string
}

export function SegmentedControl({ options, value, onChange, label }: SegmentedControlProps) {
  return (
    <div
      className={styles.root}
      role="radiogroup"
      aria-label={label}
    >
      {options.map(opt => (
        <button
          key={opt.value}
          type="button"
          role="radio"
          aria-checked={opt.value === value}
          className={styles.segment}
          data-active={opt.value === value || undefined}
          onClick={() => onChange(opt.value)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
