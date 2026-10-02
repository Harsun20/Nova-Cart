import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShoppingCart, Trash2, Info } from 'lucide-react';
import { api } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { useApp } from '../hooks/useApp.jsx';
import { Async, ConfirmModal, Empty, Modal, StatusBadge } from '../components/ui.jsx';
import { ConfidenceBreakdown, EtaText, ProductCard, TrustScore } from '../components/trust.jsx';
import { inr } from '../utils/format.js';

function ProductModal({ item, onClose, onAdd }) {
  const disabled = item.qty <= 0;
  return (
    <Modal title={item.product.name} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Close</button><button className="btn primary" disabled={disabled} onClick={() => { onAdd(item); onClose(); }}><Plus size={16} aria-hidden /> Add to cart</button></>}>
      <div className="row" style={{ gap: 16, flexWrap: 'nowrap' }}>
        <TrustScore value={item.confidence} size={84} label="Fulfillment confidence" />
        <div className="stack" style={{ gap: 4 }}>
          <div className="small muted">Sold by {item.store.name}</div>
          <div className="strong">{inr(item.product.price)}</div>
          <div className="row"><StatusBadge label={item.label}>{item.availabilityText}</StatusBadge><span className="small">ETA <EtaText eta={item.eta} /></span></div>
        </div>
      </div>
      <h3 style={{ margin: '16px 0 6px' }}>Why this score</h3>
      <ConfidenceBreakdown factors={item.factors} showWeights />
      <p className="tiny muted">{item.model}. Deterministic weighted score, not machine learning.</p>
      <div className="recovery" style={{ marginTop: 12 }}>
        <div className="strong small">Promotion status</div>
        <div className="small">{item.coupon.reason}</div>
      </div>
    </Modal>
  );
}

function Cart({ cart, setCart }) {
  const { toast, navigate, bump } = useApp();
  const [coupon, setCoupon] = useState('AUTO');
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [quote, setQuote] = useState(null);
  const [err, setErr] = useState(null);
  const storeId = cart[0]?.storeId;
  const payload = useMemo(
    () => ({ storeId, items: cart.map((c) => ({ inventoryId: c.inventoryId, qty: c.qty })), couponCode: coupon }),
    [cart, storeId, coupon]
  );
  const { rev } = useApp();

  useEffect(() => {
    if (!cart.length) { setQuote(null); setErr(null); return undefined; }
    let cancelled = false;
    api.quote(payload).then((q) => { if (!cancelled) { setQuote({ ...q.pricing, eta: q.eta }); setErr(null); } }).catch((e) => !cancelled && setErr(e.message));
    return () => { cancelled = true; };
  }, [payload, cart.length, rev]);

  const change = (id, d) => setCart((c) => c.map((x) => (x.inventoryId === id ? { ...x, qty: Math.max(1, Math.min(10, x.qty + d)) } : x)));
  const remove = (id) => setCart((c) => c.filter((x) => x.inventoryId !== id));

  const place = async () => {
    setBusy(true);
    try {
      const { order } = await api.createOrder(payload);
      setCart([]); setConfirm(false); bump();
      toast(`Order ${order.id} confirmed`);
      navigate(`orders/${order.id}`);
    } catch (e) { toast(e.message, 'error'); setConfirm(false); bump(); } finally { setBusy(false); }
  };

  if (!cart.length) return <section className="card"><h2><ShoppingCart size={18} aria-hidden /> Cart</h2><Empty text="Your cart is empty. Add a Trust Pick to see transparent pricing." /></section>;
  const q = quote;
  return (
    <section className="card sticky">
      <div className="card-head"><h2><ShoppingCart size={18} aria-hidden /> Cart &middot; {cart[0].storeName}</h2><button className="btn sm" onClick={() => setCart([])}>Clear</button></div>
      <div className="stack" style={{ gap: 8 }}>
        {cart.map((c) => (
          <div key={c.inventoryId} className="row between" style={{ flexWrap: 'nowrap' }}>
            <div style={{ minWidth: 0 }}><div className="small strong">{c.emoji} {c.name}</div><div className="tiny muted">{inr(c.price)} each</div></div>
            <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
              <button className="btn sm" aria-label={`Decrease ${c.name}`} onClick={() => change(c.inventoryId, -1)} disabled={c.qty <= 1}><Minus size={14} /></button>
              <span className="mono" aria-live="polite" style={{ minWidth: 18, textAlign: 'center' }}>{c.qty}</span>
              <button className="btn sm" aria-label={`Increase ${c.name}`} onClick={() => change(c.inventoryId, 1)} disabled={c.qty >= 10}><Plus size={14} /></button>
              <button className="btn sm danger" aria-label={`Remove ${c.name}`} onClick={() => remove(c.inventoryId)}><Trash2 size={14} /></button>
            </div>
          </div>
        ))}
      </div>
      {err && <p className="small" style={{ color: 'var(--bad)', marginTop: 10 }} role="alert">{err}</p>}
      {q && (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>Coupons</h3>
          <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Coupons">
            {[{ code: 'AUTO', title: 'Auto-apply best valid coupon', eligible: true, reason: q.appliedCoupon ? `Best: ${q.appliedCoupon}` : 'No eligible coupon', discount: 0 }, ...q.couponOptions, { code: 'NONE', title: 'No coupon', eligible: true, reason: '', discount: 0 }].map((o) => (
              <div key={o.code} role="radio" aria-checked={coupon === o.code} aria-disabled={!o.eligible} tabIndex={o.eligible ? 0 : -1}
                className={`coupon ${o.eligible ? '' : 'off'}`}
                onClick={() => o.eligible && setCoupon(o.code)} onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && o.eligible && (e.preventDefault(), setCoupon(o.code))}>
                <div className="row between"><b className="small">{o.code === 'AUTO' || o.code === 'NONE' ? o.title : o.code}</b>{o.discount > 0 && <span className="badge good">-{inr(o.discount)}</span>}</div>
                {o.code !== 'AUTO' && o.code !== 'NONE' && <div className="tiny">{o.title}</div>}
                {o.reason && <div className="tiny muted">{o.reason}</div>}
              </div>
            ))}
          </div>
          {q.promoTier !== 'FULL' && <p className="small row" style={{ marginTop: 8, color: q.promoTier === 'DISABLED' ? 'var(--bad)' : 'var(--warn)' }}><Info size={15} aria-hidden /> {q.promoMessage}</p>}
          {q.warning && <p className="small" style={{ color: 'var(--warn)' }}>{q.warning}</p>}
          <h3 style={{ margin: '16px 0 4px' }}>Price breakdown</h3>
          <div className="pricerow"><span>Item total</span><span className="mono">{inr(q.itemTotal)}</span></div>
          <div className="pricerow"><span>Delivery fee</span><span className="mono">{q.deliveryFee ? inr(q.deliveryFee) : 'Free'}</span></div>
          {q.surge > 0 && <div className="pricerow"><span>Traffic surge</span><span className="mono">{inr(q.surge)}</span></div>}
          <div className="pricerow"><span>Taxes ({q.notes.taxRatePct}%)</span><span className="mono">{inr(q.taxes)}</span></div>
          <div className="pricerow"><span>Discount {q.appliedCoupon && `(${q.appliedCoupon})`}</span><span className="mono" style={{ color: 'var(--good)' }}>-{inr(q.discount)}</span></div>
          <div className="pricerow total"><span>Final amount</span><span className="mono">{inr(q.total)}</span></div>
          <div className="recovery" style={{ margin: '12px 0' }}>
            <div className="small">Delivery promise</div>
            <div className="strong"><EtaText eta={q.eta} /> &middot; confidence {q.cartConfidence}%</div>
            <div className="tiny muted">Late by more than the window? You are compensated automatically.</div>
          </div>
          <button className="btn primary block" onClick={() => setConfirm(true)}>Place order &middot; {inr(q.total)}</button>
        </>
      )}
      {confirm && q && <ConfirmModal title="Place this order?" text={`${inr(q.total)} will be charged (simulated). Promise: ${q.eta.min}\u2013${q.eta.max} minutes.`} confirmLabel="Place order" busy={busy} onConfirm={place} onClose={() => setConfirm(false)} />}
    </section>
  );
}

export default function Customer() {
  const { cart, setCart, toast } = useApp();
  const [showHidden, setShowHidden] = useState(false);
  const [open, setOpen] = useState(null);
  const [pending, setPending] = useState(null);
  const [filter, setFilter] = useState('All');
  const s = useApi(() => api.trustPicks());

  const add = (item) => {
    const line = { inventoryId: item.inventoryId, storeId: item.storeId, storeName: item.store.name, name: item.product.name, emoji: item.product.emoji, price: item.product.price, qty: 1 };
    if (cart.length && cart[0].storeId !== item.storeId) return setPending(line);
    setCart((c) => {
      const ex = c.find((x) => x.inventoryId === line.inventoryId);
      return ex ? c.map((x) => (x.inventoryId === line.inventoryId ? { ...x, qty: Math.min(10, x.qty + 1) } : x)) : [...c, line];
    });
    toast(`${line.name} added to cart`);
  };

  return (
    <>
      <div>
        <h1>Trust Picks</h1>
        <p className="muted">What customers see after the Trust Engine filters, ranks and labels the catalog.</p>
      </div>
      <div className="split">
        <Async state={s}>
          {(d) => {
            const cats = ['All', ...new Set(d.picks.concat(d.hidden).map((x) => x.product.category))];
            const base = showHidden ? [...d.picks, ...d.hidden] : d.picks;
            const list = base.filter((x) => filter === 'All' || x.product.category === filter);
            return (
              <div className="stack">
                <div className="row between">
                  <div className="seg" role="group" aria-label="Category filter" style={{ overflowX: 'auto', maxWidth: '100%' }}>
                    {cats.map((c) => <button key={c} aria-pressed={filter === c} onClick={() => setFilter(c)}>{c}</button>)}
                  </div>
                  <label className="small row"><input type="checkbox" checked={showHidden} onChange={(e) => setShowHidden(e.target.checked)} /> Show {d.hidden.length} hidden low-confidence items</label>
                </div>
                <p className="tiny muted">{d.policy}</p>
                {list.length === 0 ? <Empty text="No items in this category are reliable right now." /> : (
                  <div className="grid g3">{list.map((it) => <ProductCard key={it.inventoryId} item={it} onOpen={setOpen} />)}</div>
                )}
              </div>
            );
          }}
        </Async>
        <Cart cart={cart} setCart={setCart} />
      </div>
      {open && <ProductModal item={open} onClose={() => setOpen(null)} onAdd={add} />}
      {pending && <ConfirmModal title="Start a new cart?" text={`Your cart has items from ${cart[0].storeName}. Orders are fulfilled by one store, so adding from ${pending.storeName} will replace it.`} confirmLabel="Replace cart" onConfirm={() => { setCart([pending]); setPending(null); toast(`${pending.name} added to cart`); }} onClose={() => setPending(null)} />}
    </>
  );
}
