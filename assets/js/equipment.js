/* =====================================================================
   Equipment page: real product line (window.PRODUCTS) — filters and sort,
   cards with the supplier's product photos, availability and indicative
   price, a detail panel with a photo gallery, and a side-by-side
   comparison (up to 3). Cards carry no prose: a short type name, the
   model, 2–3 spec chips, the price and a «+» button.
   ===================================================================== */
(function(){
  'use strict';
  var S = window.Site, D = window.PRODUCTS, d = document; if (!D) return;
  var $ = function(s){ return document.querySelector(s); }, $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var nf = S.nf;
  /* «1,80» → «1,8»: up to 2 decimals below 10, 1 above, no trailing zeros */
  function num(v, d){ if (v == null) return '—'; d = d == null ? (v % 1 ? (v < 10 ? 2 : 1) : 0) : d; var s = nf(v, d); return d ? s.replace(/([,.]\d*?)0+$/, '$1').replace(/[,.]$/, '') : s; }
  function kwh(v){ return v == null ? '—' : v >= 1000 ? num(v / 1000) + tx(' МВт·год', ' MWh') : v < 1 ? num(v * 1000) + tx(' Вт·год', ' Wh') : num(v) + tx(' кВт·год', ' kWh'); }
  function kw(v){ return v == null ? '—' : v >= 1000 ? num(v / 1000) + tx(' МВт', ' MW') : v < 1 ? num(v * 1000) + tx(' Вт', ' W') : num(v) + tx(' кВт', ' kW'); }
  function dims(a){ return a ? a.map(function(x){ return nf(x, x % 1 ? 1 : 0); }).join(' × ') + tx(' мм', ' mm') : '—'; }
  function kg(v){ return nf(v, v % 1 ? 1 : 0) + tx(' кг', ' kg'); }
  function uah(v){ return S.uah(v); }   /* «12 400 ₴» / «₴12,400» */
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var CAT = D.CAT, STOCK = D.STOCK, list = D.list;
  var K = window.KITS, WHO = D.WHO;
  var st = { cat: 'all', who: 'all', stock: 'all', sort: 'stock', sel: null, open: null, vi: 0, cmp: [] };
  (function(){ var q = S.q; if (q.get('cat') && (CAT[q.get('cat')] || (q.get('cat') === 'kits' && K))) st.cat = q.get('cat'); if (WHO[q.get('who')]) st.who = q.get('who'); if (STOCK[q.get('stock')]) st.stock = q.get('stock'); if (/^(stock|cheap|dear|cap)$/.test(q.get('sort') || '')) st.sort = q.get('sort'); })();
  function syncUrl(){ var q = new URLSearchParams(); if (st.cat !== 'all') q.set('cat', st.cat); if (st.who !== 'all') q.set('who', st.who); if (st.stock !== 'all') q.set('stock', st.stock); if (st.sort !== 'stock') q.set('sort', st.sort); if (st.open) q.set('p', st.open); var t = q.toString(); try { history.replaceState(null, '', t ? '?' + t : location.pathname); } catch (e) {} }
  try { st.cmp = JSON.parse(sessionStorage.getItem('eq-cmp') || '[]').filter(function(id){ return D.byId(id); }); } catch (e) {}

  /* ---- spec chips: icon + value, the meaning in a tooltip ---- */
  var IC = {
    cap: '<svg viewBox="0 0 16 16" aria-hidden="true"><rect x="1.5" y="4.5" width="11.2" height="7" rx="1.7" fill="none" stroke="currentColor" stroke-width="1.4"/><rect x="13.4" y="6.6" width="1.5" height="2.8" rx=".6" fill="currentColor"/><rect x="3.3" y="6.3" width="5.2" height="3.4" rx=".6" fill="currentColor"/></svg>',
    pow: '<svg viewBox="0 0 16 16" aria-hidden="true"><path d="M8.9 2 4.6 8.6h3.2L6.9 14l4.5-6.6H8.2z" fill="currentColor"/></svg>',
    cyc: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M13 8a5 5 0 0 1-8.6 3.5M3 8a5 5 0 0 1 8.6-3.5"/><path d="M11.9 2.2v2.5H9.4M4.1 13.8v-2.5h2.5"/></svg>',
    time: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.5"/></svg>',
    ph: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" aria-hidden="true"><path d="M1.5 8c1.6-4.4 3.4-4.4 5 0s3.4 4.4 5 0c.8-2.2 1.7-3.3 3-3.3"/></svg>',
    'var': '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.4" stroke-linejoin="round" aria-hidden="true"><path d="M8 2.2 14 5.2 8 8.2 2 5.2z"/><path d="M2 8l6 3 6-3M2 10.8l6 3 6-3"/></svg>',
    ip: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linejoin="round" aria-hidden="true"><path d="M8 2c2.6 3.3 4 5.6 4 7.4A4 4 0 0 1 4 9.4C4 7.6 5.4 5.3 8 2z"/></svg>',
    vs: '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2.5 5.5h10M10 3l2.5 2.5L10 8M13.5 10.5h-10M6 8l-2.5 2.5L6 13"/></svg>'
  };
  /* the same .fchips as the cards on the home page */
  function chip(ic, text, title){ var c = el('i'); if (IC[ic]) c.insertAdjacentHTML('afterbegin', IC[ic]); c.appendChild(el('span', '', text)); if (title) c.title = title; return c; }
  function chipRow(a, cls){ var w = el('span', 'fchips pc2__specs' + (cls ? ' ' + cls : '')); a.forEach(function(c){ if (c) w.appendChild(c); }); return w; }
  function span(p, k){ var a = p.variants.map(function(v){ return v[k]; }).filter(function(x){ return x != null; }); return a.length ? [Math.min.apply(null, a), Math.max.apply(null, a)] : null; }
  function rng(r, f, unit){ return r[0] === r[1] ? f(r[0]) : nf(Math.round(r[0])) + '–' + nf(Math.round(r[1])) + unit; }
  function capOf(p){ if (p.variants) { var r = span(p, 'kwh'); return r ? rng(r, kwh, tx(' кВт·год', ' kWh')) : null; } return p.kwh != null ? kwh(p.kwh) : null; }
  function powOf(p){ if (p.variants) { var r = span(p, 'kw'); return r ? rng(r, kw, tx(' кВт', ' kW')) : null; } return p.kw != null ? kw(p.kw) : null; }
  function phases(p){ return /^380/.test(p.volt || '') ? tx('3 фази', '3-phase') : tx('1 фаза', '1-phase'); }
  function cycles(p){ return nf(p.cycles) + ' ' + S.plural(p.cycles, ['цикл', 'цикли', 'циклів'], ['cycle', 'cycles']); }
  /* 2–3 chips for a card: capacity, power, then phases / variants / cycles */
  function specChips(p){
    var a = [], c = capOf(p), w = powOf(p);
    if (c) a.push(chip('cap', c, tx('Ємність', 'Capacity')));
    if (w) a.push(chip('pow', w, tx('Потужність', 'Power')));
    if (p.cat === 'inverter') a.push(chip('ph', phases(p)));
    if (p.variants) a.push(chip('var', p.variants.length + ' ' + S.plural(p.variants.length, ['варіант', 'варіанти', 'варіантів'], ['variant', 'variants'])));
    else if (p.cycles) a.push(chip('cyc', cycles(p), tx('Циклів заряду', 'Charge cycles')));
    if (a.length < 2 && p.ip) a.push(chip('ip', p.ip, tx('Захист корпусу', 'Enclosure rating')));
    return a.slice(0, 3);
  }
  /* «Настінна батарея 10,24 кВт·год» → «Настінна батарея»: the numbers go to the chips */
  function shortName(p){
    var s = p.name.replace(/\s*\d[\d\s,.–-]*\s?(кВт·год|Вт·год|кВт|Вт|kWh|Wh|kW|W)(?![A-Za-zА-Яа-яІіЇїЄєҐґ])/g, '')
      .replace(/\s*,\s*(три фази|одна фаза|three-phase|single-phase)\s*$/, '')
      .replace(/(\s*·\s*)+$/, '').replace(/^(\s*·\s*)+/, '').replace(/\s*·\s*·\s*/g, ' · ').replace(/\s+,/g, ',').replace(/\s{2,}/g, ' ').trim();
    return s || p.name;
  }

  /* ---- price & availability ---- */
  function priceOf(p, v){
    if (v) return v.price != null ? { v: v.price, from: false, kwh: v.kwh, kw: v.kw } : null;
    if (p.variants) { var ps = p.variants.filter(function(x){ return x.price != null; }); if (!ps.length) return null; var m = ps.reduce(function(a, b){ return a.price <= b.price ? a : b; }); return { v: m.price, from: ps.length > 1, kwh: m.kwh, kw: m.kw }; }
    return p.price != null ? { v: p.price, from: false, kwh: p.kwh, kw: p.kw } : null;
  }
  function perKwh(pr, p){
    if (!pr) return '';
    if (p.cat === 'inverter') return pr.kw ? uah(Math.round(pr.v / pr.kw / 10) * 10) + tx(' за кВт', ' per kW') : '';
    return pr.kwh >= 1 ? uah(Math.round(pr.v / pr.kwh / 10) * 10) + tx(' за кВт·год', ' per kWh') : '';
  }
  var STOCK_TIP = { pre: tx('Модель першої партії', 'A first-batch model'), order: tx('Поставляємо окремим замовленням', 'Supplied as a separate order') };
  function badge(p){ var s = el('span', 'stock stock--' + (p.stock || 'order'), STOCK[p.stock] || STOCK.order); if (STOCK_TIP[p.stock]) s.title = STOCK_TIP[p.stock]; return s; }
  function priceTxt(pr){ return pr ? (pr.from ? tx('від ', 'from ') : '') + uah(pr.v) : tx('Ціна за запитом', 'Price on request'); }

  /* ---- photos ---- */
  function pic(img, cls, big){
    var f = el('figure', 'ph' + (cls ? ' ' + cls : ''));
    if (!img) { f.classList.add('ph--none'); f.appendChild(el('span', '', tx('Фото незабаром', 'Photo coming soon'))); return f; }
    f.style.background = img.bg; if (img.scene) f.classList.add('ph--scene');
    var i = document.createElement('img'); i.src = S.asset(img.src); i.width = img.w; i.height = img.h; i.alt = ''; i.decoding = 'async'; if (!big) i.loading = 'lazy';
    /* catalogue shots are small: never blow them up past ~1.7× the source */
    if (!img.scene && big) i.style.maxHeight = 'min(88%, ' + Math.round(Math.max(260, img.nat * 1.7 * img.h / Math.max(img.w, img.h))) + 'px)';
    f.appendChild(i); return f;
  }

  /* ---- filters & sort ---- */
  var grid = $('#cat'), flt = $('#flt');
  function kitSum(k){ if (!k._s) k._s = K.summary(k); return k._s; }
  function products(f){ f = Object.assign({}, st, f || {}); return list.filter(function(p){ return (f.cat === 'all' || p.cat === f.cat) && (f.who === 'all' || (p.tags || []).indexOf(f.who) >= 0) && (f.stock === 'all' || p.stock === f.stock); }); }
  function kits(f){ f = Object.assign({}, st, f || {}); return K ? K.list.filter(function(k){ return (f.who === 'all' || k.seg === f.who) && (f.stock === 'all' || kitSum(k).stock === f.stock); }) : []; }
  function count(f){ f = Object.assign({}, st, f || {}); return f.cat === 'kits' ? kits(f).length : products(f).length; }
  function visible(){
    var v = products();
    var rank = { 'in': 0, pre: 1, order: 2 }, pv = function(p){ var r = priceOf(p); return r ? r.v : null; };
    var by = {
      stock: function(a, b){ return (rank[a.stock] || 2) - (rank[b.stock] || 2); },
      cheap: function(a, b){ var x = pv(a), y = pv(b); return (x == null) - (y == null) || (x || 0) - (y || 0); },
      dear: function(a, b){ var x = pv(a), y = pv(b); return (x == null) - (y == null) || (y || 0) - (x || 0); },
      cap: function(a, b){ return (b.kwh || 0) - (a.kwh || 0) || (b.kw || 0) - (a.kw || 0); }
    }[st.sort];
    return v.map(function(p, i){ return [p, i]; }).sort(function(a, b){ return by(a[0], b[0]) || a[1] - b[1]; }).map(function(x){ return x[0]; });
  }
  /* grouped filters: type · for whom · availability — each option shows how many models it leaves */
  function group(host, key, opts){
    host.textContent = '';
    opts.forEach(function(o){
      var f = {}; f[key] = o[0]; var n = count(f);
      var b = el('button', 'fopt'); b.type = 'button'; b.setAttribute('aria-pressed', String(st[key] === o[0])); b.disabled = !n && st[key] !== o[0];
      b.append(el('span', '', o[1]), el('small', '', n));
      b.addEventListener('click', function(){ st[key] = o[0]; if (key !== 'cat' && st.cat !== 'all' && !count()) st.cat = 'all'; render(); });
      host.appendChild(b);
    });
  }
  var KITS_T = tx('Готові комплекти', 'Ready kits');
  function filters(){
    var cats = [['all', tx('Усе', 'All')]]; if (K) cats.push(['kits', KITS_T]);
    Object.keys(CAT).forEach(function(k){ cats.push([k, CAT[k]]); });
    group($('#fCat'), 'cat', cats);
    group($('#fWho'), 'who', [['all', tx('Усім', 'Everyone')]].concat(Object.keys(WHO).map(function(k){ return [k, WHO[k]]; })));
    group($('#fStock'), 'stock', [['all', tx('Будь-яка', 'Any')]].concat(Object.keys(STOCK).map(function(k){ return [k, STOCK[k]]; })));
    var tags = $('#fTags'), on = 0; tags.textContent = '';
    [['cat', st.cat !== 'all' ? (st.cat === 'kits' ? KITS_T : CAT[st.cat]) : null], ['who', st.who !== 'all' ? WHO[st.who] : null], ['stock', st.stock !== 'all' ? STOCK[st.stock] : null]].forEach(function(t){
      if (!t[1]) return; on++;
      var b = el('button', 'ftag'); b.type = 'button'; b.setAttribute('aria-label', tx('Прибрати фільтр: ', 'Remove filter: ') + t[1]); b.append(el('span', '', t[1]), el('i', '', '×'));
      b.addEventListener('click', function(){ st[t[0]] = 'all'; render(); }); tags.appendChild(b);
    });
    $('#fOpenN').textContent = on ? String(on) : ''; $('#fReset').hidden = !on;
    $('#eqSort').value = st.sort; $('#eqSort').disabled = st.cat === 'kits';
  }
  function resetAll(){ st.cat = 'all'; st.who = 'all'; st.stock = 'all'; render(); }
  $('#eqSort').addEventListener('change', function(e){ st.sort = e.target.value; render(); });
  $('#fReset').addEventListener('click', resetAll);
  /* on phones the panel is a sheet */
  function sheet(on){ flt.classList.toggle('is-open', on); d.body.classList.toggle('flt-lock', on); if (on) { var f = flt.querySelector('.fopt[aria-pressed="true"]'); if (f) f.focus(); } }
  $('#fOpen').addEventListener('click', function(){ sheet(true); });
  $('#fDone').addEventListener('click', function(){ sheet(false); S.scrollToEl(grid); });
  $('#fltClose').addEventListener('click', function(){ sheet(false); });
  d.addEventListener('keydown', function(e){ if (e.key === 'Escape' && flt.classList.contains('is-open')) sheet(false); }, { signal: S.page.signal });

  /* ---- cards ---- */
  function addBtn(ref, name){ var a = el('button', 'kitc__add'); a.type = 'button'; a.setAttribute('data-add', ref); a.setAttribute('aria-label', tx('Додати в заявку: ', 'Add to the request: ') + name); a.title = tx('Додати в заявку', 'Add to request'); a.textContent = '+'; return a; }
  function foot(price, sub, add){
    var f = el('div', 'pc2__foot'), p = el('span', 'pc2__price'); p.appendChild(price); if (sub) p.appendChild(sub);
    f.appendChild(p); if (add) f.appendChild(add); return f;
  }
  /* what a kit holds, in words: «Інвертор 10 кВт», «Батарея × 2» */
  function partName(l){
    var c = l.p.cat, q = l.qty > 1 ? ' × ' + l.qty : '';
    if (c === 'inverter') return tx('Інвертор ', 'Inverter ') + kw(l.kw) + q;
    if (c === 'battery') return tx('Батарея', 'Battery') + q;
    if (c === 'hv') return tx('Стійка', 'Rack') + q;
    if (c === 'aio') return tx('Моноблок', 'All-in-one') + q;
    return tx('Станція ', 'Station ') + l.model.replace(/\s*LFP$/, '') + q;
  }
  function kitCard(k){
    var sm = kitSum(k), c = el('article', 'pc2 pc2--kit');
    var top = el('div', 'pc2__top'); top.append(pic(sm.img, 'pc2__ph'), badge({ stock: sm.stock }));
    var n = sm.lines.reduce(function(a, l){ return a + (l.p.cat === 'inverter' ? 0 : l.qty); }, 0); if (n > 1) top.appendChild(el('span', 'pc2__qty', '× ' + n));
    var b = el('a', 'pc2__main'); b.href = 'assistant.html?kit=' + k.id;
    var ht = K.hoursTxt(K.hours(sm, k.load));
    b.append(top, el('span', 'pc__k', tx('Комплект · ', 'Kit · ') + K.SEG[k.seg]), el('b', 'pc2__t', k.name),
      chipRow(sm.lines.map(function(l){ var x = el('i', '', partName(l)); x.title = (l.qty > 1 ? l.qty + ' × ' : '') + l.model; return x; }), 'pc2__parts'),
      chipRow([chip('cap', nf(sm.kwh, sm.kwh < 10 ? 2 : 1) + tx(' кВт·год', ' kWh'), tx('Ємність', 'Capacity')), chip('pow', nf(sm.kw, sm.kw % 1 ? 1 : 0) + tx(' кВт', ' kW'), tx('Потужність', 'Power')),
        ht === '—' ? null : chip('time', ht, tx('Резерв при ~', 'Backup at ~') + nf(k.load) + tx(' Вт', ' W'))]));
    var sub = el('small', 'pc2__tag', k.install ? tx('монтаж окремо', 'installation extra') : tx('без монтажу', 'no installation'));
    if (k.install) sub.title = tx('Монтаж рахуємо після огляду', 'Installation is quoted after a survey');
    c.append(b, foot(el('b', sm.priced ? '' : 'is-ask', sm.priced ? uah(sm.price) : tx('Ціна за запитом', 'Price on request')), sub, addBtn('kit:' + k.id, k.name))); return c;
  }
  function cmpToggle(p){
    var l = el('label', 'pc2__vs'), cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = st.cmp.indexOf(p.id) >= 0;
    cb.setAttribute('aria-label', tx('Порівняти: ', 'Compare: ') + p.model); l.title = tx('Порівняти', 'Compare');
    cb.addEventListener('change', function(){ toggleCmp(p.id, cb.checked); });
    l.appendChild(cb); l.insertAdjacentHTML('beforeend', IC.vs); return l;
  }
  var CHEV = '<svg width="14" height="14" viewBox="0 0 12 12" aria-hidden="true"><path d="M4 2.5 7.5 6 4 9.5" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';
  function productCard(p){
    var c = el('article', 'pc2'); c.dataset.id = p.id; if (st.sel === p.id) c.classList.add('is-sel');
    /* the photo sits outside the button so the compare toggle can live on it */
    var top = el('div', 'pc2__top'); top.append(pic(p.img[0], 'pc2__ph'), badge(p), cmpToggle(p));
    top.addEventListener('click', function(e){ if (!e.target.closest('.pc2__vs')) open(p.id, true); });
    var btn = el('button', 'pc2__main'); btn.type = 'button'; btn.setAttribute('aria-label', p.model + ' — ' + p.name);
    btn.append(el('span', 'pc__k', CAT[p.cat]), el('b', 'pc2__t', shortName(p)), el('small', 'pc2__m', (p.maker ? p.maker + ' ' : '') + p.model), chipRow(specChips(p)));
    btn.addEventListener('click', function(){ open(p.id, true); });
    var pr = priceOf(p), go = null;
    /* a model with variants is added from its card, where the variant is chosen */
    if (p.variants) { go = el('button', 'kitc__add pc2__go'); go.type = 'button'; go.setAttribute('aria-label', tx('Обрати варіант: ', 'Choose a variant: ') + p.name); go.title = tx('Обрати варіант', 'Choose a variant'); go.insertAdjacentHTML('afterbegin', CHEV); go.addEventListener('click', function(){ open(p.id, true); }); }
    c.append(top, btn, foot(el('b', pr ? '' : 'is-ask', priceTxt(pr)), null, go || addBtn('product:' + p.id, p.name)));
    return c;
  }
  function empty(){
    var w = el('div', 'eqempty'), r = el('button', 'btn btn--ghost btn--sm'); r.type = 'button'; r.appendChild(el('span', '', tx('Скинути фільтри', 'Reset filters')));
    r.addEventListener('click', resetAll); w.append(el('b', '', tx('Нічого не знайдено', 'Nothing found')), r); return w;
  }
  function render(){
    filters(); grid.textContent = ''; syncUrl();
    if (st.cat === 'kits') {
      var ks = kits(); ks.forEach(function(k){ grid.appendChild(kitCard(k)); });
      $('#eqCount').textContent = ks.length + ' ' + S.plural(ks.length, ['комплект', 'комплекти', 'комплектів'], ['kit', 'kits']);
      if (!ks.length) grid.appendChild(empty());
      cmpBar(); return;
    }
    var v = visible();
    v.forEach(function(p){ grid.appendChild(productCard(p)); });
    if (!v.length) grid.appendChild(empty());
    $('#eqCount').textContent = v.length + ' ' + S.plural(v.length, ['модель', 'моделі', 'моделей'], ['model', 'models']);
    cmpBar();
  }

  /* ---- gallery ---- */
  var gMain = $('#galMain'), gTh = $('#galTh'), gCap = $('#galCap'), lb = $('#lb');
  function gallery(p){
    st.vi = 0; gTh.textContent = ''; gTh.hidden = p.img.length < 2;
    p.img.forEach(function(img, i){
      var b = el('button', 'gal__t'); b.type = 'button'; b.setAttribute('aria-label', tx('Фото ', 'Photo ') + (i + 1) + (img.cap ? ': ' + img.cap : ''));
      b.appendChild(pic(img, '', false)); b.addEventListener('click', function(){ showImg(p, i); }); gTh.appendChild(b);
    });
    showImg(p, 0);
  }
  function showImg(p, i){
    st.vi = i; var img = p.img[i];
    gMain.textContent = ''; gMain.appendChild(pic(img, 'gal__ph', true)); gMain.disabled = !img;
    gMain.setAttribute('aria-label', img ? tx('Відкрити фото ' + p.model + ' на весь екран', 'Open the ' + p.model + ' photo full screen') : tx('Фото незабаром', 'Photo coming soon'));
    gCap.textContent = img && img.cap ? img.cap : ''; gCap.hidden = !gCap.textContent;
    $$('#galTh .gal__t').forEach(function(b, k){ b.setAttribute('aria-current', String(k === i)); });
  }
  gMain.addEventListener('click', function(){
    var p = D.byId(st.sel), img = p && p.img[st.vi]; if (!img) return;
    var li = $('#lbImg'); li.src = S.asset(img.src); li.alt = p.model; lb.style.setProperty('--bg', img.bg); $('#lbCap').textContent = p.model + (img.cap ? ' — ' + img.cap : '');
    if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
  });
  $('#lbX').addEventListener('click', function(){ lb.close(); });
  lb.addEventListener('click', function(e){ if (e.target === lb || e.target.id === 'lbImg') lb.close(); });

  /* ---- detail ---- */
  function kv(dl, a, b){ var row = el('div'), dt = el('dt', '', a), dd = el('dd', '', b); row.append(dt, dd); dl.appendChild(row); }
  function buy(p, v){
    var pr = priceOf(p, v);
    $('#spPrice').textContent = priceTxt(pr);
    $('#spPrice').classList.toggle('is-ask', !pr);
    $('#spPer').textContent = pr ? perKwh(pr, p) : '';
    var sb = $('#spStock'); sb.textContent = STOCK[p.stock] || STOCK.order; sb.className = 'stock stock--' + (p.stock || 'order'); sb.title = STOCK_TIP[p.stock] || '';
    var lt = leadTxt(p); $('#spLead').textContent = lt ? lt[0].toUpperCase() + lt.slice(1) : '';
    var ask = $('#spAsk'); ask.querySelector('span').textContent = pr ? tx('Додати в заявку', 'Add to request') : tx('Запитати ціну', 'Ask for a price');
    ask.setAttribute('data-add', 'product:' + p.id + (v ? ':' + v.model : ''));
    ask.href = 'request.html';
    var how = $('#spHow'); if (how) how.href = 'assistant.html?p=' + encodeURIComponent(p.id);
  }
  /* a lead time that only repeats the «Передзамовлення» badge is not shown */
  function leadTxt(p){ return p.lead && !/^(перша партія|first batch)$/i.test(p.lead) ? p.lead : ''; }
  function warrantyTxt(w){ var n = parseInt(w, 10); return n ? nf(n) + ' ' + S.plural(n, ['рік', 'роки', 'років'], ['year', 'years']) : null; }
  /* key figures: up to four tiles, a label and one number each */
  function figures(p){
    var fig = $('#spFig'); fig.textContent = '';
    var wt = p.warranty ? warrantyTxt(p.warranty) : null;
    [[capOf(p), tx('ємність', 'capacity'), p.usable ? tx('Корисна: ', 'Usable: ') + kwh(p.usable) : ''], [powOf(p), tx('потужність', 'power')], [p.cycles ? nf(p.cycles) : null, tx('циклів', 'cycles')],
      [wt, tx('гарантія', 'warranty'), tx('Умови підтвердимо в пропозиції', 'Terms confirmed in the offer') + (p.warranty !== wt ? ' · ' + p.warranty : '')], [p.kg ? kg(p.kg) : null, tx('вага', 'weight')]].filter(function(f){ return f[0]; }).slice(0, 4).forEach(function(f){
      /* «14,3 кВт·год» → a big number and a small unit, so the tile stays on one line */
      var x = el('div'), b = el('b'), m = /^([\d\s,.–]+?)\s+(\D.*)$/.exec(f[0]);
      if (m) b.append(document.createTextNode(m[1]), el('small', '', m[2])); else b.textContent = f[0];
      x.append(b, el('span', '', f[1])); if (f[2]) x.title = f[2]; fig.appendChild(x);
    });
    fig.hidden = !fig.children.length;
    return !!wt;
  }
  function open(id, push){
    var p = D.byId(id) || list[0]; st.sel = p.id;
    $$('#cat .pc2').forEach(function(c){ c.classList.toggle('is-sel', c.dataset.id === p.id); });
    $('#spK').textContent = CAT[p.cat] + (p.maker ? ' · ' + p.maker : '');
    $('#spT').textContent = p.name; $('#spN').textContent = p.model;
    /* highlights as chips instead of a description paragraph */
    var hl = $('#spD'); hl.textContent = ''; (p.hl || []).forEach(function(h){ hl.appendChild(el('li', '', h)); }); hl.hidden = !hl.children.length;
    gallery(p);
    var wInTiles = figures(p);
    /* variants */
    var vw = $('#spVar'); vw.textContent = ''; vw.hidden = !p.variants;
    if (p.variants) p.variants.forEach(function(v, i){ var b = el('button', 'chip', v.model + ' · ' + (v.kwh != null ? kwh(v.kwh) : kw(v.kw))); b.type = 'button'; b.setAttribute('aria-pressed', String(i === 0)); b.addEventListener('click', function(){ $$('#spVar .chip').forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); }); variantRows(v); calcHref(p, v); buy(p, v); }); vw.appendChild(b); });
    /* spec groups */
    var box = $('#spGroups'); box.textContent = '';
    var vdl = el('dl'); vdl.id = 'spVarRows'; box.appendChild(vdl);
    (p.groups || []).forEach(function(g){ var dl = el('dl'); g[1].forEach(function(r){ kv(dl, r[0], r[1]); }); box.append(el('h4', '', g[0]), dl); });
    if (p.variants) variantRows(p.variants[0]);
    if (p.cert && p.cert.length) { var cs = el('div', 'certs'); p.cert.forEach(function(c){ cs.appendChild(el('span', '', c)); }); box.append(el('h4', '', tx('Сертифікати', 'Certificates')), cs); }
    if (p.warranty && !wInTiles) box.append(el('h4', '', tx('Гарантія', 'Warranty')), el('p', 'spec__w', p.warranty));
    var src = $('#spSrc'); src.textContent = '';
    (p.sources || []).forEach(function(s, i){ if (i) src.appendChild(document.createTextNode(' · ')); if (s.url) { var a = el('a', '', s.t); a.href = s.url; a.target = '_blank'; a.rel = 'noopener'; src.appendChild(a); } else src.appendChild(document.createTextNode(s.t)); });
    $('#spNote').textContent = p.note || ''; $('#spNote').hidden = !p.note;
    calcHref(p, p.variants ? p.variants[0] : null);
    buy(p, p.variants ? p.variants[0] : null);
    var cb = $('#spCmp'); cb.checked = st.cmp.indexOf(p.id) >= 0; cb.onchange = function(){ toggleCmp(p.id, cb.checked); };
    st.open = p.id; syncUrl();
    var pd = $('#pdlg'); if (!pd.open) { if (pd.showModal) pd.showModal(); else pd.setAttribute('open', ''); } pd.querySelector('.pdlg__in').scrollTop = 0;
  }
  function calcHref(p, v){
    var tg = p.tags || [], who = tg.indexOf('biz') >= 0 && tg.indexOf('home') < 0 ? 'biz' : 'home', cap = v ? v.kwh : p.kwh;
    var c = $('#spCalc'); if (!c) return;
    c.href = 'calculator.html?who=' + who + (cap >= 5 && p.cat !== 'portable' ? '&cap=' + cap + (p.kw ? '&pow=' + p.kw : '') : '');
  }
  function variantRows(v){
    var dl = document.getElementById('spVarRows'); if (!dl) return; dl.textContent = '';
    if (!v) return;
    kv(dl, tx('Модель', 'Model'), v.model);
    if (v.kwh != null) kv(dl, tx('Ємність', 'Capacity'), kwh(v.kwh)); if (v.kw != null) kv(dl, tx('Потужність', 'Power'), kw(v.kw));
    if (v.v) kv(dl, tx('Напруга', 'Voltage'), v.v); (v.rows || []).forEach(function(r){ kv(dl, r[0], r[1]); });
    if (v.dims) kv(dl, tx('Габарити', 'Dimensions'), dims(v.dims)); if (v.kg) kv(dl, tx('Вага', 'Weight'), kg(v.kg));
  }

  /* ---- comparison ---- */
  var bar = $('#cmpBar'), dlg = $('#cmpDlg');
  function toggleCmp(id, on){
    var i = st.cmp.indexOf(id);
    if (on && i < 0) { if (st.cmp.length >= 3) { S.toast(tx('Максимум 3 моделі — зніміть одну', 'Up to 3 models — untick one first')); render(); if (st.sel) $('#spCmp').checked = st.cmp.indexOf(st.sel) >= 0; return; } st.cmp.push(id); }
    if (!on && i >= 0) st.cmp.splice(i, 1);
    try { sessionStorage.setItem('eq-cmp', JSON.stringify(st.cmp)); } catch (e) {}
    $$('#cat .pc2').forEach(function(c){ var x = c.querySelector('input'); if (x) x.checked = st.cmp.indexOf(c.dataset.id) >= 0; });
    if (st.sel) $('#spCmp').checked = st.cmp.indexOf(st.sel) >= 0;
    cmpBar();
  }
  function cmpBar(){
    bar.classList.toggle('is-on', st.cmp.length > 0);
    $('#cmpList').textContent = st.cmp.map(function(id){ return D.byId(id).model; }).join(' · ');
    $('#cmpGo').disabled = st.cmp.length < 2;
  }
  /* a variant range, compact: «20–41 кВт·год» */
  function range(p, k, f, unit){ var r = span(p, k); return r ? rng(r, f, unit) : null; }
  $('#cmpClear').addEventListener('click', function(){ st.cmp = []; try { sessionStorage.setItem('eq-cmp', '[]'); } catch (e) {} render(); if (st.sel) $('#spCmp').checked = false; });
  $('#cmpGo').addEventListener('click', function(){
    var ps = st.cmp.map(D.byId), t = $('#cmpTable'); t.textContent = '';
    /* a row returns text or a ready element */
    var rows = [[tx('Ціна', 'Price'), function(p){ var r = priceOf(p); return r ? priceTxt(r) : tx('за запитом', 'on request'); }], [tx('За кВт·год', 'Per kWh'), function(p){ var r = priceOf(p); return r && p.cat !== 'inverter' && r.kwh >= 1 ? uah(Math.round(r.v / r.kwh / 10) * 10) : '—'; }],
      [tx('Наявність', 'Availability'), function(p){ var w = el('span', 'cmpt__st'); w.appendChild(badge(p)); if (leadTxt(p)) w.appendChild(el('small', '', leadTxt(p))); return w; }],
      [tx('Тип', 'Type'), function(p){ return CAT[p.cat]; }], [tx('Виробник', 'Manufacturer'), function(p){ return p.maker || '—'; }],
      [tx('Ємність', 'Capacity'), function(p){ return capOf(p) || '—'; }], [tx('Корисна ємність', 'Usable capacity'), function(p){ return p.usable ? kwh(p.usable) : '—'; }],
      [tx('Потужність', 'Power'), function(p){ return powOf(p) || '—'; }], [tx('Напруга', 'Voltage'), function(p){ return p.volt || '—'; }], [tx('Цикли', 'Cycles'), function(p){ return p.cycles ? nf(p.cycles) : '—'; }], [tx('Паралельно', 'In parallel'), function(p){ return p.parallel || '—'; }],
      [tx('Габарити', 'Dimensions'), function(p){ return p.variants && p.variants[0].dims ? tx('за варіантом', 'per variant') : dims(p.dims); }], [tx('Вага', 'Weight'), function(p){ return p.kg ? kg(p.kg) : p.variants ? range(p, 'kg', kg, tx(' кг', ' kg')) || '—' : '—'; }], [tx('Захист', 'Protection'), function(p){ return p.ip || '—'; }], [tx('Сертифікати', 'Certificates'), function(p){ return (p.cert || []).join(', ') || '—'; }], [tx('Гарантія', 'Warranty'), function(p){ return p.warranty || '—'; }]];
    var thead = el('thead'), hr = el('tr'); hr.appendChild(el('th'));
    ps.forEach(function(p){ var th = el('th'); th.scope = 'col'; th.append(pic(p.img[0], 'cmpt__ph'), el('b', '', p.model), el('small', '', p.name)); hr.appendChild(th); });
    thead.appendChild(hr); t.appendChild(thead);
    var tb = el('tbody');
    rows.forEach(function(r){ var tr = el('tr'), th = el('th', '', r[0]); th.scope = 'row'; tr.appendChild(th); ps.forEach(function(p){ var v = r[1](p), td = el('td'); if (typeof v === 'string') td.textContent = v; else td.appendChild(v); tr.appendChild(td); }); tb.appendChild(tr); });
    t.appendChild(tb);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  });
  $('#cmpX').addEventListener('click', function(){ dlg.close(); });
  dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });

  /* ---- boot ---- */
  /* the price caveat: a small badge with the full note in a tooltip */
  var note = $('#eqNote'); if (note) { note.textContent = '≈ ' + tx('ціни на ', 'prices as of ') + D.OFFER.date; note.title = D.OFFER.note; }
  var pdl = $('#pdlg');
  $('#pdX').addEventListener('click', function(){ pdl.close(); });
  pdl.addEventListener('click', function(e){ if (e.target === pdl) pdl.close(); });
  pdl.addEventListener('close', function(){ st.open = null; st.sel = null; $$('#cat .pc2').forEach(function(c){ c.classList.remove('is-sel'); }); syncUrl(); });
  render();
  var first = S.q.get('p'); if (D.byId(first)) open(first, false);
})();
