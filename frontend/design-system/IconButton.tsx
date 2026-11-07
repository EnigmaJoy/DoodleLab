'use client'

import type { ReactNode } from 'react'
import styles from './IconButton.module.css'

interface IconButtonProps {
  label:   string
  icon:    ReactNode
  onClick: () => void
}

export function IconButton({ label, icon, onClick }: IconButtonProps) {
  return (
    <button
      type="button"
      className={styles.root}
      onClick={onClick}
      aria-label={label}
    >
      {icon}
    </button>
  )
}
