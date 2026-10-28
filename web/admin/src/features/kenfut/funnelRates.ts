export function formatFunnelRate(
  numerator: number,
  denominator: number,
  connected = true,
) {
  if (!connected || denominator <= 0) return '—';
  return `${((numerator / denominator) * 100).toFixed(1)}%`;
}
