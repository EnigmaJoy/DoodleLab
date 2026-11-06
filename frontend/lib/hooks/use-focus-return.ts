/**
 * Returns a function that defers focus to the given element by one frame.
 * Needed after state changes that cause re-renders — the target must be
 * mounted and visible before .focus() is called.
 */
export function useFocusReturn() {
  return function returnFocus(el: HTMLElement | null | undefined): void {
    if (!el) return
    setTimeout(() => el.focus(), 0)
  }
}
