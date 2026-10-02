import { useCallback, useEffect, useRef, useState } from 'react';
import { useApp } from './useApp.jsx';

// Fetches on mount and whenever deps or the global data revision change.
export function useApi(fetcher, deps = []) {
  const { rev } = useApp();
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const fetchRef = useRef(fetcher);
  fetchRef.current = fetcher;

  useEffect(() => {
    let cancelled = false;
    setState((s) => ({ ...s, loading: true, error: null }));
    fetchRef
      .current()
      .then((data) => !cancelled && setState({ data, loading: false, error: null }))
      .catch((e) => !cancelled && setState((s) => ({ data: s.data, loading: false, error: e.message })));
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rev, tick, ...deps]);

  const reload = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, reload };
}
