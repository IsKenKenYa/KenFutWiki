import assert from 'node:assert/strict';
import test from 'node:test';
import { formatFunnelRate } from '../src/features/kenfut/funnelRates.ts';

test('按访客数计算逐段转化率', () => {
  assert.equal(formatFunnelRate(2, 3), '66.7%');
  assert.equal(formatFunnelRate(0, 3), '0.0%');
  assert.equal(formatFunnelRate(3, 3), '100.0%');
});
test('没有分母或阶段未接入时显示破折号', () => {
  assert.equal(formatFunnelRate(0, 0), '—');
  assert.equal(formatFunnelRate(1, 3, false), '—');
});
