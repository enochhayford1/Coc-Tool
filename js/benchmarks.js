/*
 * Reference data the dashboard compares you against.
 * Every number carries its source. Edit here to update benchmarks.
 */
(function (root) {
  'use strict';

  // BLS Current Population Survey, "Usual Weekly Earnings of Wage and Salary
  // Workers", Q2 2025, median for full-time workers (both sexes).
  // Two bands are marked `estimated`: BLS publishes them split by sex in the
  // summary, and the total here sits between the two published figures.
  var INCOME = {
    source: 'BLS Usual Weekly Earnings, Q2 2025 (full-time wage & salary workers)',
    sourceUrl: 'https://www.bls.gov/news.release/archives/wkyeng_07222025.htm',
    // Spread of the log-normal model used to turn a median into percentiles.
    // 0.6 gives a 90th/10th percentile ratio of about 4.7, close to what BLS
    // reports for full-time weekly earnings deciles.
    sigma: 0.6,
    bands: [
      { label: '16–24', min: 16, max: 24, weeklyMedian: 760, estimated: true },
      { label: '25–34', min: 25, max: 34, weeklyMedian: 1139 },
      { label: '35–44', min: 35, max: 44, weeklyMedian: 1351 },
      { label: '45–54', min: 45, max: 54, weeklyMedian: 1350, estimated: true },
      { label: '55–64', min: 55, max: 64, weeklyMedian: 1296 },
      { label: '65+', min: 65, max: 120, weeklyMedian: 1198 }
    ]
  };

  // `higherIsBetter` decides which side of the benchmark counts as "behind".
  var HABITS = [
    {
      id: 'workHours', label: 'Hours worked per workday', unit: 'h',
      benchmark: 8.1, higherIsBetter: true, step: 0.5,
      benchmarkLabel: 'US full-time average',
      source: 'BLS American Time Use Survey 2024'
    },
    {
      id: 'deepWork', label: 'Focused work per day', unit: 'h',
      benchmark: 2.8, higherIsBetter: true, step: 0.25,
      benchmarkLabel: 'Typical knowledge worker',
      source: 'RescueTime usage data (vendor estimate — treat loosely)'
    },
    {
      id: 'exercise', label: 'Exercise per week', unit: 'min',
      benchmark: 150, higherIsBetter: true, step: 10,
      benchmarkLabel: 'CDC minimum guideline',
      source: 'CDC Physical Activity Guidelines for Adults'
    },
    {
      id: 'sleep', label: 'Sleep per night', unit: 'h',
      benchmark: 7, higherIsBetter: true, step: 0.25,
      benchmarkLabel: 'CDC adult minimum',
      source: 'CDC sleep recommendation (7+ hours)'
    },
    {
      id: 'socialMedia', label: 'Social media per day', unit: 'min',
      benchmark: 141, higherIsBetter: false, step: 5,
      benchmarkLabel: 'Global average',
      source: 'DataReportal Digital 2025 (approx. 2h 21m)'
    },
    {
      id: 'books', label: 'Books read per year', unit: 'books',
      benchmark: 5, higherIsBetter: true, step: 1,
      benchmarkLabel: 'US median',
      source: 'Pew Research Center, 2021'
    }
  ];

  var api = { INCOME: INCOME, HABITS: HABITS };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.FBData = api;
})(this);
