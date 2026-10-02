// Dynamic ETA. Every term is explicit so the promise can be explained to a judge.
//   ETA = storePrep + riderPickup + travel + reliabilityAdj + riderAdj + handoff
const RIDER_PICKUP_MIN = 8;
const HANDOFF_MIN = 3;
const MIN_PER_KM = 4.5;

function riderAdjustment(riders) {
  if (riders >= 4) return -2; // plenty of riders: faster assignment
  if (riders >= 2) return 0;
  if (riders === 1) return 4;
  return 10; // nobody free: expect a wait
}

function estimateEta({ store, confidence, storeReliability, conditions }) {
  const prep = store.avgPrepMin * (1 + store.load * 0.5); // busy stores take longer
  const travel = store.distanceKm * MIN_PER_KM * conditions.traffic;
  const reliabilityAdj = ((100 - storeReliability) / 100) * 8; // unreliable stores need buffer
  const riderAdj = riderAdjustment(conditions.riders);
  const mid = prep + RIDER_PICKUP_MIN + travel + reliabilityAdj + riderAdj + HANDOFF_MIN;
  // Lower confidence => wider, more honest range instead of one optimistic number.
  const spread = 3 + ((100 - confidence) / 100) * 8;
  const min = Math.max(8, Math.round(mid - spread / 2));
  const max = Math.max(min + 2, Math.round(mid + spread / 2));
  return {
    min,
    max,
    mid: Math.round(mid),
    components: {
      storePrep: Math.round(prep * 10) / 10,
      riderPickup: RIDER_PICKUP_MIN,
      travel: Math.round(travel * 10) / 10,
      reliabilityAdj: Math.round(reliabilityAdj * 10) / 10,
      riderAdj,
      handoff: HANDOFF_MIN,
      spread: Math.round(spread * 10) / 10
    }
  };
}

module.exports = { estimateEta };
