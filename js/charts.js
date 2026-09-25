/*
 * Hand-rolled SVG/HTML charts. No libraries, so the page works offline
 * and from file://.
 */
(function (root) {
  'use strict';

  var S = root.FBStats;
  var NS = 'http://www.w3.org/2000/svg';

  function el(tag, attrs, parent) {
    var node = document.createElementNS(NS, tag);
    for (var k in attrs) node.setAttribute(k, attrs[k]);
    if (parent) parent.appendChild(node);
    return node;
  }

  function money(n) {
    if (n >= 1e6) return '$' + (n / 1e6).toFixed(1).replace(/\.0$/, '') + 'M';
    if (n >= 1e4) return '$' + Math.round(n / 1e3) + 'K';
    return '$' + Math.round(n).toLocaleString('en-US');
  }

  /* ---------- Tooltip (shared) ---------- */

  var tip;
  function ensureTip() {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'tip';
      tip.setAttribute('role', 'tooltip');
      document.body.appendChild(tip);
    }
    return tip;
  }
  function showTip(html, x, y) {
    var t = ensureTip();
    t.innerHTML = html;
    t.classList.add('on');
    var w = t.offsetWidth, h = t.offsetHeight;
    var left = Math.min(window.innerWidth - w - 8, Math.max(8, x + 12));
    var top = y - h - 12 < 8 ? y + 16 : y - h - 12;
    t.style.left = left + 'px';
    t.style.top = top + 'px';
  }
  function hideTip() { if (tip) tip.classList.remove('on'); }

  // Any element with data-tip gets hover + keyboard-focus tooltips.
  function bindTips(scope) {
    scope.querySelectorAll('[data-tip]').forEach(function (node) {
      node.addEventListener('mousemove', function (e) { showTip(node.dataset.tip, e.clientX, e.clientY); });
      node.addEventListener('mouseleave', hideTip);
      node.addEventListener('focus', function () {
        var r = node.getBoundingClientRect();
        showTip(node.dataset.tip, r.left + r.width / 2, r.top);
      });
      node.addEventListener('blur', hideTip);
    });
  }

  /* ---------- Income distribution ---------- */

  function incomeDensity(container, opts) {
    var annualMedian = opts.weeklyMedian * 52;
    var sigma = opts.sigma;
    var you = opts.income;

    container.innerHTML = '';
    var width = Math.max(280, container.clientWidth || 600);
    var height = 230;
    var m = { top: 34, right: 16, bottom: 28, left: 16 };
    var iw = width - m.left - m.right;
    var ih = height - m.top - m.bottom;

    var xMax = annualMedian * Math.exp(2.1 * sigma);
    var youClamped = Math.min(you, xMax);
    var x = function (v) { return m.left + (v / xMax) * iw; };

    var N = 160, pts = [], peak = 0;
    for (var i = 1; i <= N; i++) {
      var v = (i / N) * xMax;
      var d = S.lognormalPdf(v, annualMedian, sigma);
      pts.push([v, d]);
      if (d > peak) peak = d;
    }
    var y = function (d) { return m.top + ih - (d / peak) * ih * 0.95; };

    var svg = el('svg', { width: width, height: height, viewBox: '0 0 ' + width + ' ' + height, role: 'img',
      'aria-label': 'Income distribution for full-time workers aged ' + opts.bandLabel + '. You are at the ' + Math.round(opts.percentile) + 'th percentile.' });

    // Ticks along the x axis.
    // Smallest round step that leaves at least 64px between tick labels.
    var step = [10000, 25000, 50000, 100000].filter(function (st) { return (st / xMax) * iw >= 64; })[0] || 100000;
    for (var t = step; t < xMax; t += step) {
      el('line', { class: 'gridline', x1: x(t), x2: x(t), y1: m.top, y2: m.top + ih }, svg);
      var tx = el('text', { x: x(t), y: height - 8, 'text-anchor': 'middle' }, svg);
      tx.textContent = money(t);
    }

    // Area split at you: left of you = peers you beat, right = peers ahead.
    function areaPath(from, to) {
      var seg = pts.filter(function (p) { return p[0] >= from && p[0] <= to; });
      if (!seg.length) return '';
      var dStr = 'M' + x(seg[0][0]) + ',' + (m.top + ih);
      seg.forEach(function (p) { dStr += 'L' + x(p[0]) + ',' + y(p[1]); });
      dStr += 'L' + x(seg[seg.length - 1][0]) + ',' + (m.top + ih) + 'Z';
      return dStr;
    }
    el('path', { d: areaPath(0, youClamped), fill: 'var(--ahead)', 'fill-opacity': 0.12 }, svg);
    el('path', { d: areaPath(youClamped, xMax), fill: 'var(--behind)', 'fill-opacity': 0.14 }, svg);

    var line = 'M' + pts.map(function (p) { return x(p[0]) + ',' + y(p[1]); }).join('L');
    el('path', { d: line, fill: 'none', stroke: 'var(--ink-2)', 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
    el('line', { class: 'baseline', x1: m.left, x2: m.left + iw, y1: m.top + ih, y2: m.top + ih }, svg);

    // Median tick.
    var mx = x(annualMedian);
    el('line', { x1: mx, x2: mx, y1: y(S.lognormalPdf(annualMedian, annualMedian, sigma)), y2: m.top + ih, stroke: 'var(--muted)', 'stroke-width': 1 }, svg);

    // "You" marker.
    var yx = x(youClamped);
    el('line', { x1: yx, x2: yx, y1: m.top - 6, y2: m.top + ih, stroke: 'var(--ink)', 'stroke-width': 2 }, svg);
    el('circle', { cx: yx, cy: m.top - 6, r: 5, fill: 'var(--ink)', stroke: 'var(--surface)', 'stroke-width': 2 }, svg);
    var anchor = yx > width - 90 ? 'end' : yx < 90 ? 'start' : 'middle';
    var yl = el('text', { x: yx, y: m.top - 16, 'text-anchor': anchor, class: 'lbl-strong' }, svg);
    yl.textContent = 'You · ' + money(you) + (you > xMax ? ' →' : '');

    var medAnchor = Math.abs(mx - yx) < 70 ? (mx < yx ? 'end' : 'start') : 'middle';
    if (medAnchor === 'middle') medAnchor = 'start';
    var ml = el('text', { x: mx + (medAnchor === 'end' ? -6 : 6), y: m.top + ih - 8, 'text-anchor': medAnchor }, svg);
    ml.textContent = 'Median ' + money(annualMedian);

    // Crosshair hover.
    var cross = el('line', { x1: 0, x2: 0, y1: m.top, y2: m.top + ih, stroke: 'var(--ink-2)', 'stroke-width': 1, opacity: 0 }, svg);
    var hit = el('rect', { x: m.left, y: 0, width: iw, height: height, fill: 'transparent' }, svg);
    hit.addEventListener('mousemove', function (e) {
      var r = svg.getBoundingClientRect();
      var px = e.clientX - r.left;
      var val = Math.max(0, ((px - m.left) / iw) * xMax);
      var pct = S.incomePercentile(val, annualMedian, sigma);
      cross.setAttribute('x1', px); cross.setAttribute('x2', px); cross.setAttribute('opacity', 1);
      showTip('<strong>' + money(val) + '/yr</strong><br>Beats ' + Math.round(pct) + '% of peers aged ' + opts.bandLabel, e.clientX, e.clientY);
    });
    hit.addEventListener('mouseleave', function () { cross.setAttribute('opacity', 0); hideTip(); });

    container.appendChild(svg);
  }

  /* ---------- Diverging habit bars (index 100 = benchmark) ---------- */

  function divergingRows(container, rows) {
    var html = '<div class="div-legend">' +
      '<span class="key"><span class="swatch" style="background:var(--behind)"></span>Behind benchmark</span>' +
      '<span class="key"><span class="swatch" style="background:var(--ahead)"></span>Ahead of benchmark</span></div>';

    rows.forEach(function (r) {
      var delta = r.score - 100;              // −100 … +100
      var half = Math.min(100, Math.abs(delta)) / 2; // % of full track width
      var cls = delta < 0 ? 'behind' : 'ahead';
      var pctText = (delta >= 0 ? '+' : '−') + Math.round(Math.abs(delta)) + '%';
      var valPos = delta < 0
        ? 'right:calc(50% + ' + half + '% + 6px)'
        : 'left:calc(50% + ' + half + '% + 6px)';
      // Keep the label inside the track when the bar nearly fills its half.
      if (half > 38) valPos = delta < 0 ? 'left:4px' : 'right:4px';
      var tipText = '<strong>' + r.label + '</strong><br>You: ' + r.valueText + '<br>' + r.benchmarkLabel + ': ' + r.benchmarkText +
        '<br><span style="opacity:.75">' + r.source + '</span>';

      html += '<div class="habit-row">' +
        '<div class="habit-label">' + r.label + '<span class="vals">' + r.valueText + ' vs ' + r.benchmarkText + '</span></div>' +
        '<div class="div-track" tabindex="0" data-tip="' + tipText.replace(/"/g, '&quot;') + '" aria-label="' + r.label + ': ' + pctText + ' versus benchmark">' +
          (half > 0.5 ? '<div class="div-bar ' + cls + '" style="width:' + half + '%"></div>' : '') +
          '<span class="div-val" style="' + valPos + '">' + pctText + '</span>' +
        '</div>' +
        (r.roast ? '<div class="roast">' + r.roast + '</div>' : '') +
      '</div>';
    });

    html += '<div class="div-scale"><span></span><div class="ticks"><span>−100%</span><span>benchmark</span><span>+100%</span></div></div>';
    container.innerHTML = html;
    bindTips(container);
  }

  root.FBCharts = {
    incomeDensity: incomeDensity,
    divergingRows: divergingRows,
    bindTips: bindTips,
    hideTip: hideTip,
    money: money
  };
})(this);
