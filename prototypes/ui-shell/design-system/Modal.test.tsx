import { renderHook, act } from '@testing-library/react'
import { useModalState } from './Modal'

test('initial state is closed', () => {
  const { result } = renderHook(() => useModalState())
  expect(result.current.isOpen).toBe(false)
})

test('open() sets isOpen to true', () => {
  const { result } = renderHook(() => useModalState())
  act(() => result.current.open())
  expect(result.current.isOpen).toBe(true)
})

test('close() sets isOpen to false', () => {
  const { result } = renderHook(() => useModalState())
  act(() => result.current.open())
  act(() => result.current.close())
  expect(result.current.isOpen).toBe(false)
})

test('useModalState(true) starts open', () => {
  const { result } = renderHook(() => useModalState(true))
  expect(result.current.isOpen).toBe(true)
})
