/* =====================================================================
   DayFlow — the day of a site that runs through a storage, kept simple:
   three nodes (grid · station · site) and glowing energy particles
   between them. The station is a capsule of "liquid" charge with a moving
   surface; bubbles rise while it charges. The background follows the
   clock, the strip at the bottom shows cheap / expensive hours (click to
   jump). Canvas draws the light (background, glows, particles), SVG the
   crisp shapes and text. Driven by the calculator's player via update().
   ===================================================================== */
window.DayFlow = (function(){
  'use strict';
  var NS = 'http://www.w3.org/2000/svg', RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches, uid = 0;
  var RGB = { cyan: [87, 217, 232], volt: [201, 242, 92], grid: [214, 222, 218], warm: [231, 180, 92], dim: [124, 137, 131] };
  var LEVEL = { cheap: 'cyan', mid: 'dim', peak: 'warm' };
  function E(t, a, p){ var e = document.createElementNS(NS, t); for (var k in a) if (a[k] != null) e.setAttribute(k, a[k]); if (p) p.appendChild(e); return e; }
  function T(p, x, y, s, a){ var t = E('text', Object.assign({ x: x, y: y }, a || {}), p); t.textContent = s; return t; }
  function clear(g){ while (g.firstChild) g.removeChild(g.firstChild); }
  function rgba(c, a){ return 'rgba(' + c[0] + ',' + c[1] + ',' + c[2] + ',' + a.toFixed(3) + ')'; }
  function nf(n, d){ return (+n).toLocaleString('uk-UA', { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); }
  function kwTxt(v){ return v >= 1000 ? nf(v / 1000, v >= 10000 ? 0 : 1) + ' МВт' : nf(v, v < 10 ? 1 : 0) + ' кВт'; }
  function lerp(a, b, t){ return a + (b - a) * t; }
  function mixC(a, b, t){ return [lerp(a[0], b[0], t), lerp(a[1], b[1], t), lerp(a[2], b[2], t)]; }
  function hex(h){ var n = parseInt(h.slice(1), 16); return [n >> 16, (n >> 8) & 255, n & 255]; }
  /* background by the clock: top and bottom colours */
  var BG = [[0, '#060A12', '#090C0B'], [5.5, '#070B13', '#0A0D0C'], [7.2, '#0F1719', '#0C100F'], [12, '#11201F', '#0D1211'], [17.5, '#131B1A', '#0D110F'], [19.6, '#1A1512', '#0C0F0E'], [21, '#080C13', '#090C0B'], [24, '#060A12', '#090C0B']];
  function bgAt(t){ for (var i = 0; i < BG.length - 1; i++) if (t >= BG[i][0] && t <= BG[i + 1][0]) { var k = (t - BG[i][0]) / (BG[i + 1][0] - BG[i][0]); return [mixC(hex(BG[i][1]), hex(BG[i + 1][1]), k), mixC(hex(BG[i][2]), hex(BG[i + 1][2]), k)]; } return [hex(BG[0][1]), hex(BG[0][2])]; }
  function stationKey(cfg){ return cfg.kind === 'home' ? 'homeModule' : cfg.kind === 'cabinet' ? 'cabinet' : 'container'; }
  function invKey(cfg){ return cfg.kind === 'container' ? 'pcs' : cfg.kind === 'home' ? 'hybridInverter' : null; }
  /* a quadratic curve sampled into points with running length */
  function curve(x0, y0, cx, cy, x1, y1){
    var pts = [], L = [0], n = 64, i;
    for (i = 0; i <= n; i++) { var t = i / n, u = 1 - t; pts.push([u * u * x0 + 2 * u * t * cx + t * t * x1, u * u * y0 + 2 * u * t * cy + t * t * y1]); if (i) L.push(L[i - 1] + Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1])); }
    return { pts: pts, L: L, len: L[n], d: 'M' + x0 + ' ' + y0 + ' Q' + cx + ' ' + cy + ' ' + x1 + ' ' + y1 };
  }
  function at(c, t){
    var s = t * c.len, L = c.L, lo = 0, hi = L.length - 1;
    while (hi - lo > 1) { var m = (lo + hi) >> 1; if (L[m] < s) lo = m; else hi = m; }
    var k = L[hi] > L[lo] ? (s - L[lo]) / (L[hi] - L[lo]) : 0, a = c.pts[lo], b = c.pts[hi];
    return [a[0] + (b[0] - a[0]) * k, a[1] + (b[1] - a[1]) * k, b[0] - a[0], b[1] - a[1]];
  }

  function create(el){
    var id = 'df' + (++uid), cv = document.createElement('canvas'), ctx = cv.getContext('2d');
    var svg = E('svg', { class: 'viz df', role: 'img', 'aria-label': 'Доба об’єкта з накопичувачем: мережа, станція й об’єкт' }), card = document.createElement('div');
    cv.className = 'df-fx'; card.className = 'pcard pcard--viz'; card.setAttribute('role', 'status');
    el.appendChild(cv); el.appendChild(svg); el.appendChild(card);
    var api = { onHover: null, onSeek: null }, data = null, st = { T: 0, h: 0, soc: .1, gh: 0, gb: 0, bh: 0, level: 'mid', price: 0 };
    var W = 0, H = 0, DPR = 1, S = null, hot = null, pinned = null, visible = true, raf = 0, last = 0, clock = 0, seed = 7;
    function rnd(){ seed = (seed * 9301 + 49297) % 233280; return seed / 233280; }

    function build(){
      var r = el.getBoundingClientRect(); W = Math.max(300, Math.round(r.width)); H = Math.max(320, Math.round(r.height));
      DPR = Math.min(2, window.devicePixelRatio || 1); cv.width = Math.round(W * DPR); cv.height = Math.round(H * DPR); cv.style.width = W + 'px'; cv.style.height = H + 'px';
      svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H); svg.setAttribute('width', W); svg.setAttribute('height', H); clear(svg);
      S = data ? scene() : null; if (S) frame(0); if (hot) mark(hot);
    }

    /* ---------------- the scene ---------------- */
    function scene(){
      var narrow = W < 620, top = narrow ? 186 : 124, bot = 66, o = { flows: {} };
      var R = narrow ? 30 : Math.max(40, Math.min(58, W * .05));
      var y1 = top + R + (narrow ? 18 : 26), gx = W * (narrow ? .16 : .15), sx = W * (narrow ? .84 : .85), bx = W / 2;
      var bw = narrow ? 76 : Math.max(88, Math.min(124, W * .1)), by = y1 + R * .35;
      var bh = Math.max(130, Math.min(narrow ? 190 : 250, H - bot - 76 - by));
      o.R = R; o.y1 = y1; o.gx = gx; o.sx = sx; o.bx = bx; o.bw = bw; o.by = by; o.bh = bh; o.narrow = narrow;
      var defs = E('defs', {}, svg);
      var lg = E('linearGradient', { id: id + 'liq', x1: 0, y1: 1, x2: 0, y2: 0 }, defs); E('stop', { offset: '0%', 'stop-color': '#6E9A26' }, lg); E('stop', { offset: '100%', 'stop-color': '#C9F25C' }, lg);
      var cp = E('clipPath', { id: id + 'cap' }, defs), rx = Math.min(bw * .3, 30);
      E('rect', { x: bx - bw / 2 + 5, y: by + 5, width: bw - 10, height: bh - 10, rx: rx - 4 }, cp);
      /* energy paths: grid → site straight over the station, grid → station, station → site */
      o.flows.gd = Object.assign(curve(gx + R + 6, y1, bx, y1 - (narrow ? 26 : 40), sx - R - 6, y1), { c: 'grid', parts: [], acc: 0, on: 0 });
      o.flows.gs = Object.assign(curve(gx + R * .74, y1 + R * .7, gx + (bx - gx) * .5, by + bh * .34, bx - bw / 2 - 5, by + bh * .34), { c: 'cyan', parts: [], acc: 0, on: 0 });
      o.flows.bs = Object.assign(curve(bx + bw / 2 + 5, by + bh * .34, sx - (sx - bx) * .5, by + bh * .34, sx - R * .74, y1 + R * .7), { c: 'volt', parts: [], acc: 0, on: 0 });
      Object.keys(o.flows).forEach(function(k){ E('path', { d: o.flows[k].d, class: 'df-rail' }, svg); });

      /* grid node */
      var gG = E('g', { class: 'df-node' }, svg);
      o.gRing = E('circle', { cx: gx, cy: y1, r: R, class: 'df-disc' }, gG);
      var s = R / 40, px = function(x){ return (gx + x * s).toFixed(1); }, py = function(y){ return (y1 + y * s).toFixed(1); };
      E('path', { d: 'M' + px(-11) + ' ' + py(20) + 'L' + px(-3) + ' ' + py(-20) + 'H' + px(3) + 'L' + px(11) + ' ' + py(20) + 'M' + px(-7) + ' ' + py(0) + 'H' + px(7) + 'M' + px(-17) + ' ' + py(-12) + 'H' + px(17) + 'M' + px(-9) + ' ' + py(10) + 'L' + px(6) + ' ' + py(-2) + 'M' + px(9) + ' ' + py(10) + 'L' + px(-6) + ' ' + py(-2), class: 'df-ico' }, gG);
      T(gG, gx, y1 + R + 20, 'Мережа', { class: 'df-t', 'text-anchor': 'middle' });
      o.gVal = T(gG, gx, y1 + R + 38, '', { class: 'df-v', 'text-anchor': 'middle' });

      /* site node: house / shop / plant */
      var sG = E('g', { class: 'df-node', 'data-key': 'meter' }, svg);
      o.sRing = E('circle', { cx: sx, cy: y1, r: R, class: 'df-disc' }, sG);
      var qx = function(x){ return (sx + x * s).toFixed(1); }, qy = function(y){ return (y1 + y * s).toFixed(1); }, win = [];
      if (data.who === 'home') {
        E('path', { d: 'M' + qx(-18) + ' ' + qy(-2) + 'L' + qx(0) + ' ' + qy(-18) + 'L' + qx(18) + ' ' + qy(-2) + 'M' + qx(-14) + ' ' + qy(-5) + 'V' + qy(17) + 'H' + qx(14) + 'V' + qy(-5), class: 'df-ico' }, sG);
        win.push([-9, 1, 7, 6], [2, 1, 7, 6]); E('path', { d: 'M' + qx(-3) + ' ' + qy(17) + 'V' + qy(10) + 'H' + qx(3) + 'V' + qy(17), class: 'df-ico' }, sG);
      } else if (data.who === 'biz') {
        E('path', { d: 'M' + qx(-18) + ' ' + qy(-14) + 'H' + qx(18) + 'L' + qx(20) + ' ' + qy(-6) + 'H' + qx(-20) + 'Z M' + qx(-16) + ' ' + qy(-6) + 'V' + qy(17) + 'H' + qx(16) + 'V' + qy(-6), class: 'df-ico' }, sG);
        win.push([-12, -1, 13, 9], [4, -1, 8, 18]);
      } else {
        E('path', { d: 'M' + qx(-20) + ' ' + qy(17) + 'V' + qy(-3) + 'L' + qx(-10) + ' ' + qy(-10) + 'V' + qy(-3) + 'L' + qx(0) + ' ' + qy(-10) + 'V' + qy(-3) + 'L' + qx(10) + ' ' + qy(-10) + 'V' + qy(17) + 'Z M' + qx(13) + ' ' + qy(17) + 'V' + qy(-20) + 'H' + qx(18) + 'V' + qy(17), class: 'df-ico' }, sG);
        win.push([-16, 3, 6, 5], [-7, 3, 6, 5], [2, 3, 6, 5]);
        o.smoke = []; for (var k2 = 0; k2 < 3; k2++) o.smoke.push(E('circle', { cx: qx(15.5), cy: qy(-21), r: 2, class: 'df-smoke' }, sG));
        o.smX = sx + 15.5 * s; o.smY = y1 - 21 * s; o.s = s;
      }
      o.wins = win.map(function(w){ return E('rect', { x: qx(w[0]), y: qy(w[1]), width: (w[2] * s).toFixed(1), height: (w[3] * s).toFixed(1), rx: 1.5, class: 'df-win' }, sG); });
      T(sG, sx, y1 + R + 20, data.who === 'home' ? 'Ваш дім' : data.who === 'biz' ? 'Ваш бізнес' : 'Підприємство', { class: 'df-t', 'text-anchor': 'middle' });
      o.sVal = T(sG, sx, y1 + R + 38, '', { class: 'df-v', 'text-anchor': 'middle' });

      /* station: a capsule of liquid charge */
      var bG = E('g', { class: 'df-bat', 'data-key': stationKey(data.cfg) }, svg);
      o.cap = E('rect', { x: bx - bw / 2, y: by, width: bw, height: bh, rx: rx, class: 'df-cap' }, bG);
      var liq = E('g', { 'clip-path': 'url(#' + id + 'cap)' }, bG);
      E('rect', { x: bx - bw / 2, y: by, width: bw, height: bh, class: 'df-well' }, liq);
      o.back = E('path', { class: 'df-liq2' }, liq); o.front = E('path', { fill: 'url(#' + id + 'liq)', class: 'df-liq' }, liq);
      o.bub = []; for (var b = 0; b < 9; b++) o.bub.push({ el: E('circle', { r: 1.4 + rnd() * 2.2, class: 'df-bub' }, liq), x: rnd(), t: rnd(), v: .25 + rnd() * .35 });
      o.pct = T(bG, bx, by + bh / 2 + (narrow ? 8 : 12), '0 %', { class: 'df-pct', 'text-anchor': 'middle' });
      if (!narrow) o.pct.setAttribute('font-size', Math.round(Math.min(40, bw * .34)));
      var stn = data.cfg, nmods = stn.items.filter(function(x){ return x.key === stationKey(stn); })[0];
      T(bG, bx, by + bh + 22, (narrow ? 'Станція' : 'Накопичувач') + ' · ' + capTxt(stn.cap) + (nmods && nmods.qty > 1 && stn.kind !== 'home' ? ' · ' + nmods.qty + ' шт' : ''), { class: 'df-t', 'text-anchor': 'middle' });
      o.bVal = T(bG, bx, by + bh + 40, '', { class: 'df-v', 'text-anchor': 'middle' });
      var ik = invKey(stn); if (ik) { var ig = E('g', { class: 'df-chip', 'data-key': ik }, svg); o.inv = T(ig, bx, by + bh + 58, 'інвертор ' + kwTxt(stn.pow), { class: 'df-t df-t--chip', 'text-anchor': 'middle' }); }

      /* strip: cheap / normal / expensive hours; click to jump */
      var sx0 = 16, sx1 = W - 16, sw = (sx1 - sx0) / 24, sy = H - 28, stp = E('g', { class: 'df-strip' }, svg);
      o.cells = [];
      for (var hh = 0; hh < 24; hh++) {
        var cg = E('g', { 'data-seek': hh, class: 'df-cell' }, stp);
        E('rect', { x: sx0 + hh * sw, y: sy - 12, width: sw, height: 30, fill: 'transparent' }, cg);
        o.cells.push(E('rect', { x: sx0 + hh * sw + 1, y: sy, width: sw - 2, height: 6, rx: 3, class: 'df-lv df-lv--' + data.levels[hh] }, cg));
        var act = data.sch.chg[hh] > 1e-6 ? 'c' : data.sch.dis[hh] > 1e-6 ? 'd' : '';
        if (act) E('circle', { cx: sx0 + hh * sw + sw / 2, cy: sy - 6, r: 1.8, class: 'df-act df-act--' + act }, cg);
      }
      [0, 6, 12, 18, 24].forEach(function(t){ T(stp, sx0 + t * sw, sy + 20, (t < 10 ? '0' : '') + t + ':00', { class: 'df-tick', 'text-anchor': t === 0 ? 'start' : t === 24 ? 'end' : 'middle' }); });
      o.head = E('g', { class: 'df-head' }, stp); E('circle', { r: 5, class: 'df-headdot' }, o.head);
      o.sunG = E('g', {}, o.head); for (var ry = 0; ry < 8; ry++) { var a = ry / 8 * Math.PI * 2; E('line', { x1: (Math.cos(a) * 7.5).toFixed(1), y1: (Math.sin(a) * 7.5).toFixed(1), x2: (Math.cos(a) * 10).toFixed(1), y2: (Math.sin(a) * 10).toFixed(1), class: 'df-ray' }, o.sunG); }
      o.sx0 = sx0; o.sw = sw; o.sy = sy;
      return o;
    }
    function capTxt(c){ return c >= 1000 ? nf(c / 1000, c % 1000 ? 2 : 0) + ' МВт·год' : nf(c, c % 1 ? 2 : 0) + ' кВт·год'; }
    function set(t, s){ if (t.textContent !== s) t.textContent = s; }

    /* ---------------- per frame ---------------- */
    function frame(dt){
      if (!S || !data) return; var o = S, t = Math.min(24, st.T), P = data.pmax || 1, mL = data.maxL || 1;
      clock += dt;
      var mode = st.gb > 1e-6 ? 'chg' : st.bh > 1e-6 ? 'dis' : 'idle', act = Math.min(1, Math.max(st.gb / P, st.bh / mL));
      /* canvas: background, glows, rails, particles */
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0); ctx.globalCompositeOperation = 'source-over';
      var bg = bgAt(t), g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, rgba(bg[0], 1)); g.addColorStop(1, rgba(bg[1], 1)); ctx.fillStyle = g; ctx.fillRect(0, 0, W, H);
      ctx.globalCompositeOperation = 'lighter';
      var pulse = .5 + .5 * Math.sin(clock * 2.2), bc = mode === 'chg' ? RGB.cyan : mode === 'dis' ? RGB.volt : RGB.dim;
      glow(o.bx, o.by + o.bh * .55, Math.max(o.bw, o.bh) * 1.25, bc, (mode === 'idle' ? .05 : .1 + .08 * act) + .03 * pulse);
      glow(o.gx, o.y1, o.R * 2.4, RGB[LEVEL[st.level]] || RGB.dim, .07 + (st.level === 'peak' ? .05 * pulse : 0));
      glow(o.sx, o.y1, o.R * 2.4, RGB.warm, .03 + .1 * Math.min(1, (st.gh + st.bh) / mL));
      var want = { gd: st.gh / mL, gs: st.gb / P, bs: st.bh / mL };
      Object.keys(o.flows).forEach(function(k){
        var f = o.flows[k], r = Math.min(1, want[k] || 0), c = RGB[f.c];
        f.on += ((r > 1e-4 ? 1 : 0) - f.on) * Math.min(1, dt ? dt * 4 : 1);
        if (f.on > .02) { ctx.strokeStyle = rgba(c, .16 * f.on); ctx.lineWidth = 2; ctx.stroke(f.p2 || (f.p2 = new Path2D(f.d))); }
        if (!RM && r > 1e-4) { f.acc += dt * (4 + 14 * r); while (f.acc >= 1) { f.acc -= 1; f.parts.push({ t: 0, v: (.5 + .55 * r) * (.85 + rnd() * .3), r: 1.7 + rnd() * 1.3 + .9 * r, j: (rnd() - .5) * 4 }); } }
        for (var i = f.parts.length - 1; i >= 0; i--) {
          var q = f.parts[i]; q.t += dt * q.v; if (q.t >= 1 || f.on < .02) { f.parts.splice(i, 1); continue; }
          var p = at(f, q.t), nl = Math.hypot(p[2], p[3]) || 1, x = p[0] - p[3] / nl * q.j, y = p[1] + p[2] / nl * q.j, a = Math.min(1, Math.sin(Math.PI * q.t) * 1.6) * f.on;
          ctx.fillStyle = rgba(c, .13 * a); ctx.beginPath(); ctx.arc(x, y, q.r * 3.2, 0, 6.2832); ctx.fill();
          for (var k = 1; k <= 3; k++) { var pt = at(f, Math.max(0, q.t - k * .018)); ctx.fillStyle = rgba(c, .32 * a / k); ctx.beginPath(); ctx.arc(pt[0], pt[1], q.r * (1 - k * .18), 0, 6.2832); ctx.fill(); }
          ctx.fillStyle = rgba(c, .95 * a); ctx.beginPath(); ctx.arc(x, y, q.r, 0, 6.2832); ctx.fill();
        }
      });
      if (RM) Object.keys(o.flows).forEach(function(k){ var f = o.flows[k], r = want[k] || 0; if (r > 1e-4) { ctx.strokeStyle = rgba(RGB[f.c], .7); ctx.lineWidth = 2.4; ctx.stroke(f.p2 || (f.p2 = new Path2D(f.d))); } });
      /* station: liquid level with a moving surface, bubbles while charging */
      var x0 = o.bx - o.bw / 2 + 5, x1 = o.bx + o.bw / 2 - 5, yT = o.by + 5, yB = o.by + o.bh - 5, lv = yB - (yB - yT) * st.soc;
      var amp = 2.2 + 3.6 * act, ph = clock * (1.6 + 2.4 * act);
      o.front.setAttribute('d', wave(x0, x1, lv, yB, amp, ph, 1));
      o.back.setAttribute('d', wave(x0, x1, lv - 2, yB, amp * .8, ph * 1.3 + 1.7, 1.4));
      o.cap.setAttribute('data-m', mode);
      o.bub.forEach(function(b){
        if (mode === 'chg' && !RM) { b.t += dt * b.v; if (b.t > 1) { b.t = 0; b.x = rnd(); } }
        var by = yB - (yB - lv) * b.t, on = mode === 'chg' && by > lv + 3;
        b.el.setAttribute('cx', (x0 + 6 + (x1 - x0 - 12) * b.x + Math.sin(clock * 3 + b.x * 9) * 2).toFixed(1)); b.el.setAttribute('cy', by.toFixed(1)); b.el.style.opacity = on ? (.5 * (1 - b.t) + .2).toFixed(2) : 0;
      });
      set(o.pct, Math.round(st.soc * 100) + ' %');
      set(o.bVal, mode === 'chg' ? 'заряджається · ' + kwTxt(st.gb) : mode === 'dis' ? 'живить ' + (data.who === 'home' ? 'дім' : 'об’єкт') + ' · ' + kwTxt(st.bh) : 'чекає');
      o.bVal.setAttribute('data-m', mode);
      /* nodes */
      set(o.gVal, nf(st.price, 2) + ' ₴ · ' + (st.level === 'cheap' ? 'дешево' : st.level === 'peak' ? 'дорого' : 'звичайно'));
      o.gVal.setAttribute('data-l', st.level); o.gRing.setAttribute('data-l', st.level);
      var use = st.gh + st.bh, busy = Math.min(1, use / mL);
      set(o.sVal, 'споживає ' + kwTxt(use));
      o.wins.forEach(function(w){ w.style.fill = rgba(RGB.warm, .12 + .78 * busy); });
      o.sRing.style.stroke = rgba(RGB.warm, .18 + .5 * busy);
      if (o.smoke) o.smoke.forEach(function(c, i){ var k = (clock * .5 + i / 3) % 1; c.setAttribute('cy', (o.smY - k * 16 * o.s).toFixed(1)); c.setAttribute('r', (1.5 + k * 3.5 * o.s).toFixed(1)); c.style.opacity = ((1 - k) * .55 * busy).toFixed(2); });
      /* strip */
      var hx = o.sx0 + t * o.sw, day = t >= 6.6 && t <= 19; o.head.setAttribute('transform', 'translate(' + hx.toFixed(1) + ',' + (o.sy + 3) + ')'); o.sunG.style.opacity = day ? 1 : 0; o.head.setAttribute('data-day', day ? 1 : 0);
      if (dt) o.sunG.setAttribute('transform', 'rotate(' + ((clock * 20) % 360).toFixed(1) + ')');
      var ch = Math.min(23, Math.floor(t)); o.cells.forEach(function(c, i){ c.classList.toggle('is-now', i === ch); c.classList.toggle('is-past', i < ch); });
    }
    function glow(x, y, r, c, a){ var gr = ctx.createRadialGradient(x, y, 0, x, y, r); gr.addColorStop(0, rgba(c, a)); gr.addColorStop(1, rgba(c, 0)); ctx.fillStyle = gr; ctx.fillRect(x - r, y - r, r * 2, r * 2); }
    function wave(x0, x1, y, yB, amp, ph, f){ var d = 'M' + x0 + ' ' + yB + 'V' + y.toFixed(1), n = 18; for (var i = 0; i <= n; i++) { var x = x0 + (x1 - x0) * i / n; d += 'L' + x.toFixed(1) + ' ' + (y + Math.sin(ph + i / n * Math.PI * 2 * f) * amp).toFixed(1); } return d + 'V' + yB + 'Z'; }
    function loop(){ if (raf || !visible || document.hidden) return; last = performance.now(); raf = requestAnimationFrame(function f(now){ var dt = Math.max(0, Math.min(.05, (now - last) / 1000)); last = now; frame(RM ? 0 : dt); raf = visible && !document.hidden ? requestAnimationFrame(f) : 0; }); }
    new ResizeObserver(function(){ var r = el.getBoundingClientRect(); if (Math.abs(r.width - W) > 1 || Math.abs(r.height - H) > 1) build(); }).observe(el);
    new IntersectionObserver(function(es){ visible = es[0].isIntersecting; if (visible) loop(); }).observe(el);
    document.addEventListener('visibilitychange', function(){ if (!document.hidden) loop(); });

    /* ---------------- hover: equipment cards ---------------- */
    function keyAt(e){ var n = e.target; while (n && n !== svg) { if (n.getAttribute && n.getAttribute('data-key')) return n.getAttribute('data-key'); n = n.parentNode; } return null; }
    function mark(k){ svg.querySelectorAll('[data-key]').forEach(function(g){ g.classList.toggle('is-hot', !!k && g.getAttribute('data-key') === k); }); }
    function show(k, e){
      hot = k; mark(k); if (api.onHover) api.onHover(k);
      var CAT = window.CATALOG, C2 = k && CAT ? CAT.C[k] : null; if (!C2) { card.classList.remove('is-on'); return; }
      var it = null; data.cfg.items.forEach(function(x){ if (x.key === k) it = x; });
      card.textContent = '';
      var kk = document.createElement('div'); kk.className = 'pcard__k'; kk.textContent = C2.k;
      var t = document.createElement('div'); t.className = 'pcard__t'; t.textContent = C2.name;
      if (it && it.qty > 1) { var q = document.createElement('span'); q.className = 'pcard__q'; q.textContent = '× ' + it.qty; t.appendChild(q); }
      card.append(kk, t);
      if (C2.desc) { var d = document.createElement('p'); d.className = 'pcard__d'; d.textContent = C2.desc; card.appendChild(d); }
      var dl = document.createElement('dl'); CAT.specs(k, it || {}).slice(0, 4).forEach(function(r){ var row = document.createElement('div'), a = document.createElement('dt'), b = document.createElement('dd'); a.textContent = r[0]; b.textContent = r[1]; row.append(a, b); dl.appendChild(row); }); card.appendChild(dl);
      var line = null; (data.budget ? data.budget.lines : []).forEach(function(l){ if (l.key === k) line = l; });
      if (line && line.amount && window.Site) { var cc = document.createElement('div'); cc.className = 'pcard__cost'; var s1 = document.createElement('span'); s1.textContent = 'У кошторисі · ' + Math.round(line.share * 100) + ' %'; var s2 = document.createElement('b'); s2.textContent = '≈ ' + window.Site.money(line.amount); cc.append(s1, s2); card.appendChild(cc); }
      card.classList.add('is-on');
      if (e && window.innerWidth > 700) { var r = el.getBoundingClientRect(), x = e.clientX - r.left + 18, y = e.clientY - r.top - 20, cw = card.offsetWidth, chh = card.offsetHeight; if (x + cw > W - 10) x = e.clientX - r.left - cw - 18; card.style.left = Math.max(10, x) + 'px'; card.style.top = Math.max(10, Math.min(H - chh - 10, y)) + 'px'; }
    }
    svg.addEventListener('pointermove', function(e){ if (e.pointerType !== 'mouse' || pinned) return; show(keyAt(e), e); });
    svg.addEventListener('pointerleave', function(){ if (!pinned) show(null); });
    svg.addEventListener('click', function(e){
      var s = e.target.closest && e.target.closest('[data-seek]'); if (s && api.onSeek) { api.onSeek(+s.getAttribute('data-seek')); return; }
      var k = keyAt(e); pinned = k && pinned !== k ? k : null; show(pinned || (e.pointerType === 'mouse' ? k : null), e);
    });

    api.setData = function(d){
      data = d; var mL = 0, mP = 0; d.L.forEach(function(v){ if (v > mL) mL = v; }); d.sch.chg.forEach(function(v){ if (v > mP) mP = v; });
      data.maxL = mL || 1; data.pmax = Math.max(mP / (d.rte || 1), 1e-6);
      build(); loop();
    };
    api.update = function(s){ st = s; if (!raf) frame(0); };
    api.highlight = function(k){ pinned = null; hot = k; mark(k); };
    return api;
  }
  return { create: create };
})();
