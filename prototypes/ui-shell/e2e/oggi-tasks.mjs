// e2e/oggi-tasks.mjs
// Interaction checks for the "Da fare e fatto" task workflow (boards: Nuova
// attività, task actions, inline delete confirmation) in real headless
// Chrome, with keyboard and pointer input dispatched through DevTools.
//
// Requires a running dev server (pnpm dev) and Google Chrome.
//   BASE_URL=http://localhost:3000 CHROME_PATH=... node --experimental-websocket e2e/oggi-tasks.mjs
// These are automated simulations, not manual checks on physical devices.

import { BASE, check, consoleErrors, done, ev, key, send, shot, sleep, typeText } from './harness.mjs'

// In-page helpers for this suite
const T = `
  const todo  = () => $$('ul[aria-labelledby="oggi-todo-label"] .oggi-task-title').map(e => e.textContent);
  const fatto = () => $$('ul[aria-labelledby="oggi-done-label"] .oggi-task-title').map(e => e.textContent);
  const row   = t => $$('.oggi-task').find(r => r.querySelector('.oggi-task-title').textContent === t);
  const dlg   = () => $('dialog[open]');
  const inDlg = () => !!dlg() && dlg().contains(document.activeElement);
  const active = () => document.activeElement;
`
const tv = expr => ev(T + expr)

/** Real mouse click at the centre of the element matched by `expr` (an in-page expression) */
async function click(expr) {
  const p = await tv(`const el = ${expr}; el.scrollIntoView({ block: 'center' }); await wait(30);
    const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }`)
  await send('Input.dispatchMouseEvent', { type: 'mousePressed', x: p.x, y: p.y, button: 'left', buttons: 1, clickCount: 1 })
  await send('Input.dispatchMouseEvent', { type: 'mouseReleased', x: p.x, y: p.y, button: 'left', buttons: 0, clickCount: 1 })
  await sleep(200)
}
const addButton = `$('[data-add-task]')`
const moreFor   = title => `row(${JSON.stringify(title)}).querySelector('[data-task-more]')`
const action    = label => `byText('dialog[open] button', ${JSON.stringify(label)})`

await send('Runtime.enable')
await send('Page.enable')
await send('Page.navigate', { url: `${BASE}/oggi` })
await sleep(3500)
check('starts with no demo tasks', await tv(`return todo().length === 0 && fatto().length === 0`))

// 1. Opening the New Task modal (Board 1)
await click(addButton)
check('"Aggiungi attività" opens "Nuova attività" as a modal', await tv(`const d = dlg(); return !!d && d.matches(':modal') && d.querySelector('h2').textContent === 'Nuova attività' && d.getAttribute('aria-labelledby') === d.querySelector('h2').id`))
check('title field is focused on open', await tv(`return active().matches('dialog[open] input[data-draft]:not([type])')`))
check('fields: title, "entro le" time, Priorità checkbox, "facoltativi", Annulla / Aggiungi, close', await tv(`const d = dlg();
  return !!d.querySelector('input[type=time]') && d.textContent.includes('entro le') && d.textContent.includes('Priorità') && d.textContent.includes('facoltativi')
    && !!byText('dialog[open] button', 'Annulla') && !!byText('dialog[open] button', 'Aggiungi') && !!d.querySelector('button[aria-label="Chiudi"]')`))
check('every field has an accessible label', await tv(`return $$('dialog[open] input').every(i => i.labels?.length > 0)`))
await shot('task-1-new')

// 19. Focus is trapped: Tab never reaches the page behind the modal
let escaped = false
for (let i = 0; i < 8; i++) { await key('Tab'); if (await tv(`return !inDlg() && active() !== document.body`)) escaped = true }
check('Tab cycles inside the dialog only', !escaped)

// 2. Closing without creating (Escape, close icon, Annulla); focus returns to the opener
await tv(`type($('dialog[open] input[data-draft]'), 'Bozza da scartare')`)
await key('Escape'); await sleep(150)
check('Escape closes without creating', await tv(`return !dlg() && todo().length === 0`))
check('focus returns to "Aggiungi attività"', await tv(`return active() === ${addButton}`))
await click(addButton); await click(`$('dialog[open] button[aria-label="Chiudi"]')`)
await click(addButton); await click(action('Annulla'))
check('close icon and Annulla close without creating', await tv(`return !dlg() && todo().length === 0`))

// 5. Empty / whitespace title is rejected
await click(addButton)
await typeText('   ')
await key('Enter'); await sleep(150)
check('whitespace title rejected with a message, dialog stays open', await tv(`return !!dlg() && dlg().querySelector('[role=status]').textContent.includes('Scrivi che cosa vuoi fare') && todo().length === 0`))

// 3, 7. Title only, typed and submitted with the keyboard
await tv(`type($('dialog[open] input[data-draft]'), '')`)
await typeText('Rispondere alla mail del condominio')
await key('Enter'); await sleep(200)
check('title-only task appears under Da fare, dialog closed', await tv(`return !dlg() && todo().join('|') === 'Rispondere alla mail del condominio' && !row('Rispondere alla mail del condominio').querySelector('.oggi-task-meta, .oggi-badge')`))
check('focus back on "Aggiungi attività" after creating', await tv(`return active() === ${addButton}`))

// 4. Deadline and priority
await click(addButton)
await typeText('Chiamare il commercialista')
await tv(`type($('dialog[open] input[type=time]'), '12:00')`)
await click(`$('dialog[open] input[type=checkbox]')`)
await click(action('Aggiungi'))
check('task with deadline and priority shows "entro le" and the badge', await tv(`const r = row('Chiamare il commercialista'); return !!r && r.querySelector('.oggi-task-meta').textContent === 'entro le 12:00' && r.querySelector('.oggi-badge--priority')?.textContent === 'Priorità'`))

// 6. Duplicate submit is ignored
await click(addButton)
await typeText('Comprare croccantini')
await tv(`const f = $('dialog[open] form'); f.requestSubmit(); f.requestSubmit(); f.querySelector('[type=submit]').click(); await wait(200)`)
check('rapid repeated submit creates one task', await tv(`return todo().filter(t => t === 'Comprare croccantini').length === 1`))

// 15. Repository failure keeps the dialog and the typed values
await click(addButton)
await typeText('Prenotare la visita della casa')
await tv(`type($('dialog[open] input[type=time]'), '17:30'); window.__oggiDev.simulateWriteFailure('archivio non disponibile.')`)
await key('Enter'); await sleep(200)
check('failed save: dialog open, message, values kept, nothing created', await tv(`const d = dlg(); return !!d && d.querySelector('[role=status]').textContent.includes('Non è stato possibile salvare')
  && d.querySelector('input[data-draft]').value === 'Prenotare la visita della casa' && d.querySelector('input[type=time]').value === '17:30' && !todo().includes('Prenotare la visita della casa')`))
await tv(`window.__oggiDev.simulateWriteFailure(null)`)
await key('Enter'); await sleep(200)
check('retry after failure succeeds once', await tv(`return !dlg() && todo().filter(t => t === 'Prenotare la visita della casa').length === 1`))

// 8. Contextual actions for the correct task (Board 2)
await click(moreFor('Chiamare il commercialista'))
check('"..." has an accessible name', await tv(`return ${moreFor('Chiamare il commercialista')}.getAttribute('aria-label') === 'Azioni per Chiamare il commercialista'`))
check('actions dialog shows the selected task, deadline and priority', await tv(`const d = dlg(); return d.querySelector('h2').textContent === 'Chiamare il commercialista' && d.textContent.includes('entro le 12:00') && !!d.querySelector('.oggi-task-summary .oggi-badge--priority')`))
check('actions: Togli priorità, Modifica, Pianifica un blocco, Elimina', await tv(`return $$('dialog[open] .oggi-action-item').map(b => b.textContent.trim()).join('|') === 'Togli priorità|Modifica|Pianifica un blocco|Elimina'`))
await shot('task-2-actions')

// 9. Priority off and on, reflected immediately
await click(action('Togli priorità'))
check('"Togli priorità" removes the badge (row and dialog)', await tv(`return !row('Chiamare il commercialista').querySelector('.oggi-badge--priority') && !dlg().querySelector('.oggi-badge--priority') && !!${action('Segna come priorità')}`))
await click(action('Segna come priorità'))
check('"Segna come priorità" restores it', await tv(`return !!row('Chiamare il commercialista').querySelector('.oggi-badge--priority') && !!${action('Togli priorità')}`))

// 10, 11. Edit the same task; unchanged fields preserved
const idBefore = await tv(`return ${moreFor('Chiamare il commercialista')}.dataset.taskMore`)
await click(action('Modifica'))
check('edit form is prefilled and focused', await tv(`const d = dlg(); return d.querySelector('input[data-draft]').value === 'Chiamare il commercialista' && d.querySelector('input[type=time]').value === '12:00' && d.querySelector('input[type=checkbox]').checked && active() === d.querySelector('input[data-draft]')`))
await tv(`type($('dialog[open] input[data-draft]'), 'Chiamare il commercialista per il 730')`)
await click(action('Salva'))
check('edit saved to the same task, back to actions, fields kept', await tv(`const r = row('Chiamare il commercialista per il 730');
  return !!r && r.querySelector('[data-task-more]').dataset.taskMore === ${JSON.stringify(idBefore)} && todo().length === 4 && !row('Chiamare il commercialista')
    && r.querySelector('.oggi-task-meta').textContent === 'entro le 12:00' && !!r.querySelector('.oggi-badge--priority') && dlg().querySelector('h2').textContent === 'Chiamare il commercialista per il 730'`))
check('focus returns to "Modifica" after saving', await tv(`return active() === ${action('Modifica')}`))
await click(action('Modifica'))
await key('Escape'); await sleep(150)
check('Escape in the edit form returns to the actions', await tv(`return !!dlg() && !!${action('Modifica')} && active() === ${action('Modifica')}`))

// 12, 13. Inline delete confirmation (Board 3) and cancel
await click(action('Elimina'))
check('confirmation inside the same dialog, names the task', await tv(`return $$('dialog[open]').length === 1 && !!$('dialog[open] .oggi-delete-confirm') && $('.oggi-delete-question').textContent === 'Eliminare "Chiamare il commercialista per il 730"?' && !$('dialog[open] .oggi-action-list')`))
check('confirmation is honest about permanence', await tv(`return $('.oggi-delete-detail').textContent.includes('non si potrà recuperare')`))
check('safe default: focus on Annulla', await tv(`return active() === ${action('Annulla')}`))
await shot('task-3-delete-confirm')
await click(action('Annulla'))
check('cancel returns to actions, task kept, focus on Elimina', await tv(`return !!$('dialog[open] .oggi-action-list') && !!row('Chiamare il commercialista per il 730') && active() === ${action('Elimina')}`))

// 15. Failed delete changes nothing and says so
await click(action('Elimina'))
await tv(`window.__oggiDev.simulateWriteFailure('archivio non disponibile.')`)
await click(action('Sì, elimina'))
check('failed delete: task kept, dialog open, message', await tv(`return !!row('Chiamare il commercialista per il 730') && !!dlg() && dlg().textContent.includes('Non è stato possibile salvare')`))
await tv(`window.__oggiDev.simulateWriteFailure(null)`)

// 14. Confirmed delete removes the task permanently; focus on a surviving control
await click(action('Sì, elimina'))
check('confirmed delete removes only that task', await tv(`return !dlg() && !row('Chiamare il commercialista per il 730') && todo().length === 3`))
check('focus moves to a surviving row control', await tv(`return active()?.matches('[data-task-more]') && active().getAttribute('aria-label') === 'Azioni per Comprare croccantini'`))

// 18. "Pianifica un blocco" still creates a linked block, no duplicate task
await click(moreFor('Comprare croccantini'))
await click(action('Pianifica un blocco'))
check('plan dialog replaces the actions dialog, prefilled', await tv(`return $$('dialog[open]').length === 1 && dlg().querySelector('input[data-draft]').value === 'Comprare croccantini' && dlg().querySelector('select').value === '60'`))
await tv(`type($('dialog[open] input[type=time]'), '22:00'); await wait(30); $('dialog[open] form').requestSubmit(); await wait(250)`)
check('linked block created, task not duplicated', await tv(`const b = $$('.oggi-entry--block').find(b => b.textContent.includes('Comprare croccantini')); return !!b && b.textContent.includes('da Da fare') && todo().filter(t => t === 'Comprare croccantini').length === 1`))

// 16. Complete -> Fatto with strikethrough, block untouched
await click(`row('Comprare croccantini').querySelector('input[type=checkbox]')`)
check('completed task moves to Fatto, checked and struck through', await tv(`const r = row('Comprare croccantini'); return fatto().includes('Comprare croccantini') && !todo().includes('Comprare croccantini')
  && r.querySelector('input').checked && getComputedStyle(r.querySelector('.oggi-task-title')).textDecorationLine.includes('line-through')`))
check('completing does not remove the linked block', await tv(`return $$('.oggi-entry--block').some(b => b.textContent.includes('Comprare croccantini'))`))
await click(moreFor('Comprare croccantini'))
check('actions for a done task stay coherent (Fatta, Archivia, no planning)', await tv(`const items = $$('dialog[open] .oggi-action-item').map(b => b.textContent.trim()); return !!dlg().querySelector('.oggi-badge--done') && items.includes('Archivia') && !items.includes('Pianifica un blocco')`))
await key('Escape'); await sleep(150)

// 17. Reverse completion: same identity, back in Da fare
const doneId = await tv(`return ${moreFor('Comprare croccantini')}.dataset.taskMore`)
await click(`row('Comprare croccantini').querySelector('input[type=checkbox]')`)
check('reopened task returns to Da fare with the same id', await tv(`return todo().includes('Comprare croccantini') && ${moreFor('Comprare croccantini')}.dataset.taskMore === ${JSON.stringify(doneId)}`))

// 20. Tasks belong to the displayed date
const before = await tv(`return todo().join('|')`)
await tv(`window.__oggiDev.setClockOffsetMinutes(24 * 60); await wait(400)`)
check('another day shows none of these tasks', await tv(`return todo().length === 0`))
await tv(`window.__oggiDev.setClockOffsetMinutes(0); await wait(400)`)
check('back on the original day, tasks unchanged', (await tv(`return todo().join('|')`)) === before, before)

check('no console errors in Oggi', consoleErrors.length === 0, consoleErrors.join(' || ').slice(0, 300))

// 22. Other sections still render (Calendar, Whiteboard, radial navigation)
await send('Page.navigate', { url: `${BASE}/calendario` }); await sleep(3000)
check('Calendario renders its grid', await tv(`return !!$('.cal-grid') && !!$('.cal-header')`))
await send('Page.navigate', { url: `${BASE}/lavagna` }); await sleep(2500)
check('Lavagna renders', await tv(`return document.body.textContent.includes('Lavagna')`))
await send('Page.navigate', { url: `${BASE}/?view=menu` }); await sleep(3000)
check('radial menu renders with a link to Oggi', await tv(`return !!$('[aria-label="Navigazione principale"]') && !!$('a[href="/oggi"]')`))
check('no console errors in other sections', consoleErrors.length === 0, consoleErrors.join(' || ').slice(0, 300))
done()
