/* =====================================================================
   Fleet — the storages our clients own, as data: Kyiv time, tariffs and
   prices per hour, the simulated device (demo accounts and the showroom),
   the daily plan of the «Економія» mode, energy and money accounting and
   the views the cabinet shows. Pure functions, no DOM: the platform
   worker (platform/) runs this same file; the static site uses it for the
   demo cabinet when there is no backend.
   Units: time — ms UTC; energy — kWh per 15-minute bucket; power — kW;
   price — UAH per kWh; SOC — 0…1 of the nominal capacity.
   ===================================================================== */
window.FLEET = (function(){
  'use strict';
  var STEP = 900000, HOUR = 3600000, DAY = 86400000, QH = STEP / HOUR;

  /* ---------------- Kyiv time ----------------
     EU rule: summer time (UTC+3) from the last Sunday of March 01:00 UTC to
     the last Sunday of October 01:00 UTC, otherwise UTC+2. */
  var dstY = {}, oc = { a: 0, b: -1, r: null };
  function lastSunday(y, m){ var d = new Date(Date.UTC(y, m + 1, 0)); return Date.UTC(y, m, d.getUTCDate() - d.getUTCDay(), 1); }
  function offset(t){
    if (t < oc.a || t >= oc.b) { var y = new Date(t).getUTCFullYear(); oc.a = Date.UTC(y, 0, 1); oc.b = Date.UTC(y + 1, 0, 1); oc.r = dstY[y] || (dstY[y] = [lastSunday(y, 2), lastSunday(y, 9)]); }
    return t >= oc.r[0] && t < oc.r[1] ? 3 : 2;
  }
  function hourOf(t){ return Math.floor((((t + offset(t) * HOUR) % DAY) + DAY) % DAY / HOUR); }
  function local(t){ var d = new Date(t + offset(t) * HOUR); return { day: d.toISOString().slice(0, 10), h: d.getUTCHours(), m: d.getUTCMinutes(), dow: (d.getUTCDay() + 6) % 7, mon: d.getUTCMonth(), date: d.getUTCDate(), y: d.getUTCFullYear() }; }
  /* UTC instant of the local midnight that starts `day` (the clocks never change between 21:00 and 23:00 UTC) */
  function dayStart(day){ var u = Date.parse(day + 'T00:00:00Z'); return u - offset(u - 2.5 * HOUR) * HOUR; }
  function addDays(day, n){ return new Date(Date.parse(day + 'T12:00:00Z') + n * DAY).toISOString().slice(0, 10); }
  function dayOf(t){ return local(t).day; }
  function dayNum(day){ return Math.round(Date.parse(day + 'T00:00:00Z') / DAY); }
  function floorStep(t){ return Math.floor(t / STEP) * STEP; }
  function monthStart(day){ return day.slice(0, 8) + '01'; }
  function addMonths(day, n){ var y = +day.slice(0, 4), m = +day.slice(5, 7) - 1 + n; y += Math.floor(m / 12); m = ((m % 12) + 12) % 12; return y + '-' + (m < 9 ? '0' : '') + (m + 1) + '-01'; }
  function weekStart(day){ var dow = (new Date(Date.parse(day + 'T12:00:00Z')).getUTCDay() + 6) % 7; return addDays(day, -dow); }

  /* seeded noise: the same site and moment always give the same value */
  function seedOf(s){ var h = 2166136261; s = String(s); for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function rnd(a, b){ var h = (a ^ Math.imul(b | 0, 0x9E3779B1)) >>> 0; h = Math.imul(h ^ (h >>> 16), 0x85EBCA6B); h = Math.imul(h ^ (h >>> 13), 0xC2B2AE35); return ((h ^ (h >>> 16)) >>> 0) / 4294967296; }
  function clamp(v, a, b){ return v < a ? a : v > b ? b : v; }
  function r2(v){ return Math.round(v * 100) / 100; }
  function r3(v){ return Math.round(v * 1000) / 1000; }

  /* ---------------- tariffs ----------------
     Households: the fixed price 4.32 UAH/kWh (PSO, VAT included) with zone
     coefficients — two-zone night 23–7 ×0.5; three-zone night 23–7 ×0.4,
     peak 8–11 and 20–22 ×1.5. Business: the day-ahead price (РДН, ОЕС
     України) + Ukrenergo transmission, excl. VAT, plus an optional adder for
     distribution and the supplier's margin — the same in every hour, so it
     moves the bill but not the schedule. Same numbers as the calculator. */
  var HOME_BASE = 4.32, TRANSMISSION = 0.74291;
  var TARIFFS = { two: 'Двозонний', three: 'Тризонний', fixed: 'Фіксована ціна', dam: 'Ціни РДН' };
  function zoneMult(kind, h){
    var night = h >= 23 || h < 7;
    if (kind === 'two') return night ? 0.5 : 1;
    if (kind === 'three') return night ? 0.4 : (h >= 8 && h < 11) || (h >= 20 && h < 22) ? 1.5 : 1;
    return 1;
  }
  function defaultTariff(seg){ return seg === 'biz' ? { kind: 'dam', base: 0, adder: 0 } : { kind: 'two', base: HOME_BASE, adder: 0 }; }
  function cleanTariff(x, seg){
    var d = defaultTariff(seg); x = x || {};
    var kind = TARIFFS[x.kind] ? x.kind : d.kind, base = +x.base, adder = +x.adder;
    return { kind: kind, base: kind === 'dam' ? 0 : r2(clamp(isFinite(base) && base > 0 ? base : HOME_BASE, 0.5, 50)), adder: kind === 'dam' ? r2(clamp(isFinite(adder) ? adder : 0, 0, 20)) : 0 };
  }

  /* day-ahead prices: store = { days: { 'YYYY-MM-DD': [24 × UAH/MWh] } } —
     window.DAM_DATA in the browser, the market_prices table on the server.
     A missing day borrows a real one: after the last known day — the average
     of the last 7 (a forecast), before or between — a day picked by the date
     (the demo history). Either way the result is marked as an estimate. */
  var TYPICAL = [4300, 4000, 3900, 3900, 3900, 4300, 6000, 7900, 6000, 3000, 800, 400, 400, 400, 400, 800, 2000, 5000, 9000, 11100, 11800, 11500, 9000, 6500];
  var kd = { s: null, n: -1, list: [], tail: null };
  function knownDays(store){
    var days = (store && store.days) || {}, n = Object.keys(days).length;
    if (kd.s !== store || kd.n !== n) {
      kd.s = store; kd.n = n; kd.list = Object.keys(days).filter(function(k){ return days[k] && days[k].length === 24; }).sort();
      var last = kd.list.slice(-7), avg = [];
      for (var h = 0; h < 24; h++) { var s = 0; last.forEach(function(k){ s += days[k][h]; }); avg.push(last.length ? s / last.length : TYPICAL[h]); }
      kd.tail = avg;
    }
    return kd;
  }
  /* version of the price data: the server sets store.version; otherwise the known days */
  function storeVer(store){ if (store && store.version) return store.version; var k = knownDays(store); return k.n + ':' + (k.list[k.list.length - 1] || ''); }
  function damDay(store, day){
    var days = (store && store.days) || {};
    if (days[day] && days[day].length === 24) return { p: days[day], est: false };
    var k = knownDays(store);
    if (!k.list.length) return { p: TYPICAL, est: true };
    if (day > k.list[k.list.length - 1]) return { p: k.tail, est: true };
    return { p: days[k.list[Math.floor(rnd(seedOf(day), 7) * k.list.length)]], est: true };
  }
  var PC = {}, pcN = 0;
  function hourPrices(tf, day, store){
    var key = tf.kind + '|' + tf.base + '|' + tf.adder + '|' + day + '|' + (tf.kind === 'dam' ? storeVer(store) : '');
    if (PC[key]) return PC[key];
    if (++pcN > 5000) { PC = {}; pcN = 0; }
    var p = [], est = false, h;
    if (tf.kind === 'dam') { var d = damDay(store, day); est = d.est; for (h = 0; h < 24; h++) p.push(d.p[h] / 1000 + TRANSMISSION + tf.adder); }
    else for (h = 0; h < 24; h++) p.push(tf.base * zoneMult(tf.kind, h));
    return (PC[key] = { p: p, est: est });
  }

  /* ---------------- the site: consumption and outages ----------------
     share of the day's energy per local hour; month and weekday factors */
  var SHAPE = {
    flat: [.5, .4, .4, .4, .4, .5, .9, 1.4, 1.3, .9, .8, .8, .9, .9, .8, .8, 1, 1.4, 1.8, 2, 1.9, 1.6, 1.1, .7],
    home: [.6, .5, .5, .5, .5, .6, 1, 1.5, 1.3, 1, .9, .9, 1, 1, .9, .9, 1.1, 1.5, 1.9, 2, 1.9, 1.6, 1.2, .8],
    osbb: [.7, .6, .6, .6, .6, .8, 1.2, 1.6, 1.4, 1.1, 1, 1, 1, 1, 1, 1, 1.1, 1.4, 1.7, 1.8, 1.7, 1.5, 1.1, .9],
    biz: [.25, .25, .25, .25, .25, .3, .6, 1.3, 1.6, 1.6, 1.6, 1.6, 1.7, 1.7, 1.6, 1.6, 1.6, 1.6, 1.5, 1.4, 1.2, .6, .3, .25]
  };
  var KWH_DAY = { flat: 7, home: 16, osbb: 60, biz: 45 };
  var SEASON = [1.15, 1.1, 1, .95, .9, .9, .95, .95, .97, 1.05, 1.12, 1.2];
  function siteSeed(site){ return site.seed || (site.seed = seedOf(site.id)); }
  function loadHours(site, day){
    var sh = SHAPE[site.segment] || SHAPE.home, L = local(dayStart(day) + 12 * HOUR), sum = 0, out = [], h;
    var kwh = (site.sim && site.sim.kwhDay) || KWH_DAY[site.segment] || 16;
    var wk = L.dow >= 5 ? (site.segment === 'biz' ? .85 : site.segment === 'osbb' ? 1.03 : 1.1) : 1;
    var f = SEASON[L.mon] * wk * (.9 + .2 * rnd(siteSeed(site), dayNum(day)));
    for (h = 0; h < 24; h++) sum += sh[h];
    for (h = 0; h < 24; h++) out.push(kwh * f * sh[h] / sum);
    return out;
  }
  /* Grid outages of a simulated site: a seeded chance per day that grows in
     the cold months, 1–2 cuts of 2–4 hours between 7:00 and 22:00, plus the
     explicit ones in site.sim.extra ([from, to] in ms). Real sites report
     outages themselves. */
  var OUT_P = [.4, .35, .2, .12, .08, .1, .12, .12, .18, .3, .42, .48];
  function outagesOn(site, day){
    var list = [], sim = site.sim || {};
    if (sim.outages !== false) {
      var n = dayNum(day), s = siteSeed(site), t0 = dayStart(day), mon = +day.slice(5, 7) - 1;
      if (rnd(s ^ 0x51ED, n) < OUT_P[mon]) {
        var k = rnd(s ^ 0xA5A5, n) < .25 ? 2 : 1;
        for (var i = 0; i < k; i++) {
          var a = t0 + (7 + Math.floor(rnd(s ^ (0x77 + i), n) * 15)) * HOUR + Math.floor(rnd(s ^ (0x99 + i), n) * 4) * STEP;
          list.push([a, a + (8 + Math.floor(rnd(s ^ (0xBB + i), n) * 9)) * STEP]);
        }
      }
    }
    var d0 = dayStart(day), d1 = dayStart(addDays(day, 1));
    (sim.extra || []).forEach(function(x){ if (x[0] < d1 && x[1] > d0) list.push([x[0], x[1]]); });
    list.sort(function(a, b){ return a[0] - b[0]; });
    for (var j = 1; j < list.length; j++) if (list[j][0] <= list[j - 1][1]) { list[j - 1][1] = Math.max(list[j - 1][1], list[j][1]); list.splice(j--, 1); }
    return list;
  }
  function inOut(list, t){ for (var i = 0; i < list.length; i++) if (t >= list[i][0] && t < list[i][1]) return true; return false; }

  /* ---------------- equipment ----------------
     A system is what the cabinet controls: an all-in-one unit, or a hybrid
     inverter with its battery modules. Charge from the grid ≤ 0.5 C and ≤
     the inverter; 96 % each way (the calculator's 0.93 round trip); the BMS
     cuts off at 5 % in an outage. */
  function spec(o){
    var kwh = +o.kwh || 0, kw = +o.kw || 0;
    return { kwh: r3(kwh), kw: kw, maxChargeKw: Math.max(.5, Math.round(Math.min(kw || kwh * .5, kwh * .5) * 10) / 10), etaC: .965, etaD: .965, socMin: .05 };
  }
  function specFromCatalog(P, items){
    var kwh = 0, kw = 0;
    items.forEach(function(it){
      var p = P.byId(it.product_id); if (!p) return;
      var v = it.variant && p.variants ? p.variants.filter(function(x){ return x.model === it.variant; })[0] : null, q = it.qty || 1;
      if (p.cat !== 'inverter') kwh += (v && v.kwh || p.kwh || 0) * q;
      if (p.cat === 'inverter' || p.cat === 'aio' || p.cat === 'portable') kw += (v && v.kw || p.kw || 0) * q;
    });
    return spec({ kwh: kwh, kw: kw });
  }

  /* ---------------- settings ----------------
     backup  — «Резерв»: kept full, gives energy only when the grid is down;
     smart   — «Економія»: charges in the cheap hours of the tariff or the
               market and covers the site in the expensive ones; never goes
               below the reserve the owner keeps for outages;
     manual  — «Свій графік»: charge and discharge windows by the hour.
     A boost («Підготуватися до відключення») keeps it full until a time. */
  var MODES = { backup: 'Резерв', smart: 'Економія', manual: 'Свій графік' };
  function defaults(sp){ return { mode: 'smart', reserve: 30, gridKw: sp.maxChargeKw, windows: [] }; }
  function normalize(x, sp){
    var e = [], d = defaults(sp), s = {};
    x = x || {};
    s.mode = MODES[x.mode] ? x.mode : (x.mode == null ? d.mode : (e.push({ f: 'mode', m: 'Невідомий режим' }), d.mode));
    var r = x.reserve == null ? d.reserve : Math.round(+x.reserve);
    if (!isFinite(r) || r < 10 || r > 100) { e.push({ f: 'reserve', m: 'Резерв — від 10 до 100 %' }); r = clamp(isFinite(r) ? r : d.reserve, 10, 100); }
    s.reserve = r;
    var g = x.gridKw == null ? d.gridKw : Math.round(+x.gridKw * 10) / 10;
    if (!isFinite(g) || g < .5 || g > sp.maxChargeKw + 1e-9) { e.push({ f: 'gridKw', m: 'Заряд від мережі — від 0,5 до ' + String(sp.maxChargeKw).replace('.', ',') + ' кВт' }); g = clamp(isFinite(g) ? g : d.gridKw, .5, sp.maxChargeKw); }
    s.gridKw = g;
    s.windows = [];
    (Array.isArray(x.windows) ? x.windows : []).slice(0, 6).forEach(function(w, i){
      var type = w && (w.type === 'c' || w.type === 'd') ? w.type : null, a = Math.round(+(w && w.from)), b = Math.round(+(w && w.to)), kw = Math.round(+(w && w.kw) * 10) / 10, lim = type === 'c' ? sp.maxChargeKw : sp.kw;
      if (!type || !(a >= 0 && a <= 23) || !(b >= 1 && b <= 24) || b <= a) { e.push({ f: 'windows.' + i, m: 'Вікно ' + (i + 1) + ': перевірте години' }); return; }
      if (!(kw >= .5 && kw <= lim + 1e-9)) kw = lim;
      for (var j = 0; j < s.windows.length; j++) if (a < s.windows[j].to && b > s.windows[j].from) { e.push({ f: 'windows.' + i, m: 'Вікно ' + (i + 1) + ' перетинається з іншим' }); return; }
      s.windows.push({ type: type, from: a, to: b, kw: kw });
    });
    s.windows.sort(function(p, q){ return p.from - q.from; });
    if (s.mode === 'manual' && !s.windows.length && !e.length) e.push({ f: 'windows', m: 'Додайте хоча б одне вікно заряду чи віддачі' });
    return { ok: !e.length, value: s, errors: e };
  }
  function modeText(s){
    if (!s) return '—';
    var t = MODES[s.mode] || s.mode;
    return s.mode === 'backup' ? t + ' · повний заряд' : t + ' · резерв ' + s.reserve + ' %';
  }

  /* ---------------- the plan of «Економія» ----------------
     Dynamic programming over the stored energy above the reserve, hour by
     hour: charge where it's cheap, cover the site's load where it's
     expensive (never more than it uses — nothing goes back to the grid),
     start and end the day at the reserve. A kWh goes through the storage
     only if the gap after losses beats the wear (0.5 UAH, as in the
     calculator). The result is what the inverter gets as its time-of-use
     schedule for the day. */
  /* Resolution: a level is at most a quarter of the smallest hourly load
     or hourly charge, so small sites and low grid limits are not rounded
     down to "do nothing" (48–160 levels, well under a millisecond). */
  var WEAR = .5;
  function planDay(pr, Lh, sp, reserve, gridKw){
    var r = clamp(reserve / 100, sp.socMin, 1), span = 1 - r, soc = [r], act = [], h, i, j;
    if (span < .02 || sp.kwh <= 0) { for (h = 0; h < 24; h++) { soc.push(r); act.push(''); } return { soc: soc, act: act, gain: 0 }; }
    var q = Math.min(Math.min.apply(null, Lh.map(function(x){ return Math.min(x, sp.kw); }).filter(function(x){ return x > .01; }).concat([sp.kw || 1])), Math.min(gridKw, sp.maxChargeKw) * sp.etaC);
    var N = clamp(Math.ceil(span * sp.kwh / Math.max(q / 4, 1e-3)), 48, 160), W = N + 1, dE = span * sp.kwh / N, ec = sp.etaC, ed = sp.etaD;
    var up = Math.floor(Math.min(gridKw, sp.maxChargeKw) * ec / dE + 1e-9), INF = 1e15;
    var V = new Float64Array(25 * W), nx = new Int16Array(24 * W);
    for (i = 0; i < W; i++) V[24 * W + i] = i ? INF : 0;
    for (h = 23; h >= 0; h--) {
      /* the last level of an hour may be partial: it is paid in full, valued only for what the site uses */
      var lim = Math.min(sp.kw, Lh[h]), dn = Math.ceil(lim / (dE * ed) - 1e-9), p = pr[h];
      for (i = 0; i < W; i++) {
        var best = V[(h + 1) * W + i], bj = i;
        for (j = Math.max(0, i - dn); j <= Math.min(N, i + up); j++) {
          if (j === i) continue;
          var v = V[(h + 1) * W + j]; if (v >= INF) continue;
          var k = j - i, c = k > 0 ? p * k * dE / ec : -(p - WEAR) * Math.min(-k * dE * ed, lim);
          if (c + v < best - 1e-9) { best = c + v; bj = j; }
        }
        V[h * W + i] = best; nx[h * W + i] = bj;
      }
    }
    for (h = 0, i = 0; h < 24; h++) { j = nx[h * W + i]; act.push(j > i ? 'c' : j < i ? 'd' : ''); soc.push(r + span * j / N); i = j; }
    return { soc: soc, act: act, gain: Math.max(0, -V[0]) };
  }
  var PLC = {}, plN = 0;
  function planFor(sys, site, day, st, store){
    var tf = site.tariff, key = sys.id + '|' + day + '|' + st.reserve + '|' + st.gridKw + '|' + tf.kind + tf.base + tf.adder + '|' + (tf.kind === 'dam' ? storeVer(store) : '') + '|' + sys.spec.kwh;
    if (PLC[key]) return PLC[key];
    if (++plN > 4000) { PLC = {}; plN = 0; }
    var pr = hourPrices(tf, day, store), pl = planDay(pr.p, loadHours(site, day), sys.spec, st.reserve, st.gridKw);
    pl.est = pr.est; pl.day = day;
    return (PLC[key] = pl);
  }

  /* ---------------- simulation ----------------
     sys = { id, spec, installed_at, log: [{ at, kind: settings|boost|cancel, payload }] }
     Settings in force at t = the last applied «settings» entry before t. The
     state is carried from installation; the SOC at the start of each day is
     remembered, so a repeated request only replays from the nearest day. */
  var SIM = {}, simN = 0;
  function simKey(sys, site, store){ var lg = (sys.log || []).map(function(e){ return e.at + e.kind + JSON.stringify(e.payload || ''); }).join(';'), tf = site.tariff;
    return sys.id + '|' + sys.installed_at + '|' + sys.spec.kwh + '|' + seedOf(lg) + '|' + tf.kind + tf.base + tf.adder + '|' + (tf.kind === 'dam' ? storeVer(store) : '') + '|' + JSON.stringify(site.sim || null); }
  function memoOf(sys, site, store){
    var key = simKey(sys, site, store), m = SIM[key];
    if (!m) { if (++simN > 400) { SIM = {}; simN = 0; } m = SIM[key] = { cp: {}, acc: {} }; }
    return m;
  }
  function settingsAt(sys, t){
    var s = null, log = sys.log || [];
    for (var i = 0; i < log.length && log[i].at <= t; i++) if (log[i].kind === 'settings') s = log[i].payload;
    return s || defaults(sys.spec);
  }
  function boostAt(sys, t){
    var b = null, log = sys.log || [];
    for (var i = 0; i < log.length && log[i].at <= t; i++) { if (log[i].kind === 'boost') b = log[i].payload; else if (log[i].kind === 'cancel') b = null; }
    return b && t < b.until ? b : null;
  }
  function windowAt(st, h){ for (var i = 0; i < st.windows.length; i++) if (h >= st.windows[i].from && h < st.windows[i].to) return st.windows[i]; return null; }

  function simulate(sys, site, from, to, store){
    var out = [], sp = sys.spec, inst = floorStep(sys.installed_at);
    from = Math.max(floorStep(from), inst); to = floorStep(to);
    if (to <= from || sp.kwh <= 0) return out;
    var memo = memoOf(sys, site, store);
    /* the nearest remembered day start at or before `from` */
    var d = dayOf(from), t = inst, soc = .6, back = 0;
    while (back++ < 4000) { if (memo.cp[d] != null && dayStart(d) >= inst) { t = dayStart(d); soc = memo.cp[d]; break; } if (dayStart(d) <= inst) break; d = addDays(d, -1); }
    var cap = sp.kwh, ec = sp.etaC, ed = sp.etaD, Pd = sp.kw * QH, seed = sys.seed || (sys.seed = seedOf(sys.id));
    var curDay = null, pr = null, Lh = null, outs = null, dayT = 0, log = sys.log || [], li = 0, st = null, boost = null;
    while (t < to) {
      if (t >= dayT) {
        curDay = dayOf(t); dayT = dayStart(addDays(curDay, 1));
        if (t === dayStart(curDay)) memo.cp[curDay] = soc;
        pr = hourPrices(site.tariff, curDay, store).p; Lh = loadHours(site, curDay); outs = outagesOn(site, curDay);
      }
      if (st === null || (li < log.length && log[li].at <= t)) { while (li < log.length && log[li].at <= t) li++; st = settingsAt(sys, t); }
      boost = boostAt(sys, t);
      var h = hourOf(t), ld = Lh[h] * QH * (.92 + .16 * rnd(seed, t / STEP)), res = st.reserve / 100;
      var b = { t: t, load: ld, chg: 0, dis: 0, grid: 0, soc: 0, out: 0, uns: 0, price: pr[h] };
      if (inOut(outs, t)) {
        var dl = Math.min(ld, Pd, Math.max(0, (soc - sp.socMin) * cap * ed));
        b.out = 1; b.dis = dl; b.uns = ld - dl; soc -= dl / ed / cap;
      } else {
        var dir = 0, tgt = soc, rate = 0, Gc = Math.min(st.gridKw, sp.maxChargeKw) * QH;
        if (boost || st.mode === 'backup') { dir = 1; tgt = 1; rate = Gc; }
        else if (st.mode === 'smart') {
          var pl = planFor(sys, site, curDay, st, store), a = pl.act[h];
          if (a === 'c') { dir = 1; tgt = pl.soc[h + 1]; rate = Gc; } else if (a === 'd') { dir = -1; tgt = Math.max(pl.soc[h + 1], res); rate = Pd; }
        } else {
          var w = windowAt(st, h);
          if (w && w.type === 'c') { dir = 1; tgt = 1; rate = Math.min(w.kw * QH, Gc); } else if (w) { dir = -1; tgt = res; rate = Math.min(w.kw * QH, Pd); }
        }
        if (dir <= 0 && soc < res - 1e-6) { dir = 1; tgt = res; rate = Gc; }   // refill the reserve first
        if (dir > 0 && soc < tgt - 1e-6) { var e = Math.min(rate, (tgt - soc) * cap / ec); b.chg = e; soc += e * ec / cap; }
        else if (dir < 0 && soc > tgt + 1e-6) { var x = Math.min(rate, ld, (soc - tgt) * cap * ed); b.dis = x; soc -= x / ed / cap; }
        b.grid = ld - b.dis + b.chg;
      }
      b.soc = soc = clamp(soc, 0, 1);
      if (t >= from) out.push(b);
      t += STEP;
    }
    return out;
  }

  /* ---------------- buckets of a whole site ----------------
     ctx = { site, systems: [{ dev, comps, log, rows?, daily? }], store, now }
     Simulated systems are computed. Real ones bring telemetry in the same
     shape: rows — 15-minute buckets of a recent window, daily — totals of
     past days from the nightly rollup. Systems of one site share the grid
     and the tariff. */
  function sysOf(s){ var d = s.dev; return s.sys || (s.sys = { id: d.id, spec: d.spec, installed_at: d.installed_at, log: s.log || [], seed: seedOf(d.id) }); }
  function priced(rows, site, store){ rows.forEach(function(b){ if (b.price == null) { var L = local(b.t); b.price = hourPrices(site.tariff, L.day, store).p[L.h]; } }); return rows; }
  function sysBuckets(s, ctx, from, to){
    return s.dev.driver === 'sim' ? simulate(sysOf(s), ctx.site, from, to, ctx.store) : priced((s.rows || []).filter(function(b){ return b.t >= from && b.t < to; }), ctx.site, ctx.store);
  }
  function siteBuckets(ctx, from, to){
    if (ctx.systems.length === 1) return sysBuckets(ctx.systems[0], ctx, from, to);
    var map = {}, keys = [];
    ctx.systems.forEach(function(s){
      var cap = s.dev.spec.kwh;
      sysBuckets(s, ctx, from, to).forEach(function(b){
        var m = map[b.t];
        if (!m) { m = map[b.t] = { t: b.t, load: 0, chg: 0, dis: 0, grid: 0, soc: 0, out: 0, uns: 0, price: b.price, w: 0 }; keys.push(b.t); }
        m.load += b.load; m.chg += b.chg; m.dis += b.dis; m.grid += b.grid; m.uns += b.uns || 0; m.out = Math.max(m.out, b.out || 0); m.soc += b.soc * cap; m.w += cap;
      });
    });
    keys.sort(function(a, b){ return a - b; });
    return keys.map(function(k){ var m = map[k]; m.soc = m.w ? m.soc / m.w : 0; delete m.w; return m; });
  }

  /* ---------------- accounting ----------------
     Money is what the bill shows: energy taken into the storage costs the
     price of its hour; energy it gives the site saves the price of its
     hour. In an outage there is nothing to buy: those kWh count as backup,
     not as savings (their value is the generator they replace — shown
     separately, never mixed into payback). */
  function acc(){ return { load: 0, chg: 0, cost: 0, dis: 0, val: 0, outDis: 0, outH: 0, uns: 0, grid: 0, base: 0, socMin: 1, socMax: 0, ps: 0, n: 0 }; }
  /* a bucket can be partly without the grid (gateways report the share):
     charging needs the grid, so it is always paid; giving is split by time */
  function add(a, b){
    var o = b.out > 0 ? Math.min(1, b.out) : 0, n = 1 - o;
    a.load += b.load; a.chg += b.chg; a.grid += b.grid; a.ps += b.price; a.n++;
    a.cost += b.chg * b.price; a.val += b.dis * n * b.price; a.dis += b.dis * n; a.base += b.load * n * b.price;
    a.outDis += b.dis * o; a.outH += QH * o; a.uns += b.uns || 0;
    if (b.soc < a.socMin) a.socMin = b.soc; if (b.soc > a.socMax) a.socMax = b.soc;
    return a;
  }
  function merge(a, x){
    ['load', 'chg', 'cost', 'dis', 'val', 'outDis', 'outH', 'uns', 'grid', 'base', 'ps', 'n'].forEach(function(k){ a[k] += x[k] || 0; });
    if (x.n) { a.socMin = Math.min(a.socMin, x.socMin); a.socMax = Math.max(a.socMax, x.socMax); }
    return a;
  }
  function fin(a, cap){
    return { load: r2(a.load), chg: r2(a.chg), cost: r2(a.cost), dis: r2(a.dis), val: r2(a.val), profit: r2(a.val - a.cost),
      buyAvg: a.chg > .01 ? r2(a.cost / a.chg) : null, sellAvg: a.dis > .01 ? r2(a.val / a.dis) : null,
      outH: r2(a.outH), outDis: r2(a.outDis), uns: r2(a.uns), grid: r2(a.grid), bill: r2(a.base - (a.val - a.cost)), base: r2(a.base),
      cycles: cap ? r2((a.dis + a.outDis) / cap) : 0, socMin: a.n ? r3(a.socMin) : null, socMax: a.n ? r3(a.socMax) : null, price: a.n ? r2(a.ps / a.n) : null };
  }
  function totals(bs, cap){ var a = acc(); bs.forEach(function(b){ add(a, b); }); return fin(a, cap); }
  /* "when it bought and at what price": runs of charging, giving and outage.
     money is net (+ saved, − paid), so the runs of a day add up to its profit */
  function blocks(bs){
    var out = [], cur = null;
    function push(c, b){ var o = b.out > 0 ? Math.min(1, b.out) : 0, n = 1 - o; c.chg += b.chg; c.cost += b.chg * b.price; c.dis += b.dis * n; c.val += b.dis * n * b.price; c.odis += b.dis * o; c.uns += b.uns || 0; }
    function main(c){ return c.k === 'buy' ? c.chg : c.k === 'sell' ? c.dis : c.odis; }
    bs.forEach(function(b){
      var k = b.out >= .5 ? 'out' : b.chg > .003 || b.dis > .003 ? (b.chg >= b.dis ? 'buy' : 'sell') : '';
      if (cur && (cur.k === k || (!k && cur.k !== 'out' && b.t - cur.to < 2 * STEP))) { if (k) { cur.to = b.t + STEP; push(cur, b); } return; }
      if (cur && main(cur) > .05) out.push(cur);
      cur = k ? { k: k, from: b.t, to: b.t + STEP, chg: 0, cost: 0, dis: 0, val: 0, odis: 0, uns: 0 } : null;
      if (cur) push(cur, b);
    });
    if (cur && main(cur) > .05) out.push(cur);
    return out.map(function(c){ return { k: c.k, from: c.from, to: c.to, kwh: r2(main(c)), money: r2(c.val - c.cost),
      avg: c.k === 'buy' ? (c.chg > .01 ? r2(c.cost / c.chg) : null) : c.k === 'sell' ? (c.dis > .01 ? r2(c.val / c.dis) : null) : null, uns: r2(c.uns) }; });
  }
  /* buckets for a chart: 'q' — as they are, 'hour', 'day' (local time) */
  function group(bs, size, cap){
    if (size === 'q') return bs.map(function(b){ return { t: b.t, chg: r3(b.chg), dis: r3(b.dis), load: r3(b.load), grid: r3(b.grid), soc: r3(b.soc), out: b.out, price: r2(b.price), profit: r2(b.out ? 0 : (b.dis - b.chg) * b.price) }; });
    var out = [], cur = null, end = -Infinity;
    bs.forEach(function(b){
      if (b.t >= end) {
        if (cur) out.push(item(cur.key, cur.t, cur.a, cap, cur.soc));
        var L = local(b.t);
        if (size === 'hour') { end = Math.floor(b.t / HOUR) * HOUR + HOUR; cur = { key: L.day + 'T' + (L.h < 10 ? '0' : '') + L.h, t: b.t, a: acc() }; }
        else { end = dayStart(addDays(L.day, 1)); cur = { key: L.day, t: b.t, a: acc() }; }
      }
      add(cur.a, b); cur.soc = b.soc;
    });
    if (cur) out.push(item(cur.key, cur.t, cur.a, cap, cur.soc));
    return out;
  }
  function item(key, t, a, cap, soc){
    var f = fin(a, cap);
    return { t: t, key: key, chg: f.chg, dis: f.dis, load: f.load, grid: f.grid, soc: soc != null ? r3(soc) : null, out: a.n ? r2(a.outH / (a.n * QH)) : 0, price: f.price,
      cost: f.cost, val: f.val, profit: f.profit, buyAvg: f.buyAvg, sellAvg: f.sellAvg, outH: f.outH, outDis: f.outDis, uns: f.uns, socMin: f.socMin, socMax: f.socMax };
  }

  /* Day totals. A finished day of a simulated system is computed once and
     kept with its simulation; a real system brings finished days from the
     rollup (s.daily[day]) and today from its rows. */
  function sysDays(s, ctx, days){
    var out = {}, d = s.dev, today = dayOf(ctx.now), first = d.installed_at ? dayOf(d.installed_at) : today;
    if (d.driver !== 'sim') {
      /* rows are fresher than the rollup: use them for the days they fully cover */
      var rf = s.rows && s.rows.length ? dayOf(s.rows[0].t) : null;
      days.forEach(function(day){
        if (day < first) return;
        var a = null;
        if (rf && day > rf) { var t0 = dayStart(day), t1 = dayStart(addDays(day, 1)), x = acc(), any = false; priced(s.rows, ctx.site, ctx.store).forEach(function(b){ if (b.t >= t0 && b.t < t1) { add(x, b); any = true; } }); if (any) a = x; }
        if (!a && s.daily) a = s.daily[day] || null;
        if (a) out[day] = a;
      });
      return out;
    }
    var sys = sysOf(s), memo = memoOf(sys, ctx.site, ctx.store), miss = [], need = {};
    days.forEach(function(day){ if (day < first || day > today) return; if (day < today && memo.acc[day]) out[day] = memo.acc[day]; else { miss.push(day); need[day] = 1; } });
    if (miss.length) {
      var bs = simulate(sys, ctx.site, dayStart(miss[0]), Math.min(dayStart(addDays(miss[miss.length - 1], 1)), floorStep(ctx.now) + STEP), ctx.store), cur = null, end = -Infinity;
      bs.forEach(function(b){ if (b.t >= end) { var dd = dayOf(b.t); end = dayStart(addDays(dd, 1)); cur = need[dd] ? (out[dd] = out[dd] || acc()) : null; } if (cur) add(cur, b); });
      miss.forEach(function(m){ if (m < today && out[m]) memo.acc[m] = out[m]; });
    }
    return out;
  }
  function siteDays(ctx, a, b){
    var days = [], d = a; while (d <= b) { days.push(d); d = addDays(d, 1); }
    var per = ctx.systems.map(function(s){ return sysDays(s, ctx, days); });
    return days.map(function(day){ var x = null; per.forEach(function(m){ if (m[day]) x = merge(x || acc(), m[day]); }); return x ? { day: day, a: x } : null; }).filter(Boolean);
  }
  function sumDays(ds){ var a = acc(); ds.forEach(function(x){ merge(a, x.a); }); return a; }
  function byMonth(ds, cap){
    var out = [], cur = null;
    ds.forEach(function(x){ var k = x.day.slice(0, 7); if (!cur || cur.key !== k) { cur = { key: k, t: dayStart(k + '-01'), a: acc() }; out.push(cur); } merge(cur.a, x.a); });
    return out.map(function(m){ var it = item(m.key, m.t, m.a, cap); it.label = MONN[+m.key.slice(5, 7) - 1] + ' ' + m.key.slice(0, 4); return it; });
  }

  /* ---------------- views (the same for the worker and the static demo) ---------------- */
  var MON = ['січня', 'лютого', 'березня', 'квітня', 'травня', 'червня', 'липня', 'серпня', 'вересня', 'жовтня', 'листопада', 'грудня'];
  var MONN = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
  function dayText(day){ return +day.slice(8) + ' ' + MON[+day.slice(5, 7) - 1] + ' ' + day.slice(0, 4); }
  function shortDay(day){ return day.slice(8) + '.' + day.slice(5, 7); }
  function capOf(ctx){ return ctx.systems.reduce(function(s, x){ return s + x.dev.spec.kwh; }, 0); }
  function installedOf(ctx){ return ctx.systems.reduce(function(m, x){ return Math.min(m, x.dev.installed_at || Infinity); }, Infinity); }
  var RANGES = { day: 'День', week: 'Тиждень', month: 'Місяць', year: 'Рік', all: 'Весь час' };
  function span(range, day, ctx){
    var today = dayOf(ctx.now), inst = installedOf(ctx), first = isFinite(inst) ? dayOf(inst) : today, a, b, size, label, step = null;
    if (!/^\d{4}-\d\d-\d\d$/.test(day || '') || day > today) day = today;
    if (day < first) day = first;
    if (range === 'week') { a = weekStart(day); b = addDays(a, 7); size = 'hour'; label = shortDay(a) + '–' + shortDay(addDays(b, -1)) + '.' + addDays(b, -1).slice(0, 4); step = function(n){ return addDays(a, 7 * n); }; }
    else if (range === 'month') { a = monthStart(day); b = addMonths(a, 1); size = 'day'; label = MONN[+a.slice(5, 7) - 1] + ' ' + a.slice(0, 4); step = function(n){ return addMonths(a, n); }; }
    else if (range === 'year') { a = day.slice(0, 4) + '-01-01'; b = (+day.slice(0, 4) + 1) + '-01-01'; size = 'month'; label = day.slice(0, 4) + ' рік'; step = function(n){ return (+a.slice(0, 4) + n) + '-01-01'; }; }
    else if (range === 'all') { a = first; b = addDays(today, 1); size = (dayNum(today) - dayNum(first)) < 100 ? 'day' : 'month'; label = 'Від ' + shortDay(first) + '.' + first.slice(0, 4); }
    else { range = 'day'; a = day; b = addDays(day, 1); size = 'q'; label = dayText(day); step = function(n){ return addDays(a, n); }; }
    var prev = step ? step(-1) : null, next = step ? step(1) : null;
    return { range: range, day: day, a: a, b: b, from: dayStart(a), to: Math.min(dayStart(b), floorStep(ctx.now) + STEP), end: dayStart(b), size: size, label: label, first: first, today: today,
      prev: prev && addDays(a, -1) >= first ? (prev < first ? first : prev) : null, next: next && next <= today ? next : null };
  }
  function energy(ctx, range, day){
    var sp = span(range, day, ctx), cap = capOf(ctx), series, tot, rows, est = false, d;
    if (sp.size === 'q' || sp.size === 'hour') {
      var bs = siteBuckets(ctx, sp.from, sp.to);
      series = group(bs, sp.size, cap); tot = totals(bs, cap);
      rows = sp.size === 'q' ? blocks(bs) : group(bs, 'day', cap).map(function(g){ g.label = shortDay(g.key); return g; });
    } else {
      var lastDay = addDays(sp.b, -1) < sp.today ? addDays(sp.b, -1) : sp.today, ds = siteDays(ctx, sp.a > sp.first ? sp.a : sp.first, lastDay);
      tot = fin(sumDays(ds), cap);
      var days = ds.map(function(x){ var it = item(x.day, dayStart(x.day), x.a, cap); it.label = shortDay(x.day); return it; });
      series = sp.size === 'day' ? days : byMonth(ds, cap);
      rows = sp.size === 'day' ? days.slice().reverse() : series.slice().reverse();
    }
    for (d = sp.a; d < sp.b && d <= sp.today && !est; d = addDays(d, 1)) if (d >= sp.first) est = hourPrices(ctx.site.tariff, d, ctx.store).est;
    return { range: sp.range, day: sp.day, label: sp.label, prev: sp.prev, next: sp.next, from: sp.from, to: sp.end, now: ctx.now, size: sp.size,
      series: series, totals: tot, rows: rows, est: est, plan: sp.range === 'day' && sp.day === sp.today ? sitePlan(ctx, sp.today) : null, cap: r2(cap), tariff: ctx.site.tariff };
  }
  /* what «Економія» intends to do on a day, per hour, for the whole site */
  function sitePlan(ctx, day){
    var acts = [], gain = 0, est = false, any = false, h;
    for (h = 0; h < 24; h++) acts.push('');
    ctx.systems.forEach(function(s){
      if (s.dev.driver !== 'sim' && !s.dev.plannable) return;
      var sys = sysOf(s), st = settingsAt(sys, Math.max(ctx.now, dayStart(day)));
      if (st.mode !== 'smart') return;
      var pl = planFor(sys, ctx.site, day, st, ctx.store); any = true; gain += pl.gain; est = est || pl.est;
      for (h = 0; h < 24; h++) if (pl.act[h]) acts[h] = pl.act[h];
    });
    if (!any) return null;
    var pr = hourPrices(ctx.site.tariff, day, ctx.store);
    return { day: day, act: acts, price: pr.p.map(r2), gain: r2(gain), est: est || pr.est };
  }
  function live(ctx){
    var now = ctx.now, t = floorStep(now), frac = (now - t) / STEP, cap = 0, list = [], tot = { soc: 0, pBat: 0, pGrid: 0, pLoad: 0, out: false, w: 0 };
    ctx.systems.forEach(function(s){
      var d = s.dev, sys = sysOf(s), x;
      if (d.driver === 'sim') {
        var bs = simulate(sys, ctx.site, t - STEP, t + STEP, ctx.store), b = bs[bs.length - 1], p = bs.length > 1 ? bs[0] : null;
        if (!b) return;
        var j = 1 + .05 * Math.sin(now / 7000 + seedOf(d.id) % 7) + .03 * Math.sin(now / 2300), s0 = p ? p.soc : b.soc;
        x = { soc: s0 + (b.soc - s0) * frac, pBat: (b.chg - b.dis) / QH * j, pLoad: b.load / QH * j, out: !!b.out, at: now, online: true };
        x.pGrid = b.out ? 0 : Math.max(0, x.pLoad + x.pBat);
      } else {
        var stt = d.state || {};
        x = { soc: stt.soc != null ? stt.soc : null, pBat: stt.pBat || 0, pLoad: stt.pLoad || 0, pGrid: stt.pGrid || 0, out: !!stt.out, at: d.last_seen_at || null, online: d.status === 'online' };
      }
      var st = settingsAt(sys, now);
      x.id = d.id; x.mode = st.mode; x.reserve = st.reserve; x.boost = boostAt(sys, now); x.cap = d.spec.kwh;
      if (x.soc != null) { tot.soc += x.soc * d.spec.kwh; tot.w += d.spec.kwh; cap += d.spec.kwh; }
      tot.pBat += x.pBat; tot.pLoad += x.pLoad; tot.pGrid += x.pGrid; tot.out = tot.out || x.out;
      x.soc = x.soc != null ? r3(x.soc) : null; x.pBat = r2(x.pBat); x.pLoad = r2(x.pLoad); x.pGrid = r2(x.pGrid);
      list.push(x);
    });
    var soc = tot.w ? tot.soc / tot.w : null, Lh = loadHours(ctx.site, dayOf(now)), avg = Lh.reduce(function(a, b){ return a + b; }, 0) / 24, outNow = null;
    if (tot.out) { var os = outagesOn(ctx.site, dayOf(now)).filter(function(o){ return now >= o[0] && now < o[1]; })[0]; outNow = { from: os ? os[0] : null }; }
    return { at: now, soc: soc != null ? r3(soc) : null, pBat: r2(tot.pBat), pGrid: r2(tot.pGrid), pLoad: r2(tot.pLoad), out: tot.out, outage: outNow,
      eta: soc != null ? r2(Math.max(0, soc - .05) * cap * .965 / Math.max(.05, tot.out ? tot.pLoad : (tot.pLoad + avg) / 2)) : null, systems: list };
  }
  function events(ctx, days){
    var now = ctx.now, today = dayOf(now), from = Math.max(dayStart(addDays(today, -(days || 14) + 1)), isFinite(installedOf(ctx)) ? installedOf(ctx) : now), list = [];
    /* outages come from the buckets (simulated or reported), the rest from the event log */
    blocks(siteBuckets(ctx, from, floorStep(now) + STEP)).filter(function(b){ return b.k === 'out'; }).forEach(function(b){
      list.push({ kind: 'outage', t: b.from, t_end: b.to <= now ? b.to : null, kwh: b.kwh, uns: b.uns, level: b.uns > .05 ? 'warn' : 'ok' });
    });
    (ctx.events || []).forEach(function(e){ if (e.t >= from && e.kind !== 'outage') list.push(e); });
    (ctx.commands || []).forEach(function(c){ if ((c.done_at || c.created_at) >= from) list.push({ kind: 'command', t: c.done_at || c.created_at, cmd: c }); });
    list.sort(function(a, b){ return b.t - a.t; });
    return list.slice(0, 40);
  }
  /* «Окупність»: what the owner paid (orders) against what the storage
     saved since it was switched on; the pace of the last 30 full days gives
     the forecast. The backup is shown next to it, priced at a generator kWh. */
  var PAID = { paid: 1, delivered: 1, installed: 1, done: 1 };
  function orderTotal(o){ return (o.items || []).reduce(function(s, it){ return s + (it.price_uah || 0) * (it.qty || 1); }, 0); }
  function economics(ctx){
    var now = ctx.now, inst = installedOf(ctx), cap = capOf(ctx), today = dayOf(now);
    var orders = (ctx.orders || []).filter(function(o){ return o.site_id === ctx.site.id; });
    var invest = orders.filter(function(o){ return PAID[o.status]; }).reduce(function(s, o){ return s + orderTotal(o); }, 0);
    if (!isFinite(inst)) return { invest: invest, orders: orders.map(orderView), none: true };
    var ds = siteDays(ctx, dayOf(inst), today), all = fin(sumDays(ds), cap);
    var full = ds.filter(function(x){ return x.day < today && x.day > dayOf(inst); }).slice(-30);
    var pace = full.length ? full.reduce(function(s, x){ return s + x.a.val - x.a.cost; }, 0) / full.length : 0;
    var outPace = full.length ? full.reduce(function(s, x){ return s + x.a.outDis; }, 0) / full.length : 0;
    var gen = ctx.site.gen_cost > 0 ? ctx.site.gen_cost : 25, genVal = all.outDis * gen;
    var years = pace > .01 && invest > 0 ? Math.max(0, invest - all.profit) / (pace * 365) : null;
    var yearsB = (pace + outPace * gen) > .01 && invest > 0 ? Math.max(0, invest - all.profit - genVal) / ((pace + outPace * gen) * 365) : null;
    return { invest: invest, since: inst, days: Math.max(1, Math.round((now - inst) / DAY)), totals: all, share: invest > 0 ? r3(all.profit / invest) : null,
      pace: r2(pace), yearly: r2(pace * 365), years: years != null ? r2(years) : null, payDate: years != null ? Math.round(now + years * 365.25 * DAY) : null,
      backup: { h: all.outH, kwh: all.outDis, uns: all.uns, gen: gen, value: r2(genVal), years: yearsB != null ? r2(yearsB) : null, share: invest > 0 ? r3((all.profit + genVal) / invest) : null },
      months: byMonth(ds, cap), orders: orders.map(orderView) };
  }
  var STATUS = { new: 'Заявка', survey: 'Огляд об’єкта', offer: 'Пропозиція', contract: 'Договір', paid: 'Оплачено', delivered: 'Доставлено', installed: 'Змонтовано', done: 'Працює', cancelled: 'Скасовано' };
  var FLOW = ['new', 'survey', 'offer', 'contract', 'paid', 'delivered', 'installed', 'done'];
  function orderView(o){ return Object.assign({}, o, { total: orderTotal(o), priced: (o.items || []).every(function(it){ return it.price_uah != null; }), statusText: STATUS[o.status] || o.status }); }
  function overview(ctx){
    var now = ctx.now, today = dayOf(now), cap = capOf(ctx), eco = economics(ctx), inst = installedOf(ctx), tDay = null, tMon = null;
    if (isFinite(inst)) {
      var ds = siteDays(ctx, monthStart(today) > dayOf(inst) ? monthStart(today) : dayOf(inst), today);
      tMon = fin(sumDays(ds), cap); tDay = fin(sumDays(ds.filter(function(x){ return x.day === today; })), cap);
    }
    return { site: siteView(ctx.site), now: now, live: live(ctx), today: energy(ctx, 'day', today),
      kpi: { today: tDay, month: tMon, total: eco.totals || null, share: eco.share, invest: eco.invest, years: eco.years, pace: eco.pace, since: eco.since || null, backup: eco.backup || null },
      systems: ctx.systems.map(function(s){ return systemCard(ctx, s); }), events: events(ctx, 14),
      orders: (eco.orders || []).filter(function(o){ return o.status !== 'done' && o.status !== 'cancelled'; }) };
  }
  function siteView(site){ return { id: site.id, name: site.name, segment: site.segment, address: site.address || '', tariff: site.tariff, tariffText: tariffText(site.tariff), gen_cost: site.gen_cost || null, role: site.role || null }; }
  function tariffText(tf){
    var n = function(v){ return String(r2(v)).replace('.', ','); };
    if (tf.kind === 'dam') return 'Ціни РДН + передача ' + n(TRANSMISSION) + ' ₴' + (tf.adder ? ' + ' + n(tf.adder) + ' ₴' : '') + ', без ПДВ';
    return TARIFFS[tf.kind] + ' · ' + n(tf.base) + ' ₴/кВт·год';
  }
  function systemCard(ctx, s){
    var d = s.dev, st = settingsAt(sysOf(s), ctx.now);
    return { id: d.id, name: d.name, model: d.model, product_id: d.product_id, img: d.img || null, kind: d.kind, serial: d.serial, kwh: d.spec.kwh, kw: d.spec.kw, driver: d.driver,
      status: d.driver === 'sim' ? 'online' : d.status || 'offline', mode: st.mode, modeText: modeText(st), settings: st, installed_at: d.installed_at, warranty_until: d.warranty_until || null,
      comps: (s.comps || []).map(function(c){ return { id: c.id, name: c.name, model: c.model, serial: c.serial, kwh: c.spec ? c.spec.kwh : null, img: c.img || null, warranty_until: c.warranty_until || null }; }) };
  }
  function device(ctx, id){
    var s = ctx.systems.filter(function(x){ return x.dev.id === id; })[0]; if (!s) return null;
    var d = s.dev, sys = sysOf(s), now = ctx.now, today = dayOf(now), st = settingsAt(sys, now), one = { site: ctx.site, systems: [s], store: ctx.store, now: now }, lv = live(one);
    var plans = [today, addDays(today, 1)].map(function(day){
      var pl = planFor(sys, ctx.site, day, Object.assign({}, st, { mode: 'smart' }), ctx.store), pr = hourPrices(ctx.site.tariff, day, ctx.store);
      return { day: day, act: pl.act, soc: pl.soc.map(r3), price: pr.p.map(r2), gain: r2(pl.gain), est: pl.est };
    });
    var first = d.installed_at ? dayOf(d.installed_at) : today, ds = siteDays(one, first, today), last30 = fin(sumDays(ds.slice(-30)), d.spec.kwh), life = fin(sumDays(ds), d.spec.kwh);
    var modSoc = lv.systems[0] ? lv.systems[0].soc : null, busy = lv.systems[0] && Math.abs(lv.systems[0].pBat) > 1;
    return { card: systemCard(ctx, s), live: lv.systems[0] || null, settings: st, boost: boostAt(sys, now),
      limits: { reserve: [10, 100], gridKw: [.5, d.spec.maxChargeKw], kw: d.spec.kw, kwh: d.spec.kwh },
      plans: plans, last30: last30, cycles: d.driver === 'sim' ? life.cycles : (d.state && d.state.cycles) || null, firmware: d.firmware || null,
      last_seen_at: d.driver === 'sim' ? now : d.last_seen_at || null, warranty_until: d.warranty_until || null, purchase: purchaseOf(ctx, d),
      comps: (s.comps || []).map(function(c){ var sd = seedOf(c.id); return { id: c.id, name: c.name, model: c.model, serial: c.serial, kwh: c.spec ? c.spec.kwh : null, img: c.img || null, warranty_until: c.warranty_until || null, purchase: purchaseOf(ctx, c),
        soc: modSoc != null ? r3(clamp(modSoc + (rnd(sd, 1) - .5) * .02, 0, 1)) : null, temp: d.driver === 'sim' ? Math.round(18 + rnd(sd, 2) * 5 + (busy ? 4 : 0)) : null }; }),
      commands: (ctx.commands || []).filter(function(c){ return c.device_id === id; }).sort(function(a, b){ return (b.created_at || 0) - (a.created_at || 0); }).slice(0, 30) };
  }
  function purchaseOf(ctx, d){
    var hit = null;
    (ctx.orders || []).forEach(function(o){ (o.items || []).forEach(function(it){ if (d.order_item_id != null && it.id === d.order_item_id) hit = { order: o.number || o.id, at: o.paid_at || o.created_at, price: it.price_uah, qty: it.qty, name: it.name }; }); });
    return hit;
  }

  /* ---------------- the demo account ----------------
     Two sites of one owner, built from real catalogue models with their
     indicative retail prices: an ОСББ on a two-zone meter (backup is the
     point) and a café on day-ahead prices (the storage earns daily). The
     installation line is an estimate in the calculator's proportions; the
     whole account is marked ДЕМО. The worker inserts the same rows for
     «Демо-кабінет»; the static site uses them as they are. */
  function demo(now, P, ids){
    ids = ids || { user: 'demo-user', osbb: 'demo-osbb', cafe: 'demo-cafe' };
    var day = dayOf(now), at = function(dd, hh, mm){ return dayStart(addDays(day, dd)) + (hh || 0) * HOUR + (mm || 0) * 60000; };
    function img(id){ var p = P && P.byId(id); return p && p.img && p.img[0] ? { src: p.img[0].src, bg: p.img[0].bg } : null; }
    function price(id, v){ var p = P && P.byId(id); if (!p) return null; if (v && p.variants) { var x = p.variants.filter(function(q){ return q.model === v; })[0]; return x ? x.price : null; } return p.price; }
    function pname(id, v, fall){ var p = P && P.byId(id); if (!p) return fall; return v && p.variants ? p.name.replace(/\d+–\d+ кВт/, v.replace(/K-3PH$/, '') + ' кВт') : p.name; }
    var u = { id: ids.user, name: 'Демо-користувач', phone: '380000000000', email: null, role: 'client', demo: 1 };
    var sites = [
      { id: ids.cafe, name: 'Кав’ярня на Подолі', segment: 'biz', address: 'Київ, Поділ (демо)', tariff: { kind: 'dam', base: 0, adder: 0 }, gen_cost: 25, role: 'owner',
        sim: { kwhDay: 52 }, created_at: at(-90) },
      { id: ids.osbb, name: 'ОСББ «Березовий гай»', segment: 'osbb', address: 'Київ, вул. Прикладна, 12 (демо)', tariff: { kind: 'two', base: HOME_BASE, adder: 0 }, gen_cost: 25, role: 'owner',
        sim: { kwhDay: 46, extra: [[at(-1, 17, 45), at(-1, 20, 45)]] }, created_at: at(-60) }
    ];
    var o1 = ids.osbb + '-o1', o2 = ids.cafe + '-o1', o3 = ids.osbb + '-o2', inst1 = at(-47, 13), inst2 = at(-76, 11);
    var eq1 = [{ id: 1, kind: 'equipment', product_id: 'tmt-3ph', variant: '12K-3PH', qty: 1 }, { id: 2, kind: 'equipment', product_id: 'tmt-051320', qty: 2 }];
    var eq2 = [{ id: 11, kind: 'equipment', product_id: 'mes11ke-15k', qty: 1 }];
    function fill(items){ var sum = 0; items.forEach(function(it){ it.name = pname(it.product_id, it.variant, it.product_id); it.sub = (P && P.byId(it.product_id) ? P.byId(it.product_id).maker + ' · ' : '') + (it.variant || (P && P.byId(it.product_id) ? P.byId(it.product_id).model : '')); it.price_uah = price(it.product_id, it.variant); it.img = img(it.product_id); sum += (it.price_uah || 0) * it.qty; }); return sum; }
    var s1 = fill(eq1), s2 = fill(eq2);
    eq1.push({ id: 3, kind: 'install', name: 'Монтаж і пусконалагодження', sub: 'демо-кошторис: щит, кабелі, налаштування', qty: 1, price_uah: Math.round(s1 * .12 / 100) * 100 });
    eq2.push({ id: 12, kind: 'install', name: 'Монтаж і пусконалагодження', sub: 'демо-кошторис: щит, кабелі, налаштування', qty: 1, price_uah: Math.round(s2 * .1 / 100) * 100 });
    var eq3 = [{ id: 21, kind: 'equipment', product_id: 'tmt-051320', qty: 1 }]; fill(eq3);
    eq3.push({ id: 22, kind: 'install', name: 'Підключення додаткової батареї', sub: 'ціну підтвердить інженер', qty: 1, price_uah: null });
    var orders = [
      { id: o1, number: 'DEMO-0147', site_id: ids.osbb, user_id: u.id, status: 'done', created_at: at(-66, 10), paid_at: at(-55, 15), installed_at: inst1, items: eq1, install: 1,
        log: [{ at: at(-66, 10), status: 'new' }, { at: at(-63, 11), status: 'survey' }, { at: at(-60, 16), status: 'offer' }, { at: at(-57, 12), status: 'contract' }, { at: at(-55, 15), status: 'paid' }, { at: at(-50, 10), status: 'delivered' }, { at: inst1, status: 'installed' }, { at: inst1 + 3 * HOUR, status: 'done' }] },
      { id: o2, number: 'DEMO-0112', site_id: ids.cafe, user_id: u.id, status: 'done', created_at: at(-92, 9), paid_at: at(-84, 12), installed_at: inst2, items: eq2, install: 1,
        log: [{ at: at(-92, 9), status: 'new' }, { at: at(-90, 14), status: 'survey' }, { at: at(-88, 10), status: 'offer' }, { at: at(-86, 18), status: 'contract' }, { at: at(-84, 12), status: 'paid' }, { at: at(-79, 9), status: 'delivered' }, { at: inst2, status: 'installed' }, { at: inst2 + 2 * HOUR, status: 'done' }] },
      { id: o3, number: 'DEMO-0203', site_id: ids.osbb, user_id: u.id, status: 'offer', created_at: at(-6, 19), items: eq3, install: 1, message: 'Хочемо більше годин для ліфта взимку',
        log: [{ at: at(-6, 19), status: 'new' }, { at: at(-4, 12), status: 'survey' }, { at: at(-2, 17), status: 'offer' }] }
    ];
    function war(t, y){ var d = new Date(t); d.setUTCFullYear(d.getUTCFullYear() + y); return d.getTime(); }
    var inv = P && P.byId('tmt-3ph'), bat = P && P.byId('tmt-051320'), aio = P && P.byId('mes11ke-15k');
    var sp1 = spec({ kwh: 2 * ((bat && bat.kwh) || 16.38), kw: 12 }), sp2 = spec({ kwh: (aio && aio.kwh) || 14.336, kw: (aio && aio.kw) || 11 });
    var devices = [
      { id: ids.osbb + '-inv', site_id: ids.osbb, parent_id: null, product_id: 'tmt-3ph', variant: '12K-3PH', kind: 'inverter', name: 'Гібридний інвертор 12 кВт', model: '12K-3PH', serial: 'INV12K-2608-0147', driver: 'sim', spec: sp1, installed_at: inst1, warranty_until: war(inst1, 5), order_item_id: 1, img: img('tmt-3ph'), firmware: 'ARM 1.42 · DSP 2.07' },
      { id: ids.osbb + '-b1', site_id: ids.osbb, parent_id: ids.osbb + '-inv', product_id: 'tmt-051320', kind: 'battery', name: (bat && bat.name) || 'Батарея', model: (bat && bat.model) || '', serial: 'BAT16-2608-0311', driver: 'sim', spec: spec({ kwh: (bat && bat.kwh) || 16.38, kw: 0 }), installed_at: inst1, warranty_until: war(inst1, 10), order_item_id: 2, img: img('tmt-051320') },
      { id: ids.osbb + '-b2', site_id: ids.osbb, parent_id: ids.osbb + '-inv', product_id: 'tmt-051320', kind: 'battery', name: (bat && bat.name) || 'Батарея', model: (bat && bat.model) || '', serial: 'BAT16-2608-0312', driver: 'sim', spec: spec({ kwh: (bat && bat.kwh) || 16.38, kw: 0 }), installed_at: inst1, warranty_until: war(inst1, 10), order_item_id: 2, img: img('tmt-051320') },
      { id: ids.cafe + '-aio', site_id: ids.cafe, parent_id: null, product_id: 'mes11ke-15k', kind: 'aio', name: (aio && aio.name) || 'Моноблок', model: (aio && aio.model) || 'MES11KE-15K', serial: 'MES11-2607-0021', driver: 'sim', spec: sp2, installed_at: inst2, warranty_until: war(inst2, 5), order_item_id: 11, img: img('mes11ke-15k'), firmware: 'EMS 3.1.8' }
    ];
    var eng = 'Інженер з монтажу (демо)', who = 'Демо-користувач';
    var commands = [
      { id: 1, device_id: ids.osbb + '-inv', user_name: eng, kind: 'settings', payload: { mode: 'smart', reserve: 40, gridKw: sp1.maxChargeKw, windows: [] }, status: 'applied', created_at: inst1 + 2 * HOUR, done_at: inst1 + 2 * HOUR, note: 'Пусконалагодження' },
      { id: 2, device_id: ids.osbb + '-inv', user_name: who, kind: 'settings', payload: { mode: 'smart', reserve: 50, gridKw: sp1.maxChargeKw, windows: [] }, prev: { mode: 'smart', reserve: 40 }, status: 'applied', created_at: at(-12, 20, 14), done_at: at(-12, 20, 14) },
      { id: 3, device_id: ids.cafe + '-aio', user_name: eng, kind: 'settings', payload: { mode: 'backup', reserve: 100, gridKw: sp2.maxChargeKw, windows: [] }, status: 'applied', created_at: inst2 + HOUR, done_at: inst2 + HOUR, note: 'Пусконалагодження' },
      { id: 4, device_id: ids.cafe + '-aio', user_name: who, kind: 'settings', payload: { mode: 'smart', reserve: 30, gridKw: sp2.maxChargeKw, windows: [] }, prev: { mode: 'backup', reserve: 100 }, status: 'applied', created_at: at(-74, 9, 30), done_at: at(-74, 9, 30) }
    ];
    var members = [
      { site_id: ids.osbb, user_id: u.id, name: u.name, login: '+380 •• ••• •• 00', role: 'owner' },
      { site_id: ids.osbb, user_id: ids.user + '-acc', name: 'Бухгалтер ОСББ (демо)', login: '+380 •• ••• •• 41', role: 'viewer' },
      { site_id: ids.cafe, user_id: u.id, name: u.name, login: '+380 •• ••• •• 00', role: 'owner' }
    ];
    return { user: u, sites: sites, devices: devices, orders: orders, commands: commands, members: members };
  }

  /* commands → the settings log the simulator reads */
  function logOf(cmds, devId){
    return (cmds || []).filter(function(c){ return c.device_id === devId && c.status === 'applied'; })
      .map(function(c){ return { at: c.done_at || c.created_at, kind: c.kind, payload: c.payload }; })
      .sort(function(a, b){ return a.at - b.at; });
  }
  /* rows of one site (sites, devices, orders, commands, members) → ctx for the views */
  function context(site, devices, orders, commands, events, store, now){
    var sys = devices.filter(function(d){ return d.site_id === site.id && !d.parent_id; }).map(function(d){
      return { dev: d, comps: devices.filter(function(c){ return c.parent_id === d.id; }), log: logOf(commands, d.id) };
    });
    return { site: site, systems: sys, orders: orders, commands: (commands || []).filter(function(c){ return sys.some(function(s){ return s.dev.id === c.device_id; }); }), events: events || [], store: store, now: now };
  }

  return { STEP: STEP, HOUR: HOUR, DAY: DAY, HOME_BASE: HOME_BASE, TRANSMISSION: TRANSMISSION, TARIFFS: TARIFFS, MODES: MODES, RANGES: RANGES, STATUS: STATUS, FLOW: FLOW,
    offset: offset, local: local, dayStart: dayStart, addDays: addDays, dayOf: dayOf, floorStep: floorStep, dayText: dayText, seedOf: seedOf,
    defaultTariff: defaultTariff, cleanTariff: cleanTariff, tariffText: tariffText, hourPrices: hourPrices, damDay: damDay, zoneMult: zoneMult,
    loadHours: loadHours, outagesOn: outagesOn, spec: spec, specFromCatalog: specFromCatalog, defaults: defaults, normalize: normalize, modeText: modeText,
    planDay: planDay, simulate: simulate, siteBuckets: siteBuckets, siteDays: siteDays, totals: totals, blocks: blocks, group: group, settingsAt: settingsAt, acc: acc, add: add, fin: fin,
    energy: energy, live: live, events: events, economics: economics, overview: overview, device: device, siteView: siteView, orderView: orderView, orderTotal: orderTotal,
    demo: demo, logOf: logOf, context: context };
})();
