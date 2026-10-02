// Prototype Risk Prioritization: a simple additive score. Not AI.
const ISSUE_WEIGHT = {
  REFUND_PENDING: 25,
  MISSING_PRODUCT: 20,
  DELIVERY_DELAYED: 18,
  INCORRECT_ORDER: 15,
  COUPON_ISSUE: 8
};
const ISSUE_LABEL = {
  REFUND_PENDING: 'Refund pending',
  MISSING_PRODUCT: 'Missing product',
  DELIVERY_DELAYED: 'Delivery delayed',
  INCORRECT_ORDER: 'Incorrect order',
  COUPON_ISSUE: 'Coupon issue'
};

function prioritize(ticket, order, customer, delayMin) {
  const factors = {
    orderValue: Math.round(Math.min(25, order.amount / 12)),
    delaySeverity: Math.round(Math.min(30, delayMin * 1.2)),
    customerFrequency: Math.min(20, customer.orders90d * 2),
    issueType: ISSUE_WEIGHT[ticket.type] ?? 10
  };
  const score = Object.values(factors).reduce((a, b) => a + b, 0);
  const level = score >= 60 ? 'HIGH' : score >= 40 ? 'MEDIUM' : 'LOW';
  return { score, level, factors };
}

module.exports = { prioritize, ISSUE_LABEL };
