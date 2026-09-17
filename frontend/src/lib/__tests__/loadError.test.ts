import { afterEach, describe, expect, it, vi } from "vitest";
import { reportLoadError } from "../loadError";

describe("reportLoadError", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  const spy = () => vi.spyOn(console, "error").mockImplementation(() => {});

  it("reports a real failure", () => {
    const log = spy();
    reportLoadError("Cart load error:", new Error("500"), new AbortController().signal);
    expect(log).toHaveBeenCalledWith("Cart load error:", expect.any(Error));
  });

  it("stays quiet once we have aborted the request ourselves", () => {
    const log = spy();
    const c = new AbortController();
    c.abort();
    reportLoadError("Cart load error:", new Error("aborted"), c.signal);
    expect(log).not.toHaveBeenCalled();
  });

  /* The measured case: Chrome rejects an aborted fetch with a plain TypeError
     whose message is indistinguishable from a dead server. Matching on the error
     would let this one through, which is the bug the helper exists to prevent. */
  it("stays quiet for the TypeError an aborted fetch actually produces", () => {
    const log = spy();
    const c = new AbortController();
    c.abort();
    reportLoadError("Cart load error:", new TypeError("Failed to fetch"), c.signal);
    expect(log).not.toHaveBeenCalled();
  });

  it("still reports when no signal was given", () => {
    const log = spy();
    reportLoadError("Wishlist fetch error:", new Error("boom"));
    expect(log).toHaveBeenCalledTimes(1);
  });

  /* A hard navigation never runs React's cleanup, so no signal is aborted — the
     document simply stops existing, taking every request with it. Measured, one
     reload mid-load reported three failures this way. */
  it("stays quiet once the document is being discarded", () => {
    const log = spy();
    window.dispatchEvent(new Event("pagehide"));
    reportLoadError("Cart load error:", new TypeError("Failed to fetch"));
    expect(log).not.toHaveBeenCalled();

    // Coming back from the back/forward cache makes the page live again.
    window.dispatchEvent(new Event("pageshow"));
    reportLoadError("Cart load error:", new TypeError("Failed to fetch"));
    expect(log).toHaveBeenCalledTimes(1);
  });
});
