// lib/oggi/timeline.ts
// Projects shared entities onto the daily timeline. Entries keep a reference
// to their source entity (same id) - nothing is copied or re-created.

import type { CalendarItem } from '../calendar-mock'
import { parseTime } from '../day'
import type { TimeBlock } from './types'

export type TimelineKind = 'event' | 'reminder' | 'postit' | 'block'

interface BaseEntry {
  key:   string          // unique across kinds: `${kind}:${id}`
  kind:  TimelineKind
  title: string
  start: number          // minutes since midnight
  /** Layout end. When hasEnd is false this is only a visual minimum. */
  end:    number
  hasEnd: boolean
}

export interface CalendarTimelineEntry extends BaseEntry {
  kind:   'event' | 'reminder' | 'postit'
  source: CalendarItem
}

export interface BlockTimelineEntry extends BaseEntry {
  kind:   'block'
  source: TimeBlock
}

export type TimelineEntry = CalendarTimelineEntry | BlockTimelineEntry

// Visual minimum heights for items without an explicit end
const VISUAL_MINUTES: Record<CalendarItem['kind'], number> = {
  event:    30,
  reminder: 30,
  postit:   45,
}

export interface DayTimeline {
  timed:   TimelineEntry[]
  /** Date-linked items without a usable time; shown outside the hour grid */
  untimed: CalendarItem[]
}

export function buildTimeline(items: readonly CalendarItem[], blocks: readonly TimeBlock[]): DayTimeline {
  const timed: TimelineEntry[] = []
  const untimed: CalendarItem[] = []

  for (const item of items) {
    const start = item.time ? parseTime(item.time) : null
    if (start === null) {
      untimed.push(item)
      continue
    }
    const explicitEnd = item.detail?.timeEnd ? parseTime(item.detail.timeEnd) : null
    const hasEnd = explicitEnd !== null && explicitEnd > start
    timed.push({
      key:    `${item.kind}:${item.id}`,
      kind:   item.kind,
      title:  item.title,
      start,
      end:    hasEnd ? explicitEnd! : start + VISUAL_MINUTES[item.kind],
      hasEnd,
      source: item,
    })
  }

  for (const block of blocks) {
    timed.push({
      key:    `block:${block.id}`,
      kind:   'block',
      title:  block.title,
      start:  block.start,
      end:    block.start + block.duration,
      hasEnd: true,
      source: block,
    })
  }

  timed.sort((a, b) => a.start - b.start || b.end - a.end || a.key.localeCompare(b.key))
  return { timed, untimed }
}

export interface LanePlacement {
  lane:  number
  lanes: number
}

/**
 * Assigns side-by-side lanes to overlapping entries. Entries in the same
 * overlap cluster share a lane count so their widths line up.
 */
export function layoutLanes(entries: readonly TimelineEntry[]): Map<string, LanePlacement> {
  const sorted = [...entries].sort((a, b) => a.start - b.start || b.end - a.end)
  const result = new Map<string, LanePlacement>()

  let cluster: Array<{ key: string; lane: number }> = []
  let laneEnds: number[] = []
  let clusterEnd = -1

  const flush = () => {
    for (const { key, lane } of cluster) result.set(key, { lane, lanes: laneEnds.length })
    cluster = []
    laneEnds = []
  }

  for (const entry of sorted) {
    if (entry.start >= clusterEnd) flush()
    let lane = laneEnds.findIndex(end => end <= entry.start)
    if (lane === -1) {
      lane = laneEnds.length
      laneEnds.push(entry.end)
    } else {
      laneEnds[lane] = entry.end
    }
    cluster.push({ key: entry.key, lane })
    clusterEnd = Math.max(clusterEnd, entry.end)
  }
  flush()
  return result
}
