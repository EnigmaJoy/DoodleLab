// components/oggi/icons.tsx
// Line icons for Oggi, matching the stroke style of the radial menu icons.

interface IconProps { size?: number }

function Svg({ size = 18, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" focusable="false">
      {children}
    </svg>
  )
}

export const MenuIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 7h16M4 12h16M4 17h16" /></Svg>
)
export const CalendarIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3.5" y="5" width="17" height="15.5" rx="2" /><path d="M3.5 10h17M8 3v4M16 3v4" /></Svg>
)
export const StarIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" fill="currentColor" /></Svg>
)
export const PencilIcon = (p: IconProps) => (
  <Svg {...p}><path d="M15.5 4.5l4 4L8 20H4v-4z" /><path d="M13.5 6.5l4 4" /></Svg>
)
export const PlusIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
)
export const ChevronIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 9l6 6 6-6" /></Svg>
)
export const BoltIcon = (p: IconProps) => (
  <Svg {...p}><path d="M13 3L5 13.5h6L10 21l8-10.5h-6z" /></Svg>
)
export const SmileIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M8.5 14.5c1.8 2 5.2 2 7 0M9 10h.01M15 10h.01" /></Svg>
)
export const HourglassIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 3h12M6 21h12M7 3c0 5 10 5 10 9s-10 4-10 9M17 3c0 5-10 5-10 9s10 4 10 9" /></Svg>
)
export const FeatherIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4 20L14 10M20 4c-6 0-12 4-12 12h4c6 0 8-6 8-12z" /></Svg>
)
export const BellIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15zM10 20.5a2 2 0 0 0 4 0" /></Svg>
)
export const NoteIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5 4h14v11l-5 5H5z" /><path d="M14 20v-5h5" /></Svg>
)
export const GripIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="9" cy="6" r="1" fill="currentColor" /><circle cx="15" cy="6" r="1" fill="currentColor" />
    <circle cx="9" cy="12" r="1" fill="currentColor" /><circle cx="15" cy="12" r="1" fill="currentColor" />
    <circle cx="9" cy="18" r="1" fill="currentColor" /><circle cx="15" cy="18" r="1" fill="currentColor" />
  </Svg>
)
export const MoonIcon = (p: IconProps) => (
  <Svg {...p}><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5z" /></Svg>
)
export const SendIcon = (p: IconProps) => (
  <Svg {...p}><path d="M5 12h13M13 6l6 6-6 6" /></Svg>
)
export const CloseIcon = (p: IconProps) => (
  <Svg {...p}><path d="M6 6l12 12M18 6L6 18" /></Svg>
)
export const MoreIcon = (p: IconProps) => (
  <Svg {...p}>
    <circle cx="6" cy="12" r="1.2" fill="currentColor" /><circle cx="12" cy="12" r="1.2" fill="currentColor" />
    <circle cx="18" cy="12" r="1.2" fill="currentColor" />
  </Svg>
)
export const StarOutlineIcon = (p: IconProps) => (
  <Svg {...p}><path d="M12 3.5l2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8-4.3-4.1 5.9-.8z" /></Svg>
)
export const TrashIcon = (p: IconProps) => (
  <Svg {...p}><path d="M4.5 7h15M9.5 7V4.5h5V7M6.5 7l1 13h9l1-13M10 11v5.5M14 11v5.5" /></Svg>
)
export const ClockIcon = (p: IconProps) => (
  <Svg {...p}><circle cx="12" cy="12" r="8.5" /><path d="M12 7.5V12l3 2" /></Svg>
)
export const ArchiveIcon = (p: IconProps) => (
  <Svg {...p}><rect x="3.5" y="4.5" width="17" height="4.5" rx="1" /><path d="M5 9v10.5h14V9M10 13h4" /></Svg>
)
