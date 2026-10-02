import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { ToastHost } from '../components/ui.jsx';

const Ctx = createContext(null);
export const useApp = () => useContext(Ctx);

function parseHash() {
  const [page = '', param = ''] = window.location.hash.replace(/^#\/?/, '').split('/');
  return { page, param: decodeURIComponent(param) };
}

export function AppProvider({ children }) {
  const [route, setRoute] = useState(parseHash());
  const [rev, setRev] = useState(0);
  const [cart, setCart] = useState([]);
  const [toasts, setToasts] = useState([]);

  useEffect(() => {
    const on = () => setRoute(parseHash());
    window.addEventListener('hashchange', on);
    return () => window.removeEventListener('hashchange', on);
  }, []);

  const navigate = useCallback((path) => {
    window.location.hash = `#/${path}`;
    window.scrollTo({ top: 0 });
  }, []);
  const bump = useCallback(() => setRev((r) => r + 1), []);
  const toast = useCallback((message, type = 'success') => {
    const id = Math.random().toString(36).slice(2);
    setToasts((t) => [...t, { id, message, type }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 4200);
  }, []);

  const value = useMemo(
    () => ({ route, navigate, rev, bump, toast, cart, setCart }),
    [route, navigate, rev, bump, toast, cart]
  );
  return (
    <Ctx.Provider value={value}>
      {children}
      <ToastHost toasts={toasts} onClose={(id) => setToasts((t) => t.filter((x) => x.id !== id))} />
    </Ctx.Provider>
  );
}
