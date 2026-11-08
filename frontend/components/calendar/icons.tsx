// components/calendar/icons.tsx

interface LayersIconProps {
  size?:  number
  color?: string
}
export function LayersIcon({ size = 16, color = 'currentColor' }: LayersIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <rect x="2" y="7" width="12" height="6" rx="1.5" stroke={color} strokeWidth="1.5" fill="none"/>
      <rect x="2" y="3" width="12" height="6" rx="1.5" stroke={color} strokeWidth="1.5" fill="none" opacity="0.5"/>
    </svg>
  )
}

interface GridIconProps { size?: number }
export function GridIcon({ size = 18 }: GridIconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 18 18" fill="none" aria-hidden="true" focusable="false">
      <rect x="2"  y="2"  width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7"/>
      <rect x="10" y="2"  width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7"/>
      <rect x="2"  y="10" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7"/>
      <rect x="10" y="10" width="6" height="6" rx="1.5" fill="currentColor" opacity="0.7"/>
    </svg>
  )
}

export function CloseIcon({ size = 16 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 16 16" fill="none" aria-hidden="true" focusable="false">
      <path d="M3 3L13 13M13 3L3 13" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}
