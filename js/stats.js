/*
 * Pure math: percentiles, habit scores, goal pacing.
 * No DOM access, so it runs in the browser and under `node --test`.
 */
(function (root) {
  'use strict';

  var DAY_MS = 86400000;

  // Abramowitz & Stegun 7.1.26, max error ~1.5e-7.
  function erf(x) {
    var sign = x < 0 ? -1 : 1;
    x = Math.abs(x);
    var t = 1 / (1 + 0.3275911 * x);
    var y = 1 - (((((1.061405429 * t - 1.453152027) * t) + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x);
    return sign * y;
  }

  function normCdf(z) {
    return 0.5 * (1 + erf(z / Math.SQRT2));
  }

  // Share of peers (0–100) earning less than `income` under a log-normal model.
  function incomePercentile(income, median, sigma) {
    if (!(income > 0)) return 0;
    return 100 * normCdf((Math.log(income) - Math.log(median)) / sigma);
  }

  var Z = { 10: -1.2816, 25: -0.6745, 50: 0, 75: 0.6745, 90: 1.2816 };

  function incomeAtPercentile(p, median, sigma) {
    if (!(p in Z)) throw new Error('Unsupported percentile: ' + p);
    return median * Math.exp(Z[p] * sigma);
  }

  function lognormalPdf(x, median, sigma) {
    if (x <= 0) return 0;
    var z = (Math.log(x) - Math.log(median)) / sigma;
    return Math.exp(-0.5 * z * z) / (x * sigma * Math.sqrt(2 * Math.PI));
  }

  function findBand(age, bands) {
    for (var i = 0; i < bands.length; i++) {
      if (age >= bands[i].min && age <= bands[i].max) return bands[i];
    }
    return null;
  }

  // 100 = exactly at benchmark. Above 100 = ahead. Clamped to 0–200.
  function habitScore(value, benchmark, higherIsBetter) {
    var score;
    if (higherIsBetter) {
      score = value > 0 ? (value / benchmark) * 100 : 0;
    } else {
      score = value > 0 ? (benchmark / value) * 100 : 200;
    }
    return Math.max(0, Math.min(200, score));
  }

  // Parse YYYY-MM-DD as UTC midnight so time zones never shift a day.
  function parseDate(s) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s || '');
    return m ? Date.UTC(+m[1], +m[2] - 1, +m[3]) : NaN;
  }

  function formatDate(ms) {
    return new Date(ms).toISOString().slice(0, 10);
  }

  /*
   * Where a goal is vs where it should be if progress were linear from
   * startDate to deadline.
   * Returns percentages (0–100+) and a status from:
   *   done | ahead | slipping | behind | critical | invalid
   */
  function goalProgress(goal, todayMs) {
    var start = parseDate(goal.startDate);
    var end = parseDate(goal.deadline);
    var from = Number(goal.startValue) || 0;
    var target = Number(goal.target);
    var current = Number(goal.current) || 0;
    var span = target - from;

    if (isNaN(start) || isNaN(end) || end <= start || !span) {
      return { status: 'invalid' };
    }

    var totalDays = (end - start) / DAY_MS;
    var elapsedDays = Math.max(0, Math.min(totalDays, (todayMs - start) / DAY_MS));
    var expectedPct = (elapsedDays / totalDays) * 100;
    var actualPct = ((current - from) / span) * 100;
    var gap = actualPct - expectedPct;
    var daysLeft = Math.round((end - todayMs) / DAY_MS);

    // Project a finish date from the pace so far.
    var projected = null;
    if (actualPct >= 100) {
      projected = todayMs;
    } else if (elapsedDays > 0 && actualPct > 0) {
      var pctPerDay = actualPct / ((todayMs - start) / DAY_MS);
      projected = todayMs + ((100 - actualPct) / pctPerDay) * DAY_MS;
    }

    var status;
    if (actualPct >= 100) status = 'done';
    else if (gap >= 0) status = 'ahead';
    else if (daysLeft < 0 || gap <= -25) status = 'critical';
    else if (gap <= -10) status = 'behind';
    else status = 'slipping';

    return {
      status: status,
      expectedPct: expectedPct,
      actualPct: actualPct,
      gap: gap,
      daysLeft: daysLeft,
      projectedMs: projected,
      lateByDays: projected === null ? null : Math.round((projected - end) / DAY_MS)
    };
  }

  var api = {
    normCdf: normCdf,
    incomePercentile: incomePercentile,
    incomeAtPercentile: incomeAtPercentile,
    lognormalPdf: lognormalPdf,
    findBand: findBand,
    habitScore: habitScore,
    parseDate: parseDate,
    formatDate: formatDate,
    goalProgress: goalProgress,
    DAY_MS: DAY_MS
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FBStats = api;
})(this);
