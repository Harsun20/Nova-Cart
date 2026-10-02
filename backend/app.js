const express = require('express');
const cors = require('cors');
const { getState, reset } = require('./state');
const trust = require('./services/trustEngine');
const analytics = require('./services/analyticsEngine');
const os = require('./services/orderService');
const { parseInventoryCsv } = require('./csv');

const { HttpError } = os;
const router = express.Router();
const wrap = (fn) => (req, res, next) => {
  try {
    Promise.resolve(fn(req, res)).catch(next);
  } catch (e) {
    next(e);
  }
};

function conditions(query) {
  const out = {};
  if (query.traffic !== undefined) {
    const t = Number(query.traffic);
    if (!Number.isFinite(t) || t < 0.8 || t > 2.5) throw new HttpError(400, 'traffic must be between 0.8 and 2.5');
    out.traffic = t;
  }
  if (query.riders !== undefined) {
    const r = Number(query.riders);
    if (!Number.isInteger(r) || r < 0 || r > 10) throw new HttpError(400, 'riders must be a whole number from 0 to 10');
    out.riders = r;
  }
  return out;
}

router.get('/health', (req, res) => res.json({ status: 'ok', mode: 'demo', model: trust.MODEL_NAME, time: new Date().toISOString() }));

router.get('/products', wrap((req, res) => res.json({ products: getState().products })));

router.get('/trust-engine/products', wrap((req, res) => {
  const s = getState();
  const items = trust.evaluateAll(s, conditions(req.query)).sort((a, b) => b.confidence - a.confidence);
  res.json({ model: trust.MODEL_NAME, weights: trust.WEIGHTS, items });
}));

router.get('/trust-picks', wrap((req, res) => {
  const s = getState();
  const all = trust.evaluateAll(s, conditions(req.query)).sort((a, b) => b.confidence - a.confidence);
  res.json({
    model: trust.MODEL_NAME,
    picks: all.filter((e) => e.visible),
    hidden: all.filter((e) => !e.visible),
    policy: 'Items below 60% fulfillment confidence are hidden from the default catalog.'
  });
}));

router.post('/pricing/quote', wrap((req, res) => {
  const s = getState();
  res.json(os.buildQuote(s, req.body || {}, conditions(req.query)));
}));

router.get('/stores', wrap((req, res) => {
  const s = getState();
  const stores = s.stores.map((st) => trust.storeSummary(s, st)).sort((a, b) => b.confidence - a.confidence);
  res.json({ stores });
}));

router.get('/stores/:id', wrap((req, res) => {
  const s = getState();
  const store = s.stores.find((x) => x.id === req.params.id);
  if (!store) throw new HttpError(404, 'Store not found');
  const inventory = s.inventory.filter((i) => i.storeId === store.id).map((i) => trust.evaluate(s, i));
  res.json({ store: trust.storeSummary(s, store), inventory });
}));

router.get('/orders', wrap((req, res) => {
  const s = getState();
  res.json({ orders: s.orders.map((o) => os.decorate(s, o)).sort((a, b) => b.createdAt.localeCompare(a.createdAt)) });
}));

router.get('/orders/:id', wrap((req, res) => {
  const s = getState();
  res.json({ order: os.decorate(s, os.findOrder(s, req.params.id)) });
}));

router.post('/orders', wrap((req, res) => {
  const s = getState();
  const order = os.createOrder(s, req.body, conditions(req.query));
  res.status(201).json({ order: os.decorate(s, order) });
}));

router.patch('/orders/:id/status', wrap((req, res) => {
  const s = getState();
  const order = os.findOrder(s, req.params.id);
  const status = req.body && req.body.status;
  if (typeof status !== 'string') throw new HttpError(400, 'status is required');
  os.transition(s, order, status);
  res.json({ order: os.decorate(s, order) });
}));

router.get('/orders/:id/recovery', wrap((req, res) => {
  const s = getState();
  const order = os.findOrder(s, req.params.id);
  res.json({ orderId: order.id, promised: `${order.promisedMin}\u2013${order.promisedMax} min`, recovery: order.recovery, creditTotal: order.creditTotal, refundTotal: order.refundTotal });
}));

const simulate = (fn) => wrap((req, res) => {
  const s = getState();
  const order = os.findOrder(s, req.params.id);
  const action = fn(s, order, req.body || {});
  res.json({ order: os.decorate(s, order), recoveryAction: action || null });
});

router.post('/orders/:id/simulate-delay', simulate((s, o, b) => {
  const minutes = b.minutes === undefined ? 13 : Number(b.minutes);
  if (!Number.isInteger(minutes) || minutes < 1 || minutes > 120) throw new HttpError(400, 'minutes must be a whole number from 1 to 120');
  return os.simulateDelay(s, o, minutes);
}));
router.post('/orders/:id/simulate-rider-delay', simulate((s, o) => os.simulateRiderDelay(s, o)));
router.post('/orders/:id/simulate-missing-item', simulate((s, o) => os.simulateMissing(s, o, false)));
router.post('/orders/:id/simulate-unavailable', simulate((s, o) => os.simulateMissing(s, o, true)));
router.post('/orders/:id/simulate-substitution', simulate((s, o) => os.simulateSubstitution(s, o)));

router.post('/orders/:id/action', wrap((req, res) => {
  const s = getState();
  const order = os.findOrder(s, req.params.id);
  const result = os.supportAction(s, order, req.body && req.body.action);
  res.json({ ...result, order: os.decorate(s, order) });
}));

router.get('/wallet', wrap((req, res) => {
  const s = getState();
  const customerId = req.query.customerId || 'c-demo';
  const transactions = s.wallet.filter((w) => w.customerId === customerId).reverse();
  res.json({ customerId, balance: transactions.reduce((a, t) => a + t.amount, 0), transactions });
}));

router.get('/support/tickets', wrap((req, res) => res.json({ model: 'Prototype Risk Prioritization', tickets: os.decorateTickets(getState()) })));

const ticketAction = (action) => wrap((req, res) => {
  const s = getState();
  const ticket = s.tickets.find((t) => t.id === req.params.id);
  if (!ticket) throw new HttpError(404, 'Ticket not found');
  const order = os.findOrder(s, ticket.orderId);
  const result = os.supportAction(s, order, action);
  ticket.status = 'resolved';
  res.json({ ...result, ticket: os.decorateTickets(s).find((t) => t.id === ticket.id) });
});
router.post('/support/tickets/:id/refund', ticketAction('refund'));
router.post('/support/tickets/:id/credit', ticketAction('credit'));

router.get('/analytics', wrap((req, res) => res.json(analytics.overview(getState()))));

router.get('/analytics/simulation', wrap((req, res) => {
  const s = getState();
  const keys = ['inventoryAccuracy', 'riderAvailability', 'storeAcceptance', 'deliveryReliability'];
  const params = {};
  keys.forEach((k) => {
    const raw = req.query[k] === undefined ? s.metrics.assumptions[k] : Number(req.query[k]);
    if (!Number.isFinite(raw) || raw < 40 || raw > 99) throw new HttpError(400, `${k} must be between 40 and 99`);
    params[k] = raw;
  });
  res.json(analytics.simulation(s.metrics, params));
}));

router.post('/inventory/update', wrap((req, res) => {
  const s = getState();
  const { inventoryId, inStock } = req.body || {};
  const inv = s.inventory.find((i) => i.id === inventoryId);
  if (!inv) throw new HttpError(404, 'Inventory item not found');
  if (typeof inStock !== 'boolean') throw new HttpError(400, 'inStock must be true or false');
  const store = s.stores.find((st) => st.id === inv.storeId);
  inv.qty = inStock ? store.restockQty : 0;
  inv.updatedHoursAgo = 0;
  res.json({ item: trust.evaluate(s, inv), store: trust.storeSummary(s, store) });
}));

router.post('/inventory/bulk-update', wrap((req, res) => {
  const s = getState();
  let rows;
  try {
    rows = parseInventoryCsv(req.body && req.body.csv);
  } catch (e) {
    throw new HttpError(400, e.message);
  }
  const updated = [];
  const errors = [];
  rows.forEach((r) => {
    const qty = Number(r.qty);
    const inv = s.inventory.find((i) => i.storeId === r.storeId && i.productId === r.productId);
    if (!inv) errors.push(`Line ${r.line}: no listing for ${String(r.storeId).slice(0, 20)} / ${String(r.productId).slice(0, 20)}`);
    else if (!Number.isInteger(qty) || qty < 0 || qty > 1000) errors.push(`Line ${r.line}: qty must be a whole number from 0 to 1000`);
    else {
      inv.qty = qty;
      inv.updatedHoursAgo = 0;
      updated.push(inv.id);
    }
  });
  if (!updated.length) throw new HttpError(422, errors[0] || 'No rows could be applied.');
  res.json({ message: 'Inventory updated successfully.', updated: updated.length, errors: errors.slice(0, 10) });
}));

router.post('/reset', wrap((req, res) => {
  reset();
  res.json({ message: 'Demo data reset to initial state.' });
}));

const app = express();
app.disable('x-powered-by');
app.use(cors());
app.use(express.json({ limit: '200kb' }));
app.use('/api', router);
app.use('/.netlify/functions/api', router);
app.use((req, res) => res.status(404).json({ error: { message: 'Endpoint not found' } }));
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  if (err instanceof HttpError) return res.status(err.status).json({ error: { message: err.message } });
  if (err.type === 'entity.parse.failed') return res.status(400).json({ error: { message: 'Malformed JSON body' } });
  if (err.type === 'entity.too.large') return res.status(413).json({ error: { message: 'Request body too large' } });
  console.error(err);
  return res.status(500).json({ error: { message: 'Something went wrong on the server.' } });
});

module.exports = app;
