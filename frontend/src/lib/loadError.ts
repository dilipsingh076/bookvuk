/**
 * One place that decides whether a failed load is worth reporting.
 *
 * The three provider effects — cart, wishlist, notifications — each fetch on
 * mount and each logged whatever came back from their `catch`. Navigating away
 * while one of those requests is in flight aborts it, and an aborted fetch
 * rejects like any other: measured in Chrome it arrives as a plain
 * `TypeError: Failed to fetch`, indistinguishable from a dead server by its
 * message. So every click on a link during a slow load printed a red
 * "Cart load error" that described nothing wrong.
 *
 * The signal is the discriminator, not the error. Sniffing for `AbortError` is
 * unreliable across browsers — that TypeError is the proof — but
 * `signal.aborted` is exactly the question being asked: did we cancel this
 * ourselves?
 */

/* The other way a load "fails": the document goes away.
 *
 * A client-side navigation runs React's cleanup, so the signal above catches it.
 * A hard one — typing a URL, reloading, following a link out — does not: the
 * browser discards the document and kills every request in flight without the
 * cleanup ever running, so the signal is not aborted and each provider reports a
 * failure into a console that is about to cease to exist.
 *
 * Measured, one reload mid-load produced three of them (cart, wishlist,
 * notifications). Harmless in a devtools tab, but a crash reporter wired up to
 * `console.error` would file all three as production incidents, which is how the
 * real cart failure it is meant to catch ends up buried.
 *
 * `pagehide` rather than `beforeunload`: it also fires when the page goes into
 * the back/forward cache, and it does not opt the page out of that cache.
 */
let unloading = false;
if (typeof window !== "undefined") {
  window.addEventListener("pagehide", () => {
    unloading = true;
  });
  // Restored from the back/forward cache: the document is live again.
  window.addEventListener("pageshow", () => {
    unloading = false;
  });
}

/**
 * Log a load failure unless we caused it by walking away.
 *
 * @param label  What failed, e.g. `"Cart load error:"`.
 * @param error  The rejection.
 * @param signal The signal belonging to the request. When it is aborted the
 *   component is already gone, so there is nothing to report and nobody to
 *   report it to.
 */
export const reportLoadError = (label: string, error: unknown, signal?: AbortSignal) => {
  if (signal?.aborted || unloading) return;
  console.error(label, error);
};
