import { useEffect } from 'react';
import { useApp } from './hooks/useApp.jsx';
import Shell from './layouts/Shell.jsx';
import Landing from './pages/Landing.jsx';
import Overview from './pages/Overview.jsx';
import Customer from './pages/Customer.jsx';
import TrustEngine from './pages/TrustEngine.jsx';
import Partners from './pages/Partners.jsx';
import Orders from './pages/Orders.jsx';
import Support from './pages/Support.jsx';
import Analytics from './pages/Analytics.jsx';

const PAGES = { overview: Overview, customer: Customer, trust: TrustEngine, partners: Partners, orders: Orders, support: Support, analytics: Analytics };

export default function App() {
  const { route, navigate, setCart } = useApp();
  useEffect(() => {
    const clear = () => setCart([]);
    window.addEventListener('demo-reset', clear);
    return () => window.removeEventListener('demo-reset', clear);
  }, [setCart]);

  const Page = PAGES[route.page];
  if (!Page) return <Landing onOpen={() => navigate('overview')} />;
  return <Shell page={route.page}><Page param={route.param} /></Shell>;
}
