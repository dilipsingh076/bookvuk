import { useEffect, useRef, useState } from "react";

/**
 * Generic hook for future API integration.
 * Right now it consumes the placeholder functions in `src/api/index.ts`.
 */
const useFetch = <T,>(
  fetcher: () => Promise<T>,
  deps: React.DependencyList = []
): { data: T | null; loading: boolean; error: unknown } => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const requestIdRef = useRef(0);

  useEffect(() => {
    requestIdRef.current += 1;
    const requestId = requestIdRef.current;
    setLoading(true);
    setError(null);

    (async () => {
      try {
        const result = await fetcher();
        if (requestIdRef.current === requestId) setData(result);
      } catch (e) {
        if (requestIdRef.current === requestId) setError(e);
      } finally {
        if (requestIdRef.current === requestId) setLoading(false);
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  return { data, loading, error };
};

export default useFetch;

