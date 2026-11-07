import { StickerKey } from '@/lib/note-types'
import { STICKER_CONFIG } from '@/lib/note-utils'

interface StickerListProps {
  stickers: StickerKey[]
}

export function StickerList({ stickers }: StickerListProps) {
  if (stickers.length === 0) {
    return null
  }

  return (
    <div className="postit-stickers" aria-hidden="true">
      {stickers.map((key) => (
        <span
          key={key}
          className="postit-sticker"
          style={{ background: STICKER_CONFIG[key].bg }}
        >
          {STICKER_CONFIG[key].emoji}
        </span>
      ))}
    </div>
  )
}
