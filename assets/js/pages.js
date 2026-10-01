/* =====================================================================
   Storefront pages: home, request (the basket form) and the "from our
   stock" block on the calculator. The cabinet and login live in
   cabinet.js.
   ===================================================================== */
(function(){
  'use strict';
  var S = window.Site, P = window.PRODUCTS, K = window.KITS, page = document.body.dataset.page;
  var d = document, $ = function(s){ return d.querySelector(s); }, $$ = function(s){ return Array.prototype.slice.call(d.querySelectorAll(s)); };
  var nf = S.nf;
  function uah(v){ return nf(Math.round(v)) + ' ₴'; }
  function el(tag, cls, text){ var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function store(k, v){ try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function photo(img, cls){ var f = el('figure', 'ph' + (cls ? ' ' + cls : '')); if (!img) { f.classList.add('ph--none'); f.appendChild(el('span', '', 'Фото незабаром')); return f; } f.style.background = img.bg; var i = d.createElement('img'); i.src = img.src; i.alt = ''; i.loading = 'lazy'; i.decoding = 'async'; f.appendChild(i); return f; }
  function stockBadge(code){ return el('span', 'stock stock--' + code, P ? P.STOCK[code] : code); }
  function btn(text, cls, href){ var b = el(href ? 'a' : 'button', 'btn ' + (cls || 'btn--volt')); if (href) b.href = href; else b.type = 'button'; b.appendChild(el('span', '', text)); return b; }

  /* ---------------- home ---------------- */
  function compact(o){
    var c = el('article', 'kitc'), link = el('a', 'kitc__ph'); link.href = o.href; link.appendChild(photo(o.img)); link.appendChild(stockBadge(o.stock)); if (o.qty > 1) link.appendChild(el('span', 'kit__qty', '× ' + o.qty));
    var b = el('div', 'kitc__b'); b.appendChild(el('span', 'kitc__k', o.k)); var t = el('a', 'kitc__t', o.name); t.href = o.href; b.appendChild(t);
    if (o.sub) b.appendChild(el('small', 'kitc__s', o.sub)); if (o.facts) b.appendChild(el('span', 'kitc__f', o.facts));
    var f = el('div', 'kitc__p'); f.appendChild(el('b', '', o.price != null ? (o.from ? 'від ' : '') + uah(o.price) : 'Ціна за запитом'));
    var add = el('button', 'kitc__add'); add.type = 'button'; add.setAttribute('aria-label', 'Додати в заявку: ' + o.name); add.textContent = '+'; add.setAttribute('data-add', o.add);
    f.appendChild(add); b.appendChild(f); c.append(link, b); return c;
  }
  function kitItem(k){ var s = K.summary(k), n = s.lines.reduce(function(a, l){ return a + (l.p.cat === 'inverter' ? 0 : l.qty); }, 0);
    return { href: 'assistant.html?kit=' + k.id, img: s.img, stock: s.stock, qty: n, k: 'Комплект · ' + K.SEG[k.seg], name: k.name, sub: s.lines.map(function(l){ return (l.qty > 1 ? l.qty + ' × ' : '') + l.model; }).join(' + '),
      facts: nf(s.kwh, s.kwh < 10 ? 2 : 1) + ' кВт·год · ' + nf(s.kw, s.kw % 1 ? 1 : 0) + ' кВт · ' + K.hoursTxt(K.hours(s, k.load)), price: s.priced ? s.price : null, add: 'kit:' + k.id }; }
  function prodItem(p){ var v = p.variants ? p.variants.filter(function(x){ return x.price != null; })[0] : null, pr = v ? v.price : p.price;
    return { href: 'equipment.html?p=' + p.id, img: p.img[0], stock: p.stock, k: P.CAT[p.cat], name: p.name, sub: p.maker + ' · ' + p.model, facts: [p.kwh ? nf(p.kwh, p.kwh < 10 ? 2 : 1) + ' кВт·год' : '', p.kw ? nf(p.kw, p.kw % 1 ? 1 : 0) + ' кВт' : ''].filter(Boolean).join(' · '),
      price: pr, from: !!p.variants, add: 'product:' + p.id + (v ? ':' + v.model : '') }; }
  if (page === 'home' && K) {
    var hk = $('#homeKits'), hseg = $('#homeSeg'), hall = $('#homeKitsAll'), FEAT = ['flat-2k', 'home-aio', 'osbb-12', 'biz-aio'];
    var drawHome = function(seg){
      hk.textContent = '';
      var items = seg === 'all' ? FEAT.map(K.byId).map(kitItem) : K.forSeg(seg).map(kitItem);
      if (seg !== 'all') P.list.filter(function(p){ return (p.tags || []).indexOf(seg) >= 0 && p.stock !== 'order'; }).slice(0, 4 - items.length).forEach(function(p){ items.push(prodItem(p)); });
      items.forEach(function(o){ hk.appendChild(compact(o)); });
      hall.href = 'equipment.html?cat=kits' + (seg === 'all' ? '' : '&who=' + seg);
      hseg.querySelectorAll('button').forEach(function(b){ b.setAttribute('aria-pressed', String(b.dataset.v === seg)); });
    };
    hseg.querySelectorAll('button').forEach(function(b){ b.addEventListener('click', function(){ drawHome(b.dataset.v); }); });
    drawHome('all');
    var fb = $('#firstBatch');
    if (fb) {
      P.list.filter(function(p){ return p.stock === 'pre' || p.stock === 'in'; }).slice(0, 11).forEach(function(p){ fb.appendChild(compact(prodItem(p))); });
      var more = el('a', 'kitc kitc--more'); more.href = 'equipment.html';
      more.append(el('span', 'kitc__k', 'Каталог'), el('b', '', 'Усі ' + P.list.length + ' моделей'), el('span', 'kitc__s', 'батареї, стійки, інвертори й станції — з цінами →')); fb.appendChild(more);
    }
    var hp = P.byId(P.featured), hs = $('#heroPrice'); if (hp && hs) hs.textContent = uah(hp.price);
    var hero = $('.hero'); if (hero && S.fine && !S.RM) hero.addEventListener('pointermove', function(e){ var r = hero.getBoundingClientRect(); hero.style.setProperty('--mx', ((e.clientX - r.left) / r.width * 100) + '%'); hero.style.setProperty('--my', ((e.clientY - r.top) / r.height * 100) + '%'); });
  }

  /* ---------------- calculator: a system from our stock ---------------- */
  if (page === 'calculator' && K) {
    var rec = $('#kitRec');
    var renderRec = function(o){
      if (!rec || !o) return; var kit = K.compose({ who: o.who === 'ind' ? 'biz' : o.who, cap: o.cap, pow: o.pow }), s = K.summary(kit);
      rec.textContent = '';
      var card = el('div', 'kitrec'), pics = el('div', 'kit__pics'), shown = {};
      s.lines.forEach(function(l){ if (shown[l.id] || !l.img) return; shown[l.id] = 1; var f = photo(l.img, 'kit__ph'); if (l.qty > 1) f.appendChild(el('span', 'kit__qty', '× ' + l.qty)); pics.appendChild(f); });
      pics.appendChild(stockBadge(s.stock)); card.appendChild(pics);
      var b = el('div', 'kit__b'); b.appendChild(el('h3', '', 'Під ' + nf(o.cap, o.cap < 10 ? 1 : 0) + ' кВт·год і ' + nf(o.pow, o.pow < 10 ? 1 : 0) + ' кВт підійде:'));
      var ul = el('ul', 'kit__lines'); s.lines.forEach(function(l){ var li = el('li'), a = el('a', '', (l.qty > 1 ? l.qty + ' × ' : '') + l.name); a.href = 'equipment.html?p=' + l.id; li.append(a, el('span', '', l.sum != null ? uah(l.sum) : 'за запитом')); ul.appendChild(li); }); b.appendChild(ul);
      if (kit.notes.length) b.appendChild(el('p', 'hint', kit.notes.join(' ')));
      var foot = el('div', 'kit__foot'), pr = el('div', 'kit__price'); pr.appendChild(el('b', '', s.priced ? uah(s.price) : 'Ціна за запитом')); pr.appendChild(el('small', '', nf(s.kwh, 1) + ' кВт·год · ' + nf(s.kw) + ' кВт · обладнання, орієнтовно'));
      var acts = el('div', 'kit__acts'), add = btn('Додати в заявку'); add.setAttribute('data-add', 'sys:' + encodeURIComponent(JSON.stringify(kit.items)));
      acts.append(add, btn('Як встановимо', 'btn--ghost', 'assistant.html?seg=' + (o.who === 'ind' ? 'biz' : o.who))); foot.append(pr, acts); b.appendChild(foot); card.appendChild(b); rec.appendChild(card);
    };
    d.addEventListener('calc:update', function(e){ renderRec(e.detail); });
    /* the calculator runs before this script: take its current state */
    var cs = window.__player && window.__player.st; if (cs) renderRec({ who: cs.who, cap: cs.capIn, pow: cs.powIn });
  }

  /* ---------------- request (basket) ---------------- */
  if (page === 'request' && window.Cart) {
    var C = window.Cart, lst = $('#rqList'), empty = $('#rqEmpty'), sumEl = $('#rqSum'), form = $('#rqForm'), okEl = $('#rqOk');
    var inst = $('#rqInstall'), gd = $('#rqGrindim'), reg = $('#rqRegion');
    var OBL = ['м. Київ', 'Київська', 'Вінницька', 'Волинська', 'Дніпропетровська', 'Донецька', 'Житомирська', 'Закарпатська', 'Запорізька', 'Івано-Франківська', 'Кіровоградська', 'Луганська', 'Львівська', 'Миколаївська', 'Одеська', 'Полтавська', 'Рівненська', 'Сумська', 'Тернопільська', 'Харківська', 'Херсонська', 'Хмельницька', 'Черкаська', 'Чернівецька', 'Чернігівська'];
    if (reg) OBL.forEach(function(n, i){ var o = el('option', '', i ? n + ' область' : n); o.value = n; reg.appendChild(o); });
    if (S.q.get('survey')) $('#rqMsg').value = 'Потрібен огляд об’єкта: ';
    var proj = store('bess-project'); if (proj && proj.contact) { $('#rqName').value = proj.contact.name || ''; $('#rqPhone').value = proj.contact.phone || ''; if (proj.seg) $('#rqWho').value = proj.seg; }
    function draw(){
      var a = C.load(); lst.textContent = ''; empty.hidden = !!a.length; $('#rqItems').hidden = !a.length;
      a.forEach(function(x){
        var r = el('div', 'rqi'), ph = photo(x.img ? { src: x.img.src, bg: x.img.bg } : null, 'rqi__ph');
        var t = el('div', 'rqi__t'); t.appendChild(el('b', '', x.name)); if (x.sub) t.appendChild(el('small', '', x.sub)); if (x.stock && P) t.appendChild(el('small', 'rqi__st', P.STOCK[x.stock]));
        var q = el('div', 'qty'), minus = el('button', '', '−'), num = el('span', '', String(x.qty)), plus = el('button', '', '+');
        minus.type = plus.type = 'button'; minus.setAttribute('aria-label', 'Менше'); plus.setAttribute('aria-label', 'Більше');
        minus.addEventListener('click', function(){ C.setQty(x.key, x.qty - 1); }); plus.addEventListener('click', function(){ C.setQty(x.key, x.qty + 1); }); q.append(minus, num, plus);
        var pr = el('div', 'rqi__p', x.price != null ? uah(x.price * x.qty) : 'за запитом');
        var rm = el('button', 'rqi__rm'); rm.type = 'button'; rm.setAttribute('aria-label', 'Прибрати ' + x.name); rm.textContent = '×'; rm.addEventListener('click', function(){ C.remove(x.key); });
        r.append(ph, t, q, pr, rm); lst.appendChild(r);
      });
      var tot = C.total(), needInst = a.some(function(x){ return x.install; }), any = a.some(function(x){ return x.price == null; });
      sumEl.textContent = a.length ? uah(tot) + (any ? ' + позиції за запитом' : '') : '—';
      if (inst && !inst.dataset.touched) inst.checked = needInst;
      $('#rqInstNote').textContent = inst && inst.checked ? 'Монтаж, щит і кабелі порахуємо після огляду й додамо в пропозицію.' : 'Лише обладнання: доставка або самовивіз.';
    }
    if (inst) inst.addEventListener('change', function(){ inst.dataset.touched = '1'; draw(); });
    d.addEventListener('cart:change', draw); draw();
    /* on the platform the request goes to our backend and gets a number; the static copy keeps it in the browser */
    var API = window.Api && window.Api.mode === 'live' ? window.Api : null;
    if (API) { $('#rqNote').textContent = 'Після надсилання заявка з’явиться в кабінеті — вхід за цим телефоном.'; $('#rqOkEye').innerHTML = '<b>●</b> Заявку прийнято'; }
    form.addEventListener('submit', function(e){
      e.preventDefault(); if (!form.reportValidity()) return;
      var lead = { at: Date.now(), items: C.load(), total: C.total(), install: !!(inst && inst.checked), grindim: !!(gd && gd.checked), who: $('#rqWho').value, region: reg ? reg.value : '', msg: $('#rqMsg').value, contact: { name: $('#rqName').value.trim(), phone: $('#rqPhone').value.trim() } };
      function done(num){
        store('bess-lead', lead); C.clear(); form.hidden = true; $('#rqItems').hidden = true; empty.hidden = true;
        if (num) $('#rqOkEye').lastChild.textContent = ' Заявку ' + num + ' прийнято';
        okEl.hidden = false; S.scrollToEl(okEl);
      }
      if (!API) { done(null); return; }
      var sb = form.querySelector('button[type=submit]'); sb.disabled = true;
      API.order({ items: lead.items.map(function(x){ return { key: x.key, qty: x.qty }; }), install: lead.install, grindim: lead.grindim, who: lead.who, region: lead.region, msg: lead.msg, contact: lead.contact, survey: !!S.q.get('survey') })
        .then(function(r){ lead.number = r.number; done(r.number); }, function(er){ S.toast(API.message(er)); })
        .then(function(){ sb.disabled = false; });
    });
  }

})();
