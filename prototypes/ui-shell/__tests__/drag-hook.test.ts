// __tests__/drag-hook.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { renderHook, act } from '@testing-library/react'
import { useDrag } from '@/components/board/useDrag'

function makeSetup(overrides: Record<string, unknown> = {}) {
  const boardEl = document.createElement('div')
  Object.defineProperty(boardEl, 'offsetWidth',  { get: () => 800, configurable: true })
  Object.defineProperty(boardEl, 'offsetHeight', { get: () => 600, configurable: true })
  Object.defineProperty(boardEl, 'getBoundingClientRect', {
    value: () => ({ left: 0, top: 0, width: 800, height: 600 }),
    configurable: true,
  })

  const noteEl = document.createElement('div')
  Object.defineProperty(noteEl, 'offsetWidth',  { get: () => 200, configurable: true })
  Object.defineProperty(noteEl, 'offsetHeight', { get: () => 200, configurable: true })
  noteEl.setPointerCapture     = vi.fn()
  noteEl.releasePointerCapture = vi.fn()
  document.body.appendChild(boardEl)
  document.body.appendChild(noteEl)

  const onMoveCommit = vi.fn()
  const onTap        = vi.fn()

  const params = {
    noteId:  'n1',
    xPct:    0.5,
    yPct:    0.5,
    rotation: 0,
    boardRef: { current: boardEl },
    noteRef:  { current: noteEl },
    enabled:  true,
    onMoveCommit,
    onTap,
    ...overrides,
  }
  return { params, boardEl, noteEl, onMoveCommit, onTap }
}

function firePointer(el: HTMLElement, type: string, x: number, y: number, id = 1) {
  el.dispatchEvent(new PointerEvent(type, {
    bubbles: true, cancelable: true,
    pointerId: id, clientX: x, clientY: y,
  }))
}

describe('useDrag', () => {
  it('tap (< 4px movement) calls onTap, not onMoveCommit', () => {
    const { params, noteEl, onMoveCommit, onTap } = makeSetup()
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 100, 100)
      firePointer(noteEl, 'pointermove',  102, 101)  // 2.2px — below threshold
      firePointer(noteEl, 'pointerup',    102, 101)
    })
    expect(onTap).toHaveBeenCalledTimes(1)
    expect(onMoveCommit).not.toHaveBeenCalled()
  })

  it('drag (> 4px movement) calls onMoveCommit, not onTap', () => {
    const { params, noteEl, onMoveCommit, onTap } = makeSetup()
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 100, 100)
      firePointer(noteEl, 'pointermove', 150, 120)  // 53.8px — above threshold
      firePointer(noteEl, 'pointerup',   150, 120)
    })
    expect(onMoveCommit).toHaveBeenCalledTimes(1)
    expect(onTap).not.toHaveBeenCalled()
  })

  it('pointercancel restores position to pct and does not commit', () => {
    // pointercancel uses restorePosition() — same as lostpointercapture — sets explicit N%
    // (NOT '' which would jump to CSS class default top:0;left:0)
    const { params, noteEl, onMoveCommit } = makeSetup()
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 100, 100)
      firePointer(noteEl, 'pointermove', 200, 150)
    })
    // Inline styles set by drag
    expect(noteEl.style.left).not.toBe('')
    act(() => {
      noteEl.dispatchEvent(new PointerEvent('pointercancel', { bubbles: true, pointerId: 1 }))
    })
    // Explicitly restored to percentage — NOT empty string (clearing would jump to top:0;left:0)
    expect(noteEl.style.left).toMatch(/%$/)
    expect(noteEl.style.top).toMatch(/%$/)
    expect(onMoveCommit).not.toHaveBeenCalled()
  })

  it('when enabled=false, pointerdown is a no-op', () => {
    const { params, noteEl, onMoveCommit, onTap } = makeSetup({ enabled: false })
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 100, 100)
      firePointer(noteEl, 'pointermove', 200, 150)
      firePointer(noteEl, 'pointerup',   200, 150)
    })
    expect(onMoveCommit).not.toHaveBeenCalled()
    expect(onTap).not.toHaveBeenCalled()
    expect(noteEl.style.left).toBe('')
  })

  it('drag clamps note to board right edge', () => {
    const { params, noteEl, onMoveCommit } = makeSetup({ xPct: 0.5, yPct: 0.5 })
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown',  100, 100)
      firePointer(noteEl, 'pointermove', 2000, 100)  // way off right
      firePointer(noteEl, 'pointerup',   2000, 100)
    })
    expect(onMoveCommit).toHaveBeenCalledTimes(1)
    const [, committedX] = onMoveCommit.mock.calls[0]
    // board=800, note=200 → max xPx=600 → max xPct=0.75
    expect(committedX).toBeLessThanOrEqual(0.75 + 0.01)
  })

  it('start position is derived from xPct*boardW, not from getBoundingClientRect on note', () => {
    const { params, noteEl, onMoveCommit } = makeSetup({ xPct: 0.5, yPct: 0.5 })
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 400, 300)
      firePointer(noteEl, 'pointermove', 450, 300)  // 50px right
      firePointer(noteEl, 'pointerup',   450, 300)
    })
    expect(onMoveCommit).toHaveBeenCalledTimes(1)
    const [, xPct] = onMoveCommit.mock.calls[0]
    // Expected: (0.5 * 800 + 50) / 800 = 0.5625
    expect(xPct).toBeCloseTo(450 / 800, 3)
  })

  it('lostpointercapture restores position to xPct% (not empty string)', () => {
    const { params, noteEl } = makeSetup({ xPct: 0.5, yPct: 0.3 })
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 100, 100)
      firePointer(noteEl, 'pointermove', 200, 150)  // start drag
    })
    expect(noteEl.style.left).not.toBe('')   // px override is set
    act(() => {
      noteEl.dispatchEvent(new PointerEvent('lostpointercapture', { bubbles: true, pointerId: 1 }))
    })
    // Must be explicitly set to percentage — NOT empty string
    expect(noteEl.style.left).toMatch(/%$/)
    expect(noteEl.style.top).toMatch(/%$/)
    // Specifically the pre-drag clamped pct: xPct=0.5 → '50%'
    expect(parseFloat(noteEl.style.left)).toBeCloseTo(50, 0)
  })

  it('Escape key cancels drag and restores position to pct', () => {
    const { params, noteEl, onMoveCommit } = makeSetup({ xPct: 0.4, yPct: 0.4 })
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 100, 100)
      firePointer(noteEl, 'pointermove', 200, 150)
    })
    expect(noteEl.style.left).not.toBe('')
    act(() => {
      document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }))
    })
    expect(noteEl.style.left).toMatch(/%$/)
    expect(onMoveCommit).not.toHaveBeenCalled()
  })

  it('unmount during drag restores position to pct and does not commit', () => {
    const { params, noteEl, onMoveCommit } = makeSetup({ xPct: 0.6, yPct: 0.6 })
    const { unmount } = renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 100, 100)
      firePointer(noteEl, 'pointermove', 250, 200)
    })
    expect(noteEl.style.left).not.toBe('')
    act(() => { unmount() })
    expect(noteEl.style.left).toMatch(/%$/)
    expect(onMoveCommit).not.toHaveBeenCalled()
  })

  it('DOM reconciliation invariant: committed xPct × boardW equals the drag final px', () => {
    // After commit, React will render left = `${xPct * 100}%`.
    // On the same board width, xPct × boardW must equal the lastXpx set during drag.
    const boardW = 800
    const { params, noteEl, onMoveCommit } = makeSetup({ xPct: 0.5, yPct: 0.5 })
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 400, 300)
      firePointer(noteEl, 'pointermove', 460, 300)
      firePointer(noteEl, 'pointerup',   460, 300)
    })
    const lastLeftPx = parseFloat(noteEl.style.left)  // px set during drag
    const [, committedXPct] = onMoveCommit.mock.calls[0]
    // React will render: `${committedXPct * 100}%` → at boardW=800 that's committedXPct * 800 px
    expect(Math.abs(committedXPct * boardW - lastLeftPx)).toBeLessThan(1)
  })

  it('board smaller than note: note clamps to 0 without mutating stored xPct', () => {
    // When board < note, render-time clamping shows note at 0 — stored coords never changed.
    // useDrag should still start from xPct × boardW clamped to 0.
    const { params, noteEl, onMoveCommit } = makeSetup({ xPct: 0.99, yPct: 0.99 })
    // Override board to be smaller than the note
    Object.defineProperty(params.boardRef.current!, 'offsetWidth',  { get: () => 150, configurable: true })
    Object.defineProperty(params.boardRef.current!, 'offsetHeight', { get: () => 150, configurable: true })
    renderHook(() => useDrag(params))
    act(() => {
      firePointer(noteEl, 'pointerdown', 10, 10)
      firePointer(noteEl, 'pointermove', 30, 20)
      firePointer(noteEl, 'pointerup',   30, 20)
    })
    expect(onMoveCommit).toHaveBeenCalledTimes(1)
    const [, committedX, committedY] = onMoveCommit.mock.calls[0]
    // board=150, note=200: max position = 0 → clamped to 0 during drag start
    expect(committedX).toBeGreaterThanOrEqual(0)
    expect(committedY).toBeGreaterThanOrEqual(0)
  })
})
