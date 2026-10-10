/* =====================================================================
   Request basket ("Заявка") — shared by every page. Items are products,
   product variants, ready kits or a system from the calculator / AI; a
   snapshot of name / price / photo is stored so the basket renders
   without the catalogue. The browser keeps the working copy with the time
   of its last change; for a signed-in client account.js keeps it in step
   with the account (the newer side wins).
   Buttons: <button data-add="product:<id>[:<variant>]">, data-add="kit:<id>"
   or data-add="sys:<items>". Every such button and every product card
   (.pc2[data-id]) shows what is already in the request: «У заявці · 2»
   with − / + right on the card.
   ===================================================================== */
window.Cart = (function(){
  'use strict';
  var KEY = 'bess-cart', AT = 'bess-cart-at', d = document, S = window.Site || {};
  function load(){ try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; } }
  function at(){ try { return +localStorage.getItem(AT) || 0; } catch (e) { return 0; } }
  function write(a, t){ try { localStorage.setItem(KEY, JSON.stringify(a)); localStorage.setItem(AT, String(t)); } catch (e) {} }
  function store(a, from){ write(a, Date.now()); changed(from || 'local'); }
  function changed(from){ badge(); decorate(); d.dispatchEvent(new CustomEvent('cart:change', { detail: { from: from } })); }
  function count(){ return load().reduce(function(n, x){ return n + (x.qty || 1); }, 0); }
  function total(){ return load().reduce(function(s, x){ return s + (x.price != null ? x.price * (x.qty || 1) : 0); }, 0); }
  function badge(){ var n = count(); d.querySelectorAll('[data-cart-count]').forEach(function(el){ el.textContent = n; el.hidden = !n; }); }
  var nfmt = function(v){ return S.nf ? S.nf(v, v % 1 ? 1 : 0) : String(v); };

  /* the basket key of a button: product:<id>:<variant> (empty variant included), kit:<id>, sys:<items> */
  function keyOf(ref){ var a = String(ref || '').split(':'); return a[0] === 'product' ? 'product:' + a[1] + ':' + (a[2] || '') : String(ref || ''); }
  function qtyOf(key){ var n = 0; load().forEach(function(x){ if (x.key === key) n += x.qty || 1; }); return n; }
  /* all variants of a product together, for its card */
  function qtyOfProduct(id){ var n = 0, pre = 'product:' + id + ':'; load().forEach(function(x){ if (x.key.indexOf(pre) === 0) n += x.qty || 1; }); return n; }

  /* snapshot from the catalogue / kit data available on the page */
  function snapshot(ref){
    var a = ref.split(':'), type = a[0], id = a[1], v = a[2] || '';
    if (type === 'kit' && window.KITS) {
      var k = window.KITS.byId(id); if (!k) return null; var s = window.KITS.summary(k);
      return { key: 'kit:' + id, type: 'kit', id: id, name: tx('Комплект «', 'Kit «') + k.name + '»', sub: s.lines.map(function(l){ return l.model + (l.qty > 1 ? ' × ' + l.qty : ''); }).join(' + '),
        price: s.priced ? s.price : null, img: s.img ? { src: s.img.src, bg: s.img.bg } : null, install: !!k.install, stock: s.stock };
    }
    if (type === 'sys' && window.KITS) {
      var items = JSON.parse(decodeURIComponent(id)), sk = { items: items }, ss = window.KITS.summary(sk);
      return { key: 'sys:' + id, type: 'sys', id: id, name: tx('Система під ваші потреби', 'A system for your needs'), sub: ss.lines.map(function(l){ return l.model + (l.qty > 1 ? ' × ' + l.qty : ''); }).join(' + '),
        price: ss.priced ? ss.price : null, img: ss.img ? { src: ss.img.src, bg: ss.img.bg } : null, install: ss.lines.some(function(l){ return l.p.cat !== 'portable'; }), stock: ss.stock };
    }
    if (type === 'product' && window.PRODUCTS) {
      var p = window.PRODUCTS.byId(id); if (!p) return null; var vv = null;
      if (v && p.variants) p.variants.forEach(function(x){ if (x.model === v) vv = x; });
      var img = p.img[0];
      return { key: 'product:' + id + ':' + v, type: 'product', id: id, v: v, name: vv ? p.name.replace(/\d+(–\d+)? (кВт(·год)?|kWh?)/, (vv.kw != null ? nfmt(vv.kw) + tx(' кВт', ' kW') : nfmt(vv.kwh) + tx(' кВт·год', ' kWh'))) : p.name,
        sub: (p.maker ? p.maker + ' · ' : '') + (vv ? vv.model : p.model), price: vv ? vv.price : p.price, img: img ? { src: img.src, bg: img.bg } : null, install: p.cat !== 'portable', stock: p.stock };
    }
    return null;
  }
  function add(ref, qty){
    var s = typeof ref === 'string' ? snapshot(ref) : ref; if (!s) return false;
    var a = load(), f = null; a.forEach(function(x){ if (x.key === s.key) f = x; });
    if (f) f.qty = Math.min(99, (f.qty || 1) + (qty || 1)); else { s.qty = qty || 1; a.push(s); }
    store(a); added(s); return true;
  }
  function setQty(key, q){ if (q < 1) { remove(key); return; } var a = load().map(function(x){ if (x.key === key) x.qty = Math.max(1, Math.min(99, q)); return x; }); store(a); }
  function remove(key){ store(load().filter(function(x){ return x.key !== key; })); }
  function clear(){ store([]); }
  /* the account's copy replaces this one (account.js) */
  function replace(items, t){ write(Array.isArray(items) ? items : [], t || Date.now()); changed('account'); }

  /* "added" toast with a link to the basket */
  var tEl = null, tT = 0;
  function added(s){
    if (!tEl) { tEl = d.createElement('div'); tEl.className = 'addtoast'; tEl.setAttribute('role', 'status'); d.body.appendChild(tEl); }
    tEl.textContent = '';
    var t = d.createElement('span'); t.textContent = tx('Додано в заявку: ', 'Added to the request: ') + s.name;
    var a = d.createElement('a'); a.href = 'request.html'; a.className = 'btn btn--volt btn--sm'; a.textContent = tx('До заявки · ', 'To the request · ') + count();
    tEl.append(t, a); tEl.classList.add('is-on'); clearTimeout(tT); tT = setTimeout(function(){ tEl.classList.remove('is-on'); }, 4200);
  }
  d.addEventListener('click', function(e){
    var st = e.target.closest && e.target.closest('[data-step]');
    if (st) { e.preventDefault(); var box = st.closest('[data-instep]'), k = box.getAttribute('data-instep'); setQty(k, qtyOf(k) + (+st.getAttribute('data-step'))); return; }
    var b = e.target.closest && e.target.closest('[data-add]'); if (!b) return;
    e.preventDefault(); add(b.getAttribute('data-add'), +(b.getAttribute('data-qty') || 1));
  });
  window.addEventListener('storage', function(e){ if (e.key === KEY) { badge(); decorate(); d.dispatchEvent(new CustomEvent('cart:change', { detail: { from: 'tab' } })); } });

  /* ---- what is already in the request, right on the cards ---- */
  function label(n){ return tx('У заявці · ', 'In request · ') + n; }
  /* inside any card (kit or product) the badge on the photo says «У заявці · N», so the stepper shows just the number */
  function stepText(n, short){ return short ? String(n) : label(n); }
  function stepper(key, n, short){
    var w = d.createElement('span'); w.className = 'instep' + (short ? ' instep--short' : ''); w.setAttribute('data-instep', key);
    var m = d.createElement('button'), v = d.createElement('span'), p = d.createElement('button');
    m.type = p.type = 'button'; m.setAttribute('data-step', '-1'); p.setAttribute('data-step', '1'); m.textContent = '−'; p.textContent = '+';
    m.setAttribute('aria-label', tx('Менше', 'Fewer')); p.setAttribute('aria-label', tx('Більше', 'More')); v.className = 'instep__n'; v.textContent = stepText(n, short); v.title = label(n);
    w.append(m, v, p); return w;
  }
  function cardOf(el){ return el.closest('.pc2, .kitc, .kit, .kitrec, .kitmini, .pline, article') || null; }
  function tag(card, n){
    var t = card.querySelector(':scope > .incart, :scope .pc2__top > .incart, :scope .kitc__ph > .incart'), host = card.querySelector('.pc2__top, .kitc__ph, .kit__pics') || card;
    if (!n) { if (t) t.remove(); card.classList.remove('is-incart'); return; }
    if (!t) { t = d.createElement('span'); t.className = 'incart'; host.appendChild(t); }
    if (t.textContent !== label(n)) t.textContent = label(n);
    card.classList.add('is-incart');
  }
  /* a page opened by nav.js: its «Додати» buttons get their «У заявці» state */
  d.addEventListener('page:load', function(){ badge(); decorate(); });
  var busy = false;
  function decorate(){
    if (busy) return; busy = true;
    try {
      d.querySelectorAll('[data-add]').forEach(function(b){
        var key = keyOf(b.getAttribute('data-add')), n = qtyOf(key), next = b.nextElementSibling, has = next && next.hasAttribute('data-instep') ? next : null;
        var card = cardOf(b), short = !!card;
        if (has && has.getAttribute('data-instep') !== key) { has.remove(); has = null; }
        if (n) {
          if (!has) b.after(stepper(key, n, short)); else { var v = has.querySelector('.instep__n'); if (v.textContent !== stepText(n, short)) { v.textContent = stepText(n, short); v.title = label(n); } }
          if (!b.hidden) b.hidden = true;
        } else { if (has) has.remove(); if (b.hidden) b.hidden = false; }
        if (short) tag(card, key.indexOf('product:') === 0 ? qtyOfProduct(key.split(':')[1]) : n);
      });
      d.querySelectorAll('.pc2[data-id]').forEach(function(c){ tag(c, qtyOfProduct(c.getAttribute('data-id'))); });
    } finally { busy = false; }
  }
  /* cards are drawn and redrawn by the page scripts: mark them as they appear */
  var queued = false;
  if (window.MutationObserver) new MutationObserver(function(){ if (busy || queued) return; queued = true; requestAnimationFrame(function(){ queued = false; decorate(); }); }).observe(d.body, { childList: true, subtree: true });
  badge(); decorate();

  /* the assistant button follows the product you are looking at */
  var fab = d.querySelector('[data-asst-fab]');
  if (fab) {
    var set = function(){ var q = new URLSearchParams(location.search), p = q.get('p'), k = q.get('kit'); fab.href = 'assistant.html' + (p ? '?p=' + encodeURIComponent(p) : k ? '?kit=' + encodeURIComponent(k) : '?from=' + (d.body.dataset.page || '')); };
    set(); fab.addEventListener('click', set); fab.addEventListener('pointerenter', set);
  }
  return { load: load, at: at, add: add, setQty: setQty, remove: remove, clear: clear, replace: replace, count: count, total: total, snapshot: snapshot, keyOf: keyOf, qtyOf: qtyOf, decorate: decorate };
})();
