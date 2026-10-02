// Transparent pricing + coupon eligibility driven by Trust Engine confidence.
const BASE_DELIVERY_FEE = 25;
const FREE_DELIVERY_ABOVE = 399;
const SURGE_FEE = 10;
const SURGE_TRAFFIC = 1.4;
const TAX_RATE = 0.05; // illustrative GST on discounted item value

function couponDiscount(coupon, itemTotal, tier) {
  const raw = coupon.type === 'percent' ? Math.min(coupon.cap ?? Infinity, Math.round((itemTotal * coupon.value) / 100)) : coupon.value;
  return tier === 'LIMITED' ? Math.floor(raw / 2) : raw;
}

function evaluateCoupon(coupon, itemTotal, cartConfidence, tierInfo) {
  const base = { code: coupon.code, title: coupon.title, eligible: false, discount: 0, reason: '' };
  if (tierInfo.tier === 'DISABLED') return { ...base, reason: tierInfo.reason };
  if (itemTotal < coupon.minOrder) return { ...base, reason: `Add ₹${coupon.minOrder - itemTotal} more to use this coupon.` };
  if (coupon.minConfidence && cartConfidence < coupon.minConfidence) {
    return { ...base, reason: `Reserved for orders with ${coupon.minConfidence}%+ fulfillment confidence.` };
  }
  const discount = couponDiscount(coupon, itemTotal, tierInfo.tier);
  return { ...base, eligible: discount > 0, discount, reason: tierInfo.tier === 'LIMITED' ? tierInfo.reason : 'Eligible.' };
}

function quote({ lines, store, conditions, coupons, couponCode, tierFor }) {
  const itemTotal = lines.reduce((s, l) => s + l.price * l.qty, 0);
  const cartConfidence = Math.min(...lines.map((l) => l.evaluation.confidence));
  const tierInfo = tierFor(cartConfidence);
  const options = coupons.map((c) => evaluateCoupon(c, itemTotal, cartConfidence, tierInfo));

  let applied = null;
  let warning = null;
  const requested = (couponCode || 'AUTO').toUpperCase();
  if (requested === 'AUTO') {
    applied = options.filter((o) => o.eligible).sort((a, b) => b.discount - a.discount)[0] || null;
  } else if (requested !== 'NONE') {
    const found = options.find((o) => o.code === requested);
    if (found && found.eligible) applied = found;
    else warning = found ? found.reason : 'Unknown coupon code.';
  }

  const discount = applied ? applied.discount : 0;
  const deliveryFee = itemTotal >= FREE_DELIVERY_ABOVE ? 0 : BASE_DELIVERY_FEE;
  const surge = conditions.traffic > SURGE_TRAFFIC ? SURGE_FEE : 0;
  const taxes = Math.round((itemTotal - discount) * TAX_RATE);
  const total = itemTotal - discount + deliveryFee + surge + taxes;
  return {
    itemTotal,
    deliveryFee,
    surge,
    taxes,
    discount,
    total,
    cartConfidence,
    promoTier: tierInfo.tier,
    promoMessage: tierInfo.reason,
    appliedCoupon: applied ? applied.code : null,
    couponOptions: options,
    warning,
    notes: { freeDeliveryAbove: FREE_DELIVERY_ABOVE, taxRatePct: TAX_RATE * 100 }
  };
}

module.exports = { quote };
