import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { useApp } from '../hooks/useApp.jsx';
import { Async, ChartCard, DataTable, Empty, StatusBadge } from '../components/ui.jsx';
import { OrderTimeline, RecoveryCard } from '../components/trust.jsx';
import { inr } from '../utils/format.js';

const STATUS_BTN = { accepted: 'Store accepts', rejected: 'Store rejects', rider_assigned: 'Assign rider', out_for_delivery: 'Start delivery', delivered: 'Order delivered', cancelled: 'Cancel order' };

function Detail({ id }) {
  const { bump, toast } = useApp();
  const [busy, setBusy] = useState(false);
  const s = useApi(() => api.order(id), [id]);
  const run = async (fn, okMsg) => {
    setBusy(true);
    try { const r = await fn(); bump(); toast(okMsg(r)); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); }
  };
  return (
    <Async state={s}>{({ order: o }) => (
      <div className="grid g2">
        <ChartCard title={o.id} subtitle={`${o.storeName} \u00B7 ${inr(o.amount)}`} right={<StatusBadge kind="health" label={o.health} />}>
          <div className="row between small" style={{ marginBottom: 10 }}>
            <span>Promised <b>{o.promised}</b></span>
            <span>{o.actualMin ? 'Actual' : 'Projected'} <b>{o.actualOrProjected} min</b></span>
          </div>
          <OrderTimeline order={o} />
          <ul className="small muted" style={{ paddingLeft: 18 }}>{o.items.map((i) => <li key={i.inventoryId}>{i.qty} &times; {i.name}</li>)}</ul>
          {o.riderName && <p className="small">Rider: <b>{o.riderName}</b></p>}
          {o.events.length > 0 && <details><summary className="small strong">Event log ({o.events.length})</summary><ul className="tiny muted" style={{ paddingLeft: 18 }}>{o.events.map((e, i) => <li key={i}>{e.text}</li>)}</ul></details>}
        </ChartCard>
        <div className="stack">
          <ChartCard title="Simulate events" subtitle="Each button changes real order state on the backend.">
            <div className="row">
              {o.nextSteps.map((st) => <button key={st} className={`btn sm ${st === 'rejected' || st === 'cancelled' ? 'danger' : 'primary'}`} disabled={busy} onClick={() => run(() => api.setStatus(o.id, st), () => `${STATUS_BTN[st]}`)}>{STATUS_BTN[st]}</button>)}
              {o.terminal && <span className="small muted">Order closed. Recovery rules still apply to the result below.</span>}
            </div>
            <div className="row" style={{ marginTop: 10 }}>
              <button className="btn sm" disabled={busy || o.terminal} onClick={() => run(() => api.simulate(o.id, 'simulate-delay', { minutes: 13 }), (r) => r.recoveryAction ? r.recoveryAction.message : 'Delay recorded')}>Delivery delayed (+13 min late)</button>
              <button className="btn sm" disabled={busy || o.terminal} onClick={() => run(() => api.simulate(o.id, 'simulate-delay', { minutes: 30 }), (r) => r.recoveryAction.message)}>Severe delay (+30)</button>
              <button className="btn sm" disabled={busy || o.terminal} onClick={() => run(() => api.simulate(o.id, 'simulate-rider-delay'), () => 'Rider delayed (+10 min)')}>Rider delayed</button>
              <button className="btn sm" disabled={busy || o.status === 'cancelled' || o.status === 'rejected'} onClick={() => run(() => api.simulate(o.id, 'simulate-missing-item'), (r) => r.recoveryAction.message)}>Missing item</button>
              <button className="btn sm" disabled={busy || o.status === 'cancelled' || o.status === 'rejected'} onClick={() => run(() => api.simulate(o.id, 'simulate-unavailable'), (r) => r.recoveryAction.message)}>Item becomes unavailable</button>
              <button className="btn sm" disabled={busy || o.status === 'cancelled' || o.status === 'rejected'} onClick={() => run(() => api.simulate(o.id, 'simulate-substitution'), (r) => r.recoveryAction.message)}>Substitution</button>
            </div>
          </ChartCard>
          <ChartCard title="Recovery Engine" subtitle="SLA breach &rarr; automatic compensation">
            {o.recovery.length === 0 ? <Empty text="No SLA breach or failure so far. Simulate an event to see the automatic action." /> : (
              <div className="stack">
                {o.recovery.map((r) => <RecoveryCard key={r.id} action={r} />)}
                <p className="small">Credits <b>{inr(o.creditTotal)}</b> &middot; Refunds <b>{inr(o.refundTotal)}</b> (simulated wallet)</p>
              </div>
            )}
          </ChartCard>
        </div>
      </div>
    )}</Async>
  );
}

export default function Orders({ param }) {
  const { navigate } = useApp();
  const list = useApi(() => api.orders());
  const [sel, setSel] = useState(param || null);
  useEffect(() => { if (param) setSel(param); }, [param]);
  useEffect(() => { if (!sel && list.data?.orders.length) setSel(list.data.orders[0].id); }, [list.data, sel]);
  return (
    <>
      <div><h1>Orders</h1><p className="muted">Track orders and simulate failures. The Recovery Engine reacts automatically.</p></div>
      {sel && <Detail id={sel} />}
      <ChartCard title="All orders">
        <Async state={list}>{(d) => (
          <DataTable rowKey="id" rows={d.orders} columns={[
            { key: 'id', header: 'Order', render: (o) => <button className="btn sm" onClick={() => { setSel(o.id); navigate(`orders/${o.id}`); }}>{o.id}</button> },
            { key: 'c', header: 'Customer', render: (o) => o.customerName },
            { key: 's', header: 'Store', render: (o) => o.storeName },
            { key: 'a', header: 'Amount', render: (o) => inr(o.amount) },
            { key: 'st', header: 'Status', render: (o) => <StatusBadge kind="health" label={o.health} /> },
            { key: 'e', header: 'Promised', render: (o) => o.promised }
          ]} />)}</Async>
      </ChartCard>
    </>
  );
}
