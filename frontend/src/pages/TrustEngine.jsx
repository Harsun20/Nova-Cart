import { useState } from 'react';
import { api } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { Async, ChartCard, DataTable, StatusBadge } from '../components/ui.jsx';
import { ConfidenceBreakdown, EtaText, TrustScore } from '../components/trust.jsx';
import { inr } from '../utils/format.js';

const DECISIONS = [
  ['Inventory freshness', 'Can this product safely be shown?'],
  ['Store reliability', 'Should this store/product be prioritized?'],
  ['Rider availability', 'What ETA should we promise?'],
  ['Confidence', 'Should a promotion be offered?'],
  ['SLA breach', 'Should we automatically compensate?']
];

export default function TrustEngine() {
  const [traffic, setTraffic] = useState(null);
  const [riders, setRiders] = useState(null);
  const [sel, setSel] = useState(null);
  const s = useApi(() => api.trustProducts({ traffic: traffic ?? undefined, riders: riders ?? undefined }), [traffic, riders]);

  return (
    <>
      <div>
        <h1>Trust Engine</h1>
        <p className="muted">Signals in, customer-facing decisions out. Model: <b>Prototype Confidence Model</b> (weighted rules, not machine learning).</p>
      </div>
      <ChartCard title="Live conditions" subtitle="Override delivery signals for every store to watch confidence and ETAs react."
        right={<button className="btn sm" disabled={traffic === null && riders === null} onClick={() => { setTraffic(null); setRiders(null); }}>Use store defaults</button>}>
        <div className="grid g2">
          <div className="field"><label htmlFor="tr">Traffic factor: {traffic === null ? 'store default' : `${traffic.toFixed(2)}x`}</label>
            <input id="tr" type="range" min="0.8" max="2" step="0.05" value={traffic ?? 1.2} onChange={(e) => setTraffic(Number(e.target.value))} /></div>
          <div className="field"><label htmlFor="rd">Available riders per store: {riders === null ? 'store default' : riders}</label>
            <input id="rd" type="range" min="0" max="8" step="1" value={riders ?? 3} onChange={(e) => setRiders(Number(e.target.value))} /></div>
        </div>
      </ChartCard>
      <div className="grid g2">
        <ChartCard title="Formula" subtitle="confidence = weighted sum of five 0-100 scores">
          <Async state={s}>{(d) => (
            <ul className="small stack" style={{ gap: 4, paddingLeft: 18, margin: 0 }}>
              <li><b>{d.weights.inventory * 100}%</b> inventory level (0 if out of stock)</li>
              <li><b>{d.weights.freshness * 100}%</b> update freshness (decays after 2h)</li>
              <li><b>{d.weights.storeReliability * 100}%</b> store reliability (acceptance, cancellations, substitutions)</li>
              <li><b>{d.weights.availabilityAccuracy * 100}%</b> historical availability accuracy</li>
              <li><b>{d.weights.deliveryFeasibility * 100}%</b> delivery feasibility (load, traffic, distance, riders)</li>
              <li>Out of stock caps the score at 20%. Offline store caps it at 10%.</li>
              <li>&ge;80 High &middot; 60&ndash;79 Limited availability &middot; &lt;60 At risk (hidden, promotions off)</li>
            </ul>)}</Async>
        </ChartCard>
        <ChartCard title="What decision does this data enable?">
          <div className="stack" style={{ gap: 8 }}>
            {DECISIONS.map(([a, b]) => <div key={a} className="small"><b>{a}</b> &rarr; {b}</div>)}
          </div>
        </ChartCard>
      </div>
      <ChartCard title="Product &times; store signals" subtitle="Click a row to open the score breakdown and ETA components.">
        <Async state={s}>{(d) => (
          <DataTable rowKey="inventoryId" rows={d.items} columns={[
            { key: 'p', header: 'Product', render: (r) => <button className="btn sm" onClick={() => setSel(r)}>{r.product.emoji} {r.product.name}</button> },
            { key: 's', header: 'Store', render: (r) => r.store.name },
            { key: 'c', header: 'Confidence', render: (r) => <b className="mono">{r.confidence}%</b> },
            { key: 'l', header: 'Status', render: (r) => <StatusBadge label={r.label}>{r.label === 'HIGH' ? 'HIGH CONFIDENCE' : r.label === 'LIMITED' ? 'LIMITED AVAILABILITY' : 'HIGH RISK'}</StatusBadge> },
            { key: 'e', header: 'ETA', render: (r) => <EtaText eta={r.eta} /> },
            { key: 'q', header: 'Stock', render: (r) => r.qty },
            { key: 'k', header: 'Promotion', render: (r) => (r.coupon.tier === 'FULL' ? 'Normal' : r.coupon.tier === 'LIMITED' ? 'Limited' : 'Disabled') },
            { key: 'v', header: 'Catalog', render: (r) => (r.visible ? 'Shown' : 'Hidden') }
          ]} />)}</Async>
      </ChartCard>
      {sel && (() => {
        const live = s.data?.items.find((i) => i.inventoryId === sel.inventoryId) || sel;
        const c = live.eta.components;
        return (
          <ChartCard title={`${live.product.name} @ ${live.store.name}`} subtitle="Selected combination" right={<button className="btn sm" onClick={() => setSel(null)}>Close</button>}>
            <div className="grid g2">
              <div>
                <div className="row" style={{ gap: 16, flexWrap: 'nowrap', marginBottom: 10 }}>
                  <TrustScore value={live.confidence} size={88} label="Fulfillment confidence" />
                  <div><div className="strong">Fulfillment Confidence</div><StatusBadge label={live.label}>{live.availabilityText}</StatusBadge><div className="tiny muted" style={{ marginTop: 4 }}>Risk: {live.risk} &middot; {inr(live.product.price)}</div></div>
                </div>
                <ConfidenceBreakdown factors={live.factors} showWeights />
              </div>
              <div>
                <h3>ETA: <EtaText eta={live.eta} /></h3>
                <ul className="small stack" style={{ gap: 3, paddingLeft: 18 }}>
                  <li>Store prep (load-adjusted): {c.storePrep} min</li>
                  <li>Rider pickup: {c.riderPickup} min</li>
                  <li>Travel (distance &times; traffic): {c.travel} min</li>
                  <li>Reliability buffer: +{c.reliabilityAdj} min</li>
                  <li>Rider availability ({live.conditions.riders} free): {c.riderAdj > 0 ? '+' : ''}{c.riderAdj} min</li>
                  <li>Handoff: {c.handoff} min</li>
                  <li>Range width from confidence: {c.spread} min</li>
                </ul>
                <p className="small muted">{live.coupon.reason}</p>
              </div>
            </div>
          </ChartCard>
        );
      })()}
    </>
  );
}
