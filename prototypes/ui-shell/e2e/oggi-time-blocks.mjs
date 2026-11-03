// e2e/oggi-time-blocks.mjs
// Interaction checks for Oggi flexible time blocks in real headless Chrome,
// driven through the DevTools Protocol with mouse, touch and pen input.
//
// Requires a running dev server (pnpm dev) and Google Chrome.
//   BASE_URL=http://localhost:3000 CHROME_PATH=... node --experimental-websocket e2e/oggi-time-blocks.mjs
// These are automated simulations: they do not replace checks on physical
// touch and Apple Pencil devices.

import {
  MIN_PX, consoleErrors, check, done, ev, gesture, key, pointerDown, pointerMove, pointerUp, send, shot, sleep, BASE,
} from './harness.mjs'

// --- Geometry ---------------------------------------------------------------

/** Scrolls the timeline so `minute` is visible; returns viewport y for it */
async function yFor(minute) {
  return ev(`const s = $('.oggi-timeline-scroll'); s.scrollTop = Math.max(0, (${minute} - 90) * ${MIN_PX}); await wait(30);
    return $('.oggi-timeline-grid').getBoundingClientRect().top + ${minute} * ${MIN_PX}`)
}
/** Center point of an element inside the n-th block (or the grid x for empty slots) */
async function pointIn(blockIndex, selector) {
  return ev(`const b = $$('.oggi-entry--block')[${blockIndex}]; b.scrollIntoView({ block: 'center' }); await wait(30);
    const r = (${JSON.stringify(selector)} ? b.querySelector(${JSON.stringify(selector)}) : b).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`)
}
async function emptyX() {
  return ev(`const r = $('.oggi-timeline-grid').getBoundingClientRect(); return r.left + r.width * 0.75`)
}

// --- Scenario -----------------------------------------------------------------

await send('Runtime.enable')
await send('Page.enable')
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Page.navigate', { url: `${BASE}/oggi` })
await sleep(3500)

// Show a day with fixed appointments: the fixture has 09:00 and 16:00 events on 19 October.
// The dev clock offset moves "today" there and Oggi follows (nobody is editing).
await ev(`const target = new Date(2026, 9, 19, 14, 40); window.__oggiDev.setClockOffsetMinutes(Math.round((target - Date.now()) / 60000)); await wait(300)`)
check('timeline shows a day with a fixed appointment', await ev(`return $('.oggi-title-date').textContent.includes('19 ottobre') && $$('.oggi-entry--event').length === 2`))
const appointmentsBefore = await ev(`return $$('.oggi-entry--event').map(e => e.textContent + e.getAttribute('style')).join('|')`)

const X = await emptyX()

// 5. A normal click does not create a block (mouse and pen)
let y = await yFor(11 * 60)
await gesture('mouse', { x: X, y }, 0, { steps: 1 })
await gesture('pen', { x: X, y }, 0, { steps: 1 })
check('normal click/tap on empty area creates nothing', await ev(`return $$('.oggi-entry--block').length === 0`))

// 20. Touch scroll gesture does not create a block
await gesture('touch', { x: X, y: y + 100 }, -120, { steps: 6 })
await sleep(700)
check('touch swipe (scroll) creates nothing', await ev(`return $$('.oggi-entry--block').length === 0`))

// 1, 3, 4, 6. Long press (mouse) on an empty slot creates a 60-min block, snapped
y = await yFor(11 * 60 + 7) // 11:07 -> snaps to 11:00
await gesture('mouse', { x: X, y }, 0, { hold: 700, steps: 1 })
let list = await ev(`return blocks()`)
check('mouse long press creates default block snapped to 15 min', list.length === 1 && list[0] === '11:00 - 12:00 Blocco di concentrazione', JSON.stringify(list))
check('long press release does not open the menu', await ev(`return !$('dialog[open]')`))

// 7, 21. Touch: long press on the block then drag it down 45 min
let p = await pointIn(0, '.oggi-entry-body')
await pointerDown('touch', p.x, p.y)
await sleep(700)
check('touch long press activates the block (elevated state)', await ev(`return !!$('.oggi-entry--block[data-active]')`))
for (let i = 1; i <= 9; i++) { await pointerMove('touch', p.x, p.y + (45 * MIN_PX * i) / 9); await sleep(16) }
await shot('time-block-1-dragging')
check('live time label shows proposal while dragging', await ev(`return $('.oggi-live-time')?.textContent === '11:45 - 12:45'`))
await pointerUp('touch', p.x, p.y + 45 * MIN_PX)
await sleep(200)
list = await ev(`return blocks()`)
check('touch drag moves the stored block, duration kept', list[0]?.startsWith('11:45 - 12:45'), JSON.stringify(list))

// 21. Pen: the grip drags immediately
p = await pointIn(0, '[data-grip]')
await gesture('pen', p, -30 * MIN_PX)
list = await ev(`return blocks()`)
check('pen drag on the grip moves the block', list[0]?.startsWith('11:15 - 12:15'), JSON.stringify(list))

// 9. Top handle resize (mouse): start earlier, end kept
p = await pointIn(0, '.oggi-resize--start')
await gesture('mouse', { x: p.x, y: p.y - 3 }, -30 * MIN_PX)
list = await ev(`return blocks()`)
check('top handle resize keeps the end', list[0]?.startsWith('10:45 - 12:15'), JSON.stringify(list))

// 10. Bottom handle resize (touch): end later, start kept
p = await pointIn(0, '.oggi-resize--end')
await gesture('touch', { x: p.x, y: p.y + 3 }, 45 * MIN_PX)
list = await ev(`return blocks()`)
check('bottom handle resize keeps the start', list[0]?.startsWith('10:45 - 13:00'), JSON.stringify(list))

// 11. Minimum duration: dragging the bottom handle above the start is refused
p = await pointIn(0, '.oggi-resize--end')
await gesture('mouse', { x: p.x, y: p.y + 3 }, -200 * MIN_PX, { release: false })
check('resize to zero/negative duration shows calm feedback', await ev(`return !!$('.oggi-entry--block[data-invalid]') && $('.oggi-block-feedback').textContent.includes('durata minima')`))
await pointerUp('mouse', p.x, p.y - 200 * MIN_PX)
await sleep(150)
list = await ev(`return blocks()`)
check('invalid resize keeps last valid duration (>= 15 min)', /^10:45 - 1[01]:(00|15|30|45)/.test(list[0] ?? '') && !list[0].startsWith('10:45 - 10:45'), JSON.stringify(list))
await ev(`$('.oggi-entry--block .oggi-entry-handle').focus()`)

// Restore a 60-min block at 11:00 through the editor (14, 15: "Cambia orario")
await ev(`$('[data-block-more]').click(); await wait(150); byText('dialog[open] .oggi-action-item', 'Cambia orario').click(); await wait(150);
  const d = $('dialog[open]'); type(d.querySelector('input[type=time]'), '09:15'); await wait(50)`)
check('editor rejects a time over the appointment (button disabled, message)', await ev(`const d = $('dialog[open]'); return d.querySelector('button[type=submit]').disabled && d.querySelector('.oggi-block-feedback').textContent.includes('Workshop design')`))
await ev(`const d = $('dialog[open]'); type(d.querySelector('input[type=time]'), '11:00'); type(d.querySelector('select'), '60'); await wait(50); d.querySelector('form').requestSubmit(); await wait(150); $('dialog[open]')?.close(); await wait(100)`)
list = await ev(`return blocks()`)
check('"Cambia orario" applies start and duration', list[0]?.startsWith('11:00 - 12:00'), JSON.stringify(list))

// 12. Dragging over a fixed appointment: refused, last valid kept, appointment untouched
p = await pointIn(0, '[data-grip]')
await gesture('mouse', p, -120 * MIN_PX, { release: false }) // proposal 09:00 - 10:00
await shot('time-block-2-overlap')
check('overlap shows neutral invalid state, not committed yet', await ev(`return !!$('.oggi-entry--block[data-invalid]') && $('.oggi-live-time').textContent === 'Occupato' && $('.oggi-block-feedback').textContent.includes('Workshop design')`))
await pointerUp('mouse', p.x, p.y - 120 * MIN_PX)
await sleep(200)
list = await ev(`return blocks()`)
check('release over appointment keeps last valid position', list[0]?.startsWith('09:30 - 10:30'), JSON.stringify(list))
check('explains the adjusted position without blame', await ev(`return $('.oggi-block-feedback').textContent.includes("ultimo orario libero, 09:30 - 10:30")`))
check('fixed appointments never modified', (await ev(`return $$('.oggi-entry--event').map(e => e.textContent + e.getAttribute('style')).join('|')`)) === appointmentsBefore)

// 13. Overlap with reminders/PostIts is allowed: covered by unit tests (fixture day has none)

// 8. Cancellation restores the stored position (touchCancel = pointercancel)
p = await pointIn(0, '.oggi-entry-body')
await pointerDown('touch', p.x, p.y)
await sleep(700)
for (let i = 1; i <= 5; i++) { await pointerMove('touch', p.x, p.y + 20 * i); await sleep(16) }
await send('Input.dispatchTouchEvent', { type: 'touchCancel', touchPoints: [] })
await sleep(200)
list = await ev(`return blocks()`)
check('drag cancellation restores the stored position', list[0]?.startsWith('09:30 - 10:30') && (await ev(`return !$('.oggi-entry--block[data-active]')`)), JSON.stringify(list))

// 15. Keyboard: move and resize through the grip
await ev(`$('.oggi-entry--block [data-grip]').focus()`)
await key('ArrowDown')
await key('ArrowDown', 8) // Shift
list = await ev(`return blocks()`)
check('keyboard moves (+15) and resizes (Shift +15)', list[0]?.startsWith('09:45 - 11:00'), JSON.stringify(list))

// 17. Repository failure: UI stays consistent with the store
await ev(`window.__oggiDev.simulateWriteFailure('archivio non disponibile.'); $('.oggi-entry--block [data-grip]').focus()`)
await key('ArrowDown')
list = await ev(`return blocks()`)
check('failed write: position unchanged and message shown', list[0]?.startsWith('09:45 - 11:00') && (await ev(`return $('.oggi-block-feedback').textContent.includes('Non è stato possibile salvare')`)), JSON.stringify(list))
p = await pointIn(0, '[data-grip]')
await gesture('mouse', p, 60 * MIN_PX)
list = await ev(`return blocks()`)
check('failed drag write: block shows stored slot', list[0]?.startsWith('09:45 - 11:00'), JSON.stringify(list))
await ev(`window.__oggiDev.simulateWriteFailure(null)`)

// 2, 18. From a task: linked block, no duplicate task
await ev(`byText('button', 'Aggiungi attività').click(); await wait(150); type($('dialog[open] input[data-draft]'), 'Preparare la presentazione'); await wait(30); $('dialog[open] form').requestSubmit(); await wait(150);
  const row = $$('.oggi-task').find(r => r.textContent.includes('Preparare la presentazione')); row.querySelector('[data-task-more]').click(); await wait(150);
  byText('dialog[open] button', 'Pianifica un blocco').click(); await wait(200)`)
check('task dialog prefills title and 60 min', await ev(`const d = $('dialog[open]'); return d.querySelector('input[data-draft]').value === 'Preparare la presentazione' && d.querySelector('select').value === '60'`))
await ev(`const d = $('dialog[open]'); type(d.querySelector('input[type=time]'), '17:00'); await wait(30); d.querySelector('form').requestSubmit(); await wait(200)`)
list = await ev(`return blocks()`)
check('block created from task, linked', list.some(b => b === '17:00 - 18:00 Preparare la presentazione') && (await ev(`return $$('.oggi-entry--block').some(b => b.textContent.includes('da Da fare'))`)), JSON.stringify(list))
check('no duplicated task, task still open', await ev(`const rows = $$('.oggi-task').filter(r => r.textContent.includes('Preparare la presentazione')); return rows.length === 1 && !rows[0].querySelector('input').checked`))

// 22. Past block and "Sposta più tardi" (now is 14:40 on the shown day)
await ev(`byText('button', 'Aggiungi blocco').click(); await wait(200); const d = $('dialog[open]'); type(d.querySelector('input[data-draft]'), 'Riordinare'); type(d.querySelector('input[type=time]'), '12:00'); await wait(30); d.querySelector('form').requestSubmit(); await wait(200)`)
check('past block is subdued, not red, not removed', await ev(`const b = $$('.oggi-entry--block').find(b => b.textContent.includes('Riordinare')); const c = getComputedStyle(b); return !!b && b.dataset.past === 'true' && parseFloat(c.opacity) < 1 && !/rgb\\(2[0-9]{2}, [0-9]{1,2}, [0-9]{1,2}\\)/.test(c.borderTopColor)`))
await ev(`$$('.oggi-entry--block').find(b => b.textContent.includes('Riordinare')).querySelector('[data-block-more]').click(); await wait(150)`)
const later = await ev(`const item = byText('dialog[open] .oggi-action-item', 'Sposta più tardi'); item.click(); await wait(150); return $('dialog[open] input[type=time]').value`)
check('"Sposta più tardi" proposes a free time after now', later >= '14:45', later)
await ev(`$('dialog[open] form').requestSubmit(); await wait(150); $('dialog[open]')?.close(); await wait(100)`)
list = await ev(`return blocks()`)
check('moved later, no longer past', list.some(b => b.startsWith(later) && b.includes('Riordinare')) && (await ev(`return !$$('.oggi-entry--block').find(b => b.textContent.includes('Riordinare')).dataset.past`)), JSON.stringify(list))

await ev(`$$('.oggi-entry--block')[0].scrollIntoView({ block: 'start' })`)
await shot('time-block-3-past-and-linked')

// 23. Timer integration
await ev(`$$('.oggi-entry--block').find(b => b.textContent.includes('Preparare la presentazione')).querySelector('[data-block-more]').click(); await wait(150);
  $$('dialog[open] .oggi-action-item').find(b => b.textContent.startsWith('Avvia timer')).click(); await wait(400)`)
check('"Avvia timer" starts the existing timer with the block duration', await ev(`const panelOpen = $$('.oggi-panel-toggle').find(b => b.textContent.includes('Timer')).getAttribute('aria-expanded') === 'true'; const t = $('.oggi-timer-time').textContent; return panelOpen && (t === '60:00' || t === '59:59') && $('.oggi-timer').textContent.includes('Preparare la presentazione')`))
check('timer does not complete the linked task', await ev(`return !$$('.oggi-task').find(r => r.textContent.includes('Preparare la presentazione')).querySelector('input').checked`))

// 16. Navigate away and back: same stored blocks
const beforeNav = await ev(`return blocks().sort().join('|')`)
await ev(`$('a[href="/calendario"]').click()`); await sleep(2500)
await ev(`history.back()`); await sleep(2500)
check('blocks unchanged after leaving Oggi and coming back', (await ev(`return blocks().sort().join('|')`)) === beforeNav, beforeNav)

// 20. Narrow layout: long press still maps to the right time
await send('Emulation.setDeviceMetricsOverride', { width: 520, height: 900, deviceScaleFactor: 1, mobile: true })
await sleep(400)
const Xn = await emptyX()
y = await yFor(20 * 60 + 20)
await gesture('touch', { x: Xn, y }, 0, { hold: 700, steps: 1 })
list = await ev(`return blocks()`)
check('narrow layout: touch long press creates at 20:15', list.some(b => b.startsWith('20:15 - 21:15')), JSON.stringify(list))
await send('Emulation.clearDeviceMetricsOverride')
await sleep(300)

// 19. Delete needs confirmation
const count = await ev(`return $$('.oggi-entry--block').length`)
await ev(`$$('.oggi-entry--block').at(-1).querySelector('[data-block-more]').click(); await wait(150); byText('dialog[open] button', 'Elimina blocco').click(); await wait(50)`)
check('delete asks first', await ev(`return $$('.oggi-entry--block').length === ${count} && !!$('dialog[open] .oggi-block-delete')`))
await ev(`byText('dialog[open] button', 'Elimina').click(); await wait(200)`)
check('confirmed delete removes the block', await ev(`return $$('.oggi-entry--block').length === ${count - 1} && !$('dialog[open]')`))

check('no console errors', consoleErrors.length === 0, consoleErrors.join(' || ').slice(0, 300))
done()
