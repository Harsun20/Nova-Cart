import { useRef, useState } from 'react';
import { Download, Upload } from 'lucide-react';
import { api } from '../services/api.js';
import { useApi } from '../hooks/useApi.js';
import { useApp } from '../hooks/useApp.jsx';
import { Async, Bar, ChartCard, DataTable, Modal, StatusBadge } from '../components/ui.jsx';
import { TrustScore } from '../components/trust.jsx';
import { ago } from '../utils/format.js';

const SAMPLE = 'storeId,productId,qty\ns1,p1,40\ns2,p7,20\ns5,p5,10\n';

export default function Partners() {
  const { bump, toast } = useApp();
  const [storeId, setStoreId] = useState('s1');
  const [bulk, setBulk] = useState(false);
  const [csv, setCsv] = useState('');
  const [fileName, setFileName] = useState('');
  const [busy, setBusy] = useState(null);
  const fileRef = useRef(null);
  const stores = useApi(() => api.stores());
  const detail = useApi(() => api.store(storeId), [storeId]);

  const toggle = async (row) => {
    setBusy(row.inventoryId);
    try {
      const next = row.qty === 0;
      const r = await api.toggleStock(row.inventoryId, next);
      toast(`${row.product.name}: ${next ? 'In Stock' : 'Out of Stock'}. Confidence now ${r.item.confidence}%.`);
      bump();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(null); }
  };

  const onFile = (e) => {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 100 * 1024) { toast('File is larger than 100 KB.', 'error'); e.target.value = ''; return; }
    const reader = new FileReader();
    reader.onload = () => { setCsv(String(reader.result)); setFileName(f.name); };
    reader.onerror = () => toast('Could not read that file.', 'error');
    reader.readAsText(f);
  };
  const upload = async () => {
    setBusy('bulk');
    try {
      const r = await api.bulkUpdate(csv);
      toast(`${r.message} ${r.updated} rows applied${r.errors.length ? `, ${r.errors.length} skipped` : ''}.`);
      if (r.errors.length) toast(r.errors[0], 'error');
      setBulk(false); setCsv(''); setFileName(''); bump();
    } catch (e) { toast(e.message, 'error'); } finally { setBusy(null); }
  };
  const download = () => {
    const url = URL.createObjectURL(new Blob([SAMPLE], { type: 'text/csv' }));
    const a = document.createElement('a'); a.href = url; a.download = 'inventory-sample.csv'; a.click(); URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="row between">
        <div><h1>Partner stores</h1><p className="muted">Low-effort inventory tools feed the Trust Engine. Low-confidence stores may be deprioritized.</p></div>
        <button className="btn primary" onClick={() => setBulk(true)}><Upload size={16} aria-hidden /> Bulk Update</button>
      </div>

      <ChartCard title="Store reliability" subtitle="Average fulfillment confidence per store. Click a store to manage its inventory.">
        <Async state={stores}>{(d) => (
          <div className="stack" style={{ gap: 10 }}>
            {d.stores.map((s) => (
              <button key={s.id} className="card" style={{ textAlign: 'left', cursor: 'pointer', padding: 12, borderColor: s.id === storeId ? 'var(--brand)' : undefined }} onClick={() => setStoreId(s.id)} aria-pressed={s.id === storeId}>
                <div className="row between"><b>{s.name}</b><span className="mono strong">{s.confidence}%</span></div>
                <Bar value={s.confidence} />
              </button>
            ))}
            <p className="tiny muted">Stores below 60% lose search ranking and promotions until stock data improves.</p>
          </div>)}</Async>
      </ChartCard>

      <Async state={detail}>{(d) => {
        const s = d.store;
        return (
          <>
            <div className="grid g2">
              <ChartCard title={s.name} subtitle={`${s.category} \u00B7 ${s.distanceKm} km`} right={<StatusBadge label={s.online ? 'HIGH' : 'AT_RISK'}>{s.online ? 'Online' : 'Offline'}</StatusBadge>}>
                <div className="row" style={{ gap: 18, flexWrap: 'nowrap' }}>
                  <TrustScore value={s.confidence} size={92} label="Store fulfillment confidence" />
                  <div className="stack" style={{ gap: 4, flex: 1 }}>
                    <div className="small">Inventory health <b>{s.inventoryHealth}</b></div><Bar value={s.inventoryHealth} />
                    <div className="tiny muted">{s.outOfStock} of {s.skuCount} SKUs out of stock</div>
                  </div>
                </div>
              </ChartCard>
              <ChartCard title="Reliability metrics">
                <div className="grid g2" style={{ gap: 8 }}>
                  {[['Acceptance rate', `${s.acceptanceRate}%`], ['Stock accuracy', `${s.stockAccuracy}%`], ['Cancellation rate', `${s.cancellationRate}%`], ['Substitution rate', `${s.substitutionRate}%`], ['Avg preparation', `${s.avgPrepMin} min`], ['Reliability score', `${s.reliabilityScore}`]].map(([k, v]) => (
                    <div key={k}><div className="tiny muted">{k}</div><div className="strong mono">{v}</div></div>
                  ))}
                </div>
              </ChartCard>
            </div>
            <ChartCard title="Inventory" subtitle="One-tap toggle updates backend state and recalculates confidence.">
              <DataTable rowKey="inventoryId" rows={d.inventory} empty="This store has no listed products." columns={[
                { key: 'p', header: 'Product', render: (r) => `${r.product.emoji} ${r.product.name}` },
                { key: 'q', header: 'Stock', render: (r) => <span className="mono">{r.qty}</span> },
                { key: 'c', header: 'Confidence', render: (r) => <b className="mono">{r.confidence}%</b> },
                { key: 'u', header: 'Last Updated', render: (r) => ago(r.updatedHoursAgo) },
                { key: 's', header: 'Status', render: (r) => <StatusBadge label={r.label}>{r.availabilityText}</StatusBadge> },
                { key: 't', header: 'Quick Toggle', render: (r) => (
                  <button className={`btn sm ${r.qty > 0 ? '' : 'primary'}`} disabled={busy === r.inventoryId} aria-label={`${r.product.name}: currently ${r.qty > 0 ? 'in stock' : 'out of stock'}. Toggle.`} onClick={() => toggle(r)}>
                    {r.qty > 0 ? 'In Stock' : 'Out of Stock'}
                  </button>) }
              ]} />
            </ChartCard>
          </>
        );
      }}</Async>

      {bulk && (
        <Modal title="Bulk inventory update" onClose={() => setBulk(false)}
          footer={<><button className="btn" onClick={() => setBulk(false)}>Cancel</button><button className="btn primary" disabled={!csv || busy === 'bulk'} onClick={upload}>{busy === 'bulk' ? 'Uploading\u2026' : 'Apply update'}</button></>}>
          <p className="small muted">Upload a CSV with columns <code>storeId,productId,qty</code>. Max 100 KB / 500 rows.</p>
          <div className="stack" style={{ marginTop: 12 }}>
            <input ref={fileRef} type="file" accept=".csv,text/csv" onChange={onFile} aria-label="Choose CSV file" />
            {fileName && <p className="small">Loaded <b>{fileName}</b> ({csv.split('\n').filter(Boolean).length - 1} rows)</p>}
            <button className="btn sm" onClick={download}><Download size={14} aria-hidden /> Download sample CSV</button>
          </div>
        </Modal>
      )}
    </>
  );
}
