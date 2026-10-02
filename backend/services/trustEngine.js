// Prototype Confidence Model: transparent, deterministic, NOT machine learning.
const { estimateEta } = require('./etaEngine');

const MODEL_NAME = 'Prototype Confidence Model';
const WEIGHTS = {
  inventory: 0.35,
  freshness: 0.2,
  storeReliability: 0.2,
  availabilityAccuracy: 0.15,
  deliveryFeasibility: 0.1
};
const clamp = (v, min = 0, max = 100) => Math.min(max, Math.max(min, v));

const scoreInventory = (qty) => (qty <= 0 ? 0 : clamp(40 + qty * 6));
const scoreFreshness = (hours) => (hours <= 2 ? 100 : clamp(100 - (hours - 2) * 1.5, 5));
const scoreStoreReliability = (s) =>
  clamp(0.5 * s.acceptanceRate + 0.3 * (100 - 4 * s.cancellationRate) + 0.2 * (100 - 2 * s.substitutionRate));
const scoreDelivery = (s, c) => {
  let v = 100 - s.load * 35 - (c.traffic - 1) * 60 - s.distanceKm * 4 + Math.min(c.riders, 4) * 3;
  if (c.riders === 0) v -= 30;
  return clamp(v);
};

function labelFor(confidence) {
  if (confidence >= 80) return 'HIGH';
  if (confidence >= 60) return 'LIMITED';
  return 'AT_RISK';
}

const AVAILABILITY_TEXT = { HIGH: 'High availability', LIMITED: 'Limited availability', AT_RISK: 'At risk' };
const RISK = { HIGH: 'LOW', LIMITED: 'MEDIUM', AT_RISK: 'HIGH' };

function couponTier(confidence) {
  if (confidence >= 80) {
    return { tier: 'FULL', couponEligible: true, reason: 'Eligible for normal promotional coupons.' };
  }
  if (confidence >= 60) {
    return {
      tier: 'LIMITED',
      couponEligible: true,
      reason: 'Limited promotion: discounts are halved while fulfillment confidence is 60-79%.'
    };
  }
  return {
    tier: 'DISABLED',
    couponEligible: false,
    reason: 'Promotion unavailable because this item has elevated fulfillment risk.'
  };
}

function conditionsFor(store, overrides = {}) {
  return {
    traffic: overrides.traffic ?? store.traffic,
    riders: overrides.riders ?? store.riders
  };
}

function evaluate(state, inv, overrides = {}) {
  const product = state.products.find((p) => p.id === inv.productId);
  const store = state.stores.find((s) => s.id === inv.storeId);
  const conditions = conditionsFor(store, overrides);

  const scores = {
    inventory: scoreInventory(inv.qty),
    freshness: scoreFreshness(inv.updatedHoursAgo),
    storeReliability: scoreStoreReliability(store),
    availabilityAccuracy: clamp(inv.availabilityAccuracy),
    deliveryFeasibility: scoreDelivery(store, conditions)
  };
  let raw = Object.keys(WEIGHTS).reduce((sum, k) => sum + scores[k] * WEIGHTS[k], 0);
  if (!store.online) raw = Math.min(raw, 10);
  if (inv.qty <= 0) raw = Math.min(raw, 20); // cannot promise what is not on the shelf
  const confidence = Math.round(raw);
  const label = labelFor(confidence);
  const eta = estimateEta({ store, confidence, storeReliability: scores.storeReliability, conditions });

  const names = {
    inventory: 'Inventory level',
    freshness: 'Update freshness',
    storeReliability: 'Store reliability',
    availabilityAccuracy: 'Availability accuracy',
    deliveryFeasibility: 'Delivery feasibility'
  };
  return {
    inventoryId: inv.id,
    productId: product.id,
    storeId: store.id,
    product,
    store: { id: store.id, name: store.name, online: store.online, category: store.category },
    qty: inv.qty,
    updatedHoursAgo: inv.updatedHoursAgo,
    confidence,
    label,
    availability: label,
    availabilityText: AVAILABILITY_TEXT[label],
    risk: RISK[label],
    visible: label !== 'AT_RISK',
    eta: { min: eta.min, max: eta.max, mid: eta.mid, components: eta.components },
    coupon: couponTier(confidence),
    couponEligible: couponTier(confidence).couponEligible,
    factors: Object.keys(WEIGHTS).map((k) => ({
      key: k,
      label: names[k],
      score: Math.round(scores[k]),
      weight: WEIGHTS[k]
    })),
    conditions,
    model: MODEL_NAME
  };
}

function evaluateAll(state, overrides = {}) {
  return state.inventory.map((inv) => evaluate(state, inv, overrides));
}

function storeSummary(state, store, overrides = {}) {
  const rows = state.inventory.filter((i) => i.storeId === store.id).map((i) => evaluate(state, i, overrides));
  const avg = (arr) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
  const accuracy = avg(state.inventory.filter((i) => i.storeId === store.id).map((i) => i.availabilityAccuracy));
  const inventoryHealth = avg(rows.map((r) => (r.qty > 0 ? r.factors[1].score : 0)));
  return {
    ...store,
    confidence: avg(rows.map((r) => r.confidence)),
    stockAccuracy: accuracy,
    inventoryHealth,
    skuCount: rows.length,
    outOfStock: rows.filter((r) => r.qty === 0).length,
    reliabilityScore: Math.round(scoreStoreReliability(store))
  };
}

module.exports = { evaluate, evaluateAll, storeSummary, labelFor, couponTier, WEIGHTS, MODEL_NAME, scoreStoreReliability };
