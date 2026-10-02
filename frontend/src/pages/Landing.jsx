import { ArrowRight, Gauge, ShieldCheck, Timer, Wallet } from 'lucide-react';

const CAPS = [
  { icon: Gauge, title: '1. Predict fulfillment', text: 'Combine inventory freshness, store reliability and delivery signals into one confidence score per product and store.' },
  { icon: Timer, title: '2. Promise realistic delivery', text: 'Replace one optimistic number with a dynamic ETA range built from prep time, riders, distance and traffic.' },
  { icon: Wallet, title: '3. Recover automatically', text: 'When an SLA is breached or an item is missing, compensate instantly. No ticket needed.' }
];

export default function Landing({ onOpen }) {
  return (
    <div className="hero">
      <div className="hero-inner">
        <div className="row"><span className="brand-mark" style={{ background: '#0f766e', width: 34, height: 34, borderRadius: 9, display: 'grid', placeItems: 'center' }}><ShieldCheck size={19} /></span><strong>NOVA CART</strong><span className="demo-pill">Demo Mode &middot; simulated data</span></div>
        <div className="stack">
          <h1>Trust Engine</h1>
          <p className="lead">Turn operational uncertainty into reliable customer promises.</p>
          <p style={{ color: '#7f93a8', maxWidth: 640 }}>&ldquo;Don&rsquo;t just promise an order. Predict whether you can fulfill it.&rdquo; Repeat purchases fell from 41% to 27% because the app promises what stores cannot always deliver.</p>
        </div>
        <div className="grid g3">
          {CAPS.map(({ icon: Icon, title, text }) => (
            <div className="cap" key={title}><Icon size={22} aria-hidden /><strong>{title}</strong><span style={{ color: '#b6c4d4', fontSize: '.92rem' }}>{text}</span></div>
          ))}
        </div>
        <div><button className="btn primary" style={{ padding: '13px 22px', fontSize: '1rem' }} onClick={onOpen}>Open Operations Dashboard <ArrowRight size={18} aria-hidden /></button></div>
      </div>
    </div>
  );
}
