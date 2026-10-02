const trust = require('./trustEngine');
const pricing = require('./pricingEngine');
const recovery = require('./recoveryEngine');
const support = require('./supportEngine');
const { STEPS, STEP_LABELS } = require('../state');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}
const TERMINAL = ['delivered', 'cancelled', 'rejected'];
const nowIso = () => new Date().toISOString();

const findOrder = (state, id) => {
  const o = state.orders.find((x) => x.id === id);
  if (!o) throw new HttpError(404, `Order ${id} not found`);
  return o;
};

function delayMinutes(order) {
  if (['cancelled', 'rejected'].includes(order.status)) return 0;
  const effective = order.actualMin ?? order.projectedMin ?? 0;
  return Math.max(0, effective - order.promisedMax);
}

function decorate(state, o) {
  const store = state.stores.find((s) => s.id === o.storeId);
  const customer = state.customers.find((c) => c.id === o.customerId);
  const rider = state.riders.find((r) => r.id === o.riderId);
  const delayMin = delayMinutes(o);
  const failed = ['cancelled', 'rejected'].includes(o.status);
  let risk = 'LOW';
  if (failed || delayMin > 0 || o.confidenceAtOrder < 60) risk = 'HIGH';
  else if (o.confidenceAtOrder < 80 || (!TERMINAL.includes(o.status) && o.projectedMin >= o.promisedMax - 3)) risk = 'MEDIUM';
  let health = 'ON_TIME';
  if (failed) health = 'CANCELLED';
  else if (delayMin > 0) health = 'DELAYED';
  else if (['required', 'pending'].includes(o.refundStatus)) health = 'REFUND_REQUIRED';
  else if (risk !== 'LOW') health = 'AT_RISK';
  const issue = o.issue || (delayMin > 0 ? `Late by ${delayMin} min` : '');
  return {
    ...o,
    storeName: store.name,
    customerName: customer.name,
    riderName: rider ? rider.name : null,
    promised: `${o.promisedMin}\u2013${o.promisedMax} min`,
    actualOrProjected: o.actualMin ?? o.projectedMin,
    delayMin,
    risk,
    health,
    issue,
    compensated: o.recovery.length > 0,
    terminal: TERMINAL.includes(o.status),
    nextSteps: nextStatuses(o.status)
  };
}

function nextStatuses(status) {
  switch (status) {
    case 'placed': return ['accepted', 'rejected'];
    case 'accepted': return ['rider_assigned', 'cancelled'];
    case 'rider_assigned': return ['out_for_delivery', 'cancelled'];
    case 'out_for_delivery': return ['delivered', 'cancelled'];
    default: return [];
  }
}

function log(order, text) {
  order.events.unshift({ at: nowIso(), text });
}

function addWalletTxn(state, order, type, amount, note) {
  state.wallet.push({
    id: `W-${state.wallet.length + 1}`,
    customerId: order.customerId,
    orderId: order.id,
    type,
    amount,
    note,
    at: nowIso()
  });
}

// Applies (or upgrades) a recovery action. Only the increase over an earlier action of the same type is paid out.
function applyRecovery(state, order, action) {
  if (!action) return null;
  const prior = order.recovery.find((r) => r.type === action.type);
  const paidBefore = prior ? prior.amount : 0;
  const delta = action.amount - paidBefore;
  if (delta > 0) {
    addWalletTxn(state, order, action.kind, delta, action.action);
  }
  const entry = { id: `RC-${order.id.slice(-4)}-${order.recovery.length + 1}`, at: nowIso(), ...action };
  order.recovery = order.recovery.filter((r) => r.type !== action.type).concat(entry);
  order.creditTotal = order.recovery.filter((r) => r.kind === 'credit').reduce((s, r) => s + r.amount, 0);
  order.refundTotal = order.recovery.filter((r) => r.kind === 'refund').reduce((s, r) => s + r.amount, 0);
  if (action.type === 'ORDER_FAILED' || action.severe) order.refundStatus = 'refunded';
  if (action.escalate) escalate(state, order, action);
  log(order, `Recovery Engine: ${action.trigger} \u2192 ${action.action}`);
  return entry;
}

function escalate(state, order, action) {
  if (state.tickets.some((t) => t.orderId === order.id && t.auto)) return;
  state.seq += 1;
  state.tickets.unshift({
    id: `T-${3000 + state.tickets.length + 1}`,
    orderId: order.id,
    type: action.type === 'DELAY' ? 'DELIVERY_DELAYED' : 'REFUND_PENDING',
    openedHoursAgo: 0,
    openedAt: nowIso(),
    status: 'open',
    auto: true
  });
}

function transition(state, order, status) {
  if (!nextStatuses(order.status).includes(status)) {
    throw new HttpError(409, `Cannot move order from "${order.status}" to "${status}".`);
  }
  order.status = status;
  order.timeline.push({ key: status, label: STEP_LABELS[status], at: nowIso() });
  log(order, STEP_LABELS[status]);
  if (status === 'rider_assigned') {
    const store = state.stores.find((s) => s.id === order.storeId);
    const idx = state.orders.indexOf(order) % state.riders.length;
    order.riderId = state.riders[idx].id;
    log(order, `Rider ${state.riders[idx].name} assigned (${store.riders} riders near store)`);
  }
  if (status === 'delivered') {
    order.actualMin = order.projectedMin;
    applyRecovery(state, order, recovery.evaluateDelay(order, order.actualMin));
  }
  if (status === 'cancelled' || status === 'rejected') {
    const reason = status === 'rejected' ? 'STORE REJECTED ORDER' : 'ORDER CANCELLED';
    order.issue = status === 'rejected' ? 'Store rejected the order' : 'Order cancelled before delivery';
    applyRecovery(state, order, recovery.evaluateStoreFailure(order, reason));
  }
}

function createOrder(state, body, overrides = {}) {
  const { customerId = 'c-demo', storeId, items, couponCode } = body || {};
  if (!state.customers.some((c) => c.id === customerId)) throw new HttpError(400, 'Unknown customer.');
  const store = state.stores.find((s) => s.id === storeId);
  if (!store) throw new HttpError(400, 'Unknown store.');
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) throw new HttpError(400, 'Cart must contain 1-20 items.');
  const quote = buildQuote(state, { storeId, items, couponCode }, overrides);
  quote.lines.forEach((l) => {
    if (l.evaluation.qty < l.qty) throw new HttpError(409, `Only ${l.evaluation.qty} of "${l.name}" left. Please update your cart.`);
    if (l.evaluation.confidence < 25) throw new HttpError(409, `"${l.name}" cannot be promised right now.`);
  });
  const maxEta = Math.max(...quote.lines.map((l) => l.evaluation.eta.max));
  const minEta = Math.max(...quote.lines.map((l) => l.evaluation.eta.min));
  state.seq += 1;
  const d = new Date();
  const ymd = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
  const order = {
    id: `NC-${ymd}-${state.seq}`,
    customerId,
    storeId,
    items: quote.lines.map((l) => ({ inventoryId: l.inventoryId, productId: l.productId, name: l.name, qty: l.qty, price: l.price })),
    amount: quote.total,
    pricing: { ...quote.pricing, couponOptions: undefined },
    promisedMin: minEta,
    promisedMax: Math.max(maxEta, minEta + 2),
    status: 'placed',
    createdAt: nowIso(),
    projectedMin: Math.round((minEta + maxEta) / 2),
    confidenceAtOrder: quote.pricing.cartConfidence,
    refundStatus: 'none',
    timeline: [{ key: 'placed', label: STEP_LABELS.placed, at: nowIso() }],
    events: [],
    recovery: [],
    creditTotal: 0,
    refundTotal: 0,
    issue: ''
  };
  quote.lines.forEach((l) => {
    const inv = state.inventory.find((i) => i.id === l.inventoryId);
    inv.qty -= l.qty;
  });
  log(order, 'Order confirmed. Promise calculated by Trust Engine.');
  state.orders.unshift(order);
  return order;
}

function buildQuote(state, { storeId, items, couponCode }, overrides = {}) {
  const store = state.stores.find((s) => s.id === storeId);
  if (!store) throw new HttpError(400, 'Unknown store.');
  if (!Array.isArray(items) || items.length === 0 || items.length > 20) throw new HttpError(400, 'Cart must contain 1-20 items.');
  const lines = items.map((it) => {
    const qty = Number(it.qty);
    if (!Number.isInteger(qty) || qty < 1 || qty > 10) throw new HttpError(400, 'Quantity must be a whole number from 1 to 10.');
    const inv = state.inventory.find((i) => i.id === it.inventoryId);
    if (!inv || inv.storeId !== storeId) throw new HttpError(400, `Item ${it.inventoryId} is not sold by this store.`);
    const evaluation = trust.evaluate(state, inv, overrides);
    return { inventoryId: inv.id, productId: inv.productId, name: evaluation.product.name, price: evaluation.product.price, qty, evaluation };
  });
  const conditions = lines[0].evaluation.conditions;
  const pricingResult = pricing.quote({ lines, store, conditions, coupons: state.coupons, couponCode, tierFor: trust.couponTier });
  const etaMin = Math.max(...lines.map((l) => l.evaluation.eta.min));
  const etaMax = Math.max(...lines.map((l) => l.evaluation.eta.max));
  return {
    lines,
    pricing: pricingResult,
    total: pricingResult.total,
    eta: { min: etaMin, max: Math.max(etaMax, etaMin + 2) },
    store: { id: store.id, name: store.name }
  };
}

function simulateDelay(state, order, minutes) {
  if (order.terminal || TERMINAL.includes(order.status)) throw new HttpError(409, 'Order is already closed.');
  order.projectedMin = order.promisedMax + minutes;
  log(order, `Delivery delayed: projected ${order.projectedMin} min`);
  return applyRecovery(state, order, recovery.evaluateDelay(order, order.projectedMin));
}

function simulateRiderDelay(state, order) {
  if (TERMINAL.includes(order.status)) throw new HttpError(409, 'Order is already closed.');
  order.projectedMin += 10;
  log(order, 'Rider delayed (+10 min)');
  return applyRecovery(state, order, recovery.evaluateDelay(order, order.projectedMin));
}

function simulateMissing(state, order, unavailable = false) {
  if (['cancelled', 'rejected'].includes(order.status)) throw new HttpError(409, 'Order is already closed.');
  const line = order.items[0];
  if (unavailable) {
    const inv = state.inventory.find((i) => i.id === line.inventoryId);
    if (inv) {
      inv.qty = 0;
      inv.updatedHoursAgo = 0;
    }
  }
  order.issue = unavailable ? `Item unavailable after order: ${line.name}` : `Missing item: ${line.name}`;
  return applyRecovery(state, order, recovery.evaluateMissingItem(order, line, unavailable ? 'ITEM UNAVAILABLE AFTER ORDER' : 'ITEM MISSING'));
}

function simulateSubstitution(state, order) {
  if (['cancelled', 'rejected'].includes(order.status)) throw new HttpError(409, 'Order is already closed.');
  const line = order.items[0];
  order.issue = `Substitution: ${line.name}`;
  return applyRecovery(state, order, recovery.evaluateSubstitution(line));
}

function supportAction(state, order, action) {
  const customer = state.customers.find((c) => c.id === order.customerId);
  switch (action) {
    case 'refund': {
      const due = order.amount - order.refundTotal;
      if (order.refundStatus === 'refunded' || due <= 0) throw new HttpError(409, 'Refund already issued for this order.');
      order.refundStatus = 'refunded';
      order.refundTotal += due;
      addWalletTxn(state, order, 'refund', due, 'Refund approved by support');
      log(order, `Support approved refund of \u20B9${due}`);
      return { message: `\u20B9${due} refund approved for ${customer.name}` };
    }
    case 'credit': {
      order.creditTotal += 50;
      addWalletTxn(state, order, 'credit', 50, 'Support goodwill credit');
      log(order, 'Support issued \u20B950 credit');
      return { message: '\u20B950 credit issued' };
    }
    case 'reassign': {
      if (TERMINAL.includes(order.status)) throw new HttpError(409, 'Only in-flight orders can be reassigned.');
      const next = state.riders[(state.riders.findIndex((r) => r.id === order.riderId) + 1) % state.riders.length];
      order.riderId = next.id;
      order.projectedMin = Math.max(order.promisedMin, order.projectedMin - 8);
      log(order, `Rider reassigned to ${next.name}; projected time now ${order.projectedMin} min`);
      return { message: `Rider reassigned to ${next.name}. Projected ${order.projectedMin} min.` };
    }
    case 'contact': {
      const store = state.stores.find((s) => s.id === order.storeId);
      log(order, `Template message sent to ${store.name}: "Please confirm stock and prepare order ${order.id} now."`);
      return { message: `Message sent to ${store.name}` };
    }
    default:
      throw new HttpError(400, 'Unknown action. Use refund, credit, reassign or contact.');
  }
}

function decorateTickets(state) {
  const rank = { HIGH: 0, MEDIUM: 1, LOW: 2 };
  return state.tickets
    .map((t) => {
      const order = findOrder(state, t.orderId);
      const customer = state.customers.find((c) => c.id === order.customerId);
      const delayMin = delayMinutes(order);
      const priority = support.prioritize(t, order, customer, delayMin);
      return {
        ...t,
        issueLabel: support.ISSUE_LABEL[t.type],
        customerName: customer.name,
        storeName: state.stores.find((s) => s.id === order.storeId).name,
        amount: order.amount,
        delayMin,
        priority
      };
    })
    .sort((a, b) => (a.status === 'resolved') - (b.status === 'resolved') || b.priority.score - a.priority.score || rank[a.priority.level] - rank[b.priority.level]);
}

module.exports = {
  HttpError, findOrder, decorate, transition, createOrder, buildQuote, nextStatuses,
  simulateDelay, simulateRiderDelay, simulateMissing, simulateSubstitution, supportAction, decorateTickets, delayMinutes
};
