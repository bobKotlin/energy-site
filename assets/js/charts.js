/* =====================================================================
   Cabinet charts — hand-drawn SVG in the calculator's style: thin marks,
   hairline grid, one y-scale per chart.
   strips() — a day or a week as three strips on one time axis: charge
              level (%), energy (given to the site up, taken from the grid
              down, kWh) and price (UAH/kWh), outages shaded, today's plan
              shown ahead of "now";
   bars()   — money per day or month around a zero line;
   plan()   — the 24 hours of «Економія».
   Each has a crosshair or per-mark tooltip on hover and keyboard focus;
   the tables beside them carry the same numbers.
   ===================================================================== */
window.Charts = (function(){
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', F = window.FLEET, d = document;
  var C = { chg: '#1A99AE', dis: '#80A430', soc: '#C9F25C', price: '#C9D2CD', grid: '#1B2420', axis: '#2B3631', tx: '#93A09A', out: 'rgba(231,180,92,.16)', neg: '#E7B45C', plan: 'rgba(147,160,154,.35)' };
  var DOW = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];
  function mk(t, a, p){ var e = d.createElementNS(NS, t); for (var k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function txt(p, x, y, s, anchor, fill){ var t = mk('text', { x: x, y: y, 'text-anchor': anchor || 'middle', 'font-family': 'JetBrains Mono, monospace', 'font-size': 10.5, fill: fill || C.tx }, p); t.textContent = s; return t; }
  function nice(v){ if (!(v > 0)) return 1; var e = Math.pow(10, Math.floor(Math.log10(v))), s = [1, 1.5, 2, 2.5, 3, 4, 5, 6, 8, 10]; for (var i = 0; i < s.length; i++) if (s[i] * e >= v * 1.04) return s[i] * e; return 10 * e; }
  function nf(v, dg){ return (+v).toLocaleString('uk-UA', { minimumFractionDigits: dg || 0, maximumFractionDigits: dg || 0 }); }
  function kwh(v){ return nf(v, Math.abs(v) < 10 ? 2 : 1); }
  function uah(v, sign){ var a = Math.abs(v), s = v < -.005 ? '−' : sign && v > .005 ? '+' : ''; return s + nf(a, a < 100 ? 2 : 0) + ' ₴'; }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function hm(t){ var L = F.local(t); return pad(L.h) + ':' + pad(L.m); }
  function clear(el){ while (el.firstChild) el.removeChild(el.firstChild); }

  /* one tooltip per chart host: values lead, labels follow, line keys for series */
  function tooltip(host){
    var el = d.createElement('div'); el.className = 'ctip'; el.setAttribute('role', 'status'); el.hidden = true; host.appendChild(el);
    return {
      show: function(x, y, head, rows){
        clear(el); var h = d.createElement('div'); h.className = 'ctip__h'; h.textContent = head; el.appendChild(h);
        rows.forEach(function(r){ var row = d.createElement('div'); row.className = 'ctip__r'; var k = d.createElement('i'); if (r.c) k.style.background = r.c; else k.className = 'none';
          var b = d.createElement('b'); b.textContent = r.v; var s = d.createElement('span'); s.textContent = r.l; row.append(k, b, s); el.appendChild(row); });
        el.hidden = false;
        var W = host.clientWidth, w = el.offsetWidth, left = x + 14 + w > W ? x - 14 - w : x + 14;
        el.style.left = Math.max(0, left) + 'px'; el.style.top = Math.max(0, y - 10) + 'px';
      },
      hide: function(){ el.hidden = true; }
    };
  }
  function sized(host, draw){
    var last = 0, raf = 0;
    function run(){ var w = Math.round(host.clientWidth); if (w && w !== last) { last = w; draw(w); } }
    if (window.ResizeObserver) new ResizeObserver(function(){ cancelAnimationFrame(raf); raf = requestAnimationFrame(run); }).observe(host);
    else window.addEventListener('resize', run);
    run();
    return function(){ last = 0; run(); };
  }

  /* ---------------- a day or a week ---------------- */
  function strips(host, v, opts){
    opts = opts || {};
    host.classList.add('chart');
    var wrap = d.createElement('div'); wrap.className = 'chart__svg'; host.appendChild(wrap);
    var tt = tooltip(host);
    return sized(wrap, function(W){
      clear(wrap);
      var s = v.series, n = s.length, step = v.size === 'q' ? F.STEP : F.HOUR, L = 46, R = 10, X0 = L, X1 = W - R;
      var t0 = v.from, t1 = v.to, span = t1 - t0, X = function(t){ return X0 + (t - t0) / span * (X1 - X0); }, bw = (X1 - X0) * step / span;
      var hS = opts.compact ? 44 : 58, hE = opts.compact ? 104 : 132, hP = opts.compact ? 46 : 60, g = 22;
      var yS0 = 16, yS1 = yS0 + hS, yE0 = yS1 + g, yE1 = yE0 + hE, yP0 = yE1 + g, yP1 = yP0 + hP, H = yP1 + 24;
      var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'chart__plot', role: 'img', 'aria-label': opts.label || 'Графік: рівень заряду, енергія й ціна' }, wrap);
      /* titles */
      txt(svg, X0, yS0 - 5, 'Рівень заряду, %', 'start');
      txt(svg, X0, yE0 - 5, 'Енергія за ' + (v.size === 'q' ? '15 хв' : 'годину') + ', кВт·год', 'start');
      txt(svg, X0, yP0 - 5, 'Ціна, ₴/кВт·год', 'start');
      /* outages and the plan ahead */
      var gb = mk('g', {}, svg);
      s.forEach(function(b){ if (b.out > 0) mk('rect', { x: X(b.t), y: yS0, width: Math.max(1, bw), height: yP1 - yS0, fill: C.out }, gb); });
      var planAhead = v.plan && v.now < t1 ? v.plan : null, dayStart = F.dayStart(v.day || F.dayOf(t0));
      if (planAhead) for (var h = 0; h < 24; h++) {
        var a = planAhead.act[h], ht = dayStart + h * F.HOUR; if (!a || ht + F.HOUR <= v.now) continue;
        var xa = X(Math.max(ht, v.now)), xb = X(ht + F.HOUR);
        mk('rect', { x: xa, y: yP0, width: Math.max(0, xb - xa), height: hP, fill: a === 'c' ? 'rgba(26,153,174,.16)' : 'rgba(128,164,48,.18)' }, gb);
      }
      /* SOC */
      [0, 50, 100].forEach(function(p){ var y = yS1 - p / 100 * hS; mk('line', { x1: X0, x2: X1, y1: y, y2: y, stroke: p ? C.grid : C.axis, 'stroke-width': 1 }, svg); txt(svg, X0 - 8, y + 4, String(p), 'end'); });
      if (opts.reserve) { var yr = yS1 - opts.reserve / 100 * hS; mk('line', { x1: X0, x2: X1, y1: yr, y2: yr, stroke: 'rgba(201,242,92,.35)', 'stroke-width': 1 }, svg); txt(svg, X1, yr - 3, 'резерв ' + opts.reserve + ' %', 'end'); }
      if (n) {
        var dS = '', dA = '';
        s.forEach(function(b, i){ var x = X(b.t + step), y = yS1 - b.soc * hS; dS += (i ? 'L' : 'M' + X(b.t).toFixed(1) + ' ' + y.toFixed(1) + 'L') + x.toFixed(1) + ' ' + y.toFixed(1); });
        dA = dS + 'V' + yS1 + 'H' + X(s[0].t).toFixed(1) + 'Z';
        mk('path', { d: dA, fill: 'rgba(201,242,92,.10)' }, svg);
        mk('path', { d: dS, fill: 'none', stroke: C.soc, 'stroke-width': 2, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      }
      /* energy: up — given to the site, down — taken from the grid */
      var up = 0, dn = 0; s.forEach(function(b){ if (b.dis > up) up = b.dis; if (b.chg > dn) dn = b.chg; });
      var top = nice(Math.max(up, dn * .25, .1)), bot = nice(Math.max(dn, up * .25, .1)), y0 = yE0 + hE * top / (top + bot);
      var yE = function(val){ return y0 - val / (top + bot) * hE; };
      mk('line', { x1: X0, x2: X1, y1: yE0, y2: yE0, stroke: C.grid, 'stroke-width': 1 }, svg); mk('line', { x1: X0, x2: X1, y1: yE1, y2: yE1, stroke: C.grid, 'stroke-width': 1 }, svg);
      txt(svg, X0 - 8, yE0 + 4, nf(top, top < 1 ? 2 : 1), 'end'); txt(svg, X0 - 8, yE1, nf(bot, bot < 1 ? 2 : 1), 'end'); txt(svg, X0 - 8, y0 + 4, '0', 'end');
      var bwid = Math.max(1, Math.min(24, bw - 2)), off = (bw - bwid) / 2, ge = mk('g', {}, svg);
      s.forEach(function(b){
        var x = X(b.t) + off;
        if (b.dis > .0005) { var yt = yE(b.dis), hh = y0 - yt; mk('path', { d: capUp(x, bwid, y0, yt, hh), fill: C.dis }, ge); }
        if (b.chg > .0005) { var yb = yE(-b.chg), h2 = yb - y0; mk('path', { d: capDown(x, bwid, y0, yb, h2), fill: C.chg }, ge); }
      });
      mk('line', { x1: X0, x2: X1, y1: y0, y2: y0, stroke: C.axis, 'stroke-width': 1 }, svg);
      /* price: what happened, then the rest of today's prices (dimmed) */
      var pr = s.map(function(b){ return { t: b.t, p: b.price }; }), ahead = [];
      if (v.plan && v.now < t1) for (var k = 0; k < 24; k++) { var tt0 = dayStart + k * F.HOUR; if (tt0 + F.HOUR > v.now) ahead.push({ t: Math.max(tt0, F.floorStep(v.now) + F.STEP), e: tt0 + F.HOUR, p: v.plan.price[k] }); }
      var pmax = 0; pr.concat(ahead).forEach(function(x){ if (x.p > pmax) pmax = x.p; }); pmax = nice(pmax || 1);
      var yP = function(p){ return yP1 - p / pmax * hP; };
      [0, .5, 1].forEach(function(f){ var y = yP1 - f * hP; mk('line', { x1: X0, x2: X1, y1: y, y2: y, stroke: f ? C.grid : C.axis, 'stroke-width': 1 }, svg); txt(svg, X0 - 8, y + 4, nf(pmax * f, pmax * f % 1 ? 1 : 0), 'end'); });
      function stepPath(arr, endOf){ var p = ''; arr.forEach(function(x, i){ p += (i ? 'L' + X(x.t).toFixed(1) + ' ' + yP(x.p).toFixed(1) : 'M' + X(x.t).toFixed(1) + ' ' + yP(x.p).toFixed(1)) + 'H' + X(endOf(x)).toFixed(1); }); return p; }
      if (pr.length) mk('path', { d: stepPath(pr, function(x){ return x.t + step; }), fill: 'none', stroke: C.price, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
      if (ahead.length) mk('path', { d: stepPath(ahead, function(x){ return x.e; }), fill: 'none', stroke: C.plan, 'stroke-width': 2, 'stroke-linejoin': 'round' }, svg);
      /* x axis */
      var ga = mk('g', {}, svg);
      if (v.size === 'q') for (var hh2 = 0; hh2 <= 24; hh2 += 3) { var xt = X(dayStart + hh2 * F.HOUR); if (xt < X0 - 1 || xt > X1 + 1) continue; txt(ga, xt, H - 6, pad(hh2 % 24 === 0 && hh2 ? 24 : hh2) + ':00', hh2 === 0 ? 'start' : hh2 === 24 ? 'end' : 'middle'); }
      else for (var dd = 0; dd < 7; dd++) { var ds = F.dayStart(F.addDays(F.dayOf(t0 + 12 * F.HOUR), dd)), xd = X(ds); if (xd > X1) break;
        if (dd) mk('line', { x1: xd, x2: xd, y1: yS0, y2: yP1, stroke: C.grid, 'stroke-width': 1 }, ga); var Ld = F.local(ds + 12 * F.HOUR); txt(ga, xd + (X(ds + F.DAY) - xd) / 2, H - 6, DOW[Ld.dow] + ' ' + Ld.date); }
      /* now */
      if (v.now > t0 && v.now < t1) { var xn = X(v.now); mk('line', { x1: xn, x2: xn, y1: yS0 - 2, y2: yP1, stroke: 'rgba(234,240,236,.45)', 'stroke-width': 1 }, svg); txt(svg, xn, yS0 - 5, 'зараз', xn > X1 - 30 ? 'end' : 'middle', '#EAF0EC'); }
      /* hover / focus: crosshair snaps to the bucket */
      var cross = mk('line', { y1: yS0, y2: yP1, stroke: 'rgba(234,240,236,.6)', 'stroke-width': 1, visibility: 'hidden' }, svg);
      var hit = mk('rect', { x: X0, y: yS0, width: X1 - X0, height: yP1 - yS0, fill: 'transparent', tabindex: 0, 'aria-label': 'Наведіть або гортайте стрілками, щоб побачити значення' }, svg), cur = -1;
      function at(i, px){
        if (i < 0 || i >= n) { cross.setAttribute('visibility', 'hidden'); tt.hide(); return; }
        cur = i; var b = s[i], x = X(b.t) + bw / 2; cross.setAttribute('x1', x); cross.setAttribute('x2', x); cross.setAttribute('visibility', 'visible');
        var head = v.size === 'q' ? hm(b.t) + '–' + hm(b.t + step) : (function(){ var Lb = F.local(b.t); return DOW[Lb.dow] + ' ' + Lb.date + ', ' + pad(Lb.h) + ':00–' + pad((Lb.h + 1) % 24) + ':00'; })();
        var rows = [{ v: nf(b.soc * 100) + ' %', l: 'рівень заряду', c: C.soc }];
        if (b.dis > .0005) rows.push({ v: kwh(b.dis) + ' кВт·год', l: b.out ? 'віддав під час відключення' : 'віддав об’єкту', c: C.dis });
        if (b.chg > .0005) rows.push({ v: kwh(b.chg) + ' кВт·год', l: 'узяв з мережі', c: C.chg });
        rows.push({ v: nf(b.price, 2) + ' ₴', l: 'ціна кВт·год', c: C.price });
        if (b.out) rows.push({ v: 'немає мережі', l: '', c: C.neg });
        else if (b.profit) rows.push({ v: uah(b.profit, true), l: b.profit > 0 ? 'заощадив' : 'заплатив за заряд' });
        tt.show(px != null ? px : x, yE0, head, rows);
      }
      function idx(e){ var r = svg.getBoundingClientRect(), x = (e.clientX - r.left) * W / r.width; return { i: Math.floor((x - X0) / bw), x: x }; }
      hit.addEventListener('pointermove', function(e){ var p = idx(e); at(p.i, p.x); });
      hit.addEventListener('pointerleave', function(){ at(-1); });
      hit.addEventListener('focus', function(){ at(cur >= 0 ? cur : n - 1); });
      hit.addEventListener('blur', function(){ at(-1); });
      hit.addEventListener('keydown', function(e){ if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') { e.preventDefault(); at(Math.max(0, Math.min(n - 1, (cur < 0 ? n - 1 : cur) + (e.key === 'ArrowLeft' ? -1 : 1)))); } });
    });
  }
  function capUp(x, w, yb, yt, h){ if (h < .5) return ''; var r = Math.min(3, h, w / 2); return 'M' + x + ' ' + yb + 'V' + (yt + r) + 'Q' + x + ' ' + yt + ' ' + (x + r) + ' ' + yt + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + yt + ' ' + (x + w) + ' ' + (yt + r) + 'V' + yb + 'Z'; }
  function capDown(x, w, yt, yb, h){ if (h < .5) return ''; var r = Math.min(3, h, w / 2); return 'M' + x + ' ' + yt + 'V' + (yb - r) + 'Q' + x + ' ' + yb + ' ' + (x + r) + ' ' + yb + 'H' + (x + w - r) + 'Q' + (x + w) + ' ' + yb + ' ' + (x + w) + ' ' + (yb - r) + 'V' + yt + 'Z'; }

  /* ---------------- money per day / month ---------------- */
  function bars(host, items, opts){
    opts = opts || {};
    host.classList.add('chart');
    var wrap = d.createElement('div'); wrap.className = 'chart__svg'; host.appendChild(wrap);
    var tt = tooltip(host);
    return sized(wrap, function(W){
      clear(wrap);
      var n = items.length, L = 52, R = 10, X0 = L, X1 = W - R, H = opts.height || 190, yT = 14, yB = H - 26;
      var svg = mk('svg', { viewBox: '0 0 ' + W + ' ' + H, width: W, height: H, class: 'chart__plot', role: 'img', 'aria-label': opts.label || 'Прибуток за період' }, wrap);
      var mx = 0, mn = 0; items.forEach(function(it){ if (it.profit > mx) mx = it.profit; if (it.profit < mn) mn = it.profit; });
      var top = nice(Math.max(mx, -mn * .2, 1)), bot = mn < 0 ? nice(-mn) : 0, y0 = yT + (yB - yT) * top / (top + bot);
      var yv = function(val){ return y0 - val / (top + bot) * (yB - yT); };
      [top, top / 2].forEach(function(val){ var y = yv(val); mk('line', { x1: X0, x2: X1, y1: y, y2: y, stroke: C.grid, 'stroke-width': 1 }, svg); txt(svg, X0 - 8, y + 4, nf(val), 'end'); });
      if (bot) { var yb = yv(-bot); mk('line', { x1: X0, x2: X1, y1: yb, y2: yb, stroke: C.grid, 'stroke-width': 1 }, svg); if (yb - y0 > 14) txt(svg, X0 - 8, yb + 4, '−' + nf(bot), 'end'); }
      txt(svg, X0 - 8, y0 + 4, '0', 'end');
      var slot = (X1 - X0) / Math.max(1, n), bw = Math.max(2, Math.min(24, slot - 2)), every = Math.ceil(n / Math.max(1, Math.floor((X1 - X0) / 46)));
      var marks = [];
      items.forEach(function(it, i){
        var x = X0 + i * slot + (slot - bw) / 2, v = it.profit, g = mk('g', { tabindex: 0, class: 'chart__bar', 'aria-label': (it.label || '') + ': ' + uah(v, true) }, svg);
        mk('rect', { x: X0 + i * slot, y: yT, width: slot, height: yB - yT, fill: 'transparent' }, g);
        if (v >= 0) mk('path', { d: capUp(x, bw, y0, yv(v), y0 - yv(v)), fill: C.dis }, g); else mk('path', { d: capDown(x, bw, y0, yv(v), yv(v) - y0), fill: C.neg }, g);
        if (i % every === 0) txt(svg, X0 + i * slot + slot / 2, H - 8, it.short || it.label || '', 'middle');
        function show(){ var rows = [{ v: uah(v, true), l: v >= 0 ? 'заощадив' : 'витратив більше, ніж заощадив', c: v >= 0 ? C.dis : C.neg }];
          if (it.chg) rows.push({ v: kwh(it.chg) + ' кВт·год' + (it.buyAvg != null ? ' · ' + nf(it.buyAvg, 2) + ' ₴' : ''), l: 'купив', c: C.chg });
          if (it.dis) rows.push({ v: kwh(it.dis) + ' кВт·год' + (it.sellAvg != null ? ' · ' + nf(it.sellAvg, 2) + ' ₴' : ''), l: 'віддав', c: C.dis });
          if (it.outH) rows.push({ v: nf(it.outH, it.outH % 1 ? 1 : 0) + ' год', l: 'без мережі', c: C.neg });
          tt.show(x + bw / 2, yT, it.label || '', rows); }
        g.addEventListener('pointerenter', show); g.addEventListener('focus', show);
        g.addEventListener('pointerleave', function(){ tt.hide(); }); g.addEventListener('blur', function(){ tt.hide(); });
        if (opts.onPick) g.addEventListener('click', function(){ opts.onPick(it); });
        marks.push(g);
      });
      mk('line', { x1: X0, x2: X1, y1: y0, y2: y0, stroke: C.axis, 'stroke-width': 1 }, svg);
    });
  }

  /* ---------------- the 24 hours of «Економія» ---------------- */
  function plan(host, pl, opts){
    opts = opts || {};
    clear(host); host.classList.add('tou');
    var row = d.createElement('div'); row.className = 'tou__row'; host.appendChild(row);
    var tt = tooltip(host), nowH = opts.now != null && F.dayOf(opts.now) === pl.day ? F.local(opts.now).h : -1;
    for (var h = 0; h < 24; h++) (function(h){
      var c = d.createElement('button'); c.type = 'button'; c.className = 'tou__h' + (pl.act[h] === 'c' ? ' is-c' : pl.act[h] === 'd' ? ' is-d' : '') + (h === nowH ? ' is-now' : '') + (nowH > h ? ' is-past' : '');
      c.setAttribute('aria-label', pad(h) + ':00 — ' + (pl.act[h] === 'c' ? 'заряд' : pl.act[h] === 'd' ? 'віддача' : 'очікування') + ', ' + nf(pl.price[h], 2) + ' ₴');
      function show(){ tt.show(c.offsetLeft + c.offsetWidth / 2, 0, pad(h) + ':00–' + pad((h + 1) % 24 || 24) + ':00', [
        { v: pl.act[h] === 'c' ? 'заряд від мережі' : pl.act[h] === 'd' ? 'віддача об’єкту' : 'очікування', l: '', c: pl.act[h] === 'c' ? C.chg : pl.act[h] === 'd' ? C.dis : null },
        { v: nf(pl.price[h], 2) + ' ₴', l: 'ціна кВт·год', c: C.price }]); }
      c.addEventListener('pointerenter', show); c.addEventListener('focus', show);
      c.addEventListener('pointerleave', function(){ tt.hide(); }); c.addEventListener('blur', function(){ tt.hide(); });
      row.appendChild(c);
    })(h);
    var ax = d.createElement('div'); ax.className = 'tou__ax';
    [0, 6, 12, 18, 24].forEach(function(h){ var s = d.createElement('span'); s.textContent = pad(h) + ':00'; ax.appendChild(s); });
    host.appendChild(ax);
  }

  return { strips: strips, bars: bars, plan: plan, C: C };
})();
