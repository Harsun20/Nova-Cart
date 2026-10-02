// Tiny dependency-free SVG charts.
export function LineChart({ data, color = '#0f766e', unit = '', height = 150 }) {
  const w = 320;
  const pad = 22;
  const vals = data.map((d) => d.value);
  const min = Math.min(...vals);
  const max = Math.max(...vals);
  const span = max - min || 1;
  const x = (i) => pad + (i * (w - pad * 2)) / (data.length - 1);
  const y = (v) => height - pad - ((v - min) / span) * (height - pad * 2);
  const pts = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  return (
    <svg viewBox={`0 0 ${w} ${height}`} width="100%" role="img" aria-label={`Trend from ${vals[0]}${unit} to ${vals[vals.length - 1]}${unit}`}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" />
      {data.map((d, i) => (
        <g key={d.month}>
          <circle cx={x(i)} cy={y(d.value)} r="3.5" fill={color} />
          <text x={x(i)} y={height - 5} fontSize="9" textAnchor="middle" fill="#5b6678">{d.month}</text>
        </g>
      ))}
      <text x={x(0)} y={y(vals[0]) - 8} fontSize="10" fontWeight="700" fill="#0f172a">{vals[0].toLocaleString('en-IN')}{unit}</text>
      <text x={x(data.length - 1)} y={y(vals[vals.length - 1]) - 8} fontSize="10" fontWeight="700" textAnchor="end" fill="#0f172a">{vals[vals.length - 1].toLocaleString('en-IN')}{unit}</text>
    </svg>
  );
}

// Grouped comparison bars. series: [{label, color, values:[..]}], categories: [..]
export function CompareBars({ categories, series, max, unit = '' }) {
  const m = max || Math.max(...series.flatMap((s) => s.values)) * 1.15;
  return (
    <div className="stack">
      {categories.map((c, ci) => (
        <div key={c}>
          <div className="small strong" style={{ marginBottom: 4 }}>{c}</div>
          {series.map((s) => (
            <div key={s.label} className="row" style={{ flexWrap: 'nowrap', margin: '3px 0' }}>
              <span className="tiny muted" style={{ width: 92, flexShrink: 0 }}>{s.label}</span>
              <div className="bar" style={{ flex: 1 }}><i style={{ width: `${(s.values[ci] / m) * 100}%`, background: s.color }} /></div>
              <span className="tiny mono strong" style={{ width: 62, textAlign: 'right' }}>{s.values[ci].toLocaleString('en-IN')}{unit}</span>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}

export function Donut({ items }) {
  const colors = ['#0f766e', '#d9453a', '#e0a21b', '#94a3b8'];
  const total = items.reduce((a, b) => a + b.pct, 0);
  let acc = 0;
  const r = 40;
  const c = 2 * Math.PI * r;
  return (
    <div className="row" style={{ gap: 18 }}>
      <svg viewBox="0 0 100 100" width="130" height="130" role="img" aria-label="Breakdown chart">
        <g transform="rotate(-90 50 50)">
          {items.map((it, i) => {
            const len = (it.pct / total) * c;
            const el = <circle key={it.label} cx="50" cy="50" r={r} fill="none" stroke={colors[i % 4]} strokeWidth="16" strokeDasharray={`${len} ${c - len}`} strokeDashoffset={-acc} />;
            acc += len;
            return el;
          })}
        </g>
      </svg>
      <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'grid', gap: 5 }}>
        {items.map((it, i) => (
          <li key={it.label} className="small row" style={{ gap: 7 }}>
            <i style={{ width: 10, height: 10, borderRadius: 3, background: colors[i % 4], display: 'inline-block' }} />
            {it.label} <b>{it.pct}%</b>
          </li>
        ))}
      </ul>
    </div>
  );
}
