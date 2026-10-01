/* =====================================================================
   Ready kits — built only from real models in window.PRODUCTS and only
   from compatible pairs: the three-phase low-voltage hybrid inverter with
   the 51,2 V batteries of the same OEM line; all-in-one units and
   portable stations on their own. Kit price = sum of the indicative
   retail prices in products.js. Installation is quoted after a site visit.
   ===================================================================== */
window.KITS = (function(){
  'use strict';
  var P = window.PRODUCTS; if (!P) return null;
  var SEG = { flat: 'Квартира', home: 'Дім', osbb: 'ОСББ', biz: 'Бізнес' };
  var INV_EFF = .92;           // inverter losses when running from the battery
  var DOD = .9;                // usable share when the datasheet gives no usable capacity
  var BAT = 'tmt-051320', INV3 = 'tmt-3ph';
  var PORTABLE = ['e1000', 'e1500', 'e2400', 'e3600', 'f5000'];

  /* what people usually want to keep running: average draw and start-up peak, W */
  var LOADS = {
    flat: [['fridge', 'Холодильник', 80, 600, 1], ['light', 'Світло', 40, 60, 1], ['router', 'Роутер і зв’язок', 15, 15, 1], ['laptop', 'Ноутбук', 60, 90, 1], ['tv', 'Телевізор', 80, 120, 0], ['boiler', 'Бойлер', 700, 2000, 0], ['stove', 'Електроплита', 800, 2000, 0], ['ac', 'Кондиціонер', 700, 1200, 0]],
    home: [['fridge', 'Холодильник', 80, 600, 1], ['light', 'Світло', 80, 120, 1], ['heat', 'Газовий котел', 100, 150, 1], ['pump', 'Насос водопостачання', 150, 1500, 1], ['router', 'Роутер, ТВ, ноутбук', 150, 250, 1], ['boiler', 'Бойлер', 800, 2000, 0], ['ac', 'Кондиціонер', 800, 1300, 0], ['tools', 'Майстерня, інструмент', 600, 2500, 0]],
    osbb: [['lift', 'Ліфт', 1500, 11000, 1], ['pumps', 'Насоси підкачки води', 1500, 4000, 1], ['light', 'Освітлення під’їздів', 300, 500, 1], ['itp', 'ІТП, циркуляційні насоси', 800, 1500, 0], ['cctv', 'Домофон і відеонагляд', 50, 80, 1]],
    biz: [['cash', 'Каса й термінали', 100, 200, 1], ['light', 'Освітлення', 400, 600, 1], ['cold', 'Холодильні вітрини', 800, 2500, 0], ['pc', 'Комп’ютери, сервер, зв’язок', 500, 800, 1], ['ac', 'Кондиціонування', 1500, 3000, 0]]
  };

  var K = [
    { id: 'flat-2k', seg: 'flat', name: 'Резерв для квартири', what: 'холодильник, світло, роутер і ноутбук', items: [['e2400', null, 1]], load: 250, install: false,
      pitch: 'Портативна станція 2 кВт·год: стоїть поруч із технікою, заряджається від розетки й сама перемикається, коли зникає світло.' },
    { id: 'flat-5k', seg: 'flat', name: 'Квартира з бойлером і плитою', what: 'бойлер або електроплита, холодильник, світло', items: [['f5000', null, 1]], load: 700, install: false,
      pitch: 'Найпотужніша станція лінійки: 7,2 кВт на виході тягнуть бойлер, електроплиту чи насос.' },
    { id: 'home-aio', seg: 'home', name: 'Моноблок для дому', what: 'холодильник, світло, котел, насос, роутер і ТВ', items: [['mes11ke-15k', null, 1]], load: 600, install: true, phases: 1,
      pitch: 'Інвертор 11 кВт і батарея 14,3 кВт·год в одній шафі: заводська комутація, перемикання на резерв за 10 мс.' },
    { id: 'home-3ph', seg: 'home', name: 'Дім на три фази', what: 'увесь дім, зокрема трифазні насоси й бойлер', items: [[INV3, '10K-3PH', 1], [BAT, null, 1]], load: 700, install: true, phases: 3,
      pitch: 'Трифазний гібридний інвертор 10 кВт і настінна батарея 16,4 кВт·год. Батареї можна додавати пізніше — до 16 шт.' },
    { id: 'osbb-12', seg: 'osbb', name: 'ОСББ: насоси й освітлення', what: 'насоси підкачки води, освітлення під’їздів, домофон', items: [[INV3, '12K-3PH', 1], [BAT, null, 2]], load: 2000, install: true, phases: 3,
      pitch: 'Трифазний інвертор 12 кВт і дві батареї по 16,4 кВт·год: вода на верхніх поверхах і світло в під’їздах під час відключень.' },
    { id: 'osbb-20', seg: 'osbb', name: 'ОСББ: ліфт, насоси й освітлення', what: 'ліфт, насоси, освітлення, ІТП', items: [[INV3, '20K-3PH', 1], [BAT, null, 3]], load: 3500, install: true, phases: 3,
      pitch: 'Інвертор 20 кВт з подвійним запасом на пуск ліфта і три батареї по 16,4 кВт·год.' },
    { id: 'biz-aio', seg: 'biz', name: 'Магазин або офіс', what: 'каса, світло, комп’ютери, зв’язок', items: [['mes11ke-15k', null, 1]], load: 1200, install: true, phases: 1,
      pitch: 'Моноблок 11 кВт · 14,3 кВт·год: каса й світло працюють без генератора, без шуму й вихлопу.' },
    { id: 'biz-24', seg: 'biz', name: 'Бізнес на три фази', what: 'вітрини, кондиціонування, каса, світло', items: [[INV3, '24K-3PH', 1], [BAT, null, 4]], load: 5000, install: true, phases: 3,
      pitch: 'Інвертор 24 кВт і чотири батареї по 16,4 кВт·год — 65 кВт·год запасу. Інвертори ставляться паралельно, до 8 шт.' }
  ];

  function variant(p, model){ if (!model || !p.variants) return null; for (var i = 0; i < p.variants.length; i++) if (p.variants[i].model === model) return p.variants[i]; return null; }
  function line(it){
    var p = P.byId(it[0]), v = variant(p, it[1]), qty = it[2] || 1;
    var price = v ? v.price : p.price, kwh = v && v.kwh != null ? v.kwh : p.kwh, kw = v && v.kw != null ? v.kw : p.kw;
    return { p: p, v: v, qty: qty, id: p.id, model: v ? v.model : p.model, name: v ? p.name.replace(/\d+–\d+ кВт/, v.kw + ' кВт') : p.name,
      price: price, sum: price != null ? price * qty : null, kwh: kwh || 0, usable: p.usable && !v ? p.usable : (kwh || 0) * DOD, kw: kw || 0, img: p.img[0] || null, stock: p.stock };
  }
  var RANK = { 'in': 0, pre: 1, order: 2 };
  function summary(kit){
    var L = kit.items.map(line), s = { lines: L, price: 0, priced: true, kwh: 0, usable: 0, kw: 0, stock: 'in' };
    L.forEach(function(l){
      if (l.sum == null) s.priced = false; else s.price += l.sum;
      if (l.p.cat !== 'inverter') { s.kwh += l.kwh * l.qty; s.usable += l.usable * l.qty; }
      if (l.p.cat === 'inverter' || l.p.cat === 'aio' || l.p.cat === 'portable') s.kw += l.kw * l.qty;
      if ((RANK[l.stock] || 2) > (RANK[s.stock] || 0)) s.stock = l.stock;
    });
    s.img = (L.filter(function(l){ return l.p.cat !== 'inverter'; })[0] || L[0]).img;
    return s;
  }
  /* hours on battery at an average draw of `w` watts */
  function hours(s, w){ return w > 0 ? s.usable * INV_EFF / (w / 1000) : 0; }
  function hoursTxt(h){ if (!isFinite(h) || h <= 0) return '—'; if (h < 1) return '≈ ' + Math.max(10, Math.round(h * 6) * 10) + ' хв'; if (h >= 48) return 'понад 2 доби'; return '≈ ' + (h < 10 ? Math.round(h * 2) / 2 : Math.round(h)).toLocaleString('uk-UA') + ' год'; }

  /* a system from real models for any need: cap — kWh to store, pow — kW peak */
  function compose(o){
    var who = o.who, pow = Math.max(.3, o.pow || 1), notes = [];
    /* usable — kWh the battery must deliver; cap — nominal kWh (calculator) */
    var use = o.usable != null ? Math.max(.2, o.usable) : Math.max(.3, o.cap || 1) * DOD, cap = use / DOD;
    if (who === 'flat' || (cap <= 5.2 && pow <= 7.2 && who !== 'osbb' && o.phases !== 3 && o.portable !== false && (who !== 'biz' && cap <= 3.1))) {
      var pick = PORTABLE.map(P.byId).filter(function(p){ return p.kwh * DOD >= use * .95 && p.kw >= pow * .95; })[0] || P.byId('f5000');
      if (pick.kwh * DOD < use * .95) notes.push('Потрібно більше, ніж дає одна станція: ємність F5000 можна розширити додатковою батареєю — підберемо.');
      return mk(who, [[pick.id, null, 1]], notes, false);
    }
    var mu = 14.336 * DOD;   /* usable kWh of one all-in-one unit; up to 6 run in parallel on one phase */
    if (who !== 'osbb' && o.phases !== 3) {
      var nm = Math.max(Math.ceil(use / (mu * 1.02) - 1e-9), Math.ceil(pow / 11 - 1e-9), 1);
      if (nm <= 6) { if (nm > 1) notes.push(nm + (nm < 5 ? ' моноблоки працюють' : ' моноблоків працюють') + ' паралельно на одній фазі.'); return mk(who, [['mes11ke-15k', null, nm]], notes, true); }
    }
    var inv = P.byId(INV3), vs = inv.variants.filter(function(v){ return v.price != null; }).sort(function(a, b){ return a.kw - b.kw; });
    var n = Math.max(1, Math.ceil(pow / 24 - 1e-9)), per = pow / n, v = vs.filter(function(x){ return x.kw >= per - 1e-9 && x.kw >= 10; })[0] || vs[vs.length - 1];
    if (n > 8) { n = 8; notes.push('Понад 190 кВт — індивідуальний проєкт; ця збірка — орієнтир.'); }
    var bu = P.byId(BAT).usable || 16.38 * DOD, nb = Math.max(1, Math.ceil(use / bu - 1e-9));
    if (nb > 16 * n) { nb = 16 * n; notes.push('Для такої ємності краще високовольтні стійки — підберемо під замовлення.'); }
    if (n > 1) notes.push(n + (n < 5 ? ' інвертори' : ' інверторів') + ' працюють паралельно.');
    return mk(who, [[INV3, v.model, n], [BAT, null, nb]], notes, true);
  }
  function mk(who, items, notes, install){ return { id: 'custom', seg: who, name: 'Система під ваші потреби', items: items, notes: notes, install: install, custom: true }; }

  return { SEG: SEG, LOADS: LOADS, list: K, byId: function(id){ for (var i = 0; i < K.length; i++) if (K[i].id === id) return K[i]; return null; },
    forSeg: function(seg){ return K.filter(function(k){ return !seg || seg === 'all' || k.seg === seg; }); },
    line: line, summary: summary, hours: hours, hoursTxt: hoursTxt, compose: compose, RANK: RANK };
})();
