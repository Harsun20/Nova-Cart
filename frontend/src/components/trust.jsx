import { Check, X, ShieldAlert, Wallet } from 'lucide-react';
import { Bar, StatusBadge } from './ui.jsx';
import { inr, timeOf } from '../utils/format.js';

const ringColor = (v) => (v >= 80 ? '#22a05a' : v >= 60 ? '#e0a21b' : '#d9453a');

export function TrustScore({ value, size = 72, label }) {
  const r = 30;
  const c = 2 * Math.PI * r;
  return (
    <div className="score-ring" style={{ width: size, height: size }} role="img" aria-label={`${label || 'Score'} ${value} percent`}>
      <svg viewBox="0 0 72 72" width={size} height={size}>
        <circle cx="36" cy="36" r={r} fill="none" stroke="#edf1f5" strokeWidth="7" />
        <circle cx="36" cy="36" r={r} fill="none" stroke={ringColor(value)} strokeWidth="7" strokeLinecap="round"
          strokeDasharray={`${(value / 100) * c} ${c}`} transform="rotate(-90 36 36)" style={{ transition: 'stroke-dasharray .5s' }} />
      </svg>
      <b style={{ fontSize: size * 0.3 }}>{value}%</b>
    </div>
  );
}

export function ConfidenceBreakdown({ factors, showWeights = false }) {
  return (
    <div>
      {factors.map((f) => (
        <div className="factor" key={f.key}>
          <span>{f.label}{showWeights && <span className="muted tiny"> {Math.round(f.weight * 100)}%</span>}</span>
          <Bar value={f.score} />
          <b className="mono">{f.score}</b>
        </div>
      ))}
    </div>
  );
}

export function EtaText({ eta }) {
  return <span className="mono strong">{eta.min}–{eta.max} min</span>;
}

export function ProductCard({ item, onOpen }) {
  const couponText = item.coupon.tier === 'FULL' ? 'Coupons available' : item.coupon.tier === 'LIMITED' ? 'Limited promotion' : 'Promotion unavailable';
  return (
    <button className="card pcard" onClick={() => onOpen(item)} aria-label={`${item.product.name} from ${item.store.name}`}>
      <div className="thumb" aria-hidden>{item.product.emoji}</div>
      <div>
        <div className="strong">{item.product.name}</div>
        <div className="small muted">{item.store.name}</div>
      </div>
      <div className="row between">
        <span className="strong">{inr(item.product.price)}</span>
        <span className="small">ETA <EtaText eta={item.eta} /></span>
      </div>
      <div className="row between">
        <StatusBadge label={item.label}>{item.availabilityText}</StatusBadge>
        <span className="small strong mono">{item.confidence}%</span>
      </div>
      <Bar value={item.confidence} />
      <div className="tiny muted">{couponText}{item.qty > 0 && item.qty <= 5 ? ` \u00B7 only ${item.qty} left` : ''}</div>
    </button>
  );
}

export function OrderTimeline({ order }) {
  return (
    <ol className="timeline" style={{ listStyle: 'none', padding: 0, margin: 0 }}>
      {order.timeline.map((t, i) => {
        const fail = ['cancelled', 'rejected'].includes(t.key);
        return (
          <li key={`${t.key}-${i}`} className={`tl-step ${fail ? 'fail' : 'done'}`}>
            <span className="dot">{fail ? <X size={13} /> : <Check size={13} />}</span>
            <div>
              <div className="strong small">{t.label}</div>
              <div className="tiny muted">{timeOf(t.at)}</div>
            </div>
          </li>
        );
      })}
    </ol>
  );
}

export function RecoveryCard({ action }) {
  const Icon = action.severe ? ShieldAlert : Wallet;
  return (
    <div className={`recovery ${action.severe ? 'severe' : ''}`}>
      <div className="row between">
        <span className="row strong"><Icon size={16} aria-hidden /> {action.trigger}</span>
        <StatusBadge label={action.severe ? 'AT_RISK' : 'HIGH'}>{action.severe ? 'Escalated' : 'Auto-resolved'}</StatusBadge>
      </div>
      {action.promised && (
        <div className="small">Promised <b>{action.promised}</b> &rarr; actual <b>{action.actual}</b> (late by {action.lateBy} min)</div>
      )}
      {action.item && <div className="small">Item: <b>{action.item}</b></div>}
      <div className="strong">{action.action}</div>
      <p className="small muted">&ldquo;{action.message}&rdquo;</p>
    </div>
  );
}
