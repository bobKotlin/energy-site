/* =====================================================================
   Calculator page — full connection. The site type fills every tab with
   typical values (any value can be typed in instead); the engine plans the
   day of the site running through the storage; the player shows it as an
   animation, on the price and energy charts and as the running bill.
   ===================================================================== */
(function(){
  'use strict';
  var B = window.BESS, CAT = window.CATALOG, S = window.Site, G = window.gsap, RM = S.RM;
  var $ = function(s){ return document.querySelector(s); }, $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var nf = S.nf, money = S.money, years = S.years, plural = S.plural;
  /* 'YYYY-MM-DD' → «22.08.2026» / «22/08/2026» */
  function dLabel(d){ var p = d.split('-'), s = S.en ? '/' : '.'; return p[2] + s + p[1] + s + p[0]; }
  /* a price with kopecks: «4,32 ₴» / «₴4.32» */
  function hrn(v, dg){ var s = nf(v, dg); return S.en ? '₴' + s : s + ' ₴'; }
  function dec(x){ x = Math.round(x * 100) / 100; return x % 1 === 0 ? 0 : Math.abs(x * 10 - Math.round(x * 10)) < 1e-9 ? 1 : 2; }
  function num(x){ x = Math.round(x * 100) / 100; return nf(x, dec(x)); }

  /* ---- state: URL > saved > defaults ---- */
  function defaults(who){ var o = B.OPTS[who]; return { prof: o.prof, from: 6, to: 12, cons: o.cons.def, capIn: o.cap.def, powIn: o.pow.def, cost: o.cost.def }; }
  var st = Object.assign({ v: 2, who: 'home', tariff: 'three', base: B.HOME_BASE, rte: B.RTE.def, dod: B.DOD.def }, defaults('home'));
  var sv = S.load();
  if (sv && sv.v === 2 && B.OPTS[sv.who]) ['who', 'tariff', 'base', 'prof', 'from', 'to', 'cons', 'capIn', 'powIn', 'cost', 'rte', 'dod'].forEach(function(k){ if (sv[k] != null) st[k] = sv[k]; });
  var q = S.q;
  if (B.OPTS[q.get('who')] && q.get('who') !== st.who) { st.who = q.get('who'); Object.assign(st, defaults(st.who)); }
  if (+q.get('cap') > 0) { st.capIn = +q.get('cap'); st.powIn = +q.get('pow') > 0 ? +q.get('pow') : B.defaultPow(st.who, st.capIn); }

  /* ---- configuration: typed values are rounded up to real blocks ---- */
  var cfg = null, bud = null, data = null, yr = null, inv = 0, pb = Infinity, back = 0, wr = null, levels = [], blockNote = '';
  function it(c, k){ for (var i = 0; i < c.items.length; i++) if (c.items[i].key === k) return c.items[i]; return null; }
  function cfgText(c){
    if (c.kind === 'home') { var m = it(c, 'homeModule').qty, inv1 = it(c, 'hybridInverter'); return m + ' ' + plural(m, ['модуль', 'модулі', 'модулів'], ['module', 'modules']) + ' · ' + S.capTxt(c.cap) + ' · ' + (inv1.qty > 1 ? tx('інвертори ', 'inverters ') + inv1.qty + ' × ' + nf(inv1.kw) + tx(' кВт', ' kW') : tx('інвертор ', 'inverter ') + S.powTxt(c.pow)); }
    if (c.kind === 'cabinet') { var n = it(c, 'cabinet').qty; return n + ' ' + plural(n, ['шафа', 'шафи', 'шаф'], ['cabinet', 'cabinets']) + ' · ' + S.capTxt(c.cap) + ' · ' + S.powTxt(c.pow); }
    var k = it(c, 'container').qty; return k + ' ' + plural(k, ['контейнер', 'контейнери', 'контейнерів'], ['container', 'containers']) + ' · ' + S.capTxt(c.cap) + ' · ' + S.powTxt(c.pow);
  }
  function resolve(){
    cfg = B.configure({ who: st.who, cap: st.capIn, pow: st.powIn });
    st.cap = cfg.cap; st.pow = cfg.pow;
    /* typed values that don't match whole blocks: chips with what we actually count */
    blockNote = Math.abs(cfg.cap - st.capIn) > .05 || Math.abs(cfg.pow - st.powIn) > .05 ? '<span>' + tx('Рахуємо для', 'Calculated for') + '</span><b>' + S.capTxt(cfg.cap) + '</b><b>' + S.powTxt(cfg.pow) + '</b>' : '';
  }

  /* ---- option rows ---- */
  var UNIT = {
    cons: function(w){ return w === 'ind' ? { u: tx('МВт·год/міс', 'MWh/mo'), k: 1000 } : { u: tx('кВт·год/міс', 'kWh/mo'), k: 1 }; },
    capIn: function(w){ return w === 'ind' ? { u: tx('МВт·год', 'MWh'), k: 1000 } : { u: tx('кВт·год', 'kWh'), k: 1 }; },
    powIn: function(w){ return w === 'ind' ? { u: tx('МВт', 'MW'), k: 1000 } : { u: tx('кВт', 'kW'), k: 1 }; },
    base: function(){ return { u: tx('₴/кВт·год', '₴/kWh'), k: 1 }; },
    cost: function(){ return { u: tx('₴/кВт·год', '₴/kWh'), k: 1 }; },
    rte: function(){ return { u: '%', k: .01 }; },
    dod: function(){ return { u: '%', k: .01 }; }
  };
  var ROWS = {
    site: [
      { key: 'cons', label: tx('Споживання', 'Consumption'), list: function(w){ return B.OPTS[w].cons.list; }, min: 1, max: 1e9 },
      { key: 'base', label: tx('Ціна', 'Price'), only: ['home'], list: function(){ return [4.32, 5.5, 7]; }, min: .5, max: 50 },
      { key: 'tariff', label: tx('Тариф', 'Tariff'), only: ['home'], choices: [['two', tx('Двозонний', 'Two-zone'), tx('Ніч 23:00–7:00 ×0,5, день ×1', 'Night 23:00–7:00 ×0.5, day ×1')], ['three', tx('Тризонний', 'Three-zone'), tx('Ніч 23:00–7:00 ×0,4, пік 8–11 і 20–22 ×1,5, решта ×1', 'Night 23:00–7:00 ×0.4, peak 8–11 and 20–22 ×1.5, other hours ×1')]] }
    ],
    sys: [
      { key: 'capIn', label: tx('Ємність', 'Capacity'), list: function(w){ return B.OPTS[w].cap.list; }, min: .5, max: 1e7 },
      { key: 'powIn', label: tx('Потужність', 'Power'), list: function(w){ return B.OPTS[w].pow.list; }, min: .5, max: 1e7 },
      { key: 'rte', label: tx('ККД циклу', 'Round-trip efficiency'), list: function(){ return B.RTE.list; }, min: .5, max: 1 },
      { key: 'dod', label: tx('Глибина розряду', 'Depth of discharge'), list: function(){ return B.DOD.list; }, min: .3, max: 1 },
      { key: 'cost', label: tx('Вартість під ключ', 'Turnkey cost'), list: function(w){ return B.OPTS[w].cost.list; }, min: 500, max: 1e6 }
    ]
  };
  /* ---- option tiles: icon + bold value; a click opens a small menu with the typical values and a field for your own ---- */
  var ICO = {
    cons: '<path d="M13 3 5 13.5h6L10 21l8-10.5h-6z"/>',
    base: '<circle cx="12" cy="12" r="8.5"/><path d="M14.8 9c-.5-.8-1.5-1.2-2.7-1.2-1.6 0-2.6.8-2.6 1.9 0 2.6 5.3 2.1 5.3 4.6 0 1.1-1.1 1.9-2.8 1.9-1.3 0-2.3-.4-2.9-1.2M8.5 11.2h7M8.5 13.2h7"/>',
    tariff: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    capIn: '<rect x="3" y="7" width="16" height="10" rx="2.5"/><path d="M21 10.5v3M6.5 10v4M9.5 10v4M12.5 10v4"/>',
    powIn: '<path d="M4 15a8 8 0 1 1 16 0"/><path d="M12 15l4-5"/><circle cx="12" cy="15" r="1.2"/>',
    rte: '<path d="M19 12a7 7 0 0 1-12 5M5 12a7 7 0 0 1 12-5"/><path d="M17 3.5V7h-3.5M7 20.5V17h3.5"/>',
    dod: '<rect x="3" y="7" width="16" height="10" rx="2.5"/><path d="M21 10.5v3"/><path d="M6.5 10v4" stroke-width="3"/>',
    cost: '<path d="M3.5 12.5 11.5 4.5H19.5v8l-8 8z"/><circle cx="15.5" cy="8.5" r="1.4"/>'
  };
  function ico(k){ return '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + ICO[k] + '</svg>'; }
  var rowEls = {}, pop = null, popKey = null;
  function same(a, b){ return Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-6); }
  function renderRows(){
    closePop(); rowEls = {};
    [['site', $('#optsSite')], ['sys', $('#optsSys')]].forEach(function(pair){
      var host = pair[1]; host.textContent = '';
      ROWS[pair[0]].forEach(function(r){
        if (r.only && r.only.indexOf(st.who) < 0) return;
        var u = UNIT[r.key] ? UNIT[r.key](st.who) : null;
        var b = document.createElement('button'); b.type = 'button'; b.className = 'tile'; b.dataset.key = r.key; b.setAttribute('aria-haspopup', 'dialog'); b.setAttribute('aria-expanded', 'false');
        b.innerHTML = '<span class="tile__ic">' + ico(r.key) + '</span><span class="tile__t"><small></small><b><span class="tile__v"></span> <i class="tile__u"></i></b></span>';
        b.querySelector('small').textContent = r.label; b.querySelector('.tile__u').textContent = u ? u.u : '';
        b.addEventListener('click', function(){ if (popKey === r.key) closePop(); else openPop(r.key); });
        host.appendChild(b); rowEls[r.key] = { r: r, tile: b, val: b.querySelector('.tile__v'), u: u, hint: '' };
      });
    });
  }
  function valTxt(k){ var e = rowEls[k], v = st[k]; if (e.r.choices) { for (var i = 0; i < e.r.choices.length; i++) if (e.r.choices[i][0] === v) return e.r.choices[i][1]; return ''; } return num(v / e.u.k); }
  /* the menu over the panel: the row's typical values, then your own */
  function openPop(k){
    closePop(); var e = rowEls[k], r = e.r, form = $('#form');
    pop = document.createElement('div'); pop.className = 'pop'; pop.setAttribute('role', 'dialog'); pop.setAttribute('aria-label', r.label);
    var h = document.createElement('div'); h.className = 'pop__h'; h.innerHTML = '<span class="tile__ic">' + ico(k) + '</span><b></b><small></small>';
    h.querySelector('b').textContent = r.label; h.querySelector('small').innerHTML = e.hint;
    var list = document.createElement('div'); list.className = 'pop__list' + (r.choices ? ' pop__list--wide' : '');
    var items = r.choices ? r.choices : r.list(st.who).map(function(v){ return [v, num(v / e.u.k)]; });
    items.forEach(function(c){
      var b = document.createElement('button'); b.type = 'button'; b.className = 'pop__o';
      b.setAttribute('aria-pressed', String(typeof c[0] === 'number' ? same(st[k], c[0]) : c[0] === st[k]));
      b.innerHTML = '<b></b><small></small>'; b.querySelector('b').textContent = c[1]; b.querySelector('small').textContent = c[2] || e.u.u;
      b.addEventListener('click', function(){ st[k] = c[0]; closePop(); syncRows(); recompute(); });
      list.appendChild(b);
    });
    pop.append(h, list);
    if (!r.choices) {
      var own = document.createElement('div'); own.className = 'pop__own';
      var inp = document.createElement('input'); inp.className = 'input'; inp.inputMode = 'decimal'; inp.autocomplete = 'off'; inp.placeholder = tx('Своє', 'Custom');
      inp.setAttribute('aria-label', tx('Своє значення, ', 'Custom value, ') + e.u.u);
      if (!items.some(function(c){ return same(st[k], c[0]); })) inp.value = num(st[k] / e.u.k);
      var unit = document.createElement('span'); unit.textContent = e.u.u;
      var ok = document.createElement('button'); ok.type = 'button'; ok.className = 'pop__ok'; ok.textContent = 'OK';
      var apply = function(){
        var raw = inp.value.replace(/\s/g, '');
        /* «5,12» is a decimal comma; on English pages «12,000» groups thousands */
        raw = S.en && /^\d{1,3}(,\d{3})+(\.\d*)?$/.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.');
        var v = parseFloat(raw) * e.u.k;
        if (!raw || !isFinite(v) || v < r.min || v > r.max) { inp.classList.add('is-bad'); inp.focus(); return; }
        st[k] = v; closePop(); syncRows(); recompute();
      };
      inp.addEventListener('input', function(){ inp.classList.remove('is-bad'); });
      inp.addEventListener('keydown', function(ev){ if (ev.key === 'Enter') { ev.preventDefault(); apply(); } });
      ok.addEventListener('click', apply);
      own.append(inp, unit, ok); pop.appendChild(own);
    }
    form.appendChild(pop);
    var fr = form.getBoundingClientRect(), tr = e.tile.getBoundingClientRect();
    pop.style.top = (tr.bottom - fr.top + 8) + 'px';
    popKey = k; e.tile.setAttribute('aria-expanded', 'true');
    var first = pop.querySelector('[aria-pressed="true"]') || pop.querySelector('button'); if (first) first.focus({ preventScroll: true });
  }
  function closePop(){
    if (!pop) return; pop.remove(); pop = null;
    if (rowEls[popKey]) rowEls[popKey].tile.setAttribute('aria-expanded', 'false');
    popKey = null;
  }
  document.addEventListener('pointerdown', function(ev){ if (pop && !pop.contains(ev.target) && !ev.target.closest('.tile')) closePop(); }, { signal: S.page.signal });
  document.addEventListener('keydown', function(ev){ if (ev.key === 'Escape' && pop) { var t = rowEls[popKey].tile; closePop(); t.focus(); } }, { signal: S.page.signal });
  function hh(h){ return (h < 10 ? '0' : '') + h; }
  function hourSel(a, b, label){ var w = document.createElement('div'); w.className = 'select'; var el = document.createElement('select'); el.setAttribute('aria-label', label); for (var h = a; h <= b; h++) { var o = document.createElement('option'); o.value = h; o.textContent = hh(h) + ':00'; el.appendChild(o); } w.appendChild(el); return { wrap: w, el: el }; }
  function syncRows(){
    $$('#segWho button').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.v === st.who)); });
    Object.keys(rowEls).forEach(function(k){ rowEls[k].val.textContent = valTxt(k); });
    syncProfile();
  }
  /* a short hint for each row, shown at the top of its menu */
  function outputs(){
    var o = function(k, s){ if (rowEls[k]) rowEls[k].hint = s; };
    var dayUse = data.ec.use;
    o('cons', '≈ ' + (st.who === 'ind' ? num(dayUse / 1000) + tx(' МВт·год/добу', ' MWh/day') : nf(dayUse, dayUse < 100 ? 1 : 0) + tx(' кВт·год/добу', ' kWh/day')));
    var c = cfg.kind === 'home' ? it(cfg, 'homeModule').qty + ' ' + plural(it(cfg, 'homeModule').qty, ['модуль', 'модулі', 'модулів'], ['module', 'modules']) : cfg.kind === 'cabinet' ? it(cfg, 'cabinet').qty + ' ' + plural(it(cfg, 'cabinet').qty, ['шафа', 'шафи', 'шаф'], ['cabinet', 'cabinets']) : it(cfg, 'container').qty + ' ' + plural(it(cfg, 'container').qty, ['контейнер', 'контейнери', 'контейнерів'], ['container', 'containers']);
    o('capIn', c);
    var inv1 = cfg.kind === 'home' ? it(cfg, 'hybridInverter') : null;
    o('powIn', inv1 && inv1.qty > 1 ? inv1.qty + ' × ' + nf(inv1.kw) + tx(' кВт', ' kW') : '');
    o('cost', '= ' + money(inv));
    o('base', same(st.base, B.HOME_BASE) ? tx('до 31.10.2026', 'until 31/10/2026') : '');
    /* tariff: the zone multipliers as coloured marks (cyan — night, amber — peak) */
    o('tariff', '<i class="zdot zdot--c" aria-hidden="true"></i>×' + nf(st.tariff === 'three' ? .4 : .5, 1) + (st.tariff === 'three' ? '<i class="zdot zdot--p" aria-hidden="true"></i>×' + nf(1.5, 1) : ''));
  }

  /* ---- site type ---- */
  $$('#segWho button').forEach(function(b){ b.addEventListener('click', function(){ if (st.who === b.dataset.v) return; st.who = b.dataset.v; Object.assign(st, defaults(st.who)); renderRows(); syncRows(); recompute(); }); });

  /* ---- consumption profile: next to the charts it shapes (the energy chart shows the shape) ---- */
  var hFrom = $('#hFrom'), hTo = $('#hTo');
  (function(){ for (var h = 0; h <= 24; h++) { if (h < 24) { var o = document.createElement('option'); o.value = h; o.textContent = hh(h) + ':00'; hFrom.appendChild(o); } if (h > 0) { var o2 = document.createElement('option'); o2.value = h; o2.textContent = hh(h) + ':00'; hTo.appendChild(o2); } } })();
  $$('#segProf button').forEach(function(b){ b.addEventListener('click', function(){ st.prof = b.dataset.v; syncProfile(); recompute(); }); });
  $$('#segHours button').forEach(function(b){ b.addEventListener('click', function(){ var p = b.dataset.h.split('-'); st.from = +p[0]; st.to = +p[1]; syncProfile(); recompute(); }); });
  [hFrom, hTo].forEach(function(x){ x.addEventListener('change', function(){ st.from = +hFrom.value; st.to = +hTo.value; if (st.to === st.from) st.to = st.from + 1; syncProfile(); recompute(); }); });
  function syncProfile(){
    $$('#segProf button').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.v === st.prof)); });
    $$('#segHours button').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.h === st.from + '-' + st.to)); });
    hFrom.value = st.from; hTo.value = st.to; $('#profHours').hidden = st.prof !== 'work';
  }

  /* ---- charts (SVG) ---- */
  var NS = 'http://www.w3.org/2000/svg';
  function mk(t, a, p){ var e = document.createElementNS(NS, t); for (var k in a) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function clear(g){ while (g.firstChild) g.removeChild(g.firstChild); }
  var X0 = 40, X1 = 590, XW = (X1 - X0) / 24;
  function X(h){ return X0 + h * XW; }
  function txt(p, x, y, s, anchor){ var t = mk('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-family': 'JetBrains Mono, monospace', 'font-size': 11, fill: '#93A09A' }, p); t.textContent = s; return t; }
  function xAxis(svg, y){ var g = mk('g', {}, svg); [0, 6, 12, 18, 24].forEach(function(h){ txt(g, X(h), y, (h < 10 ? '0' : '') + h + ':00', h === 0 ? 'start' : h === 24 ? 'end' : 'middle'); }); }
  function nice(v){ var e = Math.pow(10, Math.floor(Math.log10(Math.max(v, 1e-9)))), s = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]; for (var i = 0; i < s.length; i++) if (s[i] * e >= v * 1.06) return s[i] * e; return 10 * e; }
  function tick(v){ return nf(v, v % 1 ? (Math.abs(v * 10 % 1) > 1e-9 ? 2 : 1) : 0); }
  /* price: a column per hour, coloured by what happens in it — charging, from the
     storage, grid only; hours ahead dimmed, the cheapest and the dearest hour carry
     their price. States: no prices, storage idle (gap below the wear threshold),
     live market prices loading / unavailable (business only). */
  var svP = $('#svP'), PY0 = 12, PY1 = 176, BW = Math.min(15, XW * .66);
  var view = { p: [], yMax: 10 };
  function yP(v){ return PY1 - v / view.yMax * (PY1 - PY0); }
  function act(h){ return data.sch.chg[h] > 1e-6 ? 'c' : data.sch.dis[h] > 1e-6 ? 'd' : ''; }
  var ACT = { c: '#1A99AE', d: '#80A430', '': '#56645D' };
  function setX(el, x){ el.setAttribute('x1', x); el.setAttribute('x2', x); }
  /* the columns are drawn once and shown twice: a dim copy for the whole day and a
     lit one that the cursor uncovers as it sweeps — hours light up as they pass */
  var gPg = mk('g', {}, svP), pBars = [];
  mk('use', { href: '#pBarsG', opacity: .3 }, svP);
  var pCp = mk('clipPath', { id: 'cpPb' }, svP), pCpr = mk('rect', { x: 0, y: 0, width: 0, height: 200 }, pCp);
  var pBarG = mk('g', { id: 'pBarsG' }, mk('g', { 'clip-path': 'url(#cpPb)' }, svP));
  for (var i = 0; i < 24; i++) pBars.push(mk('path', { 'stroke-width': 1.5 }, pBarG));
  var gPx = mk('g', {}, svP);
  mk('line', { x1: X0, x2: X1, y1: PY1, y2: PY1, stroke: '#2B3631', 'stroke-width': 1 }, svP);
  xAxis(svP, PY1 + 19);
  var pGlow = mk('line', { y1: PY0 - 4, y2: PY1, stroke: 'rgba(234,240,236,.07)', 'stroke-width': 8, 'stroke-linecap': 'round' }, svP);
  var pCur = mk('line', { y1: PY0 - 4, y2: PY1, stroke: 'rgba(234,240,236,.35)', 'stroke-width': 1 }, svP);
  var pHalo = mk('circle', { r: 10, fill: 'rgba(234,240,236,.16)', 'class': 'pdot-halo' }, svP);
  var pDot = mk('circle', { r: 5, fill: '#EAF0EC', stroke: '#0B0E0D', 'stroke-width': 2 }, svP);
  var pMsg = $('#pMsg'), pLive = $('#pLive'), pFocus = -1;
  function pricesOk(pr){ return !!pr && pr.length === 24 && pr.every(function(v){ return typeof v === 'number' && isFinite(v) && v >= 0; }); }
  function drawBands(){
    var ok = pricesOk(data.pr), idle = ok && !data.pr.some(function(v, h){ return act(h); });
    pBars.forEach(function(b, h){ b.setAttribute('fill', ok ? ACT[act(h)] : 'none'); });
    pMsg.hidden = ok && !idle;
    pMsg.textContent = !ok ? tx('Немає цін на цю добу', 'No prices for this day') : idle ? tx('Без циклів: різниця цін < ', 'No cycles: price gap < ') + hrn(B.MIN_SPREAD, 1) : '';
    svP.classList.toggle('is-empty', !ok);
  }
  function drawPrice(){
    clear(gPg); clear(gPx);
    for (var k = 0; k <= 4; k++) { var v = view.yMax * k / 4, y = yP(v); if (k) mk('line', { x1: X0, x2: X1, y1: y, y2: y, stroke: '#1B2420', 'stroke-width': 1 }, gPg); txt(gPg, X0 - 8, y + 4, tick(v), 'end'); }
    if (!pricesOk(view.p)) { pBars.forEach(function(b){ b.setAttribute('d', ''); }); return; }
    pBars.forEach(function(b, h){ b.setAttribute('d', seg(X(h) + (XW - BW) / 2, BW, PY1, yP(view.p[h]), true)); });
    /* the cheapest and the dearest hour, priced above their columns */
    var lo = 0, hi = 0; view.p.forEach(function(v, h){ if (v < view.p[lo]) lo = h; if (v > view.p[hi]) hi = h; });
    if (view.p[hi] - view.p[lo] > .005) [lo, hi].forEach(function(h){ var t = txt(gPx, Math.max(X0 + 14, Math.min(X1 - 14, X(h) + XW / 2)), yP(view.p[h]) - 7, nf(view.p[h], 2)); t.setAttribute('font-size', 10); t.setAttribute('fill', h === hi ? '#EAF0EC' : '#93A09A'); });
  }
  /* the dot rides the column tops and glides to the next one over the last fifth of the hour */
  function dotY(T){ var h = Math.min(23, Math.floor(T)), f = T - h, y = yP(view.p[h]); if (h < 23 && f > .8) { var k = (f - .8) / .2; y += (yP(view.p[h + 1]) - y) * k * k * (3 - 2 * k); } return y; }
  function cursorPrice(T){
    var x = X(Math.min(24, T)), y = dotY(T); setX(pCur, x); setX(pGlow, x); pCpr.setAttribute('width', x);
    pDot.setAttribute('cx', x); pDot.setAttribute('cy', y); pHalo.setAttribute('cx', x); pHalo.setAttribute('cy', y);
    pBars.forEach(function(b, k){ b.setAttribute('stroke', k === pFocus ? '#EAF0EC' : 'none'); });
  }
  /* live market prices for a business site: a tag while loading, another if they could not be fetched */
  var liveSt = '';
  function liveTag(s){ liveSt = s; pLive.hidden = !s || st.who === 'home'; pLive.classList.toggle('is-load', s === 'load'); pLive.textContent = s === 'load' ? tx('оновлення', 'updating') : s === 'off' ? tx('офлайн', 'offline') : ''; pLive.title = s === 'off' ? tx('Онлайн-ціни РДН недоступні — показано збережені', 'Live DAM prices unavailable — showing the saved ones') : ''; }
  function tweenPrice(){
    var toP = data.pr.slice(), toMax = pricesOk(toP) ? nice(Math.max.apply(null, toP)) : view.yMax;
    if (!pricesOk(toP)) { view.p = toP; drawPrice(); return; }
    if (!view.p.length || !G || RM) { view.p = toP; view.yMax = toMax; drawPrice(); return; }
    var o = { t: 0 }, fp = view.p.slice(), fm = view.yMax;
    G.to(o, { t: 1, duration: .75, ease: 'power3.inOut', overwrite: true, onUpdate: function(){ view.p = fp.map(function(v, i){ return v + (toP[i] - v) * o.t; }); view.yMax = fm + (toMax - fm) * o.t; drawPrice(); } });
  }
  /* energy: upper band — what the site uses each hour (from the grid / from
     the storage), lower band — what goes into the storage. Separate scales so
     a big charging hour doesn't squash the load; all 24 hours always drawn,
     hours still ahead stay dim until the cursor sweeps over them. */
  var svE = $('#svE'), EY0 = 12, EY1 = 128, CY0 = 146, CY1 = 176, gEa = mk('g', {}, svE);
  mk('use', { href: '#eBarsG', opacity: .3 }, svE);
  var eCp = mk('clipPath', { id: 'cpEb' }, svE), eCpr = mk('rect', { x: 0, y: 0, width: 0, height: 200 }, eCp);
  var gE = mk('g', { id: 'eBarsG' }, mk('g', { 'clip-path': 'url(#cpEb)' }, svE));
  mk('line', { x1: X0, x2: X1, y1: EY1, y2: EY1, stroke: '#2B3631', 'stroke-width': 1 }, svE); xAxis(svE, CY1 + 19);
  var eCur = mk('line', { y1: EY0 - 4, y2: CY1, stroke: 'rgba(234,240,236,.35)', 'stroke-width': 1 }, svE);
  var eb = []; for (var i = 0; i < 24; i++) eb.push({ g: mk('path', { fill: '#56645D' }, gE), b: mk('path', { fill: '#80A430' }, gE), c: mk('path', { fill: '#1A99AE' }, gE) });
  var en = { max: 1, cmax: 1, k: 1 };
  function yE(v){ return EY1 - v / en.max * (EY1 - EY0); }
  function yC(v){ return CY0 + v / en.cmax * (CY1 - CY0); }
  function energyScale(){
    en.k = st.who === 'ind' ? 1000 : 1; $('#unitE').textContent = st.who === 'ind' ? tx('МВт·год', 'MWh') : tx('кВт·год', 'kWh');
    var m = 0, c = 0; for (var h = 0; h < 24; h++) { m = Math.max(m, data.ec.load[h]); c = Math.max(c, data.ec.toBat[h]); }
    en.max = nice(m / en.k) * en.k; en.cmax = c > 0 ? nice(c / en.k) * en.k : 1; clear(gEa);
    for (var k = 0; k <= 2; k++) { var v = en.max * k / 2, y = yE(v); if (k) mk('line', { x1: X0, x2: X1, y1: y, y2: y, stroke: '#1B2420', 'stroke-width': 1 }, gEa); txt(gEa, X0 - 8, y + 4, tick(v / en.k), 'end'); }
    if (c > 0) { txt(gEa, X0 - 8, CY1 + 4, tick(en.cmax / en.k), 'end'); var lb = txt(gEa, X0 + 4, CY0 - 4, tx('заряд', 'charging'), 'start'); lb.setAttribute('fill', '#1A99AE'); lb.setAttribute('font-size', 10); }
  }
  function seg(x, w, yb, yt, round){ var h = yb - yt; if (h < .4) return ''; var r = round ? Math.min(3, h, w / 2) : 0; return 'M' + x + ' ' + yb + 'V' + (yt + r) + (r ? 'Q' + x + ' ' + yt + ' ' + (x + r) + ' ' + yt + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + yt + ' ' + (x + w) + ' ' + (yt + r) : 'H' + (x + w)) + 'V' + yb + 'Z'; }
  function segDown(x, w, yt, yb){ var h = yb - yt; if (h < .4) return ''; var r = Math.min(3, h, w / 2); return 'M' + x + ' ' + yt + 'V' + (yb - r) + 'Q' + x + ' ' + yb + ' ' + (x + r) + ' ' + yb + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + yb + ' ' + (x + w) + ' ' + (yb - r) + 'V' + yt + 'Z'; }
  function drawEnergy(T){
    var bw = Math.min(15, XW * .66), e = data.ec;
    for (var h = 0; h < 24; h++) {
      var x = X(h) + (XW - bw) / 2, g = e.fromGrid[h], b = e.fromBat[h], c = e.toBat[h], y1 = yE(g), y2 = yE(g + b);
      eb[h].g.setAttribute('d', seg(x, bw, EY1, y1, !b)); eb[h].b.setAttribute('d', seg(x, bw, y1, y2, true)); eb[h].c.setAttribute('d', segDown(x, bw, CY0, yC(c)));
    }
  }

  /* ---- the animation ---- */
  var vizEl = $('#dayviz'), viz = window.DayFlow.create(vizEl);
  viz.onHover = function(key){ $$('#costs tbody tr').forEach(function(tr){ tr.classList.toggle('is-hot', !!key && tr.dataset.key === key); }); };
  viz.onSeek = function(h){ T = h + .01; phase = 'day'; showCard(false); lastMode = ''; render(T); if (!playing) { playing = true; setPlayUI(); } start(); };

  /* ---- cost table ---- */
  var SUMMARY = {
    homeModule: function(x){ return x.qty + tx(' × 5,12 кВт·год · LiFePO₄', ' × 5.12 kWh · LiFePO₄'); },
    hybridInverter: function(x){ return (x.qty > 1 ? x.qty + ' × ' : '') + nf(x.kw) + tx(' кВт · перемикання на резерв', ' kW · switches to backup'); },
    cabinet: function(x){ return x.qty + tx(' × 215 кВт·год · 100 кВт у кожній', ' × 215 kWh · 100 kW each'); },
    container: function(x){ return x.qty + tx(' × 2,5 МВт·год · 20-футовий', ' × 2.5 MWh · 20-foot'); },
    pcs: function(x){ return x.qty + tx(' × 1 250 кВт · EN 50549', ' × 1,250 kW · EN 50549'); },
    transformer: function(x){ return (x.qty > 1 ? x.qty + ' × ' : '') + nf(x.kva) + tx(' кВА · 0,4 / 10 кВ', ' kVA · 0.4 / 10 kV'); },
    ems: function(){ return tx('розклад заряду, телеметрія IEC 60870-5-104', 'charge schedule, IEC 60870-5-104 telemetry'); },
    switchboard: function(x){ return x.mv ? tx('КРП 10 кВ · АВР', '10 kV switchgear · ATS') : tx('0,4 кВ · АВР, захист від зворотного живлення', '0.4 kV · ATS, reverse-power protection'); },
    meter: function(){ return tx('двонаправлений, погодинний', 'bidirectional, hourly'); },
    install: function(){ return tx('доставка, монтаж, пусконалагодження', 'delivery, installation, commissioning'); },
    design: function(){ return tx('проєкт, ТУ, сертифікація, введення в експлуатацію', 'design, connection terms, certification, commissioning'); }
  };
  var costs = $('#costs');
  function buildCosts(){
    if (!costs) return;
    var tb = costs.tBodies[0], tf = costs.tFoot; tb.textContent = ''; tf.textContent = '';
    var mx = Math.max.apply(null, bud.lines.map(function(l){ return l.share; }));
    bud.lines.forEach(function(l){
      var tr = document.createElement('tr'), c = CAT.C[l.key];
      if (l.item) tr.dataset.key = l.key;
      var a = document.createElement('td'); a.className = 'nm'; var b = document.createElement('b'); b.textContent = c.name; var sm = document.createElement('small'); sm.textContent = SUMMARY[l.key](l.item || {}); a.append(b, sm);
      var s = document.createElement('td'); s.className = 'hide-sm'; var bar = document.createElement('div'); bar.className = 'bar'; var bi = document.createElement('i'); bi.style.width = (l.share / mx * 100).toFixed(1) + '%'; bar.appendChild(bi); var pc = document.createElement('span'); pc.className = 'pct'; pc.textContent = Math.round(l.share * 100) + ' %'; s.append(bar, pc);
      var n = document.createElement('td'); n.className = 'n'; n.textContent = money(l.amount);
      tr.append(a, s, n); tb.appendChild(tr);
    });
    var fr = document.createElement('tr'), f1 = document.createElement('td'); f1.textContent = tx('Разом під ключ', 'Total, turnkey'); var f2 = document.createElement('td'); f2.className = 'hide-sm'; var f3 = document.createElement('td'); f3.className = 'n'; f3.textContent = money(bud.total);
    fr.append(f1, f2, f3); tf.appendChild(fr);
  }
  if (costs) costs.addEventListener('pointerover', function(e){ var tr = e.target.closest('tr[data-key]'); viz.highlight(tr ? tr.dataset.key : null); });
  if (costs) costs.addEventListener('pointerleave', function(){ viz.highlight(null); });
  if (costs) costs.addEventListener('click', function(e){ var tr = e.target.closest('tr[data-key]'); if (!tr) return; S.scrollToEl(vizEl); setTimeout(function(){ viz.highlight(tr.dataset.key); }, 500); });

  /* ---- player: the day in ~20 s, hours with the storage at work a bit slower ---- */
  var cH = $('#cH'), cM = $('#cM'), stEl = $('#status'), stTxt = $('#stTxt');
  var lgA = $('#lgA'), lgB = $('#lgB'), lgN = $('#lgN'), lgNt = $('#lgNt'), lgAhead = null, card = $('#daycard');
  var ACTIVE = .95, IDLE = .55, HOLD = 3.6, T = 0, phase = 'day', endAt = 0, playing = !RM, visible = true, raf = 0, last = 0, lastMode = '', lastHour = -1;
  function socAt(T){ var i = Math.min(23, Math.floor(T)), k = T >= 24 ? 1 : T - Math.floor(T); return data.sch.soc[i] + (data.sch.soc[i + 1] - data.sch.soc[i]) * k; }
  function cum(arr, T){ var s = 0; for (var h = 0; h < 24; h++) { if (T >= h + 1) s += arr[h]; else if (T > h) s += arr[h] * (T - h); } return s; }
  /* the status pill names the price level of the hour; what the storage does is shown on the scene */
  var WORD = { cheap: tx('Дешева година', 'Cheap hour'), mid: tx('Звичайна ціна', 'Normal price'), peak: tx('Дорога година', 'Expensive hour') };
  function render(T){
    var h = Math.min(23, Math.floor(T)), hh = T >= 24 ? 24 : Math.floor(T), mm = T >= 24 ? 0 : Math.floor((T - Math.floor(T)) * 6) * 10, e = data.ec;
    cH.textContent = (hh < 10 ? '0' : '') + hh; cM.textContent = (mm < 10 ? '0' : '') + mm;
    if (phase === 'end') { if (lastMode !== 'end') { stEl.dataset.l = 'end'; stTxt.textContent = tx('Кінець доби', 'End of day'); lastMode = 'end'; } }
    else if (h !== lastHour || lastMode === 'end' || !lastMode) { stEl.dataset.l = levels[h]; stTxt.textContent = WORD[levels[h]]; lastMode = 'day'; lastHour = h; }
    var X_ = X(Math.min(24, T));
    setX(eCur, X_);
    if (view.p.length) cursorPrice(T);
    eCpr.setAttribute('width', X_);
    var sv = socAt(T);
    viz.update({ T: T, h: h, soc: sv, gh: e.fromGrid[h], gb: e.toBat[h], bh: e.fromBat[h], price: data.pr[h], level: levels[h] });
    drawEnergy(T);
    var A = cum(e.billA, T), Bb = cum(e.billB, T);
    lgA.textContent = money(A); lgB.textContent = money(Bb);
    tally(T);
  }
  /* each hour's money rides with the cursor: it rises from the column as the
     cursor enters the hour and lands in the savings tile exactly as the hour
     ends. Driven by T, so it keeps pace with the player, pauses and seeks with
     it; the tile counts what has landed (+ saved, − paid to charge) */
  var work = $('.work'), lgSum = lgN.parentNode, chips = [], fly = null, flyFor = -1, landed = 0, doneN = -1;
  function hourNet(h){ return data.ec.billA[h] - data.ec.billB[h]; }
  /* the sum counts up to what has landed — a short roll, not a jump */
  var shownV = 0, cntRaf = 0;
  function showNet(roll){
    var ahead = landed < -.5; if (ahead !== lgAhead) { lgAhead = ahead; lgSum.classList.toggle('is-neg', ahead); lgNt.textContent = ahead ? tx('Заряд наперед', 'Charging ahead') : tx('Економія', 'Savings'); }
    cancelAnimationFrame(cntRaf); cntRaf = 0;
    if (!roll || RM) { shownV = landed; lgN.textContent = money(landed, true); return; }
    var from = shownV, to = landed, t0 = performance.now();
    (function run(now){
      var k = Math.min(1, (now - t0) / (roll > 1 ? roll : 380)); k = 1 - Math.pow(1 - k, 3);
      shownV = from + (to - from) * k; lgN.textContent = money(k < 1 ? shownV : to, true);
      cntRaf = k < 1 ? requestAnimationFrame(run) : 0;
    })(t0);
  }
  function dropFly(){ if (fly) { fly.el.remove(); fly = null; } }
  function tallyReset(n){
    chips.forEach(function(c){ c.remove(); }); chips = []; dropFly(); flyFor = -1;
    landed = 0; for (var h = 0; h < n; h++) landed += hourNet(h);
    doneN = n; showNet();
  }
  function flyStart(h, k){
    var v = hourNet(h);
    if (Math.abs(v) < .5 || RM || !visible || k > .3) return;
    var wr = work.getBoundingClientRect(), sr = svP.getBoundingClientRect();
    var el = document.createElement('span'); el.className = 'hchip' + (v < 0 ? ' hchip--neg' : ''); el.setAttribute('aria-hidden', 'true');
    el.textContent = money(v, true); work.appendChild(el);
    var cw = el.offsetWidth, ch = el.offsetHeight;
    var x0 = sr.left - wr.left + (X(h) + XW / 2) / 600 * sr.width - cw / 2, y0 = sr.top - wr.top + yP(view.p[h]) / 200 * sr.height - ch - 6;
    el.style.left = x0 + 'px'; el.style.top = y0 + 'px'; el.style.opacity = 0; el.style.transformOrigin = '50% 50%';
    /* lands on one fixed spot — where the tile's sum starts — whatever the sum's length */
    var nr = lgN.getBoundingClientRect();
    fly = { h: h, el: el, tx: nr.left - wr.left - x0, ty: nr.top - wr.top + (nr.height - ch) / 2 - y0 };
  }
  function ease(t){ return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
  function flyMove(T){
    if (!fly) return;
    var p = Math.max(0, Math.min(1, T - fly.h)), x = 0, y, sc = 1, op = 1;
    /* a quick rise from the column, then one eased glide to the tile */
    if (p < .22) { var k = 1 - Math.pow(1 - p / .22, 3); y = 8 - 20 * k; sc = .85 + .15 * k; op = Math.min(1, p / .14); }
    else { var e = ease((p - .22) / .78); x = fly.tx * e; y = -12 + (fly.ty + 12) * e; sc = 1 - .08 * Math.sin(e * Math.PI); }
    fly.el.style.transform = 'translate(' + x + 'px,' + y + 'px) scale(' + sc + ')'; fly.el.style.opacity = op;
  }
  function land(h){
    if (h < 0) return;
    landed += hourNet(h);
    if (!fly || fly.h !== h) { dropFly(); showNet(300); return; }
    var el = fly.el, v = hourNet(h), tf = 'translate(' + fly.tx + 'px,' + fly.ty + 'px)'; fly = null; chips.push(el);
    /* landed: the sum rolls with the «bulk» while the hour melts into it */
    showNet(300); el.style.transformOrigin = '';
    el.animate([{ transform: tf + ' scale(1)', opacity: 1, filter: 'blur(0)' }, { transform: tf + ' scale(1.14)', opacity: 0, filter: 'blur(2px)' }], { duration: 220, easing: 'ease-out', fill: 'forwards' })
      .onfinish = function(){ var i = chips.indexOf(el); if (i >= 0) chips.splice(i, 1); el.remove(); };
    lgSum.classList.remove('is-hit', 'is-hit--neg'); void lgSum.offsetWidth; lgSum.classList.add(v < 0 ? 'is-hit--neg' : 'is-hit');
    lgN.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.12)', offset: .3 }, { transform: 'scale(.96)', offset: .65 }, { transform: 'scale(1)' }], { duration: 420, easing: 'ease-out' });
  }
  S.page.leave(function(){ cancelAnimationFrame(cntRaf); dropFly(); });
  function tally(T){
    var n = T >= 24 ? 24 : Math.floor(T);
    if (n === doneN + 1) { doneN = n; land(n - 1); }
    else if (n !== doneN) tallyReset(n);
    if (n < 24 && phase === 'day' && flyFor !== n) { flyFor = n; flyStart(n, T - n); }
    flyMove(T);
  }
  function showCard(on){ card.classList.toggle('is-on', on); }
  function frame(now){
    var dt = Math.max(0, Math.min(.12, (now - last) / 1000)); last = now;
    if (phase === 'day') { var h = Math.min(23, Math.floor(T)), act = data.sch.chg[h] > 1e-6 || data.sch.dis[h] > 1e-6; T += dt / (act ? ACTIVE : IDLE); if (T >= 24) { T = 24; phase = 'end'; endAt = now; showCard(true); } }
    else if (now - endAt > HOLD * 1000) { phase = 'day'; T = 0; showCard(false); lastMode = ''; }
    render(T);
    raf = playing && visible ? requestAnimationFrame(frame) : 0;
  }
  function start(){ if (raf || !playing || !visible) return; last = performance.now(); raf = requestAnimationFrame(frame); }
  function stop(){ cancelAnimationFrame(raf); raf = 0; }
  var playBtn = $('#play');
  function setPlayUI(){ playBtn.setAttribute('aria-label', playing ? tx('Пауза', 'Pause') : tx('Відтворити', 'Play'));
    playBtn.innerHTML = playing ? '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="2.6" height="10" rx="1" fill="currentColor"/><rect x="9.4" y="3" width="2.6" height="10" rx="1" fill="currentColor"/></svg>' : '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6L12.6 8z" fill="currentColor"/></svg>'; }
  playBtn.addEventListener('click', function(){ playing = !playing; setPlayUI(); if (playing) { if (phase === 'end') { phase = 'day'; T = 0; showCard(false); lastMode = ''; } start(); } else stop(); });
  $('#replay').addEventListener('click', function(){ T = 0; phase = 'day'; showCard(false); lastMode = ''; playing = true; setPlayUI(); render(0); start(); });
  var io = new IntersectionObserver(function(es){ visible = es[0].isIntersecting; visible ? start() : stop(); }, { threshold: .05 }); io.observe($('.work'));
  document.addEventListener('visibilitychange', function(){ if (document.hidden) stop(); else start(); }, { signal: S.page.signal });
  S.page.leave(function(){ visible = false; stop(); io.disconnect(); dropFly(); chips.forEach(function(c){ c.remove(); }); chips = []; });

  /* hover + click-to-jump on the charts */
  var tip = $('#tip'), charts = $('#charts');
  function hourFrom(e){ var svg = e.target.closest('svg'); if (!svg) return -1; var r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * 600; var h = Math.floor((vx - X0) / XW); return h >= 0 && h < 24 ? h : -1; }
  function row(val, name, color){ var rr = document.createElement('div'); rr.className = 'tip__r'; var k = document.createElement('span'); k.className = 'tip__k'; k.style.background = color; var v = document.createElement('span'); v.className = 'tip__v'; v.textContent = val; var n = document.createElement('span'); n.className = 'tip__n'; n.textContent = name; rr.append(k, v, n); return rr; }
  function eTxt(v){ return st.who === 'ind' ? num(v / 1000) + tx(' МВт·год', ' MWh') : nf(v, v < 10 ? 2 : v < 100 ? 1 : 0) + tx(' кВт·год', ' kWh'); }
  function showTip(svg, h){
    if (!pricesOk(data.pr)) return;
    var r = svg.getBoundingClientRect(), wr = charts.getBoundingClientRect(), ec = data.ec;
    tip.textContent = ''; var hd = document.createElement('div'); hd.className = 'tip__h'; hd.textContent = (h < 10 ? '0' : '') + h + ':00–' + (h + 1 < 10 ? '0' : '') + (h + 1) + ':00'; tip.appendChild(hd);
    tip.appendChild(row(hrn(data.pr[h], 2) + tx('/кВт·год', '/kWh'), tx('ціна', 'price'), '#EAF0EC'));
    tip.appendChild(row(eTxt(ec.load[h]), tx('споживання', 'use'), '#93A09A'));
    if (ec.fromBat[h] > 1e-6) tip.appendChild(row(eTxt(ec.fromBat[h]), tx('з накопичувача', 'from storage'), '#80A430'));
    if (ec.fromGrid[h] > 1e-6) tip.appendChild(row(eTxt(ec.fromGrid[h]), tx('з мережі', 'from the grid'), '#56645D'));
    if (ec.toBat[h] > 1e-6) tip.appendChild(row(eTxt(ec.toBat[h]), tx('на заряд', 'to charging'), '#1A99AE'));
    tip.appendChild(row(Math.round(data.sch.soc[h + 1] * 100) + ' %', tx('заряд', 'charge'), '#93A09A'));
    var sv = ec.save[h]; if (Math.abs(sv) > .005) tip.appendChild(row((sv > 0 ? '+' : '−') + hrn(Math.abs(sv), Math.abs(sv) < 10 ? 2 : 0), sv > 0 ? tx('економія', 'savings') : tx('заряд наперед', 'charging ahead'), sv > 0 ? '#C9F25C' : '#1A99AE'));
    tip.style.left = Math.max(100, Math.min(wr.width - 100, r.left - wr.left + (X(h) + XW / 2) / 600 * r.width)) + 'px';
    tip.style.top = (r.top - wr.top + 8) + 'px'; tip.classList.add('is-on');
  }
  charts.addEventListener('pointermove', function(e){ var h = hourFrom(e); if (h < 0) { tip.classList.remove('is-on'); return; } showTip(e.target.closest('svg'), h); });
  /* keyboard on the price chart: arrows step through the hours (the day pauses there), Enter plays from it */
  svP.addEventListener('keydown', function(e){
    var h = pFocus < 0 ? Math.min(23, Math.floor(T)) : pFocus, k = e.key;
    if (k === 'ArrowRight' || k === 'ArrowLeft' || k === 'Home' || k === 'End') {
      e.preventDefault(); pFocus = k === 'Home' ? 0 : k === 'End' ? 23 : (h + (k === 'ArrowRight' ? 1 : 23)) % 24;
      playing = false; stop(); setPlayUI(); T = pFocus + .99; phase = 'day'; showCard(false); lastMode = ''; render(T); showTip(svP, pFocus);
    } else if (k === 'Enter' || k === ' ') { e.preventDefault(); var f = pFocus < 0 ? h : pFocus; pFocus = -1; tip.classList.remove('is-on'); viz.onSeek(f); }
    else if (k === 'Escape') { pFocus = -1; tip.classList.remove('is-on'); render(T); }
  });
  svP.addEventListener('blur', function(){ if (pFocus < 0) return; pFocus = -1; tip.classList.remove('is-on'); render(T); });
  charts.addEventListener('pointerleave', function(){ tip.classList.remove('is-on'); });
  charts.addEventListener('click', function(e){ var h = hourFrom(e); if (h < 0) return; viz.onSeek(h); });

  /* ---- recompute ---- */
  function periodText(){ var pi = B.periodInfo('avg30'); return pi.from ? dLabel(pi.from) + '–' + dLabel(pi.to) : ''; }
  function levelsOf(pr){
    if (st.who === 'home') return pr.map(function(v, h){ var m = B.zoneMult(st.tariff, h); return m < 1 ? 'cheap' : m > 1 ? 'peak' : 'mid'; });
    var s = pr.slice().sort(function(a, b){ return a - b; }), lo = s[7], hi = s[17];
    return pr.map(function(v){ return v <= lo ? 'cheap' : v >= hi ? 'peak' : 'mid'; });
  }
  function hoursTxt(v){ if (!isFinite(v) || v <= 0) return '—'; var r = v >= 10 ? Math.round(v) : Math.round(v * 2) / 2; return '≈ ' + nf(r, r % 1 ? 1 : 0) + tx(' год', ' h'); }
  var liveDay = null;
  /* small badges instead of explanations: VAT and the price period on the price chart, the build chips */
  function updateHints(){
    var home = st.who === 'home', pv = $('#pVat'), pp = $('#pPeriod'), kn = $('#kitnote');
    pv.textContent = home ? tx('з ПДВ', 'incl. VAT') : tx('без ПДВ', 'excl. VAT');
    pv.title = home ? tx('Тариф для населення · постанова КМУ про ПСО', 'Household tariff · Cabinet of Ministers PSO resolution') : tx('Розподіл, послуги постачальника й ПДВ однакові щогодини — на економію майже не впливають', 'Distribution, supplier services and VAT are the same every hour and barely affect the savings');
    pp.hidden = home;
    pp.title = home ? '' : tx('Середні погодинні ціни РДН за ', 'Average hourly DAM prices for ') + periodText() + tx(' + передача ', ' + transmission ') + hrn(B.TRANSMISSION, 2) + tx(' · АТ «Оператор ринку»', ' · JSC “Market Operator”') + (liveDay ? tx(' · оновлено онлайн', ' · updated online') : '');
    liveTag(liveSt);
    kn.innerHTML = blockNote; kn.hidden = !blockNote; kn.title = blockNote ? tx('З цілих блоків: ', 'From whole blocks: ') + cfgText(cfg) : '';
  }
  function updateResults(){
    var home = st.who === 'home', m = 30.4, late = !isFinite(pb) || pb > wr.life;
    /* the bill: with storage big, without it struck through */
    var bt = $('#rBillT'); bt.textContent = home ? tx('Рахунок за місяць', 'Monthly bill') : tx('Енергія за місяць', 'Monthly energy');
    if (!home) { var tg = document.createElement('span'); tg.className = 'ctag'; tg.textContent = tx('без ПДВ', 'excl. VAT'); bt.appendChild(tg); }
    $('#rBill').textContent = money(yr.dayAfter * m); $('#rBillWas').textContent = money(yr.dayBase * m);
    $('#rYear').textContent = money(yr.net, true);
    $('#rInv').textContent = money(inv); $('#rPb').textContent = years(pb); $('#rBack').textContent = hoursTxt(back);
    /* payback as a meter: its full width is the battery life */
    var life = Math.round(wr.life), pm = $('#rPbM');
    pm.querySelector('i').style.width = (isFinite(pb) ? Math.max(2, Math.min(100, pb / wr.life * 100)) : 100).toFixed(1) + '%';
    $('#rPbSub').textContent = tx('ресурс ', 'life ') + nf(life) + tx(' р.', ' yrs');
    pm.title = tx('Ресурс батареї ≈ ', 'Battery life ≈ ') + nf(life) + ' ' + plural(life, ['рік', 'роки', 'років'], ['year', 'years']) + ' · ' + nf(wr.cycles, 1) + tx(' циклу на добу · проста окупність', ' cycles a day · simple payback');
    pm.classList.toggle('is-warn', late); $('#rPb').classList.toggle('is-warn', late);
    /* backup: hours on a full charge, lit out of the 24 of a day */
    var bh = $('#rBackH'), n = isFinite(back) ? Math.min(24, Math.round(back)) : 0;
    if (!bh.children.length) for (var i = 0; i < 24; i++) bh.appendChild(document.createElement('i'));
    Array.prototype.forEach.call(bh.children, function(c, i){ c.classList.toggle('is-on', i < n); });
    /* the accent goes to what matters most: backup for a home, savings for a business */
    $('#rYearT').classList.toggle('res--hl', !home); $('#rBackT').classList.toggle('res--hl', home);
    $('#saveDay').textContent = money(data.ec.net, true);
    $('#dcNet').textContent = money(data.ec.net, true); $('#dcYear').textContent = money(yr.net, true); $('#dcPb').textContent = years(pb); $('#dcBack').textContent = hoursTxt(back);  }
  function buildTable(){ var tb = $('#dayTable tbody'), e = data.ec; tb.textContent = ''; for (var h = 0; h < 24; h++) { var tr = document.createElement('tr'), cells = [(h < 10 ? '0' : '') + h + ':00', nf(data.pr[h], 2), eTxt(e.load[h]), eTxt(e.fromBat[h]), eTxt(e.toBat[h]), Math.round(data.sch.soc[h + 1] * 100)]; cells.forEach(function(c){ var td = document.createElement('td'); td.textContent = c; tr.appendChild(td); }); tb.appendChild(tr); } }
  function recompute(){
    resolve();
    data = B.day(st); levels = levelsOf(data.pr);
    yr = B.annual(st); inv = B.invest(st); pb = yr.net > 0 ? inv / yr.net : Infinity; back = B.backup(st); wr = B.wear(st, data.ec);
    bud = B.budget(st, cfg);
    viz.setData({ who: st.who, cfg: cfg, budget: bud, sch: data.sch, ec: data.ec, pr: data.pr, L: data.L, levels: levels, rte: st.rte });
    outputs(); updateHints(); updateResults(); drawBands(); energyScale(); buildTable(); buildCosts(); tweenPrice();    S.save(Object.assign({}, st, { savedAt: Date.now(), day: data.ec.net, year: yr.net, inv: inv, pb: pb, backup: back, cycles: wr.cycles, life: wr.life, cfg: cfgText(cfg), periodText: st.who === 'home' ? '' : periodText() }));
    phase = 'day'; showCard(false); lastMode = '';
    T = RM ? 24 : 0; doneN = -1; render(T);
  }
  window.__player = { jump: function(t){ T = t; phase = 'day'; showCard(false); lastMode = ''; render(T); }, state: function(){ return { T: T, phase: phase, playing: playing }; }, st: st, data: function(){ return data; } };

  renderRows(); syncRows(); recompute(); setPlayUI(); start();
  /* live data: the newest market day (optional) */
  if (window.DAM_LIVE) { liveTag('load'); window.DAM_LIVE().then(function(r){ liveTag(r ? '' : 'off'); if (!r) return; liveDay = r.day; if (r.fresh && st.who !== 'home') recompute(); else updateHints(); }); }
})();
