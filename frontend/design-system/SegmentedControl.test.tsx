// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { SegmentedControl } from './SegmentedControl'

const OPTIONS = [
  { value: 'free',  label: 'Libera' },
  { value: 'grid',  label: 'Griglia' },
]

describe('SegmentedControl', () => {
  it('1. renders a radiogroup', () => {
    render(<SegmentedControl options={OPTIONS} value="free" onChange={() => {}} />)
    expect(screen.getByRole('radiogroup')).toBeTruthy()
  })

  it('2. renders a radio for each option', () => {
    render(<SegmentedControl options={OPTIONS} value="free" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Libera' })).toBeTruthy()
    expect(screen.getByRole('radio', { name: 'Griglia' })).toBeTruthy()
  })

  it('3. active option has aria-checked="true"', () => {
    render(<SegmentedControl options={OPTIONS} value="grid" onChange={() => {}} />)
    expect(screen.getByRole('radio', { name: 'Griglia' }).getAttribute('aria-checked')).toBe('true')
    expect(screen.getByRole('radio', { name: 'Libera' }).getAttribute('aria-checked')).toBe('false')
  })

  it('4. clicking inactive option calls onChange with its value', () => {
    const onChange = vi.fn()
    render(<SegmentedControl options={OPTIONS} value="free" onChange={onChange} />)
    fireEvent.click(screen.getByRole('radio', { name: 'Griglia' }))
    expect(onChange).toHaveBeenCalledWith('grid')
  })

  it('5. aria-label applied to radiogroup when label prop provided', () => {
    render(
      <SegmentedControl options={OPTIONS} value="free" onChange={() => {}} label="Layout" />
    )
    expect(screen.getByRole('radiogroup', { name: 'Layout' })).toBeTruthy()
  })
})
