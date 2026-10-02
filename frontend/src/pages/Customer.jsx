import { useEffect, useMemo, useState } from 'react';
import { Minus, Plus, ShoppingCart, Trash2, Info, MapPin, Navigation, Bike, ShoppingBag, ShieldCheck, ArrowRight, RotateCcw } from 'lucide-react';
import { api } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { useApp } from '../hooks/useApp.jsx';
import { Async, ConfirmModal, Empty, Modal, StatusBadge } from '../components/ui.jsx';
import { ConfidenceBreakdown, EtaText, ProductCard, TrustScore } from '../components/trust.jsx';
import { inr } from '../utils/format.js';
import LiveRiderMap from '../components/LiveRiderMap.jsx';

function ProductModal({ item, onClose, onAdd }) {
  const disabled = item.qty <= 0;
  return (
    <Modal
      title={item.product.name}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>
            Close
          </button>
          <button
            className="btn primary"
            disabled={disabled}
            onClick={() => {
              onAdd(item);
              onClose();
            }}
          >
            <Plus size={16} aria-hidden /> Add to cart
          </button>
        </>
      }
    >
      <div className="row" style={{ gap: 16, flexWrap: 'nowrap' }}>
        <TrustScore value={item.confidence} size={84} label="Fulfillment confidence" />
        <div className="stack" style={{ gap: 4 }}>
          <div className="small muted">Sold by {item.store.name}</div>
          <div className="strong">{inr(item.product.price)}</div>
          <div className="row">
            <StatusBadge label={item.label}>{item.availabilityText}</StatusBadge>
            <span className="small">
              ETA <EtaText eta={item.eta} />
            </span>
          </div>
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

function Cart({ cart, setCart, onOrderPlaced }) {
  const { toast, bump } = useApp();
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
    if (!cart.length) {
      setQuote(null);
      setErr(null);
      return undefined;
    }
    let cancelled = false;
    api
      .quote(payload)
      .then((q) => {
        if (!cancelled) {
          setQuote({ ...q.pricing, eta: q.eta });
          setErr(null);
        }
      })
      .catch((e) => !cancelled && setErr(e.message));
    return () => {
      cancelled = true;
    };
  }, [payload, cart.length, rev]);

  const change = (id, d) =>
    setCart((c) => c.map((x) => (x.inventoryId === id ? { ...x, qty: Math.max(1, Math.min(10, x.qty + d)) } : x)));
  const remove = (id) => setCart((c) => c.filter((x) => x.inventoryId !== id));

  const place = async () => {
    setBusy(true);
    try {
      const { order } = await api.createOrder(payload);
      setCart([]);
      setConfirm(false);
      bump();
      toast(`Order ${order.id} confirmed! Opening live rider map...`);
      if (onOrderPlaced) {
        onOrderPlaced(order);
      }
    } catch (e) {
      toast(e.message, 'error');
      setConfirm(false);
      bump();
    } finally {
      setBusy(false);
    }
  };

  if (!cart.length)
    return (
      <section className="card">
        <h2>
          <ShoppingCart size={18} aria-hidden /> Cart
        </h2>
        <Empty text="Your cart is empty. Add a Trust Pick to see transparent pricing." />
      </section>
    );

  const q = quote;
  return (
    <section className="card sticky">
      <div className="card-head">
        <h2>
          <ShoppingCart size={18} aria-hidden /> Cart &middot; {cart[0].storeName}
        </h2>
        <button className="btn sm" onClick={() => setCart([])}>
          Clear
        </button>
      </div>
      <div className="stack" style={{ gap: 8 }}>
        {cart.map((c) => (
          <div key={c.inventoryId} className="row between" style={{ flexWrap: 'nowrap' }}>
            <div style={{ minWidth: 0 }}>
              <div className="small strong">
                {c.emoji} {c.name}
              </div>
              <div className="tiny muted">{inr(c.price)} each</div>
            </div>
            <div className="row" style={{ gap: 4, flexWrap: 'nowrap' }}>
              <button
                className="btn sm"
                aria-label={`Decrease ${c.name}`}
                onClick={() => change(c.inventoryId, -1)}
                disabled={c.qty <= 1}
              >
                <Minus size={14} />
              </button>
              <span className="mono" aria-live="polite" style={{ minWidth: 18, textAlign: 'center' }}>
                {c.qty}
              </span>
              <button
                className="btn sm"
                aria-label={`Increase ${c.name}`}
                onClick={() => change(c.inventoryId, 1)}
                disabled={c.qty >= 10}
              >
                <Plus size={14} />
              </button>
              <button
                className="btn sm danger"
                aria-label={`Remove ${c.name}`}
                onClick={() => remove(c.inventoryId)}
              >
                <Trash2 size={14} />
              </button>
            </div>
          </div>
        ))}
      </div>
      {err && (
        <p className="small" style={{ color: 'var(--bad)', marginTop: 10 }} role="alert">
          {err}
        </p>
      )}
      {q && (
        <>
          <h3 style={{ margin: '16px 0 8px' }}>Coupons</h3>
          <div className="stack" style={{ gap: 8 }} role="radiogroup" aria-label="Coupons">
            {[
              {
                code: 'AUTO',
                title: 'Auto-apply best valid coupon',
                eligible: true,
                reason: q.appliedCoupon ? `Best: ${q.appliedCoupon}` : 'No eligible coupon',
                discount: 0
              },
              ...q.couponOptions,
              { code: 'NONE', title: 'No coupon', eligible: true, reason: '', discount: 0 }
            ].map((o) => (
              <div
                key={o.code}
                role="radio"
                aria-checked={coupon === o.code}
                aria-disabled={!o.eligible}
                tabIndex={o.eligible ? 0 : -1}
                className={`coupon ${o.eligible ? '' : 'off'}`}
                onClick={() => o.eligible && setCoupon(o.code)}
                onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && o.eligible && (e.preventDefault(), setCoupon(o.code))}
              >
                <div className="row between">
                  <b className="small">{o.code === 'AUTO' || o.code === 'NONE' ? o.title : o.code}</b>
                  {o.discount > 0 && <span className="badge good">-{inr(o.discount)}</span>}
                </div>
                {o.code !== 'AUTO' && o.code !== 'NONE' && <div className="tiny">{o.title}</div>}
                {o.reason && <div className="tiny muted">{o.reason}</div>}
              </div>
            ))}
          </div>
          {q.promoTier !== 'FULL' && (
            <p className="small row" style={{ marginTop: 8, color: q.promoTier === 'DISABLED' ? 'var(--bad)' : 'var(--warn)' }}>
              <Info size={15} aria-hidden /> {q.promoMessage}
            </p>
          )}
          {q.warning && <p className="small" style={{ color: 'var(--warn)' }}>{q.warning}</p>}
          <h3 style={{ margin: '16px 0 4px' }}>Price breakdown</h3>
          <div className="pricerow">
            <span>Item total</span>
            <span className="mono">{inr(q.itemTotal)}</span>
          </div>
          <div className="pricerow">
            <span>Delivery fee</span>
            <span className="mono">{q.deliveryFee ? inr(q.deliveryFee) : 'Free'}</span>
          </div>
          {q.surge > 0 && (
            <div className="pricerow">
              <span>Traffic surge</span>
              <span className="mono">{inr(q.surge)}</span>
            </div>
          )}
          <div className="pricerow">
            <span>Taxes ({q.notes.taxRatePct}%)</span>
            <span className="mono">{inr(q.taxes)}</span>
          </div>
          <div className="pricerow">
            <span>Discount {q.appliedCoupon && `(${q.appliedCoupon})`}</span>
            <span className="mono" style={{ color: 'var(--good)' }}>
              -{inr(q.discount)}
            </span>
          </div>
          <div className="pricerow total">
            <span>Final amount</span>
            <span className="mono">{inr(q.total)}</span>
          </div>
          <div className="recovery" style={{ margin: '12px 0' }}>
            <div className="small">Delivery promise</div>
            <div className="strong">
              <EtaText eta={q.eta} /> &middot; confidence {q.cartConfidence}%
            </div>
            <div className="tiny muted">Late by more than the window? You are compensated automatically.</div>
          </div>
          <button className="btn primary block" onClick={() => setConfirm(true)}>
            Place order &middot; {inr(q.total)}
          </button>
        </>
      )}
      {confirm && q && (
        <ConfirmModal
          title="Place this order?"
          text={`${inr(q.total)} will be charged (simulated). Promise: ${q.eta.min}\u2013${q.eta.max} minutes.`}
          confirmLabel="Place order"
          busy={busy}
          onConfirm={place}
          onClose={() => setConfirm(false)}
        />
      )}
    </section>
  );
}

export default function Customer() {
  const { cart, setCart, toast, rev, bump } = useApp();
  const [activeTab, setActiveTab] = useState('catalog'); // 'catalog' | 'tracking'
  const [showHidden, setShowHidden] = useState(false);
  const [open, setOpen] = useState(null);
  const [pending, setPending] = useState(null);
  const [filter, setFilter] = useState('All');
  const [selectedOrderId, setSelectedOrderId] = useState(null);

  const picksApi = useApi(() => api.trustPicks());
  const ordersApi = useApi(() => api.orders(), [rev]);

  // Find active orders
  const ordersList = ordersApi.data?.orders || [];
  const activeOrders = ordersList.filter(
    (o) => !['delivered', 'cancelled', 'rejected'].includes(o.status)
  );

  // If no specific order selected, select the first active order or most recent order
  useEffect(() => {
    if (!selectedOrderId && ordersList.length > 0) {
      const best = activeOrders[0] || ordersList[0];
      setSelectedOrderId(best.id);
    }
  }, [ordersList, activeOrders, selectedOrderId]);

  // Current tracked order
  const currentOrder = useMemo(() => {
    return ordersList.find((o) => o.id === selectedOrderId) || activeOrders[0] || ordersList[0] || null;
  }, [ordersList, selectedOrderId, activeOrders]);

  const add = (item) => {
    const line = {
      inventoryId: item.inventoryId,
      storeId: item.storeId,
      storeName: item.store.name,
      name: item.product.name,
      emoji: item.product.emoji,
      price: item.product.price,
      qty: 1
    };
    if (cart.length && cart[0].storeId !== item.storeId) return setPending(line);
    setCart((c) => {
      const ex = c.find((x) => x.inventoryId === line.inventoryId);
      return ex ? c.map((x) => (x.inventoryId === line.inventoryId ? { ...x, qty: Math.min(10, x.qty + 1) } : x)) : [...c, line];
    });
    toast(`${line.name} added to cart`);
  };

  const handleOrderPlaced = (order) => {
    setSelectedOrderId(order.id);
    setActiveTab('tracking');
    bump();
  };

  const handleOrderAction = async (actionFn, successMsg) => {
    try {
      await actionFn();
      bump();
      toast(successMsg);
    } catch (e) {
      toast(e.message, 'error');
    }
  };

  return (
    <>
      {/* Top Header & Experience View Switcher */}
      <div className="row between" style={{ alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
        <div>
          <h1 style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ShoppingBag size={28} color="var(--brand)" />
            Customer Experience
          </h1>
          <p className="muted">
            Shop transparently with confidence scores &middot; Track your rider's live location on the map in real time.
          </p>
        </div>

        {/* View Mode Switcher Pills */}
        <div className="seg" role="tablist" aria-label="Customer views">
          <button
            role="tab"
            aria-selected={activeTab === 'catalog'}
            aria-pressed={activeTab === 'catalog'}
            onClick={() => setActiveTab('catalog')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <ShoppingCart size={15} />
            <span>Browse & Order</span>
            {cart.length > 0 && (
              <span
                style={{
                  background: '#0f766e',
                  color: '#fff',
                  fontSize: '0.72rem',
                  padding: '1px 6px',
                  borderRadius: 99
                }}
              >
                {cart.reduce((a, c) => a + c.qty, 0)}
              </span>
            )}
          </button>

          <button
            role="tab"
            aria-selected={activeTab === 'tracking'}
            aria-pressed={activeTab === 'tracking'}
            onClick={() => setActiveTab('tracking')}
            style={{ display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <Bike size={16} />
            <span>Live Rider Tracking</span>
            {activeOrders.length > 0 && (
              <span
                style={{
                  background: '#22c55e',
                  color: '#fff',
                  fontSize: '0.72rem',
                  padding: '1px 7px',
                  borderRadius: 99,
                  fontWeight: 700,
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: 3
                }}
              >
                <span
                  style={{
                    width: 6,
                    height: 6,
                    borderRadius: '50%',
                    background: '#fff',
                    animation: 'spin 1.5s infinite'
                  }}
                />
                {activeOrders.length} LIVE
              </span>
            )}
          </button>
        </div>
      </div>

      {/* Prominent Active Delivery Banner if user is currently browsing the catalog */}
      {activeTab === 'catalog' && activeOrders.length > 0 && (
        <div
          className="card"
          style={{
            background: 'linear-gradient(90deg, #093430 0%, #0d1b2a 100%)',
            color: '#fff',
            padding: '12px 18px',
            border: '1px solid #14b8a6',
            boxShadow: '0 4px 14px rgba(15,23,42,0.15)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            gap: 12
          }}
        >
          <div className="row" style={{ gap: 12 }}>
            <div
              style={{
                width: 38,
                height: 38,
                borderRadius: '50%',
                background: '#0f766e',
                display: 'grid',
                placeItems: 'center',
                fontSize: '1.25rem'
              }}
            >
              🛵
            </div>
            <div>
              <div className="strong small" style={{ color: '#5eead4' }}>
                Live Delivery in Progress &middot; Order #{activeOrders[0].id}
              </div>
              <div className="tiny" style={{ color: '#cbd5e1' }}>
                {activeOrders[0].riderName ? `${activeOrders[0].riderName} is on the way` : 'Store is preparing your order'} &middot; Promised by {activeOrders[0].promised}
              </div>
            </div>
          </div>

          <button
            className="btn sm"
            style={{
              background: '#5eead4',
              color: '#0f172a',
              border: 0,
              fontWeight: 700,
              display: 'flex',
              alignItems: 'center',
              gap: 6
            }}
            onClick={() => {
              setSelectedOrderId(activeOrders[0].id);
              setActiveTab('tracking');
            }}
          >
            Track Rider on Live Map <ArrowRight size={14} />
          </button>
        </div>
      )}

      {/* TAB 1: BROWSE CATALOG & CART */}
      {activeTab === 'catalog' && (
        <div className="split">
          <Async state={picksApi}>
            {(d) => {
              const cats = ['All', ...new Set(d.picks.concat(d.hidden).map((x) => x.product.category))];
              const base = showHidden ? [...d.picks, ...d.hidden] : d.picks;
              const list = base.filter((x) => filter === 'All' || x.product.category === filter);
              return (
                <div className="stack">
                  <div className="row between">
                    <div className="seg" role="group" aria-label="Category filter" style={{ overflowX: 'auto', maxWidth: '100%' }}>
                      {cats.map((c) => (
                        <button key={c} aria-pressed={filter === c} onClick={() => setFilter(c)}>
                          {c}
                        </button>
                      ))}
                    </div>
                    <label className="small row">
                      <input
                        type="checkbox"
                        checked={showHidden}
                        onChange={(e) => setShowHidden(e.target.checked)}
                      />{' '}
                      Show {d.hidden.length} hidden low-confidence items
                    </label>
                  </div>
                  <p className="tiny muted">{d.policy}</p>
                  {list.length === 0 ? (
                    <Empty text="No items in this category are reliable right now." />
                  ) : (
                    <div className="grid g3">
                      {list.map((it) => (
                        <ProductCard key={it.inventoryId} item={it} onOpen={setOpen} />
                      ))}
                    </div>
                  )}
                </div>
              );
            }}
          </Async>
          <Cart cart={cart} setCart={setCart} onOrderPlaced={handleOrderPlaced} />
        </div>
      )}

      {/* TAB 2: LIVE RIDER TRACKING (UBER STYLE) */}
      {activeTab === 'tracking' && (
        <div className="stack" style={{ gap: 18 }}>
          {ordersList.length === 0 ? (
            <div className="card" style={{ textAlign: 'center', padding: '40px 20px' }}>
              <div style={{ fontSize: '3rem', marginBottom: 12 }}>📦</div>
              <h2>No active orders found</h2>
              <p className="muted" style={{ maxWidth: 460, margin: '8px auto 20px' }}>
                You haven't placed an order yet. Choose a reliable product from our Trust Picks catalog to see transparent pricing and live delivery tracking.
              </p>
              <button className="btn primary" onClick={() => setActiveTab('catalog')}>
                <ShoppingCart size={16} /> Browse Trust Picks & Order
              </button>
            </div>
          ) : (
            <>
              {/* Order selector bar if multiple orders exist */}
              <div
                className="card"
                style={{
                  padding: '10px 16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  flexWrap: 'wrap',
                  gap: 10
                }}
              >
                <div className="row" style={{ gap: 8 }}>
                  <span className="small strong">Select Order:</span>
                  <select
                    value={currentOrder?.id || ''}
                    onChange={(e) => setSelectedOrderId(e.target.value)}
                    style={{
                      padding: '5px 12px',
                      borderRadius: 8,
                      border: '1px solid var(--line)',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      background: '#fff'
                    }}
                  >
                    {ordersList.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.id} &middot; {o.storeName} ({o.status.replace('_', ' ')}) &middot; {inr(o.amount)}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="row" style={{ gap: 8 }}>
                  <button
                    className="btn sm"
                    onClick={() => {
                      bump();
                      toast('Refreshed tracking data.');
                    }}
                    title="Refresh live status"
                  >
                    <RotateCcw size={14} /> Refresh
                  </button>
                  <button
                    className="btn sm primary"
                    onClick={() => setActiveTab('catalog')}
                  >
                    <Plus size={14} /> Order More Items
                  </button>
                </div>
              </div>

              {/* Live Interactive Rider Map & Driver Interface */}
              {currentOrder && (
                <LiveRiderMap
                  order={currentOrder}
                  onRefresh={bump}
                  onOrderAction={handleOrderAction}
                />
              )}

              {/* Order Details & SLA Guarantee Card */}
              {currentOrder && (
                <div className="grid g2">
                  {/* Items in this delivery */}
                  <div className="card">
                    <h3 style={{ marginBottom: 12 }}>Items in this delivery</h3>
                    <div className="stack" style={{ gap: 8 }}>
                      {currentOrder.items?.map((it, idx) => (
                        <div key={idx} className="row between" style={{ padding: '6px 0', borderBottom: '1px solid var(--line)' }}>
                          <div>
                            <span className="strong small">{it.name}</span>
                            <div className="tiny muted">{inr(it.price)} each</div>
                          </div>
                          <div className="mono small">
                            {it.qty} &times; {inr(it.price * it.qty)}
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="row between" style={{ marginTop: 12, paddingTop: 10, borderTop: '2px solid var(--line)' }}>
                      <span className="strong">Total Amount Paid</span>
                      <span className="strong mono" style={{ fontSize: '1.1rem' }}>
                        {inr(currentOrder.amount)}
                      </span>
                    </div>
                  </div>

                  {/* Trust Engine Automatic SLA Guarantee */}
                  <div className="card">
                    <div className="row between" style={{ marginBottom: 8 }}>
                      <h3 style={{ margin: 0 }}>Trust Engine SLA Protection</h3>
                      <ShieldCheck size={20} color="var(--brand)" />
                    </div>
                    <p className="small muted">
                      Our Promise Window: <b>{currentOrder.promised}</b>. If your delivery is delayed past this window or any item is missing, automatic compensation is paid directly into your simulated wallet.
                    </p>

                    {currentOrder.recovery?.length > 0 ? (
                      <div className="stack" style={{ marginTop: 12, gap: 8 }}>
                        <div className="recovery severe">
                          <div className="strong small">Automatic Compensation Applied</div>
                          {currentOrder.recovery.map((r, i) => (
                            <div key={i} className="tiny">
                              &bull; {r.action} ({r.kind}: {inr(r.amount)})
                            </div>
                          ))}
                        </div>
                        <div className="small strong">
                          Credits: {inr(currentOrder.creditTotal || 0)} &middot; Refunds: {inr(currentOrder.refundTotal || 0)}
                        </div>
                      </div>
                    ) : (
                      <div
                        style={{
                          marginTop: 14,
                          padding: '12px 14px',
                          background: 'var(--brand-soft)',
                          borderRadius: 10,
                          borderLeft: '4px solid var(--brand)'
                        }}
                      >
                        <div className="strong small" style={{ color: 'var(--brand-ink)' }}>
                          Status: Delivery On-Track
                        </div>
                        <div className="tiny muted" style={{ marginTop: 2 }}>
                          No SLA breach detected. Rider is making steady progress along 100 Feet Road.
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {open && <ProductModal item={open} onClose={() => setOpen(null)} onAdd={add} />}
      {pending && (
        <ConfirmModal
          title="Start a new cart?"
          text={`Your cart has items from ${cart[0].storeName}. Orders are fulfilled by one store, so adding from ${pending.storeName} will replace it.`}
          confirmLabel="Replace cart"
          onConfirm={() => {
            setCart([pending]);
            setPending(null);
            toast(`${pending.name} added to cart`);
          }}
          onClose={() => setPending(null)}
        />
      )}
    </>
  );
}
