"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Fetch-on-mount with an optional shared cache.
 *
 * Without a `cacheKey` this behaves exactly as before: every mount refetches.
 * With one, results are shared across components and remounts for `ttlMs`, and
 * concurrent callers asking for the same key wait on one request instead of
 * firing several. Navigating between pages that show the same data used to
 * re-request it each time.
 */

type CacheEntry = { at: number; value: unknown };

const cache = new Map<string, CacheEntry>();
const inFlight = new Map<string, Promise<unknown>>();

const DEFAULT_TTL_MS = 60_000;

type Options<T> = {
  /** Enables sharing/dedupe. Omit for the previous per-mount behaviour. */
  cacheKey?: string;
  ttlMs?: number;
  /**
   * Data already fetched on the server for the first render.
   *
   * This is what makes server-rendering worth anything here. Without it a page
   * ships a skeleton and asks for its data on mount, so the HTML a crawler or a
   * link-preview scraper reads contains no books — only placeholders. With it the
   * first paint is real content, and the client still refetches when the deps
   * change (a filter, a page, a search term).
   */
  initialData?: T | null;
};

const useFetch = <T,>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = [],
  options: Options<T> = {},
): { data: T | null; loading: boolean; error: unknown } => {
  const { cacheKey, ttlMs = DEFAULT_TTL_MS, initialData = null } = options;

  const cached = cacheKey ? cache.get(cacheKey) : undefined;
  const fresh = cached !== undefined && Date.now() - cached.at < ttlMs;

  // Server data seeds the shared cache too, so a sibling component asking for
  // the same key does not fire a request the server already answered.
  if (initialData !== null && cacheKey && !fresh) {
    cache.set(cacheKey, { at: Date.now(), value: initialData });
  }

  const seeded = fresh ? (cached!.value as T) : initialData;
  const [data, setData] = useState<T | null>(seeded);
  const [loading, setLoading] = useState(seeded === null);
  const [error, setError] = useState<unknown>(null);
  const requestIdRef = useRef(0);
  /* Server data already satisfies the first render, so the mount effect must not
   * refetch it.
   *
   * Without this the page flickered: the server sent the book, then the effect
   * set `loading` and the component swapped in its skeleton, then the answer came
   * back and the content returned. Content, skeleton, content — worse than the
   * skeleton alone, because the visitor watches the page undo itself. It also
   * threw away a request the server had already paid for.
   *
   * Only the *first* run is skipped. A change of deps — another book, another
   * filter, page two — is a genuinely different question and still fetches. */
  const servedFromServer = useRef(initialData !== null);

  useEffect(() => {
    if (servedFromServer.current) {
      servedFromServer.current = false;
      return;
    }

    requestIdRef.current += 1;
    const requestId = requestIdRef.current;

    const hit = cacheKey ? cache.get(cacheKey) : undefined;
    if (hit !== undefined && Date.now() - hit.at < ttlMs) {
      setData(hit.value as T);
      setError(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    // Collapse concurrent callers for the same key onto one request.
    let promise: Promise<unknown>;
    if (cacheKey) {
      const existing = inFlight.get(cacheKey);
      if (existing) {
        promise = existing;
      } else {
        promise = fetcher()
          .then((result) => {
            cache.set(cacheKey, { at: Date.now(), value: result });
            return result;
          })
          .finally(() => {
            inFlight.delete(cacheKey);
          });
        inFlight.set(cacheKey, promise);
      }
    } else {
      promise = fetcher();
    }

    promise
      .then((result) => {
        if (requestIdRef.current === requestId) setData(result as T);
      })
      .catch((e) => {
        if (requestIdRef.current === requestId) setError(e);
      })
      .finally(() => {
        if (requestIdRef.current === requestId) setLoading(false);
      });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
};

export default useFetch;
