// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { PeriodStepper } from './PeriodStepper'

describe('PeriodStepper', () => {
  it('1. renders button aria-label "Mese precedente"', () => {
    render(<PeriodStepper label="nov 2026" onPrev={() => {}} onNext={() => {}} onToday={() => {}} />)
    expect(screen.getByRole('button', { name: 'Mese precedente' })).toBeTruthy()
  })

  it('2. renders button aria-label "Mese successivo"', () => {
    render(<PeriodStepper label="nov 2026" onPrev={() => {}} onNext={() => {}} onToday={() => {}} />)
    expect(screen.getByRole('button', { name: 'Mese successivo' })).toBeTruthy()
  })

  it('3. renders center button aria-label "Vai a oggi" showing the label', () => {
    render(<PeriodStepper label="nov 2026" onPrev={() => {}} onNext={() => {}} onToday={() => {}} />)
    const btn = screen.getByRole('button', { name: 'Vai a oggi' })
    expect(btn).toBeTruthy()
    expect(btn.textContent).toBe('nov 2026')
  })

  it('4. prev click calls onPrev', () => {
    const onPrev = vi.fn()
    render(<PeriodStepper label="nov 2026" onPrev={onPrev} onNext={() => {}} onToday={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mese precedente' }))
    expect(onPrev).toHaveBeenCalledOnce()
  })

  it('5. next click calls onNext', () => {
    const onNext = vi.fn()
    render(<PeriodStepper label="nov 2026" onPrev={() => {}} onNext={onNext} onToday={() => {}} />)
    fireEvent.click(screen.getByRole('button', { name: 'Mese successivo' }))
    expect(onNext).toHaveBeenCalledOnce()
  })

  it('6. today click calls onToday', () => {
    const onToday = vi.fn()
    render(<PeriodStepper label="nov 2026" onPrev={() => {}} onNext={() => {}} onToday={onToday} />)
    fireEvent.click(screen.getByRole('button', { name: 'Vai a oggi' }))
    expect(onToday).toHaveBeenCalledOnce()
  })
})
