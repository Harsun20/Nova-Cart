import { useEffect, useState } from 'react';
import { api } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { Async, ChartCard, MetricCard } from '../components/ui.jsx';
import { CompareBars, Donut } from '../components/Charts.jsx';

const SLIDERS = [
  ['inventoryAccuracy', 'Inventory accuracy'],
  ['riderAvailability', 'Rider availability'],
  ['storeAcceptance', 'Store acceptance'],
  ['deliveryReliability', 'Delivery reliability']
];

function Simulator({ base, preset }) {
  const [p, setP] = useState(base);
  const [sim, setSim] = useState(null);
  const [err, setErr] = useState(null);
  useEffect(() => {
    let off = false;
    const t = setTimeout(() => api.simulation(p).then((r) => !off && (setSim(r), setErr(null))).catch((e) => !off && setErr(e.message)), 120);
    return () => { off = true; clearTimeout(t); };
  }, [p]);
  const b = sim?.baseline;
  const s = sim?.scenario;
  const d = sim?.deltas;
  const sign = (n, u = '') => `${n > 0 ? '+' : ''}${n}${u}`;
  return (
    <ChartCard title="Scenario simulator" subtitle="Illustrative prototype scenario. Not a measured result."
      right={<div className="row"><button className="btn sm" onClick={() => setP(base)}>Case baseline</button><button className="btn sm primary" onClick={() => setP(preset)}>With Trust Engine (illustrative)</button></div>}>
      <div className="grid g2">
        <div className="stack">
          {SLIDERS.map(([k, label]) => (
            <div className="field" key={k}>
              <label htmlFor={k}>{label}: <b>{p[k]}%</b> <span className="muted tiny">(baseline assumption {base[k]}%)</span></label>
              <input id={k} type="range" min="40" max="99" value={p[k]} onChange={(e) => setP({ ...p, [k]: Number(e.target.value) })} />
            </div>
          ))}
        </div>
        <div>
          {err && <p role="alert" style={{ color: 'var(--bad)' }}>{err}</p>}
          {s && (
            <div className="grid g2" style={{ gap: 10 }}>
              <MetricCard label="Cancellation rate" value={`${s.cancellationRate}%`} delta={`${sign(d.cancellationRate, ' pp')} vs ${b.cancellationRate}%`} deltaTone={d.cancellationRate <= 0 ? 'good' : 'bad'} />
              <MetricCard label="Expected on-time rate" value={`${s.onTimeRate}%`} delta={`${sign(d.onTimeRate, ' pp')}`} deltaTone={d.onTimeRate >= 0 ? 'good' : 'bad'} />
              <MetricCard label="Support tickets / month" value={s.supportTickets.toLocaleString('en-IN')} delta={`${sign(d.supportTickets)} vs ${b.supportTickets.toLocaleString('en-IN')}`} deltaTone={d.supportTickets <= 0 ? 'good' : 'bad'} />
              <MetricCard label="Repeat purchase likelihood" value={`${s.repeatPurchaseLikelihood}%`} delta={`${sign(d.repeatPurchaseLikelihood, ' pp')}`} deltaTone={d.repeatPurchaseLikelihood >= 0 ? 'good' : 'bad'} />
            </div>
          )}
        </div>
      </div>
      {sim && (
        <>
          <p className="small" style={{ marginTop: 12 }}>At 38,500 orders/month, each 1 percentage-point change in cancellation rate affects about <b>{sim.ordersPerPercentagePoint}</b> orders. This scenario changes cancelled orders by <b>{sign(d.cancelledOrdersPerMonth)}</b> per month.</p>
          <details style={{ marginTop: 8 }}><summary className="small strong">How the simulation works</summary><ul className="small muted">{sim.method.map((m) => <li key={m}>{m}</li>)}</ul></details>
        </>
      )}
    </ChartCard>
  );
}

export default function Analytics() {
  const s = useApi(() => api.analytics());
  return (
    <Async state={s}>{(d) => {
      const c = d.current;
      const a = d.assumptions;
      const sim = d.scenarioPreset;
      return (
        <>
          <div><h1>Analytics &amp; business impact</h1><p className="muted">Case baseline numbers are kept separate from prototype simulation.</p></div>
          <div className="grid g4">
            <MetricCard label="Repeat purchase rate" value={`${c.repeatRate}%`} hint="CASE BASELINE" />
            <MetricCard label="Cancellation rate" value={`${c.cancellationRate}%`} hint="CASE BASELINE" />
            <MetricCard label="Tickets / 1,000 orders" value={d.ticketsPer1000Orders} hint={`CASE BASELINE (was ${d.ticketsPer1000OrdersBefore})`} />
            <MetricCard label="Ticket resolution" value={`${c.ticketResolutionHours} h`} hint="CASE BASELINE (avg)" />
            <MetricCard label="On-time delivery" value={`${d.baselineModel.onTimeRate}%`} hint="PROTOTYPE ASSUMPTION" />
            <MetricCard label="Second-order conversion" value={`${a.secondOrderConversion}%`} hint="PROTOTYPE ASSUMPTION (not in case)" />
            <MetricCard label="Third-order conversion" value={`${a.thirdOrderConversion}%`} hint="PROTOTYPE ASSUMPTION (not in case)" />
            <MetricCard label="Substitution rate" value="~8%" hint="Avg of partner stores in demo data" />
          </div>
          <Simulator base={{ inventoryAccuracy: a.inventoryAccuracy, riderAvailability: a.riderAvailability, storeAcceptance: a.storeAcceptance, deliveryReliability: a.deliveryReliability }} preset={sim} />
          <PresetCompare />
          <div className="grid g2">
            <ChartCard title="Case: where cancellations come from"><Donut items={d.cancellationCauses} /></ChartCard>
            <ChartCard title="Case: what support tickets are about"><Donut items={d.ticketCauses} /></ChartCard>
          </div>
          <ChartCard title="Business impact (calculated from case data)">
            <ul className="stack small" style={{ gap: 6, paddingLeft: 18 }}>
              <li>Every 1 percentage-point reduction in cancellation rate affects about <b>{d.impact.ordersPerPercentagePointCancellation}</b> orders per month (38,500 orders).</li>
              <li>Cancellations rose from 6% to 11%: roughly <b>{d.impact.cancellationIncreaseOrders.toLocaleString('en-IN')}</b> more cancelled orders per month than before ({d.impact.cancelledOrdersPerMonth.toLocaleString('en-IN')} total).</li>
              <li>Tickets rose by <b>{d.impact.extraTickets.toLocaleString('en-IN')}</b> per month; about {d.impact.refundTickets.toLocaleString('en-IN')} are refund-related, {d.impact.delayTickets.toLocaleString('en-IN')} delay-related and {d.impact.missingTickets.toLocaleString('en-IN')} about missing products (case percentages applied to 5,900).</li>
              <li><b>Retention:</b> accurate promises and automatic recovery target the repeat-purchase drop from 41% to 27%.</li>
              <li><b>Refund friction:</b> instant credits/refunds remove the ticket for the 16% who reported refund problems.</li>
            </ul>
          </ChartCard>
        </>
      );
    }}</Async>
  );
}

function PresetCompare() {
  const s = useApi(() => api.analytics());
  const [sim, setSim] = useState(null);
  useEffect(() => { if (s.data) api.simulation(s.data.scenarioPreset).then(setSim).catch(() => {}); }, [s.data]);
  if (!sim) return null;
  const b = sim.baseline;
  const t = sim.scenario;
  return (
    <ChartCard title="Before Trust Engine vs simulated with Trust Engine" subtitle="Illustrative prototype scenario. The right-hand bars are a simulation, not results.">
      <div className="grid g2">
        <CompareBars unit="%" max={100} categories={['Cancellation rate', 'On-time rate', 'Repeat purchase likelihood']}
          series={[{ label: 'Case baseline', color: '#94a3b8', values: [b.cancellationRate, b.onTimeRate, b.repeatPurchaseLikelihood] }, { label: 'Simulation', color: '#0f766e', values: [t.cancellationRate, t.onTimeRate, t.repeatPurchaseLikelihood] }]} />
        <CompareBars categories={['Support tickets / month']}
          series={[{ label: 'Case baseline', color: '#94a3b8', values: [b.supportTickets] }, { label: 'Simulation', color: '#0f766e', values: [t.supportTickets] }]} />
      </div>
    </ChartCard>
  );
}
