// In-memory demo state seeded from JSON files. Resettable.
const clone = (o) => JSON.parse(JSON.stringify(o));
const raw = {
  stores: require('./data/stores.json'),
  products: require('./data/products.json'),
  inventory: require('./data/inventory.json'),
  customers: require('./data/customers.json'),
  riders: require('./data/riders.json'),
  coupons: require('./data/coupons.json'),
  orders: require('./data/orders.json'),
  tickets: require('./data/tickets.json'),
  metrics: require('./data/metrics.json')
};

const STEPS = ['placed', 'accepted', 'rider_assigned', 'out_for_delivery', 'delivered'];
const STEP_LABELS = {
  placed: 'Order confirmed',
  accepted: 'Store accepted',
  rider_assigned: 'Rider assigned',
  out_for_delivery: 'Delivery started',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  rejected: 'Rejected by store'
};

function build() {
  const now = Date.now();
  const state = {
    stores: clone(raw.stores),
    products: clone(raw.products),
    inventory: clone(raw.inventory),
    customers: clone(raw.customers),
    riders: clone(raw.riders),
    coupons: clone(raw.coupons),
    metrics: clone(raw.metrics),
    wallet: [],
    seq: 4800
  };
  state.tickets = clone(raw.tickets).map((t) => ({ ...t, openedAt: new Date(now - t.openedHoursAgo * 3600e3).toISOString() }));
  state.orders = clone(raw.orders).map((o) => {
    const created = now - o.createdMinAgo * 60e3;
    const idx = STEPS.indexOf(o.status);
    const keys = idx >= 0 ? STEPS.slice(0, idx + 1) : ['placed', o.status];
    return {
      ...o,
      createdAt: new Date(created).toISOString(),
      timeline: keys.map((key, i) => ({ key, label: STEP_LABELS[key], at: new Date(created + i * 3 * 60e3).toISOString() })),
      events: [],
      recovery: [],
      creditTotal: 0,
      refundTotal: 0
    };
  });
  return state;
}

let state = build();
module.exports = {
  getState: () => state,
  reset: () => {
    state = build();
    return state;
  },
  STEPS,
  STEP_LABELS
};
