(function () {
  'use strict';

  var D = window.FBData;
  var S = window.FBStats;
  var C = window.FBCharts;
  var STORE_KEY = 'falling-behind:v1';

  var STATUS = {
    done:     { label: 'Done',        icon: '✓', color: 'var(--good)' },
    ahead:    { label: 'On pace',     icon: '▲', color: 'var(--good)' },
    slipping: { label: 'Slipping',    icon: '!', color: 'var(--warning)' },
    behind:   { label: 'Behind',      icon: '▼', color: 'var(--serious)' },
    critical: { label: 'Way behind',  icon: '✕', color: 'var(--critical)' },
    invalid:  { label: 'Check dates', icon: '?', color: 'var(--muted)' }
  };

  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function todayMs() {
    var d = new Date();
    return Date.UTC(d.getFullYear(), d.getMonth(), d.getDate());
  }

  function fmtDate(ms) {
    return new Date(ms).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', timeZone: 'UTC' });
  }

  function num(v, digits) {
    var n = Number(v);
    return (Math.round(n * Math.pow(10, digits || 0)) / Math.pow(10, digits || 0)).toLocaleString('en-US');
  }

  /* ---------- State ---------- */

  function sampleState() {
    var y = new Date().getFullYear();
    return {
      age: 29,
      income: 52000,
      habits: { workHours: 8.5, deepWork: 1.5, exercise: 60, sleep: 6, socialMedia: 190, books: 6 },
      goals: [
        { name: 'Emergency fund ($)', startValue: 0, target: 10000, current: 7000, startDate: y + '-01-01', deadline: y + '-12-31' },
        { name: 'Books read', startValue: 0, target: 12, current: 2, startDate: y + '-01-01', deadline: y + '-12-31' },
        { name: 'Body weight (kg)', startValue: 88, target: 80, current: 83, startDate: y + '-01-01', deadline: y + '-12-31' },
        { name: 'Side project revenue ($/mo)', startValue: 0, target: 1000, current: 0, startDate: y + '-03-01', deadline: y + '-12-31' }
      ]
    };
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (raw) return JSON.parse(raw);
    } catch (e) { /* storage unavailable: fall through to sample */ }
    return sampleState();
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* ignore */ }
  }

  var state = load();

  /* ---------- Analysis ---------- */

  function analyze() {
    var today = todayMs();
    var band = S.findBand(Number(state.age), D.INCOME.bands);
    var income = null;
    if (band && state.income > 0) {
      var annualMedian = band.weeklyMedian * 52;
      income = {
        band: band,
        annualMedian: annualMedian,
        percentile: S.incomePercentile(Number(state.income), band.weeklyMedian * 52, D.INCOME.sigma),
        p75: S.incomeAtPercentile(75, annualMedian, D.INCOME.sigma),
        p90: S.incomeAtPercentile(90, annualMedian, D.INCOME.sigma)
      };
    }

    var habits = D.HABITS.filter(function (h) {
      var v = state.habits[h.id];
      return v !== '' && v != null && !isNaN(Number(v));
    }).map(function (h) {
      var v = Number(state.habits[h.id]);
      return Object.assign({}, h, { value: v, score: S.habitScore(v, h.benchmark, h.higherIsBetter) });
    });

    var goals = state.goals.map(function (g) {
      return Object.assign({ goal: g }, S.goalProgress(g, today));
    });

    return { income: income, habits: habits, goals: goals, today: today };
  }

  /* ---------- Copy (blunt by design) ---------- */

  function habitRoast(h) {
    var v = h.value, b = h.benchmark;
    if (h.score >= 100) return '';
    switch (h.id) {
      case 'workHours': return 'The average full-timer logs ' + b + 'h a day. You log ' + v + 'h.';
      case 'deepWork': return v + 'h of real focus a day — ' + Math.round(h.score) + '% of what a typical desk worker manages.';
      case 'exercise': return v + ' min a week. The CDC\'s 150 is the floor, not the goal.';
      case 'sleep': return 'You\'re ' + num(b - v, 2) + 'h short every night. That\'s ' + Math.round((b - v) * 365) + ' hours of sleep debt a year.';
      case 'socialMedia': return num(v / b, 1) + '× the global average. That\'s ' + Math.round(v * 365 / 60) + ' hours a year of scrolling.';
      case 'books': return v + ' book' + (v === 1 ? '' : 's') + ' a year. The median American reads ' + b + '.';
    }
    return '';
  }

  function goalRoast(r) {
    var g = r.goal;
    switch (r.status) {
      case 'invalid': return 'Fix the dates or target — this goal can\'t be measured yet.';
      case 'done': return 'Done. Nobody\'s clapping. Set the next one.';
      case 'ahead':
        return r.projectedMs ? 'Ahead of pace — projected to finish ' + fmtDate(r.projectedMs) + '. Don\'t coast.' : 'Ahead of pace. Don\'t coast.';
    }
    if (r.daysLeft < 0) {
      return 'Deadline passed ' + Math.abs(r.daysLeft) + ' days ago. You\'re at ' + Math.round(Math.max(0, r.actualPct)) + '%.';
    }
    if (r.projectedMs === null) {
      return 'Zero progress in ' + Math.round(r.expectedPct) + '% of the time you gave yourself. At this pace: never.';
    }
    var yrs = r.lateByDays / 365;
    var late = yrs >= 1.5 ? num(yrs, 1) + ' years' : r.lateByDays + ' days';
    return 'At this pace you finish ' + fmtDate(r.projectedMs) + ' — ' + late + ' after your deadline of ' + fmtDate(S.parseDate(g.deadline)) + '.';
  }

  /* ---------- Render ---------- */

  function renderHero(a) {
    var behind = 0, total = 0, lines = [];

    if (a.income) {
      total++;
      if (a.income.percentile < 50) {
        behind++;
        lines.push({ sev: 50 - a.income.percentile, text: Math.round(100 - a.income.percentile) + '% of full-time workers aged ' + a.income.band.label + ' out-earn you.' });
      }
    }
    a.habits.forEach(function (h) {
      total++;
      if (h.score < 100) { behind++; lines.push({ sev: 100 - h.score, text: habitRoast(h) }); }
    });
    a.goals.forEach(function (r) {
      if (r.status === 'invalid') return;
      total++;
      if (r.status === 'slipping' || r.status === 'behind' || r.status === 'critical') {
        behind++;
        lines.push({ sev: -r.gap, text: '“' + esc(r.goal.name) + '”: ' + goalRoast(r) });
      }
    });

    var ratio = total ? behind / total : 0;
    var headline = ratio >= 0.75 ? 'You\'re falling behind. Badly.'
      : ratio >= 0.5 ? 'You\'re falling behind.'
      : ratio >= 0.25 ? 'You\'re losing ground.'
      : total ? 'You\'re ahead. For now.' : 'Add your numbers to see where you stand.';

    lines.sort(function (x, y) { return y.sev - x.sev; });
    var sub = lines.slice(0, 3).map(function (l) { return '<li>' + l.text + '</li>'; }).join('');
    if (!sub && total) sub = '<li>Every benchmark cleared. Everyone else is still moving, though.</li>';

    document.getElementById('hero').innerHTML =
      '<div class="kicker">Reality check · ' + fmtDate(a.today) + '</div>' +
      '<h1>' + headline + '</h1>' +
      (total ? '<div class="hero-figure"><span class="num">' + behind + '</span><span class="of">of ' + total + ' comparisons you\'re losing</span></div>' : '') +
      (sub ? '<ul class="sub">' + sub + '</ul>' : '');
  }

  function renderIncome(a) {
    var box = document.getElementById('income-body');
    if (!a.income) {
      box.innerHTML = '<p class="empty">Enter an age of 16+ and an annual income to compare against your peers.</p>';
      return;
    }
    var inc = a.income, you = Number(state.income);
    var p = inc.percentile;
    var gap = inc.annualMedian - you;
    var verdict = p < 50
      ? Math.round(100 - p) + '% of your peers out-earn you.'
      : 'You out-earn ' + Math.round(p) + '% of peers. ' + Math.round(100 - p) + '% still out-earn you.';

    var tiles = [
      { label: 'Your percentile', value: ordinal(Math.round(p)), delta: 'aged ' + inc.band.label, cls: '' },
      { label: 'Peer median', value: C.money(inc.annualMedian) + '/yr', delta: inc.band.estimated ? 'estimated' : 'BLS Q2 2025', cls: '' },
      gap > 0
        ? { label: 'Raise to reach median', value: '+' + C.money(gap), delta: '+' + Math.round((gap / you) * 100) + '% just to be average', cls: 'bad' }
        : { label: 'Above median by', value: C.money(-gap), delta: 'top 25% starts at ' + C.money(inc.p75), cls: 'good' },
      { label: 'Top 10% starts at', value: C.money(inc.p90), delta: C.money(Math.max(0, inc.p90 - you)) + ' away', cls: '' }
    ];

    box.innerHTML = '<p class="verdict">' + verdict + '</p>' +
      '<div class="tiles">' + tiles.map(function (t) {
        return '<div class="tile"><div class="label">' + t.label + '</div><div class="value">' + t.value + '</div><div class="delta ' + t.cls + '">' + t.delta + '</div></div>';
      }).join('') + '</div>' +
      '<div class="chart" id="income-chart"></div>' +
      '<p class="note">Compared with US full-time wage &amp; salary workers. Medians from <a href="' + D.INCOME.sourceUrl + '" target="_blank" rel="noopener">' + D.INCOME.source + '</a>' +
      (inc.band.estimated ? ' (this age band estimated from the published men/women split)' : '') +
      '. Percentiles assume a log-normal spread (σ = ' + D.INCOME.sigma + ').</p>';

    C.incomeDensity(document.getElementById('income-chart'), {
      weeklyMedian: inc.band.weeklyMedian, sigma: D.INCOME.sigma, income: you,
      bandLabel: inc.band.label, percentile: p
    });
  }

  function ordinal(n) {
    var s = ['th', 'st', 'nd', 'rd'], v = n % 100;
    return n + (s[(v - 20) % 10] || s[v] || s[0]);
  }

  function fmtHabit(v, h) {
    return num(v, 2) + (h.unit === 'h' ? 'h' : ' ' + h.unit);
  }

  function renderHabits(a) {
    var box = document.getElementById('habits-body');
    if (!a.habits.length) {
      box.innerHTML = '<p class="empty">Fill in your habits to compare them with the average.</p>';
      return;
    }
    var behind = a.habits.filter(function (h) { return h.score < 100; }).length;
    var verdict = behind === 0 ? 'Above average on everything you entered.'
      : 'Below the benchmark on ' + behind + ' of ' + a.habits.length + ' habits.';
    box.innerHTML = '<p class="verdict">' + verdict + '</p><div id="habit-chart"></div>' +
      '<p class="note">Bars show how far you are from each benchmark (capped at ±100%). For “social media”, less is better, so using more counts as behind. Hover or focus a row for its source.</p>';
    C.divergingRows(document.getElementById('habit-chart'), a.habits.map(function (h) {
      return {
        label: h.label, score: h.score,
        valueText: fmtHabit(h.value, h), benchmarkText: fmtHabit(h.benchmark, h),
        benchmarkLabel: h.benchmarkLabel, source: h.source, roast: habitRoast(h)
      };
    }));
  }

  function renderGoals(a) {
    var box = document.getElementById('goals-body');
    if (!a.goals.length) {
      box.innerHTML = '<p class="empty">No goals yet. Add one in “Your numbers” — or keep telling yourself you\'ll start Monday.</p>';
      return;
    }
    var bad = a.goals.filter(function (r) { return r.status === 'slipping' || r.status === 'behind' || r.status === 'critical'; }).length;
    var verdict = bad ? bad + ' of ' + a.goals.length + ' goals are behind schedule.' : 'Every goal is on pace. Suspicious.';

    box.innerHTML = '<p class="verdict">' + verdict + '</p>' + a.goals.map(function (r) {
      var st = STATUS[r.status];
      var g = r.goal;
      var head = '<div class="goal-head"><span class="goal-name">' + esc(g.name || 'Untitled goal') + '</span>' +
        '<span class="pill"><span class="dot" style="background:' + st.color + '"></span><span aria-hidden="true">' + st.icon + '</span>' + st.label + '</span></div>';
      if (r.status === 'invalid') return '<div class="goal">' + head + '<p class="goal-roast">' + goalRoast(r) + '</p></div>';

      var actual = Math.max(0, Math.min(100, r.actualPct));
      var expected = Math.max(0, Math.min(100, r.expectedPct));
      var tip = '<strong>' + esc(g.name) + '</strong><br>Now: ' + esc(g.current) + ' (' + Math.round(r.actualPct) + '%)<br>Should be: ' +
        Math.round(r.expectedPct) + '% by today<br>Target: ' + esc(g.target) + ' by ' + fmtDate(S.parseDate(g.deadline));
      return '<div class="goal">' + head +
        '<div class="meter" tabindex="0" data-tip="' + tip.replace(/"/g, '&quot;') + '" aria-label="' + esc(g.name) + ': ' + Math.round(r.actualPct) + '% done, should be ' + Math.round(r.expectedPct) + '%">' +
          (actual > 0 ? '<div class="fill' + (actual >= 100 ? ' full' : '') + '" style="width:' + actual + '%;background:' + st.color + '"></div>' : '') +
          '<div class="expected" style="left:calc(' + expected + '% - 1px)"><span>should be here</span></div>' +
        '</div>' +
        '<div class="goal-meta"><span>' + Math.round(r.actualPct) + '% done · should be ' + Math.round(r.expectedPct) + '%</span>' +
        '<span>' + (r.daysLeft >= 0 ? r.daysLeft + ' days left' : 'overdue') + '</span></div>' +
        '<p class="goal-roast">' + goalRoast(r) + '</p></div>';
    }).join('');
    C.bindTips(box);
  }

  function render() {
    C.hideTip();
    var a = analyze();
    renderHero(a);
    renderIncome(a);
    renderHabits(a);
    renderGoals(a);
  }

  /* ---------- Form ---------- */

  function buildForm() {
    document.getElementById('f-age').value = state.age;
    document.getElementById('f-income').value = state.income;

    document.getElementById('habit-fields').innerHTML = D.HABITS.map(function (h) {
      var v = state.habits[h.id];
      return '<label class="f">' + h.label + ' (' + h.unit + ')' +
        '<input type="number" min="0" step="' + h.step + '" data-habit="' + h.id + '" value="' + (v == null ? '' : esc(v)) + '"></label>';
    }).join('');

    renderGoalEditors();
  }

  function renderGoalEditors() {
    var fields = [
      ['name', 'Goal', 'text'], ['startValue', 'Start', 'number'], ['current', 'Now', 'number'],
      ['target', 'Target', 'number'], ['startDate', 'Started', 'date'], ['deadline', 'Deadline', 'date']
    ];
    document.getElementById('goal-fields').innerHTML = state.goals.map(function (g, i) {
      return '<div class="goal-edit">' + fields.map(function (f) {
        return '<label class="f">' + f[1] + '<input type="' + f[2] + '"' + (f[2] === 'number' ? ' step="any"' : '') +
          ' data-goal="' + i + '" data-key="' + f[0] + '" value="' + esc(g[f[0]]) + '"></label>';
      }).join('') + '<button type="button" class="ghost" data-remove="' + i + '" aria-label="Remove goal ' + esc(g.name) + '">Remove</button></div>';
    }).join('') || '<p class="empty">No goals.</p>';
  }

  var timer;
  function scheduleRender() {
    clearTimeout(timer);
    timer = setTimeout(function () { save(); render(); }, 150);
  }

  function wireForm() {
    var form = document.getElementById('setup-form');
    form.addEventListener('input', function (e) {
      var t = e.target;
      if (t.id === 'f-age') state.age = t.value === '' ? '' : Number(t.value);
      else if (t.id === 'f-income') state.income = t.value === '' ? '' : Number(t.value);
      else if (t.dataset.habit) state.habits[t.dataset.habit] = t.value === '' ? '' : Number(t.value);
      else if (t.dataset.goal) {
        var g = state.goals[+t.dataset.goal];
        g[t.dataset.key] = t.type === 'number' ? (t.value === '' ? '' : Number(t.value)) : t.value;
      }
      scheduleRender();
    });
    form.addEventListener('click', function (e) {
      var rm = e.target.closest('[data-remove]');
      if (rm) {
        state.goals.splice(+rm.dataset.remove, 1);
        renderGoalEditors(); scheduleRender();
      }
    });
    form.addEventListener('submit', function (e) { e.preventDefault(); });

    document.getElementById('add-goal').addEventListener('click', function () {
      var y = new Date().getFullYear();
      state.goals.push({ name: '', startValue: 0, target: 100, current: 0, startDate: S.formatDate(todayMs()), deadline: y + '-12-31' });
      renderGoalEditors();
      var inputs = document.querySelectorAll('#goal-fields input[data-key="name"]');
      if (inputs.length) inputs[inputs.length - 1].focus();
      scheduleRender();
    });
    document.getElementById('load-sample').addEventListener('click', function () {
      state = sampleState(); buildForm(); save(); render();
    });
    document.getElementById('clear-all').addEventListener('click', function () {
      state = { age: '', income: '', habits: {}, goals: [] };
      buildForm(); save(); render();
      document.getElementById('setup').open = true;
    });
  }

  /* ---------- Theme ---------- */

  function wireTheme() {
    var btn = document.getElementById('theme');
    var saved = null;
    try { saved = localStorage.getItem('falling-behind:theme'); } catch (e) { /* ignore */ }
    if (saved) document.documentElement.dataset.theme = saved;
    btn.addEventListener('click', function () {
      var cur = document.documentElement.dataset.theme ||
        (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
      var next = cur === 'dark' ? 'light' : 'dark';
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem('falling-behind:theme', next); } catch (e) { /* ignore */ }
    });
  }

  var resizeTimer;
  window.addEventListener('resize', function () {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(render, 120);
  });

  wireTheme();
  buildForm();
  wireForm();
  render();
})();
