// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

import { Hourglass, VisualTimer } from './VisualTimer'
import { getTimerStore } from '@/lib/today/timer-store'
import { createTimer, startTimer, pauseTimer } from '@/lib/today/timer'

describe('Hourglass', () => {
  it('1. renders an SVG with aria-hidden', () => {
    const { container } = render(<Hourglass elapsed={0} running={false} finished={false} reducedMotion={false} />)
    const svg = container.querySelector('svg')
    expect(svg).not.toBeNull()
    expect(svg!.getAttribute('aria-hidden')).toBe('true')
  })

  it('2. at elapsed=0 top sand height is 78, bottom height is 0', () => {
    const { container } = render(<Hourglass elapsed={0} running={false} finished={false} reducedMotion={false} />)
    const rects = container.querySelectorAll('[data-sand]')
    const top    = rects[0] as SVGRectElement
    const bottom = rects[1] as SVGRectElement
    const topH    = Number((top.getAttribute('style')    ?? '').match(/height:\s*([\d.]+)/)?.[1])
    const bottomH = Number((bottom.getAttribute('style') ?? '').match(/height:\s*([\d.]+)/)?.[1])
    expect(topH).toBeCloseTo(78)
    expect(bottomH).toBeCloseTo(0)
  })

  it('3. at elapsed=1 top sand height is 0, bottom height is 78', () => {
    const { container } = render(<Hourglass elapsed={1} running={false} finished={false} reducedMotion={false} />)
    const rects = container.querySelectorAll('[data-sand]')
    const topH    = Number((rects[0].getAttribute('style') ?? '').match(/height:\s*([\d.]+)/)?.[1])
    const bottomH = Number((rects[1].getAttribute('style') ?? '').match(/height:\s*([\d.]+)/)?.[1])
    expect(topH).toBeCloseTo(0)
    expect(bottomH).toBeCloseTo(78)
  })

  it('4. stream is visible when running and not finished', () => {
    const { container } = render(<Hourglass elapsed={0.5} running={true} finished={false} reducedMotion={false} />)
    const stream = container.querySelector('[data-stream]') as SVGElement
    expect(stream.style.opacity).toBe('0.85')
  })

  it('5. stream is hidden when not running', () => {
    const { container } = render(<Hourglass elapsed={0.5} running={false} finished={false} reducedMotion={false} />)
    const stream = container.querySelector('[data-stream]') as SVGElement
    expect(stream.style.opacity).toBe('0')
  })

  it('6. stream is hidden when finished', () => {
    const { container } = render(<Hourglass elapsed={1} running={false} finished={true} reducedMotion={false} />)
    const stream = container.querySelector('[data-stream]') as SVGElement
    expect(stream.style.opacity).toBe('0')
  })
})

describe('VisualTimer', () => {
  beforeEach(() => {
    getTimerStore().update(() => createTimer(25), null)
  })

  it('7. idle: status text is "pronto, 25 minuti"', () => {
    render(<VisualTimer onClose={() => {}} />)
    expect(screen.getByText('pronto, 25 minuti')).toBeTruthy()
  })

  it('8. idle: primary button label is "Avvia"', () => {
    render(<VisualTimer onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /Avvia/ })).toBeTruthy()
  })

  it('9. idle: "Ricomincia" button is not visible', () => {
    render(<VisualTimer onClose={() => {}} />)
    expect(screen.queryByRole('button', { name: 'Ricomincia' })).toBeNull()
  })

  it('10. running: primary button label is "Pausa"', () => {
    getTimerStore().update(prev => startTimer(prev, Date.now()))
    render(<VisualTimer onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /Pausa/ })).toBeTruthy()
  })

  it('11. paused: primary button label is "Riprendi"', () => {
    const t = Date.now()
    getTimerStore().update(prev => pauseTimer(startTimer(prev, t), t + 1000))
    render(<VisualTimer onClose={() => {}} />)
    expect(screen.getByRole('button', { name: /Riprendi/ })).toBeTruthy()
  })

  it('12. duration selector has options 10, 25, 45', () => {
    render(<VisualTimer onClose={() => {}} />)
    expect(screen.getByRole('radio', { name: '10 min' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '25 min' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: '45 min' })).toBeTruthy()
  })

  it('13. changing duration to 10 resets the timer to 10 min', () => {
    render(<VisualTimer onClose={() => {}} />)
    fireEvent.click(screen.getByRole('radio', { name: '10 min' }))
    expect(getTimerStore().state.durationMs).toBe(10 * 60_000)
    expect(getTimerStore().state.status).toBe('idle')
  })

  it('14. close button calls onClose', () => {
    const onClose = vi.fn()
    render(<VisualTimer onClose={onClose} />)
    fireEvent.click(screen.getByRole('button', { name: 'Chiudi il timer' }))
    expect(onClose).toHaveBeenCalledOnce()
  })
})
