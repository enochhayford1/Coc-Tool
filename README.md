# Coc-Tool: "You're Falling Behind" dashboard

A blunt, personal dashboard that compares you against real benchmarks:

- **Income vs peers**: your percentile among US full-time workers in your age band, the raise needed to reach the median, and where the top 10% starts. Includes an interactive distribution chart.
- **Productivity vs average**: work hours, focused time, exercise, sleep, social media and reading, each measured against a cited benchmark.
- **Goals vs reality**: for each goal, where you are vs where you should be today if progress were linear, plus a projected finish date at your current pace.

The tone is deliberately blunt. Everything runs in the browser. Your numbers are saved to `localStorage` and never sent anywhere.

## Run it

Open `index.html` in a browser. There's no build step and no dependencies, and it works from `file://` and offline.

To host it, any static host works, e.g. GitHub Pages pointed at the repo root.

## Tests

```sh
node --test tests/stats.test.js
```

## Layout

| File | Purpose |
|---|---|
| `js/benchmarks.js` | Benchmark data with sources. **Edit this to update numbers.** |
| `js/stats.js` | Pure math: percentiles, habit scores, goal pacing (unit-tested) |
| `js/charts.js` | SVG income distribution, diverging habit bars, tooltips |
| `js/app.js` | State, form, blunt copy, rendering |
| `css/styles.css` | Styles with light and dark themes |

## Data sources and caveats

- **Income**: BLS *Usual Weekly Earnings of Wage and Salary Workers*, Q2 2025. These are medians for full-time workers by age band, multiplied by 52. The 16–24 and 45–54 totals are estimated from the published men/women split. Percentiles come from a log-normal model with σ = 0.6, so they're an approximation, not survey microdata.
- **Hours worked**: BLS American Time Use Survey 2024 (8.1h on days worked, full-time).
- **Exercise / sleep**: CDC guidelines (150 min/week, 7+ h/night). These are minimums, not averages.
- **Social media**: DataReportal Digital 2025 global average (about 2h 21m/day).
- **Books**: Pew Research Center 2021 (US median of 5/year).
- **Focused work**: RescueTime vendor estimate (about 2.8h/day). This is the weakest source here.
