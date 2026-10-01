/* =====================================================================
   Request basket ("Заявка") — shared by every page. Items are products,
   product variants or ready kits; a snapshot of name / price / photo is
   stored so the basket renders without the catalogue. Nothing leaves the
   browser in the prototype.
   Buttons: <button data-add="product:<id>[:<variant>]"> or data-add="kit:<id>".
   ===================================================================== */
window.Cart = (function(){
  'use strict';
  var KEY = 'bess-cart', d = document;
  function load(){ try { return JSON.parse(localStorage.getItem(KEY) || '[]') || []; } catch (e) { return []; } }
  function store(a){ try { localStorage.setItem(KEY, JSON.stringify(a)); } catch (e) {} badge(); d.dispatchEvent(new CustomEvent('cart:change')); }
  function count(){ return load().reduce(function(n, x){ return n + (x.qty || 1); }, 0); }
  function total(){ return load().reduce(function(s, x){ return s + (x.price != null ? x.price * (x.qty || 1) : 0); }, 0); }
  function badge(){ var n = count(); d.querySelectorAll('[data-cart-count]').forEach(function(el){ el.textContent = n; el.hidden = !n; }); }

  /* snapshot from the catalogue / kit data available on the page */
  function snapshot(ref){
    var a = ref.split(':'), type = a[0], id = a[1], v = a[2] || '';
    if (type === 'kit' && window.KITS) {
      var k = window.KITS.byId(id); if (!k) return null; var s = window.KITS.summary(k);
      return { key: 'kit:' + id, type: 'kit', id: id, name: 'Комплект «' + k.name + '»', sub: s.lines.map(function(l){ return l.model + (l.qty > 1 ? ' × ' + l.qty : ''); }).join(' + '),
        price: s.priced ? s.price : null, img: s.img ? { src: s.img.src, bg: s.img.bg } : null, install: !!k.install, stock: s.stock };
    }
    if (type === 'sys' && window.KITS) {
      var items = JSON.parse(decodeURIComponent(id)), sk = { items: items }, ss = window.KITS.summary(sk);
      return { key: 'sys:' + id, type: 'sys', id: id, name: 'Система під ваші потреби', sub: ss.lines.map(function(l){ return l.model + (l.qty > 1 ? ' × ' + l.qty : ''); }).join(' + '),
        price: ss.priced ? ss.price : null, img: ss.img ? { src: ss.img.src, bg: ss.img.bg } : null, install: ss.lines.some(function(l){ return l.p.cat !== 'portable'; }), stock: ss.stock };
    }
    if (type === 'product' && window.PRODUCTS) {
      var p = window.PRODUCTS.byId(id); if (!p) return null; var vv = null;
      if (v && p.variants) p.variants.forEach(function(x){ if (x.model === v) vv = x; });
      var img = p.img[0];
      return { key: 'product:' + id + ':' + v, type: 'product', id: id, v: v, name: vv ? p.name.replace(/\d+(–\d+)? кВт(·год)?/, (vv.kw != null ? vv.kw.toLocaleString('uk-UA') + ' кВт' : vv.kwh.toLocaleString('uk-UA') + ' кВт·год')) : p.name,
        sub: (p.maker ? p.maker + ' · ' : '') + (vv ? vv.model : p.model), price: vv ? vv.price : p.price, img: img ? { src: img.src, bg: img.bg } : null, install: p.cat !== 'portable', stock: p.stock };
    }
    return null;
  }
  function add(ref, qty){
    var s = typeof ref === 'string' ? snapshot(ref) : ref; if (!s) return false;
    var a = load(), f = null; a.forEach(function(x){ if (x.key === s.key) f = x; });
    if (f) f.qty = (f.qty || 1) + (qty || 1); else { s.qty = qty || 1; a.push(s); }
    store(a); added(s); return true;
  }
  function setQty(key, q){ var a = load().map(function(x){ if (x.key === key) x.qty = Math.max(1, Math.min(99, q)); return x; }); store(a); }
  function remove(key){ store(load().filter(function(x){ return x.key !== key; })); }
  function clear(){ store([]); }

  /* "added" toast with a link to the basket */
  var tEl = null, tT = 0;
  function added(s){
    if (!tEl) { tEl = d.createElement('div'); tEl.className = 'addtoast'; tEl.setAttribute('role', 'status'); d.body.appendChild(tEl); }
    tEl.textContent = '';
    var t = d.createElement('span'); t.textContent = 'Додано в заявку: ' + s.name;
    var a = d.createElement('a'); a.href = 'request.html'; a.className = 'btn btn--volt btn--sm'; a.textContent = 'До заявки · ' + count();
    tEl.append(t, a); tEl.classList.add('is-on'); clearTimeout(tT); tT = setTimeout(function(){ tEl.classList.remove('is-on'); }, 4200);
  }
  d.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('[data-add]'); if (!b) return;
    e.preventDefault(); add(b.getAttribute('data-add'), +(b.getAttribute('data-qty') || 1));
  });
  window.addEventListener('storage', function(e){ if (e.key === KEY) badge(); });
  badge();

  /* the assistant button follows the product you are looking at */
  var fab = d.querySelector('[data-asst-fab]');
  if (fab) {
    var set = function(){ var q = new URLSearchParams(location.search), p = q.get('p'), k = q.get('kit'); fab.href = 'assistant.html' + (p ? '?p=' + encodeURIComponent(p) : k ? '?kit=' + encodeURIComponent(k) : '?from=' + (d.body.dataset.page || '')); };
    set(); fab.addEventListener('click', set); fab.addEventListener('pointerenter', set);
  }
  return { load: load, add: add, setQty: setQty, remove: remove, clear: clear, count: count, total: total, snapshot: snapshot };
})();
