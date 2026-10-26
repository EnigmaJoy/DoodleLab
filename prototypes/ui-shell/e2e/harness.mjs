// e2e/harness.mjs
// Shared Chrome DevTools Protocol harness for the Oggi interaction suites:
// launches headless Chrome, evaluates code in the page, dispatches real
// mouse / touch / pen / keyboard input and collects PASS/FAIL results.

import { spawn } from 'node:child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

export const BASE   = process.env.BASE_URL ?? 'http://localhost:3000'
const CHROME = process.env.CHROME_PATH ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'
const PORT   = 9339
export const MIN_PX = 56 / 60

const profile = mkdtempSync(join(tmpdir(), 'oggi-e2e-'))
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', `--remote-debugging-port=${PORT}`,
  '--window-size=1320,1000', `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' })
export const sleep = ms => new Promise(r => setTimeout(r, ms))

let ws
for (let i = 0; i < 40 && !ws; i++) {
  await sleep(250)
  try {
    const targets = await (await fetch(`http://127.0.0.1:${PORT}/json`)).json()
    const page = targets.find(t => t.type === 'page')
    if (page) ws = new WebSocket(page.webSocketDebuggerUrl)
  } catch { /* not ready */ }
}
await new Promise(r => ws.addEventListener('open', r))

let id = 0
const pending = new Map()
export const consoleErrors = []
ws.addEventListener('message', e => {
  const m = JSON.parse(e.data)
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id) }
  if (m.method === 'Runtime.consoleAPICalled' && m.params.type === 'error')
    consoleErrors.push(m.params.args.map(a => a.value ?? a.description).join(' '))
  if (m.method === 'Runtime.exceptionThrown') consoleErrors.push(m.params.exceptionDetails.text)
})
export const send = (method, params = {}) => new Promise(r => {
  const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params }))
})
const PAGE_HELPERS = `
  const $ = s => document.querySelector(s);
  const $$ = s => [...document.querySelectorAll(s)];
  const byText = (sel, t) => $$(sel).find(e => e.textContent.trim() === t);
  const type = (el, v) => {
    const proto = el instanceof HTMLSelectElement ? HTMLSelectElement.prototype : Object.getPrototypeOf(el);
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, v);
    el.dispatchEvent(new Event(el instanceof HTMLSelectElement ? 'change' : 'input', { bubbles: true }));
  };
  const wait = ms => new Promise(r => setTimeout(r, ms));
  const blocks = () => $$('.oggi-entry--block').map(b => b.querySelector('.oggi-entry-meta').textContent.split(' · ')[0] + ' ' + b.querySelector('.oggi-entry-title').textContent);
`
export const ev = async expr => {
  const r = await send('Runtime.evaluate', { expression: `(async()=>{${PAGE_HELPERS}${expr}})()`, awaitPromise: true, returnByValue: true })
  if (r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description ?? 'evaluate failed')
  return r.result.result.value
}

/** Optional: SCREENSHOT_DIR=... saves PNGs at key moments for visual review */
export async function shot(name) {
  if (!process.env.SCREENSHOT_DIR) return
  const r = await send('Page.captureScreenshot', { format: 'png' })
  writeFileSync(join(process.env.SCREENSHOT_DIR, `${name}.png`), Buffer.from(r.result.data, 'base64'))
}

const results = []
export const check = (name, ok, detail = '') => results.push(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` - ${detail}` : ''}`)
export const done = code => {
  console.log(results.join('\n'))
  const failed = results.filter(r => r.startsWith('FAIL')).length
  console.log(`\n${results.length - failed}/${results.length} passed`)
  ws.close()
  chrome.once('exit', () => {
    try { rmSync(profile, { recursive: true, force: true }) } catch { /* temp dir, best effort */ }
    process.exit(code ?? (failed ? 1 : 0))
  })
  chrome.kill()
}
process.on('unhandledRejection', e => { results.push(`ABORT ${e.message}`); done(1) })

// --- Input drivers (mouse / pen share dispatchMouseEvent) -------------------

export async function pointerDown(kind, x, y) {
  if (kind === 'touch') return send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y }] })
  return send('Input.dispatchMouseEvent', { type: 'mousePressed', x, y, button: 'left', buttons: 1, clickCount: 1, pointerType: kind })
}
export async function pointerMove(kind, x, y) {
  if (kind === 'touch') return send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] })
  return send('Input.dispatchMouseEvent', { type: 'mouseMoved', x, y, button: 'left', buttons: 1, pointerType: kind })
}
export async function pointerUp(kind, x, y) {
  if (kind === 'touch') return send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
  return send('Input.dispatchMouseEvent', { type: 'mouseReleased', x, y, button: 'left', buttons: 0, clickCount: 1, pointerType: kind })
}
/** Press, optionally hold, move in steps by dy, release */
export async function gesture(kind, from, dy, { hold = 0, steps = 8, release = true } = {}) {
  await pointerDown(kind, from.x, from.y)
  if (hold) await sleep(hold)
  for (let i = 1; i <= steps; i++) { await pointerMove(kind, from.x, from.y + (dy * i) / steps); await sleep(16) }
  if (release) await pointerUp(kind, from.x, from.y + dy)
  await sleep(150)
}
export async function key(keyName, modifiers = 0) {
  const code = { ArrowDown: 40, ArrowUp: 38, Tab: 9, Enter: 13, Escape: 27, ' ': 32 }[keyName]
  // Enter and Space carry text so they activate buttons and submit forms
  const text = { Enter: '\r', ' ': ' ' }[keyName]
  await send('Input.dispatchKeyEvent', { type: text ? 'keyDown' : 'rawKeyDown', key: keyName, code: keyName, windowsVirtualKeyCode: code, modifiers, text })
  await send('Input.dispatchKeyEvent', { type: 'keyUp', key: keyName, code: keyName, windowsVirtualKeyCode: code, modifiers })
  await sleep(80)
}
/** Types text into the focused element like a keyboard would */
export async function typeText(text) {
  await send('Input.insertText', { text })
  await sleep(60)
}
