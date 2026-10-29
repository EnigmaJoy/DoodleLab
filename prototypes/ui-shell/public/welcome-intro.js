/* Welcome intro gate. Static, same-origin, no data.
   Loaded synchronously from <head> so the decision is made before first paint:
   the intro CSS applies only under html[data-welcome-intro], and the base CSS is the
   final visible state. The attribute is removed when the intro is over (3.4s). */
(function () {
  try {
    var root = document.documentElement;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    if (document.visibilityState !== 'visible') return;
    root.setAttribute('data-welcome-intro', '');
    setTimeout(function () {
      root.removeAttribute('data-welcome-intro');
    }, 3400);
  } catch (e) {
    /* No intro: the final state is already the default style. */
  }
})();
