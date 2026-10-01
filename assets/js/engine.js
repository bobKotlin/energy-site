/* =====================================================================
   BESS engine — pure functions, no DOM. Runs the same on the backend.
   Full connection: the whole site runs through the storage. The site has
   a daily load; the storage charges in cheap hours and covers the load in
   expensive ones (never more than the site uses, nothing goes back to the
   grid). prices → load → plan → econ (bill without / with storage) ·
   configure (physical blocks) · budget.
   ===================================================================== */
window.BESS = (function(){
  'use strict';
  var D = window.DAM_DATA || { days: {} };
  /* Transmission tariff of NPC Ukrenergo from 01.04.2026, UAH/kWh excl. VAT (NERC). */
  var TRANSMISSION = 0.74291;
  /* Household fixed price (PSO) 4.32 UAH/kWh until 31.10.2026; zone coefficients:
     two-zone night 23–7 ×0.5; three-zone night 23–7 ×0.4, peak 8–11 and 20–22 ×1.5. */
  var HOME_BASE = 4.32;
  function zoneMult(kind, h){
    var night = h >= 23 || h < 7;
    if (kind === 'two') return night ? 0.5 : 1;
    if (night) return 0.4;
    return (h >= 8 && h < 11) || (h >= 20 && h < 22) ? 1.5 : 1;
  }

  /* ---------- market data ---------- */
  function dates(){ return Object.keys(D.days).filter(function(k){ return D.days[k] && D.days[k].length === 24; }).sort(); }
  function lastDates(n){ var ds = dates(); return ds.slice(Math.max(0, ds.length - n)); }
  /* hourly DAM in UAH/kWh for a period: a date 'YYYY-MM-DD', 'last', 'avg7', 'avg30' */
  function dam(period){
    var ds = dates(); if (!ds.length) return null;
    if (D.days[period]) return D.days[period].map(function(v){ return v / 1000; });
    if (period === 'avg7' || period === 'avg30') {
      var sel = lastDates(period === 'avg7' ? 7 : 30), out = [];
      for (var h = 0; h < 24; h++) { var s = 0; sel.forEach(function(d){ s += D.days[d][h]; }); out.push(s / sel.length / 1000); }
      return out;
    }
    return D.days[ds[ds.length - 1]].map(function(v){ return v / 1000; });
  }
  function periodInfo(period){
    var ds = dates(), last = ds[ds.length - 1];
    if (period === 'avg7' || period === 'avg30') { var sel = lastDates(period === 'avg7' ? 7 : 30); return { from: sel[0], to: sel[sel.length - 1], n: sel.length }; }
    var d = D.days[period] ? period : last; return { from: d, to: d, n: 1 };
  }
  /* Price the site pays each hour. Households: the fixed tariff with zone
     coefficients (VAT included). Business: the average day-ahead price of
     the last 30 days + transmission, excl. VAT. Distribution, the supplier's
     margin and VAT are the same in every hour, so they don't move the
     schedule and barely change the savings — left out on purpose rather
     than guessed. */
  function prices(p, date){
    var out = [], base = p.base || HOME_BASE;
    if (p.who === 'home') { for (var h = 0; h < 24; h++) out.push(base * zoneMult(p.tariff, h)); return out; }
    var m = dam(date || 'avg30');
    for (var k = 0; k < 24; k++) out.push(m[k] + TRANSMISSION);
    return out;
  }

  /* ---------- the site: consumption profile ----------
     flat — the same every hour (24/7); work — full load in working hours
     [from, to) (wraps over midnight when to ≤ from), lighting at night
     (19:00–6:00) ~12 %, standby the rest ~4 %; best — most of the energy
     falls into the expensive hours (weight grows with the price), where
     the storage saves the most. */
  var PROFILES = { flat: 'Цілодобово', work: 'Робочі години', best: 'Найвигідніше' };
  function shape(p, pr){
    var prof = PROFILES[p.prof] ? p.prof : 'flat', w = [], h;
    if (prof === 'work') {
      var a = p.from != null ? p.from : 6, b = p.to != null ? p.to : 12;
      for (h = 0; h < 24; h++) { var on = a < b ? h >= a && h < b : h >= a || h < b; w.push(on ? 1 : h >= 19 || h < 6 ? .12 : .04); }
    } else if (prof === 'best') {
      var mn = Math.min.apply(null, pr), sp = Math.max.apply(null, pr) - mn;
      for (h = 0; h < 24; h++) { var k = sp > 1e-9 ? (pr[h] - mn) / sp : 1; w.push(.05 + k * k); }
    } else for (h = 0; h < 24; h++) w.push(1);
    return w;
  }
  /* kWh used in every hour of the day, from the monthly consumption */
  function load(p, pr){
    var sh = shape(p, pr || prices(p)), t = 0, i;
    for (i = 0; i < 24; i++) t += sh[i];
    var d = (p.cons > 0 ? p.cons : OPTS[p.who in OPTS ? p.who : 'home'].cons.def) / 30.4;
    return sh.map(function(v){ return v / t * d; });
  }

  /* ---------- schedule ----------
     Greedy pairing on a periodic day: take the most profitable pair
     "charge in hour i → cover the load in hour j", move as much energy as
     power, capacity on the way, the load in hour j and the cycle limit
     allow, repeat. Charging counts at the grid side (≤ P), discharge never
     exceeds the site's load in that hour. */
  /* A kWh goes through the storage only if the price difference, after the
     losses, is worth at least this much: small gaps are not worth the wear.
     At most two full cycles a day. */
  var MIN_SPREAD = 0.5, MAX_CYCLES = 2, CYCLE_LIFE = 6000, CAL_LIFE = 15;
  function optimize(pr, E, P, rte, cyc, cap){
    var ch = [], dis = [], s = [], h;
    for (h = 0; h < 24; h++) { ch.push(0); dis.push(0); s.push(0); }
    /* small steps + ties to the least used hour: equal night hours share the charge */
    var thr = 0, TH = Math.max(0, cyc * E), PC = P * rte, WEAR = MIN_SPREAD, STEP = Math.max(E / 16, 1e-6);
    for (var it = 0; it < 600 && TH - thr > 1e-7; it++) {
      var bi = -1, bj = -1, bx = 0, bp = 1e-6 + 1e-9;
      for (var i = 0; i < 24; i++) {
        var a = PC - ch[i]; if (a <= 1e-7 || dis[i] > 1e-9) continue;
        var pi = pr[i] / rte, mx = 0;
        for (var k = 1; k < 24; k++) {
          var j = (i + k) % 24; if (s[j] > mx) mx = s[j];
          if (E - mx <= 1e-7) break;
          if (ch[j] > 1e-9) continue;
          var b = Math.min(P, cap[j]) - dis[j]; if (b <= 1e-7) continue;
          var gain = pr[j] - pi - WEAR; if (gain < bp - 1e-9) continue;
          if (gain <= bp + 1e-9 && bi >= 0 && ch[i] >= ch[bi] - 1e-9) continue;
          var x = Math.min(a, b, E - mx, TH - thr, STEP); if (x <= 1e-7) continue;
          bp = gain; bi = i; bj = j; bx = x;
        }
      }
      if (bi < 0) break;
      ch[bi] += bx; dis[bj] += bx; thr += bx;
      for (var k2 = 1; k2 < 24; k2++) { var t = (bi + k2) % 24; s[t] += bx; if (t === bj) break; }
    }
    var stored = s.slice(); stored.push(s[0]);
    return { chg: ch, dis: dis, stored: stored };
  }
  function plan(pr, p, L){
    var E = p.cap * p.dod, o = optimize(pr, E, Math.max(0.1, p.pow), p.rte, MAX_CYCLES, L || load(p, pr)), socMin = (1 - p.dod) / 2;
    return { chg: o.chg, dis: o.dis, soc: o.stored.map(function(e){ return Math.max(0, Math.min(1, socMin + e / p.cap)); }) };
  }
  /* bill of the day without and with the storage, hour by hour */
  function econ(pr, sch, p, L){
    L = L || load(p, pr);
    var o = { load: L, fromGrid: [], fromBat: [], toBat: [], cost: [], gain: [], save: [], billA: [], billB: [], C: 0, G: 0, base: 0, after: 0, use: 0, bat: 0 };
    for (var h = 0; h < 24; h++) {
      var tb = sch.chg[h] / p.rte, fg = Math.max(0, L[h] - sch.dis[h]), c = tb * pr[h], g = sch.dis[h] * pr[h];
      o.fromGrid.push(fg); o.fromBat.push(sch.dis[h]); o.toBat.push(tb);
      o.cost.push(c); o.gain.push(g); o.save.push(g - c); o.billA.push(L[h] * pr[h]); o.billB.push((fg + tb) * pr[h]);
      o.C += c; o.G += g; o.base += L[h] * pr[h]; o.after += (fg + tb) * pr[h]; o.use += L[h]; o.bat += sch.dis[h];
    }
    o.net = o.G - o.C;
    return o;
  }
  function day(p, date){ var pr = prices(p, date), L = load(p, pr), sch = plan(pr, p, L); return { pr: pr, L: L, sch: sch, ec: econ(pr, sch, p, L) }; }
  /* A year = the typical day × 365 (households: the tariff day; business:
     the day of 30-day average prices). Conservative for business: averaging
     smooths out the sharpest price spikes. */
  function annual(p){ var d = day(p).ec; return { net: d.net * 365, base: d.base * 365, after: d.after * 365, dayNet: d.net, dayBase: d.base, dayAfter: d.after }; }
  /* full cycles a day and how many years the cells last at that pace */
  function wear(p, ec){ var E = p.cap * p.dod, c = E > 0 ? ec.bat / E : 0; return { cycles: c, life: c > 0 ? Math.min(CAL_LIFE, CYCLE_LIFE / (c * 365)) : CAL_LIFE }; }
  function yearly(p){ return annual(p).net; }
  /* hours the site keeps running on a full storage at its average load */
  function backup(p){ var L = load(p), avg = L.reduce(function(a, b){ return a + b; }, 0) / 24; return avg > 0 ? p.cap * p.dod / avg : 0; }
  /* turnkey price, UAH per kWh of capacity (inverter, installation, design included) */
  function invest(p){ return p.cap * (p.cost > 0 ? p.cost : OPTS[p.who in OPTS ? p.who : 'home'].cost.def); }

  /* ---------- typical values per site type (the quick choices) ----------
     cons — consumption per month, kWh; cap — kWh; pow — kW; cost — UAH per
     kWh turnkey. Any value can be typed in instead. */
  var OPTS = {
    home: { prof: 'flat', cons: { list: [200, 350, 600, 1000], def: 350 }, cap: { list: [5.12, 10.24, 15.36, 20.48], def: 10.24 }, pow: { list: [5, 6, 8, 10, 12], def: 6 }, cost: { list: [11000, 13500, 16000], def: 13500 } },
    biz:  { prof: 'work', cons: { list: [3000, 12000, 30000, 60000], def: 12000 }, cap: { list: [51.2, 102.4, 215, 430], def: 215 }, pow: { list: [25, 50, 100, 200], def: 100 }, cost: { list: [10000, 13000, 16000], def: 13000 } },
    ind:  { prof: 'flat', cons: { list: [300000, 1000000, 3000000, 6000000], def: 1000000 }, cap: { list: [2500, 5000, 10000, 20000], def: 5000 }, pow: { list: [1250, 2500, 5000, 10000], def: 2500 }, cost: { list: [8000, 10000, 12000], def: 10000 } }
  };
  var RTE = { list: [.9, .93, .95], def: .93 }, DOD = { list: [.8, .9, 1], def: .9 };
  /* typical power for a capacity when only kWh is known */
  function defaultPow(who, cap){ return who === 'home' ? Math.max(5, Math.min(12, Math.round(cap / 1.7))) : who === 'biz' ? Math.max(25, Math.round(cap * 100 / 215 / 25) * 25) : Math.max(1250, Math.round(cap / 2 / 250) * 250); }

  /* ---------- system sizing: which physical blocks this budget buys ---------- */
  function pickUp(v, list){ for (var i = 0; i < list.length; i++) if (list[i] >= v - 1e-9) return list[i]; return list[list.length - 1]; }
  function configure(p){
    var cap = p.cap, pow = p.pow, items = [], kind;
    if (p.who === 'home' || cap <= 120) {
      kind = 'home';
      var nm = Math.max(1, Math.ceil(cap / 5.12 - 1e-9));
      var ni = pow <= 12 ? 1 : Math.ceil(pow / 24 - 1e-9), invKw = pow <= 12 ? pickUp(pow, [5, 6, 8, 10, 12]) : pickUp(pow / ni, [8, 10, 12, 15, 18, 20, 24]);
      items.push({ key: 'homeModule', qty: nm, cap: 5.12 }, { key: 'hybridInverter', qty: ni, kw: invKw }, { key: 'switchboard', qty: 1 }, { key: 'meter', qty: 1 });
      return { kind: kind, items: items, cap: nm * 5.12, pow: ni * invKw };
    }
    if (cap <= 1300 && pow <= 650) {
      kind = 'cabinet';
      var nc = Math.max(Math.ceil(cap / 215 - 1e-9), Math.ceil(pow / 100 - 1e-9), 1);
      items.push({ key: 'cabinet', qty: nc, cap: 215, kw: 100 });
      if (nc * 100 >= 400) items.push({ key: 'transformer', qty: 1, kva: pickUp(nc * 100 * 1.15, [400, 630, 1000, 1250, 1600, 2500]) });
      items.push({ key: 'ems', qty: 1 }, { key: 'switchboard', qty: 1 }, { key: 'meter', qty: 1 });
      return { kind: kind, items: items, cap: nc * 215, pow: nc * 100 };
    }
    kind = 'container';
    var nk = Math.max(1, Math.ceil(cap / 2500 - 1e-9)), np = Math.max(1, Math.ceil(pow / 1250 - 1e-9));
    items.push({ key: 'container', qty: nk, cap: 2500 }, { key: 'pcs', qty: np, kw: 1250 }, { key: 'transformer', qty: np, kva: 1600 }, { key: 'ems', qty: 1 }, { key: 'switchboard', qty: 1, mv: true }, { key: 'meter', qty: 1 });
    return { kind: kind, items: items, cap: nk * 2500, pow: np * 1250 };
  }
  /* Typical cost structure per system class — DEMO shares until the partner price list arrives. */
  var SHARES = {
    home:      { homeModule: .55, hybridInverter: .21, switchboard: .05, meter: .02, install: .11, design: .06 },
    cabinet:   { cabinet: .70, ems: .04, switchboard: .05, meter: .02, install: .12, design: .07 },
    cabinetTr: { cabinet: .64, transformer: .07, ems: .04, switchboard: .04, meter: .02, install: .12, design: .07 },
    container: { container: .55, pcs: .14, transformer: .08, ems: .03, switchboard: .04, meter: .01, install: .09, design: .06 }
  };
  function budget(p, cfg){
    var total = invest(p), hasTr = cfg.items.some(function(i){ return i.key === 'transformer'; });
    var sh = SHARES[cfg.kind === 'cabinet' && hasTr ? 'cabinetTr' : cfg.kind], lines = [];
    cfg.items.forEach(function(it){ lines.push({ key: it.key, share: sh[it.key] || 0, amount: total * (sh[it.key] || 0), item: it }); });
    lines.push({ key: 'install', share: sh.install, amount: total * sh.install });
    lines.push({ key: 'design', share: sh.design, amount: total * sh.design });
    return { total: total, lines: lines };
  }
  return { TRANSMISSION: TRANSMISSION, HOME_BASE: HOME_BASE, MIN_SPREAD: MIN_SPREAD, CYCLE_LIFE: CYCLE_LIFE, OPTS: OPTS, RTE: RTE, DOD: DOD, PROFILES: PROFILES, dates: dates, dam: dam, periodInfo: periodInfo,
    prices: prices, load: load, plan: plan, econ: econ, day: day, annual: annual, yearly: yearly, backup: backup, wear: wear, invest: invest, zoneMult: zoneMult,
    defaultPow: defaultPow, configure: configure, budget: budget };
})();
