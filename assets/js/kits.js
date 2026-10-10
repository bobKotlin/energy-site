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
  /* tx(uk, en) of the pages (core.js); the platform and agent workers bundle this file without it — Ukrainian there */
  var tx = typeof window.tx === 'function' ? window.tx : function(uk){ return uk; };
  var LOCALE = tx('uk-UA', 'en-GB');
  var SEG = { flat: tx('Квартира', 'Flat'), home: tx('Дім', 'Home'), osbb: tx('ОСББ', 'Apartment building'), biz: tx('Бізнес', 'Business') };
  var INV_EFF = .92;           // inverter losses when running from the battery
  var DOD = .9;                // usable share when the datasheet gives no usable capacity
  var BAT = 'tmt-051320', INV3 = 'tmt-3ph';
  var PORTABLE = ['e1000', 'e1500', 'e2400', 'e3600', 'f5000'];

  /* what people usually want to keep running: average draw and start-up peak, W */
  var LOADS = {
    flat: [['fridge', tx('Холодильник', 'Fridge'), 80, 600, 1], ['light', tx('Світло', 'Lights'), 40, 60, 1], ['router', tx('Роутер і зв’язок', 'Router and comms'), 15, 15, 1], ['laptop', tx('Ноутбук', 'Laptop'), 60, 90, 1], ['tv', tx('Телевізор', 'TV'), 80, 120, 0], ['boiler', tx('Бойлер', 'Water heater'), 700, 2000, 0], ['stove', tx('Електроплита', 'Electric cooker'), 800, 2000, 0], ['ac', tx('Кондиціонер', 'Air conditioner'), 700, 1200, 0]],
    home: [['fridge', tx('Холодильник', 'Fridge'), 80, 600, 1], ['light', tx('Світло', 'Lights'), 80, 120, 1], ['heat', tx('Газовий котел', 'Gas boiler'), 100, 150, 1], ['pump', tx('Насос водопостачання', 'Water pump'), 150, 1500, 1], ['router', tx('Роутер, ТВ, ноутбук', 'Router, TV, laptop'), 150, 250, 1], ['boiler', tx('Бойлер', 'Water heater'), 800, 2000, 0], ['ac', tx('Кондиціонер', 'Air conditioner'), 800, 1300, 0], ['tools', tx('Майстерня, інструмент', 'Workshop, power tools'), 600, 2500, 0]],
    osbb: [['lift', tx('Ліфт', 'Lift'), 1500, 11000, 1], ['pumps', tx('Насоси підкачки води', 'Water booster pumps'), 1500, 4000, 1], ['light', tx('Освітлення під’їздів', 'Stairwell lighting'), 300, 500, 1], ['itp', tx('ІТП, циркуляційні насоси', 'Heating substation, circulation pumps'), 800, 1500, 0], ['cctv', tx('Домофон і відеонагляд', 'Door entry and CCTV'), 50, 80, 1]],
    biz: [['cash', tx('Каса й термінали', 'Till and card terminals'), 100, 200, 1], ['light', tx('Освітлення', 'Lighting'), 400, 600, 1], ['cold', tx('Холодильні вітрини', 'Refrigerated display cases'), 800, 2500, 0], ['pc', tx('Комп’ютери, сервер, зв’язок', 'Computers, server, comms'), 500, 800, 1], ['ac', tx('Кондиціонування', 'Air conditioning'), 1500, 3000, 0]]
  };

  var K = [
    { id: 'flat-2k', seg: 'flat', name: tx('Резерв для квартири', 'Backup for a flat'), what: tx('холодильник, світло, роутер і ноутбук', 'fridge, lights, router and laptop'), items: [['e2400', null, 1]], load: 250, install: false,
      pitch: tx('Портативна станція 2 кВт·год: стоїть поруч із технікою, заряджається від розетки й сама перемикається, коли зникає світло.', 'A 2 kWh portable power station: it sits next to your appliances, charges from a socket and switches over by itself when the power goes out.') },
    { id: 'flat-5k', seg: 'flat', name: tx('Квартира з бойлером і плитою', 'Flat with a water heater and cooker'), what: tx('бойлер або електроплита, холодильник, світло', 'water heater or electric cooker, fridge, lights'), items: [['f5000', null, 1]], load: 700, install: false,
      pitch: tx('Найпотужніша станція лінійки: 7,2 кВт на виході тягнуть бойлер, електроплиту чи насос.', 'The most powerful station in the line-up: 7.2 kW of output runs a water heater, an electric cooker or a pump.') },
    { id: 'home-aio', seg: 'home', name: tx('Моноблок для дому', 'All-in-one for a home'), what: tx('холодильник, світло, котел, насос, роутер і ТВ', 'fridge, lights, boiler, pump, router and TV'), items: [['mes11ke-15k', null, 1]], load: 600, install: true, phases: 1,
      pitch: tx('Інвертор 11 кВт і батарея 14,3 кВт·год в одній шафі: заводська комутація, перемикання на резерв за 10 мс.', 'An 11 kW inverter and a 14.3 kWh battery in one cabinet: factory wiring, switchover to backup in 10 ms.') },
    { id: 'home-3ph', seg: 'home', name: tx('Дім на три фази', 'Three-phase home'), what: tx('увесь дім, зокрема трифазні насоси й бойлер', 'the whole home, including three-phase pumps and the water heater'), items: [[INV3, '10K-3PH', 1], [BAT, null, 1]], load: 700, install: true, phases: 3,
      pitch: tx('Трифазний гібридний інвертор 10 кВт і настінна батарея 16,4 кВт·год. Батареї можна додавати пізніше — до 16 шт.', 'A 10 kW three-phase hybrid inverter and a 16.4 kWh wall battery. You can add batteries later — up to 16.') },
    { id: 'osbb-12', seg: 'osbb', name: tx('ОСББ: насоси й освітлення', 'Apartment building: pumps and lighting'), what: tx('насоси підкачки води, освітлення під’їздів, домофон', 'water booster pumps, stairwell lighting, door entry'), items: [[INV3, '12K-3PH', 1], [BAT, null, 2]], load: 2000, install: true, phases: 3,
      pitch: tx('Трифазний інвертор 12 кВт і дві батареї по 16,4 кВт·год: вода на верхніх поверхах і світло в під’їздах під час відключень.', 'A 12 kW three-phase inverter and two 16.4 kWh batteries: water on the upper floors and lights in the stairwells during outages.') },
    { id: 'osbb-20', seg: 'osbb', name: tx('ОСББ: ліфт, насоси й освітлення', 'Apartment building: lift, pumps and lighting'), what: tx('ліфт, насоси, освітлення, ІТП', 'lift, pumps, lighting, heating substation'), items: [[INV3, '20K-3PH', 1], [BAT, null, 3]], load: 3500, install: true, phases: 3,
      pitch: tx('Інвертор 20 кВт з подвійним запасом на пуск ліфта і три батареї по 16,4 кВт·год.', 'A 20 kW inverter with double headroom for starting the lift, and three 16.4 kWh batteries.') },
    { id: 'biz-aio', seg: 'biz', name: tx('Магазин або офіс', 'Shop or office'), what: tx('каса, світло, комп’ютери, зв’язок', 'till, lights, computers, comms'), items: [['mes11ke-15k', null, 1]], load: 1200, install: true, phases: 1,
      pitch: tx('Моноблок 11 кВт · 14,3 кВт·год: каса й світло працюють без генератора, без шуму й вихлопу.', 'An 11 kW · 14.3 kWh all-in-one: the till and lights keep working without a generator, with no noise or fumes.') },
    { id: 'biz-24', seg: 'biz', name: tx('Бізнес на три фази', 'Three-phase business'), what: tx('вітрини, кондиціонування, каса, світло', 'display cases, air conditioning, till, lights'), items: [[INV3, '24K-3PH', 1], [BAT, null, 4]], load: 5000, install: true, phases: 3,
      pitch: tx('Інвертор 24 кВт і чотири батареї по 16,4 кВт·год — 65 кВт·год запасу. Інвертори ставляться паралельно, до 8 шт.', 'A 24 kW inverter and four 16.4 kWh batteries — 65 kWh of storage. Inverters can run in parallel, up to 8.') }
  ];

  function variant(p, model){ if (!model || !p.variants) return null; for (var i = 0; i < p.variants.length; i++) if (p.variants[i].model === model) return p.variants[i]; return null; }
  /* «Гібридний інвертор 8–24 кВт» → «… 10 кВт», «High-voltage rack 20–41 kWh» → «… 25.6 kWh» */
  function vname(p, v){ return p.name.replace(/\d+(–\d+)? (кВт(·год)?|kWh?)/, v.kw != null ? v.kw.toLocaleString(LOCALE) + tx(' кВт', ' kW') : v.kwh != null ? v.kwh.toLocaleString(LOCALE) + tx(' кВт·год', ' kWh') : '$&'); }
  function line(it){
    var p = P.byId(it[0]), v = variant(p, it[1]), qty = it[2] || 1;
    var price = v ? v.price : p.price, kwh = v && v.kwh != null ? v.kwh : p.kwh, kw = v && v.kw != null ? v.kw : p.kw;
    return { p: p, v: v, qty: qty, id: p.id, model: v ? v.model : p.model, name: v ? vname(p, v) : p.name,
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
  function hoursTxt(h){ if (!isFinite(h) || h <= 0) return '—'; if (h < 1) return '≈ ' + Math.max(10, Math.round(h * 6) * 10) + tx(' хв', ' min'); if (h >= 48) return tx('понад 2 доби', 'over 2 days'); return '≈ ' + (h < 10 ? Math.round(h * 2) / 2 : Math.round(h)).toLocaleString(LOCALE) + tx(' год', ' h'); }

  /* a system from real models for any need: cap — kWh to store, pow — kW peak */
  function compose(o){
    var who = o.who, pow = Math.max(.3, o.pow || 1), notes = [];
    /* usable — kWh the battery must deliver; cap — nominal kWh (calculator) */
    var use = o.usable != null ? Math.max(.2, o.usable) : Math.max(.3, o.cap || 1) * DOD, cap = use / DOD;
    if (who === 'flat' || (cap <= 5.2 && pow <= 7.2 && who !== 'osbb' && o.phases !== 3 && o.portable !== false && (who !== 'biz' && cap <= 3.1))) {
      var pick = PORTABLE.map(P.byId).filter(function(p){ return p.kwh * DOD >= use * .95 && p.kw >= pow * .95; })[0] || P.byId('f5000');
      if (pick.kwh * DOD < use * .95) notes.push(tx('+ батарея розширення', '+ extension battery'));
      return mk(who, [[pick.id, null, 1]], notes, false);
    }
    var mu = 14.336 * DOD;   /* usable kWh of one all-in-one unit; up to 6 run in parallel on one phase */
    if (who !== 'osbb' && o.phases !== 3) {
      var nm = Math.max(Math.ceil(use / (mu * 1.02) - 1e-9), Math.ceil(pow / 11 - 1e-9), 1);
      if (nm <= 6) { if (nm > 1) notes.push(tx(nm + (nm < 5 ? ' моноблоки' : ' моноблоків') + ' паралельно', nm + ' units in parallel')); return mk(who, [['mes11ke-15k', null, nm]], notes, true); }
    }
    var inv = P.byId(INV3), vs = inv.variants.filter(function(v){ return v.price != null; }).sort(function(a, b){ return a.kw - b.kw; });
    var n = Math.max(1, Math.ceil(pow / 24 - 1e-9)), per = pow / n, v = vs.filter(function(x){ return x.kw >= per - 1e-9 && x.kw >= 10; })[0] || vs[vs.length - 1];
    if (n > 8) { n = 8; notes.push(tx('Понад 190 кВт — під проєкт', 'Over 190 kW — custom project')); }
    var bu = P.byId(BAT).usable || 16.38 * DOD, nb = Math.max(1, Math.ceil(use / bu - 1e-9));
    if (nb > 16 * n) { nb = 16 * n; notes.push(tx('ВВ-стійки під замовлення', 'HV racks to order')); }
    if (n > 1) notes.push(tx(n + (n < 5 ? ' інвертори' : ' інверторів') + ' паралельно', n + ' inverters in parallel'));
    return mk(who, [[INV3, v.model, n], [BAT, null, nb]], notes, true);
  }
  function mk(who, items, notes, install){ return { id: 'custom', seg: who, name: tx('Система під ваші потреби', 'A system for your needs'), items: items, notes: notes, install: install, custom: true }; }

  return { SEG: SEG, LOADS: LOADS, list: K, byId: function(id){ for (var i = 0; i < K.length; i++) if (K[i].id === id) return K[i]; return null; },
    forSeg: function(seg){ return K.filter(function(k){ return !seg || seg === 'all' || k.seg === seg; }); },
    line: line, summary: summary, hours: hours, hoursTxt: hoursTxt, compose: compose, RANK: RANK };
})();
