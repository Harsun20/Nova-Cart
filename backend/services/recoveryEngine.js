// Automatic recovery: turns an SLA breach / fulfillment failure into a compensation decision.
const SEVERE_LATE_MIN = 25;

const delayCredit = (lateBy) => Math.min(100, 20 + Math.ceil(lateBy * 1.5));
const fmtRange = (o) => `${o.promisedMin}\u2013${o.promisedMax} min`;

function evaluateDelay(order, actualMin) {
  const lateBy = actualMin - order.promisedMax;
  if (lateBy <= 0) return null;
  const severe = lateBy >= SEVERE_LATE_MIN;
  const amount = severe ? order.amount : delayCredit(lateBy);
  return {
    type: 'DELAY',
    trigger: 'SLA BREACHED',
    promised: fmtRange(order),
    actual: `${actualMin} min`,
    lateBy,
    severe,
    kind: severe ? 'refund' : 'credit',
    amount,
    escalate: severe,
    action: severe ? `Full refund of \u20B9${amount} + support escalation` : `\u20B9${amount} wallet credit automatically issued`,
    message: severe
      ? `Your order was ${lateBy} minutes later than promised. We've refunded \u20B9${amount} and a support specialist is following up.`
      : `Your order was ${lateBy} minutes later than promised. \u20B9${amount} has been credited automatically.`
  };
}

function evaluateMissingItem(order, line, trigger = 'ITEM MISSING') {
  const amount = line.price * line.qty;
  return {
    type: 'MISSING_ITEM',
    trigger,
    item: line.name,
    kind: 'refund',
    amount,
    escalate: false,
    action: `\u20B9${amount} partial refund issued`,
    message: `${line.name} could not be delivered. \u20B9${amount} has been refunded automatically.`
  };
}

function evaluateSubstitution(line) {
  const amount = 15;
  return {
    type: 'SUBSTITUTION',
    trigger: 'ITEM SUBSTITUTED',
    item: line.name,
    kind: 'credit',
    amount,
    escalate: false,
    action: `Substitution notice sent + \u20B9${amount} goodwill credit`,
    message: `${line.name} was substituted with a similar item. \u20B9${amount} has been credited for the inconvenience.`
  };
}

function evaluateStoreFailure(order, reason) {
  return {
    type: 'ORDER_FAILED',
    trigger: reason,
    kind: 'refund',
    amount: order.amount,
    escalate: false,
    action: `Full refund of \u20B9${order.amount} issued instantly`,
    message: `We couldn't fulfil your order. \u20B9${order.amount} has been refunded automatically.`
  };
}

module.exports = { evaluateDelay, evaluateMissingItem, evaluateSubstitution, evaluateStoreFailure, SEVERE_LATE_MIN };
