// @vitest-environment jsdom
import { describe, it, expect } from 'vitest'
import { render } from '@testing-library/react'
import React from 'react'

import { Hourglass } from './VisualTimer'

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
