const test = require('node:test');
const assert = require('node:assert/strict');
const S = require('../js/stats.js');
const D = require('../js/benchmarks.js');

const close = (a, b, tol = 0.01) => assert.ok(Math.abs(a - b) < tol, `${a} !≈ ${b}`);

test('normCdf matches known values', () => {
  close(S.normCdf(0), 0.5, 1e-6);
  close(S.normCdf(1.96), 0.975, 1e-3);
  close(S.normCdf(-1.2816), 0.10, 1e-3);
});

test('income at the median is the 50th percentile', () => {
  close(S.incomePercentile(1000, 1000, 0.6), 50, 1e-4);
});

test('incomeAtPercentile inverts incomePercentile', () => {
  for (const p of [10, 25, 75, 90]) {
    const x = S.incomeAtPercentile(p, 1200, 0.6);
    close(S.incomePercentile(x, 1200, 0.6), p, 0.05);
  }
});

test('zero or missing income is the 0th percentile', () => {
  assert.equal(S.incomePercentile(0, 1000, 0.6), 0);
  assert.equal(S.incomePercentile(NaN, 1000, 0.6), 0);
});

test('findBand picks the right age band', () => {
  assert.equal(S.findBand(29, D.INCOME.bands).label, '25–34');
  assert.equal(S.findBand(70, D.INCOME.bands).label, '65+');
  assert.equal(S.findBand(12, D.INCOME.bands), null);
});

test('habitScore handles both directions and clamps', () => {
  assert.equal(S.habitScore(7, 7, true), 100);
  assert.equal(S.habitScore(3.5, 7, true), 50);
  assert.equal(S.habitScore(282, 141, false), 50);
  assert.equal(S.habitScore(0, 141, false), 200);
  assert.equal(S.habitScore(1000, 5, true), 200);
});

test('goalProgress: halfway through time, quarter done is critical', () => {
  const today = S.parseDate('2026-07-02');
  const g = S.goalProgress({ startValue: 0, target: 100, current: 25, startDate: '2026-01-01', deadline: '2026-12-31' }, today);
  close(g.expectedPct, 49.9, 0.5);
  assert.equal(g.status, 'critical');
  assert.ok(g.lateByDays > 300);
});

test('goalProgress: ahead of pace and done', () => {
  const today = S.parseDate('2026-04-01');
  const g = S.goalProgress({ startValue: 0, target: 10, current: 5, startDate: '2026-01-01', deadline: '2026-12-31' }, today);
  assert.equal(g.status, 'ahead');
  const done = S.goalProgress({ startValue: 0, target: 10, current: 12, startDate: '2026-01-01', deadline: '2026-12-31' }, today);
  assert.equal(done.status, 'done');
});

test('goalProgress: decreasing goals (e.g. weight loss) work', () => {
  const today = S.parseDate('2026-07-02');
  const g = S.goalProgress({ startValue: 90, target: 80, current: 85, startDate: '2026-01-01', deadline: '2026-12-31' }, today);
  close(g.actualPct, 50, 0.01);
  assert.equal(g.status, 'ahead');
});

test('goalProgress: past deadline and unfinished is critical', () => {
  const today = S.parseDate('2027-02-01');
  const g = S.goalProgress({ startValue: 0, target: 10, current: 9, startDate: '2026-01-01', deadline: '2026-12-31' }, today);
  assert.equal(g.status, 'critical');
  assert.ok(g.daysLeft < 0);
});

test('goalProgress rejects bad input', () => {
  assert.equal(S.goalProgress({ target: 10, startDate: 'x', deadline: '2026-01-01' }, 0).status, 'invalid');
  assert.equal(S.goalProgress({ startValue: 5, target: 5, startDate: '2026-01-01', deadline: '2026-02-01' }, 0).status, 'invalid');
});
