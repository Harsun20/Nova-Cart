const BASE = (import.meta.env.VITE_API_BASE_URL || '/api').replace(/\/$/, '');

async function request(path, { method = 'GET', body } = {}) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body ? { 'Content-Type': 'application/json' } : undefined,
      body: body ? JSON.stringify(body) : undefined
    });
  } catch {
    throw new Error('Cannot reach the Trust Engine API. Check that the backend is running.');
  }
  let data = null;
  try {
    data = await res.json();
  } catch {
    /* non-JSON response */
  }
  if (!res.ok) throw new Error(data?.error?.message || `Request failed (${res.status})`);
  return data;
}

const qs = (o) => {
  const p = new URLSearchParams();
  Object.entries(o || {}).forEach(([k, v]) => v !== undefined && v !== null && p.set(k, v));
  const s = p.toString();
  return s ? `?${s}` : '';
};

export const api = {
  trustPicks: (c) => request(`/trust-picks${qs(c)}`),
  trustProducts: (c) => request(`/trust-engine/products${qs(c)}`),
  quote: (body) => request('/pricing/quote', { method: 'POST', body }),
  stores: () => request('/stores'),
  store: (id) => request(`/stores/${id}`),
  orders: () => request('/orders'),
  order: (id) => request(`/orders/${id}`),
  createOrder: (body) => request('/orders', { method: 'POST', body }),
  setStatus: (id, status) => request(`/orders/${id}/status`, { method: 'PATCH', body: { status } }),
  simulate: (id, kind, body) => request(`/orders/${id}/${kind}`, { method: 'POST', body }),
  orderAction: (id, action) => request(`/orders/${id}/action`, { method: 'POST', body: { action } }),
  wallet: () => request('/wallet'),
  tickets: () => request('/support/tickets'),
  ticketAction: (id, action) => request(`/support/tickets/${id}/${action}`, { method: 'POST' }),
  analytics: () => request('/analytics'),
  simulation: (p) => request(`/analytics/simulation${qs(p)}`),
  toggleStock: (inventoryId, inStock) => request('/inventory/update', { method: 'POST', body: { inventoryId, inStock } }),
  bulkUpdate: (csv) => request('/inventory/bulk-update', { method: 'POST', body: { csv } }),
  reset: () => request('/reset', { method: 'POST' })
};
