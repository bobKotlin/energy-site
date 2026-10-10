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
  function uah(v){ return S.uah(v); }
  function el(tag, cls, text){ var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function store(k, v){ try { if (v === undefined) return JSON.parse(localStorage.getItem(k) || 'null'); localStorage.setItem(k, JSON.stringify(v)); } catch (e) { return null; } }
  function photo(img, cls){ var f = el('figure', 'ph' + (cls ? ' ' + cls : '')); if (!img) { f.classList.add('ph--none'); f.appendChild(el('span', '', tx('Фото незабаром', 'Photo coming soon'))); return f; } f.style.background = img.bg; var i = d.createElement('img'); i.src = S.asset(img.src); i.alt = ''; i.loading = 'lazy'; i.decoding = 'async'; f.appendChild(i); return f; }
  function stockBadge(code){ return el('span', 'stock stock--' + code, P ? P.STOCK[code] : code); }
  function btn(text, cls, href){ var b = el(href ? 'a' : 'button', 'btn ' + (cls || 'btn--volt')); if (href) b.href = href; else b.type = 'button'; b.appendChild(el('span', '', text)); return b; }
  /* specs as small chips instead of a «·»-chained line: [{ t, title, ic }] or strings */
  var CLOCK = '<svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="8" cy="8" r="6"/><path d="M8 4.8V8l2.2 1.6"/></svg>';
  function chips(list, cls){ var w = el('div', 'fchips' + (cls ? ' ' + cls : '')); list.forEach(function(f){ if (!f) return; var o = typeof f === 'string' ? { t: f } : f, c = el('i', '', o.t); if (o.title) c.title = o.title; if (o.ic) c.insertAdjacentHTML('afterbegin', o.ic); w.appendChild(c); }); return w; }

  /* ---------------- home ---------------- */
  function compact(o){
    var c = el('article', 'kitc'), link = el('a', 'kitc__ph'); link.href = o.href; link.appendChild(photo(o.img)); link.appendChild(stockBadge(o.stock)); if (o.qty > 1) link.appendChild(el('span', 'kit__qty', '× ' + o.qty));
    var b = el('div', 'kitc__b'); b.appendChild(el('span', 'kitc__k', o.k)); var t = el('a', 'kitc__t', o.name); t.href = o.href; b.appendChild(t);
    if (o.sub) b.appendChild(el('small', 'kitc__s', o.sub)); if (o.facts && o.facts.length) b.appendChild(chips(o.facts, 'kitc__f'));
    var f = el('div', 'kitc__p'); f.appendChild(el('b', '', o.price != null ? (o.from ? tx('від ', 'from ') : '') + uah(o.price) : tx('Ціна за запитом', 'Price on request')));
    var add = el('button', 'kitc__add'); add.type = 'button'; add.setAttribute('aria-label', tx('Додати в заявку: ', 'Add to the request: ') + o.name); add.textContent = '+'; add.setAttribute('data-add', o.add);
    f.appendChild(add); b.appendChild(f); c.append(link, b); return c;
  }
  function kitItem(k){ var s = K.summary(k), n = s.lines.reduce(function(a, l){ return a + (l.p.cat === 'inverter' ? 0 : l.qty); }, 0), ht = K.hoursTxt(K.hours(s, k.load));
    return { href: 'assistant.html?kit=' + k.id, img: s.img, stock: s.stock, qty: n, k: tx('Комплект · ', 'Kit · ') + K.SEG[k.seg], name: k.name,
      facts: [nf(s.kwh, s.kwh < 10 ? 2 : 1) + tx(' кВт·год', ' kWh'), nf(s.kw, s.kw % 1 ? 1 : 0) + tx(' кВт', ' kW'), ht === '—' ? null : { t: ht, ic: CLOCK, title: tx('Резерв при типовому навантаженні', 'Backup at a typical load') }], price: s.priced ? s.price : null, add: 'kit:' + k.id }; }
  /* a spec chip only when the name does not already carry that figure */
  var NAME_KWH = /(кВт·год|Вт·год|kWh|Wh)/, NAME_KW = /\d\s?(кВт(?!·)|kW(?!h))/;
  function prodItem(p){ var v = p.variants ? p.variants.filter(function(x){ return x.price != null; })[0] : null, pr = v ? v.price : p.price, nm = p.name || '';
    return { href: 'equipment.html?p=' + p.id, img: p.img[0], stock: p.stock, k: P.CAT[p.cat], name: p.name, sub: p.maker + ' · ' + p.model, facts: [p.kwh && !NAME_KWH.test(nm) ? nf(p.kwh, p.kwh < 10 ? 2 : 1) + tx(' кВт·год', ' kWh') : '', p.kw && !NAME_KW.test(nm) ? nf(p.kw, p.kw % 1 ? 1 : 0) + tx(' кВт', ' kW') : ''].filter(Boolean),
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
      more.append(el('span', 'kitc__k', tx('Каталог', 'Catalogue')), el('b', '', tx('Усі ' + P.list.length + ' моделей', 'All ' + P.list.length + ' models')), el('span', 'kitc__s', tx('Відкрити каталог →', 'Open the catalogue →'))); fb.appendChild(more);
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
      var b = el('div', 'kit__b'), hd = el('div', 'kitrec__h'); hd.append(el('h3', '', tx('Склад системи', 'System components')), chips([nf(s.kwh, 1) + tx(' кВт·год', ' kWh'), nf(s.kw) + tx(' кВт', ' kW')])); b.appendChild(hd);
      var ul = el('ul', 'kit__lines'); s.lines.forEach(function(l){ var li = el('li'), a = el('a', '', (l.qty > 1 ? l.qty + ' × ' : '') + l.name); a.href = 'equipment.html?p=' + l.id; li.append(a, el('span', '', l.sum != null ? uah(l.sum) : tx('за запитом', 'on request'))); ul.appendChild(li); }); b.appendChild(ul);
      if (kit.notes.length) { var tg = el('div', 'ptags'); kit.notes.forEach(function(n){ tg.appendChild(el('span', 'ptag', n.replace(/\.$/, ''))); }); b.appendChild(tg); }
      var foot = el('div', 'kit__foot'), pr = el('div', 'kit__price'); pr.appendChild(el('b', '', s.priced ? uah(s.price) : tx('Ціна за запитом', 'Price on request'))); pr.appendChild(el('small', '', tx('обладнання, орієнтовно', 'equipment, indicative')));
      var acts = el('div', 'kit__acts'), add = btn(tx('Додати в заявку', 'Add to request')); add.setAttribute('data-add', 'sys:' + encodeURIComponent(JSON.stringify(kit.items)));
      acts.append(add, btn(tx('Як встановимо', 'How we install it'), 'btn--ghost', 'assistant.html?seg=' + (o.who === 'ind' ? 'biz' : o.who))); foot.append(pr, acts); b.appendChild(foot); card.appendChild(b); rec.appendChild(card);
    };
    d.addEventListener('calc:update', function(e){ renderRec(e.detail); }, { signal: S.page.signal });
    /* the calculator runs before this script: take its current state */
    var cs = window.__player && window.__player.st; if (cs) renderRec({ who: cs.who, cap: cs.capIn, pow: cs.powIn });
  }

  /* ---------------- request (basket) ----------------
     Works with or without an account: the one must is a way to reach the
     buyer (a phone or an e-mail). Signed in, the contact comes from the
     account and the request appears in the cabinet; a guest gets a claim
     token kept in this browser (account.js picks it up after sign-in). */
  if (page === 'request' && window.Cart) {
    var C = window.Cart, lst = $('#rqList'), empty = $('#rqEmpty'), sumEl = $('#rqSum'), form = $('#rqForm'), okEl = $('#rqOk'), errEl = $('#rqErr');
    var inst = $('#rqInstall'), reg = $('#rqRegion'), phoneEl = $('#rqPhone'), emailEl = $('#rqEmail');
    var OBL = [['м. Київ', 'Kyiv city'], ['Київська', 'Kyiv'], ['Вінницька', 'Vinnytsia'], ['Волинська', 'Volyn'], ['Дніпропетровська', 'Dnipropetrovsk'], ['Донецька', 'Donetsk'], ['Житомирська', 'Zhytomyr'], ['Закарпатська', 'Zakarpattia'], ['Запорізька', 'Zaporizhzhia'], ['Івано-Франківська', 'Ivano-Frankivsk'], ['Кіровоградська', 'Kirovohrad'], ['Луганська', 'Luhansk'], ['Львівська', 'Lviv'], ['Миколаївська', 'Mykolaiv'], ['Одеська', 'Odesa'], ['Полтавська', 'Poltava'], ['Рівненська', 'Rivne'], ['Сумська', 'Sumy'], ['Тернопільська', 'Ternopil'], ['Харківська', 'Kharkiv'], ['Херсонська', 'Kherson'], ['Хмельницька', 'Khmelnytskyi'], ['Черкаська', 'Cherkasy'], ['Чернівецька', 'Chernivtsi'], ['Чернігівська', 'Chernihiv']];
    if (reg) OBL.forEach(function(n, i){ var o = el('option', '', i ? tx(n[0] + ' область', n[1] + ' region') : tx(n[0], n[1])); o.value = n[0]; reg.appendChild(o); });
    if (S.q.get('survey')) $('#rqMsg').value = tx('Потрібен огляд об’єкта: ', 'A site survey is needed: ');
    var proj = store('bess-project'); if (proj && proj.contact) { $('#rqName').value = proj.contact.name || ''; phoneEl.value = proj.contact.phone || ''; if (proj.seg) $('#rqWho').value = proj.seg; }
    function draw(){
      var a = C.load(); lst.textContent = ''; empty.hidden = !!a.length; $('#rqItems').hidden = !a.length;
      a.forEach(function(x0){
        /* names, photo and price from the catalogue of this page's language; the stored snapshot if the model is gone */
        var fresh = null; try { fresh = C.snapshot(x0.key); } catch (e) { fresh = null; }
        var x = fresh ? Object.assign({}, fresh, { qty: x0.qty }) : x0;
        var r = el('div', 'rqi'), ph = photo(x.img ? { src: x.img.src, bg: x.img.bg } : null, 'rqi__ph');
        var t = el('div', 'rqi__t'); t.appendChild(el('b', '', x.name)); if (x.sub) t.appendChild(el('small', '', x.sub)); if (x.stock && P) t.appendChild(el('small', 'rqi__st', P.STOCK[x.stock]));
        var q = el('div', 'qty'), minus = el('button', '', '−'), num = el('span', '', String(x.qty)), plus = el('button', '', '+');
        minus.type = plus.type = 'button'; minus.setAttribute('aria-label', tx('Менше', 'Fewer')); plus.setAttribute('aria-label', tx('Більше', 'More'));
        minus.addEventListener('click', function(){ C.setQty(x.key, x.qty - 1); }); plus.addEventListener('click', function(){ C.setQty(x.key, x.qty + 1); }); q.append(minus, num, plus);
        var pr = el('div', 'rqi__p', x.price != null ? uah(x.price * x.qty) : tx('за запитом', 'on request'));
        var rm = el('button', 'rqi__rm'); rm.type = 'button'; rm.setAttribute('aria-label', tx('Прибрати ', 'Remove ') + x.name); rm.textContent = '×'; rm.addEventListener('click', function(){ C.remove(x.key); });
        r.append(ph, t, q, pr, rm); lst.appendChild(r);
      });
      var tot = a.reduce(function(sum, x0){ var f = null; try { f = C.snapshot(x0.key); } catch (e) {} var pr = f ? f.price : x0.price; return sum + (pr != null ? pr * (x0.qty || 1) : 0); }, 0), needInst = a.some(function(x){ return x.install; }), any = a.some(function(x){ return x.price == null; });
      sumEl.textContent = !a.length ? '—' : tot ? '≈ ' + uah(tot) + (any ? tx(' + за запитом', ' + on request') : '') : tx('За запитом', 'On request');
      if (inst && !inst.dataset.touched) inst.checked = needInst;
      $('#rqInstNote').textContent = inst && inst.checked ? tx('ціна після огляду', 'priced after the survey') : tx('доставка або самовивіз', 'delivery or pick-up');
    }
    if (inst) inst.addEventListener('change', function(){ inst.dataset.touched = '1'; draw(); });
    d.addEventListener('cart:change', draw, { signal: S.page.signal }); draw();

    /* on the platform the request goes to our backend and gets a number; the static copy keeps it in the browser */
    var API = window.Api && window.Api.mode === 'live' ? window.Api : null, me = null;
    if (API) { $('#rqNote').textContent = tx('Надсилаючи, ви погоджуєтесь на зв’язок щодо заявки.', 'By sending, you agree to be contacted about it.'); $('#rqOkEye').lastChild.textContent = tx('Заявку прийнято', 'Request received'); }
    S.whenAccount(function(u){
      me = u && !u.demo ? u : null;
      $('#rqGuest').hidden = !!me;   // «Увійти · Зареєструватися» right in the form — also on the static copy
      if (me) {
        $('#rqMe').hidden = false;
        var mt = $('#rqMeText'); mt.textContent = ''; mt.append(tx('Ви увійшли як ', 'Signed in as '), el('b', '', me.name || me.email), tx('. Заявка буде в кабінеті.', '. Track the request in your account.'));
        if (!$('#rqName').value) $('#rqName').value = me.name || '';
        if (!phoneEl.value) phoneEl.value = me.phoneText || '';
        if (!emailEl.value) emailEl.value = me.email || '';
        $('#rqContactHint').textContent = tx('Перевірте контакти.', 'Check your contact details.');
      }
    });
    function bad(on){ phoneEl.classList.toggle('is-bad', on); emailEl.classList.toggle('is-bad', on); }
    [phoneEl, emailEl].forEach(function(i){ i.addEventListener('input', function(){ bad(false); errEl.hidden = true; }); });
    form.addEventListener('submit', function(e){
      e.preventDefault(); errEl.hidden = true;
      var phone = phoneEl.value.trim(), email = emailEl.value.trim();
      if (!phone && !email && !me) { bad(true); errEl.hidden = false; errEl.textContent = tx('Вкажіть телефон або пошту.', 'Enter a phone or an e-mail.'); phoneEl.focus(); return; }
      if (email && !emailEl.checkValidity()) { emailEl.reportValidity(); return; }
      var lead = { at: Date.now(), items: C.load(), total: C.total(), install: !!(inst && inst.checked), who: $('#rqWho').value, region: reg ? reg.value : '', msg: $('#rqMsg').value, contact: { name: $('#rqName').value.trim(), phone: phone, email: email } };
      function done(r){
        store('bess-lead', lead); C.clear(); form.hidden = true; $('#rqItems').hidden = true; empty.hidden = true;
        if (r && r.number) $('#rqOkEye').lastChild.textContent = tx('Заявку ' + r.number + ' прийнято', 'Request ' + r.number + ' received');
        if (r && r.claim && window.Account) window.Account.claimToken(r.claim);
        $('#rqOkGuest').hidden = !(r && r.claim);
        if (r && r.claim) { var open = $('#rqOkOpen'); open.href = 'login.html?mode=signup&next=' + encodeURIComponent('account.html#orders'); open.querySelector('span').textContent = tx('Створити акаунт', 'Create an account'); }
        else if (r && r.id) $('#rqOkOpen').href = 'account.html?site=' + encodeURIComponent(r.site_id) + '#orders=' + encodeURIComponent(r.id);
        okEl.hidden = false; S.scrollToEl(okEl);
      }
      if (!API) { done(null); return; }
      var sb = form.querySelector('button[type=submit]'); sb.disabled = true;
      API.order({ items: lead.items.map(function(x){ return { key: x.key, qty: x.qty }; }), install: lead.install, who: lead.who, region: lead.region, msg: lead.msg, contact: lead.contact, survey: !!S.q.get('survey') })
        .then(function(r){ lead.number = r.number; done(r); }, function(er){ errEl.hidden = false; errEl.textContent = API.message(er); if (er.code === 'phone' || er.code === 'contact') bad(true); })
        .then(function(){ sb.disabled = false; });
    });
  }

})();
