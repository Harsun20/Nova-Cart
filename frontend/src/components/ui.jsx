import { useEffect, useRef } from 'react';
import { CheckCircle2, AlertTriangle, X, Inbox } from 'lucide-react';
import { tone } from '../utils/format.js';

export function MetricCard({ label, value, hint, delta, deltaTone = 'bad' }) {
  return (
    <div className="card metric">
      <div className="label">{label}</div>
      <div className="value mono">{value}</div>
      {delta && <div className={`delta ${deltaTone}`}>{delta}</div>}
      {hint && <div className="tiny muted">{hint}</div>}
    </div>
  );
}

const BADGE_TEXT = {
  HIGH: 'High confidence', LIMITED: 'Limited availability', AT_RISK: 'At risk',
  LOW_RISK: 'Low risk', ON_TIME: 'On time', DELAYED: 'Delayed', CANCELLED: 'Cancelled', REFUND_REQUIRED: 'Refund required'
};
const HEALTH_TONE = { ON_TIME: 'good', DELAYED: 'bad', AT_RISK: 'warn', CANCELLED: 'bad', REFUND_REQUIRED: 'info' };

export function StatusBadge({ label, kind = 'trust', children }) {
  const t = kind === 'health' ? HEALTH_TONE[label] : tone(label);
  return <span className={`badge ${t || 'neutral'}`}>{children || BADGE_TEXT[label] || label}</span>;
}

export function Bar({ value, tone: t }) {
  const color = t || (value >= 80 ? 'good' : value >= 60 ? 'warn' : 'bad');
  return (
    <div className="bar" role="progressbar" aria-valuenow={value} aria-valuemin={0} aria-valuemax={100}>
      <i className={color} style={{ width: `${Math.max(2, Math.min(100, value))}%` }} />
    </div>
  );
}

export function ChartCard({ title, subtitle, children, right }) {
  return (
    <section className="card">
      <div className="card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p className="small muted">{subtitle}</p>}
        </div>
        {right}
      </div>
      {children}
    </section>
  );
}

export function DataTable({ columns, rows, rowKey, empty = 'Nothing to show yet.' }) {
  if (!rows || rows.length === 0) return <Empty text={empty} />;
  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>{columns.map((c) => <th key={c.key} scope="col">{c.header}</th>)}</tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r[rowKey]}>
              {columns.map((c) => <td key={c.key}>{c.render ? c.render(r) : r[c.key]}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export const Spinner = () => <div className="spinner" role="status" aria-label="Loading" />;
export const Empty = ({ text }) => <div className="empty"><Inbox size={22} aria-hidden /><p>{text}</p></div>;
export const ErrorBox = ({ message, onRetry }) => (
  <div className="errorbox" role="alert">
    <p>{message}</p>
    {onRetry && <button className="btn sm" style={{ marginTop: 10 }} onClick={onRetry}>Try again</button>}
  </div>
);

export function Async({ state, children, empty }) {
  if (state.loading && !state.data) return <Spinner />;
  if (state.error && !state.data) return <ErrorBox message={state.error} onRetry={state.reload} />;
  if (!state.data) return empty || null;
  return children(state.data);
}

export function ToastHost({ toasts, onClose }) {
  return (
    <div className="toasts" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className={`toast ${t.type}`} role="status">
          {t.type === 'error' ? <AlertTriangle size={18} aria-hidden /> : <CheckCircle2 size={18} aria-hidden />}
          <span>{t.message}</span>
          <button aria-label="Dismiss" onClick={() => onClose(t.id)}><X size={16} /></button>
        </div>
      ))}
    </div>
  );
}

export function Modal({ title, onClose, children, footer }) {
  const ref = useRef(null);
  useEffect(() => {
    const onKey = (e) => e.key === 'Escape' && onClose();
    document.addEventListener('keydown', onKey);
    ref.current?.focus();
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);
  return (
    <div className="modal-back" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} tabIndex={-1} ref={ref}>
        <div className="card-head">
          <h2>{title}</h2>
          <button className="btn sm" aria-label="Close" onClick={onClose}><X size={16} /></button>
        </div>
        {children}
        {footer && <div className="row" style={{ marginTop: 16, justifyContent: 'flex-end' }}>{footer}</div>}
      </div>
    </div>
  );
}

export function ConfirmModal({ title, text, confirmLabel = 'Confirm', onConfirm, onClose, busy }) {
  return (
    <Modal
      title={title}
      onClose={onClose}
      footer={
        <>
          <button className="btn" onClick={onClose}>Cancel</button>
          <button className="btn primary" disabled={busy} onClick={onConfirm}>{busy ? 'Working\u2026' : confirmLabel}</button>
        </>
      }
    >
      <p className="muted">{text}</p>
    </Modal>
  );
}
