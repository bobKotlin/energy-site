/* =====================================================================
   Equipment page: real product line (window.PRODUCTS) — filters and sort,
   cards with the supplier's product photos, availability and indicative
   price, a detail panel with a photo gallery, and a side-by-side
   comparison (up to 3).
   ===================================================================== */
(function(){
  'use strict';
  var S = window.Site, D = window.PRODUCTS, d = document; if (!D) return;
  var $ = function(s){ return document.querySelector(s); }, $$ = function(s){ return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var nf = S.nf;
  function num(v, d){ return v == null ? '—' : nf(v, d == null ? (v % 1 ? (v < 10 ? 2 : 1) : 0) : d); }
  function kwh(v){ return v == null ? '—' : v >= 1000 ? num(v / 1000) + ' МВт·год' : v < 1 ? num(v * 1000) + ' Вт·год' : num(v) + ' кВт·год'; }
  function kw(v){ return v == null ? '—' : v >= 1000 ? num(v / 1000) + ' МВт' : v < 1 ? num(v * 1000) + ' Вт' : num(v) + ' кВт'; }
  function dims(a){ return a ? a.map(function(x){ return nf(x, x % 1 ? 1 : 0); }).join(' × ') + ' мм' : '—'; }
  function kg(v){ return nf(v, v % 1 ? 1 : 0) + ' кг'; }
  function uah(v){ return nf(Math.round(v)) + ' ₴'; }
  function el(tag, cls, text){ var e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  var CAT = D.CAT, STOCK = D.STOCK, list = D.list;
  var K = window.KITS, WHO = D.WHO;
  var st = { cat: 'all', who: 'all', stock: 'all', sort: 'stock', sel: null, open: null, vi: 0, cmp: [] };
  (function(){ var q = S.q; if (q.get('cat') && (CAT[q.get('cat')] || (q.get('cat') === 'kits' && K))) st.cat = q.get('cat'); if (WHO[q.get('who')]) st.who = q.get('who'); if (STOCK[q.get('stock')]) st.stock = q.get('stock'); if (/^(stock|cheap|dear|cap)$/.test(q.get('sort') || '')) st.sort = q.get('sort'); })();
  function syncUrl(){ var q = new URLSearchParams(); if (st.cat !== 'all') q.set('cat', st.cat); if (st.who !== 'all') q.set('who', st.who); if (st.stock !== 'all') q.set('stock', st.stock); if (st.sort !== 'stock') q.set('sort', st.sort); if (st.open) q.set('p', st.open); var t = q.toString(); try { history.replaceState(null, '', t ? '?' + t : location.pathname); } catch (e) {} }
  try { st.cmp = JSON.parse(sessionStorage.getItem('eq-cmp') || '[]').filter(function(id){ return D.byId(id); }); } catch (e) {}

  /* ---- price & availability ---- */
  function priceOf(p, v){
    if (v) return v.price != null ? { v: v.price, from: false, kwh: v.kwh, kw: v.kw } : null;
    if (p.variants) { var ps = p.variants.filter(function(x){ return x.price != null; }); if (!ps.length) return null; var m = ps.reduce(function(a, b){ return a.price <= b.price ? a : b; }); return { v: m.price, from: ps.length > 1, kwh: m.kwh, kw: m.kw }; }
    return p.price != null ? { v: p.price, from: false, kwh: p.kwh, kw: p.kw } : null;
  }
  function perKwh(pr, p){
    if (!pr) return '';
    if (p.cat === 'inverter') return pr.kw ? nf(Math.round(pr.v / pr.kw / 10) * 10) + ' ₴ за кВт' : '';
    return pr.kwh >= 1 ? nf(Math.round(pr.v / pr.kwh / 10) * 10) + ' ₴ за кВт·год' : '';
  }
  function badge(p){ var s = el('span', 'stock stock--' + (p.stock || 'order'), STOCK[p.stock] || STOCK.order); return s; }

  /* ---- photos ---- */
  function pic(img, cls, big){
    var f = el('figure', 'ph' + (cls ? ' ' + cls : ''));
    if (!img) { f.classList.add('ph--none'); f.appendChild(el('span', '', 'Фото незабаром')); return f; }
    f.style.background = img.bg; if (img.scene) f.classList.add('ph--scene');
    var i = document.createElement('img'); i.src = img.src; i.width = img.w; i.height = img.h; i.alt = ''; i.decoding = 'async'; if (!big) i.loading = 'lazy';
    /* catalogue shots are small: never blow them up past ~1.7× the source */
    if (!img.scene && big) i.style.maxHeight = 'min(88%, ' + Math.round(Math.max(260, img.nat * 1.7 * img.h / Math.max(img.w, img.h))) + 'px)';
    f.appendChild(i); return f;
  }
  function keyline(p){
    var a = [];
    if (p.kwh != null) a.push(kwh(p.kwh)); if (p.kw != null && !p.variants) a.push(kw(p.kw));
    if (p.variants) a.push(p.variants.length + ' варіантів');
    else if (p.cycles) a.push(nf(p.cycles) + ' циклів');
    return a.join(' · ');
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
  function filters(){
    var cats = [['all', 'Усе обладнання']]; if (K) cats.push(['kits', 'Готові комплекти']);
    Object.keys(CAT).forEach(function(k){ cats.push([k, CAT[k]]); });
    group($('#fCat'), 'cat', cats);
    group($('#fWho'), 'who', [['all', 'Усім']].concat(Object.keys(WHO).map(function(k){ return [k, WHO[k]]; })));
    group($('#fStock'), 'stock', [['all', 'Будь-яка']].concat(Object.keys(STOCK).map(function(k){ return [k, STOCK[k]]; })));
    var tags = $('#fTags'), on = 0; tags.textContent = '';
    [['cat', st.cat !== 'all' ? (st.cat === 'kits' ? 'Готові комплекти' : CAT[st.cat]) : null], ['who', st.who !== 'all' ? WHO[st.who] : null], ['stock', st.stock !== 'all' ? STOCK[st.stock] : null]].forEach(function(t){
      if (!t[1]) return; on++;
      var b = el('button', 'ftag'); b.type = 'button'; b.setAttribute('aria-label', 'Прибрати фільтр: ' + t[1]); b.append(el('span', '', t[1]), el('i', '', '×'));
      b.addEventListener('click', function(){ st[t[0]] = 'all'; render(); }); tags.appendChild(b);
    });
    $('#fOpenN').textContent = on ? String(on) : ''; $('#fReset').hidden = !on;
    $('#eqSort').value = st.sort; $('#eqSort').disabled = st.cat === 'kits';
  }
  $('#eqSort').addEventListener('change', function(e){ st.sort = e.target.value; render(); });
  $('#fReset').addEventListener('click', function(){ st.cat = 'all'; st.who = 'all'; st.stock = 'all'; render(); });
  /* on phones the panel is a sheet */
  function sheet(on){ flt.classList.toggle('is-open', on); d.body.classList.toggle('flt-lock', on); if (on) { var f = flt.querySelector('.fopt[aria-pressed="true"]'); if (f) f.focus(); } }
  $('#fOpen').addEventListener('click', function(){ sheet(true); });
  $('#fDone').addEventListener('click', function(){ sheet(false); S.scrollToEl(grid); });
  $('#fltClose').addEventListener('click', function(){ sheet(false); });
  d.addEventListener('keydown', function(e){ if (e.key === 'Escape' && flt.classList.contains('is-open')) sheet(false); });

  /* ---- cards ---- */
  function plural(n, a, b, c){ var m = n % 10, h = n % 100; return m === 1 && h !== 11 ? a : m >= 2 && m <= 4 && (h < 12 || h > 14) ? b : c; }
  function kitCard(k){
    var sm = kitSum(k), c = el('article', 'pc2 pc2--kit');
    var top = el('div', 'pc2__top'); top.append(pic(sm.img, 'pc2__ph'), badge({ stock: sm.stock }));
    var n = sm.lines.reduce(function(a, l){ return a + (l.p.cat === 'inverter' ? 0 : l.qty); }, 0); if (n > 1) top.appendChild(el('span', 'pc2__qty', '× ' + n));
    var b = el('a', 'pc2__main'); b.href = 'assistant.html?kit=' + k.id;
    var pr = el('span', 'pc2__price'); pr.appendChild(el('b', '', sm.priced ? uah(sm.price) : 'Ціна за запитом')); pr.appendChild(el('small', '', k.install ? 'обладнання · монтаж після огляду' : 'без монтажу'));
    b.append(top, el('span', 'pc__k', 'Комплект · ' + K.SEG[k.seg]), el('b', 'pc2__t', k.name), el('small', 'pc2__n', sm.lines.map(function(l){ return (l.qty > 1 ? l.qty + ' × ' : '') + l.model; }).join(' + ')),
      el('span', 'pc2__key', nf(sm.kwh, sm.kwh < 10 ? 2 : 1) + ' кВт·год · ' + nf(sm.kw, sm.kw % 1 ? 1 : 0) + ' кВт · ' + K.hoursTxt(K.hours(sm, k.load))), pr);
    var f = el('div', 'pc2__acts'), add = el('button', 'btn btn--volt btn--sm'); add.type = 'button'; add.setAttribute('data-add', 'kit:' + k.id); add.appendChild(el('span', '', 'Додати в заявку'));
    var how = el('a', 'btn btn--ghost btn--sm'); how.href = 'assistant.html?kit=' + k.id; how.appendChild(el('span', '', 'Як встановимо'));
    f.append(add, how); c.append(b, f); return c;
  }
  function render(){
    filters(); grid.textContent = ''; syncUrl();
    if (st.cat === 'kits') {
      var ks = kits(); ks.forEach(function(k){ grid.appendChild(kitCard(k)); });
      $('#eqCount').textContent = ks.length + ' ' + plural(ks.length, 'комплект', 'комплекти', 'комплектів');
      if (!ks.length) grid.appendChild(el('p', 'hint', 'Під ці фільтри комплектів немає — скиньте частину фільтрів.'));
      cmpBar(); return;
    }
    var v = visible();
    v.forEach(function(p){
      var c = el('article', 'pc2'); c.dataset.id = p.id; if (st.sel === p.id) c.classList.add('is-sel');
      var btn = el('button', 'pc2__main'); btn.type = 'button'; btn.setAttribute('aria-label', p.model + ' — ' + p.name);
      var top = el('div', 'pc2__top'); top.append(pic(p.img[0], 'pc2__ph'), badge(p));
      var pr = priceOf(p), price = el('span', 'pc2__price');
      if (pr) { price.appendChild(el('b', '', (pr.from ? 'від ' : '') + uah(pr.v))); var pk = perKwh(pr, p); if (pk) price.appendChild(el('small', '', pk)); }
      else price.appendChild(el('b', 'is-ask', 'Ціна за запитом'));
      btn.append(top, el('span', 'pc__k', CAT[p.cat] + (p.maker ? ' · ' + p.maker : '')), el('b', 'pc2__t', p.model), el('small', 'pc2__n', p.name), el('span', 'pc2__key', keyline(p)), price);
      btn.addEventListener('click', function(){ open(p.id, true); });
      var cmp = el('label', 'pc2__cmp'), cb = document.createElement('input'); cb.type = 'checkbox'; cb.checked = st.cmp.indexOf(p.id) >= 0;
      cb.addEventListener('change', function(){ toggleCmp(p.id, cb.checked); }); cmp.append(cb, document.createTextNode(' порівняти'));
      c.append(btn, cmp); grid.appendChild(c);
    });
    if (!v.length) grid.appendChild(el('p', 'hint', 'Під ці фільтри моделей немає — скиньте частину фільтрів.'));
    $('#eqCount').textContent = v.length + ' ' + plural(v.length, 'модель', 'моделі', 'моделей');
    cmpBar();
  }

  /* ---- gallery ---- */
  var gMain = $('#galMain'), gTh = $('#galTh'), gCap = $('#galCap'), lb = $('#lb');
  function gallery(p){
    st.vi = 0; gTh.textContent = ''; gTh.hidden = p.img.length < 2;
    p.img.forEach(function(img, i){
      var b = el('button', 'gal__t'); b.type = 'button'; b.setAttribute('aria-label', 'Фото ' + (i + 1) + (img.cap ? ': ' + img.cap : ''));
      b.appendChild(pic(img, '', false)); b.addEventListener('click', function(){ showImg(p, i); }); gTh.appendChild(b);
    });
    showImg(p, 0);
  }
  function showImg(p, i){
    st.vi = i; var img = p.img[i];
    gMain.textContent = ''; gMain.appendChild(pic(img, 'gal__ph', true)); gMain.disabled = !img;
    gMain.setAttribute('aria-label', img ? 'Відкрити фото ' + p.model + ' на весь екран' : 'Фото незабаром');
    gCap.textContent = img && img.cap ? img.cap : ''; gCap.hidden = !gCap.textContent;
    $$('#galTh .gal__t').forEach(function(b, k){ b.setAttribute('aria-current', String(k === i)); });
  }
  gMain.addEventListener('click', function(){
    var p = D.byId(st.sel), img = p && p.img[st.vi]; if (!img) return;
    var li = $('#lbImg'); li.src = img.src; li.alt = p.model; lb.style.setProperty('--bg', img.bg); $('#lbCap').textContent = p.model + (img.cap ? ' — ' + img.cap : '');
    if (lb.showModal) lb.showModal(); else lb.setAttribute('open', '');
  });
  $('#lbX').addEventListener('click', function(){ lb.close(); });
  lb.addEventListener('click', function(e){ if (e.target === lb || e.target.id === 'lbImg') lb.close(); });

  /* ---- detail ---- */
  function kv(dl, a, b){ var row = el('div'), dt = el('dt', '', a), dd = el('dd', '', b); row.append(dt, dd); dl.appendChild(row); }
  function buy(p, v){
    var pr = priceOf(p, v);
    $('#spPrice').textContent = pr ? (pr.from ? 'від ' : '') + uah(pr.v) : 'Ціна за запитом';
    $('#spPrice').classList.toggle('is-ask', !pr);
    $('#spPer').textContent = pr ? perKwh(pr, p) : 'Надішлемо пропозицію під ваш об’єкт';
    var sb = $('#spStock'); sb.textContent = STOCK[p.stock] || STOCK.order; sb.className = 'stock stock--' + (p.stock || 'order');
    $('#spLead').textContent = p.lead ? p.lead[0].toUpperCase() + p.lead.slice(1) : p.stock === 'order' ? 'Поставка окремим замовленням' : '';
    var ask = $('#spAsk'); ask.querySelector('span').textContent = pr ? 'Додати в заявку' : 'Запитати ціну';
    ask.setAttribute('data-add', 'product:' + p.id + (v ? ':' + v.model : ''));
    ask.href = 'request.html';
    var how = $('#spHow'); if (how) how.href = 'assistant.html?p=' + encodeURIComponent(p.id);
  }
  function open(id, push){
    var p = D.byId(id) || list[0]; st.sel = p.id;
    $$('#cat .pc2').forEach(function(c){ c.classList.toggle('is-sel', c.dataset.id === p.id); });
    $('#spK').textContent = CAT[p.cat] + (p.maker ? ' · ' + p.maker : '');
    $('#spT').textContent = p.model; $('#spN').textContent = p.name;
    $('#spD').textContent = p.desc || ''; $('#spD').hidden = !p.desc;
    gallery(p);
    /* key figures */
    var fig = $('#spFig'); fig.textContent = '';
    [[p.kwh != null && !p.variants ? kwh(p.kwh) : null, p.usable ? 'корисна ' + kwh(p.usable) : 'ємність'], [p.kw != null && !p.variants ? kw(p.kw) : null, 'потужність'], [p.cycles ? nf(p.cycles) : null, 'циклів'], [p.kg ? kg(p.kg) : null, 'вага']].forEach(function(f){
      if (!f[0]) return; var d = el('div'); d.append(el('b', '', f[0]), el('span', '', f[1])); fig.appendChild(d);
    });
    fig.hidden = !fig.children.length;
    /* variants */
    var vw = $('#spVar'); vw.textContent = ''; vw.hidden = !p.variants;
    if (p.variants) p.variants.forEach(function(v, i){ var b = el('button', 'chip', v.model + ' · ' + (v.kwh != null ? kwh(v.kwh) : kw(v.kw))); b.type = 'button'; b.setAttribute('aria-pressed', String(i === 0)); b.addEventListener('click', function(){ $$('#spVar .chip').forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); }); variantRows(v); calcHref(p, v); buy(p, v); }); vw.appendChild(b); });
    /* spec groups */
    var box = $('#spGroups'); box.textContent = '';
    var vdl = el('dl'); vdl.id = 'spVarRows'; box.appendChild(vdl);
    (p.groups || []).forEach(function(g){ var dl = el('dl'); g[1].forEach(function(r){ kv(dl, r[0], r[1]); }); box.append(el('h4', '', g[0]), dl); });
    if (p.variants) variantRows(p.variants[0]);
    if (p.cert && p.cert.length) { var cs = el('div', 'certs'); p.cert.forEach(function(c){ cs.appendChild(el('span', '', c)); }); box.append(el('h4', '', 'Сертифікати'), cs); }
    if (p.warranty) box.append(el('h4', '', 'Гарантія'), el('p', 'spec__w', p.warranty));
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
    kv(dl, 'Модель', v.model);
    if (v.kwh != null) kv(dl, 'Ємність', kwh(v.kwh)); if (v.kw != null) kv(dl, 'Потужність', kw(v.kw));
    if (v.v) kv(dl, 'Номінальна напруга', v.v); (v.rows || []).forEach(function(r){ kv(dl, r[0], r[1]); });
    if (v.dims) kv(dl, 'Габарити', dims(v.dims)); if (v.kg) kv(dl, 'Вага', kg(v.kg));
  }

  /* ---- comparison ---- */
  var bar = $('#cmpBar'), dlg = $('#cmpDlg');
  function toggleCmp(id, on){
    var i = st.cmp.indexOf(id);
    if (on && i < 0) { if (st.cmp.length >= 3) { S.toast('Порівнювати можна до 3 моделей — зніміть одну з позначок.'); render(); if (st.sel) $('#spCmp').checked = st.cmp.indexOf(st.sel) >= 0; return; } st.cmp.push(id); }
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
  function range(p, k, f){ var a = p.variants.map(function(v){ return v[k]; }).filter(function(x){ return x != null; }); return a.length ? f(Math.min.apply(null, a)) + ' – ' + f(Math.max.apply(null, a)) : null; }
  $('#cmpClear').addEventListener('click', function(){ st.cmp = []; try { sessionStorage.setItem('eq-cmp', '[]'); } catch (e) {} render(); if (st.sel) $('#spCmp').checked = false; });
  $('#cmpGo').addEventListener('click', function(){
    var ps = st.cmp.map(D.byId), t = $('#cmpTable'); t.textContent = '';
    var rows = [['Ціна', function(p){ var r = priceOf(p); return r ? (r.from ? 'від ' : '') + uah(r.v) : 'за запитом'; }], ['Наявність', function(p){ return (STOCK[p.stock] || STOCK.order) + (p.lead ? ' · ' + p.lead : ''); }],
      ['Тип', function(p){ return CAT[p.cat]; }], ['Виробник', function(p){ return p.maker || '—'; }],
      ['Ємність', function(p){ return (p.variants && range(p, 'kwh', kwh)) || kwh(p.kwh); }], ['Корисна ємність', function(p){ return p.usable ? kwh(p.usable) : '—'; }],
      ['Потужність', function(p){ return (p.variants && range(p, 'kw', kw)) || kw(p.kw); }], ['Напруга', function(p){ return p.volt || '—'; }], ['Цикли', function(p){ return p.cycles ? nf(p.cycles) : '—'; }], ['Паралельно', function(p){ return p.parallel || '—'; }],
      ['Габарити', function(p){ return p.variants && p.variants[0].dims ? 'залежно від варіанта' : dims(p.dims); }], ['Вага', function(p){ return p.kg ? kg(p.kg) : p.variants ? range(p, 'kg', kg) || '—' : '—'; }], ['Захист', function(p){ return p.ip || '—'; }], ['Сертифікати', function(p){ return (p.cert || []).join(', ') || '—'; }], ['Гарантія', function(p){ return p.warranty || '—'; }]];
    var thead = el('thead'), hr = el('tr'); hr.appendChild(el('th'));
    ps.forEach(function(p){ var th = el('th'); th.scope = 'col'; th.append(pic(p.img[0], 'cmpt__ph'), el('b', '', p.model), el('small', '', p.name)); hr.appendChild(th); });
    thead.appendChild(hr); t.appendChild(thead);
    var tb = el('tbody');
    rows.forEach(function(r){ var tr = el('tr'), th = el('th', '', r[0]); th.scope = 'row'; tr.appendChild(th); ps.forEach(function(p){ tr.appendChild(el('td', '', r[1](p))); }); tb.appendChild(tr); });
    t.appendChild(tb);
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
  });
  $('#cmpX').addEventListener('click', function(){ dlg.close(); });
  dlg.addEventListener('click', function(e){ if (e.target === dlg) dlg.close(); });

  /* ---- boot ---- */
  $('#eqNote').textContent = D.OFFER.note + ' Дані на ' + D.OFFER.date + '.';
  var pdl = $('#pdlg');
  $('#pdX').addEventListener('click', function(){ pdl.close(); });
  pdl.addEventListener('click', function(e){ if (e.target === pdl) pdl.close(); });
  pdl.addEventListener('close', function(){ st.open = null; st.sel = null; $$('#cat .pc2').forEach(function(c){ c.classList.remove('is-sel'); }); syncUrl(); });
  render();
  var first = S.q.get('p'); if (D.byId(first)) open(first, false);
})();
