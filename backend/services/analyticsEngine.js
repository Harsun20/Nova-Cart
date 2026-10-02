const trust = require('./trustEngine');
const orderService = require('./orderService');

const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, v));
const round1 = (v) => Math.round(v * 10) / 10;
const MONTHS = ['Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct'];

function trend(from, to) {
  return MONTHS.map((m, i) => ({ month: m, value: round1(from + ((to - from) * i) / (MONTHS.length - 1)) }));
}

function trustHealth(state) {
  const all = trust.evaluateAll(state);
  const avg = (a) => Math.round(a.reduce((x, y) => x + y, 0) / a.length);
  const fulfillmentConfidence = avg(all.map((e) => e.confidence));
  const inventoryAccuracy = avg(state.inventory.map((i) => i.availabilityAccuracy));
  const base = baselineScenario(state.metrics);
  const deliveryReliability = Math.round(base.onTime);
  const orders = state.orders.map((o) => orderService.decorate(state, o));
  const breached = orders.filter((o) => o.health === 'DELAYED' || o.health === 'CANCELLED' || /issing|navailable|ubstitut/.test(o.issue));
  const compensated = breached.filter((o) => o.compensated);
  const share = breached.length ? compensated.length / breached.length : 0;
  const recoveryPerformance = Math.round(54 + 46 * share);
  const score = Math.round((fulfillmentConfidence + deliveryReliability + inventoryAccuracy + recoveryPerformance) / 4);
  return {
    score,
    components: [
      { key: 'fulfillmentConfidence', label: 'Fulfillment Confidence', value: fulfillmentConfidence },
      { key: 'deliveryReliability', label: 'Delivery Reliability', value: deliveryReliability },
      { key: 'inventoryAccuracy', label: 'Inventory Accuracy', value: inventoryAccuracy },
      { key: 'recoveryPerformance', label: 'Recovery Performance', value: recoveryPerformance }
    ],
    note: 'Fulfillment confidence and recovery react to live demo actions; delivery reliability and inventory accuracy use labelled prototype assumptions.'
  };
}

// ---- Scenario model (illustrative, transparent, calibrated so the baseline reproduces the case) ----
function runScenario(metrics, p) {
  const a = metrics.assumptions;
  const cur = metrics.current;
  const causes = Object.fromEntries(metrics.cancellationCauses.map((c) => [c.label, c.pct / 100]));
  const cancelBase = cur.cancellationRate;
  const unavailable = cancelBase * causes['Product unavailable'] * ((100 - p.inventoryAccuracy) / (100 - a.inventoryAccuracy));
  const delayPressure = ((100 - p.riderAvailability) / (100 - a.riderAvailability) + (100 - p.deliveryReliability) / (100 - a.deliveryReliability)) / 2;
  const delay = cancelBase * causes['Delivery delay'] * delayPressure;
  const rejection = cancelBase * causes['Store rejection'] * ((100 - p.storeAcceptance) / (100 - a.storeAcceptance));
  const other = cancelBase * causes['Other'];
  const cancellationRate = unavailable + delay + rejection + other;
  const onTime = clamp(0.6 * p.deliveryReliability + 0.4 * p.riderAvailability);
  const baseOnTime = 0.6 * a.deliveryReliability + 0.4 * a.riderAvailability;
  const tickets = cur.supportTickets * (0.45 * (cancellationRate / cancelBase) + 0.35 * ((100 - onTime) / (100 - baseOnTime)) + 0.2);
  const repeat = clamp(cur.repeatRate + (cancelBase - cancellationRate) * 1.8 + (onTime - baseOnTime) * 0.15, 0, 100);
  const cancelledOrders = Math.round((cur.monthlyOrders * cancellationRate) / 100);
  return {
    inputs: p,
    cancellationRate: round1(cancellationRate),
    onTimeRate: round1(onTime),
    supportTickets: Math.round(tickets),
    ticketsPer1000Orders: round1((tickets / cur.monthlyOrders) * 1000),
    repeatPurchaseLikelihood: round1(repeat),
    cancelledOrdersPerMonth: cancelledOrders
  };
}

function baselineScenario(metrics) {
  const a = metrics.assumptions;
  return { onTime: 0.6 * a.deliveryReliability + 0.4 * a.riderAvailability };
}

function simulation(metrics, params) {
  const base = metrics.assumptions;
  const baseline = runScenario(metrics, {
    inventoryAccuracy: base.inventoryAccuracy,
    riderAvailability: base.riderAvailability,
    storeAcceptance: base.storeAcceptance,
    deliveryReliability: base.deliveryReliability
  });
  const scenario = runScenario(metrics, params);
  const ordersPerPoint = Math.round(metrics.current.monthlyOrders / 100);
  return {
    label: 'Illustrative prototype scenario - not a measured result',
    baseline,
    scenario,
    deltas: {
      cancellationRate: round1(scenario.cancellationRate - baseline.cancellationRate),
      onTimeRate: round1(scenario.onTimeRate - baseline.onTimeRate),
      supportTickets: scenario.supportTickets - baseline.supportTickets,
      repeatPurchaseLikelihood: round1(scenario.repeatPurchaseLikelihood - baseline.repeatPurchaseLikelihood),
      cancelledOrdersPerMonth: scenario.cancelledOrdersPerMonth - baseline.cancelledOrdersPerMonth
    },
    ordersPerPercentagePoint: ordersPerPoint,
    method: [
      'Cancellations are split into the case causes (35% unavailable, 27% delay, 18% rejection, 20% other).',
      'Each cause scales with how far its driver moves from the assumed baseline.',
      'On-time = 60% delivery reliability + 40% rider availability.',
      'Tickets and repeat likelihood use simple linear coefficients chosen for illustration.'
    ]
  };
}

function overview(state) {
  const m = state.metrics;
  const base = runScenario(m, m.assumptions);
  return {
    current: m.current,
    sixMonthsAgo: m.sixMonthsAgo,
    ticketsPer1000Orders: round1((m.current.supportTickets / m.current.monthlyOrders) * 1000),
    ticketsPer1000OrdersBefore: round1((m.sixMonthsAgo.supportTickets / 38500) * 1000),
    survey: m.survey,
    cancellationCauses: m.cancellationCauses,
    ticketCauses: m.ticketCauses,
    trends: {
      repeatRate: trend(m.sixMonthsAgo.repeatRate, m.current.repeatRate),
      avgDeliveryMin: trend(m.sixMonthsAgo.avgDeliveryMin, m.current.avgDeliveryMin),
      cancellationRate: trend(m.sixMonthsAgo.cancellationRate, m.current.cancellationRate),
      supportTickets: trend(m.sixMonthsAgo.supportTickets, m.current.supportTickets)
    },
    trendNote: 'Case gives two data points (six months ago and now). Months in between are a straight-line interpolation for display.',
    assumptions: m.assumptions,
    baselineModel: base,
    scenarioPreset: m.scenarioPreset,
    trustHealth: trustHealth(state),
    impact: {
      ordersPerPercentagePointCancellation: Math.round(m.current.monthlyOrders / 100),
      cancelledOrdersPerMonth: Math.round((m.current.monthlyOrders * m.current.cancellationRate) / 100),
      cancellationIncreaseOrders: Math.round((m.current.monthlyOrders * (m.current.cancellationRate - m.sixMonthsAgo.cancellationRate)) / 100),
      extraTickets: m.current.supportTickets - m.sixMonthsAgo.supportTickets,
      refundTickets: Math.round(m.current.supportTickets * 0.29),
      delayTickets: Math.round(m.current.supportTickets * 0.24),
      missingTickets: Math.round(m.current.supportTickets * 0.19)
    }
  };
}

module.exports = { overview, simulation, runScenario };
