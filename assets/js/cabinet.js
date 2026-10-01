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
  var nf = S.nf;
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function kwh(v){ return v == null ? '—' : nf(v, Math.abs(v) < 10 ? 2 : 1) + ' кВт·год'; }
  function kw(v){ var a = Math.abs(v || 0); return nf(a, a < 10 ? 1 : 0) + ' кВт'; }
  function uah(v, sign){ if (v == null) return '—'; var a = Math.abs(v), s = v < -.5 ? '−' : sign && v > .5 ? '+' : ''; return s + nf(Math.round(a)) + ' ₴'; }
  function price(v){ return v == null ? '—' : nf(v, 2) + ' ₴'; }
  function pct(v){ return nf(v * 100, v < .1 && v > 0 ? 1 : 0) + ' %'; }
  function hours(h){ return nf(h, h % 1 && h < 10 ? 1 : 0) + ' год'; }
  function hm(t){ var L = F.local(t); return pad(L.h) + ':' + pad(L.m); }
  function dm(t){ var L = F.local(t); return pad(L.date) + '.' + pad(L.mon + 1); }
  function dmy(t){ var L = F.local(t); return pad(L.date) + '.' + pad(L.mon + 1) + '.' + L.y; }
  function when(t){ var now = Date.now(), dd = F.dayOf(t); if (dd === F.dayOf(now)) return 'сьогодні о ' + hm(t); if (dd === F.addDays(F.dayOf(now), -1)) return 'учора о ' + hm(t); return dm(t) + ' о ' + hm(t); }
  function ago(t){ if (!t) return '—'; var m = Math.round((Date.now() - t) / 60000); return m < 1 ? 'щойно' : m < 60 ? m + ' хв тому' : when(t); }
  function payText(y, date){ if (y == null) return 'темп ще не визначився'; if (y <= 0) return 'вже окупився'; if (y > 30) return 'понад 30 років за самим тарифом'; return '≈ за ' + S.years(y) + (date ? ' (' + date + ')' : ''); }
  function el(tag, cls, text){ var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(text, cls){ var b = el('button', 'btn ' + (cls || 'btn--volt btn--sm')); b.type = 'button'; b.appendChild(el('span', '', text)); return b; }
  function link(text, href, cls){ var a = el('a', cls || 'link', text); a.href = href; return a; }
  function panel(title, cls){ var p = el('section', 'panel box cab-p' + (cls ? ' ' + cls : '')); if (title) p.appendChild(el('h3', '', title)); return p; }
  function kv(rows){ var w = el('div', 'kv'); rows.forEach(function(r){ if (!r) return; var x = el('div'); x.append(el('span', '', r[0]), el('b', '', r[1])); w.appendChild(x); }); return w; }
  function photo(img, cls){ var f = el('figure', 'ph' + (cls ? ' ' + cls : '')); if (!img) { f.classList.add('ph--none'); f.appendChild(el('span', '', 'Фото незабаром')); return f; } f.style.background = img.bg; var i = d.createElement('img'); i.src = img.src; i.alt = ''; i.loading = 'lazy'; i.decoding = 'async'; f.appendChild(i); return f; }
  var ICONS = { install: '<path d="M14.7 6.3a4 4 0 0 0-5.4 5.2L4 16.8V20h3.2l5.3-5.3a4 4 0 0 0 5.2-5.4l-2.4 2.4-2.4-.6-.6-2.4z"/>', delivery: '<path d="M3 7h11v9H3zM14 10h4l3 3v3h-7"/><circle cx="7" cy="17.5" r="1.6"/><circle cx="17" cy="17.5" r="1.6"/>', service: '<circle cx="12" cy="12" r="3"/><path d="M12 3v3M12 18v3M3 12h3M18 12h3M5.6 5.6l2.1 2.1M16.3 16.3l2.1 2.1M5.6 18.4l2.1-2.1M16.3 7.7l2.1-2.1"/>' };
  function icon(kind){ var f = el('span', 'it__ic'); f.innerHTML = '<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + (ICONS[kind] || ICONS.service) + '</svg>'; return f; }
  function store(k, v){ try { if (v === undefined) return localStorage.getItem(k); localStorage.setItem(k, v); } catch (e) { return null; } }
  function err(box, e){ box.hidden = false; box.textContent = A.message(e); }
  var MODE_HELP = {
    backup: 'Накопичувач завжди повний і віддає енергію лише тоді, коли зникає мережа. Найбільше годин резерву, але без економії на тарифі.',
    smart: 'Заряджається в дешеві години тарифу чи ринку й живить об’єкт у дорогі — щодня за новим планом. Резерв на випадок відключення не витрачає.',
    manual: 'Ви самі задаєте години заряду й віддачі. Між вікнами накопичувач чекає й тримає резерв.'
  };
  var ROLE = { owner: 'Власник', manager: 'Керує', viewer: 'Перегляд', staff: 'Команда' };
  var SEG = { flat: 'Квартира', home: 'Дім', osbb: 'ОСББ', biz: 'Бізнес' };

  if (page === 'login') login();
  if (page === 'account') account();

  /* ================================================================
     Login
     ================================================================ */
  function login(){
    var f1 = $('#loginForm'), f2 = $('#codeForm'), idEl = $('#loginId'), cells = $$('#codeForm .code input'), e1 = $('#loginErr'), info = $('#codeInfo'), note = $('#loginNote');
    /* only our own pages: account.html?site=…#devices=… — never another host */
    var next = /^[a-z]+\.html(\?[\w=&%.-]*)?(#[\w=:%.-]*)?$/i.test(S.q.get('next') || '') ? S.q.get('next') : 'account.html', who = '', timer = 0, cfg = {};
    A.me().then(function(){ location.replace(next); }, function(){});
    A.config().then(function(c){
      cfg = c || {};
      if (cfg.static) { note.textContent = 'Це статична копія сайту без сервера: тут відкривається демо-кабінет. '; if (window.APP_URL) note.appendChild(link('Увійти на робочій адресі →', String(window.APP_URL).replace(/\/$/, '') + '/login.html')); else note.appendChild(d.createTextNode('Вхід за кодом — на робочій адресі платформи.')); }
      else if (!cfg.email && !cfg.phone) note.textContent = 'Вхід за кодом запрацює, щойно підключимо SMS і пошту. Поки що — демо-кабінет.';
      else if (!cfg.phone) idEl.placeholder = 'name@company.ua';
      $('#demoBox').hidden = !cfg.demo;
    }, function(){ $('#demoBox').hidden = false; });
    function busy(form, on){ var b = form.querySelector('button[type=submit]'); if (b) { b.disabled = on; b.classList.toggle('is-busy', on); } }
    f1.addEventListener('submit', function(e){
      e.preventDefault(); if (!f1.reportValidity()) return; e1.hidden = true; who = idEl.value.trim(); busy(f1, true);
      A.start(who).then(function(r){
        f1.hidden = true; f2.hidden = false; $('#codeTo').textContent = r.to || who; cells.forEach(function(c){ c.value = ''; }); cells[0].focus();
        info.textContent = r.dev_code ? 'Режим розробки: код ' + r.dev_code + '.' : 'Код діє 10 хвилин.';
        resend(60);
      }, function(x){ err(e1, x); if (x.code === 'static') $('#demoBtn').focus(); }).then(function(){ busy(f1, false); });
    });
    function resend(s){ clearInterval(timer); var b = $('#codeAgain'); b.disabled = true; b.textContent = 'Надіслати ще раз через ' + s + ' с';
      timer = setInterval(function(){ s--; if (s <= 0) { clearInterval(timer); b.disabled = false; b.textContent = 'Надіслати код ще раз'; } else b.textContent = 'Надіслати ще раз через ' + s + ' с'; }, 1000); }
    $('#codeAgain').addEventListener('click', function(){ e1.hidden = true; A.start(who).then(function(r){ info.textContent = r.dev_code ? 'Режим розробки: код ' + r.dev_code + '.' : 'Надіслали новий код.'; resend(60); }, function(x){ err(e1, x); }); });
    cells.forEach(function(c, i){
      c.addEventListener('input', function(){ var v = c.value.replace(/\D/g, '');
        if (v.length > 1) { v.split('').slice(0, 6 - i).forEach(function(ch, k){ cells[i + k].value = ch; }); cells[Math.min(5, i + v.length - 1)].focus(); }
        else { c.value = v; if (v && cells[i + 1]) cells[i + 1].focus(); }
        if (cells.every(function(x){ return x.value; })) verify(); });
      c.addEventListener('keydown', function(e){ if (e.key === 'Backspace' && !c.value && cells[i - 1]) cells[i - 1].focus(); });
    });
    function verify(){
      var code = cells.map(function(x){ return x.value; }).join(''); if (code.length !== 6) return; e1.hidden = true; busy(f2, true);
      A.verify(who, code).then(function(){ f2.classList.add('is-ok'); setTimeout(function(){ location.href = next; }, 300); },
        function(x){ err(e1, x); if (x.code === 'code_wrong') { cells.forEach(function(c){ c.value = ''; }); cells[0].focus(); } if (x.code === 'code_expired' || x.code === 'code_attempts') $('#codeAgain').disabled = false; })
        .then(function(){ busy(f2, false); });
    }
    f2.addEventListener('submit', function(e){ e.preventDefault(); verify(); });
    $('#codeBack').addEventListener('click', function(){ f2.hidden = true; f1.hidden = false; e1.hidden = true; idEl.focus(); });
    $('#demoBtn').addEventListener('click', function(){ var b = this; b.disabled = true; e1.hidden = true;
      A.demo().then(function(){ location.href = 'account.html'; }, function(x){ err(e1, x); b.disabled = false; }); });
  }

  /* ================================================================
     Account
     ================================================================ */
  function account(){
    var view = $('#cabView'), tabs = $$('#cabTabs [role=tab]'), me = null, sites = [], site = null, tab = 'overview', arg = '', poll = 0, liveHook = null, seq = 0;
    A.me().then(function(r){ me = r.user; sites = r.sites || []; start(); }, function(e){
      if (e.code === 'unauthorized' || e.status === 401) location.replace('login.html?next=' + encodeURIComponent('account.html' + location.search + location.hash));
      else { view.textContent = ''; view.appendChild(empty('Кабінет недоступний', A.message(e))); }
    });

    function start(){
      $('#cabWho').textContent = me.name || me.phoneText || me.email || 'Ви';
      $('#cabDemo').hidden = !me.demo;
      if (me.demo) { var n = $('#cabNote'); n.hidden = false; n.textContent = A.mode === 'demo' ? 'Демо-кабінет: техніка й дані змодельовані, змінювати можна все — зміни лишаються у вашому браузері.' : 'Демо-кабінет: техніка й дані змодельовані. Змінюйте що завгодно — через кілька днів акаунт видалиться.'; }
      if (me.staff) { var st = $('#cabStaff'); st.hidden = false; }
      $('#cabOut').addEventListener('click', function(){ A.logout().then(go, go); function go(){ location.href = 'login.html'; } });
      var sel = $('#cabSite'), want = S.q.get('site') || store('cab-site');
      /* the team opens a client's site from the team panel: it is not among their own */
      if (me.staff && want && !sites.some(function(s){ return s.id === want; })) {
        A.site(want).then(function(x){ sites.unshift({ id: x.id, name: x.name, segment: x.segment, address: x.address, role: 'staff' }); pick(); }, pick);
        return;
      }
      pick();
      function pick(){
        sites.forEach(function(s){ var o = el('option', '', s.name + (s.role === 'staff' ? ' · клієнт' : '')); o.value = s.id; sel.appendChild(o); });
        site = sites.filter(function(s){ return s.id === want; })[0] || sites[0] || null;
        $('#cabSwitch').hidden = sites.length < 2;
        if (site) sel.value = site.id;
        sel.addEventListener('change', function(){ site = sites.filter(function(s){ return s.id === sel.value; })[0]; store('cab-site', site.id); head(); show(tab === 'devices' ? 'devices' : tab, ''); });
        tabs.forEach(function(t){ t.addEventListener('click', function(){ show(t.dataset.tab, ''); }); });
        d.addEventListener('keydown', function(e){ if (!e.target.closest || !e.target.closest('#cabTabs')) return; var i = tabs.indexOf(e.target); if (i < 0) return;
          if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') { e.preventDefault(); var j = (i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length; tabs[j].focus(); show(tabs[j].dataset.tab, ''); } });
        window.addEventListener('hashchange', route);
        d.addEventListener('visibilitychange', function(){ if (d.visibilityState === 'visible' && liveHook) tick(); });
        head();
        if (!site) { noSites(); if (/^#settings/.test(location.hash)) show('settings', '', true); return; }
        route();
      }
    }
    function head(){
      $('#cabSiteName').textContent = site ? site.name : 'Кабінет';
      $('#cabMeta').textContent = site ? [SEG[site.segment], site.address, ROLE[site.role]].filter(Boolean).join(' · ') : '';
    }
    function route(){ var h = location.hash.replace(/^#/, '').split('='); show(['overview', 'devices', 'energy', 'orders', 'settings'].indexOf(h[0]) >= 0 ? h[0] : 'overview', h[1] || '', true); }
    function show(t, a, fromHash){
      tab = t; arg = a || '';
      tabs.forEach(function(x){ var on = x.dataset.tab === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; });
      var h = '#' + t + (arg ? '=' + arg : '');
      if (!fromHash && location.hash !== h) history.replaceState(null, '', location.pathname + location.search + h);
      clearInterval(poll); liveHook = null;
      view.classList.add('is-loading');
      var my = ++seq, done = function(){ if (my === seq) view.classList.remove('is-loading'); };
      var fn = { overview: overview, devices: devices, energy: energy, orders: orders, settings: settings }[t];
      fn(my).then(done, function(e){ if (!e || typeof e.code !== 'string') console.error(e); if (my !== seq) return; done(); view.textContent = ''; view.appendChild(empty('Не вдалося завантажити', A.message(e))); });
    }
    function mine(my){ return my === seq; }
    function startPoll(fn){ liveHook = fn; clearInterval(poll); poll = setInterval(tick, 10000); }
    function tick(){ if (!liveHook || d.visibilityState !== 'visible') return; var my = seq; A.live(site.id).then(function(lv){ if (my === seq && liveHook) liveHook(lv); }, function(){}); }
    function empty(t, s, acts){ var p = el('div', 'panel box cab-empty'); p.append(el('h3', '', t)); if (s) p.appendChild(el('p', 'hint', s)); if (acts) { var w = el('div', 'hero__cta'); acts.forEach(function(a){ w.appendChild(a); }); p.appendChild(w); } return p; }
    function noSites(){
      view.textContent = '';
      view.appendChild(empty('Тут з’являться ваші об’єкти й техніка', 'Після заявки й монтажу тут буде видно обладнання, керування ним, енергію, гроші й покупки.', [link('Обрати комплект', 'equipment.html?cat=kits', 'btn btn--volt btn--sm'), link('Підібрати з AI-агентом', 'assistant.html', 'btn btn--ghost btn--sm')]));
      tabs.forEach(function(x){ x.disabled = x.dataset.tab !== 'settings'; });
    }
    function put(nodes){ view.textContent = ''; nodes.forEach(function(n){ if (n) view.appendChild(n); }); if (window.ScrollTrigger) window.ScrollTrigger.refresh(); }

    /* ---------------- overview ---------------- */
    function overview(my){
      return A.overview(site.id).then(function(v){
        if (!mine(my)) return;
        var top = el('div', 'cab-grid cab-grid--top'), mid = el('div', 'cab-grid cab-grid--mid'), low = el('div', 'cab-grid cab-grid--low');
        var lp = liveBox(v.live, v.systems), kp = kpiBox(v.kpi, v.today);
        top.append(lp.node, kp);
        mid.append(todayBox(v.today, v.systems), tradesBox(v.today));
        low.append(systemsBox(v.systems, v.live), eventsBox(v.events));
        put([v.orders && v.orders.length ? orderStrip(v.orders[0]) : null, top, mid, low]);
        startPoll(lp.update);
      });
    }
    function orderStrip(o){
      var p = el('a', 'panel cab-strip'); p.href = '#orders';
      var i = F.FLOW.indexOf(o.status);
      p.append(el('span', 'badge', o.statusText), el('b', '', 'Заявка ' + o.number), el('span', 'muted', (o.items || []).filter(function(x){ return x.kind === 'equipment'; }).map(function(x){ return (x.qty > 1 ? x.qty + ' × ' : '') + x.name; }).join(', ')));
      var bar = el('div', 'stepper stepper--mini'); F.FLOW.forEach(function(s, k){ var x = el('div', k < i ? 'done' : k === i ? 'now' : ''); x.appendChild(el('i')); bar.appendChild(x); });
      p.append(bar, el('span', 'link', 'Деталі →'));
      return p;
    }

    /* live flow: grid · storage · site */
    function liveBox(lv, systems){
      var p = panel(null, 'cab-live'), hd = el('div', 'cab-live__h'), clock = el('span', 'mono muted'), chip = el('span', 'chipst');
      hd.append(el('h3', '', 'Зараз'), clock, chip); p.appendChild(hd);
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
      var nums = el('div', 'cab-live__nums'), nG = num('Мережа'), nB = num('Накопичувач'), nS = num('Об’єкт');
      nums.append(nG.n, nB.n, nS.n); p.appendChild(nums);
      var foot = el('div', 'cab-live__f'), mode = el('span'), eta = el('span', 'muted'), ctl = link('Керувати →', '#devices');
      foot.append(mode, eta, ctl); p.appendChild(foot);
      function num(t){ var n = el('div'), a = el('span', '', t), b = el('b'), c = el('small'); n.append(a, b, c); return { n: n, b: b, c: c }; }
      function set(f, on, w){ var x = svg.querySelector('[data-f="' + f + '"]'); x.classList.toggle('is-on', on); x.style.strokeWidth = on ? Math.max(3, Math.min(7, 3 + w)) : ''; }
      function update(l){
        if (!l) return;
        var dis = Math.max(0, -l.pBat), chg = Math.max(0, l.pBat), gs = Math.max(0, l.pLoad - dis), out = l.out;
        clock.textContent = hm(l.at || Date.now());
        chip.className = 'chipst ' + (out ? 'chipst--warn' : 'chipst--ok'); chip.textContent = out ? 'Відключення' + (l.outage && l.outage.from ? ' з ' + hm(l.outage.from) : '') + ' — працюємо від накопичувача' : 'Мережа є';
        set('gs', !out && gs > .05, gs / 4); set('gb', !out && chg > .05, chg / 4); set('bs', dis > .05, dis / 4);
        svg.querySelector('[data-n="grid"]').classList.toggle('is-off', !!out);
        var soc = l.soc != null ? l.soc : 0, lvl = svg.querySelector('.flow__lvl'); lvl.setAttribute('y', 60 + 98 * (1 - soc)); lvl.setAttribute('height', 98 * soc);
        svg.querySelector('.flow__soc').textContent = l.soc != null ? nf(soc * 100) + ' %' : '—';
        svg.classList.toggle('is-low', soc < .2);
        nG.b.textContent = out ? 'немає' : kw(l.pGrid); nG.c.textContent = out ? 'мережі зараз немає' : chg > .05 ? 'живить об’єкт і заряджає' : 'живить об’єкт';
        nB.b.textContent = l.soc != null ? nf(soc * 100) + ' %' : '—'; nB.c.textContent = dis > .05 ? 'віддає ' + kw(dis) : chg > .05 ? 'заряджається ' + kw(chg) : 'чекає';
        nS.b.textContent = kw(l.pLoad); nS.c.textContent = 'споживає зараз';
        var s0 = l.systems && l.systems[0];
        mode.textContent = ''; mode.append('Режим: ', el('b', '', s0 ? (s0.boost ? 'тримаємо повний заряд до ' + hm(s0.boost.until) : F.modeText({ mode: s0.mode, reserve: s0.reserve })) : '—'));
        eta.textContent = l.eta != null ? (out ? 'Енергії вистачить ще на ≈ ' : 'При відключенні вистачить на ≈ ') + hours(Math.max(.1, Math.round(l.eta * 2) / 2)) : '';
        svg.setAttribute('aria-label', 'Зараз: ' + nG.c.textContent + '; накопичувач ' + nB.b.textContent + ', ' + nB.c.textContent + '; об’єкт споживає ' + nS.b.textContent);
      }
      update(lv);
      if (systems && systems.length === 1) ctl.href = '#devices=' + systems[0].id;
      return { node: p, update: update };
    }

    function tile(label, value, sub, cls){ var t = el('div', 'tile' + (cls ? ' ' + cls : '')); t.append(el('span', '', label), el('b', '', value)); if (sub) t.appendChild(el('small', '', sub)); return t; }
    function kpiBox(k, today){
      var p = panel(null, 'cab-kpi'), g = el('div', 'tiles');
      var td = k.today, mo = k.month, tot = k.total, mon = F.local(Date.now()).mon;
      var MONN = ['Січень', 'Лютий', 'Березень', 'Квітень', 'Травень', 'Червень', 'Липень', 'Серпень', 'Вересень', 'Жовтень', 'Листопад', 'Грудень'];
      g.appendChild(tile('Сьогодні, поки що', td ? uah(td.profit, true) : '—', td && (td.chg || td.dis) ? 'купили ' + kwh(td.chg) + (td.buyAvg != null ? ' по ' + price(td.buyAvg) : '') + ' · віддали ' + kwh(td.dis) + (td.sellAvg != null ? ' по ' + price(td.sellAvg) : '') : 'день лише почався', td && td.profit < 0 ? 'tile--neg' : ''));
      g.appendChild(tile(MONN[mon], mo ? uah(mo.profit, true) : '—', mo ? (mo.outH ? 'і ' + hours(mo.outH) + ' без мережі на накопичувачі' : 'без відключень') : ''));
      g.appendChild(tile('Від запуску', tot ? uah(tot.profit, true) : '—', k.since ? 'з ' + dmy(k.since) + ' · ' + kwh(tot.dis) + ' віддано' : ''));
      var m = el('div', 'tile tile--meter'), share = k.share != null ? Math.max(0, k.share) : null;
      m.append(el('span', '', 'Окупність'), el('b', '', share != null ? pct(share) : '—'));
      var bar = el('div', 'meter'), fill = el('i'); fill.style.width = Math.min(100, (share || 0) * 100) + '%'; bar.appendChild(fill); m.appendChild(bar);
      m.appendChild(el('small', '', k.invest ? payText(k.years) + (k.years > 0 && k.years <= 30 ? ' за темпом останніх 30 днів' : '') + ' · вкладено ' + uah(k.invest) : 'з’явиться після оплати замовлення'));
      g.appendChild(m);
      p.appendChild(g);
      if (today && today.plan && today.plan.gain > 0) p.appendChild(el('p', 'hint', 'План «Економії» на сьогодні: ≈ ' + uah(today.plan.gain, true) + ' за добу' + (today.plan.est ? ' (ціни частково — оцінка)' : '') + '.'));
      if (k.backup && k.backup.h > 0) p.appendChild(el('p', 'hint', 'Резерв від запуску: ' + hours(k.backup.h) + ' без мережі, накопичувач віддав ' + kwh(k.backup.kwh) + ' — це ≈ ' + uah(k.backup.value) + ' пального генератора.'));
      return p;
    }
    function legend(items){ var l = el('div', 'clegend'); items.forEach(function(x){ var i = el('span'), k = el('i', x[2] ? 'ln' : ''); k.style.background = x[1]; i.append(k, d.createTextNode(x[0])); l.appendChild(i); }); return l; }
    function todayBox(v, systems){
      var p = panel(null, 'cab-today'), h = el('div', 'cab-p__h');
      h.append(el('h3', '', 'Сьогодні'), legend([['віддав об’єкту', Ch.C.dis], ['узяв з мережі', Ch.C.chg], ['рівень заряду', Ch.C.soc, 1], ['ціна', Ch.C.price, 1]]), link('Детально →', '#energy'));
      p.appendChild(h);
      var host = el('div'); p.appendChild(host);
      var res = systems.length === 1 && systems[0].settings && systems[0].mode !== 'backup' ? systems[0].settings.reserve : null;
      requestAnimationFrame(function(){ Ch.strips(host, v, { compact: true, reserve: res }); });
      p.appendChild(el('p', 'hint', F.tariffText(v.tariff) + (v.est ? ' · частина цін — оцінка' : '') + '. Попереду — ціни решти доби й план заряду.'));
      return p;
    }
    var KIND = { buy: ['Купили', 'is-buy'], sell: ['Віддали об’єкту', 'is-sell'], out: ['Відключення', 'is-out'] };
    function blockRow(b){
      var li = el('li', 'trade ' + KIND[b.k][1]), t = el('div', 'trade__t');
      t.append(el('b', '', hm(b.from) + '–' + hm(b.to)), el('span', '', KIND[b.k][0]));
      var m = el('div', 'trade__m');
      if (b.k === 'out') { m.append(el('span', '', 'віддали ' + kwh(b.kwh)), el('b', '', b.uns > .05 ? 'не вистачило ' + kwh(b.uns) : 'без перерви')); }
      else { m.append(el('span', '', kwh(b.kwh) + ' по ' + price(b.avg)), el('b', '', uah(b.money, true))); }
      li.append(t, m); return li;
    }
    function planLeft(pl, now){
      if (!pl) return null;
      var h0 = F.local(now).h + 1, out = [], cur = null;
      for (var h = h0; h < 24; h++) { var a = pl.act[h]; if (cur && cur.a === a) { cur.to = h + 1; continue; } if (cur && cur.a) out.push(cur); cur = { a: a, from: h, to: h + 1 }; }
      if (cur && cur.a) out.push(cur);
      return out.map(function(x){ return pad(x.from) + ':00–' + pad(x.to) + ':00 ' + (x.a === 'c' ? 'заряд' : 'віддача'); });
    }
    function tradesBox(v){
      var p = panel('Коли купили енергію і по чому', 'cab-trades'), ul = el('ul', 'trades');
      (v.rows || []).forEach(function(b){ ul.appendChild(blockRow(b)); });
      if (!v.rows || !v.rows.length) ul.appendChild(el('li', 'hint', 'Сьогодні накопичувач ще не заряджався й не віддавав енергію.'));
      p.appendChild(ul);
      var t = v.totals, sum = el('div', 'trades__sum'); sum.append(el('span', '', 'Разом сьогодні'), el('b', '', uah(t.profit, true))); p.appendChild(sum);
      var left = planLeft(v.plan, v.now);
      if (left && left.length) p.appendChild(el('p', 'hint', 'Далі за планом: ' + left.join(', ') + '.'));
      p.appendChild(link('Уся історія →', '#energy=month'));
      return p;
    }
    function socBar(soc){ var b = el('div', 'socbar'), i = el('i'); i.style.width = Math.round((soc || 0) * 100) + '%'; b.appendChild(i); return b; }
    function statusChip(card){ return el('span', 'chipst ' + (card.status === 'online' ? 'chipst--ok' : 'chipst--warn'), card.driver === 'sim' ? 'Симуляція' : card.status === 'online' ? 'На зв’язку' : 'Немає зв’язку'); }
    function systemsBox(systems, lv){
      var p = panel('Техніка', 'cab-sys');
      if (!systems.length) { p.appendChild(el('p', 'hint', 'Обладнання з’явиться тут після монтажу й пусконалагодження.')); return p; }
      systems.forEach(function(s){
        var l = (lv.systems || []).filter(function(x){ return x.id === s.id; })[0], a = el('a', 'syscard'); a.href = '#devices=' + s.id;
        a.appendChild(photo(s.img, 'syscard__ph'));
        var b = el('div', 'syscard__b'); b.append(el('b', '', s.name), el('small', 'muted', s.model + (s.serial ? ' · № ' + s.serial : '')));
        if (s.comps && s.comps.length) b.appendChild(el('small', 'muted', '+ ' + s.comps.length + ' × ' + (s.comps[0].name || 'батарея')));
        var row = el('div', 'syscard__r'); row.append(statusChip(s), el('span', 'mono', l && l.soc != null ? nf(l.soc * 100) + ' %' : '—')); b.append(row, socBar(l && l.soc), el('small', '', s.modeText + ' · ' + nf(s.kwh, 1) + ' кВт·год · ' + nf(s.kw, s.kw % 1 ? 1 : 0) + ' кВт'));
        a.appendChild(b); p.appendChild(a);
      });
      return p;
    }
    function eventRow(e){
      var li = el('li', 'ev ev--' + (e.kind === 'outage' ? (e.level === 'warn' ? 'warn' : 'out') : e.kind === 'command' ? 'cmd' : e.level || 'info')), t, s;
      if (e.kind === 'outage') { var dur = (e.t_end || Date.now()) - e.t; t = e.t_end ? 'Відключення мережі · ' + hours(Math.round(dur / 1800000) / 2) : 'Відключення триває'; s = dm(e.t) + ' ' + hm(e.t) + (e.t_end ? '–' + hm(e.t_end) : '') + ' · накопичувач віддав ' + kwh(e.kwh) + (e.uns > .05 ? ', не вистачило ' + kwh(e.uns) : ', об’єкт працював без перерви'); }
      else if (e.kind === 'command') { var c = e.cmd; t = c.kind === 'boost' ? 'Тримати повний заряд до ' + hm(c.payload.until) : c.kind === 'cancel' ? 'Утримання заряду скасовано' : (c.note || 'Нові налаштування') + ': ' + F.modeText(c.payload); s = when(e.t) + ' · ' + (c.user_name || '') + (c.status !== 'applied' ? ' · ' + cmdStatus(c) : ''); }
      else { t = e.text || ({ offline: 'Немає зв’язку з обладнанням', online: 'Зв’язок відновлено', alarm: 'Тривога обладнання' }[e.kind] || 'Подія'); s = when(e.t); }
      li.append(el('b', '', t), el('small', '', s)); return li;
    }
    function eventsBox(list){
      var p = panel('Події за 2 тижні', 'cab-ev'), ul = el('ul', 'evs');
      list.slice(0, 8).forEach(function(e){ ul.appendChild(eventRow(e)); });
      if (!list.length) ul.appendChild(el('li', 'hint', 'Відключень і змін налаштувань не було.'));
      p.appendChild(ul);
      if (list.some(function(e){ return e.kind === 'outage' && e.uns > .05; })) { var h = el('p', 'hint'); h.append('Енергії вистачило не на все відключення. Підніміть резерв або перед відомим відключенням увімкніть «Зарядити й тримати» — ', link('Техніка й керування', '#devices'), '.'); p.appendChild(h); }
      return p;
    }

    /* ---------------- equipment and control ---------------- */
    function devices(my){
      return A.overview(site.id).then(function(ov){
        if (!mine(my)) return;
        var systems = ov.systems;
        if (!systems.length) { put([empty('Техніки на цьому об’єкті ще немає', 'Обладнання з’явиться після монтажу: інженер додасть його з серійними номерами, і тут можна буде ним керувати.', [link('Заявки й покупки', '#orders', 'btn btn--ghost btn--sm')])]); return; }
        var id = systems.some(function(s){ return s.id === arg; }) ? arg : systems[0].id;
        return A.device(id).then(function(v){ if (mine(my)) drawDevice(v, systems, ov.live); });
      });
    }
    function drawDevice(v, systems, lv){
      var grid = el('div', 'cab-grid cab-grid--dev'), side = el('div', 'cab-col'), main = el('div', 'cab-col');
      if (systems.length > 1) { var lp = panel('Системи'); systems.forEach(function(s){ var a = el('a', 'syspick' + (s.id === v.card.id ? ' is-on' : '')); a.href = '#devices=' + s.id; a.append(photo(s.img, 'syspick__ph'), el('b', '', s.name), el('small', 'muted', s.modeText)); lp.appendChild(a); }); side.appendChild(lp); }
      [cardBox(v), compsBox(v)].forEach(function(n){ if (n) side.appendChild(n); });
      [controlBox(v), boostBox(v), logBox(v)].forEach(function(n){ if (n) main.appendChild(n); });
      grid.append(main, side);
      put([grid]);
      startPoll(function(l){ var s = (l.systems || []).filter(function(x){ return x.id === v.card.id; })[0]; if (s && v.liveUpdate) v.liveUpdate(s); });
    }
    function cardBox(v){
      var c = v.card, p = panel(null, 'cab-dev');
      p.appendChild(photo(c.img, 'cab-dev__ph'));
      var b = el('div', 'cab-dev__b'); b.append(el('h2', 'h3', c.name), el('p', 'muted', c.model + (c.serial ? ' · № ' + c.serial : '')));
      var chips = el('div', 'chips'); chips.appendChild(statusChip(c)); if (v.firmware) chips.appendChild(el('span', 'chipst', 'Прошивка ' + v.firmware)); b.appendChild(chips);
      p.appendChild(b);
      var lvl = el('div', 'cab-dev__live'), big = el('b'), sub = el('small'), bar = socBar(0);
      lvl.append(el('span', '', 'Рівень заряду'), big, bar, sub); p.appendChild(lvl);
      v.liveUpdate = function(l){ big.textContent = l.soc != null ? nf(l.soc * 100) + ' %' : '—'; bar.firstChild.style.width = Math.round((l.soc || 0) * 100) + '%';
        sub.textContent = (l.out ? 'немає мережі · ' : '') + (l.pBat < -.05 ? 'віддає ' + kw(l.pBat) : l.pBat > .05 ? 'заряджається ' + kw(l.pBat) : 'чекає') + ' · об’єкт ' + kw(l.pLoad) + ' · ' + ago(l.at); };
      if (v.live) v.liveUpdate(v.live);
      var t = v.last30, pu = v.purchase;
      p.appendChild(kv([
        ['Ємність · потужність', nf(c.kwh, 2) + ' кВт·год · ' + nf(c.kw, c.kw % 1 ? 1 : 0) + ' кВт'],
        ['Змонтовано', c.installed_at ? dmy(c.installed_at) : '—'],
        pu ? ['Куплено', dmy(pu.at) + ' · ' + (pu.price != null ? uah(pu.price) : 'ціна в замовленні') + ' · ' + pu.order] : null,
        ['Гарантія', v.warranty_until ? 'до ' + dmy(v.warranty_until) : 'за умовами виробника'],
        ['Повних циклів', v.cycles != null ? nf(v.cycles, 0) : '—'],
        ['За 30 днів', 'купили ' + kwh(t.chg) + ' · віддали ' + kwh(t.dis) + ' · ' + uah(t.profit, true)]
      ]));
      return p;
    }
    function compsBox(v){
      if (!v.comps || !v.comps.length) return null;
      var p = panel('Батарейні модулі');
      v.comps.forEach(function(c){
        var r = el('div', 'comp'); r.appendChild(photo(c.img, 'comp__ph'));
        var b = el('div', 'comp__b'); b.append(el('b', '', c.name), el('small', 'muted', (c.model || '') + (c.serial ? ' · № ' + c.serial : '')));
        b.appendChild(el('small', '', [c.soc != null ? 'заряд ' + nf(c.soc * 100) + ' %' : '', c.temp != null ? c.temp + ' °C' : '', c.warranty_until ? 'гарантія до ' + dmy(c.warranty_until) : ''].filter(Boolean).join(' · ')));
        if (c.purchase) b.appendChild(el('small', 'muted', 'куплено ' + dmy(c.purchase.at) + (c.purchase.price != null ? ' по ' + uah(c.purchase.price) : '')));
        r.appendChild(b); p.appendChild(r);
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
      own.type = 'number'; own.min = min; own.max = max; own.step = stepv; own.inputMode = 'decimal'; own.setAttribute('aria-label', 'Своє значення, ' + unit);
      list.forEach(function(x){ var c = el('button', 'chip', nf(x, x % 1 ? 1 : 0) + ' ' + unit); c.type = 'button'; var on = Math.abs(x - val) < 1e-9; match = match || on; c.setAttribute('aria-pressed', String(on));
        c.addEventListener('click', function(){ $$('.chip', chips).forEach(function(y){ y.setAttribute('aria-pressed', String(y === c)); }); own.value = ''; onSet(x); }); chips.appendChild(c); });
      if (!match) own.value = val;
      own.placeholder = 'своє';
      own.addEventListener('input', function(){ var x = +own.value; if (own.value === '' || !isFinite(x)) return; $$('.chip', chips).forEach(function(y){ y.setAttribute('aria-pressed', 'false'); }); onSet(x); });
      w.append(chips, own); return w;
    }
    function controlBox(v){
      var p = panel(null, 'cab-ctl'), can = v.site && v.site.can && v.site.can.control, lim = v.limits, cur = v.settings, draft = JSON.parse(JSON.stringify(cur));
      var h = el('div', 'cab-p__h'); h.append(el('h3', '', 'Керування'), el('span', 'muted', 'зараз: ' + F.modeText(cur))); p.appendChild(h);
      if (!can) p.appendChild(el('p', 'hint', 'У вас доступ лише на перегляд. Змінювати налаштування може власник або той, кому він дав право керувати.'));
      var form = el('div', 'ctl'); p.appendChild(form);
      var modeHelp = el('p', 'hint ctl__help');
      form.appendChild(field('Режим', seg([['backup', 'Резерв', 'завжди повний'], ['smart', 'Економія', 'за цінами'], ['manual', 'Свій графік', 'години заряду й віддачі']], draft.mode, function(m){ draft.mode = m; sync(); }, 'seg--mode')));
      form.appendChild(modeHelp);
      var resF = field('Резерв на відключення', presets([20, 30, 50, 80, 100], draft.reserve, '%', 10, 100, 5, function(x){ draft.reserve = Math.round(x); sync(); }), 'Нижче цього рівня накопичувач не розряджається — енергія чекає на відключення.');
      var mx = lim.gridKw[1], gl = [mx * .25, mx * .5, mx * .75].map(function(x){ return Math.max(.5, Math.round(x * 2) / 2); }).concat([mx]).filter(function(x, i, a){ return a.indexOf(x) === i && x <= mx; });
      var gridF = field('Заряд від мережі, не більше', presets(gl, draft.gridKw, 'кВт', .5, mx, .5, function(x){ draft.gridKw = Math.round(x * 10) / 10; sync(); }), 'Обмежте, якщо ввідний автомат слабкий або вечорами вмикається багато техніки.');
      form.append(resF, gridF);
      var winF = el('div', 'ctl__win'); form.appendChild(winF);
      var prev = el('div', 'ctl__prev'); form.appendChild(prev);
      var foot = el('div', 'ctl__foot'), apply = btn('Застосувати'), reset = btn('Скинути', 'btn--ghost btn--sm'), msg = el('p', 'hint', ''); msg.setAttribute('role', 'status');
      foot.append(apply, reset, msg); form.appendChild(foot);
      if (!can) $$('button, input, select', form).forEach(function(x){ x.disabled = true; });
      function changed(){ return JSON.stringify(F.normalize(draft, lim2()).value) !== JSON.stringify(F.normalize(cur, lim2()).value); }
      function lim2(){ return { maxChargeKw: lim.gridKw[1], kw: lim.kw, kwh: lim.kwh }; }
      function sync(){
        modeHelp.textContent = MODE_HELP[draft.mode];
        resF.classList.toggle('is-off', draft.mode === 'backup');
        winF.hidden = draft.mode !== 'manual'; if (draft.mode === 'manual') drawWindows();
        drawPreview();
        var n = F.normalize(draft, lim2());
        apply.disabled = !can || !changed() || !n.ok;
        msg.textContent = !n.ok ? n.errors.map(function(x){ return x.m; }).join(' ') : changed() ? 'Є незбережені зміни.' : '';
      }
      function drawWindows(){
        winF.textContent = ''; winF.appendChild(el('span', 'lbl', 'Вікна заряду й віддачі'));
        draft.windows.forEach(function(w, i){
          var r = el('div', 'win'), type = sel([['c', 'Заряд'], ['d', 'Віддача']], w.type), a = sel(hoursOpts(0, 23), w.from), b = sel(hoursOpts(1, 24), w.to), k = el('input', 'input input--sm');
          k.type = 'number'; k.min = .5; k.step = .5; k.max = w.type === 'c' ? lim.gridKw[1] : lim.kw; k.value = w.kw; k.setAttribute('aria-label', 'Потужність, кВт');
          var rm = el('button', 'rqi__rm', '×'); rm.type = 'button'; rm.setAttribute('aria-label', 'Прибрати вікно');
          type.addEventListener('change', function(){ w.type = type.value; w.kw = w.type === 'c' ? lim.gridKw[1] : lim.kw; sync(); });
          a.addEventListener('change', function(){ w.from = +a.value; sync(); }); b.addEventListener('change', function(){ w.to = +b.value; sync(); });
          k.addEventListener('input', function(){ w.kw = +k.value; sync(); }); rm.addEventListener('click', function(){ draft.windows.splice(i, 1); sync(); });
          r.append(type, el('span', 'muted', 'з'), a, el('span', 'muted', 'до'), b, k, el('span', 'muted', 'кВт'), rm); winF.appendChild(r);
        });
        if (draft.windows.length < 6) { var add = btn('+ вікно', 'btn--ghost btn--sm'); add.addEventListener('click', function(){ var last = draft.windows[draft.windows.length - 1], f = last ? Math.min(23, last.to) : 11; draft.windows.push({ type: last && last.type === 'c' ? 'd' : 'c', from: f, to: Math.min(24, f + 3), kw: last && last.type === 'c' ? lim.kw : lim.gridKw[1] }); sync(); }); winF.appendChild(add); }
        if (!can) $$('button, input, select', winF).forEach(function(x){ x.disabled = true; });
      }
      function drawPreview(){
        prev.textContent = '';
        if (draft.mode === 'backup') { prev.appendChild(el('p', 'hint', 'План не потрібен: накопичувач тримає 100 % і віддає енергію лише без мережі.')); return; }
        if (draft.mode === 'manual') { var pl = { day: F.dayOf(Date.now()), act: [], price: v.plans[0].price }; for (var h = 0; h < 24; h++) { var w = draft.windows.filter(function(x){ return h >= x.from && h < x.to; })[0]; pl.act.push(w ? w.type : ''); }
          prev.appendChild(el('span', 'lbl', 'Ваш графік на добу')); var hst = el('div'); prev.appendChild(hst); Ch.plan(hst, pl, { now: Date.now() }); return; }
        var same = draft.reserve === cur.reserve && draft.gridKw === cur.gridKw && cur.mode === 'smart';
        v.plans.forEach(function(pl, i){
          var hd = el('div', 'ctl__ph'); hd.append(el('span', 'lbl', (i ? 'Завтра, ' : 'Сьогодні, ') + dm(F.dayStart(pl.day) + 43200000)), el('span', 'muted', 'очікувано ' + uah(pl.gain, true) + (pl.est ? ' · ціни — оцінка' : '')));
          prev.appendChild(hd); var hst = el('div'); prev.appendChild(hst); Ch.plan(hst, pl, { now: Date.now() });
        });
        prev.appendChild(el('p', 'hint', same ? 'План складає сервер за цінами доби й типовим споживанням об’єкта.' : 'План показано для поточних налаштувань — після «Застосувати» сервер перерахує його.'));
      }
      apply.addEventListener('click', function(){
        apply.disabled = true; msg.textContent = 'Надсилаємо…';
        A.command(v.card.id, { kind: 'settings', payload: F.normalize(draft, lim2()).value }).then(function(r){
          S.toast(r.command.status === 'applied' ? 'Застосовано: ' + F.modeText(r.command.payload) : 'Надіслано обладнанню — застосує з наступним зв’язком');
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
      h.append(el('h3', '', 'Чекаєте відключення?')); p.appendChild(h);
      if (v.boost) {
        p.appendChild(el('p', '', 'Накопичувач заряджається до 100 % і тримає заряд до ' + hm(v.boost.until) + (F.dayOf(v.boost.until) !== F.dayOf(Date.now()) ? ' (' + dm(v.boost.until) + ')' : '') + '. Потім повернеться до режиму «' + F.MODES[v.settings.mode] + '».'));
        var c = btn('Скасувати', 'btn--ghost btn--sm'); c.disabled = !can;
        c.addEventListener('click', function(){ c.disabled = true; A.command(v.card.id, { kind: 'cancel' }).then(function(){ S.toast('Утримання заряду скасовано'); show('devices', v.card.id); }, function(e){ S.toast(A.message(e)); c.disabled = false; }); });
        p.appendChild(c); return p;
      }
      p.appendChild(el('p', 'hint', 'Якщо відомий графік відключень — зарядіть накопичувач до 100 % заздалегідь і тримайте заряд до потрібного часу, навіть у режимі «Економія».'));
      var now = Date.now(), opts = [[2, 'на 2 год'], [4, 'на 4 год'], [8, 'на 8 год']], untilH = 23, chips = el('div', 'chips'), pick = null;
      var t23 = F.dayStart(F.dayOf(now)) + untilH * F.HOUR; if (t23 - now > 3600000) opts.push(['eod', 'до 23:00']);
      opts.forEach(function(o){ var c2 = el('button', 'chip', o[1]); c2.type = 'button'; c2.setAttribute('aria-pressed', 'false'); c2.disabled = !can;
        c2.addEventListener('click', function(){ $$('.chip', chips).forEach(function(y){ y.setAttribute('aria-pressed', String(y === c2)); }); pick = o[0] === 'eod' ? t23 : now + o[0] * F.HOUR; go.disabled = false; }); chips.appendChild(c2); });
      var go = btn('Зарядити й тримати'); go.disabled = true;
      go.addEventListener('click', function(){ go.disabled = true; A.command(v.card.id, { kind: 'boost', payload: { until: Math.round(pick) } }).then(function(){ S.toast('Заряджаємо до 100 % і тримаємо до ' + hm(pick)); show('devices', v.card.id); }, function(e){ S.toast(A.message(e)); go.disabled = false; }); });
      var row = el('div', 'cab-boost__r'); row.append(chips, go); p.appendChild(row);
      return p;
    }
    function cmdStatus(c){ return { pending: 'чекає обладнання', sent: 'надіслано обладнанню', applied: 'застосовано', failed: 'не застосовано' + (c.error ? ': ' + c.error : '') }[c.status] || c.status; }
    function cmdText(c){
      if (c.kind === 'boost') return 'Тримати повний заряд до ' + hm(c.payload.until);
      if (c.kind === 'cancel') return 'Скасувати утримання заряду';
      var p = c.payload || {}, pr = c.prev, parts = [F.modeText(p)];
      if (p.mode === 'manual' && p.windows) parts.push(p.windows.map(function(w){ return (w.type === 'c' ? 'заряд ' : 'віддача ') + pad(w.from) + '–' + pad(w.to); }).join(', '));
      if (pr && pr.gridKw !== p.gridKw) parts.push('заряд від мережі до ' + kw(p.gridKw));
      return (c.note ? c.note + ': ' : '') + parts.join(' · ') + (pr && pr.mode ? ' (було: ' + F.modeText(pr) + ')' : '');
    }
    function logBox(v){
      var p = panel('Журнал керування', 'cab-log');
      if (!v.commands.length) { p.appendChild(el('p', 'hint', 'Змін ще не було.')); return p; }
      var t = el('table', 'tbl'), th = el('thead'), tr = el('tr');
      ['Коли', 'Хто', 'Що змінили', 'Стан'].forEach(function(x){ tr.appendChild(el('th', '', x)); }); th.appendChild(tr); t.appendChild(th);
      var tb = el('tbody');
      v.commands.forEach(function(c){ var r = el('tr'); r.append(el('td', 'mono', dmy(c.created_at) + ' ' + hm(c.created_at)), el('td', '', c.user_name || '—'), el('td', '', cmdText(c)), el('td', 'st st--' + c.status, cmdStatus(c))); tb.appendChild(r); });
      t.appendChild(tb); var w = el('div', 'tblw'); w.appendChild(t); p.appendChild(w);
      return p;
    }

    /* ---------------- energy and money ---------------- */
    function energy(my){
      var a = arg.split(':'), range = F.RANGES[a[0]] ? a[0] : 'day', day = /^\d{4}-\d\d-\d\d$/.test(a[1] || '') ? a[1] : '';
      return A.energy(site.id, range, day).then(function(v){
        if (!mine(my)) return;
        var bar = el('div', 'panel cab-filter'), segs = seg(Object.keys(F.RANGES).map(function(k){ return [k, F.RANGES[k]]; }), v.range, function(r){ show('energy', r + ':' + v.day); }, 'seg--sm');
        var nav = el('div', 'cab-nav'), pv = el('button', 'cab-nav__b', '‹'), lab = el('b', '', v.label), nx = el('button', 'cab-nav__b', '›'), today = btn('Сьогодні', 'btn--ghost btn--sm');
        pv.type = nx.type = 'button'; pv.setAttribute('aria-label', 'Попередній період'); nx.setAttribute('aria-label', 'Наступний період');
        pv.disabled = !v.prev; nx.disabled = !v.next;
        pv.addEventListener('click', function(){ show('energy', v.range + ':' + v.prev); }); nx.addEventListener('click', function(){ show('energy', v.range + ':' + v.next); });
        today.addEventListener('click', function(){ show('energy', v.range); }); today.hidden = v.range === 'all';
        nav.append(pv, lab, nx); if (v.range === 'all') { pv.hidden = nx.hidden = true; }
        bar.append(segs, nav, today);
        var t = v.totals, k = el('div', 'tiles tiles--5');
        k.appendChild(tile('Купили з мережі', kwh(t.chg), t.chg ? 'по ' + price(t.buyAvg) + ' · ' + uah(t.cost) : 'заряду не було'));
        k.appendChild(tile('Віддали об’єкту', kwh(t.dis), t.dis ? 'по ' + price(t.sellAvg) + ' · ' + uah(t.val) : 'віддачі не було'));
        k.appendChild(tile('Прибуток', uah(t.profit, true), t.base ? 'рахунок ' + uah(t.base) + ' → ' + uah(t.bill) : '', t.profit < 0 ? 'tile--neg' : 'tile--hero'));
        k.appendChild(tile('Без мережі', hours(t.outH), t.outH ? 'накопичувач віддав ' + kwh(t.outDis) + (t.uns > .05 ? ' · не вистачило ' + kwh(t.uns) : '') : 'відключень не було'));
        k.appendChild(tile('Цикли', nf(t.cycles, t.cycles < 10 ? 1 : 0), 'повних, за період'));
        var cp = panel(null, 'cab-chart'), hd = el('div', 'cab-p__h'), host = el('div');
        if (v.size === 'q' || v.size === 'hour') hd.append(el('h3', '', v.size === 'q' ? 'Доба по 15 хвилин' : 'Тиждень по годинах'), legend([['віддав об’єкту', Ch.C.dis], ['узяв з мережі', Ch.C.chg], ['рівень заряду', Ch.C.soc, 1], ['ціна', Ch.C.price, 1]]));
        else hd.append(el('h3', '', v.size === 'day' ? 'Прибуток по днях, ₴' : 'Прибуток по місяцях, ₴'), legend([['заощадили', Ch.C.dis], ['витратили більше', Ch.C.neg]]));
        cp.append(hd, host);
        put([bar, k, cp, tableBox(v)]);
        requestAnimationFrame(function(){
          if (v.size === 'q' || v.size === 'hour') Ch.strips(host, v, {});
          else Ch.bars(host, v.series.map(function(x){ x.short = v.size === 'day' ? x.key.slice(8) : x.label.slice(0, 3).toLowerCase(); return x; }), { onPick: function(x){ show('energy', v.size === 'day' ? 'day:' + x.key : 'month:' + x.key + '-01'); } });
        });
      });
    }
    function tableBox(v){
      var p = panel(v.size === 'q' ? 'Коли купили енергію і по чому' : 'Купівля й віддача по ' + (v.size === 'month' ? 'місяцях' : 'днях'), 'cab-tbl'), t = el('table', 'tbl tbl--num'), th = el('thead'), tr = el('tr'), tb = el('tbody');
      if (v.size === 'q') {
        [['Коли'], ['Що'], ['Енергія', 'n'], ['Ціна', 'n'], ['Гроші', 'n']].forEach(function(x){ tr.appendChild(el('th', x[1] || '', x[0])); });
        v.rows.forEach(function(b){ var r = el('tr', 'is-' + b.k); r.append(el('td', 'mono', hm(b.from) + '–' + hm(b.to)), el('td', '', KIND[b.k][0]), el('td', 'n', kwh(b.kwh)), el('td', 'n', b.k === 'out' ? '—' : price(b.avg)),
          el('td', 'n ' + (b.money < 0 ? 'neg' : 'pos'), b.k === 'out' ? (b.uns > .05 ? 'не вистачило ' + kwh(b.uns) : 'без перерви') : uah(b.money, true))); tb.appendChild(r); });
        if (!v.rows.length) { var r0 = el('tr'), c0 = el('td', 'hint', 'Цього дня накопичувач не заряджався й не віддавав енергію.'); c0.colSpan = 5; r0.appendChild(c0); tb.appendChild(r0); }
      } else {
        ['Період', 'Купили', 'Ціна купівлі', 'Віддали', 'Ціна віддачі', 'Прибуток', 'Без мережі'].forEach(function(x, i){ tr.appendChild(el('th', i ? 'n' : '', x)); });
        v.rows.forEach(function(x){ var r = el('tr', 'is-link'), go = v.size === 'month' ? 'month:' + x.key + '-01' : 'day:' + x.key;
          r.append(el('td', 'mono', x.label), el('td', 'n', kwh(x.chg)), el('td', 'n', price(x.buyAvg)), el('td', 'n', kwh(x.dis)), el('td', 'n', price(x.sellAvg)), el('td', 'n ' + (x.profit < 0 ? 'neg' : 'pos'), uah(x.profit, true)), el('td', 'n', x.outH ? hours(x.outH) : '—'));
          r.tabIndex = 0; r.addEventListener('click', function(){ show('energy', go); }); r.addEventListener('keydown', function(e){ if (e.key === 'Enter') show('energy', go); }); tb.appendChild(r); });
      }
      th.appendChild(tr); t.append(th, tb); var w = el('div', 'tblw'); w.appendChild(t); p.appendChild(w);
      p.appendChild(el('p', 'hint', F.tariffText(v.tariff) + '. ' + (v.tariff.kind === 'dam' ? 'Ціни РДН — АТ «Оператор ринку», ОЕС України; розподіл і ПДВ не враховано. ' : 'Ціни з ПДВ. ') + (v.est ? 'Для частини годин точних цін немає — підставлено оцінку. ' : '') + 'Прибуток — різниця між вартістю енергії, яку накопичувач віддав об’єкту, і вартістю енергії, якою він зарядився. Енергія під час відключень у прибуток не входить — це резерв.'));
      return p;
    }

    /* ---------------- purchases ---------------- */
    function orders(my){
      return A.economics(site.id).then(function(e){
        if (!mine(my)) return;
        var grid = el('div', 'cab-grid cab-grid--ord'), main = el('div', 'cab-col'), side = el('div', 'cab-col');
        side.appendChild(paybackBox(e));
        (e.orders || []).forEach(function(o){ main.appendChild(orderBox(o)); });
        if (!e.orders || !e.orders.length) main.appendChild(empty('Покупок на цьому об’єкті ще немає', 'Заявки з кошика й погоджені пропозиції з’являться тут.', [link('Каталог', 'equipment.html', 'btn btn--volt btn--sm')]));
        var more = el('div', 'hero__cta'); more.append(link('Нова заявка', 'equipment.html', 'btn btn--ghost btn--sm'), link('Підібрати з AI-агентом', 'assistant.html', 'btn btn--ghost btn--sm')); main.appendChild(more);
        grid.append(main, side); put([grid]);
      });
    }
    function paybackBox(e){
      var p = panel('Окупність', 'cab-pay');
      if (!e.invest) { p.appendChild(el('p', 'hint', 'Порахуємо, щойно буде оплачене замовлення з обладнанням і монтажем.')); return p; }
      var t = e.totals || {}, share = Math.max(0, e.share || 0);
      p.appendChild(el('p', 'cab-pay__big', uah(t.profit || 0) + ' з ' + uah(e.invest)));
      var bar = el('div', 'meter meter--lg'), f = el('i'); f.style.width = Math.min(100, share * 100) + '%'; bar.appendChild(f); p.appendChild(bar);
      p.appendChild(kv([
        ['Повернулося', pct(share) + ' за ' + nf(e.days || 0) + ' ' + plural(e.days || 0, 'день', 'дні', 'днів')],
        ['Темп останніх 30 днів', uah(e.pace, true) + ' на день · ' + uah(e.yearly, true) + ' на рік'],
        ['Окупиться', payText(e.years, e.payDate ? monthYear(e.payDate) : null)],
        e.backup && e.backup.h ? ['Резерв від запуску', hours(e.backup.h) + ' без мережі · ' + kwh(e.backup.kwh)] : null,
        e.backup && e.backup.h ? ['З урахуванням резерву', (e.backup.years != null ? (e.backup.years <= 0 ? 'вже окупився' : e.backup.years > 30 ? 'понад 30 років' : '≈ ' + S.years(e.backup.years)) : '—') + ' · кВт·год генератора ≈ ' + nf(e.backup.gen) + ' ₴'] : null
      ]));
      if (e.months && e.months.length > 1) { p.appendChild(el('span', 'lbl', 'Прибуток по місяцях')); var host = el('div'); p.appendChild(host); requestAnimationFrame(function(){ Ch.bars(host, e.months.map(function(m){ m.short = m.label.slice(0, 3).toLowerCase(); return m; }), { height: 150 }); }); }
      p.appendChild(el('p', 'hint', 'Вкладено — оплачені замовлення цього об’єкта: обладнання й монтаж. Повернулося — те, що накопичувач заощадив на рахунку від дня запуску. Резерв рахуємо окремо й в окупність не додаємо.'));
      return p;
    }
    function plural(n, a, b, c){ var m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? a : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? b : c; }
    function monthYear(t){ var L = F.local(t); return ['січень', 'лютий', 'березень', 'квітень', 'травень', 'червень', 'липень', 'серпень', 'вересень', 'жовтень', 'листопад', 'грудень'][L.mon] + ' ' + L.y; }
    function orderBox(o){
      var p = panel(null, 'cab-ord'), h = el('div', 'cab-p__h');
      h.append(el('h3', '', o.number + ' · ' + dmy(o.created_at)), el('span', 'chipst ' + (o.status === 'done' ? 'chipst--ok' : o.status === 'cancelled' ? 'chipst--warn' : 'chipst--now'), o.statusText)); p.appendChild(h);
      if (o.status !== 'done' && o.status !== 'cancelled') {
        var i = F.FLOW.indexOf(o.status), st = el('div', 'stepper'); F.FLOW.forEach(function(s, k){ var x = el('div', k < i ? 'done' : k === i ? 'now' : ''); x.append(el('i'), el('span', '', F.STATUS[s])); st.appendChild(x); }); p.appendChild(st);
        p.appendChild(el('p', 'hint', { new: 'Інженер зателефонує й домовиться про огляд.', survey: 'Після огляду надішлемо пропозицію з фінальною ціною й строком.', offer: 'Пропозиція готова — інженер узгодить її з вами. Оплата лише після договору.', contract: 'Договір підписано — чекаємо оплату.', paid: 'Оплату отримано — готуємо поставку.', delivered: 'Обладнання на місці — домовляємося про монтаж.', installed: 'Монтаж завершено — налаштовуємо й запускаємо.' }[o.status] || ''));
      }
      var t = el('table', 'tbl tbl--ord'), tb = el('tbody'), grp = null;
      (o.items || []).forEach(function(it){
        if (it.grp && it.grp !== grp) { grp = it.grp; var gr = el('tr', 'grp'), gc = el('td', '', it.grp); gc.colSpan = 4; gr.appendChild(gc); tb.appendChild(gr); }
        var r = el('tr'), c1 = el('td', 'it'); c1.appendChild(it.kind === 'equipment' || it.img ? photo(it.img, 'it__ph') : icon(it.kind)); var nm = el('div'); nm.append(el('b', '', it.name), el('small', 'muted', it.sub || '')); c1.appendChild(nm);
        r.append(c1, el('td', 'mono', '× ' + it.qty), el('td', 'mono', it.price_uah != null ? uah(it.price_uah) : 'за запитом'), el('td', 'mono', it.price_uah != null ? uah(it.price_uah * it.qty) : '—')); tb.appendChild(r);
      });
      t.appendChild(tb); var w = el('div', 'tblw'); w.appendChild(t); p.appendChild(w);
      var sum = el('div', 'trades__sum'); sum.append(el('span', '', o.priced ? 'Разом, з ПДВ' : 'Разом без позицій за запитом'), el('b', '', uah(o.total))); p.appendChild(sum);
      if (o.log && o.log.length) { var tl = el('ol', 'tline'); o.log.forEach(function(x){ var li = el('li'); li.append(el('b', '', F.STATUS[x.status] || x.status), el('span', 'mono muted', dmy(x.at))); if (x.note) li.appendChild(el('small', 'muted', x.note)); tl.appendChild(li); }); p.appendChild(tl); }
      if (o.message) p.appendChild(el('p', 'hint', 'Ваш коментар: ' + o.message));
      return p;
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
      var p = panel('Профіль', 'cab-set'), f = el('form', 'form'), name = el('input', 'input'), save = btn('Зберегти'), msg = el('p', 'hint');
      name.value = me.name || ''; name.maxLength = 80; name.autocomplete = 'name'; save.type = 'submit';
      f.append(lab('Ім’я', name), save, msg); p.appendChild(f);
      f.addEventListener('submit', function(e){ e.preventDefault(); save.disabled = true; A.saveMe({ name: name.value }).then(function(r){ me.name = r.user.name; $('#cabWho').textContent = me.name; S.toast('Збережено'); }, function(x){ msg.textContent = A.message(x); }).then(function(){ save.disabled = false; }); });
      p.appendChild(contactRow('Телефон', me.phoneText, 'phone'));
      p.appendChild(contactRow('Пошта', me.email, 'email'));
      var out = btn('Вийти на всіх пристроях', 'btn--ghost btn--sm'); out.addEventListener('click', function(){ A.logout(true).then(function(){ location.href = 'login.html'; }, function(x){ S.toast(A.message(x)); }); });
      p.appendChild(out);
      return p;
    }
    function lab(t, ctl){ var w = el('label', 'ctl__f'); w.append(el('span', 'lbl', t), ctl); return w; }
    function contactRow(t, val, kind){
      var w = el('div', 'contact'), head = el('div', 'contact__h'), b = btn(val ? 'Змінити' : 'Додати', 'btn--ghost btn--sm'), box = el('div', 'contact__f'); box.hidden = true;
      head.append(el('span', 'lbl', t), el('b', 'mono', val || 'не додано'), b); w.append(head, box);
      b.addEventListener('click', function(){
        if (me.demo) { S.toast(A.message({ code: 'demo' })); return; }
        box.hidden = !box.hidden; if (box.hidden) return; box.textContent = '';
        var inp = el('input', 'input input--sm'), send = btn('Надіслати код'), code = el('input', 'input input--sm'), ok = btn('Підтвердити'), msg = el('p', 'hint');
        inp.placeholder = kind === 'phone' ? '+380' : 'name@company.ua'; inp.type = kind === 'phone' ? 'tel' : 'email'; code.placeholder = 'код з повідомлення'; code.inputMode = 'numeric'; code.maxLength = 6; code.hidden = ok.hidden = true;
        box.append(inp, send, code, ok, msg);
        send.addEventListener('click', function(){ A.contactStart(inp.value).then(function(r){ msg.textContent = 'Надіслали код на ' + r.to + (r.dev_code ? ' (розробка: ' + r.dev_code + ')' : '') + '.'; code.hidden = ok.hidden = false; code.focus(); }, function(x){ msg.textContent = A.message(x); }); });
        ok.addEventListener('click', function(){ A.contactVerify(inp.value, code.value).then(function(r){ me = Object.assign(me, r.user); S.toast('Збережено'); show('settings', ''); }, function(x){ msg.textContent = A.message(x); }); });
      });
      return w;
    }
    function siteBox(s){
      var p = panel('Об’єкт і тариф', 'cab-set'), f = el('form', 'form'), can = s.can && s.can.control, tf = JSON.parse(JSON.stringify(s.tariff));
      var name = el('input', 'input'), addr = el('input', 'input'), base = el('input', 'input input--sm'), adder = el('input', 'input input--sm'), gen = el('input', 'input input--sm'), save = btn('Зберегти'), msg = el('p', 'hint');
      name.value = s.name; addr.value = s.address || ''; base.type = adder.type = gen.type = 'number'; base.step = adder.step = '0.01'; gen.step = '1';
      base.value = tf.base || F.HOME_BASE; adder.value = tf.adder || 0; gen.value = s.gen_cost || 25; save.type = 'submit';
      var kinds = seg(Object.keys(F.TARIFFS).map(function(k){ return [k, F.TARIFFS[k]]; }), tf.kind, function(k){ tf.kind = k; syncT(); }, 'seg--sm');
      var fb = lab('Ціна кВт·год, ₴ з ПДВ', base), fa = lab('Розподіл і націнка постачальника, ₴/кВт·год', adder), note = el('p', 'hint');
      f.append(lab('Назва', name), lab('Адреса', addr), el('span', 'lbl', 'Як рахує постачальник'), kinds, fb, fa, note, lab('Кіловат-година від генератора, ₴ — для оцінки резерву', gen), save, msg);
      p.appendChild(f);
      function syncT(){ fb.hidden = tf.kind === 'dam'; fa.hidden = tf.kind !== 'dam';
        note.textContent = { two: 'Ніч 23:00–7:00 — половина ціни. Накопичувач заряджається вночі й живить об’єкт удень.', three: 'Ніч ×0,4, пік 8–11 і 20–22 ×1,5. Найбільша різниця для домашніх тарифів.', fixed: 'Ціна однакова цілодобово: на тарифі не заробити, лише резерв. Радимо режим «Резерв».', dam: 'Погодинні ціни ринку на добу наперед + передача «Укренерго». Найбільша різниця між дешевими й дорогими годинами.' }[tf.kind]; }
      syncT();
      if (!can) $$('input, button', f).forEach(function(x){ x.disabled = true; });
      f.addEventListener('submit', function(e){ e.preventDefault(); save.disabled = true; msg.textContent = '';
        A.saveSite(s.id, { name: name.value, address: addr.value, tariff: { kind: tf.kind, base: +base.value, adder: +adder.value }, gen_cost: +gen.value }).then(function(r){
          site.name = r.name; sites.forEach(function(x){ if (x.id === r.id) x.name = r.name; }); $$('#cabSite option').forEach(function(o){ if (o.value === r.id) o.textContent = r.name; }); head(); S.toast('Збережено. Гроші перераховано за новим тарифом');
        }, function(x){ msg.textContent = A.message(x); }).then(function(){ save.disabled = false; }); });
      return p;
    }
    function accessBox(s){
      var p = panel('Доступ до об’єкта', 'cab-set'), ul = el('ul', 'list');
      (s.members || []).forEach(function(m){ var li = el('li'), a = el('div'); a.append(el('b', '', m.name || m.login || '—'), el('small', '', m.login || '')); li.append(a, el('span', 'badge', ROLE[m.role] || m.role)); ul.appendChild(li); });
      (s.invites || []).forEach(function(i){ var li = el('li'), a = el('div'), rm = el('button', 'rqi__rm', '×'); rm.type = 'button'; rm.setAttribute('aria-label', 'Скасувати запрошення');
        a.append(el('b', '', i.login), el('small', '', 'запрошення · доступ з’явиться після першого входу')); rm.addEventListener('click', function(){ A.removeInvite(s.id, i.id).then(function(){ show('settings', ''); }, function(x){ S.toast(A.message(x)); }); });
        li.append(a, el('span', 'badge', ROLE[i.role] || i.role), rm); ul.appendChild(li); });
      p.appendChild(ul);
      var f = el('form', 'form invite'), login = el('input', 'input input--sm'), role = sel([['viewer', 'Перегляд'], ['manager', 'Керує'], ['owner', 'Власник']], 'viewer'), go = btn('Дати доступ'), msg = el('p', 'hint');
      login.placeholder = '+380 або пошта'; login.required = true; go.type = 'submit';
      f.append(el('span', 'lbl', 'Додати людину — голову правління, бухгалтера, інженера'), login, role, go, msg); p.appendChild(f);
      f.addEventListener('submit', function(e){ e.preventDefault(); A.invite(s.id, login.value, role.value).then(function(){ S.toast('Доступ надано'); show('settings', ''); }, function(x){ msg.textContent = A.message(x); }); });
      p.appendChild(el('p', 'hint', 'Перегляд — бачить техніку, енергію й гроші. Керує — ще й змінює режими. Власник — ще й дає доступ іншим.'));
      return p;
    }
  }
})();
