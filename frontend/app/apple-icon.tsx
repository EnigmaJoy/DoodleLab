import { ImageResponse } from 'next/og'

export const size        = { width: 180, height: 180 }
export const contentType = 'image/png'

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width:          180,
          height:         180,
          borderRadius:   34,
          background:     'linear-gradient(135deg, #1E3A8A 0%, #6D28D9 100%)',
          display:        'flex',
          alignItems:     'center',
          justifyContent: 'center',
          overflow:       'hidden',
          position:       'relative',
        }}
      >
        {/* Light sheen overlay */}
        <div
          style={{
            position:   'absolute',
            inset:      0,
            background: 'linear-gradient(120deg, transparent 0%, rgba(255,255,255,0.18) 35%, rgba(255,255,255,0.06) 50%, transparent 100%)',
          }}
        />
        <span
          style={{
            fontFamily: 'serif',
            fontSize:   108,
            fontWeight: 700,
            color:      '#f5ede0',
            lineHeight: 1,
            marginTop:  8,
          }}
        >
          Æ
        </span>
      </div>
    ),
    { ...size },
  )
}
