import { useState } from 'react';
import { api } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { useApp } from '../hooks/useApp.jsx';
import { Async, ChartCard, ConfirmModal, DataTable, StatusBadge } from '../components/ui.jsx';
import { inr } from '../utils/format.js';

const RISK_TONE = { HIGH: 'AT_RISK', MEDIUM: 'LIMITED', LOW: 'HIGH' };

export default function Support() {
  const { bump, toast } = useApp();
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const orders = useApi(() => api.orders());
  const tickets = useApi(() => api.tickets());

  const exec = async (fn) => {
    setBusy(true);
    try { const r = await fn(); toast(r.message); bump(); } catch (e) { toast(e.message, 'error'); } finally { setBusy(false); setConfirm(null); }
  };
  const act = (o, action) => exec(() => api.orderAction(o.id, action));

  return (
    <>
      <div><h1>Support &amp; Operations Cockpit</h1><p className="muted">Orders, refunds, delivery status and store communication in one view.</p></div>
      <ChartCard title="Recent orders" subtitle="One-click actions change prototype state; no real payment provider is involved.">
        <Async state={orders}>{(d) => (
          <DataTable rowKey="id" rows={d.orders} columns={[
            { key: 'id', header: 'Order ID', render: (o) => <span className="mono small">{o.id}</span> },
            { key: 'c', header: 'Customer', render: (o) => o.customerName },
            { key: 's', header: 'Store', render: (o) => o.storeName },
            { key: 'a', header: 'Amount', render: (o) => inr(o.amount) },
            { key: 'e', header: 'ETA', render: (o) => o.promised },
            { key: 'ac', header: 'Actual', render: (o) => (o.status === 'cancelled' || o.status === 'rejected' ? '\u2014' : `${o.actualOrProjected} min${o.actualMin ? '' : ' (proj.)'}`) },
            { key: 'r', header: 'Risk', render: (o) => <StatusBadge label={o.risk === 'LOW' ? 'LOW' : o.risk}>{o.risk}</StatusBadge> },
            { key: 'h', header: 'Status', render: (o) => <StatusBadge kind="health" label={o.health} /> },
            { key: 'i', header: 'Issue', render: (o) => o.issue || '\u2014' },
            { key: 'rf', header: 'Refund', render: (o) => (o.refundStatus === 'refunded' ? <span className="badge good">Refunded</span> : o.refundStatus === 'none' ? '\u2014' : <span className="badge info">{o.refundStatus}</span>) },
            { key: 'x', header: 'Action', render: (o) => (
              <div className="row" style={{ gap: 4, minWidth: 250 }}>
                <button className="btn sm" disabled={busy || o.refundStatus === 'refunded'} onClick={() => setConfirm({ title: 'Approve refund?', text: `Refund the remaining amount of ${o.id} to ${o.customerName}.`, run: () => act(o, 'refund') })}>Approve Refund</button>
                <button className="btn sm" disabled={busy} onClick={() => act(o, 'credit')}>Issue Credit</button>
                <button className="btn sm" disabled={busy || o.terminal} onClick={() => act(o, 'reassign')}>Reassign Rider</button>
                <button className="btn sm" disabled={busy} onClick={() => act(o, 'contact')}>Contact Store</button>
              </div>) }
          ]} />)}</Async>
      </ChartCard>
      <ChartCard title="Support tickets" subtitle="Prototype Risk Prioritization: order value + delay severity + customer frequency + issue type. A simple additive score, not AI.">
        <Async state={tickets}>{(d) => (
          <DataTable rowKey="id" rows={d.tickets} columns={[
            { key: 'p', header: 'Priority', render: (t) => <StatusBadge label={RISK_TONE[t.priority.level]}>{t.priority.level} PRIORITY</StatusBadge> },
            { key: 'sc', header: 'Score', render: (t) => <span className="mono" title={`value ${t.priority.factors.orderValue} + delay ${t.priority.factors.delaySeverity} + frequency ${t.priority.factors.customerFrequency} + issue ${t.priority.factors.issueType}`}>{t.priority.score}</span> },
            { key: 'id', header: 'Ticket', render: (t) => <span className="mono small">{t.id}{t.auto ? ' (auto)' : ''}</span> },
            { key: 'is', header: 'Issue', render: (t) => t.issueLabel },
            { key: 'cu', header: 'Customer', render: (t) => t.customerName },
            { key: 'am', header: 'Order value', render: (t) => inr(t.amount) },
            { key: 'st', header: 'Status', render: (t) => <span className={`badge ${t.status === 'resolved' ? 'good' : 'warn'}`}>{t.status}</span> },
            { key: 'ac', header: 'Action', render: (t) => (
              <div className="row" style={{ gap: 4 }}>
                <button className="btn sm" disabled={busy || t.status === 'resolved'} onClick={() => setConfirm({ title: 'Refund and resolve?', text: `Approve a refund for ${t.id} and mark it resolved.`, run: () => exec(() => api.ticketAction(t.id, 'refund')) })}>Refund</button>
                <button className="btn sm" disabled={busy || t.status === 'resolved'} onClick={() => exec(() => api.ticketAction(t.id, 'credit'))}>Credit ₹50</button>
              </div>) }
          ]} />)}</Async>
      </ChartCard>
      {confirm && <ConfirmModal title={confirm.title} text={confirm.text} busy={busy} confirmLabel="Confirm" onConfirm={confirm.run} onClose={() => setConfirm(null)} />}
    </>
  );
}
