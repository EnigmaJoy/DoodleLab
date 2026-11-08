// components/today/EntryContent.tsx
import { formatTime } from '@/lib/day'
import { type BlockTimelineEntry, type TimelineEntry } from '@/lib/today/timeline'
import { BellIcon, CalendarIcon, NoteIcon } from './icons'

export function rangeLabel(entry: TimelineEntry): string {
  return entry.hasEnd ? `${formatTime(entry.start)} - ${formatTime(entry.end)}` : formatTime(entry.start)
}

export function EntryContent({ entry }: { entry: Exclude<TimelineEntry, BlockTimelineEntry> }) {
  const range = rangeLabel(entry)
  switch (entry.kind) {
    case 'event':
      // Without an end the entry is only 30 minutes tall: keep it on one line
      if (!entry.hasEnd) {
        return (
          <span className="today-entry-title">
            <CalendarIcon size={13} /> {entry.title} <span className="today-entry-inline-time">{range}</span>
          </span>
        )
      }
      return (
        <>
          <span className="today-entry-title"><CalendarIcon size={13} /> {entry.title}</span>
          <span className="today-entry-meta">
            {[range, entry.source.detail?.location].filter(Boolean).join(' · ')}
          </span>
        </>
      )
    case 'reminder':
      return (
        <span className="today-entry-title">
          <BellIcon size={13} /> Promemoria {range} · {entry.title}
        </span>
      )
    case 'note':
      return (
        <>
          <span className="today-entry-hand">{entry.title}</span>
          <span className="today-entry-tag">
            <NoteIcon size={11} /> {range} · PostIt{entry.source.detail?.alsoOn ? ` · anche su ${entry.source.detail.alsoOn}` : ''}
          </span>
        </>
      )
  }
}
