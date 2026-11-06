// @vitest-environment jsdom
import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'
import { IconButton } from './IconButton'

describe('IconButton', () => {
  it('1. renders a button with the given aria-label', () => {
    render(<IconButton label="Aggiungi" icon={<span>+</span>} onClick={() => {}} />)
    expect(screen.getByRole('button', { name: 'Aggiungi' })).toBeTruthy()
  })

  it('2. calls onClick when clicked', () => {
    const onClick = vi.fn()
    render(<IconButton label="Aggiungi" icon={<span>+</span>} onClick={onClick} />)
    fireEvent.click(screen.getByRole('button', { name: 'Aggiungi' }))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('3. renders the icon node', () => {
    render(<IconButton label="X" icon={<span data-testid="icon">+</span>} onClick={() => {}} />)
    expect(document.querySelector('[data-testid="icon"]')).toBeTruthy()
  })
})
