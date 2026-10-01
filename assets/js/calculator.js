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
  var nf = S.nf, money = S.money, years = S.years;
  function plural(n, one, few, many){ var m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? one : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? few : many; }
  function dLabel(d){ var p = d.split('-'); return p[2] + '.' + p[1] + '.' + p[0]; }
  function dec(x){ x = Math.round(x * 100) / 100; return x % 1 === 0 ? 0 : Math.abs(x * 10 - Math.round(x * 10)) < 1e-9 ? 1 : 2; }
  function num(x){ x = Math.round(x * 100) / 100; return nf(x, dec(x)); }

  /* ---- state: URL > saved > defaults ---- */
  var NOUN = { home: 'дім', biz: 'бізнес', ind: 'підприємство' };
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
    if (c.kind === 'home') { var m = it(c, 'homeModule').qty, inv1 = it(c, 'hybridInverter'); return m + ' ' + plural(m, 'модуль', 'модулі', 'модулів') + ' · ' + S.capTxt(c.cap) + ' · ' + (inv1.qty > 1 ? 'інвертори ' + inv1.qty + ' × ' + nf(inv1.kw) + ' кВт' : 'інвертор ' + S.powTxt(c.pow)); }
    if (c.kind === 'cabinet') { var n = it(c, 'cabinet').qty; return n + ' ' + plural(n, 'шафа', 'шафи', 'шаф') + ' · ' + S.capTxt(c.cap) + ' · ' + S.powTxt(c.pow); }
    var k = it(c, 'container').qty; return k + ' ' + plural(k, 'контейнер', 'контейнери', 'контейнерів') + ' · ' + S.capTxt(c.cap) + ' · ' + S.powTxt(c.pow);
  }
  function resolve(){
    cfg = B.configure({ who: st.who, cap: st.capIn, pow: st.powIn });
    st.cap = cfg.cap; st.pow = cfg.pow;
    blockNote = Math.abs(cfg.cap - st.capIn) > .05 || Math.abs(cfg.pow - st.powIn) > .05 ? 'Під ' + S.capTxt(st.capIn) + ' · ' + S.powTxt(st.powIn) + ' збираємо з цілих блоків: <b>' + cfgText(cfg) + '</b>. Рахуємо для цієї збірки.' : '';
  }

  /* ---- option rows: typical values as tabs + a field for your own ---- */
  var UNIT = {
    cons: function(w){ return w === 'ind' ? { u: 'МВт·год на місяць', k: 1000 } : { u: 'кВт·год на місяць', k: 1 }; },
    capIn: function(w){ return w === 'ind' ? { u: 'МВт·год', k: 1000 } : { u: 'кВт·год', k: 1 }; },
    powIn: function(w){ return w === 'ind' ? { u: 'МВт', k: 1000 } : { u: 'кВт', k: 1 }; },
    base: function(){ return { u: '₴ за кВт·год', k: 1 }; },
    cost: function(){ return { u: '₴ за кВт·год', k: 1 }; },
    rte: function(){ return { u: '%', k: .01 }; },
    dod: function(){ return { u: '%', k: .01 }; }
  };
  var ROWS = {
    site: [
      { key: 'cons', label: 'Споживання', list: function(w){ return B.OPTS[w].cons.list; }, min: 1, max: 1e9 },
      { key: 'tariff', label: 'Тариф', only: ['home'], choices: [['two', 'Двозонний'], ['three', 'Тризонний']] },
      { key: 'base', label: 'Ціна для населення', only: ['home'], list: function(){ return [4.32, 5.5, 7]; }, min: .5, max: 50 }
    ],
    sys: [
      { key: 'capIn', label: 'Ємність', list: function(w){ return B.OPTS[w].cap.list; }, min: .5, max: 1e7 },
      { key: 'powIn', label: 'Потужність', list: function(w){ return B.OPTS[w].pow.list; }, min: .5, max: 1e7 },
      { key: 'rte', label: 'ККД циклу', list: function(){ return B.RTE.list; }, min: .5, max: 1 },
      { key: 'dod', label: 'Глибина розряду', list: function(){ return B.DOD.list; }, min: .3, max: 1 },
      { key: 'cost', label: 'Вартість під ключ', list: function(w){ return B.OPTS[w].cost.list; }, min: 500, max: 1e6 }
    ]
  };
  var rowEls = {}, typeT = 0;
  function same(a, b){ return Math.abs(a - b) <= Math.max(1e-9, Math.abs(b) * 1e-6); }
  function renderRows(){
    rowEls = {};
    [['site', $('#optsSite')], ['sys', $('#optsSys')]].forEach(function(pair){
      var host = pair[1]; host.textContent = '';
      ROWS[pair[0]].forEach(function(r){
        if (r.only && r.only.indexOf(st.who) < 0) return;
        var row = document.createElement('div'); row.className = 'opt'; row.dataset.key = r.key;
        var head = document.createElement('div'); head.className = 'f__l';
        var lab = document.createElement('span'), u = UNIT[r.key] ? UNIT[r.key](st.who) : null; lab.textContent = r.label + (u ? ', ' + u.u.replace(' на місяць', '') : '');
        var out = document.createElement('output'); head.append(lab, out);
        var seg = document.createElement('div'); seg.className = 'seg seg--opt'; seg.setAttribute('role', 'group'); seg.setAttribute('aria-label', r.label);
        var btns = [];
        if (r.choices) r.choices.forEach(function(c){ var b = document.createElement('button'); b.type = 'button'; b.textContent = c[1]; b.addEventListener('click', function(){ st[r.key] = c[0]; syncRows(); recompute(); }); seg.appendChild(b); btns.push([c[0], b]); });
        else r.list(st.who).forEach(function(v){ var b = document.createElement('button'); b.type = 'button'; b.textContent = num(v / u.k); b.addEventListener('click', function(){ st[r.key] = v; row.querySelector('.seg__in').value = ''; syncRows(); recompute(); }); seg.appendChild(b); btns.push([v, b]); });
        var inp = null;
        if (!r.choices) {
          inp = document.createElement('input'); inp.className = 'seg__in'; inp.inputMode = 'decimal'; inp.autocomplete = 'off'; inp.placeholder = 'своє';
          inp.setAttribute('aria-label', 'Своє значення: ' + r.label.toLowerCase() + ', ' + u.u);
          inp.addEventListener('input', function(){
            clearTimeout(typeT); var raw = inp.value.replace(/\s/g, '').replace(',', '.');
            typeT = setTimeout(function(){
              var v = parseFloat(raw); if (!raw) { inp.classList.remove('is-bad'); return; }
              if (!isFinite(v)) { inp.classList.add('is-bad'); return; }
              v = v * u.k; var ok = v >= r.min && v <= r.max; inp.classList.toggle('is-bad', !ok); if (!ok) return;
              st[r.key] = v; syncRows(true); recompute();
            }, 450);
          });
          inp.addEventListener('keydown', function(e){ if (e.key === 'Enter') { e.preventDefault(); inp.blur(); } });
          seg.appendChild(inp);
        }
        row.append(head, seg);
        host.appendChild(row); rowEls[r.key] = { r: r, out: out, btns: btns, inp: inp, u: u };
      });
    });
  }
  function hh(h){ return (h < 10 ? '0' : '') + h; }
  function hourSel(a, b, label){ var w = document.createElement('div'); w.className = 'select'; var el = document.createElement('select'); el.setAttribute('aria-label', label); for (var h = a; h <= b; h++) { var o = document.createElement('option'); o.value = h; o.textContent = hh(h) + ':00'; el.appendChild(o); } w.appendChild(el); return { wrap: w, el: el }; }
  /* keepTyping: don't overwrite the field the user is typing in */
  function syncRows(keepTyping){
    $$('#segWho button').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.v === st.who)); });
    Object.keys(rowEls).forEach(function(k){
      var e = rowEls[k], v = st[k], hit = false;
      e.btns.forEach(function(p){ var on = typeof p[0] === 'number' ? same(v, p[0]) : p[0] === v; if (on) hit = true; p[1].setAttribute('aria-pressed', String(on)); });
      if (e.inp) { e.inp.classList.toggle('is-on', !hit); if (!hit && !(keepTyping && document.activeElement === e.inp)) e.inp.value = num(v / e.u.k); if (hit && document.activeElement !== e.inp) e.inp.value = ''; }
    });
    syncProfile();
  }
  function outputs(){
    var o = function(k, s){ if (rowEls[k]) rowEls[k].out.textContent = s; };
    var dayUse = data.ec.use;
    o('cons', '≈ ' + (st.who === 'ind' ? num(dayUse / 1000) + ' МВт·год' : nf(dayUse, dayUse < 100 ? 1 : 0) + ' кВт·год') + ' на добу');
    var c = cfg.kind === 'home' ? it(cfg, 'homeModule').qty + ' ' + plural(it(cfg, 'homeModule').qty, 'модуль', 'модулі', 'модулів') : cfg.kind === 'cabinet' ? it(cfg, 'cabinet').qty + ' ' + plural(it(cfg, 'cabinet').qty, 'шафа', 'шафи', 'шаф') : it(cfg, 'container').qty + ' ' + plural(it(cfg, 'container').qty, 'контейнер', 'контейнери', 'контейнерів');
    o('capIn', S.capTxt(cfg.cap) + ' · ' + c);
    o('powIn', S.powTxt(cfg.pow));
    o('rte', nf(Math.round(st.rte * 100)) + ' %'); o('dod', nf(Math.round(st.dod * 100)) + ' %');
    o('cost', 'разом ' + money(inv));
    o('base', nf(st.base, 2) + ' ₴');
    o('tariff', st.tariff === 'three' ? 'ніч ×0,4 · пік ×1,5' : 'ніч ×0,5');
  }

  /* ---- site type ---- */
  $$('#segWho button').forEach(function(b){ b.addEventListener('click', function(){ if (st.who === b.dataset.v) return; st.who = b.dataset.v; Object.assign(st, defaults(st.who)); renderRows(); syncRows(); recompute(); }); });

  /* ---- consumption profile: next to the charts it shapes ---- */
  var PROF_NOTE = {
    flat: 'Однакове споживання щогодини, вдень і вночі.',
    work: 'Повне навантаження в робочі години; вночі (19:00–6:00) горить світло — близько 12 % від робочого; решта годин — чергове живлення, близько 4 %.',
    best: 'Найкращий для накопичувача випадок: більше споживання припадає на найдорожчі години. Реальний графік зазвичай гірший — порівняйте з двома іншими.'
  };
  var hFrom = $('#hFrom'), hTo = $('#hTo');
  (function(){ for (var h = 0; h <= 24; h++) { if (h < 24) { var o = document.createElement('option'); o.value = h; o.textContent = hh(h) + ':00'; hFrom.appendChild(o); } if (h > 0) { var o2 = document.createElement('option'); o2.value = h; o2.textContent = hh(h) + ':00'; hTo.appendChild(o2); } } })();
  $$('#segProf button').forEach(function(b){ b.addEventListener('click', function(){ st.prof = b.dataset.v; syncProfile(); recompute(); }); });
  $$('#segHours button').forEach(function(b){ b.addEventListener('click', function(){ var p = b.dataset.h.split('-'); st.from = +p[0]; st.to = +p[1]; syncProfile(); recompute(); }); });
  [hFrom, hTo].forEach(function(x){ x.addEventListener('change', function(){ st.from = +hFrom.value; st.to = +hTo.value; if (st.to === st.from) st.to = st.from + 1; syncProfile(); recompute(); }); });
  function syncProfile(){
    $$('#segProf button').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.v === st.prof)); });
    $$('#segHours button').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.h === st.from + '-' + st.to)); });
    hFrom.value = st.from; hTo.value = st.to; $('#profHours').hidden = st.prof !== 'work';
    var dur = ((st.to - st.from) + 24) % 24 || 24;
    $('#profNote').textContent = PROF_NOTE[st.prof] + (st.prof === 'work' ? ' Зараз: ' + hh(st.from) + ':00–' + hh(st.to % 24) + ':00, ' + dur + ' ' + plural(dur, 'година', 'години', 'годин') + '.' : '');
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
  /* price */
  var svP = $('#svP'), PY0 = 12, PY1 = 176;
  var gPb = mk('g', {}, svP), gPg = mk('g', {}, svP);
  var pArea = mk('path', { fill: 'rgba(234,240,236,.07)' }, svP);
  var pBase = mk('path', { fill: 'none', stroke: '#34403A', 'stroke-width': 2, 'stroke-linejoin': 'round' }, svP);
  var cpP = mk('clipPath', { id: 'cpP' }, svP), cpPr = mk('rect', { x: X0 - 2, y: 0, width: 0, height: 200 }, cpP);
  var pLine = mk('path', { fill: 'none', stroke: '#EAF0EC', 'stroke-width': 2, 'stroke-linejoin': 'round', 'clip-path': 'url(#cpP)' }, svP);
  mk('line', { x1: X0, x2: X1, y1: PY1, y2: PY1, stroke: '#2B3631', 'stroke-width': 1 }, svP);
  xAxis(svP, PY1 + 19);
  var pCur = mk('line', { y1: PY0 - 4, y2: PY1, stroke: 'rgba(234,240,236,.35)', 'stroke-width': 1 }, svP);
  var pDot = mk('circle', { r: 5, fill: '#EAF0EC', stroke: '#0B0E0D', 'stroke-width': 2 }, svP);
  var view = { p: [], yMax: 10 };
  function yP(v){ return PY1 - v / view.yMax * (PY1 - PY0); }
  function drawPrice(){
    clear(gPg);
    for (var k = 0; k <= 4; k++) { var v = view.yMax * k / 4, y = yP(v); if (k) mk('line', { x1: X0, x2: X1, y1: y, y2: y, stroke: '#1B2420', 'stroke-width': 1 }, gPg); txt(gPg, X0 - 8, y + 4, tick(v), 'end'); }
    var d = ''; view.p.forEach(function(v, h){ d += (h ? 'L' : 'M') + X(h).toFixed(1) + ' ' + yP(v).toFixed(1) + 'H' + X(h + 1).toFixed(1); });
    pBase.setAttribute('d', d); pLine.setAttribute('d', d); pArea.setAttribute('d', d + 'V' + PY1 + 'H' + X0 + 'Z');
  }
  function drawBands(){
    clear(gPb);
    data.sch.chg.forEach(function(e, h){ if (e > 1e-6) mk('rect', { x: X(h) + .5, y: PY0, width: XW - 1, height: PY1 - PY0, fill: 'rgba(26,153,174,.2)' }, gPb); });
    data.sch.dis.forEach(function(e, h){ if (e > 1e-6) mk('rect', { x: X(h) + .5, y: PY0, width: XW - 1, height: PY1 - PY0, fill: 'rgba(128,164,48,.22)' }, gPb); });
  }
  function tweenPrice(){
    var toP = data.pr.slice(), toMax = nice(Math.max.apply(null, toP));
    if (!view.p.length || !G || RM) { view.p = toP; view.yMax = toMax; drawPrice(); return; }
    var o = { t: 0 }, fp = view.p.slice(), fm = view.yMax;
    G.to(o, { t: 1, duration: .75, ease: 'power3.inOut', overwrite: true, onUpdate: function(){ view.p = fp.map(function(v, i){ return v + (toP[i] - v) * o.t; }); view.yMax = fm + (toMax - fm) * o.t; drawPrice(); } });
  }
  /* energy: upper band — what the site uses each hour (from the grid / from
     the storage), lower band — what goes into the storage. Separate scales so
     a big charging hour doesn't squash the load; all 24 hours always drawn,
     hours still ahead are dimmed. */
  var svE = $('#svE'), EY0 = 12, EY1 = 128, CY0 = 146, CY1 = 176, gEa = mk('g', {}, svE), gE = mk('g', {}, svE);
  mk('line', { x1: X0, x2: X1, y1: EY1, y2: EY1, stroke: '#2B3631', 'stroke-width': 1 }, svE); xAxis(svE, CY1 + 19);
  var eCur = mk('line', { y1: EY0 - 4, y2: CY1, stroke: 'rgba(234,240,236,.35)', 'stroke-width': 1 }, svE);
  var eb = []; for (var i = 0; i < 24; i++) eb.push({ g: mk('path', { fill: '#56645D' }, gE), b: mk('path', { fill: '#80A430' }, gE), c: mk('path', { fill: '#1A99AE' }, gE) });
  var en = { max: 1, cmax: 1, k: 1 };
  function yE(v){ return EY1 - v / en.max * (EY1 - EY0); }
  function yC(v){ return CY0 + v / en.cmax * (CY1 - CY0); }
  function energyScale(){
    en.k = st.who === 'ind' ? 1000 : 1; $('#unitE').textContent = st.who === 'ind' ? 'МВт·год' : 'кВт·год';
    var m = 0, c = 0; for (var h = 0; h < 24; h++) { m = Math.max(m, data.ec.load[h]); c = Math.max(c, data.ec.toBat[h]); }
    en.max = nice(m / en.k) * en.k; en.cmax = c > 0 ? nice(c / en.k) * en.k : 1; clear(gEa);
    for (var k = 0; k <= 2; k++) { var v = en.max * k / 2, y = yE(v); if (k) mk('line', { x1: X0, x2: X1, y1: y, y2: y, stroke: '#1B2420', 'stroke-width': 1 }, gEa); txt(gEa, X0 - 8, y + 4, tick(v / en.k), 'end'); }
    if (c > 0) { txt(gEa, X0 - 8, CY1 + 4, tick(en.cmax / en.k), 'end'); var lb = txt(gEa, X0 + 4, CY0 - 4, 'заряд накопичувача', 'start'); lb.setAttribute('fill', '#1A99AE'); lb.setAttribute('font-size', 10); }
  }
  function seg(x, w, yb, yt, round){ var h = yb - yt; if (h < .4) return ''; var r = round ? Math.min(3, h, w / 2) : 0; return 'M' + x + ' ' + yb + 'V' + (yt + r) + (r ? 'Q' + x + ' ' + yt + ' ' + (x + r) + ' ' + yt + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + yt + ' ' + (x + w) + ' ' + (yt + r) : 'H' + (x + w)) + 'V' + yb + 'Z'; }
  function segDown(x, w, yt, yb){ var h = yb - yt; if (h < .4) return ''; var r = Math.min(3, h, w / 2); return 'M' + x + ' ' + yt + 'V' + (yb - r) + 'Q' + x + ' ' + yb + ' ' + (x + r) + ' ' + yb + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + yb + ' ' + (x + w) + ' ' + (yb - r) + 'V' + yt + 'Z'; }
  function drawEnergy(T){
    var bw = Math.min(15, XW * .66), e = data.ec;
    for (var h = 0; h < 24; h++) {
      var x = X(h) + (XW - bw) / 2, g = e.fromGrid[h], b = e.fromBat[h], c = e.toBat[h], y1 = yE(g), y2 = yE(g + b), op = T >= h + 1 || T > h ? 1 : .32;
      eb[h].g.setAttribute('d', seg(x, bw, EY1, y1, !b)); eb[h].b.setAttribute('d', seg(x, bw, y1, y2, true)); eb[h].c.setAttribute('d', segDown(x, bw, CY0, yC(c)));
      eb[h].g.setAttribute('opacity', op); eb[h].b.setAttribute('opacity', op); eb[h].c.setAttribute('opacity', op);
    }
  }

  /* ---- the animation ---- */
  var vizEl = $('#dayviz'), viz = window.DayFlow.create(vizEl);
  viz.onHover = function(key){ $$('#costs tbody tr').forEach(function(tr){ tr.classList.toggle('is-hot', !!key && tr.dataset.key === key); }); };
  viz.onSeek = function(h){ T = h + .01; phase = 'day'; showCard(false); lastMode = ''; render(T); if (!playing) { playing = true; setPlayUI(); } start(); };

  /* ---- cost table ---- */
  var SUMMARY = {
    homeModule: function(x){ return x.qty + ' × 5,12 кВт·год · LiFePO₄'; },
    hybridInverter: function(x){ return (x.qty > 1 ? x.qty + ' × ' : '') + nf(x.kw) + ' кВт · перемикання на резерв'; },
    cabinet: function(x){ return x.qty + ' × 215 кВт·год · 100 кВт у кожній'; },
    container: function(x){ return x.qty + ' × 2,5 МВт·год · 20-футовий'; },
    pcs: function(x){ return x.qty + ' × 1 250 кВт · EN 50549'; },
    transformer: function(x){ return (x.qty > 1 ? x.qty + ' × ' : '') + nf(x.kva) + ' кВА · 0,4 / 10 кВ'; },
    ems: function(){ return 'розклад заряду, телеметрія IEC 60870-5-104'; },
    switchboard: function(x){ return x.mv ? 'КРП 10 кВ · АВР' : '0,4 кВ · АВР, захист від зворотного живлення'; },
    meter: function(){ return 'двонаправлений, погодинний'; },
    install: function(){ return 'доставка, монтаж, пусконалагодження'; },
    design: function(){ return 'проєкт, ТУ, сертифікація, введення в експлуатацію'; }
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
    var fr = document.createElement('tr'), f1 = document.createElement('td'); f1.textContent = 'Разом під ключ'; var f2 = document.createElement('td'); f2.className = 'hide-sm'; var f3 = document.createElement('td'); f3.className = 'n'; f3.textContent = money(bud.total);
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
  var WORD = { cheap: 'Дешева година', mid: 'Звичайна ціна', peak: 'Дорога година' };
  function status(h){
    var e = data.ec, gb = e.toBat[h], bh = e.fromBat[h], gh = e.fromGrid[h], n = NOUN[st.who], w = WORD[levels[h]];
    if (gb > 1e-6 && bh <= 1e-6) return ['chg', w + ' — мережа заряджає станцію і живить ' + n];
    if (bh > 1e-6 && gh <= 1e-6) return ['dis', w + ' — ' + n + ' працює від станції'];
    if (bh > 1e-6) return ['dis', w + ' — станція дає ' + Math.round(bh / (bh + gh) * 100) + ' %, решта з мережі'];
    return ['idle', w + ' — ' + n + ' бере енергію з мережі'];
  }
  function render(T){
    var h = Math.min(23, Math.floor(T)), hh = T >= 24 ? 24 : Math.floor(T), mm = T >= 24 ? 0 : Math.floor((T - Math.floor(T)) * 6) * 10, e = data.ec;
    cH.textContent = (hh < 10 ? '0' : '') + hh; cM.textContent = (mm < 10 ? '0' : '') + mm;
    if (phase === 'end') { if (lastMode !== 'end') { stEl.dataset.m = 'idle'; stTxt.textContent = 'Доба завершена — економія ' + money(e.net, true); lastMode = 'end'; } }
    else if (h !== lastHour || lastMode === 'end' || !lastMode) { var s = status(h); stEl.dataset.m = s[0]; stTxt.textContent = s[1]; lastMode = s[0]; lastHour = h; }
    var X_ = X(Math.min(24, T));
    [pCur, eCur].forEach(function(c){ c.setAttribute('x1', X_); c.setAttribute('x2', X_); });
    cpPr.setAttribute('width', Math.max(0, X_ - X0 + 2));
    pDot.setAttribute('cx', X_); pDot.setAttribute('cy', yP(view.p[h] != null ? view.p[h] : data.pr[h]));
    var sv = socAt(T);
    viz.update({ T: T, h: h, soc: sv, gh: e.fromGrid[h], gb: e.toBat[h], bh: e.fromBat[h], price: data.pr[h], level: levels[h] });
    drawEnergy(T);
    var A = cum(e.billA, T), Bb = cum(e.billB, T);
    lgA.textContent = money(A); lgB.textContent = money(Bb); lgN.textContent = money(A - Bb, true);
    var ahead = A - Bb < -.5; if (ahead !== lgAhead) { lgAhead = ahead; lgNt.textContent = ahead ? 'Поки що заряд наперед' : 'Економія з початку доби'; }
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
  function setPlayUI(){ playBtn.setAttribute('aria-label', playing ? 'Пауза' : 'Відтворити');
    playBtn.innerHTML = playing ? '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><rect x="4" y="3" width="2.6" height="10" rx="1" fill="currentColor"/><rect x="9.4" y="3" width="2.6" height="10" rx="1" fill="currentColor"/></svg>' : '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M5 3.2v9.6L12.6 8z" fill="currentColor"/></svg>'; }
  playBtn.addEventListener('click', function(){ playing = !playing; setPlayUI(); if (playing) { if (phase === 'end') { phase = 'day'; T = 0; showCard(false); lastMode = ''; } start(); } else stop(); });
  $('#replay').addEventListener('click', function(){ T = 0; phase = 'day'; showCard(false); lastMode = ''; playing = true; setPlayUI(); render(0); start(); });
  new IntersectionObserver(function(es){ visible = es[0].isIntersecting; visible ? start() : stop(); }, { threshold: .05 }).observe($('.work'));
  document.addEventListener('visibilitychange', function(){ if (document.hidden) stop(); else start(); });

  /* hover + click-to-jump on the charts */
  var tip = $('#tip'), charts = $('#charts');
  function hourFrom(e){ var svg = e.target.closest('svg'); if (!svg) return -1; var r = svg.getBoundingClientRect(), vx = (e.clientX - r.left) / r.width * 600; var h = Math.floor((vx - X0) / XW); return h >= 0 && h < 24 ? h : -1; }
  function row(val, name, color){ var rr = document.createElement('div'); rr.className = 'tip__r'; var k = document.createElement('span'); k.className = 'tip__k'; k.style.background = color; var v = document.createElement('span'); v.className = 'tip__v'; v.textContent = val; var n = document.createElement('span'); n.className = 'tip__n'; n.textContent = name; rr.append(k, v, n); return rr; }
  function eTxt(v){ return st.who === 'ind' ? num(v / 1000) + ' МВт·год' : nf(v, v < 10 ? 2 : v < 100 ? 1 : 0) + ' кВт·год'; }
  charts.addEventListener('pointermove', function(e){
    var h = hourFrom(e); if (h < 0) { tip.classList.remove('is-on'); return; }
    var svg = e.target.closest('svg'), r = svg.getBoundingClientRect(), wr = charts.getBoundingClientRect(), ec = data.ec;
    tip.textContent = ''; var hd = document.createElement('div'); hd.className = 'tip__h'; hd.textContent = (h < 10 ? '0' : '') + h + ':00–' + (h + 1 < 10 ? '0' : '') + (h + 1) + ':00'; tip.appendChild(hd);
    tip.appendChild(row(nf(data.pr[h], 2) + ' ₴/кВт·год', 'ціна для вас', '#EAF0EC'));
    tip.appendChild(row(eTxt(ec.load[h]), 'споживає об’єкт', '#93A09A'));
    if (ec.fromBat[h] > 1e-6) tip.appendChild(row(eTxt(ec.fromBat[h]), 'з накопичувача', '#80A430'));
    if (ec.fromGrid[h] > 1e-6) tip.appendChild(row(eTxt(ec.fromGrid[h]), 'з мережі', '#56645D'));
    if (ec.toBat[h] > 1e-6) tip.appendChild(row(eTxt(ec.toBat[h]), 'на заряд', '#1A99AE'));
    tip.appendChild(row(Math.round(data.sch.soc[h + 1] * 100) + ' %', 'заряд на кінець години', '#93A09A'));
    var sv = ec.save[h]; if (Math.abs(sv) > .005) tip.appendChild(row((sv > 0 ? '+' : '−') + nf(Math.abs(sv), Math.abs(sv) < 10 ? 2 : 0) + ' ₴', sv > 0 ? 'економія цієї години' : 'платимо за заряд наперед', sv > 0 ? '#C9F25C' : '#1A99AE'));
    tip.style.left = Math.max(100, Math.min(wr.width - 100, r.left - wr.left + (X(h) + XW / 2) / 600 * r.width)) + 'px';
    tip.style.top = (r.top - wr.top + 8) + 'px'; tip.classList.add('is-on');
  });
  charts.addEventListener('pointerleave', function(){ tip.classList.remove('is-on'); });
  charts.addEventListener('click', function(e){ var h = hourFrom(e); if (h < 0) return; viz.onSeek(h); });

  /* ---- recompute ---- */
  function periodText(){ var pi = B.periodInfo('avg30'); return pi.from ? dLabel(pi.from) + '–' + dLabel(pi.to) : ''; }
  function levelsOf(pr){
    if (st.who === 'home') return pr.map(function(v, h){ var m = B.zoneMult(st.tariff, h); return m < 1 ? 'cheap' : m > 1 ? 'peak' : 'mid'; });
    var s = pr.slice().sort(function(a, b){ return a - b; }), lo = s[7], hi = s[17];
    return pr.map(function(v){ return v <= lo ? 'cheap' : v >= hi ? 'peak' : 'mid'; });
  }
  function hoursTxt(v){ if (!isFinite(v) || v <= 0) return '—'; var r = v >= 10 ? Math.round(v) : Math.round(v * 2) / 2; return '≈ ' + nf(r, r % 1 ? 1 : 0) + ' ' + plural(Math.round(r), 'година', 'години', 'годин'); }
  var liveDay = null;
  function updateHints(){
    var home = st.who === 'home', hint = $('#priceHint'); hint.textContent = '';
    if (home) {
      hint.textContent = (st.tariff === 'three' ? 'Тризонний: ніч 23:00–7:00 ×0,4 · пік 8–11 і 20–22 ×1,5 · решта ×1.' : 'Двозонний: ніч 23:00–7:00 ×0,5 · день ×1.') + ' Ціна для населення 4,32 ₴ з ПДВ діє до 31.10.2026.';
      $('#src').textContent = 'Тариф для населення · постанова КМУ про ПСО';
    } else {
      var mn = Math.min.apply(null, data.pr), mx = Math.max.apply(null, data.pr);
      var b = document.createElement('b'); b.textContent = 'Ціна енергії: ' + nf(mn, 2) + '–' + nf(mx, 2) + ' ₴/кВт·год'; hint.appendChild(b);
      hint.appendChild(document.createTextNode(' — середні погодинні ціни ринку «на добу наперед» за ' + periodText() + ' + передача ' + nf(B.TRANSMISSION, 2) + ' ₴, без ПДВ. Розподіл, послуги постачальника й ПДВ однакові щогодини — на економію майже не впливають, тому не додаємо.'));
      $('#src').textContent = 'РДН · ОЕС України · середнє за ' + periodText() + ' · АТ «Оператор ринку»' + (liveDay ? ' · оновлено онлайн' : '');
    }
    $('#kitnote').innerHTML = blockNote; $('#kitnote').hidden = !blockNote;
  }
  function updateResults(){
    var home = st.who === 'home', m = 30.4, late = isFinite(pb) && pb > wr.life;
    $('#lgAt').lastChild.textContent = home ? 'Рахунок без накопичувача' : 'Енергія без накопичувача';
    $('#lgBt').lastChild.textContent = home ? 'Рахунок з накопичувачем' : 'Енергія з накопичувачем';
    $('#rBillT').textContent = home ? 'Рахунок за місяць' : 'Енергія за місяць';
    $('#rBill').textContent = money(yr.dayBase * m) + ' → ' + money(yr.dayAfter * m);
    $('#rBillSub').textContent = home ? 'без накопичувача → з ним' : 'без → з накопичувачем · ринок + передача, без ПДВ';
    $('#rYear').textContent = money(yr.net, true); $('#rYearSub').textContent = home ? 'типова доба × 365' : 'доба за середніми цінами 30 днів × 365';
    $('#rInv').textContent = money(inv); $('#rPb').textContent = years(pb); $('#rBack').textContent = hoursTxt(back);
    var rs = $('#rPbSub'); rs.textContent = (late ? 'довше за ресурс батареї — ' : 'ресурс батареї ') + '≈ ' + nf(Math.round(wr.life)) + ' ' + plural(Math.round(wr.life), 'рік', 'роки', 'років') + ' · ' + nf(wr.cycles, 1) + ' цикл./добу';
    rs.classList.toggle('is-warn', late); $('#rPb').classList.toggle('is-warn', late);
    $('#saveDay').textContent = money(data.ec.net, true);
    $('#dcSeason').textContent = home ? 'Звичайний день · ' + (st.tariff === 'three' ? 'тризонний тариф' : 'двозонний тариф') : 'Доба за середніми цінами ' + periodText();
    $('#dcNet').textContent = money(data.ec.net, true); $('#dcYear').textContent = money(yr.net, true); $('#dcPb').textContent = years(pb); $('#dcBack').textContent = hoursTxt(back);
    var hn = $('#homenote');
    hn.textContent = home ? 'Для дому економія — це різниця між нічним і денним тарифом, тому окупність довга. Головна цінність — світло під час відключень: з повним зарядом ваш дім протримається ' + hoursTxt(back) + '.' : '';
    hn.classList.toggle('is-on', home);
    var hc = $('#howCycles'); if (hc) hc.textContent = nf(B.CYCLE_LIFE) + ' циклів';
  }
  function buildTable(){ var tb = $('#dayTable tbody'), e = data.ec; tb.textContent = ''; for (var h = 0; h < 24; h++) { var tr = document.createElement('tr'), cells = [(h < 10 ? '0' : '') + h + ':00', nf(data.pr[h], 2), eTxt(e.load[h]), eTxt(e.fromBat[h]), eTxt(e.toBat[h]), Math.round(data.sch.soc[h + 1] * 100)]; cells.forEach(function(c){ var td = document.createElement('td'); td.textContent = c; tr.appendChild(td); }); tb.appendChild(tr); } }
  function recompute(){
    resolve();
    data = B.day(st); levels = levelsOf(data.pr);
    yr = B.annual(st); inv = B.invest(st); pb = yr.net > 0 ? inv / yr.net : Infinity; back = B.backup(st); wr = B.wear(st, data.ec);
    bud = B.budget(st, cfg);
    viz.setData({ who: st.who, cfg: cfg, budget: bud, sch: data.sch, ec: data.ec, pr: data.pr, L: data.L, levels: levels, rte: st.rte });
    outputs(); updateHints(); updateResults(); drawBands(); energyScale(); buildTable(); buildCosts(); tweenPrice();
    document.dispatchEvent(new CustomEvent('calc:update', { detail: { who: st.who, cap: st.capIn, pow: st.powIn, cons: st.cons } }));
    S.save(Object.assign({}, st, { savedAt: Date.now(), day: data.ec.net, year: yr.net, inv: inv, pb: pb, backup: back, cycles: wr.cycles, life: wr.life, cfg: cfgText(cfg), periodText: st.who === 'home' ? '' : periodText() }));
    phase = 'day'; showCard(false); lastMode = '';
    T = RM ? 24 : 0; render(T);
  }
  window.__player = { jump: function(t){ T = t; phase = 'day'; showCard(false); lastMode = ''; render(T); }, state: function(){ return { T: T, phase: phase, playing: playing }; }, st: st, data: function(){ return data; } };

  renderRows(); syncRows(); recompute(); setPlayUI(); start();
  /* live data: the newest market day (optional) */
  if (window.DAM_LIVE) window.DAM_LIVE().then(function(r){ if (!r) return; liveDay = r.day; if (r.fresh && st.who !== 'home') recompute(); else updateHints(); });
})();
