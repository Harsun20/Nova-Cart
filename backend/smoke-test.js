// End-to-end API smoke test: boots the app in-process and exercises the main flows.
const http = require('http');
const app = require('./app');

const server = http.createServer(app).listen(0, async () => {
  const base = `http://localhost:${server.address().port}/api`;
  const call = async (method, path, body) => {
    const r = await fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: body ? JSON.stringify(body) : undefined });
    return { status: r.status, data: await r.json() };
  };
  let failed = 0;
  const check = (name, cond) => { console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`); if (!cond) failed += 1; };
  try {
    check('health', (await call('GET', '/health')).data.status === 'ok');
    const picks = (await call('GET', '/trust-picks')).data;
    check('trust picks split visible/hidden', picks.picks.length > 0 && picks.hidden.length > 0);
    const top = picks.picks[0];
    check('confidence in range', top.confidence >= 0 && top.confidence <= 100 && top.eta.max > top.eta.min);
    const q = await call('POST', '/pricing/quote', { storeId: top.storeId, items: [{ inventoryId: top.inventoryId, qty: 2 }], couponCode: 'AUTO' });
    check('quote works', q.status === 200 && q.data.total > 0);
    const o = await call('POST', '/orders', { storeId: top.storeId, items: [{ inventoryId: top.inventoryId, qty: 2 }], couponCode: 'AUTO' });
    check('order created', o.status === 201 && /^NC-\d{8}-\d+$/.test(o.data.order.id));
    const id = o.data.order.id;
    check('accept', (await call('PATCH', `/orders/${id}/status`, { status: 'accepted' })).status === 200);
    check('invalid transition rejected', (await call('PATCH', `/orders/${id}/status`, { status: 'delivered' })).status === 409);
    const d = await call('POST', `/orders/${id}/simulate-delay`, { minutes: 13 });
    check('delay triggers credit', d.data.recoveryAction && d.data.recoveryAction.amount === 40);
    const m = await call('POST', `/orders/${id}/simulate-missing-item`);
    check('missing item refund', m.data.recoveryAction && m.data.recoveryAction.kind === 'refund');
    check('wallet updated', (await call('GET', '/wallet')).data.balance > 0);
    const inv = await call('POST', '/inventory/update', { inventoryId: top.inventoryId, inStock: false });
    check('toggle recalculates confidence', inv.data.item.confidence < top.confidence);
    const bulk = await call('POST', '/inventory/bulk-update', { csv: 'storeId,productId,qty\ns1,p1,25\ns1,p9,3' });
    check('bulk csv', bulk.status === 200 && bulk.data.updated === 1 && bulk.data.errors.length === 1);
    check('bad csv rejected', (await call('POST', '/inventory/bulk-update', { csv: 'nope' })).status === 400);
    const t = (await call('GET', '/support/tickets')).data.tickets;
    check('tickets prioritized', t.length > 0 && ['HIGH', 'MEDIUM', 'LOW'].includes(t[0].priority.level));
    check('ticket credit', (await call('POST', `/support/tickets/${t[0].id}/credit`)).status === 200);
    const a = (await call('GET', '/analytics')).data;
    check('analytics', a.trustHealth.score > 0 && a.impact.ordersPerPercentagePointCancellation === 385);
    const sim = (await call('GET', '/analytics/simulation?inventoryAccuracy=88&riderAvailability=80&storeAcceptance=92&deliveryReliability=86')).data;
    check('simulation improves metrics', sim.scenario.cancellationRate < sim.baseline.cancellationRate && Math.abs(sim.baseline.cancellationRate - 11) < 0.1);
    check('bad sim input rejected', (await call('GET', '/analytics/simulation?inventoryAccuracy=abc')).status === 400);
    check('reset', (await call('POST', '/reset')).status === 200);
    check('unknown order 404', (await call('GET', '/orders/NOPE')).status === 404);
  } catch (e) {
    console.error(e);
    failed += 1;
  }
  server.close();
  process.exit(failed ? 1 : 0);
});
