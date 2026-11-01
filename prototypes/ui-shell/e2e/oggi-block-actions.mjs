// e2e/oggi-block-actions.mjs
// Interaction checks for the flexible block dialog (boards: block actions,
// delete confirmation) in real headless Chrome.
//
// Requires a running dev server (pnpm dev) and Google Chrome.
//   BASE_URL=http://localhost:3000 CHROME_PATH=... node --experimental-websocket e2e/oggi-block-actions.mjs
// These are automated simulations: they do not replace checks on physical
// touch and Apple Pencil devices.

import {
  MIN_PX, consoleErrors, check, done, ev, gesture, key, send, shot, sleep, BASE,
} from './harness.mjs'

const HELPERS = `
  const dlg = () => $('dialog[open]');
  const active = () => document.activeElement;
  const action = t => $$('dialog[open] button').find(b => b.textContent.trim() === t);
  const blockEl = t => $$('.oggi-entry--block').find(b => b.querySelector('.oggi-entry-title').textContent === t);
  const moreFor = t => blockEl(t)?.querySelector('[data-block-more]');
  const titles = () => $$('.oggi-entry--block .oggi-entry-title').map(e => e.textContent).sort();
  const row = t => $$('.oggi-task').find(r => r.querySelector('.oggi-task-title')?.textContent === t);
  const announced = () => $('.oggi-screen > [role=status][aria-live]').textContent;
`
const tv = expr => ev(HELPERS + expr)
const click = async expr => { await tv(`(${expr}).click(); await wait(200)`) }

async function pointIn(title, selector) {
  return tv(`const b = blockEl(${JSON.stringify(title)}); b.scrollIntoView({ block: 'center' }); await wait(40);
    const r = b.querySelector(${JSON.stringify(selector)}).getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`)
}

async function addBlock(title, start, duration) {
  await tv(`byText('button', 'Aggiungi blocco').click(); await wait(200); const d = dlg();
    type(d.querySelector('input[data-draft]'), ${JSON.stringify(title)}); type(d.querySelector('input[type=time]'), '${start}');
    type(d.querySelector('select'), '${duration}'); await wait(40); d.querySelector('form').requestSubmit(); await wait(200)`)
}

await send('Runtime.enable')
await send('Page.enable')
await send('Emulation.setTouchEmulationEnabled', { enabled: true, maxTouchPoints: 5 })
await send('Page.navigate', { url: `${BASE}/oggi` })
await sleep(3500)

// 19 October has fixed appointments (09:00 - 09:30, 16:00); now = 08:00 so no block is past
await ev(`const target = new Date(2026, 9, 19, 8, 0); window.__oggiDev.setClockOffsetMinutes(Math.round((target - Date.now()) / 60000)); await wait(300)`)
const appointmentsBefore = await tv(`return $$('.oggi-entry--event').map(e => e.textContent + e.getAttribute('style')).join('|')`)

// Setup: a priority task with a linked 90-min block, plus two independent blocks
await tv(`byText('button', 'Aggiungi attività').click(); await wait(200); type($('dialog[open] input[data-draft]'), 'Chiamare il commercialista');
  type($('dialog[open] input[type=time]'), '12:00'); $('dialog[open] input[type=checkbox]').click(); await wait(30); $('dialog[open] form').requestSubmit(); await wait(200)`)
await click(`row('Chiamare il commercialista').querySelector('[data-task-more]')`)
await click(`action('Pianifica un blocco')`)
await tv(`const d = dlg(); type(d.querySelector('input[data-draft]'), 'Blocco di concentrazione'); type(d.querySelector('input[type=time]'), '10:30');
  type(d.querySelector('select'), '90'); await wait(40); d.querySelector('form').requestSubmit(); await wait(200)`)
await addBlock('Studio', '13:00', '60')
await addBlock('Lettura', '17:00', '45')
check('setup: three blocks, one linked to a priority task', (await tv(`return titles().join('|')`)) === 'Blocco di concentrazione|Lettura|Studio'
  && await tv(`return blockEl('Blocco di concentrazione').textContent.includes('da Da fare') && !!row('Chiamare il commercialista').querySelector('.oggi-badge--priority')`))
const taskBefore = await tv(`return row('Chiamare il commercialista').outerHTML`)
const blockId = await tv(`return moreFor('Blocco di concentrazione').dataset.blockMore`)

// 1, 2. A plain click on the block opens its own dialog (Board 1) with real data
let p = await pointIn('Blocco di concentrazione', '.oggi-entry-body')
await gesture('mouse', p, 0, { steps: 1 })
check('mouse click on the block opens the block dialog', await tv(`return $$('dialog[open]').length === 1 && dlg().querySelector('h2').textContent === 'Blocco di concentrazione'`))
check('dialog shows label, times and calculated duration', await tv(`const d = dlg(); return d.querySelector('.oggi-block-kind').textContent === 'Blocco flessibile'
  && d.querySelector('.oggi-block-when').textContent.includes('10:30 - 12:00 · 90 minuti') && d.querySelector('.oggi-block-when').textContent.includes('lunedì 19 ottobre')`))
check('dialog explains the block is not an appointment', await tv(`return dlg().textContent.includes('non è un appuntamento e non viene inviato a nessun calendario esterno')`))
check('actions in board order, timer from the real duration', await tv(`return $$('dialog[open] .oggi-action-item').map(b => b.textContent.trim()).join('|') === 'Cambia orario|Modifica titolo|Avvia timer da 90 min|Elimina blocco'`))
check('destructive action is visually distinct', await tv(`const e = action('Elimina blocco'); return e.classList.contains('oggi-action-item--danger') && getComputedStyle(e).color !== getComputedStyle(action('Cambia orario')).color`))
check('dialog is labelled and the backdrop blurs', await tv(`const d = dlg(); return document.getElementById(d.getAttribute('aria-labelledby')).textContent === 'Blocco di concentrazione' && getComputedStyle(d, '::backdrop').backdropFilter.includes('blur')`))
await shot('block-1-actions')
await key('Escape')
check('Escape on the actions closes, block kept, focus back on the block', await tv(`return !dlg() && !!blockEl('Blocco di concentrazione') && active() === blockEl('Blocco di concentrazione').querySelector('.oggi-entry-body')`))

// 1. Touch tap, pen tap and keyboard also open it
await gesture('touch', p, 0, { steps: 1 })
check('touch tap opens the dialog', await tv(`return dlg()?.querySelector('h2').textContent === 'Blocco di concentrazione'`))
await click(`$('dialog[open] button[aria-label="Chiudi"]')`)
await gesture('pen', p, 0, { steps: 1 })
check('pen tap opens the dialog', await tv(`return dlg()?.querySelector('h2').textContent === 'Blocco di concentrazione'`))
await click(`$('dialog[open] button[aria-label="Chiudi"]')`)
await tv(`moreFor('Studio').focus()`)
await key('Enter'); await sleep(150)
check('keyboard Enter on "..." opens the dialog for that block', await tv(`return dlg()?.querySelector('h2').textContent === 'Studio' && dlg().textContent.includes('13:00 - 14:00 · 60 minuti')`))
await key('Escape')

// 17. No dialog after dragging or resizing
p = await pointIn('Studio', '.oggi-entry-body')
await gesture('mouse', p, 30 * MIN_PX, { hold: 700 })
check('long-press drag moves 30 min with 15-min snapping, no dialog', await tv(`return !dlg() && blockEl('Studio').querySelector('.oggi-entry-meta').textContent.startsWith('13:30 - 14:30')`))
p = await pointIn('Studio', '.oggi-resize--end')
await gesture('touch', { x: p.x, y: p.y + 3 }, 15 * MIN_PX)
check('resize keeps snapping, no dialog', await tv(`return !dlg() && blockEl('Studio').querySelector('.oggi-entry-meta').textContent.startsWith('13:30 - 14:45')`))
p = await pointIn('Studio', '[data-grip]')
await gesture('pen', p, -30 * MIN_PX)
check('pen grip drag, no dialog', await tv(`return !dlg() && blockEl('Studio').querySelector('.oggi-entry-meta').textContent.startsWith('13:00 - 14:15')`))

// 3, 4. Edit title: cancel, then save without touching the linked task
await click(`moreFor('Blocco di concentrazione')`)
await click(`action('Modifica titolo')`)
check('title editor is prefilled and focused', await tv(`const i = dlg().querySelector('input[data-draft]'); return i.value === 'Blocco di concentrazione' && active() === i`))
await tv(`type(dlg().querySelector('input[data-draft]'), 'Da buttare')`)
await click(`action('Annulla')`)
check('Annulla discards the title, focus back on "Modifica titolo"', await tv(`return !!blockEl('Blocco di concentrazione') && !blockEl('Da buttare') && active() === action('Modifica titolo')`))
await click(`action('Modifica titolo')`)
await tv(`type(dlg().querySelector('input[data-draft]'), 'Telefonate di lavoro'); await wait(30); dlg().querySelector('form').requestSubmit(); await wait(200)`)
check('title saved on the same block, no duplicate', await tv(`return moreFor('Telefonate di lavoro')?.dataset.blockMore === ${JSON.stringify(blockId)} && $$('.oggi-entry--block').length === 3 && dlg().querySelector('h2').textContent === 'Telefonate di lavoro'`))
check('linked task keeps its own title, priority and state', (await tv(`return row('Chiamare il commercialista')?.outerHTML`)) === taskBefore)

// 5, 6. Time editor: cancel, collision rule, Escape, save
await click(`action('Cambia orario')`)
check('time editor prefilled with the stored slot', await tv(`const d = dlg(); return d.querySelector('input[type=time]').value === '10:30' && d.querySelector('select').value === '90'`))
await tv(`type(dlg().querySelector('input[type=time]'), '09:00'); await wait(50)`)
check('collision with a fixed appointment blocks the save', await tv(`const d = dlg(); return d.querySelector('button[type=submit]').disabled && d.querySelector('.oggi-block-feedback').textContent.includes('Workshop design')`))
await click(`action('Annulla')`)
check('Annulla keeps the stored time', await tv(`return blockEl('Telefonate di lavoro').querySelector('.oggi-entry-meta').textContent.startsWith('10:30 - 12:00') && active() === action('Cambia orario')`))
await click(`action('Cambia orario')`)
await key('Escape')
check('Escape in the editor steps back to the actions', await tv(`return !!dlg() && !!$('dialog[open] .oggi-action-list') && active() === action('Cambia orario')`))
await click(`action('Cambia orario')`)
await tv(`const d = dlg(); type(d.querySelector('input[type=time]'), '10:45'); type(d.querySelector('select'), '60'); await wait(40); d.querySelector('form').requestSubmit(); await wait(200)`)
check('new time saved on the same block, duration recalculated', await tv(`return moreFor('Telefonate di lavoro').dataset.blockMore === ${JSON.stringify(blockId)}
  && blockEl('Telefonate di lavoro').querySelector('.oggi-entry-meta').textContent.startsWith('10:45 - 11:45') && dlg().querySelector('.oggi-block-when').textContent.includes('10:45 - 11:45 · 60 minuti')
  && !!action('Avvia timer da 60 min')`))
check('appointments unchanged after edits', (await tv(`return $$('.oggi-entry--event').map(e => e.textContent + e.getAttribute('style')).join('|')`)) === appointmentsBefore)

// 7. Timer: real duration, block and task untouched
await click(`$$('dialog[open] .oggi-action-item').find(b => b.textContent.startsWith('Avvia timer'))`)
await sleep(300)
check('timer started with the block duration', await tv(`const t = $('.oggi-timer-time').textContent; return !dlg() && (t === '60:00' || t === '59:59') && $('.oggi-timer').textContent.includes('Telefonate di lavoro')`))
check('timer does not move the block or complete the task', await tv(`return blockEl('Telefonate di lavoro').querySelector('.oggi-entry-meta').textContent.startsWith('10:45 - 11:45') && !row('Chiamare il commercialista').querySelector('input').checked`))
await click(`moreFor('Lettura')`)
check('with a timer running the action says it replaces it', await tv(`return $$('dialog[open] .oggi-action-item').find(b => b.textContent.startsWith('Avvia timer da 45 min')).textContent.includes('Sostituisce il timer in corso')`))
await key('Escape')

// 8, 9. "Elimina blocco" asks first and names the block
await click(`moreFor('Telefonate di lavoro')`)
await click(`action('Elimina blocco')`)
check('confirmation replaces the actions in the same dialog, nothing deleted', await tv(`return $$('dialog[open]').length === 1 && !!$('dialog[open] .oggi-block-delete') && !$('dialog[open] .oggi-action-list') && $$('.oggi-entry--block').length === 3`))
check('confirmation shows heading, title and times, honest consequence', await tv(`const d = dlg(); return d.querySelector('h2').textContent === 'Eliminare questo blocco?'
  && d.querySelector('.oggi-block-delete-summary').textContent === 'Telefonate di lavoro · 10:45 - 11:45'
  && d.querySelector('.oggi-block-delete-detail').textContent.includes('Appuntamenti e attività restano come sono')
  && document.getElementById(d.getAttribute('aria-labelledby')).textContent === 'Eliminare questo blocco?'`))
check('Elimina is red, Annulla is not; safe default focus on Annulla', await tv(`const del = action('Elimina'); return getComputedStyle(del).backgroundColor === 'rgb(163, 38, 26)' && getComputedStyle(action('Annulla')).backgroundColor !== getComputedStyle(del).backgroundColor && active() === action('Annulla')`))
await shot('block-2-delete-confirm')

// 10. Cancel and Escape keep the block
await click(`action('Annulla')`)
check('Annulla returns to the actions, block kept, focus on "Elimina blocco"', await tv(`return !!$('dialog[open] .oggi-action-list') && !!blockEl('Telefonate di lavoro') && active() === action('Elimina blocco')`))
await click(`action('Elimina blocco')`)
await key('Escape')
check('Escape in the confirmation steps back, block kept', await tv(`return !!$('dialog[open] .oggi-action-list') && !!blockEl('Telefonate di lavoro')`))
await click(`action('Elimina blocco')`)
await click(`$('dialog[open]')`) // backdrop area of the native dialog: no close, no delete
check('clicking around does not delete', await tv(`return !!$('dialog[open] .oggi-block-delete') && !!blockEl('Telefonate di lavoro')`))
await key('Escape'); await key('Escape')
check('closing without confirming keeps the block', await tv(`return !dlg() && !!blockEl('Telefonate di lavoro')`))

// 15. Repository failure: no false success, retry offered
await click(`moreFor('Telefonate di lavoro')`)
await click(`action('Elimina blocco')`)
await tv(`window.__oggiDev.simulateWriteFailure('archivio non disponibile.')`)
await click(`action('Elimina')`)
await sleep(150)
check('failed delete: block kept, dialog open, accessible message', await tv(`const a = dlg()?.querySelector('[role=alert]'); return !!blockEl('Telefonate di lavoro') && !!a && a.textContent.includes('Non è stato possibile eliminare il blocco') && !a.textContent.includes('archivio')`))
check('no success announced, retry offered', await tv(`return !announced().includes('eliminato') && !!action('Riprova')`))
await tv(`window.__oggiDev.simulateWriteFailure(null)`)

// 11, 12, 13, 14, 16. Confirm once: only this block goes, everything else stays
await tv(`const b = action('Riprova'); b.click(); b.click(); b.click(); await wait(250)`)
check('confirmed delete removes exactly one block and closes', await tv(`return !dlg() && titles().join('|') === 'Lettura|Studio'`))
check('success announced only after the repository confirmed', await tv(`await wait(100); return announced().startsWith('Blocco eliminato: Telefonate di lavoro')`))
check('linked task preserved with priority, deadline and state', (await tv(`return row('Chiamare il commercialista')?.outerHTML`)) === taskBefore)
check('appointments preserved', (await tv(`return $$('.oggi-entry--event').map(e => e.textContent + e.getAttribute('style')).join('|')`)) === appointmentsBefore)
check('running timer is not reset by deleting its block', await tv(`const t = $('.oggi-timer-time').textContent; return t.startsWith('59') && $('.oggi-timer').textContent.includes('Telefonate di lavoro')`))
check('focus moves to a surviving block', await tv(`return active() === moreFor('Studio')`))
await sleep(400)
check('deleted block does not come back on later renders', await tv(`return !blockEl('Telefonate di lavoro') && $$('.oggi-entry--block').length === 2`))

// Delete the remaining blocks: focus falls back to "Aggiungi blocco"
for (const t of ['Studio', 'Lettura']) {
  await click(`moreFor(${JSON.stringify(t)})`)
  await click(`action('Elimina blocco')`)
  await click(`action('Elimina')`)
}
check('last block deleted: focus on "Aggiungi blocco"', await tv(`return $$('.oggi-entry--block').length === 0 && active()?.textContent.trim() === 'Aggiungi blocco'`))
check('task list untouched after deleting every block', (await tv(`return row('Chiamare il commercialista')?.outerHTML`)) === taskBefore)

// Narrow layout: the dialogs stay inside the viewport
await send('Emulation.setDeviceMetricsOverride', { width: 375, height: 760, deviceScaleFactor: 2, mobile: true })
await sleep(300)
await addBlock('Studio', '13:00', '60')
await click(`moreFor('Studio')`)
check('narrow: actions dialog fits', await tv(`const r = dlg().getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth`))
await click(`action('Elimina blocco')`)
check('narrow: confirmation fits with both buttons', await tv(`const r = dlg().getBoundingClientRect(); const e = action('Elimina').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && e.right <= r.right`))
await shot('block-3-narrow-confirm')
await key('Escape'); await key('Escape')
await send('Emulation.clearDeviceMetricsOverride')

check('no console errors', consoleErrors.length === 0, consoleErrors.join(' || ').slice(0, 300))
done()
