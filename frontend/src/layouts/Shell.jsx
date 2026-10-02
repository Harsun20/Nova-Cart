import { useState } from 'react';
import { BarChart3, ClipboardList, Gauge, Headset, LayoutDashboard, Menu, RotateCcw, ShieldCheck, ShoppingBag, Store, Wallet } from 'lucide-react';
import { useApp } from '../hooks/useApp.jsx';
import { useApi } from '../hooks/useApi.js';
import { api } from '../services/api.js';
import { ConfirmModal, Modal } from '../components/ui.jsx';
import { inr } from '../utils/format.js';

export const NAV = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'customer', label: 'Customer Experience', icon: ShoppingBag },
  { id: 'trust', label: 'Trust Engine', icon: Gauge },
  { id: 'partners', label: 'Partner Stores', icon: Store },
  { id: 'orders', label: 'Orders', icon: ClipboardList },
  { id: 'support', label: 'Support Cockpit', icon: Headset },
  { id: 'analytics', label: 'Analytics', icon: BarChart3 }
];

export default function Shell({ page, children }) {
  const { navigate, bump, toast, cart } = useApp();
  const [open, setOpen] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [info, setInfo] = useState(false);
  const [busy, setBusy] = useState(false);
  const wallet = useApi(() => api.wallet(), []);
  const current = NAV.find((n) => n.id === page);

  const go = (id) => { setOpen(false); navigate(id); };
  const doReset = async () => {
    setBusy(true);
    try {
      await api.reset();
      window.dispatchEvent(new Event('demo-reset'));
      bump();
      toast('Demo data reset to its initial state.');
      setConfirmReset(false);
    } catch (e) {
      toast(e.message, 'error');
    } finally { setBusy(false); }
  };

  return (
    <div className="shell">
      <aside className={`sidebar ${open ? 'open' : ''}`} aria-label="Main navigation">
        <div className="brand"><span className="brand-mark"><ShieldCheck size={18} aria-hidden /></span> Nova Cart<br /><span style={{ fontWeight: 500, color: '#94a3b8', fontSize: '.8rem' }}>Trust Engine</span></div>
        <nav className="stack" style={{ gap: 4 }}>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} className="nav-btn" aria-current={page === id ? 'page' : undefined} onClick={() => go(id)}>
              <Icon size={18} aria-hidden /> {label}{id === 'customer' && cart.length > 0 ? ` (${cart.reduce((a, c) => a + c.qty, 0)})` : ''}
            </button>
          ))}
        </nav>
        <div className="sidebar-foot">Simulated operational data.<br />No real payments or tracking.</div>
      </aside>
      <div className={`scrim ${open ? 'open' : ''}`} onClick={() => setOpen(false)} />
      <div className="main">
        <header className="topbar">
          <div className="row">
            <button className="btn sm menu-btn" aria-label="Open menu" onClick={() => setOpen(true)}><Menu size={18} /></button>
            <strong>{current?.label}</strong>
          </div>
          <div className="row">
            <button className="demo-pill" style={{ cursor: 'pointer' }} onClick={() => setInfo(true)} aria-label="About demo mode">Demo Mode</button>
            <span className="badge neutral" title="Simulated wallet for the demo customer"><Wallet size={13} aria-hidden /> {inr(wallet.data?.balance ?? 0)}</span>
            <button className="btn sm" onClick={() => setConfirmReset(true)}><RotateCcw size={14} aria-hidden /> Reset Demo</button>
          </div>
        </header>
        <main className="content page" key={page}>{children}</main>
      </div>
      {info && (
        <Modal title="Demo Mode" onClose={() => setInfo(false)}>
          <p className="muted">Demo Mode uses simulated Nova Cart operational data to demonstrate the Trust Engine. Confidence scores, ETAs, recoveries and analytics projections are computed by transparent prototype rules, not a trained model, and no real money or riders are involved.</p>
        </Modal>
      )}
      {confirmReset && (
        <ConfirmModal title="Reset demo?" text="This restores inventory, orders, tickets and the wallet to their initial state." confirmLabel="Reset" busy={busy} onConfirm={doReset} onClose={() => setConfirmReset(false)} />
      )}
    </div>
  );
}
