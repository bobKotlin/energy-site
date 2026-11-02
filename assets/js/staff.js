/* =====================================================================
   The panel of the team (admin.html). Roles: Менеджер (staff) and Адмін.
   Managers: requests and orders — the manager in charge, final prices,
   statuses, notes, the chat with the client; clients' sites; equipment put
   on a site after installation (that is what appears in the client's
   cabinet, with control). Admins also: people — account data, sign-ins,
   roles, blocking — and the journal of what the team changed.
   Works only on the platform: it needs the backend. Ukrainian only.
   Layout: short labels, counts as badges, flags as tags, no prose.
   ===================================================================== */
(function(){
  'use strict';
  var S = window.Site, A = window.Api, P = window.PRODUCTS;
  var d = document, $ = function(s, r){ return (r || d).querySelector(s); }, $$ = function(s, r){ return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  if (d.body.dataset.page !== 'admin' || !A) return;
  var view = $('#admView'), tabs = $$('#admTabs [role=tab]'), me = null, tab = 'orders', pick = null;
  var nf = S.nf, STATUS = { new: 'Заявка', survey: 'Огляд об’єкта', offer: 'Пропозиція', contract: 'Договір', paid: 'Оплачено', delivered: 'Доставлено', installed: 'Змонтовано', done: 'Працює', cancelled: 'Скасовано' };
  /* the colour of a status chip: new — needs attention, in progress, done */
  var STC = { new: 'warn', survey: 'now', offer: 'now', contract: 'now', paid: 'ok', delivered: 'ok', installed: 'ok', done: 'ok', cancelled: '' };
  var SEG = { flat: 'Квартира', home: 'Дім', osbb: 'ОСББ', biz: 'Бізнес' }, ROLE = { client: 'Користувач', staff: 'Менеджер', admin: 'Адмін' }, isAdmin = false;
  var MROLE = { owner: 'Власник', manager: 'Керує', viewer: 'Перегляд' };
  function el(tag, cls, text){ var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(text, cls){ var b = el('button', 'btn ' + (cls || 'btn--volt btn--sm')); b.type = 'button'; b.appendChild(el('span', '', text)); return b; }
  /* a panel heading with its count as a badge */
  function head(title, n){ var h = el('h3', '', title); if (n != null) h.appendChild(el('span', 'adm-n', String(n))); return h; }
  function panel(title, n){ var p = el('section', 'panel box cab-p'); if (title) p.appendChild(head(title, n)); return p; }
  function tag(text, kind, title){ var t = el('span', 'adm-tag' + (kind ? ' adm-tag--' + kind : ''), text); if (title) t.title = title; return t; }
  function tags(list){ var w = el('div', 'adm-tags'); list.forEach(function(t){ if (t) w.appendChild(t); }); return w.children.length ? w : null; }
  function chip(s){ return el('span', 'chipst' + (STC[s] ? ' chipst--' + STC[s] : ''), STATUS[s] || s); }
  function kv(rows){ var w = el('div', 'kv adm-kv'); rows.forEach(function(x){ if (x[1] == null || x[1] === '') return; var r = el('div', x[2] ? 'adm-kv__w' : ''); r.append(el('span', '', x[0]), typeof x[1] === 'string' ? el('b', '', x[1]) : x[1]); w.appendChild(r); }); return w; }
  function photo(img, cls){ if (!img) return el('span', 'it__ic', '⚡'); var f = el('figure', 'ph ' + cls); f.style.background = img.bg; var i = d.createElement('img'); i.src = S.asset(img.src); i.alt = ''; i.loading = 'lazy'; i.decoding = 'async'; f.appendChild(i); return f; }
  function uah(v){ return v == null ? 'за запитом' : nf(Math.round(v)) + ' ₴'; }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function dt(t){ if (!t) return '—'; var x = new Date(t); return pad(x.getDate()) + '.' + pad(x.getMonth() + 1) + '.' + x.getFullYear() + ' ' + pad(x.getHours()) + ':' + pad(x.getMinutes()); }
  /* short date for lists: «12.10 14:30» this year, «12.10.2025» before */
  function dd(t){ if (!t) return '—'; var x = new Date(t); return x.getFullYear() === new Date().getFullYear() ? pad(x.getDate()) + '.' + pad(x.getMonth() + 1) + ' ' + pad(x.getHours()) + ':' + pad(x.getMinutes()) : pad(x.getDate()) + '.' + pad(x.getMonth() + 1) + '.' + x.getFullYear(); }
  function input(val, ph, type){ var i = el('input', 'input input--sm'); if (type) i.type = type; if (val != null) i.value = val; if (ph) i.placeholder = ph; return i; }
  function sel(opts, val){ var s = el('select', 'input input--sm'); opts.forEach(function(o){ var x = el('option', '', o[1]); x.value = o[0]; if (String(o[0]) === String(val)) x.selected = true; s.appendChild(x); }); return s; }
  function lab(t, ctl){ var w = el('label', 'ctl__f'); w.append(el('span', 'lbl', t), ctl); return w; }
  function more(title, body, open){ var w = el('details', 'adm-new'); w.appendChild(el('summary', '', title)); w.appendChild(body); if (open) w.open = true; return w; }
  function msgOf(e){ return A.message(e); }
  function put(nodes){ view.textContent = ''; nodes.forEach(function(n){ if (n) view.appendChild(n); }); }
  function note(t, s, href){ var p = el('div', 'panel box cab-empty'); p.appendChild(el('h3', '', t)); if (s) p.appendChild(el('p', 'hint', s)); if (href) { var w = el('div', 'hero__cta'), a = el('a', 'btn btn--ghost btn--sm', href[0]); a.href = href[1]; w.appendChild(a); p.appendChild(w); } return p; }

  if (A.mode !== 'live' || !A.staff) { put([note('Панель — лише на платформі', 'Тут статична копія без сервера.', ['Демо-кабінет', 'login.html'])]); return; }
  /* replies go by e-mail too only once the site sends letters (a domain + Resend) */
  var mailOn = false; A.config().then(function(c){ mailOn = !!(c && c.mail); }, function(){});
  A.me().then(function(r){
    me = r.user; $('#admWho').textContent = me.name || me.email || me.phoneText || '';
    if (!me.staff) { put([note('Немає доступу', 'Лише для менеджерів і адмінів.', ['Мій кабінет', 'account.html'])]); return; }
    if (!me.verified) { put([note('Підтвердьте пошту', 'Посилання — у листі.', ['Мій кабінет', 'account.html'])]); return; }
    isAdmin = me.role === 'admin';
    $('#admTitle').textContent = isAdmin ? 'Адмін-панель' : 'Панель менеджера';
    /* people and the journal are an admin's */
    tabs.forEach(function(t){ if ((t.dataset.tab === 'users' || t.dataset.tab === 'audit') && !isAdmin) t.hidden = true; t.addEventListener('click', function(){ show(t.dataset.tab); }); });
    var h = location.hash.replace('#', '').split('='), first = (isAdmin ? ['orders', 'sites', 'users', 'audit'] : ['orders', 'sites']).indexOf(h[0]) >= 0 ? h[0] : 'orders';
    if (first !== 'orders') A.staff.summary().then(function(s){ meta(s, null); }, function(){});
    show(first, h[1]);
  }, function(e){ if (e.status === 401) location.replace('login.html?next=admin.html'); else put([note('Не вдалося завантажити', msgOf(e))]); });

  function show(t, arg, quiet){
    tab = t; pick = arg || null;
    tabs.forEach(function(x){ var on = x.dataset.tab === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; });
    history.replaceState(null, '', '#' + t + (pick ? '=' + pick : ''));
    if (!quiet) view.classList.add('is-loading');
    ({ orders: orders, sites: sites, users: users, audit: journal })[t]().then(function(){ view.classList.remove('is-loading'); }, function(e){ view.classList.remove('is-loading'); put([note('Не вдалося завантажити', msgOf(e))]); });
  }
  /* the counts under the title: sites, accounts, gateways; offline and unread only when there are any */
  function meta(sum, unread){
    var m = $('#admMeta'); if (!m) return; m.textContent = '';
    [['Об’єкти', sum.sites], ['Акаунти', sum.users], ['Шлюзи', sum.gateways], ['Без зв’язку', sum.offline, 'warn'], ['Нові повідомлення', unread && unread.total, 'new']].forEach(function(x){
      if (x[2] && !x[1]) return;
      var k = el('span', 'adm-k' + (x[2] ? ' adm-k--' + x[2] : '')); k.append(el('span', '', x[0]), el('b', '', String(x[1] || 0))); m.appendChild(k);
    });
  }

  /* ---------------- orders ---------------- */
  var filt = { status: 'new', q: '', mine: false }, teamList = null;
  function teamOf(){ return teamList ? Promise.resolve(teamList) : A.staff.team().then(function(t){ teamList = t; return t; }); }
  function orders(){
    return Promise.all([A.staff.summary(), A.staff.orders({ status: filt.status, q: filt.q, mine: filt.mine ? 1 : null }), A.staff.unread().catch(function(){ return { total: 0, orders: {} }; })]).then(function(r){
      var sum = r[0], list = r[1], unread = r[2] || { total: 0, orders: {} }, tiles = el('div', 'adm-sum');
      meta(sum, unread);
      /* the status tiles are also the filter */
      ['new', 'survey', 'offer', 'contract', 'paid', 'installed'].forEach(function(k){
        var n = sum.orders[k] || 0, on = filt.status === k, t = el('button', 'tile adm-st' + (on ? ' is-on' : '') + (k === 'new' && n ? ' tile--hero' : ''));
        t.type = 'button'; t.setAttribute('aria-pressed', String(on)); t.append(el('span', '', STATUS[k]), el('b', '', String(n)));
        t.addEventListener('click', function(){ filt.status = on ? '' : k; show('orders'); });
        tiles.appendChild(t);
      });
      var bar = el('div', 'adm-find'), st = sel([['', 'Усі']].concat(Object.keys(STATUS).map(function(k){ return [k, STATUS[k]]; })), filt.status), q = input(filt.q, 'Номер, ім’я, телефон, об’єкт');
      st.addEventListener('change', function(){ filt.status = st.value; show('orders'); });
      var mineL = el('label', 'rq__opt'), mineC = el('input'); mineC.type = 'checkbox'; mineC.checked = filt.mine; mineL.append(mineC, el('span', '', 'Лише мої'));
      mineC.addEventListener('change', function(){ filt.mine = mineC.checked; show('orders'); });
      q.addEventListener('keydown', function(e){ if (e.key === 'Enter') { filt.q = q.value.trim(); show('orders'); } });
      st.setAttribute('aria-label', 'Статус'); q.setAttribute('aria-label', 'Пошук');
      bar.append(q, st, mineL);
      var grid = el('div', 'adm-grid'), lp = panel('Заявки', list.length), ul = el('ul', 'adm-list'), detail = el('div', 'cab-col');
      lp.appendChild(bar);
      list.forEach(function(o){
        var li = el('li', o.id === pick ? 'is-on' : ''), c = o.contact || {}, n = unread.orders[o.id] || 0, name = el('b');
        name.append(el('span', 'adm-no', o.number), d.createTextNode(c.name || '—'));
        var meta0 = el('small', 'adm-m', [dd(o.created_at), SEG[o.segment], o.region].filter(Boolean).join(' · '));
        li.append(name, chip(o.status), meta0, el('span', 'adm-v', uah(o.total)));
        var tg = tags([n ? tag('💬 ' + n, 'new', 'Нові повідомлення') : null, o.source === 'ai' ? tag('план AI', 'ai') : null,
          o.manager_name ? tag(o.manager_name, '', 'Менеджер') : o.manager_id ? null : tag('без менеджера', 'warn'),
          o.user_id ? null : tag('без акаунта'), o.total != null && !o.priced ? tag('+ за запитом') : null]);
        if (tg) li.appendChild(tg);
        li.addEventListener('click', function(){ pick = o.id; $$('li', ul).forEach(function(x){ x.classList.toggle('is-on', x === li); }); history.replaceState(null, '', '#orders=' + o.id); openOrder(o.id, detail); });
        ul.appendChild(li);
      });
      if (!list.length) ul.appendChild(el('li', 'hint', 'Нічого не знайдено'));
      lp.appendChild(ul); grid.append(lp, detail); put([tiles, grid]);
      if (pick) openOrder(pick, detail); else if (list[0]) { pick = list[0].id; ul.firstChild.classList.add('is-on'); openOrder(pick, detail); }
    });
  }
  function openOrder(id, box){
    box.textContent = ''; box.appendChild(el('p', 'hint', 'Завантажуємо…'));
    A.staff.order(id).then(function(r){ drawOrder(r, box); }, function(e){ box.textContent = ''; box.appendChild(note('Не вдалося відкрити', msgOf(e))); });
  }
  function drawOrder(r, box){
    var o = r.order, c = o.contact || {}, p = panel(null), h = el('div', 'cab-p__h');
    h.append(el('h3', '', o.number), chip(o.status), el('span', 'muted mono', dt(o.created_at))); p.appendChild(h);
    var tel = null; if (c.phone) { tel = el('a', 'link', c.phone); tel.href = 'tel:' + String(c.phone).replace(/[^\d+]/g, ''); }
    var opts = tags([tag(o.install ? 'монтаж' : 'без монтажу'), o.options && o.options.survey ? tag('огляд об’єкта') : null]);
    p.appendChild(kv([['Клієнт', c.name || '—'], ['Телефон', tel], ['Пошта', c.email || null], ['Об’єкт', r.site ? r.site.name : '—'], ['Тип', SEG[o.segment] || null], ['Регіон', o.region || null], ['Опції', opts, 1]]));
    /* the manager in charge: take it, give it back; an admin assigns anyone */
    var mrow = el('div', 'adm-mgr'), mmsg = el('p', 'hint');
    mrow.append(el('span', 'lbl', 'Менеджер'), o.manager_name ? el('b', '', o.manager_name) : tag('немає', 'warn'));
    if (o.manager_id !== me.id) { var take = btn('Взяти заявку', 'btn--ghost btn--sm'); take.addEventListener('click', function(){ setManager('me'); }); mrow.appendChild(take); }
    else { var drop = btn('Зняти себе', 'btn--ghost btn--sm'); drop.addEventListener('click', function(){ setManager(null); }); mrow.appendChild(drop); }
    if (isAdmin) teamOf().then(function(t){ var s2 = sel([['', '— призначити —']].concat(t.map(function(x){ return [x.id, x.name + ' · ' + ROLE[x.role]]; })), ''); s2.addEventListener('change', function(){ if (s2.value) setManager(s2.value); }); mrow.appendChild(s2); });
    p.append(mrow, mmsg);
    function setManager(v){ A.staff.saveOrder(o.id, { manager_id: v }).then(function(x){ S.toast('Збережено'); drawOrder(x, box); }, function(e){ mmsg.textContent = msgOf(e); }); }
    if (o.message) { var qm = el('div', 'adm-quote'); qm.append(el('small', '', o.source === 'ai' ? 'План AI' : 'Коментар клієнта'), el('p', '', o.message)); p.appendChild(qm); }
    /* a request without an account: it links itself once the client confirms the e-mail; or link it here */
    if (!o.user_id) {
      var lk = el('div', 'adm-link'), ll = el('span', 'lbl', 'Прив’язати до акаунта'), le = input(c.email || '', 'Пошта акаунта', 'email'), lb = btn('Прив’язати', 'btn--ghost btn--sm'), lm = el('p', 'hint');
      ll.title = 'Або прив’яжеться сама, коли клієнт підтвердить пошту з заявки';
      lk.append(ll, le, lb, lm); p.appendChild(lk);
      lb.addEventListener('click', function(){ lb.disabled = true; lm.textContent = ''; A.staff.saveOrder(o.id, { user_email: le.value.trim() }).then(function(x){ S.toast('Прив’язано'); drawOrder(x, box); }, function(e){ lm.textContent = msgOf(e); lb.disabled = false; }); });
    }
    /* lines with final prices */
    var t = el('table', 'tbl adm-items'), th = el('thead'), tr = el('tr'), tb = el('tbody'), edits = {};
    ['Позиція', 'К-сть', 'Ціна, ₴', ''].forEach(function(x){ tr.appendChild(el('th', '', x)); }); th.appendChild(tr);
    o.items.forEach(function(it){
      var row = el('tr'), q = input(it.qty, '', 'number'), pr = input(it.price_uah, 'за запитом', 'number'), rm = el('button', 'rqi__rm', '×');
      q.min = 1; q.style.width = '64px'; pr.min = 0; rm.type = 'button'; rm.setAttribute('aria-label', 'Прибрати позицію');
      var nm = el('td'); nm.append(el('b', '', it.name), el('small', 'muted', [it.sub, it.grp].filter(Boolean).join(' · ')));
      function mark(){ edits[it.id] = { id: it.id, qty: +q.value, price_uah: pr.value === '' ? null : +pr.value }; }
      q.addEventListener('input', mark); pr.addEventListener('input', mark);
      rm.addEventListener('click', function(){ edits[it.id] = { id: it.id, remove: true }; row.style.opacity = .35; });
      row.append(nm, cell(q), cell(pr), cell(rm)); tb.appendChild(row);
    });
    var tf = el('tfoot'), tfr = el('tr'); tfr.append(el('td', '', 'Разом'), el('td'), el('td', 'mono', uah(o.total) + (o.total != null && !o.priced ? ' + за запитом' : '')), el('td')); tf.appendChild(tfr);
    t.append(th, tb, tf); var tw = el('div', 'tblw'); tw.appendChild(t); p.appendChild(tw);
    function cell(x){ var c2 = el('td'); c2.appendChild(x); return c2; }
    var adds = [], addBox = el('div', 'adm-form adm-addbox'), addBtn = btn('+ позиція', 'btn--ghost btn--sm adm-add');
    addBtn.addEventListener('click', function(){
      var kind = sel([['install', 'Монтаж'], ['delivery', 'Доставка'], ['service', 'Послуга'], ['equipment', 'Обладнання']], 'install'), prod = sel([['', '— з каталогу —']].concat(P.list.map(function(x){ return [x.id, x.maker + ' ' + x.model + ' — ' + x.name]; })), ''),
        nm = input('', 'Назва'), q = input(1, '', 'number'), pr = input('', 'Ціна за од., ₴', 'number'), row = el('div', 'row');
      prod.addEventListener('change', function(){ var x = P.byId(prod.value); if (x) { nm.value = x.name; kind.value = 'equipment'; if (x.price != null) pr.value = x.price; } });
      row.append(kind, prod); var row2 = el('div', 'row'); row2.append(nm, q); addBox.append(row, row2, pr);
      adds.push(function(){ return nm.value.trim() ? { kind: kind.value, product_id: prod.value || null, name: nm.value.trim(), qty: +q.value || 1, price_uah: pr.value === '' ? null : +pr.value } : null; });
    });
    p.append(addBox, addBtn);
    var stS = sel(Object.keys(STATUS).map(function(k){ return [k, STATUS[k]]; }), o.status), nt = input('', 'Видно в історії'), save = btn('Зберегти'), msg = el('p', 'hint');
    var fr = el('div', 'adm-form'), r1 = el('div', 'row'); r1.append(lab('Статус', stS), lab('Примітка', nt)); fr.append(r1, save, msg); p.appendChild(fr);
    save.addEventListener('click', function(){
      save.disabled = true; msg.textContent = '';
      A.staff.saveOrder(o.id, { status: stS.value, note: nt.value.trim() || undefined, items: Object.keys(edits).map(function(k){ return edits[k]; }), add: adds.map(function(f){ return f(); }).filter(Boolean) })
        .then(function(x){ S.toast('Збережено'); drawOrder(x, box); }, function(e){ msg.textContent = msgOf(e); save.disabled = false; });
    });
    if (o.log && o.log.length) { var tl = el('ol', 'tline'); o.log.forEach(function(x){ var li = el('li'); li.append(el('b', '', STATUS[x.status] || x.status), el('span', 'mono muted', dt(x.at))); if (x.note) li.appendChild(el('small', 'muted', x.note)); tl.appendChild(li); }); p.appendChild(tl); }
    var go = el('a', 'link', r.devices && r.devices.length ? 'Техніка: ' + r.devices.length + ' →' : 'Додати техніку →'); go.href = '#sites=' + (r.site ? r.site.id : '');
    go.addEventListener('click', function(e){ e.preventDefault(); if (r.site) show('sites', r.site.id); });
    p.appendChild(go);
    box.textContent = ''; box.append(p, chatBox(o));
  }
  /* the chat with the client: the team's replies go to the client's e-mail when unread */
  var chatT = 0;
  S.page.leave(function(){ clearInterval(chatT); });
  /* a list changed on the server (api.js keeps answers for the tab and asks again in the background):
     redraw the open section in place, unless someone is typing there */
  document.addEventListener('api:fresh', function(e){
    var p = e.detail && e.detail.path || '', a = document.activeElement;
    if (!tab || p.indexOf('/staff/') !== 0 || p === '/staff/pulse') return;
    if (a && view.contains(a) && /^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName)) return;
    if ([].some.call(view.querySelectorAll('textarea'), function(x){ return x.value.trim(); })) return;
    show(tab, pick, true);
  }, { signal: S.page.signal });
  document.addEventListener('api:signedout', function(){ location.replace('login.html?next=admin.html'); }, { signal: S.page.signal });
  function chatBox(o){
    var p = panel('Чат з клієнтом'), list = el('div', 'ochat__list'), f = el('form', 'ochat__f'), ta = el('textarea', 'textarea'), go = btn('Надіслати'), last = 0, seen = {};
    var SYS = { '@new': 'Авто: заявку прийнято', '@plan': 'Авто: план AI отримано' };
    ta.rows = 2; ta.maxLength = 2000; ta.placeholder = mailOn ? 'Відповідь — у кабінет і на пошту' : 'Відповідь — у кабінет клієнта'; go.type = 'submit'; f.append(ta, go);
    p.classList.add('ochat'); p.append(list, f);
    function bubble(m){ if (seen[m.id]) return; seen[m.id] = 1; last = Math.max(last, m.id);
      var b = el('div', 'msg2 ' + (m.system ? 'msg2--sys' : m.staff ? 'msg2--me' : 'msg2--them'));
      if (!m.system) b.appendChild(el('small', 'msg2__who', m.staff ? (m.author || 'Команда') + (m.mine ? ' (ви)' : '') : (m.author || 'Клієнт')));
      b.appendChild(el('p', '', m.system ? (SYS[m.body] || m.body) : m.body)); b.appendChild(el('small', 'msg2__t', dt(m.at))); list.appendChild(b); }
    function load(){ return A.staff.messages(o.id, last || null).then(function(r){ var n = (r.messages || []).filter(function(m){ return !seen[m.id]; }); n.forEach(bubble); if (n.length) list.scrollTop = list.scrollHeight; }, function(){}); }
    f.addEventListener('submit', function(e){ e.preventDefault(); var t = ta.value.trim(); if (!t) return; go.disabled = true;
      A.staff.send(o.id, t).then(function(){ ta.value = ''; return load(); }, function(x){ S.toast(msgOf(x)); }).then(function(){ go.disabled = false; }); });
    ta.addEventListener('keydown', function(e){ if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) { e.preventDefault(); f.requestSubmit ? f.requestSubmit() : go.click(); } });
    load(); clearInterval(chatT); chatT = setInterval(function(){ if (!d.body.contains(p)) { clearInterval(chatT); return; } if (d.visibilityState === 'visible') load(); }, 15000);
    return p;
  }

  /* ---------------- sites and equipment ---------------- */
  var sq = '';
  function sites(){
    return A.staff.sites({ q: sq }).then(function(list){
      var grid = el('div', 'adm-grid'), lp = panel('Об’єкти', list.length), find = el('div', 'adm-find'), q = input(sq, 'Назва або адреса'), ul = el('ul', 'adm-list'), detail = el('div', 'cab-col');
      q.addEventListener('keydown', function(e){ if (e.key === 'Enter') { sq = q.value.trim(); show('sites'); } });
      q.setAttribute('aria-label', 'Пошук'); find.appendChild(q); lp.append(find, ul);
      list.forEach(function(s){ var li = el('li', s.id === pick ? 'is-on' : ''), sys = el('span', 'adm-v', '⚡ ' + (s.systems || 0)); sys.title = 'Систем на об’єкті';
        li.append(el('b', '', s.name), el('span', 'badge', SEG[s.segment] || s.segment), el('small', 'adm-m', s.owner || 'без власника'), sys);
        li.addEventListener('click', function(){ pick = s.id; $$('li', ul).forEach(function(x){ x.classList.toggle('is-on', x === li); }); history.replaceState(null, '', '#sites=' + s.id); openSite(s.id, detail); }); ul.appendChild(li); });
      if (!list.length) ul.appendChild(el('li', 'hint', 'Нічого не знайдено'));
      lp.appendChild(more('+ Новий об’єкт', newSite(), !list.length && !sq));
      grid.append(lp, detail); put([grid]);
      if (pick) openSite(pick, detail);
    });
  }
  function newSite(){
    var f = el('form', 'adm-form'), name = input('', 'Назва, напр. ОСББ «Сонячне»'), seg = sel(Object.keys(SEG).map(function(k){ return [k, SEG[k]]; }), 'osbb'), addr = input('', 'Адреса'), owner = input('', 'Пошта власника', 'email'), oname = input('', 'Ім’я власника'), go = btn('Створити'), msg = el('p', 'hint');
    go.type = 'submit'; name.required = true; var r1 = el('div', 'row'); r1.append(seg, addr); var r2 = el('div', 'row'); r2.append(owner, oname);
    f.append(name, r1, r2, go, msg);
    f.addEventListener('submit', function(e){ e.preventDefault(); msg.textContent = ''; A.staff.createSite({ name: name.value, segment: seg.value, address: addr.value, owner: owner.value || undefined, owner_name: oname.value }).then(function(x){ S.toast('Об’єкт створено'); pick = x.site.id; show('sites', x.site.id); }, function(er){ msg.textContent = msgOf(er); }); });
    return f;
  }
  function openSite(id, box){
    box.textContent = ''; box.appendChild(el('p', 'hint', 'Завантажуємо…'));
    return A.staff.site(id).then(function(r){ drawSite(r, box); return true; }, function(e){ box.textContent = ''; box.appendChild(note('Не вдалося відкрити', msgOf(e))); return false; });
  }
  /* a gateway's link as a status chip; the last report in its tooltip */
  function linkChip(x){
    if (x.driver !== 'gateway') return el('span', 'chipst', 'симуляція');
    var on = x.status === 'online', c = el('span', 'chipst ' + (on ? 'chipst--ok' : 'chipst--warn'), on ? 'на зв’язку' : 'немає зв’язку');
    if (x.last_seen_at) c.title = 'Останні дані: ' + dt(x.last_seen_at);
    return c;
  }
  function drawSite(r, box){
    var s = r.site, p = panel(null), h = el('div', 'cab-p__h'), cab = el('a', 'link', 'Кабінет об’єкта →');
    cab.href = 'account.html?site=' + encodeURIComponent(s.id);
    h.append(el('h3', '', s.name), el('span', 'badge', SEG[s.segment] || s.segment), cab); p.appendChild(h);
    p.appendChild(kv([['Адреса', s.address || '—'], ['Регіон', s.region || null]]));
    var m = el('ul', 'list'); r.members.forEach(function(x){ var li = el('li'), a = el('div'); a.append(el('b', '', x.name || '—'), el('small', '', x.phone || x.email || '')); li.append(a, el('span', 'badge', MROLE[x.role] || x.role)); m.appendChild(li); });
    if (!r.members.length) m.appendChild(el('li', 'hint', 'Власника ще немає'));
    p.append(el('span', 'lbl adm-lbl', 'Доступ'), m);
    var systems = r.devices.filter(function(x){ return !x.parent_id; }), dp = panel('Техніка', systems.length);
    systems.forEach(function(x){
      var li = el('div', 'comp adm-dev'), b = el('div', 'comp__b'), top = el('div', 'adm-dev__h'), rm = el('button', 'rqi__rm', '×'); rm.type = 'button'; rm.setAttribute('aria-label', 'Прибрати ' + x.name);
      top.append(el('b', '', x.name), linkChip(x));
      if (x.driver === 'gateway' && x.status !== 'online' && x.last_seen_at) { var ls = el('small', 'mono muted', dd(x.last_seen_at)); ls.title = 'Останні дані'; top.appendChild(ls); }
      b.appendChild(top);
      if (x.model) b.appendChild(el('small', 'muted', x.model));
      var tg = tags([x.serial ? tag('№ ' + x.serial) : null, tag(nf(x.spec.kwh || 0, 2) + ' кВт·год')]); if (tg) b.appendChild(tg);
      r.devices.filter(function(c){ return c.parent_id === x.id; }).forEach(function(c){ b.appendChild(el('small', 'muted', '↳ ' + c.name + (c.serial ? ' · № ' + c.serial : ''))); });
      if (x.driver === 'gateway') { var acts = el('div', 'chips'), sk = el('button', 'chip', 'Новий ключ шлюзу'); sk.type = 'button'; sk.addEventListener('click', function(){ if (!confirm('Старий ключ перестане працювати. Створити новий?')) return; A.staff.secret(x.id).then(function(z){ secretBox(dp, z.secret); }, function(e){ S.toast(msgOf(e)); }); }); acts.appendChild(sk); b.appendChild(acts); }
      rm.addEventListener('click', function(){ if (!confirm('Прибрати «' + x.name + '» разом з історією даних?')) return; A.staff.removeDevice(x.id).then(function(){ openSite(s.id, box); }, function(e){ S.toast(msgOf(e)); }); });
      li.append(photo(x.img, 'comp__ph'), b, rm); dp.appendChild(li);
    });
    if (!systems.length) dp.appendChild(el('p', 'hint', 'Техніки ще немає'));
    dp.appendChild(more('+ Додати техніку', addDevice(r, box), !systems.length));
    var ol = r.orders || [], op = panel('Замовлення', ol.length), ul = el('ul', 'list');
    ol.forEach(function(o){ var li = el('li'), a = el('a', 'link', o.number), l = el('div'); a.href = '#orders=' + o.id; a.addEventListener('click', function(e){ e.preventDefault(); show('orders', o.id); }); l.append(a, el('small', 'mono', uah(o.total))); li.append(l, chip(o.status)); ul.appendChild(li); });
    if (!ol.length) ul.appendChild(el('li', 'hint', 'Замовлень немає'));
    op.appendChild(ul);
    box.textContent = ''; box.append(p, dp, op);
  }
  /* the gateway key is shown once: copy button and the header the gateway sends it in */
  function secretBox(host, secret){
    var w = el('div', 'adm-key'), hd = el('div', 'adm-key__h'), cp = el('button', 'chip', 'Копіювати'); cp.type = 'button';
    cp.addEventListener('click', function(){ (navigator.clipboard ? navigator.clipboard.writeText(secret) : Promise.reject()).then(function(){ S.toast('Скопійовано'); }, function(){ S.toast('Скопіюйте вручну'); }); });
    hd.append(el('span', 'lbl', 'Ключ шлюзу'), tag('показуємо один раз', 'warn'), cp);
    w.append(hd, el('div', 'adm-secret', secret), el('small', 'mono muted', 'POST /api/ingest · Authorization: Device <ключ>'));
    host.insertBefore(w, host.children[1] || null);
  }
  function addDevice(r, box){
    var f = el('form', 'adm-form'), s = r.site, systems = r.devices.filter(function(x){ return !x.parent_id; });
    var cats = { aio: 'Моноблок', inverter: 'Інвертор', battery: 'Батарея', hv: 'Високовольтна стійка', portable: 'Портативна станція' };
    var prod = sel([['', '— модель —']].concat(P.list.filter(function(x){ return cats[x.cat]; }).map(function(x){ return [x.id, cats[x.cat] + ': ' + x.maker + ' ' + x.model]; })), ''), vari = sel([['', '— варіант —']], ''), serial = input('', 'Серійний номер'), driver = sel([['gateway', 'Шлюз — реальні дані'], ['sim', 'Симуляція — демо']], 'gateway');
    var parent = sel([['', '— окрема система —']].concat(systems.map(function(x){ return [x.id, 'до системи: ' + x.name + (x.serial ? ' № ' + x.serial : '')]; })), ''), lines = [['', '— рядок замовлення —']];
    (r.orders || []).forEach(function(o){ (o.items || []).filter(function(it){ return it.kind === 'equipment'; }).forEach(function(it){ lines.push([it.id, o.number + ': ' + it.name + ' × ' + it.qty]); }); });
    var item = sel(lines, ''), when = input(new Date().toISOString().slice(0, 10), '', 'date'), war = input('', 'з даташиту', 'number'), go = btn('Додати'), msg = el('p', 'hint');
    go.type = 'submit'; item.title = 'Для гарантії й ціни';
    prod.addEventListener('change', function(){ var x = P.byId(prod.value); vari.textContent = ''; var o0 = el('option', '', '— варіант —'); o0.value = ''; vari.appendChild(o0);
      (x && x.variants || []).forEach(function(v){ var o = el('option', '', v.model); o.value = v.model; vari.appendChild(o); }); vari.disabled = !(x && x.variants);
      var bat = x && (x.cat === 'battery' || x.cat === 'hv'); parent.required = bat; if (bat && systems[0] && !parent.value) parent.value = systems[0].id; });
    vari.disabled = true;
    var r1 = el('div', 'row'); r1.append(prod, vari); var r2 = el('div', 'row'); r2.append(serial, driver); var r3 = el('div', 'row'); r3.append(parent, item); var r4 = el('div', 'row'); r4.append(lab('Дата монтажу', when), lab('Гарантія, років', war));
    f.append(r1, r2, r3, r4, go, msg);
    f.addEventListener('submit', function(e){
      e.preventDefault(); msg.textContent = '';
      A.staff.addDevice({ site_id: s.id, product_id: prod.value, variant: vari.value || null, serial: serial.value, driver: driver.value, parent_id: parent.value || null, order_item_id: item.value ? +item.value : null,
        installed_at: when.value ? Date.parse(when.value + 'T12:00:00') : null, warranty_years: war.value ? +war.value : null })
        .then(function(x){
          S.toast('Додано в кабінет клієнта');
          /* the key is shown once: put it on screen only after the panel is rebuilt, or keep it here if the reload fails */
          openSite(s.id, box).then(function(okd){ if (!x.secret) return; secretBox(okd && box.children[1] ? box.children[1] : box, x.secret); });
        }, function(er){ msg.textContent = msgOf(er) + (er.code === 'parent' ? ' Оберіть систему для батареї.' : ''); });
    });
    return f;
  }

  /* ---------------- people (admin) ---------------- */
  var uq = '', urole = '';
  var ACT = { role: 'Роль', block: 'Заблоковано', unblock: 'Розблоковано', sessions: 'Входи завершено', order: 'Заявка', site_create: 'Новий об’єкт', device_add: 'Додано техніку', device_remove: 'Прибрано техніку', device_key: 'Новий ключ шлюзу' };
  var EVC = { role: 'cmd', block: 'warn', unblock: 'out', sessions: 'warn', order: 'cmd', site_create: 'out', device_add: 'out', device_remove: 'warn', device_key: 'cmd' };
  function users(){
    return A.staff.users({ q: uq, role: urole }).then(function(list){
      var grid = el('div', 'adm-grid'), p = panel('Люди', list.length), detail = el('div', 'cab-col');
      var bar = el('div', 'adm-find'), q = input(uq, 'Ім’я, пошта, телефон'), rs = sel([['', 'Усі ролі'], ['client', 'Користувачі'], ['staff', 'Менеджери'], ['admin', 'Адміни']], urole);
      q.addEventListener('keydown', function(e){ if (e.key === 'Enter') { uq = q.value.trim(); show('users'); } });
      rs.addEventListener('change', function(){ urole = rs.value; show('users'); });
      q.setAttribute('aria-label', 'Пошук'); rs.setAttribute('aria-label', 'Роль'); bar.append(q, rs); p.appendChild(bar);
      var ul = el('ul', 'adm-list');
      list.forEach(function(u){
        var li = el('li', u.id === pick ? 'is-on' : ''), seen = el('span', 'adm-v', dd(u.last_login_at)); seen.title = 'Остання активність';
        li.append(el('b', '', u.name || u.email || '—'), el('span', 'badge' + (u.role !== 'client' ? ' badge--new' : ''), ROLE[u.role] || u.role),
          el('small', 'adm-m', (u.name ? u.email : '') || u.phoneText || ''), seen);
        var tg = tags([u.blocked ? tag('заблоковано', 'warn') : null, u.email && !u.verified ? tag('не підтв.', 'warn', 'Пошту не підтверджено') : null, u.google ? tag('Google') : null,
          tag('входи ' + (u.sessions || 0), '', 'Активні входи'), u.orders ? tag('заявки ' + u.orders) : null]);
        if (tg) li.appendChild(tg);
        li.addEventListener('click', function(){ pick = u.id; $$('li', ul).forEach(function(x){ x.classList.toggle('is-on', x === li); }); history.replaceState(null, '', '#users=' + u.id); openUser(u.id, detail); });
        ul.appendChild(li);
      });
      if (!list.length) ul.appendChild(el('li', 'hint', 'Нікого не знайдено'));
      p.appendChild(ul); grid.append(p, detail); put([grid]);
      if (pick) openUser(pick, detail);
    });
  }
  function openUser(id, box){
    box.textContent = ''; box.appendChild(el('p', 'hint', 'Завантажуємо…'));
    A.staff.user(id).then(function(r){ drawUser(r, box); }, function(e){ box.textContent = ''; box.appendChild(note('Не вдалося відкрити', msgOf(e))); });
  }
  function drawUser(r, box){
    var u = r.user, who = u.name || u.email || '—', p = panel(null), h = el('div', 'cab-p__h'), msg = el('p', 'hint');
    h.append(el('h3', '', who), el('span', 'chipst ' + (u.blocked ? 'chipst--warn' : 'chipst--ok'), u.blocked ? 'Заблоковано' : ROLE[u.role])); p.appendChild(h);
    var em = el('b', '', u.email || '—'); if (u.email) em.appendChild(tag(u.verified ? '✓' : 'не підтв.', u.verified ? 'ok' : 'warn', u.verified ? 'Пошту підтверджено' : 'Пошту не підтверджено'));
    p.appendChild(kv([['Пошта', em], ['Вхід', tags([u.password ? tag('пароль') : null, u.google ? tag('Google') : null]) || '—'], ['Телефон', u.phoneText || '—'], ['Мова', u.lang === 'en' ? 'англійська' : 'українська'],
      ['Створено', dt(u.created_at)], ['Активність', dt(u.last_login_at)], ['Заблоковано', u.blocked ? dt(u.blocked_at) : null]]));
    /* the role and blocking */
    var acts = el('div', 'adm-form'), r1 = el('div', 'row'), role = sel(Object.keys(ROLE).map(function(k){ return [k, ROLE[k]]; }), u.role);
    role.disabled = u.id === me.id;
    role.addEventListener('change', function(){ if (!confirm(who + ': змінити роль на «' + ROLE[role.value] + '»?')) { role.value = u.role; return; } A.staff.setRole(u.id, role.value).then(function(x){ S.toast('Роль змінено'); drawUser(x, box); }, function(e){ role.value = u.role; msg.textContent = msgOf(e); }); });
    r1.append(lab('Роль', role));
    if (u.id !== me.id) {
      var bl = btn(u.blocked ? 'Розблокувати' : 'Заблокувати', 'btn--ghost btn--sm');
      bl.addEventListener('click', function(){
        var reason = u.blocked ? '' : prompt('Заблокувати ' + who + '? Усі входи завершаться.\nПричина (у журнал):', '');
        if (reason === null) return;
        A.staff.block(u.id, !u.blocked, reason).then(function(x){ S.toast(u.blocked ? 'Розблоковано' : 'Заблоковано, входи завершено'); drawUser(x, box); }, function(e){ msg.textContent = msgOf(e); });
      });
      var bw = el('div', 'ctl__f'); bw.append(el('span', 'lbl', 'Доступ'), bl); r1.appendChild(bw);
    }
    acts.append(r1, msg); p.appendChild(acts);
    /* where the account is signed in: devices, not tokens */
    var sp = panel('Входи', r.sessions.length), sl = el('ul', 'list');
    r.sessions.forEach(function(x){
      var li = el('li'), a = el('div'), end = el('button', 'rqi__rm', '×'); end.type = 'button'; end.setAttribute('aria-label', 'Завершити цей вхід');
      li.title = 'Вхід ' + dt(x.created_at) + ', діє до ' + dt(x.expires_at);
      a.append(el('b', '', x.ua ? x.ua.replace(/\s*\([^)]*\)\s*/g, ' ').slice(0, 70) : 'Невідомий пристрій'), el('small', '', 'активність ' + dd(x.seen_at)));
      end.addEventListener('click', function(){ A.staff.endSessions(u.id, x.ref).then(function(y){ S.toast('Вхід завершено'); drawUser(y, box); }, function(e){ msg.textContent = msgOf(e); }); });
      li.append(a, end); sl.appendChild(li);
    });
    if (!r.sessions.length) sl.appendChild(el('li', 'hint', 'Активних входів немає'));
    sp.appendChild(sl);
    if (r.sessions.length) { var all = btn('Завершити всі', 'btn--ghost btn--sm'); all.style.marginTop = '12px'; all.addEventListener('click', function(){ A.staff.endSessions(u.id).then(function(y){ S.toast('Усі входи завершено'); drawUser(y, box); }, function(e){ msg.textContent = msgOf(e); }); }); sp.appendChild(all); }
    var op = panel('Заявки', r.orders.length), ol = el('ul', 'list');
    r.orders.forEach(function(o){ var li = el('li'), l = el('div'), a = el('a', 'link', o.number), rt = el('div', 'adm-tags'); a.href = '#orders=' + o.id; a.addEventListener('click', function(e){ e.preventDefault(); filt.status = ''; show('orders', o.id); });
      l.append(a, el('small', 'mono', dd(o.created_at))); if (o.source === 'ai') rt.appendChild(tag('план AI', 'ai')); rt.appendChild(chip(o.status)); li.append(l, rt); ol.appendChild(li); });
    if (!r.orders.length) ol.appendChild(el('li', 'hint', 'Заявок немає'));
    op.appendChild(ol);
    if (r.sites.length) op.append(el('span', 'lbl adm-lbl', 'Об’єкти'), tags(r.sites.map(function(x){ return tag(x.name + ' · ' + (MROLE[x.role] || x.role), '', x.name); })));
    var lp = panel('Журнал', r.audit.length); lp.appendChild(auditList(r.audit));
    box.textContent = ''; box.append(p, sp, op, lp);
  }

  /* ---------------- the journal (admin) ---------------- */
  /* a table: when, who, what (a coloured dot by kind), details as tags */
  function auditList(list){
    if (!list.length) return el('p', 'hint', 'Записів немає');
    var t = el('table', 'tbl adm-log'), th = el('thead'), tr = el('tr'), tb = el('tbody');
    ['Коли', 'Хто', 'Дія', 'Деталі'].forEach(function(x){ tr.appendChild(el('th', '', x)); }); th.appendChild(tr);
    list.forEach(function(a){
      var row = el('tr'), dd0 = a.details || {}, what = el('span', 'adm-ev' + (EVC[a.action] ? ' adm-ev--' + EVC[a.action] : ''), ACT[a.action] || a.action), wc = el('td');
      if (a.action === 'order' && dd0.number) what.appendChild(d.createTextNode(' ' + dd0.number));
      var ch = a.action === 'role' ? (ROLE[dd0.from] || dd0.from) + ' → ' + (ROLE[dd0.to] || dd0.to) : a.action === 'order' && dd0.status ? (STATUS[dd0.status[0]] || dd0.status[0]) + ' → ' + (STATUS[dd0.status[1]] || dd0.status[1]) : '';
      wc.appendChild(what); if (ch) wc.appendChild(el('small', 'adm-ev__ch', ch));
      var det = el('td'), tg = tags([a.action === 'order' && dd0.manager !== undefined ? tag('менеджер') : null, a.action === 'order' && dd0.items ? tag('ціни') : null, a.action === 'order' && dd0.linked ? tag('→ ' + dd0.linked, '', 'Прив’язано до акаунта') : null,
        dd0.email ? tag(dd0.email) : null, dd0.reason ? tag('«' + dd0.reason + '»', 'warn', 'Причина: ' + dd0.reason) : null]);
      if (tg) det.appendChild(tg);
      row.append(el('td', 'mono', dd(a.at)), el('td', '', a.actor), wc, det); tb.appendChild(row);
    });
    t.append(th, tb); var w = el('div', 'tblw'); w.appendChild(t); return w;
  }
  function journal(){
    return A.staff.audit({ limit: 300 }).then(function(list){
      var p = panel('Журнал', list.length); p.appendChild(auditList(list)); put([p]);
    });
  }
})();
