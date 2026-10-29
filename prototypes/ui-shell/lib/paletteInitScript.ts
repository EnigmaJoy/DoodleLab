// lib/paletteInitScript.ts
// Builds the pre-paint palette restore script (plain ES5). Everything is derived from
// lib/palettes.ts, so the script cannot diverge from the palette list.
import { DEFAULT_PALETTE_ID, PALETTES, PALETTE_STORAGE_KEY } from '@/lib/palettes'

export function buildPaletteInitScript(): string {
  const ids = JSON.stringify(PALETTES.map(p => p.id))
  const key = JSON.stringify(PALETTE_STORAGE_KEY)
  const def = JSON.stringify(DEFAULT_PALETTE_ID)
  return (
    '(function(){try{' +
    'var ids=' + ids + ';' +
    'var d=' + def + ';' +
    'var v=localStorage.getItem(' + key + ');' +
    'if(v&&ids.indexOf(v)!==-1&&v!==d){document.documentElement.setAttribute("data-palette",v);}' +
    '}catch(e){}})();'
  )
}
