import { api } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { Async, Bar, ChartCard, MetricCard } from '../components/ui.jsx';
import { Donut, LineChart } from '../components/Charts.jsx';
import { TrustScore } from '../components/trust.jsx';

const OLD = ['Product shown as available', 'Order placed', 'Inventory mismatch', 'Cancellation', 'Support ticket', 'Refund friction', 'Customer churn'];
const NEW = ['Signals (inventory, store, riders, traffic)', 'Confidence score', 'Reliable catalog', 'Accurate ETA range', 'Transparent checkout', 'Automatic recovery', 'Higher trust'];
const WHY = ['Inventory uncertainty', 'Order failure', 'Delivery / support problem', 'Refund / friction', 'Customer dissatisfaction', 'Lower repeat purchase'];

function Chain({ items, kind }) {
  return (
    <div className="chain">
      {items.map((t, i) => (
        <div key={t}>
          <div className={kind} style={{ padding: '9px 12px', borderRadius: 9 }}>{t}</div>
          {i < items.length - 1 && <div className="arrow" aria-hidden>&darr;</div>}
        </div>
      ))}
    </div>
  );
}

export default function Overview() {
  const s = useApi(() => api.analytics());
  return (
    <Async state={s}>
      {(d) => {
        const c = d.current;
        const b = d.sixMonthsAgo;
        return (
          <>
            <div>
              <h1>Nova Cart health</h1>
              <p className="muted">Case baseline: failures in availability, delivery and recovery compound into churn.</p>
            </div>
            <div className="grid g3">
              <MetricCard label="Monthly Active Users" value={c.mau.toLocaleString('en-IN')} />
              <MetricCard label="Monthly Orders" value={c.monthlyOrders.toLocaleString('en-IN')} />
              <MetricCard label="Repeat Purchase Rate" value={`${c.repeatRate}%`} delta={`${b.repeatRate}% \u2192 ${c.repeatRate}%`} hint="vs six months ago" />
              <MetricCard label="Average Delivery Time" value={`${c.avgDeliveryMin} min`} delta={`${b.avgDeliveryMin} \u2192 ${c.avgDeliveryMin} min`} hint="vs six months ago" />
              <MetricCard label="Cancellation Rate" value={`${c.cancellationRate}%`} delta={`${b.cancellationRate}% \u2192 ${c.cancellationRate}%`} hint="vs six months ago" />
              <MetricCard label="Support Tickets" value={`${c.supportTickets.toLocaleString('en-IN')}/mo`} delta={`${b.supportTickets.toLocaleString('en-IN')} \u2192 ${c.supportTickets.toLocaleString('en-IN')}`} hint="vs six months ago" />
            </div>

            <div className="grid g2">
              <ChartCard title="Trust Health" subtitle="Average of four signals. Live: reacts to demo actions.">
                <div className="row" style={{ gap: 20, flexWrap: 'nowrap' }}>
                  <TrustScore value={d.trustHealth.score} size={104} label="Trust health" />
                  <div style={{ flex: 1, minWidth: 0 }} className="stack">
                    {d.trustHealth.components.map((x) => (
                      <div key={x.key}>
                        <div className="row between small"><span>{x.label}</span><b className="mono">{x.value}</b></div>
                        <Bar value={x.value} />
                      </div>
                    ))}
                  </div>
                </div>
                <p className="tiny muted" style={{ marginTop: 12 }}>{d.trustHealth.note}</p>
              </ChartCard>
              <ChartCard title="Why Trust Engine?" subtitle="The failure chain it breaks">
                <div className="chain">
                  {WHY.map((t, i) => (
                    <div key={t}><div className="old" style={{ padding: '8px 12px', borderRadius: 9 }}>{t}</div>{i < WHY.length - 1 && <div className="arrow" aria-hidden>&darr;</div>}</div>
                  ))}
                </div>
              </ChartCard>
            </div>

            <div className="grid g4">
              <ChartCard title="Repeat purchase %"><LineChart data={d.trends.repeatRate} color="#d9453a" unit="%" /></ChartCard>
              <ChartCard title="Delivery time (min)"><LineChart data={d.trends.avgDeliveryMin} color="#e0a21b" /></ChartCard>
              <ChartCard title="Cancellation %"><LineChart data={d.trends.cancellationRate} color="#d9453a" unit="%" /></ChartCard>
              <ChartCard title="Support tickets"><LineChart data={d.trends.supportTickets} color="#1d4ed8" /></ChartCard>
            </div>
            <p className="tiny muted">{d.trendNote}</p>

            <div className="grid g2">
              <ChartCard title="Why orders get cancelled" subtitle="Case data"><Donut items={d.cancellationCauses} /></ChartCard>
              <ChartCard title="What customers report" subtitle="Survey, % of respondents">
                <div className="stack" style={{ gap: 10 }}>
                  {d.survey.map((x) => (
                    <div key={x.label}><div className="row between small"><span>{x.label}</span><b>{x.pct}%</b></div><Bar value={x.pct * 2} tone="bad" /></div>
                  ))}
                </div>
              </ChartCard>
            </div>

            <div className="grid g2">
              <ChartCard title="Old model"><Chain items={OLD} kind="old" /></ChartCard>
              <ChartCard title="Trust Engine model"><Chain items={NEW} kind="new" /></ChartCard>
            </div>
          </>
        );
      }}
    </Async>
  );
}
