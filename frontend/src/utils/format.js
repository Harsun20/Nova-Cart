export const inr = (n) => `\u20B9${Number(n).toLocaleString('en-IN')}`;

export function ago(hours) {
  if (hours < 1) return 'just now';
  if (hours < 24) return `${Math.round(hours)}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

export function timeOf(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' });
}

export const tone = (label) =>
  ({ HIGH: 'good', LOW: 'good', LIMITED: 'warn', MEDIUM: 'warn', AT_RISK: 'bad' }[label] || 'neutral');
