/* =====================================================================
   The cabinet: login (a one-time code, or the demo account) and the
   owner's space — overview, equipment and its control, energy and money,
   purchases, settings. Every number comes from the API (api.js): our
   backend on the platform, the in-browser demo on the static copy.
   ===================================================================== */
(function(){
  'use strict';
  var S = window.Site, A = window.Api, F = window.FLEET, Ch = window.Charts, page = document.body.dataset.page;
  var d = document, $ = function(s, r){ return (r || d).querySelector(s); }, $$ = function(s, r){ return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  if (!A || !F) return;

  /* ---------------- formatting ---------------- */
  var nf = S.nf, PCT = tx(' %', '%');
  var MONTHS_EN = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function kwh(v){ return v == null ? '—' : nf(v, Math.abs(v) < 10 ? 2 : 1) + tx(' кВт·год', ' kWh'); }
  function kw(v){ var a = Math.abs(v || 0); return nf(a, a < 10 ? 1 : 0) + tx(' кВт', ' kW'); }
  /* sums: «12 400 ₴» / «₴12,400»; a price per kWh keeps two decimals: «4,32 ₴» / «₴4.32» */
  function uah(v, sign){ return S.uah(v, sign); }
  function price(v){ return v == null ? '—' : S.en ? (v < 0 ? '−' : '') + '₴' + nf(Math.abs(v), 2) : nf(v, 2) + ' ₴'; }
  function pct(v){ return nf(v * 100, v < .1 && v > 0 ? 1 : 0) + PCT; }
  function hours(h){ return nf(h, h % 1 && h < 10 ? 1 : 0) + tx(' год', ' h'); }
  function hm(t){ var L = F.local(t); return pad(L.h) + ':' + pad(L.m); }
  function dm(t){ var L = F.local(t); return pad(L.date) + '.' + pad(L.mon + 1); }
  function dmy(t){ var L = F.local(t); return pad(L.date) + '.' + pad(L.mon + 1) + '.' + L.y; }
  function when(t){ var now = Date.now(), dd = F.dayOf(t); if (dd === F.dayOf(now)) return tx('сьогодні о ', 'today at ') + hm(t); if (dd === F.addDays(F.dayOf(now), -1)) return tx('учора о ', 'yesterday at ') + hm(t); return dm(t) + tx(' о ', ' at ') + hm(t); }
  function ago(t){ if (!t) return '—'; var m = Math.round((Date.now() - t) / 60000); return m < 1 ? tx('щойно', 'just now') : m < 60 ? m + tx(' хв тому', ' min ago') : when(t); }
  function el(tag, cls, text){ var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(text, cls){ var b = el('button', 'btn ' + (cls || 'btn--volt btn--sm')); b.type = 'button'; b.appendChild(el('span', '', text)); return b; }
  function link(text, href, cls){ var a = el('a', cls || 'link', text); a.href = href; return a; }
  function lab(t, ctl){ var w = el('label', 'ctl__f'); w.append(el('span', 'lbl', t), ctl); return w; }
  /* order lines are stored in Ukrainian (the team's language): the client sees them in the page's language,
     from the catalogue when the model is known */
  var P0 = window.PRODUCTS;
  function itemName(it){
    var p = it.product_id && P0 && P0.byId(it.product_id);
    if (p) return it.variant && p.variants ? p.name.replace(/\d+(–\d+)? (кВт(·год)?|kWh?)/, String(it.variant).replace(/K-3PH$/, '') + tx(' кВт', ' kW')) : p.name;
    if (it.kind === 'install' && it.name === 'Монтаж і пусконалагодження') return tx(it.name, 'Installation and commissioning');
    return it.name;
  }
  function itemSub(it){ if (it.sub === 'вартість — після огляду') return it.price_uah != null ? '' : tx(it.sub, 'priced after the survey'); return it.sub || ''; }
  function groupName(g){ return String(g || '').replace(/^Комплект «/, tx('Комплект «', 'Kit «')).replace(/^Система під ваші потреби$/, tx('Система під ваші потреби', 'A system for your needs')); }
  function panel(title, cls){ var p = el('section', 'panel box cab-p' + (cls ? ' ' + cls : '')); if (title) p.appendChild(el('h3', '', title)); return p; }
  function kv(rows){ var w = el('div', 'kv'); rows.forEach(function(r){ if (!r) return; var x = el('div'); x.append(el('span', '', r[0]), el('b', '', r[1])); w.appendChild(x); }); return w; }
  function photo(img, cls){ var f = el('figure', 'ph' + (cls ? ' ' + cls : '')); if (!img) { f.classList.add('ph--none'); f.appendChild(el('span', '', tx('Фото незабаром', 'Photo coming soon'))); return f; } f.style.background = img.bg; var i = d.createElement('img'); i.src = S.asset(img.src); i.alt = ''; i.loading = 'lazy'; i.decoding = 'async'; f.appendChild(i); return f; }
  var ICONS = { install: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8V20h3.2l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.4 2.4-2.4-.6-.6-2.4z"/>', delivery: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>', service: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>' };
  function icon(kind){ var f = el('span', 'it__ic'); f.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[kind] || ICONS.service) + '</svg>'; return f; }
  function store(k, v){ try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function err(box, e){ box.hidden = false; box.textContent = A.message(e); }
  /* tooltips of the mode buttons in the control panel */
  var MODE_HELP = {
    backup: tx('Тримає 100 %, віддає лише без мережі', 'Holds 100%, supplies only without the grid'),
    smart: tx('Заряд у дешеві години, віддача в дорогі; резерв не чіпає', 'Charges in cheap hours, supplies in expensive ones; keeps the reserve'),
    manual: tx('Ви задаєте години заряду й віддачі', 'You set the charge and supply hours')
  };
  var ROLE = { owner: tx('Власник', 'Owner'), manager: tx('Керує', 'Manager'), viewer: tx('Перегляд', 'Viewer'), staff: tx('Команда', 'Team') };
  var SEG = { flat: tx('Квартира', 'Flat'), home: tx('Дім', 'Home'), osbb: tx('ОСББ', 'Apartment building'), biz: tx('Бізнес', 'Business') };

  if (page === 'login') login();
  if (page === 'account') account();

  /* ================================================================
     Sign in, sign up, a forgotten password, Google — Firebase (fb.js);
     ?verified=1 is where Firebase's confirmation letter brings people back;
     then our session (POST /api/auth/firebase). Managers and admins land in
     their panel unless the page asked for another place.
     ================================================================ */
  function login(){
    var e1 = $('#loginErr'), note = $('#loginNote'), done = $('#doneBox'), FB = window.FB;
    var forms = { in: $('#inForm'), up: $('#upForm'), forgot: $('#forgotForm') };
    /* only our own pages: account.html?site=…#devices=… — never another host */
    var offline = false, asked = /^[a-z]+\.html(\?[\w=&%.-]*)?(#[\w=:%.-]*)?$/i.test(S.q.get('next') || '') ? S.q.get('next') : null, next = asked || 'account.html', cfg = {};
    var TITLES = {
      in: [tx('Вхід у кабінет', 'Sign in'), ''],
      up: [tx('Реєстрація', 'Sign up'), ''],
      forgot: [tx('Новий пароль', 'New password'), tx('Посилання прийде на пошту.', 'The link comes by e-mail.')]
    };
    function busy(form, on){ var b = form && form.querySelector('button[type=submit]'); if (b) { b.disabled = on; b.classList.toggle('is-busy', on); } }
    function go(user){ location.href = !asked && user && user.staff ? 'admin.html' : next; }
    function mode(m){
      Object.keys(forms).forEach(function(k){ forms[k].hidden = k !== m; });
      $('#authTabs').hidden = m === 'forgot';
      $$('#authTabs [role=tab]').forEach(function(t){ var on = t.dataset.mode === m; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; });
      $('#gBox').hidden = !(m === 'in' || m === 'up');
      $('#authT').textContent = TITLES[m][0]; $('#authLead').textContent = TITLES[m][1]; $('#authLead').hidden = !TITLES[m][1];
      e1.hidden = true; done.hidden = true;
      var f = forms[m].querySelector('input'); if (f && d.activeElement && d.activeElement.tagName !== 'BODY') f.focus();
    }
    function finish(text, acts){ Object.keys(forms).forEach(function(k){ forms[k].hidden = true; }); $('#authTabs').hidden = true; $('#gBox').hidden = true;
      done.hidden = false; $('#doneText').textContent = text; var w = $('#doneActs'); w.textContent = ''; (acts || []).forEach(function(a){ w.appendChild(a); }); }
    function fail(x){ if (x.code === 'cancelled') return; err(e1, x); if (x.code === 'verify_first') { var b = btn(tx('Надіслати лист ще раз', 'Send the e-mail again'), 'btn--ghost btn--sm'); b.addEventListener('click', function(){ b.disabled = true; FB.sendVerification(asked).then(function(r){ e1.textContent = tx('Надіслали лист на ', 'We sent an e-mail to ') + r.to + '.'; }, function(y){ err(e1, y); }); }); e1.appendChild(d.createTextNode(' ')); e1.appendChild(b); } }
    $$('#authTabs [role=tab]').forEach(function(t){ t.addEventListener('click', function(){ mode(t.dataset.mode); }); });
    $$('[data-go]').forEach(function(b){ b.addEventListener('click', function(){ if (b.dataset.go === 'forgot') $('#fgEmail').value = $('#inEmail').value; mode(b.dataset.go); }); });
    $$('[data-eye]').forEach(function(b){ b.addEventListener('click', function(){ var i = $('#' + b.dataset.eye), show = i.type === 'password'; i.type = show ? 'text' : 'password'; b.textContent = show ? tx('сховати', 'hide') : tx('показати', 'show'); }); });

    A.config().then(function(c){ cfg = c || {}; setup(); }, function(){ cfg = {}; setup(); });
    function setup(){
      $('#demoBox').hidden = !cfg.demo;
      if (cfg.static || !cfg.firebase || !FB) {
        /* no accounts here yet (the static copy, or Firebase not set up): the forms are shown as they will work,
           a submit says where sign-in works; the demo account stays as an option — one short line + the button */
        offline = true; $('#demoBox').hidden = false;
        $('#demoLine').textContent = cfg.static ? tx('Вхід ще не працює — є демо:', 'Sign-in is not live yet — try the demo:') : tx('Вхід налаштовується — є демо:', 'Sign-in is being set up — try the demo:');
        note.hidden = true;
        if (cfg.static && window.APP_URL) { note.hidden = false; note.appendChild(link(tx('Увійти на робочій адресі →', 'Sign in on the working site →'), String(window.APP_URL).replace(/\/$/, '') + (S.en ? '/en' : '') + '/login.html')); }
        mode(S.q.get('mode') === 'signup' ? 'up' : 'in');
        A.me().then(function(r){ if (r && r.user) location.replace(next); }, function(){});
        return;
      }
      if (S.q.get('verified')) { afterLetter(); return; }
      mode(S.q.get('mode') === 'signup' ? 'up' : 'in');
      /* signed in already — straight on; or Firebase still knows this device: our session again, silently */
      A.me().then(function(r){ if (r && r.user) go(r.user); }, function(){
        FB.current().then(function(u){ if (!u) return; FB.refresh().then(function(r){ go(r.user); }, function(){}); }, function(){});
      });
    }
    /* back from the confirmation letter: Firebase knows it is confirmed, our server learns it */
    function afterLetter(){
      finish(tx('Перевіряємо підтвердження…', 'Checking the confirmation…'));
      FB.refresh().then(function(r){
        history.replaceState(null, '', location.pathname + (asked ? '?next=' + encodeURIComponent(asked) : ''));
        if (!r.verified) { finish(tx('Ще не підтверджено. Відкрийте посилання з останнього листа.', 'Not confirmed yet. Open the link in the latest e-mail.'), [link(tx('До кабінету', 'To the account'), 'account.html', 'btn btn--ghost btn--sm')]); return; }
        $('#authT').textContent = tx('Пошту підтверджено', 'E-mail confirmed'); $('#authLead').hidden = true;
        finish(tx('Кабінет і AI-агент відкриті.', 'The account and the AI agent are open.'), [link(tx('Далі', 'Continue'), !asked && r.user && r.user.staff ? 'admin.html' : next, 'btn btn--volt btn--sm'), link(tx('До AI-агента', 'To the AI agent'), 'assistant.html', 'btn btn--ghost btn--sm')]);
      }, function(x){
        /* confirmed on another device: sign in here and the session follows */
        history.replaceState(null, '', location.pathname + (asked ? '?next=' + encodeURIComponent(asked) : ''));
        mode('in');
        if (x.code === 'fb_signin') { $('#authT').textContent = tx('Пошту підтверджено', 'E-mail confirmed'); $('#authLead').textContent = tx('Увійдіть, щоб продовжити.', 'Sign in to continue.'); $('#authLead').hidden = false; }
        else fail(x);
      });
    }
    forms.in.addEventListener('submit', function(e){
      e.preventDefault(); if (!forms.in.reportValidity()) return; e1.hidden = true; if (offline) { err(e1, { code: 'static' }); return; } busy(forms.in, true);
      FB.signIn($('#inEmail').value.trim(), $('#inPass').value).then(function(r){ forms.in.classList.add('is-ok'); setTimeout(function(){ go(r.user); }, 200); }, fail).then(function(){ busy(forms.in, false); });
    });
    forms.up.addEventListener('submit', function(e){
      e.preventDefault(); if (!forms.up.reportValidity()) return; e1.hidden = true; if (offline) { err(e1, { code: 'static' }); return; } busy(forms.up, true);
      var email = $('#upEmail').value.trim();
      FB.signUp(email, $('#upPass').value, $('#upName').value.trim(), asked).then(function(r){
        finish(tx('Акаунт створено. Підтвердьте пошту — лист на ', 'Account created. Confirm your e-mail — the letter went to ') + email + '.', [(function(){ var b = btn(tx('Далі', 'Continue'), 'btn--volt btn--sm'); b.addEventListener('click', function(){ go(r.user); }); return b; })()]);
      }, function(x){ fail(x); if (x.code === 'exists') $('#inEmail').value = email; }).then(function(){ busy(forms.up, false); });
    });
    forms.forgot.addEventListener('submit', function(e){
      e.preventDefault(); if (!forms.forgot.reportValidity()) return; e1.hidden = true; if (offline) { err(e1, { code: 'static' }); return; } busy(forms.forgot, true);
      var email = $('#fgEmail').value.trim();
      FB.resetPassword(email).then(function(){ finish(tx('Якщо адреса ', 'If ') + email + tx(' зареєстрована — посилання вже у скриньці. Перевірте й «Спам».', ' is registered, the link is in your inbox. Check spam too.'), [btnBack()]); },
        function(x){ if (x.code === 'login_failed') { finish(tx('Якщо адреса ', 'If ') + email + tx(' зареєстрована — посилання вже у скриньці.', ' is registered, the link is in your inbox.'), [btnBack()]); return; } fail(x); }).then(function(){ busy(forms.forgot, false); });
    });
    $('#gBtn').addEventListener('click', function(e){ e.preventDefault(); e1.hidden = true; if (offline) { err(e1, { code: 'static' }); return; } FB.google().then(function(r){ go(r.user); }, fail); });
    function btnBack(){ var b = btn(tx('Назад до входу', 'Back to sign in'), 'btn--ghost btn--sm'); b.addEventListener('click', function(){ mode('in'); }); return b; }
    $('#demoBtn').addEventListener('click', function(){ var b = this; b.disabled = true; e1.hidden = true;
      A.demo().then(function(){ location.href = 'account.html'; }, function(x){ err(e1, x); b.disabled = false; }); });
  }

  /* ================================================================
     Account
     ================================================================ */
  function account(){
    var view = $('#cabView'), tabs = $$('#cabTabs [role=tab]'), me = null, sites = [], site = null, tab = 'overview', arg = '', poll = 0, chatPoll = 0, liveHook = null, seq = 0, warmed = false;
    /* this page's lifetime (core.js): moving to another page ends the polls and the listeners */
    var life = { signal: S.page.signal };
    S.page.leave(function(){ clearInterval(poll); clearInterval(chatPoll); liveHook = null; seq++; });
    A.me().then(function(r){ me = r.user; sites = r.sites || []; start(); }, function(e){
      if (e.code === 'unauthorized' || e.status === 401) location.replace('login.html?next=' + encodeURIComponent('account.html' + location.search + location.hash));
      else { view.textContent = ''; view.appendChild(empty(tx('Кабінет недоступний', 'The account is unavailable'), A.message(e))); }
    });

    function start(){
      $('#cabWho').textContent = me.name || me.email || me.phoneText || tx('Ви', 'You');
      $('#cabDemo').hidden = !me.demo;
      if (me.demo) $('#cabDemo').title = A.mode === 'demo' ? tx('Демо: дані змодельовані, зміни — лише у вашому браузері.', 'Demo: simulated data; changes stay in your browser.') : tx('Демо: дані змодельовані, акаунт зникне за кілька днів.', 'Demo: simulated data; the account is deleted in a few days.');
      if (me.staff) { var st = $('#cabStaff'); st.hidden = false; }
      $('#cabOut').addEventListener('click', function(){ signOut(false); });
      var sel = $('#cabSite'), want = S.q.get('site') || store('cab-site');
      /* the team opens a client's site from the team panel: it is not among their own */
      if (me.staff && want && !sites.some(function(s){ return s.id === want; })) {
        A.site(want).then(function(x){ sites.unshift({ id: x.id, name: x.name, segment: x.segment, address: x.address, role: 'staff' }); pick(); }, pick);
        return;
      }
      pick();
      function pick(){
        sites.forEach(function(s){ var o = el('option', '', s.name + (s.role === 'staff' ? tx(' · клієнт', ' · client') : '')); o.value = s.id; sel.appendChild(o); });
        site = sites.filter(function(s){ return s.id === want; })[0] || sites[0] || null;
        $('#cabSwitch').hidden = sites.length < 2;
        if (site) sel.value = site.id;
        sel.addEventListener('change', function(){ site = sites.filter(function(s){ return s.id === sel.value; })[0]; store('cab-site', site.id); head(); show(tab === 'devices' ? 'devices' : tab, ''); });
        tabs.forEach(function(t){ t.addEventListener('click', function(){ show(t.dataset.tab, ''); }); });
        d.addEventListener('keydown', function(e){ if (!e.target.closest || !e.target.closest('#cabTabs')) return; var i = tabs.indexOf(e.target); if (i < 0) return;
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); var j = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length; tabs[j].focus(); show(tabs[j].dataset.tab, ''); } }, life);
        window.addEventListener('hashchange', route, life);
        d.addEventListener('visibilitychange', function(){ if (d.visibilityState === 'visible' && liveHook) tick(); }, life);
        /* the server's data changed in the background (api.js keeps answers for the tab): redraw the open
           tab in place — unless the owner is typing or editing there */
        d.addEventListener('api:fresh', function(e){
          var p = e.detail && e.detail.path || '';
          if (!site || editing()) return;
          if (p.indexOf('/sites/' + site.id) === 0 || p.indexOf('/devices/') === 0 || p === '/orders' || (tab === 'settings' && p === '/me')) show(tab, arg, true, true);
        }, life);
        d.addEventListener('api:signedout', function(){ location.replace('login.html?next=' + encodeURIComponent('account.html' + location.search + location.hash)); }, life);
        head();
        if (!site) { noSites(); if (/^#settings/.test(location.hash)) show('settings', '', true); return; }
        route();
      }
    }
    function head(){
      $('#cabSiteName').textContent = site ? site.name : tx('Кабінет', 'Account');
      $('#cabMeta').textContent = site ? [SEG[site.segment], site.address, ROLE[site.role]].filter(Boolean).join(' · ') : '';
    }
    function route(){ var h = location.hash.replace(/^#/, '').split('='); show(['overview', 'devices', 'energy', 'orders', 'settings'].indexOf(h[0]) >= 0 ? h[0] : 'overview', h[1] || '', true); }
    function show(t, a, fromHash, quiet){
      tab = t; arg = a || '';
      tabs.forEach(function(x){ var on = x.dataset.tab === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; });
      var h = '#' + t + (arg ? '=' + arg : '');
      if (!fromHash && location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
      clearInterval(poll); clearInterval(chatPoll); liveHook = null;
      if (!quiet) view.classList.add('is-loading');
      var my = ++seq, done = function(){ if (my === seq) { view.classList.remove('is-loading'); prefetch(); } };
      var fn = { overview: overview, devices: devices, energy: energy, orders: orders, settings: settings }[t];
      fn(my).then(done, function(e){ if (!e || typeof e.code !== 'string') console.error(e); if (my !== seq) return; done(); view.textContent = ''; view.appendChild(empty(tx('Не вдалося завантажити', 'Could not load'), A.message(e))); });
    }
    function mine(my){ return my === seq; }
    function editing(){ var a = d.activeElement; if (a && view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return true; return [].some.call(view.querySelectorAll('textarea'), function(x){ return x.value.trim(); }); }
    /* once the first tab is drawn, the others' data is asked in the background: they open at once */
    function prefetch(){
      if (warmed || !site) return; warmed = true;
      var id = site.id, later = window.requestIdleCallback || function(f){ return setTimeout(f, 300); }, no = function(){};
      later(function(){ A.overview(id).catch(no); A.energy(id, 'day', '').catch(no); A.economics(id).catch(no); A.site(id).catch(no); });
    }
    function startPoll(fn){ liveHook = fn; clearInterval(poll); poll = setInterval(tick, 10000); }
    function tick(){ if (!liveHook || d.visibilityState !== 'visible') return; var my = seq; A.live(site.id).then(function(lv){ if (my === seq && liveHook) liveHook(lv); }, function(){}); }
    function empty(t, s, acts){ var p = el('div', 'panel box cab-empty'); p.append(el('h3', '', t)); if (s) p.appendChild(el('p', 'hint', s)); if (acts) { var w = el('div', 'hero__cta'); acts.forEach(function(a){ w.appendChild(a); }); p.appendChild(w); } return p; }
    function noSites(){
      view.textContent = '';
      view.appendChild(empty(tx('Об’єктів ще немає', 'No sites yet'), tx('З’являться після монтажу.', 'They appear after installation.'), [link(tx('Обрати комплект', 'Choose a kit'), 'equipment.html?cat=kits', 'btn btn--volt btn--sm'), link(tx('Підібрати з AI-агентом', 'Plan with the AI agent'), 'assistant.html', 'btn btn--ghost btn--sm')]));
      tabs.forEach(function(x){ x.disabled = x.dataset.tab !== 'settings'; });
    }
    function put(nodes){ view.textContent = ''; nodes.forEach(function(n){ if (n) view.appendChild(n); }); if (window.ScrollTrigger) window.ScrollTrigger.refresh(); }

    /* ---------------- overview ---------------- */
    var NEXT = { new: tx('дзвінок і огляд', 'a call and a survey'), survey: tx('пропозиція з ціною', 'an offer with the price'), offer: tx('договір, потім оплата', 'contract, then payment'), contract: tx('оплата', 'payment'), paid: tx('поставка', 'delivery'), delivered: tx('монтаж', 'installation'), installed: tx('запуск', 'start-up') };
    function overview(my){
      return A.overview(site.id).then(function(v){
        if (!mine(my)) return;
        if (!v.systems || !v.systems.length) { put(beforeInstall(v)); return; }
        var top = el('div', 'cab-grid cab-grid--top'), mid = el('div', 'cab-grid cab-grid--mid'), low = el('div', 'cab-grid cab-grid--low');
        var lp = liveBox(v.live, v.systems), kp = kpiBox(v.kpi, v.today);
        top.append(lp.node, kp);
        mid.append(todayBox(v.today, v.systems), tradesBox(v.today));
        low.append(systemsBox(v.systems, v.live), eventsBox(v.events));
        put([v.orders && v.orders.length ? orderStrip(v.orders[0]) : null, top, mid, low]);
        startPoll(lp.update);
      });
    }
    /* before the equipment is installed: where the request is and what comes next — no empty energy panels */
    function beforeInstall(v){
      var o = v.orders && v.orders[0], out = [];
      if (o) {
        var p = panel(null, 'cab-pre'), h = el('div', 'cab-p__h');
        h.append(el('h3', '', tx('Заявка ', 'Request ') + o.number), el('span', 'badge', o.statusText), link(tx('Деталі й чат →', 'Details & chat →'), '#orders'));
        var i = F.FLOW.indexOf(o.status), bar = el('div', 'stepper');
        F.FLOW.forEach(function(s, k){ var x = el('div', k < i ? 'done' : k === i ? 'now' : ''); x.append(el('i'), el('span', '', F.STATUS[s] || s)); bar.appendChild(x); });
        p.append(h, bar);
        if (NEXT[o.status]) { var nx = el('p', 'cab-ord__next'); nx.append(el('span', '', tx('Далі', 'Next')), el('b', '', NEXT[o.status])); p.appendChild(nx); }
        out.push(p);
      }
      out.push(empty(tx('Техніка з’явиться після монтажу', 'Equipment appears after installation'), null, o ? [link(tx('Чат з менеджером', 'Chat with the manager'), '#orders', 'btn btn--volt btn--sm'), link(tx('Підібрати з AI-агентом', 'Plan with the AI agent'), 'assistant.html', 'btn btn--ghost btn--sm')] : [link(tx('Обрати комплект', 'Choose a kit'), 'equipment.html?cat=kits', 'btn btn--volt btn--sm'), link(tx('Підібрати з AI-агентом', 'Plan with the AI agent'), 'assistant.html', 'btn btn--ghost btn--sm')]));
      return out;
    }
    function orderStrip(o){
      var p = el('a', 'panel cab-strip'); p.href = '#orders';
      var i = F.FLOW.indexOf(o.status);
      p.append(el('span', 'badge', o.statusText), el('b', '', tx('Заявка ', 'Request ') + o.number), el('span', 'muted', (o.items || []).filter(function(x){ return x.kind === 'equipment'; }).map(function(x){ return (x.qty > 1 ? x.qty + ' × ' : '') + itemName(x); }).join(', ')));
      var bar = el('div', 'stepper stepper--mini'); F.FLOW.forEach(function(s, k){ var x = el('div', k < i ? 'done' : k === i ? 'now' : ''); x.appendChild(el('i')); bar.appendChild(x); });
      p.append(bar, el('span', 'link', tx('Деталі →', 'Details →')));
      return p;
    }

    /* live flow: grid · storage · site */
    function liveBox(lv, systems){
      var p = panel(null, 'cab-live'), hd = el('div', 'cab-live__h'), clock = el('span', 'mono muted'), chip = el('span', 'chipst');
      hd.append(el('h3', '', tx('Зараз', 'Now')), clock, chip); p.appendChild(hd);
      var NS = 'http://www.w3.org/2000/svg', svg = d.createElementNS(NS, 'svg');
      svg.setAttribute('viewBox', '0 0 640 170'); svg.setAttribute('class', 'flow'); svg.setAttribute('role', 'img');
      svg.innerHTML = '<path class="flow__e" id="fGS" d="M112 58 Q320 -6 528 58"/><path class="flow__e" id="fGB" d="M120 96 L262 112"/><path class="flow__e" id="fBS" d="M378 112 L520 96"/>' +
        '<path class="flow__f" data-f="gs" d="M112 58 Q320 -6 528 58"/><path class="flow__f" data-f="gb" d="M120 96 L262 112"/><path class="flow__f" data-f="bs" d="M378 112 L520 96"/>' +
        '<g class="flow__n" data-n="grid"><circle cx="76" cy="84" r="36"/><path d="M68 64l-8 22h10l-5 18 16-24H70l6-16z" class="flow__ic"/></g>' +
        '<g class="flow__n" data-n="site"><circle cx="564" cy="84" r="36"/><path d="M547 92v-15l17-13 17 13v15z M558 92v-9h12v9" class="flow__ic flow__ic--o"/></g>' +
        '<g class="flow__bat"><rect x="282" y="56" width="76" height="106" rx="20" class="flow__cap"/><rect x="306" y="48" width="28" height="10" rx="4" class="flow__tip"/>' +
        '<clipPath id="fClip"><rect x="286" y="60" width="68" height="98" rx="16"/></clipPath><rect class="flow__lvl" clip-path="url(#fClip)" x="286" y="60" width="68" height="98"/>' +
        '<text class="flow__soc" x="320" y="118" text-anchor="middle"></text></g>';
      p.appendChild(svg);
      var nums = el('div', 'cab-live__nums'), nG = num(tx('Мережа', 'Grid')), nB = num(tx('Накопичувач', 'Storage'), true), nS = num(tx('Об’єкт', 'Site'));
      nums.append(nG.n, nB.n, nS.n); p.appendChild(nums);
      /* footer: the mode and the backup time as two pills, then the link */
      var foot = el('div', 'cab-live__f'), mode = el('span', 'cab-pill'), eta = el('span', 'cab-pill'), ctl = link(tx('Керувати →', 'Control →'), '#devices');
      eta.title = tx('Скільки протримається без мережі', 'How long it lasts without the grid');
      foot.append(mode, eta, ctl); p.appendChild(foot);
      function num(t, sub){ var n = el('div'), a = el('span', '', t), b = el('b'), c = el('small'); n.append(a, b); if (sub) n.appendChild(c); return { n: n, b: b, c: c }; }
      function set(f, on, w){ var x = svg.querySelector('[data-f="' + f + '"]'); x.classList.toggle('is-on', on); x.style.strokeWidth = on ? Math.max(3, Math.min(7, 3 + w)) : ''; }
      function update(l){
        if (!l) return;
        var dis = Math.max(0, -l.pBat), chg = Math.max(0, l.pBat), gs = Math.max(0, l.pLoad - dis), out = l.out;
        clock.textContent = hm(l.at || Date.now());
        chip.className = 'chipst ' + (out ? 'chipst--warn' : 'chipst--ok'); chip.textContent = out ? tx('Відключення', 'Outage') + (l.outage && l.outage.from ? tx(' · з ', ' · since ') + hm(l.outage.from) : '') : tx('Мережа є', 'Grid on');
        set('gs', !out && gs > .05, gs / 4); set('gb', !out && chg > .05, chg / 4); set('bs', dis > .05, dis / 4);
        svg.querySelector('[data-n="grid"]').classList.toggle('is-off', !!out);
        var soc = l.soc != null ? l.soc : 0, lvl = svg.querySelector('.flow__lvl'); lvl.setAttribute('y', 60 + 98 * (1 - soc)); lvl.setAttribute('height', 98 * soc);
        svg.querySelector('.flow__soc').textContent = l.soc != null ? nf(soc * 100) + PCT : '—';
        svg.classList.toggle('is-low', soc < .2);
        nG.b.textContent = out ? tx('немає', 'off') : kw(l.pGrid); nG.n.classList.toggle('is-off', !!out);
        nB.b.textContent = l.soc != null ? nf(soc * 100) + PCT : '—'; nB.c.textContent = dis > .05 ? tx('віддає ', 'supplying ') + kw(dis) : chg > .05 ? tx('заряд ', 'charging ') + kw(chg) : tx('чекає', 'idle');
        nB.c.className = dis > .05 ? 'is-dis' : chg > .05 ? 'is-chg' : '';
        nS.b.textContent = kw(l.pLoad);
        var s0 = l.systems && l.systems[0];
        mode.textContent = '';
        if (s0 && s0.boost) mode.append(el('b', '', tx('Повний заряд', 'Full charge')), el('span', 'muted', tx('до ', 'until ') + hm(s0.boost.until)));
        else if (s0) { mode.appendChild(el('b', '', F.MODES[s0.mode] || s0.mode)); if (s0.mode !== 'backup') mode.appendChild(el('span', 'muted', tx('резерв ' + s0.reserve + ' %', s0.reserve + '% reserve'))); }
        mode.hidden = !s0;
        eta.textContent = l.eta != null ? (out ? tx('ще ≈ ', '≈ ') + hours(Math.max(.1, Math.round(l.eta * 2) / 2)) + tx('', ' left') : '≈ ' + hours(Math.max(.1, Math.round(l.eta * 2) / 2)) + tx(' автономно', ' on battery')) : '';
        eta.hidden = l.eta == null; eta.classList.toggle('is-warn', !!out);
        svg.setAttribute('aria-label', tx('Зараз: мережа ', 'Now: grid ') + nG.b.textContent + tx('; накопичувач ', '; storage ') + nB.b.textContent + ', ' + nB.c.textContent + tx('; об’єкт ', '; site ') + nS.b.textContent);
      }
      update(lv);
      if (systems && systems.length === 1) ctl.href = '#devices=' + systems[0].id;
      return { node: p, update: update };
    }

    function tile(label, value, sub, cls){ var t = el('div', 'tile' + (cls ? ' ' + cls : '')); t.append(el('span', '', label), el('b', '', value)); if (sub) t.appendChild(el('small', '', sub)); return t; }
    /* the payback forecast in two or three words: «≈ 3,5 року» */
    function payShort(y){ return y == null ? '' : y <= 0 ? tx('окупився', 'paid back') : y > 30 ? tx('понад 30 років', 'over 30 years') : '≈ ' + S.years(y); }
    /* the colours of the hour cells, for their legend (the same as the charts and the trade rows) */
    var HOURK = { buy: [tx('купили', 'bought'), Ch.C.chg], sell: [tx('віддали', 'supplied'), Ch.C.dis], out: [tx('відключення', 'outage'), Ch.C.neg],
      pbuy: [tx('план', 'plan'), 'repeating-linear-gradient(135deg,rgba(147,160,154,.8) 0 2px,transparent 2px 4px)'] };
    /* four tiles: a label and one number each; today carries its 24 hours as cells, the plan ahead hatched */
    function kpiBox(k, today){
      var p = panel(null, 'cab-kpi'), g = el('div', 'tiles tiles--kpi');
      var td = k.today, mo = k.month, tot = k.total, mon = F.local(Date.now()).mon;
      var MONN = tx(['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'], MONTHS_EN);
      var t1 = el('div', 'tile tile--day' + (td && td.profit < -.5 ? ' tile--neg' : '')), th = el('div', 'tile__h');
      th.appendChild(el('span', '', tx('Сьогодні', 'Today'))); t1.append(th, el('b', '', td ? uah(td.profit, true) : '—'));
      if (td && today && today.series) {
        var hs = el('div'); t1.appendChild(hs);
        requestAnimationFrame(function(){
          var kinds = Ch.day(hs, today), lg = [];
          ['buy', 'sell', 'out'].forEach(function(x){ if (kinds.indexOf(x) >= 0) lg.push(HOURK[x]); });
          if (kinds.indexOf('pbuy') >= 0 || kinds.indexOf('psell') >= 0) lg.push(HOURK.pbuy);
          if (lg.length) th.appendChild(legend(lg));
        });
      }
      g.appendChild(t1);
      g.appendChild(tile(MONN[mon], mo ? uah(mo.profit, true) : '—', null, mo && mo.profit < -.5 ? 'tile--neg' : ''));
      g.appendChild(tile(tx('Від запуску', 'Since start-up'), tot ? uah(tot.profit, true) : '—', k.since ? tx('з ', 'since ') + dmy(k.since) : ''));
      var m = el('div', 'tile tile--meter'), share = k.share != null ? Math.max(0, k.share) : null;
      m.append(el('span', '', tx('Окуплено', 'Paid back')), el('b', '', k.invest && share != null ? pct(share) : '—'));
      if (k.invest) {
        var bar = el('div', 'meter'), fill = el('i'); fill.style.width = Math.min(100, (share || 0) * 100) + '%'; bar.appendChild(fill); m.appendChild(bar);
        bar.title = tx('Вкладено ', 'Invested ') + uah(k.invest) + (tot ? tx(' · повернулося ', ' · returned ') + uah(tot.profit) : '');
        var ps = payShort(k.years); if (ps) m.appendChild(el('small', '', ps));
      } else m.appendChild(el('small', '', tx('після оплати', 'after payment')));
      g.appendChild(m);
      p.appendChild(g);
      return p;
    }
    function legend(items){ var l = el('div', 'clegend'); items.forEach(function(x){ var i = el('span'), k = el('i', x[2] ? 'ln' : ''); k.style.background = x[1]; i.append(k, d.createTextNode(x[0])); l.appendChild(i); }); return l; }
    /* the tariff as small badges; the details sit in their tooltips */
    function tariffTags(v, full){
      var tf = v.tariff || {}, dam = tf.kind === 'dam', out = [], b = el('span', 'badge', dam ? F.TARIFFS.dam : F.tariffText(tf));
      b.title = F.tariffText(tf); out.push(b);
      if (full) out.push(el('span', 'badge', dam ? tx('без розподілу й ПДВ', 'excl. distribution & VAT') : tx('з ПДВ', 'incl. VAT')));
      if (v.est) { var e = el('span', 'badge badge--est', tx('≈ оцінка', '≈ estimate')); e.title = tx('Для частини годин точних цін немає', 'Some hours have no exact prices'); out.push(e); }
      return out;
    }
    function energyLegend(v){
      var lg = [[tx('купили', 'bought'), Ch.C.chg], [tx('віддали', 'supplied'), Ch.C.dis]];
      if ((v.series || []).some(function(b){ return b.out >= .5; })) lg.push([tx('відключення', 'outage'), 'rgba(231,180,92,.45)']);
      /* the plan ahead of «now» (the dimmed price line and tinted hours in the chart) */
      if (v.plan && v.now < v.to) lg.push([tx('план', 'plan'), Ch.C.plan]);
      return legend(lg);
    }
    function todayBox(v, systems){
      var p = panel(null, 'cab-today'), h = el('div', 'cab-p__h');
      h.appendChild(el('h3', '', tx('Енергія сьогодні', 'Energy today')));
      tariffTags(v).forEach(function(x){ h.appendChild(x); });
      h.append(energyLegend(v), link(tx('Детально →', 'Details →'), '#energy'));
      p.appendChild(h);
      var host = el('div'); p.appendChild(host);
      var res = systems.length === 1 && systems[0].settings && systems[0].mode !== 'backup' ? systems[0].settings.reserve : null;
      requestAnimationFrame(function(){ Ch.strips(host, v, { compact: true, reserve: res }); });
      return p;
    }
    var KIND = { buy: [tx('Купили', 'Bought'), 'is-buy'], sell: [tx('Віддали', 'Supplied'), 'is-sell'], out: [tx('Відключення', 'Outage'), 'is-out'] };
    function blockRow(b){
      var li = el('li', 'trade ' + KIND[b.k][1]), t = el('div', 'trade__t');
      t.append(el('b', '', hm(b.from) + '–' + hm(b.to)), el('span', '', KIND[b.k][0]));
      var m = el('div', 'trade__m');
      if (b.k === 'out') { m.append(el('span', '', kwh(b.kwh)), el('b', '', b.uns > .05 ? tx('не вистачило ', 'short by ') + kwh(b.uns) : tx('без перерви', 'uninterrupted'))); }
      else { m.append(el('span', '', kwh(b.kwh) + tx(' по ', ' at ') + price(b.avg)), el('b', '', uah(b.money, true))); }
      li.append(t, m); return li;
    }
    /* the runs of today's plan still ahead: [{ a: 'c' | 'd', from, to }] (hours) */
    function planLeft(pl, now){
      if (!pl) return [];
      var h0 = F.local(now).h + 1, out = [], cur = null;
      for (var h = h0; h < 24; h++) { var a = pl.act[h]; if (cur && cur.a === a) { cur.to = h + 1; continue; } if (cur && cur.a) out.push(cur); cur = { a: a, from: h, to: h + 1 }; }
      if (cur && cur.a) out.push(cur);
      return out;
    }
    /* a planned run as a ghost row: the hours, buy or supply, the average price of those hours */
    function planRow(x, pl){
      var li = el('li', 'trade is-plan ' + (x.a === 'c' ? 'is-buy' : 'is-sell')), t = el('div', 'trade__t'), m = el('div', 'trade__m');
      var ps = pl.price.slice(x.from, x.to).filter(function(q){ return q != null; });
      t.append(el('b', '', pad(x.from) + ':00–' + pad(x.to) + ':00'), el('span', '', x.a === 'c' ? tx('Купівля', 'Buy') : tx('Віддача', 'Supply')));
      if (ps.length) m.appendChild(el('span', '', tx('по ≈ ', 'at ≈ ') + price(ps.reduce(function(s, q){ return s + q; }, 0) / ps.length)));
      li.append(t, m); return li;
    }
    function tradesBox(v){
      var p = panel(tx('Купівля і віддача', 'Bought & supplied'), 'cab-trades'), ul = el('ul', 'trades'), rows = v.rows || [];
      rows.forEach(function(b){ ul.appendChild(blockRow(b)); });
      if (!rows.length) ul.appendChild(el('li', 'hint', tx('Поки без купівлі й віддачі', 'Nothing bought or supplied yet')));
      p.appendChild(ul);
      if (rows.length) { var sum = el('div', 'trades__sum'); sum.append(el('span', '', tx('Разом', 'Total')), el('b', '', uah(v.totals.profit, true))); p.appendChild(sum); }
      var left = planLeft(v.plan, v.now);
      if (left.length) { var pu = el('ul', 'trades trades--plan'); pu.appendChild(el('li', 'trades__lbl', tx('План', 'Plan'))); left.forEach(function(x){ pu.appendChild(planRow(x, v.plan)); }); p.appendChild(pu); }
      p.appendChild(link(tx('Історія →', 'History →'), '#energy=month'));
      return p;
    }
    function socBar(soc){ var b = el('div', 'socbar'), i = el('i'); i.style.width = Math.round((soc || 0) * 100) + '%'; b.appendChild(i); return b; }
    function statusChip(card){ return el('span', 'chipst ' + (card.status === 'online' ? 'chipst--ok' : 'chipst--warn'), card.driver === 'sim' ? tx('Симуляція', 'Simulation') : card.status === 'online' ? tx('На зв’язку', 'Online') : tx('Немає зв’язку', 'Offline')); }
    function systemsBox(systems, lv){
      var p = panel(tx('Техніка', 'Equipment'), 'cab-sys');
      if (!systems.length) { p.appendChild(el('p', 'hint', tx('З’явиться після монтажу', 'Appears after installation'))); return p; }
      systems.forEach(function(s){
        var l = (lv.systems || []).filter(function(x){ return x.id === s.id; })[0], a = el('a', 'syscard'); a.href = '#devices=' + s.id;
        a.appendChild(photo(s.img, 'syscard__ph'));
        var b = el('div', 'syscard__b'); b.append(el('b', '', s.name), el('small', 'muted', s.model));
        if (s.comps && s.comps.length) b.appendChild(el('small', 'muted', '+ ' + s.comps.length + ' × ' + (s.comps[0].name || tx('батарея', 'battery'))));
        var row = el('div', 'syscard__r'); row.append(statusChip(s), el('span', 'mono', l && l.soc != null ? nf(l.soc * 100) + PCT : '—')); b.append(row, socBar(l && l.soc), el('small', '', s.modeText));
        a.appendChild(b); p.appendChild(a);
      });
      return p;
    }
    function eventRow(e){
      var li = el('li', 'ev ev--' + (e.kind === 'outage' ? (e.level === 'warn' ? 'warn' : 'out') : e.kind === 'command' ? 'cmd' : e.level || 'info')), t, s, tag = null;
      if (e.kind === 'outage') { var dur = (e.t_end || Date.now()) - e.t; t = e.t_end ? tx('Відключення · ', 'Outage · ') + hours(Math.round(dur / 1800000) / 2) : tx('Відключення триває', 'Outage in progress'); s = dm(e.t) + ' · ' + (e.t_end ? hm(e.t) + '–' + hm(e.t_end) : tx('з ', 'since ') + hm(e.t));
        tag = e.uns > .05 ? [tx('не вистачило ', 'short by ') + kwh(e.uns), 'is-warn'] : e.t_end ? [tx('без перерви', 'uninterrupted'), ''] : null;
        if (e.kwh != null) li.title = tx('Накопичувач віддав ', 'The storage supplied ') + kwh(e.kwh); }
      else if (e.kind === 'command') { var c = e.cmd; t = c.kind === 'boost' ? tx('Тримати повний заряд до ', 'Hold a full charge until ') + hm(c.payload.until) : c.kind === 'cancel' ? tx('Утримання заряду скасовано', 'Charge hold cancelled') : (c.note || tx('Нові налаштування', 'New settings')) + ': ' + F.modeText(c.payload); s = when(e.t) + (c.user_name ? ' · ' + c.user_name : '');
        if (c.status !== 'applied') tag = [c.status === 'failed' ? tx('не застосовано', 'not applied') : cmdStatus(c), c.status === 'failed' ? 'is-warn' : 'is-now', cmdStatus(c)]; }
      else { t = e.text || ({ offline: tx('Немає зв’язку з обладнанням', 'No connection to the equipment'), online: tx('Зв’язок відновлено', 'Connection restored'), alarm: tx('Тривога обладнання', 'Equipment alarm') }[e.kind] || tx('Подія', 'Event')); s = when(e.t); }
      var b = el('div', 'ev__b'); b.append(el('b', '', t), el('small', '', s)); li.appendChild(b);
      if (tag) { var g = el('span', 'ev__tag' + (tag[1] ? ' ' + tag[1] : ''), tag[0]); if (tag[2]) g.title = tag[2]; li.appendChild(g); }
      return li;
    }
    function eventsBox(list){
      var p = panel(tx('Події за 2 тижні', 'Events, last 2 weeks'), 'cab-ev'), ul = el('ul', 'evs');
      list.slice(0, 8).forEach(function(e){ ul.appendChild(eventRow(e)); });
      if (!list.length) ul.appendChild(el('li', 'hint', tx('Без відключень і змін', 'No outages or changes')));
      p.appendChild(ul);
      if (list.some(function(e){ return e.kind === 'outage' && e.uns > .05; })) { var h = el('p', 'cab-tip'); h.append(tx('Енергії не вистачило — ', 'Energy ran short — '), link(tx('підняти резерв →', 'raise the reserve →'), '#devices')); p.appendChild(h); }
      return p;
    }

    /* ---------------- equipment and control ---------------- */
    function devices(my){
      return A.overview(site.id).then(function(ov){
        if (!mine(my)) return;
        var systems = ov.systems;
        if (!systems.length) { put([empty(tx('Техніки ще немає', 'No equipment yet'), tx('З’явиться після монтажу.', 'It appears after installation.'), [link(tx('Покупки й чат', 'Purchases & chat'), '#orders', 'btn btn--ghost btn--sm')])]); return; }
        var id = systems.some(function(s){ return s.id === arg; }) ? arg : systems[0].id;
        return A.device(id).then(function(v){ if (mine(my)) drawDevice(v, systems, ov.live); });
      });
    }
    function drawDevice(v, systems, lv){
      var grid = el('div', 'cab-grid cab-grid--dev'), side = el('div', 'cab-col'), main = el('div', 'cab-col');
      if (systems.length > 1) { var lp = panel(tx('Системи', 'Systems')); systems.forEach(function(s){ var a = el('a', 'syspick' + (s.id === v.card.id ? ' is-on' : '')); a.href = '#devices=' + s.id; a.append(photo(s.img, 'syspick__ph'), el('b', '', s.name), el('small', 'muted', s.modeText)); lp.appendChild(a); }); side.appendChild(lp); }
      [cardBox(v), compsBox(v)].forEach(function(n){ if (n) side.appendChild(n); });
      [controlBox(v), boostBox(v), logBox(v)].forEach(function(n){ if (n) main.appendChild(n); });
      grid.append(main, side);
      put([grid]);
      startPoll(function(l){ var s = (l.systems || []).filter(function(x){ return x.id === v.card.id; })[0]; if (s && v.liveUpdate) v.liveUpdate(s); });
    }
    function cardBox(v){
      var c = v.card, p = panel(null, 'cab-dev');
      p.appendChild(photo(c.img, 'cab-dev__ph'));
      var b = el('div', 'cab-dev__b'); b.append(el('h2', 'h3', c.name), el('p', 'muted', c.model + (c.serial ? tx(' · № ', ' · S/N ') + c.serial : '')));
      var chips = el('div', 'chips'); chips.appendChild(statusChip(c)); if (v.firmware) chips.appendChild(el('span', 'chipst', tx('Прошивка ', 'Firmware ') + v.firmware)); b.appendChild(chips);
      p.appendChild(b);
      /* the charge: the number, a bar, and what is happening now as chips */
      var lvl = el('div', 'cab-dev__live'), top = el('div', 'cab-dev__lt'), at = el('small', 'mono'), big = el('b'), bar = socBar(0), now = el('div', 'chips cab-dev__now');
      top.append(el('span', '', tx('Заряд', 'Charge')), at);
      lvl.append(top, big, bar, now); p.appendChild(lvl);
      v.liveUpdate = function(l){ big.textContent = l.soc != null ? nf(l.soc * 100) + PCT : '—'; bar.firstChild.style.width = Math.round((l.soc || 0) * 100) + '%';
        at.textContent = ago(l.at); now.textContent = '';
        if (l.out) now.appendChild(el('span', 'chipst chipst--warn', tx('Немає мережі', 'No grid')));
        now.appendChild(l.pBat < -.05 ? el('span', 'chipst chipst--ok', tx('Віддає ', 'Supplying ') + kw(l.pBat)) : l.pBat > .05 ? el('span', 'chipst chipst--now', tx('Заряджається ', 'Charging ') + kw(l.pBat)) : el('span', 'chipst', tx('Чекає', 'Idle')));
        now.appendChild(el('span', 'chipst', tx('Об’єкт ', 'Site ') + kw(l.pLoad))); };
      if (v.live) v.liveUpdate(v.live);
      var pu = v.purchase, spec = el('div', 'cab-dev__spec');
      [[tx('Ємність', 'Capacity'), nf(c.kwh, c.kwh % 1 ? 2 : 0), tx('кВт·год', 'kWh')], [tx('Потужність', 'Power'), nf(c.kw, c.kw % 1 ? 1 : 0), tx('кВт', 'kW')], [tx('Цикли', 'Cycles'), v.cycles != null ? nf(v.cycles, 0) : '—', '']].forEach(function(x){
        var s = el('div'); s.append(el('span', '', x[0]), el('b', '', x[1])); if (x[2]) s.lastChild.appendChild(el('small', '', ' ' + x[2])); spec.appendChild(s); });
      p.appendChild(spec);
      p.appendChild(kv([
        [tx('Змонтовано', 'Installed'), c.installed_at ? dmy(c.installed_at) : '—'],
        pu ? [tx('Куплено', 'Bought'), dmy(pu.at)] : null,
        pu && pu.price != null ? [tx('Ціна', 'Price'), uah(pu.price)] : null,
        [tx('Гарантія', 'Warranty'), v.warranty_until ? tx('до ', 'until ') + dmy(v.warranty_until) : tx('від виробника', 'manufacturer’s')]
      ]));
      if (v.last30) p.appendChild(last30(v.last30));
      return p;
    }
    /* the last 30 days: the profit, and bought vs supplied as two bars */
    function last30(t){
      var w = el('div', 'cab-30'), hd = el('div', 'cab-30__h'), mx = Math.max(t.chg || 0, t.dis || 0) || 1;
      hd.append(el('span', '', tx('30 днів', '30 days')), el('b', t.profit < 0 ? 'neg' : '', uah(t.profit, true))); w.appendChild(hd);
      [[tx('Купили', 'Bought'), t.chg, 'is-c'], [tx('Віддали', 'Supplied'), t.dis, 'is-d']].forEach(function(x){
        var r = el('div', 'cab-30__r ' + x[2]), track = el('i'), fill = el('em'); fill.style.width = Math.max(2, (x[1] || 0) / mx * 100) + '%'; track.appendChild(fill);
        r.append(el('span', '', x[0]), track, el('b', 'mono', kwh(x[1] || 0))); w.appendChild(r); });
      return w;
    }
    function compsBox(v){
      if (!v.comps || !v.comps.length) return null;
      var p = panel(tx('Батарейні модулі', 'Battery modules'));
      v.comps.forEach(function(c){
        var r = el('div', 'comp comp--a'); r.appendChild(photo(c.img, 'comp__ph'));
        var b = el('div', 'comp__b'); b.append(el('b', '', c.name), el('small', 'muted', (c.model || '') + (c.serial ? tx(' · № ', ' · S/N ') + c.serial : '')));
        var row = el('div', 'comp__r');
        if (c.soc != null) row.append(socBar(c.soc), el('span', 'mono', nf(c.soc * 100) + PCT));
        if (c.temp != null) row.appendChild(el('span', 'mono', c.temp + ' °C'));
        if (row.childNodes.length) b.appendChild(row);
        if (c.warranty_until) b.appendChild(el('small', 'muted', tx('гарантія до ', 'warranty until ') + dmy(c.warranty_until)));
        var aside = el('div', 'comp__a');
        if (c.purchase) { if (c.purchase.price != null) aside.appendChild(el('b', 'mono', uah(c.purchase.price))); aside.appendChild(el('small', 'muted', dmy(c.purchase.at))); }
        r.append(b, aside); p.appendChild(r);
      });
      return p;
    }
    function seg(opts, val, onPick, cls){
      var s = el('div', 'seg ' + (cls || '')); s.setAttribute('role', 'group');
      opts.forEach(function(o){ var b = el('button'); b.type = 'button'; b.dataset.v = o[0]; b.setAttribute('aria-pressed', String(String(o[0]) === String(val))); b.textContent = o[1]; if (o[2]) b.appendChild(el('small', '', o[2]));
        b.addEventListener('click', function(){ $$('button', s).forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); }); onPick(o[0]); }); s.appendChild(b); });
      return s;
    }
    /* presets + own value, like every input of the calculator */
    function presets(list, val, unit, min, max, stepv, onSet){
      var w = el('div', 'pre'), chips = el('div', 'chips'), own = el('input', 'input input--sm'), match = false;
      own.type = 'number'; own.min = min; own.max = max; own.step = stepv; own.inputMode = 'decimal'; own.setAttribute('aria-label', tx('Своє значення, ', 'Custom value, ') + unit);
      list.forEach(function(x){ var c = el('button', 'chip', nf(x, x % 1 ? 1 : 0) + (unit === '%' ? PCT : ' ' + unit)); c.type = 'button'; var on = Math.abs(x - val) < 1e-9; match = match || on; c.setAttribute('aria-pressed', String(on));
        c.addEventListener('click', function(){ $$('.chip', chips).forEach(function(y){ y.setAttribute('aria-pressed', String(y === c)); }); own.value = ''; onSet(x); }); chips.appendChild(c); });
      if (!match) own.value = val;
      own.placeholder = tx('своє', 'custom');
      own.addEventListener('input', function(){ var x = +own.value; if (own.value === '' || !isFinite(x)) return; $$('.chip', chips).forEach(function(y){ y.setAttribute('aria-pressed', 'false'); }); onSet(x); });
      w.append(chips, own); return w;
    }
    function controlBox(v){
      var p = panel(null, 'cab-ctl'), can = v.site && v.site.can && v.site.can.control, lim = v.limits, cur = v.settings, draft = JSON.parse(JSON.stringify(cur));
      var h = el('div', 'cab-p__h'); h.append(el('h3', '', tx('Керування', 'Control')), el('span', 'chipst chipst--ok', tx('Зараз: ', 'Now: ') + (F.MODES[cur.mode] || cur.mode)));
      if (!can) { var ro = el('span', 'chipst', tx('Лише перегляд', 'View only')); ro.title = tx('Змінює власник або керуючий', 'The owner or a manager can change it'); h.appendChild(ro); }
      p.appendChild(h);
      var form = el('div', 'ctl'); p.appendChild(form);
      var modeSeg = seg([['backup', F.MODES.backup, tx('завжди 100 %', 'always 100%')], ['smart', F.MODES.smart, tx('за цінами', 'by price')], ['manual', F.MODES.manual, tx('свої години', 'your hours')]], draft.mode, function(m){ draft.mode = m; sync(); }, 'seg--mode');
      $$('button', modeSeg).forEach(function(b){ b.title = MODE_HELP[b.dataset.v] || ''; });
      form.appendChild(field(tx('Режим', 'Mode'), modeSeg));
      var resF = field(tx('Резерв на відключення', 'Outage reserve'), presets([20, 30, 50, 80, 100], draft.reserve, '%', 10, 100, 5, function(x){ draft.reserve = Math.round(x); sync(); }));
      var mx = lim.gridKw[1], gl = [mx * .25, mx * .5, mx * .75].map(function(x){ return Math.max(.5, Math.round(x * 2) / 2); }).concat([mx]).filter(function(x, i, a){ return a.indexOf(x) === i && x <= mx; });
      var gridF = field(tx('Заряд від мережі, макс.', 'Grid charging, max'), presets(gl, draft.gridKw, tx('кВт', 'kW'), .5, mx, .5, function(x){ draft.gridKw = Math.round(x * 10) / 10; sync(); }), tx('Не більше, ніж тримає ввідний автомат', 'Keep within your main breaker'));
      form.append(resF, gridF);
      var winF = el('div', 'ctl__win'); form.appendChild(winF);
      var prev = el('div', 'ctl__prev'); form.appendChild(prev);
      var foot = el('div', 'ctl__foot'), apply = btn(tx('Застосувати', 'Apply')), reset = btn(tx('Скинути', 'Reset'), 'btn--ghost btn--sm'), msg = el('p', 'hint', ''); msg.setAttribute('role', 'status');
      foot.append(apply, reset, msg); form.appendChild(foot);
      if (!can) $$('button, input, select', form).forEach(function(x){ x.disabled = true; });
      function changed(){ return JSON.stringify(F.normalize(draft, lim2()).value) !== JSON.stringify(F.normalize(cur, lim2()).value); }
      function lim2(){ return { maxChargeKw: lim.gridKw[1], kw: lim.kw, kwh: lim.kwh }; }
      function sync(){
        resF.classList.toggle('is-off', draft.mode === 'backup');
        winF.hidden = draft.mode !== 'manual'; if (draft.mode === 'manual') drawWindows();
        drawPreview();
        var n = F.normalize(draft, lim2());
        apply.disabled = !can || !changed() || !n.ok;
        msg.textContent = !n.ok ? n.errors.map(function(x){ return x.m; }).join(' ') : changed() ? tx('Не збережено', 'Not saved') : '';
      }
      function drawWindows(){
        winF.textContent = ''; winF.appendChild(el('span', 'lbl', tx('Вікна заряду й віддачі', 'Charge and discharge windows')));
        draft.windows.forEach(function(w, i){
          var r = el('div', 'win'), type = sel([['c', tx('Заряд', 'Charge')], ['d', tx('Віддача', 'Discharge')]], w.type), a = sel(hoursOpts(0, 23), w.from), b = sel(hoursOpts(1, 24), w.to), k = el('input', 'input input--sm');
          k.type = 'number'; k.min = .5; k.step = .5; k.max = w.type === 'c' ? lim.gridKw[1] : lim.kw; k.value = w.kw; k.setAttribute('aria-label', tx('Потужність, кВт', 'Power, kW'));
          var rm = el('button', 'rqi__rm', '×'); rm.type = 'button'; rm.setAttribute('aria-label', tx('Прибрати вікно', 'Remove the window'));
          type.addEventListener('change', function(){ w.type = type.value; w.kw = w.type === 'c' ? lim.gridKw[1] : lim.kw; sync(); });
          a.addEventListener('change', function(){ w.from = +a.value; sync(); }); b.addEventListener('change', function(){ w.to = +b.value; sync(); });
          k.addEventListener('input', function(){ w.kw = +k.value; sync(); }); rm.addEventListener('click', function(){ draft.windows.splice(i, 1); sync(); });
          r.append(type, el('span', 'muted', tx('з', 'from')), a, el('span', 'muted', tx('до', 'to')), b, k, el('span', 'muted', tx('кВт', 'kW')), rm); winF.appendChild(r);
        });
        if (draft.windows.length < 6) { var add = btn(tx('+ вікно', '+ window'), 'btn--ghost btn--sm'); add.addEventListener('click', function(){ var last = draft.windows[draft.windows.length - 1], f = last ? Math.min(23, last.to) : 11; draft.windows.push({ type: last && last.type === 'c' ? 'd' : 'c', from: f, to: Math.min(24, f + 3), kw: last && last.type === 'c' ? lim.kw : lim.gridKw[1] }); sync(); }); winF.appendChild(add); }
        if (!can) $$('button, input, select', winF).forEach(function(x){ x.disabled = true; });
      }
      /* the plan as 24 hour cells (charge / supply), a legend once, the expected gain per day */
      function planHead(title, extra){ var hd = el('div', 'ctl__ph'); hd.append(el('span', 'lbl', title), legend([[tx('купівля', 'buying'), Ch.C.chg], [tx('віддача', 'supply'), Ch.C.dis]])); if (extra) hd.appendChild(extra); return hd; }
      function drawPreview(){
        prev.textContent = '';
        if (draft.mode === 'backup') { prev.appendChild(el('span', 'chipst chipst--ok', tx('Тримає 100 % — план не потрібен', 'Holds 100% — no plan needed'))); return; }
        if (draft.mode === 'manual') { var pl = { day: F.dayOf(Date.now()), act: [], price: v.plans[0].price }; for (var h = 0; h < 24; h++) { var w = draft.windows.filter(function(x){ return h >= x.from && h < x.to; })[0]; pl.act.push(w ? w.type : ''); }
          prev.appendChild(planHead(tx('Ваш графік', 'Your schedule'))); var hst = el('div'); prev.appendChild(hst); Ch.plan(hst, pl, { now: Date.now() }); return; }
        var same = draft.reserve === cur.reserve && draft.gridKw === cur.gridKw && cur.mode === 'smart';
        prev.appendChild(planHead(tx('План', 'Plan'), same ? null : el('span', 'chipst chipst--warn', tx('оновиться після «Застосувати»', 'updates after «Apply»'))));
        v.plans.forEach(function(pl, i){
          var hd = el('div', 'ctl__pd'), g = el('b', 'mono', '≈ ' + uah(pl.gain, true));
          if (pl.est) g.title = tx('ціни частково — оцінка', 'some prices are estimates');
          hd.append(el('span', '', (i ? tx('Завтра ', 'Tomorrow ') : tx('Сьогодні ', 'Today ')) + dm(F.dayStart(pl.day) + 43200000)), g);
          prev.appendChild(hd); var hst = el('div'); prev.appendChild(hst); Ch.plan(hst, pl, { now: Date.now() });
        });
      }
      apply.addEventListener('click', function(){
        apply.disabled = true; msg.textContent = tx('Надсилаємо…', 'Sending…');
        A.command(v.card.id, { kind: 'settings', payload: F.normalize(draft, lim2()).value }).then(function(r){
          S.toast(r.command.status === 'applied' ? tx('Застосовано: ', 'Applied: ') + F.modeText(r.command.payload) : tx('Надіслано — застосується при зв’язку', 'Sent — applies on the next connection'));
          show('devices', v.card.id);
        }, function(e){ msg.textContent = A.message(e); apply.disabled = false; });
      });
      reset.addEventListener('click', function(){ show('devices', v.card.id); });
      sync();
      return p;
    }
    function field(label, ctl, hint){ var f = el('div', 'ctl__f'); f.appendChild(el('span', 'lbl', label)); f.appendChild(ctl); if (hint) f.appendChild(el('p', 'hint', hint)); return f; }
    function sel(opts, val){ var s = el('select', 'input input--sm'); opts.forEach(function(o){ var x = el('option', '', o[1]); x.value = o[0]; if (String(o[0]) === String(val)) x.selected = true; s.appendChild(x); }); return s; }
    function hoursOpts(a, b){ var o = []; for (var h = a; h <= b; h++) o.push([h, pad(h) + ':00']); return o; }
    function boostBox(v){
      var p = panel(null, 'cab-boost'), can = v.site && v.site.can && v.site.can.control, h = el('div', 'cab-p__h');
      h.append(el('h3', '', tx('Перед відключенням', 'Before an outage'))); p.appendChild(h);
      if (v.boost) {
        /* holding: «100 % until 18:00», what comes after, and Cancel */
        var on = el('div', 'cab-boost__on'), b0 = el('div');
        b0.append(el('span', 'chipst chipst--now', tx('Тримаємо 100 %', 'Holding 100%')), el('b', '', tx('до ', 'until ') + hm(v.boost.until) + (F.dayOf(v.boost.until) !== F.dayOf(Date.now()) ? ', ' + dm(v.boost.until) : '')), el('small', 'muted', tx('далі — ', 'then ') + F.MODES[v.settings.mode]));
        var c = btn(tx('Скасувати', 'Cancel'), 'btn--ghost btn--sm'); c.disabled = !can;
        c.addEventListener('click', function(){ c.disabled = true; A.command(v.card.id, { kind: 'cancel' }).then(function(){ S.toast(tx('Утримання заряду скасовано', 'Charge hold cancelled')); show('devices', v.card.id); }, function(e){ S.toast(A.message(e)); c.disabled = false; }); });
        on.append(b0, c); p.appendChild(on); return p;
      }
      var now = Date.now(), opts = [[2, tx('2 год', '2 h')], [4, tx('4 год', '4 h')], [8, tx('8 год', '8 h')]], untilH = 23, chips = el('div', 'chips'), pick = null;
      var t23 = F.dayStart(F.dayOf(now)) + untilH * F.HOUR; if (t23 - now > 3600000) opts.push(['eod', tx('до 23:00', 'until 23:00')]);
      opts.forEach(function(o){ var c2 = el('button', 'chip', o[1]); c2.type = 'button'; c2.setAttribute('aria-pressed', 'false'); c2.disabled = !can;
        c2.addEventListener('click', function(){ $$('.chip', chips).forEach(function(y){ y.setAttribute('aria-pressed', String(y === c2)); }); pick = o[0] === 'eod' ? t23 : now + o[0] * F.HOUR; go.disabled = false; }); chips.appendChild(c2); });
      var go = btn(tx('Зарядити й тримати', 'Charge and hold')); go.disabled = true;
      go.addEventListener('click', function(){ go.disabled = true; A.command(v.card.id, { kind: 'boost', payload: { until: Math.round(pick) } }).then(function(){ S.toast(tx('Заряджаємо до 100 % і тримаємо до ', 'Charging to 100% and holding until ') + hm(pick)); show('devices', v.card.id); }, function(e){ S.toast(A.message(e)); go.disabled = false; }); });
      var row = el('div', 'cab-boost__r'); row.append(el('span', 'lbl', tx('Тримати 100 %', 'Hold 100%')), chips, go); p.appendChild(row);
      return p;
    }
    function cmdStatus(c){ return { pending: tx('чекає', 'waiting'), sent: tx('надіслано', 'sent'), applied: tx('застосовано', 'applied'), failed: tx('не застосовано', 'not applied') + (c.error ? ': ' + c.error : '') }[c.status] || c.status; }
    /* a log line: the new mode in bold, the details as small tags */
    function cmdCell(c){
      var td = el('td', 'logc'), tags = el('div', 'tags'), p = c.payload || {}, pr = c.prev;
      function tag(t){ tags.appendChild(el('span', '', t)); }
      function modeOf(s){ return (F.MODES[s.mode] || s.mode || '—') + (s.mode !== 'backup' && s.reserve != null ? ' ' + s.reserve + PCT : ''); }
      if (c.kind === 'boost') { td.appendChild(el('b', '', tx('Тримати 100 %', 'Hold 100%'))); tag(tx('до ', 'until ') + hm(p.until)); }
      else if (c.kind === 'cancel') td.appendChild(el('b', '', tx('Утримання скасовано', 'Hold cancelled')));
      else {
        td.appendChild(el('b', '', modeOf(p)));
        if (c.note) tag(c.note);
        if (p.mode === 'manual' && p.windows) p.windows.forEach(function(w){ tag((w.type === 'c' ? tx('заряд ', 'charge ') : tx('віддача ', 'supply ')) + pad(w.from) + '–' + pad(w.to)); });
        if (pr && pr.gridKw !== p.gridKw) tag(tx('мережа ≤ ', 'grid ≤ ') + kw(p.gridKw));
        if (pr && pr.mode) tag(tx('було: ', 'was: ') + modeOf(pr));
      }
      if (tags.childNodes.length) td.appendChild(tags);
      return td;
    }
    function logBox(v){
      var p = panel(tx('Журнал керування', 'Control log'), 'cab-log');
      if (!v.commands.length) { p.appendChild(el('p', 'hint', tx('Змін ще не було.', 'No changes yet.'))); return p; }
      var t = el('table', 'tbl'), th = el('thead'), tr = el('tr');
      [tx('Коли', 'When'), tx('Хто', 'Who'), tx('Що', 'What'), tx('Стан', 'Status')].forEach(function(x){ tr.appendChild(el('th', '', x)); }); th.appendChild(tr); t.appendChild(th);
      var tb = el('tbody');
      v.commands.forEach(function(c){ var r = el('tr'); r.append(el('td', 'mono', (F.local(c.created_at).y === F.local(Date.now()).y ? dm : dmy)(c.created_at) + ' ' + hm(c.created_at)), el('td', '', c.user_name || '—'), cmdCell(c), el('td', 'st st--' + c.status, cmdStatus(c))); tb.appendChild(r); });
      t.appendChild(tb); var w = el('div', 'tblw'); w.appendChild(t); p.appendChild(w);
      return p;
    }

    /* ---------------- energy and money ---------------- */
    function energy(my){
      var a = arg.split(':'), range = F.RANGES[a[0]] ? a[0] : 'day', day = /^\d{4}-\d\d-\d\d$/.test(a[1] || '') ? a[1] : '';
      return A.energy(site.id, range, day).then(function(v){
        if (!mine(my)) return;
        var bar = el('div', 'panel cab-filter'), segs = seg(Object.keys(F.RANGES).map(function(k){ return [k, F.RANGES[k]]; }), v.range, function(r){ show('energy', r + ':' + v.day); }, 'seg--sm');
        var nav = el('div', 'cab-nav'), pv = el('button', 'cab-nav__b', '‹'), lab = el('b', '', v.label), nx = el('button', 'cab-nav__b', '›'), today = btn(tx('Сьогодні', 'Today'), 'btn--ghost btn--sm');
        pv.type = nx.type = 'button'; pv.setAttribute('aria-label', tx('Попередній період', 'Previous period')); nx.setAttribute('aria-label', tx('Наступний період', 'Next period'));
        pv.disabled = !v.prev; nx.disabled = !v.next;
        pv.addEventListener('click', function(){ show('energy', v.range + ':' + v.prev); }); nx.addEventListener('click', function(){ show('energy', v.range + ':' + v.next); });
        today.addEventListener('click', function(){ show('energy', v.range); }); today.hidden = v.range === 'all';
        nav.append(pv, lab, nx); if (v.range === 'all') { pv.hidden = nx.hidden = true; }
        bar.append(segs, nav, today);
        var t = v.totals, k = el('div', 'tiles tiles--5');
        /* five tiles: a label and one number; a price or a shortfall in two or three words at most */
        k.appendChild(tile(tx('Купили', 'Bought'), kwh(t.chg), t.chg && t.buyAvg != null ? tx('по ', 'at ') + price(t.buyAvg) : ''));
        k.appendChild(tile(tx('Віддали', 'Supplied'), kwh(t.dis), t.dis && t.sellAvg != null ? tx('по ', 'at ') + price(t.sellAvg) : ''));
        var pt = tile(tx('Прибуток', 'Profit'), uah(t.profit, true), null, t.profit < -.5 ? 'tile--neg' : 'tile--hero');
        if (t.base) pt.title = tx('Рахунок без накопичувача ', 'Bill without the storage ') + uah(t.base) + tx(', з ним ', ', with it ') + uah(t.bill);
        k.appendChild(pt);
        k.appendChild(tile(tx('Без мережі', 'Off-grid'), hours(t.outH), t.uns > .05 ? tx('не вистачило ', 'short by ') + kwh(t.uns) : '', t.uns > .05 ? 'tile--warn' : ''));
        k.appendChild(tile(tx('Повні цикли', 'Full cycles'), nf(t.cycles, t.cycles < 10 ? 1 : 0)));
        var cp = panel(null, 'cab-chart'), hd = el('div', 'cab-p__h'), host = el('div');
        if (v.size === 'q' || v.size === 'hour') hd.append(el('h3', '', v.size === 'q' ? tx('По 15 хвилин', '15-minute steps') : tx('По годинах', 'By the hour')), energyLegend(v));
        else hd.append(el('h3', '', v.size === 'day' ? tx('Прибуток по днях, ₴', 'Profit by day, ₴') : tx('Прибуток по місяцях, ₴', 'Profit by month, ₴')), legend([[tx('прибуток', 'profit'), Ch.C.dis], [tx('у мінусі', 'loss'), Ch.C.neg]]));
        cp.append(hd, host);
        /* a day: the chart and its list of runs side by side; longer periods: the chart over the table */
        if (v.size === 'q') { var two = el('div', 'cab-grid cab-grid--eday'); two.append(cp, tableBox(v)); put([bar, k, two]); }
        else put([bar, k, cp, tableBox(v)]);
        requestAnimationFrame(function(){
          if (v.size === 'q' || v.size === 'hour') Ch.strips(host, v, {});
          else Ch.bars(host, v.series.map(function(x){ x.short = v.size === 'day' ? x.key.slice(8) : x.label.slice(0, 3).toLowerCase(); return x; }), { onPick: function(x){ show('energy', v.size === 'day' ? 'day:' + x.key : 'month:' + x.key + '-01'); } });
        });
      });
    }
    /* an outage in the day table: «без перерви», or the shortfall as an amber «−X кВт·год» with the words in its tooltip */
    function outCell(b){
      if (!(b.uns > .05)) return el('td', 'n pos', tx('без перерви', 'uninterrupted'));
      var c = el('td', 'n neg', '−' + kwh(b.uns)); c.title = tx('Не вистачило ', 'Short by ') + kwh(b.uns); return c;
    }
    function tableBox(v){
      var p = panel(v.size === 'q' ? tx('Купівля і віддача', 'Bought & supplied') : v.size === 'month' ? tx('По місяцях', 'By month') : tx('По днях', 'By day'), 'cab-tbl'), t = el('table', 'tbl tbl--num'), th = el('thead'), tr = el('tr'), tb = el('tbody');
      var PROFIT = tx('Віддана об’єкту енергія мінус енергія на заряд, за цінами тих годин. Відключення не враховано — це резерв.', 'Energy supplied to the site minus the energy charged, at the prices of those hours. Outages are not counted — that is the backup.');
      if (v.size === 'q') {
        [[tx('Коли', 'When')], [tx('Що', 'What')], [tx('Енергія', 'Energy'), 'n'], [tx('Ціна', 'Price'), 'n'], [tx('Гроші', 'Money'), 'n', PROFIT]].forEach(function(x){ var c = el('th', x[1] || '', x[0]); if (x[2]) { c.title = x[2]; c.classList.add('has-tip'); } tr.appendChild(c); });
        v.rows.forEach(function(b){ var r = el('tr', 'is-' + b.k); r.append(el('td', 'mono', hm(b.from) + '–' + hm(b.to)), el('td', '', KIND[b.k][0]), el('td', 'n', kwh(b.kwh)), el('td', 'n', b.k === 'out' ? '—' : price(b.avg)),
          b.k === 'out' ? outCell(b) : el('td', 'n ' + (b.money < -.5 ? 'neg' : 'pos'), uah(b.money, true))); tb.appendChild(r); });
        if (!v.rows.length) { var r0 = el('tr'), c0 = el('td', 'hint', tx('Без купівлі й віддачі', 'Nothing bought or supplied')); c0.colSpan = 5; r0.appendChild(c0); tb.appendChild(r0); }
      } else {
        [tx('Період', 'Period'), tx('Купили', 'Bought'), tx('Ціна купівлі', 'Buy price'), tx('Віддали', 'Supplied'), tx('Ціна віддачі', 'Supply price'), tx('Прибуток', 'Profit'), tx('Без мережі', 'Off-grid')].forEach(function(x, i){ var c = el('th', i ? 'n' : '', x); if (i === 5) { c.title = PROFIT; c.classList.add('has-tip'); } tr.appendChild(c); });
        v.rows.forEach(function(x){ var r = el('tr', 'is-link'), go = v.size === 'month' ? 'month:' + x.key + '-01' : 'day:' + x.key;
          r.append(el('td', 'mono', x.label), el('td', 'n', kwh(x.chg)), el('td', 'n', price(x.buyAvg)), el('td', 'n', kwh(x.dis)), el('td', 'n', price(x.sellAvg)), el('td', 'n ' + (x.profit < -.5 ? 'neg' : 'pos'), uah(x.profit, true)), el('td', 'n', x.outH ? hours(x.outH) : '—'));
          r.tabIndex = 0; r.addEventListener('click', function(){ show('energy', go); }); r.addEventListener('keydown', function(e){ if (e.key === 'Enter') show('energy', go); }); tb.appendChild(r); });
      }
      th.appendChild(tr); t.append(th, tb); var w = el('div', 'tblw'); w.appendChild(t); p.appendChild(w);
      /* the tariff in badges under the table; the market data source stays as one short line */
      var ft = el('div', 'cab-tags'); tariffTags(v, true).forEach(function(x){ ft.appendChild(x); });
      if (v.tariff.kind === 'dam') ft.appendChild(el('span', 'muted', tx('Джерело: АТ «Оператор ринку»', 'Source: JSC «Market Operator»')));
      p.appendChild(ft);
      return p;
    }

    /* ---------------- purchases ---------------- */
    function orders(my){
      return A.economics(site.id).then(function(e){
        if (!mine(my)) return;
        var grid = el('div', 'cab-grid cab-grid--ord'), main = el('div', 'cab-col'), side = el('div', 'cab-col'), chats = [];
        side.appendChild(paybackBox(e));
        (e.orders || []).forEach(function(o){ var b = orderBox(o); main.appendChild(b.box); chats.push(b.chat); });
        if (!e.orders || !e.orders.length) main.appendChild(empty(tx('Покупок ще немає', 'No purchases yet'), null, [link(tx('Каталог', 'Catalogue'), 'equipment.html', 'btn btn--volt btn--sm'), link(tx('Підібрати з AI-агентом', 'Plan with the AI agent'), 'assistant.html', 'btn btn--ghost btn--sm')]));
        else { var more = el('div', 'hero__cta'); more.append(link(tx('Нова заявка', 'New request'), 'equipment.html', 'btn btn--ghost btn--sm'), link(tx('Підібрати з AI-агентом', 'Plan with the AI agent'), 'assistant.html', 'btn btn--ghost btn--sm')); main.appendChild(more); }
        grid.append(main, side); put([grid]);
        /* a request opened by its link (#orders=<id>) scrolls into view with its chat */
        if (arg) { var t = main.querySelector('[data-order="' + arg + '"]'); if (t) setTimeout(function(){ S.scrollToEl(t); }, 80); }
        chats.forEach(function(c){ c.load(); });
        clearInterval(chatPoll); chatPoll = setInterval(function(){ if (!mine(my)) { clearInterval(chatPoll); return; } if (d.visibilityState === 'visible') chats.forEach(function(c){ c.load(); }); }, 20000);
      });
    }
    function yrs(y){ return y == null ? '—' : y <= 0 ? tx('окупився', 'paid back') : y > 30 ? tx('30+ років', '30+ years') : '≈ ' + S.years(y); }
    /* returned of invested: the sum, a bar with % and days, then tiles — no prose */
    function paybackBox(e){
      var p = panel(tx('Окупність', 'Payback'), 'cab-pay');
      if (!e.invest) { p.appendChild(el('p', 'hint', tx('Після оплати замовлення.', 'Once the order is paid.'))); return p; }
      var t = e.totals || {}, share = Math.max(0, e.share || 0);
      var big = el('p', 'cab-pay__big'), inv = el('small', '', tx(' з ', ' of ') + uah(e.invest)); inv.title = tx('Вкладено: обладнання й монтаж', 'Invested: equipment and installation');
      big.append(uah(t.profit || 0), inv); p.appendChild(big);
      var bar = el('div', 'meter meter--lg'), f = el('i'); f.style.width = Math.min(100, share * 100) + '%'; bar.appendChild(f); p.appendChild(bar);
      var mr = el('div', 'cab-pay__m'); mr.append(el('b', 'mono', pct(share)), el('span', 'mono', tx('за ', '') + nf(e.days || 0) + ' ' + S.plural(e.days || 0, ['день', 'дні', 'днів'], ['day', 'days']) + tx('', ' in'))); p.appendChild(mr);
      var g = el('div', 'tiles');
      g.appendChild(tile(tx('Окупиться', 'Pays back'), yrs(e.years), e.years > 0 && e.years <= 30 && e.payDate ? monthYear(e.payDate) : ''));
      var pace = tile(tx('За день', 'Per day'), uah(e.pace, true), e.yearly != null ? uah(e.yearly, true) + tx(' / рік', ' / year') : ''); pace.title = tx('Середнє за 30 днів', 'Average of the last 30 days'); g.appendChild(pace);
      if (e.backup && e.backup.h) {
        g.appendChild(tile(tx('Резерв', 'Backup'), hours(e.backup.h), kwh(e.backup.kwh)));
        var wb = tile(tx('З резервом', 'With backup'), yrs(e.backup.years)); wb.title = tx('Окупність, якщо додати резерв як пальне генератора', 'Payback counting the backup as generator fuel'); g.appendChild(wb);
      }
      p.appendChild(g);
      if (e.months && e.months.length > 1) { p.appendChild(el('span', 'lbl', tx('Прибуток по місяцях', 'Profit by month'))); var host = el('div'); p.appendChild(host); requestAnimationFrame(function(){ Ch.bars(host, e.months.map(function(m){ m.short = m.label.slice(0, 3).toLowerCase(); return m; }), { height: 150 }); }); }
      return p;
    }
    function monthYear(t){ var L = F.local(t); return tx(['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'], MONTHS_EN)[L.mon] + ' ' + L.y; }
    function orderBox(o){
      var p = panel(null, 'cab-ord'), h = el('div', 'cab-p__h');
      p.setAttribute('data-order', o.id);
      h.append(el('h3', '', o.number), el('span', 'mono muted', dmy(o.created_at)), el('span', 'chipst ' + (o.status === 'done' ? 'chipst--ok' : o.status === 'cancelled' ? 'chipst--warn' : 'chipst--now'), o.statusText)); p.appendChild(h);
      /* one stepper for every order: each step with the date it was reached; the team's notes are listed under it */
      var log = o.log || [], at = {}; log.forEach(function(x){ at[x.status] = x.at; });
      var stop = o.status === 'cancelled', i = o.status === 'done' ? F.FLOW.length : F.FLOW.indexOf(o.status);
      if (stop) { i = 0; F.FLOW.forEach(function(s, k){ if (at[s] != null) i = k + 1; }); }
      var st = el('div', 'stepper');
      F.FLOW.forEach(function(s, k){ var x = el('div', k < i ? 'done' : k === i && !stop ? 'now' : ''); x.append(el('i'), el('span', '', F.STATUS[s])); if (k <= i && at[s] != null) x.appendChild(el('small', 'mono', dm(at[s]))); st.appendChild(x); });
      p.appendChild(st);
      if (NEXT[o.status]) { var nx = el('p', 'cab-ord__next'); nx.append(el('span', '', tx('Далі', 'Next')), el('b', '', NEXT[o.status])); p.appendChild(nx); }
      var notes = el('ul', 'cab-ord__notes'); log.forEach(function(x){ if (!x.note) return; var li = el('li'); li.append(el('span', '', (F.STATUS[x.status] || x.status) + ' · ' + dm(x.at)), el('p', '', x.note)); notes.appendChild(li); });
      if (notes.firstChild) p.appendChild(notes);
      var t = el('table', 'tbl tbl--ord'), tb = el('tbody'), grp = null;
      (o.items || []).forEach(function(it){
        if (it.grp && it.grp !== grp) { grp = it.grp; var gr = el('tr', 'grp'), gc = el('td', '', groupName(it.grp)); gc.colSpan = 4; gr.appendChild(gc); tb.appendChild(gr); }
        var r = el('tr'), c1 = el('td', 'it'); c1.appendChild(it.kind === 'equipment' || it.img ? photo(it.img, 'it__ph') : icon(it.kind)); var nm = el('div'); nm.append(el('b', '', itemName(it)), el('small', 'muted', itemSub(it))); c1.appendChild(nm);
        r.append(c1, el('td', 'mono', '× ' + it.qty), el('td', 'mono', it.price_uah != null ? uah(it.price_uah) : tx('за запитом', 'on request')), el('td', 'mono', it.price_uah != null ? uah(it.price_uah * it.qty) : '—')); tb.appendChild(r);
      });
      t.appendChild(tb); var w = el('div', 'tblw'); w.appendChild(t); p.appendChild(w);
      var sum = el('div', 'trades__sum'); sum.append(el('span', '', o.priced ? tx('Разом, з ПДВ', 'Total, incl. VAT') : tx('Разом, без «за запитом»', 'Total, excl. «on request»')), el('b', '', uah(o.total))); p.appendChild(sum);
      if (o.message) p.appendChild(el('p', 'hint', tx('Коментар: ', 'Comment: ') + o.message));
      var c = chatBox(o); p.appendChild(c.el);
      return { box: p, chat: c };
    }
    /* the chat with the team on this request: polled while «Покупки» is open */
    var SYS = { '@new': tx('Заявку прийнято. Менеджер напише тут або зателефонує.', 'Request received. A manager will write here or call.'),
      '@plan': tx('План від AI-агента отримано. Інженер перевірить і напише тут.', 'The AI agent’s plan is in. An engineer will check it and write here.') };
    function chatBox(o){
      var w = el('div', 'ochat'), hd = el('div', 'ochat__h'), list = el('div', 'ochat__list'), f = el('form', 'ochat__f'), ta = el('textarea', 'textarea'), go = btn(tx('Надіслати', 'Send')), last = 0, seen = {};
      var n = window.Account && window.Account.unread.orders[o.id] || 0, badge = el('span', 'badge badge--new', n ? tx('нових: ', 'new: ') + n : ''); badge.hidden = !n;
      hd.append(el('b', '', tx('Чат з менеджером', 'Chat with a manager')), badge);
      list.setAttribute('aria-live', 'polite'); list.setAttribute('data-lenis-prevent', '');
      ta.rows = 1; ta.maxLength = 2000; ta.placeholder = tx('Питання чи зручний час', 'A question or a good time'); ta.setAttribute('aria-label', tx('Повідомлення менеджеру', 'Message to a manager'));
      go.type = 'submit'; f.append(ta, go); w.append(hd, list, f);
      if (me.demo && A.mode === 'live') { f.hidden = true; w.appendChild(el('p', 'hint', tx('У демо чат вимкнено.', 'Chat is off in the demo.'))); }
      function bubble(m){
        if (seen[m.id]) return; seen[m.id] = 1; last = Math.max(last, m.id);
        var b = el('div', 'msg2 ' + (m.system ? 'msg2--sys' : m.mine ? 'msg2--me' : 'msg2--them'));
        if (!m.system && !m.mine) b.appendChild(el('small', 'msg2__who', m.author || tx('Менеджер', 'Manager')));
        b.appendChild(el('p', '', m.system ? (SYS[m.body] || m.body) : m.body));
        b.appendChild(el('small', 'msg2__t', when(m.at)));
        list.appendChild(b);
      }
      function load(){
        return A.messages(o.id, last || null).then(function(r){
          var fresh = (r.messages || []).filter(function(m){ return !seen[m.id]; });
          fresh.forEach(bubble);
          if (fresh.length) list.scrollTop = list.scrollHeight;
          badge.hidden = true;
          if (window.Account && window.Account.unread.orders[o.id]) { window.Account.unread.total -= window.Account.unread.orders[o.id]; delete window.Account.unread.orders[o.id]; d.dispatchEvent(new CustomEvent('account:unread', { detail: window.Account.unread })); }
        }, function(){});
      }
      ta.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); f.requestSubmit ? f.requestSubmit() : go.click(); } });
      ta.addEventListener('input', function(){ ta.style.height = 'auto'; ta.style.height = Math.min(140, ta.scrollHeight) + 'px'; });
      f.addEventListener('submit', function(e){ e.preventDefault(); var t = ta.value.trim(); if (!t) return; go.disabled = true;
        A.send(o.id, t).then(function(){ ta.value = ''; ta.style.height = ''; return load(); }, function(x){ S.toast(A.message(x)); }).then(function(){ go.disabled = false; }); });
      return { el: w, load: load };
    }


    /* ---------------- settings ---------------- */
    function settings(my){
      if (!site) { var g0 = el('div', 'cab-grid cab-grid--set'); g0.appendChild(profileBox()); put([g0]); return Promise.resolve(); }
      return A.site(site.id).then(function(s){
        if (!mine(my)) return;
        var grid = el('div', 'cab-grid cab-grid--set');
        grid.append(profileBox(), siteBox(s));
        if (s.can && s.can.own) grid.appendChild(accessBox(s));
        put([grid]);
      });
    }
    function profileBox(){
      var p = panel(tx('Профіль', 'Profile'), 'cab-set'), f = el('form', 'form'), name = el('input', 'input'), phone = el('input', 'input'), save = btn(tx('Зберегти', 'Save')), msg = el('p', 'hint');
      name.value = me.name || ''; name.maxLength = 80; name.autocomplete = 'name';
      phone.value = me.phoneText || ''; phone.type = 'tel'; phone.autocomplete = 'tel'; phone.placeholder = '+380'; save.type = 'submit';
      f.append(lab(tx('Ім’я', 'Name'), name), lab(tx('Телефон', 'Phone'), phone), save, msg); p.appendChild(f);
      if (me.demo) phone.disabled = true;
      f.addEventListener('submit', function(e){ e.preventDefault(); save.disabled = true; msg.textContent = '';
        var b = { name: name.value }; if (!me.demo) b.phone = phone.value;
        A.saveMe(b).then(function(r){ Object.assign(me, r.user); $('#cabWho').textContent = me.name || me.email || ''; phone.value = me.phoneText || phone.value; S.toast(tx('Збережено', 'Saved')); }, function(x){ msg.textContent = A.message(x); }).then(function(){ save.disabled = false; }); });
      if (!me.demo) { p.appendChild(emailBox()); p.appendChild(passwordBox()); }
      var out = btn(tx('Вийти на всіх пристроях', 'Sign out on all devices'), 'btn--ghost btn--sm'); out.addEventListener('click', function(){ signOut(true); });
      p.appendChild(out);
      return p;
    }
    /* the address: confirmed or not; a new one works after its own link */
    function signOut(all){
      (window.Account && window.Account.logout ? window.Account.logout(all) : A.logout(all)).then(go, go);
      function go(){ location.href = 'login.html'; }
    }
    /* the address and the password are Firebase's: these work where the account is signed in with Firebase */
    var FB = window.FB;
    function fbErr(box, x){ box.textContent = x.code === 'fb_signin' ? tx('Увійдіть ще раз на цьому пристрої — і повторіть.', 'Sign in again on this device and repeat.') : A.message(x); }
    function emailBox(){
      var w = el('div', 'contact'), head = el('div', 'contact__h'), st = el('span', 'chipst ' + (me.verified ? 'chipst--ok' : 'chipst--warn'), me.verified ? tx('підтверджено', 'confirmed') : tx('не підтверджено', 'not confirmed'));
      head.append(el('span', 'lbl', tx('Пошта', 'E-mail')), el('b', 'mono', me.email || '—'), st); if (me.google) head.appendChild(el('span', 'chipst chipst--ok', 'Google')); w.append(head);
      if (!me.verified && FB) {
        var m0 = el('p', 'hint', tx('Підтвердіть пошту — для AI-агента.', 'Confirm the e-mail to use the AI agent.'));
        var again = btn(tx('Надіслати лист ще раз', 'Send the e-mail again'), 'btn--ghost btn--sm'), done = btn(tx('Я вже підтвердив(ла)', 'I have confirmed it'), 'btn--ghost btn--sm'), row = el('div', 'hero__cta');
        again.addEventListener('click', function(){ again.disabled = true; FB.sendVerification('account.html#settings').then(function(r){ m0.textContent = tx('Надіслали на ', 'Sent to ') + r.to + '.'; }, function(x){ again.disabled = false; fbErr(m0, x); }); });
        done.addEventListener('click', function(){ done.disabled = true; FB.refresh().then(function(r){ if (r.verified) location.reload(); else { done.disabled = false; m0.textContent = tx('Ще не підтверджено — відкрийте посилання з листа.', 'Not confirmed yet — open the link in the e-mail.'); } }, function(x){ done.disabled = false; fbErr(m0, x); }); });
        row.append(again, done); w.append(m0, row);
      }
      if (me.password && FB) {
        var chg = btn(tx('Змінити пошту', 'Change the e-mail'), 'btn--ghost btn--sm'), box = el('div', 'contact__f'); box.hidden = true; w.append(chg, box);
        chg.addEventListener('click', function(){
          box.hidden = !box.hidden; if (box.hidden) return; box.textContent = '';
          var em = el('input', 'input input--sm'), pw = el('input', 'input input--sm'), go = btn(tx('Надіслати підтвердження', 'Send the confirmation')), m = el('p', 'hint');
          em.type = 'email'; em.placeholder = tx('нова пошта', 'new e-mail'); em.autocomplete = 'email'; pw.type = 'password'; pw.placeholder = tx('поточний пароль', 'current password'); pw.autocomplete = 'current-password';
          box.append(em, pw, go, m); em.focus();
          go.addEventListener('click', function(){ go.disabled = true; FB.changeEmail(pw.value, em.value.trim()).then(function(r){ m.textContent = tx('Посилання надіслано на ', 'Link sent to ') + r.to + tx('. Відкрийте його й увійдіть знову.', '. Open it, then sign in again.'); }, function(x){ fbErr(m, x); }).then(function(){ go.disabled = false; }); });
        });
      } else if (me.google) w.appendChild(el('p', 'hint', tx('Пошту Google змінюють у Google.', 'A Google e-mail is changed at Google.')));
      return w;
    }
    function passwordBox(){
      var w = el('div', 'contact'), head = el('div', 'contact__h'); w.appendChild(head);
      if (!me.password) { head.append(el('span', 'lbl', tx('Пароль', 'Password')), el('b', 'mono', tx('вхід через Google', 'Google sign-in'))); return w; }
      var b = btn(tx('Змінити пароль', 'Change the password'), 'btn--ghost btn--sm'), box = el('div', 'contact__f'); box.hidden = true;
      head.append(el('span', 'lbl', tx('Пароль', 'Password')), el('b', 'mono', '••••••••'), b); w.append(box);
      b.addEventListener('click', function(){
        box.hidden = !box.hidden; if (box.hidden) return; box.textContent = '';
        var cur = el('input', 'input input--sm'), nw = el('input', 'input input--sm'), go = btn(tx('Зберегти', 'Save')), m = el('p', 'hint');
        cur.type = nw.type = 'password'; cur.placeholder = tx('поточний пароль', 'current password'); cur.autocomplete = 'current-password'; nw.placeholder = tx('новий — від 8 символів', 'new — 8+ characters'); nw.autocomplete = 'new-password';
        box.append(cur, nw, go, m);
        go.addEventListener('click', function(){ if (nw.value.length < 8) { m.textContent = A.message({ code: 'password_short' }); return; } go.disabled = true;
          FB ? FB.changePassword(cur.value, nw.value).then(function(){ m.textContent = tx('Пароль збережено. На інших пристроях — вхід знову.', 'Password saved. Sign in again on other devices.'); }, function(x){ fbErr(m, x); }).then(function(){ go.disabled = false; }) : null; });
      });
      return w;
    }
    function siteBox(s){
      var p = panel(tx('Об’єкт і тариф', 'Site and tariff'), 'cab-set'), f = el('form', 'form'), can = s.can && s.can.control, tf = JSON.parse(JSON.stringify(s.tariff));
      var name = el('input', 'input'), addr = el('input', 'input'), base = el('input', 'input input--sm'), adder = el('input', 'input input--sm'), gen = el('input', 'input input--sm'), save = btn(tx('Зберегти', 'Save')), msg = el('p', 'hint');
      name.value = s.name; addr.value = s.address || ''; base.type = adder.type = gen.type = 'number'; base.step = adder.step = '0.01'; gen.step = '1';
      base.value = tf.base || F.HOME_BASE; adder.value = tf.adder || 0; gen.value = s.gen_cost || 25; save.type = 'submit';
      var kinds = seg(Object.keys(F.TARIFFS).map(function(k){ return [k, F.TARIFFS[k]]; }), tf.kind, function(k){ tf.kind = k; syncT(); }, 'seg--sm');
      var fb = lab(tx('Ціна кВт·год, ₴ з ПДВ', 'Price per kWh, ₴ incl. VAT'), base), fa = lab(tx('Розподіл і націнка, ₴/кВт·год', 'Distribution and margin, ₴/kWh'), adder), note = el('div', 'tfday');
      var fg = lab(tx('кВт·год генератора, ₴', 'Generator kWh, ₴'), gen); fg.title = tx('Для оцінки резерву', 'To value the backup');
      f.append(lab(tx('Назва', 'Name'), name), lab(tx('Адреса', 'Address'), addr), el('span', 'lbl', tx('Тариф', 'Tariff')), kinds, note, fb, fa, fg, save, msg);
      p.appendChild(f);
      function syncT(){ fb.hidden = tf.kind === 'dam'; fa.hidden = tf.kind !== 'dam'; tariffDay(note, tf.kind); }
      syncT();
      if (!can) $$('input, button', f).forEach(function(x){ x.disabled = true; });
      f.addEventListener('submit', function(e){ e.preventDefault(); save.disabled = true; msg.textContent = '';
        A.saveSite(s.id, { name: name.value, address: addr.value, tariff: { kind: tf.kind, base: +base.value, adder: +adder.value }, gen_cost: +gen.value }).then(function(r){
          site.name = r.name; sites.forEach(function(x){ if (x.id === r.id) x.name = r.name; }); $$('#cabSite option').forEach(function(o){ if (o.value === r.id) o.textContent = r.name; }); head(); S.toast(tx('Збережено, гроші перераховано', 'Saved, the money is recalculated'));
        }, function(x){ msg.textContent = A.message(x); }).then(function(){ save.disabled = false; }); });
      return p;
    }
    /* the tariff's 24 hours: cheap hours in the charge colour, the peak in the supply colour (fleet.js zoneMult) */
    function tariffDay(host, kind){
      host.textContent = '';
      if (kind === 'dam') { host.appendChild(el('p', 'hint', tx('Щогодини своя ціна ринку', 'A new market price every hour'))); return; }
      if (kind === 'fixed') { host.appendChild(el('p', 'hint', tx('Ціна однакова — радимо «Резерв»', 'One price all day — we suggest «Backup»'))); return; }
      var t = el('div', 'tou'), row = el('div', 'tou__row'), ax = el('div', 'tou__ax');
      for (var h = 0; h < 24; h++) { var m = F.zoneMult(kind, h), c = el('span', 'tou__h' + (m < 1 ? ' is-c' : m > 1 ? ' is-d' : '')); c.title = pad(h) + ':00 ×' + nf(m, m % 1 ? 1 : 0); row.appendChild(c); }
      [0, 6, 12, 18, 24].forEach(function(h){ ax.appendChild(el('span', '', pad(h) + ':00')); });
      t.append(row, ax); host.appendChild(t);
      host.appendChild(legend(kind === 'three' ? [[tx('ніч ×0,4', 'night ×0.4'), Ch.C.chg], [tx('пік ×1,5', 'peak ×1.5'), Ch.C.dis]] : [[tx('ніч ×0,5', 'night ×0.5'), Ch.C.chg], [tx('день ×1', 'day ×1'), 'var(--line)']]));
    }
    function accessBox(s){
      var p = panel(tx('Доступ до об’єкта', 'Access to the site'), 'cab-set'), ul = el('ul', 'list');
      (s.members || []).forEach(function(m){ var li = el('li'), a = el('div'); a.append(el('b', '', m.name || m.login || '—'), el('small', '', m.login || '')); li.append(a, el('span', 'badge', ROLE[m.role] || m.role)); ul.appendChild(li); });
      (s.invites || []).forEach(function(i){ var li = el('li'), a = el('div'), rm = el('button', 'rqi__rm', '×'); rm.type = 'button'; rm.setAttribute('aria-label', tx('Скасувати запрошення', 'Cancel the invitation'));
        a.append(el('b', '', i.login), el('small', '', tx('чекає підтвердження пошти', 'awaiting e-mail confirmation'))); rm.addEventListener('click', function(){ A.removeInvite(s.id, i.id).then(function(){ show('settings', ''); }, function(x){ S.toast(A.message(x)); }); });
        li.append(a, el('span', 'badge', ROLE[i.role] || i.role), rm); ul.appendChild(li); });
      p.appendChild(ul);
      var f = el('form', 'form invite'), login = el('input', 'input input--sm'), role = sel([['viewer', ROLE.viewer], ['manager', ROLE.manager], ['owner', ROLE.owner]], 'viewer'), go = btn(tx('Дати доступ', 'Give access')), msg = el('p', 'hint');
      login.placeholder = tx('пошта', 'e-mail'); login.type = 'email'; login.required = true; go.type = 'submit';
      f.append(el('span', 'lbl', tx('Додати людину', 'Add a person')), login, role, go, msg); p.appendChild(f);
      f.addEventListener('submit', function(e){ e.preventDefault(); A.invite(s.id, login.value, role.value).then(function(){ S.toast(tx('Доступ надано', 'Access given')); show('settings', ''); }, function(x){ msg.textContent = A.message(x); }); });
      /* what each role can do: a badge + two words */
      var rl = el('div', 'roles');
      [['viewer', tx('бачить усе', 'sees all')], ['manager', tx('+ режими', '+ modes')], ['owner', tx('+ доступ', '+ access')]].forEach(function(x){ var s0 = el('span'); s0.append(el('b', 'badge', ROLE[x[0]]), d.createTextNode(x[1])); rl.appendChild(s0); });
      p.appendChild(rl);
      return p;
    }
  }
})();
