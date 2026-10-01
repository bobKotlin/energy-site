/* =====================================================================
   Team panel (admin.html): requests and orders — final prices, statuses,
   notes; clients' sites; equipment put on a site after installation (that
   is what appears in the client's cabinet, with control); people and
   roles. Works only on the platform: it needs the backend.
   ===================================================================== */
(function(){
  'use strict';
  var S = window.Site, A = window.Api, P = window.PRODUCTS;
  var d = document, $ = function(s, r){ return (r || d).querySelector(s); }, $$ = function(s, r){ return Array.prototype.slice.call((r || d).querySelectorAll(s)); };
  if (d.body.dataset.page !== 'admin' || !A) return;
  var view = $('#admView'), tabs = $$('#admTabs [role=tab]'), me = null, tab = 'orders', pick = null;
  var nf = S.nf, STATUS = { new: 'Заявка', survey: 'Огляд об’єкта', offer: 'Пропозиція', contract: 'Договір', paid: 'Оплачено', delivered: 'Доставлено', installed: 'Змонтовано', done: 'Працює', cancelled: 'Скасовано' };
  var SEG = { flat: 'Квартира', home: 'Дім', osbb: 'ОСББ', biz: 'Бізнес' }, ROLE = { client: 'Клієнт', staff: 'Команда', admin: 'Адмін' };
  function el(tag, cls, text){ var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function btn(text, cls){ var b = el('button', 'btn ' + (cls || 'btn--volt btn--sm')); b.type = 'button'; b.appendChild(el('span', '', text)); return b; }
  function panel(title, cls){ var p = el('section', 'panel box cab-p' + (cls ? ' ' + cls : '')); if (title) p.appendChild(el('h3', '', title)); return p; }
  function uah(v){ return v == null ? 'за запитом' : nf(Math.round(v)) + ' ₴'; }
  function pad(n){ return (n < 10 ? '0' : '') + n; }
  function dt(t){ if (!t) return '—'; var x = new Date(t); return pad(x.getDate()) + '.' + pad(x.getMonth() + 1) + '.' + x.getFullYear() + ' ' + pad(x.getHours()) + ':' + pad(x.getMinutes()); }
  function input(val, ph, type){ var i = el('input', 'input input--sm'); if (type) i.type = type; if (val != null) i.value = val; if (ph) i.placeholder = ph; return i; }
  function sel(opts, val){ var s = el('select', 'input input--sm'); opts.forEach(function(o){ var x = el('option', '', o[1]); x.value = o[0]; if (String(o[0]) === String(val)) x.selected = true; s.appendChild(x); }); return s; }
  function lab(t, ctl){ var w = el('label', 'ctl__f'); w.append(el('span', 'lbl', t), ctl); return w; }
  function msgOf(e){ return A.message(e); }
  function put(nodes){ view.textContent = ''; nodes.forEach(function(n){ if (n) view.appendChild(n); }); }
  function note(t, s, href){ var p = el('div', 'panel box cab-empty'); p.append(el('h3', '', t), el('p', 'hint', s)); if (href) { var a = el('a', 'btn btn--ghost btn--sm', href[0]); a.href = href[1]; p.appendChild(a); } return p; }

  if (A.mode !== 'live' || !A.staff) { put([note('Панель команди працює на платформі', 'Це статична копія сайту без сервера. На робочій адресі тут заявки клієнтів, фінальні ціни, об’єкти й техніка — усе, що бачить клієнт у кабінеті.', ['Демо-кабінет клієнта', 'login.html'])]); return; }
  A.me().then(function(r){
    me = r.user; $('#admWho').textContent = (me.name || me.phoneText || me.email || '') + ' · ' + (ROLE[me.role] || me.role);
    if (!me.staff) { put([note('Немає доступу', 'Ця сторінка — для команди. Ваш кабінет — за кнопкою нижче.', ['Мій кабінет', 'account.html'])]); return; }
    tabs.forEach(function(t){ t.addEventListener('click', function(){ show(t.dataset.tab); }); });
    var h = location.hash.replace('#', '').split('=');
    show(['orders', 'sites', 'users'].indexOf(h[0]) >= 0 ? h[0] : 'orders', h[1]);
  }, function(e){ if (e.status === 401) location.replace('login.html?next=admin.html'); else put([note('Не вдалося завантажити', msgOf(e))]); });

  function show(t, arg){
    tab = t; pick = arg || null;
    tabs.forEach(function(x){ var on = x.dataset.tab === t; x.setAttribute('aria-selected', String(on)); x.tabIndex = on ? 0 : -1; });
    history.replaceState(null, '', '#' + t + (pick ? '=' + pick : ''));
    view.classList.add('is-loading');
    ({ orders: orders, sites: sites, users: users })[t]().then(function(){ view.classList.remove('is-loading'); }, function(e){ view.classList.remove('is-loading'); put([note('Не вдалося завантажити', msgOf(e))]); });
  }

  /* ---------------- orders ---------------- */
  var filt = { status: 'new', q: '' };
  function orders(){
    return Promise.all([A.staff.summary(), A.staff.orders({ status: filt.status, q: filt.q })]).then(function(r){
      var sum = r[0], list = r[1], tiles = el('div', 'adm-sum');
      ['new', 'survey', 'offer', 'contract', 'paid', 'installed'].forEach(function(k){ var t = el('div', 'tile'); t.append(el('span', '', STATUS[k]), el('b', '', String(sum.orders[k] || 0))); tiles.appendChild(t); });
      var bar = el('div', 'panel cab-filter'), st = sel([['', 'Усі']].concat(Object.keys(STATUS).map(function(k){ return [k, STATUS[k]]; })), filt.status), q = input(filt.q, 'номер, ім’я, телефон, об’єкт');
      st.addEventListener('change', function(){ filt.status = st.value; show('orders'); });
      q.addEventListener('keydown', function(e){ if (e.key === 'Enter') { filt.q = q.value.trim(); show('orders'); } });
      bar.append(lab('Статус', st), lab('Пошук', q), el('span', 'muted', 'Об’єктів: ' + sum.sites + ' · клієнтів: ' + sum.users + ' · шлюзів: ' + sum.gateways + (sum.offline ? ', без зв’язку ' + sum.offline : '')));
      var grid = el('div', 'adm-grid'), lp = panel('Заявки (' + list.length + ')'), ul = el('ul', 'adm-list'), detail = el('div', 'cab-col');
      list.forEach(function(o){
        var li = el('li', o.id === pick ? 'is-on' : ''), c = o.contact || {};
        li.append(el('b', '', o.number + ' · ' + (c.name || '—')), el('span', 'badge', STATUS[o.status] || o.status), el('small', '', dt(o.created_at) + ' · ' + (SEG[o.segment] || '') + (o.region ? ' · ' + o.region : '') + ' · ' + (c.phone || c.email || '') + ' · ' + uah(o.total) + (o.priced ? '' : ' + за запитом')));
        li.addEventListener('click', function(){ pick = o.id; $$('li', ul).forEach(function(x){ x.classList.toggle('is-on', x === li); }); history.replaceState(null, '', '#orders=' + o.id); openOrder(o.id, detail); });
        ul.appendChild(li);
      });
      if (!list.length) ul.appendChild(el('li', 'hint', 'Нічого не знайдено.'));
      lp.appendChild(ul); grid.append(lp, detail); put([tiles, bar, grid]);
      if (pick) openOrder(pick, detail); else if (list[0]) { pick = list[0].id; ul.firstChild.classList.add('is-on'); openOrder(pick, detail); }
    });
  }
  function openOrder(id, box){
    box.textContent = ''; box.appendChild(el('p', 'hint', 'Завантажуємо…'));
    A.staff.order(id).then(function(r){ drawOrder(r, box); }, function(e){ box.textContent = ''; box.appendChild(note('Не вдалося відкрити', msgOf(e))); });
  }
  function drawOrder(r, box){
    var o = r.order, c = o.contact || {}, p = panel(null), h = el('div', 'cab-p__h');
    h.append(el('h3', '', o.number + ' · ' + dt(o.created_at)), el('span', 'chipst chipst--now', STATUS[o.status] || o.status)); p.appendChild(h);
    var who = el('div', 'kv');
    [['Контакт', (c.name || '—') + (c.phone ? ' · ' + c.phone : '') + (c.email ? ' · ' + c.email : '')], ['Об’єкт', (r.site ? r.site.name : '—') + ' · ' + (SEG[o.segment] || '')], ['Регіон', o.region || '—'],
      ['Опції', [o.install ? 'монтаж' : 'без монтажу', o.options && o.options.grant ? 'допомога з компенсацією' : '', o.options && o.options.survey ? 'огляд об’єкта' : ''].filter(Boolean).join(' · ')]].forEach(function(x){ var row = el('div'); row.append(el('span', '', x[0]), el('b', '', x[1])); who.appendChild(row); });
    p.appendChild(who);
    if (c.phone) { var call = el('a', 'link', 'Подзвонити ' + c.phone); call.href = 'tel:' + String(c.phone).replace(/[^\d+]/g, ''); p.appendChild(call); }
    if (o.message) p.appendChild(el('p', 'hint', 'Коментар клієнта: ' + o.message));
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
    t.append(th, tb); var tw = el('div', 'tblw'); tw.appendChild(t); p.appendChild(tw);
    function cell(x){ var c2 = el('td'); c2.appendChild(x); return c2; }
    var adds = [], addBox = el('div', 'adm-form'), addBtn = btn('+ позиція', 'btn--ghost btn--sm');
    addBtn.addEventListener('click', function(){
      var kind = sel([['install', 'Монтаж'], ['delivery', 'Доставка'], ['service', 'Послуга'], ['equipment', 'Обладнання']], 'install'), prod = sel([['', '— модель з каталогу —']].concat(P.list.map(function(x){ return [x.id, x.maker + ' ' + x.model + ' — ' + x.name]; })), ''),
        nm = input('', 'назва'), q = input(1, '', 'number'), pr = input('', 'ціна за одиницю', 'number'), row = el('div', 'row');
      prod.addEventListener('change', function(){ var x = P.byId(prod.value); if (x) { nm.value = x.name; kind.value = 'equipment'; if (x.price != null) pr.value = x.price; } });
      row.append(kind, prod); var row2 = el('div', 'row'); row2.append(nm, q); addBox.append(row, row2, pr);
      adds.push(function(){ return nm.value.trim() ? { kind: kind.value, product_id: prod.value || null, name: nm.value.trim(), qty: +q.value || 1, price_uah: pr.value === '' ? null : +pr.value } : null; });
    });
    p.append(addBox, addBtn);
    var stS = sel(Object.keys(STATUS).map(function(k){ return [k, STATUS[k]]; }), o.status), nt = input('', 'примітка до зміни (видно в історії)'), save = btn('Зберегти'), msg = el('p', 'hint');
    var fr = el('div', 'adm-form'), r1 = el('div', 'row'); r1.append(lab('Статус', stS), lab('Примітка', nt)); fr.append(r1, save, msg); p.appendChild(fr);
    save.addEventListener('click', function(){
      save.disabled = true; msg.textContent = '';
      A.staff.saveOrder(o.id, { status: stS.value, note: nt.value.trim() || undefined, items: Object.keys(edits).map(function(k){ return edits[k]; }), add: adds.map(function(f){ return f(); }).filter(Boolean) })
        .then(function(x){ S.toast('Збережено'); drawOrder(x, box); }, function(e){ msg.textContent = msgOf(e); save.disabled = false; });
    });
    if (o.log && o.log.length) { var tl = el('ol', 'tline'); o.log.forEach(function(x){ var li = el('li'); li.append(el('b', '', STATUS[x.status] || x.status), el('span', 'mono muted', dt(x.at))); if (x.note) li.appendChild(el('small', 'muted', x.note)); tl.appendChild(li); }); p.appendChild(tl); }
    var go = el('a', 'link', r.devices && r.devices.length ? 'Техніка на об’єкті: ' + r.devices.length + ' →' : 'Додати техніку на об’єкт →'); go.href = '#sites=' + (r.site ? r.site.id : '');
    go.addEventListener('click', function(e){ e.preventDefault(); if (r.site) show('sites', r.site.id); });
    p.appendChild(go);
    box.textContent = ''; box.appendChild(p);
  }

  /* ---------------- sites and equipment ---------------- */
  var sq = '';
  function sites(){
    return A.staff.sites({ q: sq }).then(function(list){
      var grid = el('div', 'adm-grid'), lp = panel('Об’єкти (' + list.length + ')'), q = input(sq, 'пошук за назвою чи адресою'), ul = el('ul', 'adm-list'), detail = el('div', 'cab-col');
      q.addEventListener('keydown', function(e){ if (e.key === 'Enter') { sq = q.value.trim(); show('sites'); } });
      lp.append(q, ul);
      list.forEach(function(s){ var li = el('li', s.id === pick ? 'is-on' : ''); li.append(el('b', '', s.name), el('span', 'badge', SEG[s.segment] || s.segment), el('small', '', (s.owner || 'власника ще немає') + ' · систем: ' + s.systems));
        li.addEventListener('click', function(){ pick = s.id; $$('li', ul).forEach(function(x){ x.classList.toggle('is-on', x === li); }); history.replaceState(null, '', '#sites=' + s.id); openSite(s.id, detail); }); ul.appendChild(li); });
      if (!list.length) ul.appendChild(el('li', 'hint', 'Нічого не знайдено.'));
      lp.appendChild(newSite(detail));
      grid.append(lp, detail); put([grid]);
      if (pick) openSite(pick, detail);
    });
  }
  function newSite(detail){
    var f = el('form', 'adm-form'), name = input('', 'назва, напр. ОСББ «Сонячне»'), seg = sel(Object.keys(SEG).map(function(k){ return [k, SEG[k]]; }), 'osbb'), addr = input('', 'адреса'), owner = input('', '+380 або пошта власника'), oname = input('', 'ім’я власника'), go = btn('Створити об’єкт'), msg = el('p', 'hint');
    go.type = 'submit'; var r1 = el('div', 'row'); r1.append(seg, addr); var r2 = el('div', 'row'); r2.append(owner, oname);
    f.append(el('span', 'lbl', 'Новий об’єкт клієнта'), name, r1, r2, go, msg);
    f.addEventListener('submit', function(e){ e.preventDefault(); A.staff.createSite({ name: name.value, segment: seg.value, address: addr.value, owner: owner.value || undefined, owner_name: oname.value }).then(function(x){ S.toast('Об’єкт створено'); pick = x.site.id; show('sites', x.site.id); }, function(er){ msg.textContent = msgOf(er); }); });
    return f;
  }
  function openSite(id, box){
    box.textContent = ''; box.appendChild(el('p', 'hint', 'Завантажуємо…'));
    return A.staff.site(id).then(function(r){ drawSite(r, box); return true; }, function(e){ box.textContent = ''; box.appendChild(note('Не вдалося відкрити', msgOf(e))); return false; });
  }
  function drawSite(r, box){
    var s = r.site, p = panel(null), h = el('div', 'cab-p__h');
    h.append(el('h3', '', s.name), el('span', 'badge', SEG[s.segment] || s.segment)); p.appendChild(h);
    p.appendChild(el('p', 'hint', [s.address, s.region].filter(Boolean).join(' · ') || 'адресу не вказано'));
    var cab = el('a', 'link', 'Відкрити кабінет цього об’єкта →'); cab.href = 'account.html?site=' + encodeURIComponent(s.id); p.appendChild(cab);
    var m = el('ul', 'list'); r.members.forEach(function(x){ var li = el('li'), a = el('div'); a.append(el('b', '', x.name || '—'), el('small', '', x.phone || x.email || '')); li.append(a, el('span', 'badge', x.role)); m.appendChild(li); });
    if (!r.members.length) m.appendChild(el('li', 'hint', 'Власника ще немає: він з’явиться, коли клієнт увійде з телефоном із заявки.'));
    p.appendChild(m);
    var dp = panel('Техніка на об’єкті'), systems = r.devices.filter(function(x){ return !x.parent_id; });
    systems.forEach(function(x){
      var li = el('div', 'comp'), b = el('div', 'comp__b'), rm = el('button', 'rqi__rm', '×'); rm.type = 'button'; rm.setAttribute('aria-label', 'Прибрати ' + x.name);
      b.append(el('b', '', x.name + ' · ' + (x.model || '')), el('small', 'muted', (x.serial ? '№ ' + x.serial + ' · ' : '') + (x.driver === 'gateway' ? 'шлюз · ' + (x.status === 'online' ? 'на зв’язку' : 'немає зв’язку') + (x.last_seen_at ? ' · ' + dt(x.last_seen_at) : '') : 'симуляція') + ' · ' + nf(x.spec.kwh || 0, 2) + ' кВт·год'));
      r.devices.filter(function(c){ return c.parent_id === x.id; }).forEach(function(c){ b.appendChild(el('small', '', '↳ ' + c.name + (c.serial ? ' · № ' + c.serial : ''))); });
      var acts = el('div', 'chips');
      if (x.driver === 'gateway') { var sk = el('button', 'chip', 'Новий ключ шлюзу'); sk.type = 'button'; sk.addEventListener('click', function(){ if (!confirm('Старий ключ шлюзу перестане працювати. Продовжити?')) return; A.staff.secret(x.id).then(function(z){ secretBox(dp, z.secret); }, function(e){ S.toast(msgOf(e)); }); }); acts.appendChild(sk); }
      b.appendChild(acts);
      rm.addEventListener('click', function(){ if (!confirm('Прибрати «' + x.name + '» з об’єкта разом з історією даних?')) return; A.staff.removeDevice(x.id).then(function(){ openSite(s.id, box); }, function(e){ S.toast(msgOf(e)); }); });
      li.append(el('span', 'it__ic', '⚡'), b, rm); li.style.gridTemplateColumns = '48px minmax(0,1fr) auto'; dp.appendChild(li);
    });
    if (!systems.length) dp.appendChild(el('p', 'hint', 'Техніки ще немає. Додайте систему (моноблок або інвертор), потім батареї до неї.'));
    dp.appendChild(addDevice(r, box));
    var op = panel('Замовлення'); (r.orders || []).forEach(function(o){ var a = el('a', 'link', o.number + ' · ' + (STATUS[o.status] || o.status) + ' · ' + uah(o.total)); a.href = '#orders=' + o.id; a.addEventListener('click', function(e){ e.preventDefault(); show('orders', o.id); }); op.appendChild(a); op.appendChild(el('br')); });
    if (!r.orders || !r.orders.length) op.appendChild(el('p', 'hint', 'Замовлень немає.'));
    box.textContent = ''; box.append(p, dp, op);
  }
  function secretBox(host, secret){
    var b = el('div', 'adm-secret'); b.textContent = secret;
    var w = el('div'); w.append(el('p', 'hint', 'Ключ шлюзу — показуємо один раз. Шлюз надсилає дані на /api/ingest із заголовком «Authorization: Device <ключ>». Протокол — platform/README.md.'), b);
    host.insertBefore(w, host.children[1] || null);
  }
  function addDevice(r, box){
    var f = el('form', 'adm-form'), s = r.site, systems = r.devices.filter(function(x){ return !x.parent_id; });
    var cats = { aio: 'Моноблок', inverter: 'Інвертор', battery: 'Батарея', hv: 'Високовольтна стійка', portable: 'Портативна станція' };
    var prod = sel([['', '— модель —']].concat(P.list.filter(function(x){ return cats[x.cat]; }).map(function(x){ return [x.id, cats[x.cat] + ': ' + x.maker + ' ' + x.model]; })), ''), vari = sel([['', '—']], ''), serial = input('', 'серійний номер'), driver = sel([['gateway', 'Шлюз (реальні дані)'], ['sim', 'Симуляція (шоурум, демо)']], 'gateway');
    var parent = sel([['', '— окрема система —']].concat(systems.map(function(x){ return [x.id, 'до системи: ' + x.name + (x.serial ? ' № ' + x.serial : '')]; })), ''), lines = [['', '— рядок замовлення (для гарантії й ціни) —']];
    (r.orders || []).forEach(function(o){ (o.items || []).filter(function(it){ return it.kind === 'equipment'; }).forEach(function(it){ lines.push([it.id, o.number + ': ' + it.name + ' × ' + it.qty]); }); });
    var item = sel(lines, ''), when = input(new Date().toISOString().slice(0, 10), '', 'date'), war = input('', 'гарантія, років (з даташиту, якщо порожньо)', 'number'), go = btn('Додати техніку'), msg = el('p', 'hint');
    go.type = 'submit';
    prod.addEventListener('change', function(){ var x = P.byId(prod.value); vari.textContent = ''; var o0 = el('option', '', '—'); o0.value = ''; vari.appendChild(o0);
      (x && x.variants || []).forEach(function(v){ var o = el('option', '', v.model); o.value = v.model; vari.appendChild(o); }); vari.disabled = !(x && x.variants);
      var bat = x && (x.cat === 'battery' || x.cat === 'hv'); parent.required = bat; if (bat && systems[0] && !parent.value) parent.value = systems[0].id; });
    vari.disabled = true;
    var r1 = el('div', 'row'); r1.append(prod, vari); var r2 = el('div', 'row'); r2.append(serial, driver); var r3 = el('div', 'row'); r3.append(parent, item); var r4 = el('div', 'row'); r4.append(lab('Дата монтажу', when), lab('Гарантія, років', war));
    f.append(el('span', 'lbl', 'Додати техніку після монтажу'), r1, r2, r3, r4, go, msg);
    f.addEventListener('submit', function(e){
      e.preventDefault(); msg.textContent = '';
      A.staff.addDevice({ site_id: s.id, product_id: prod.value, variant: vari.value || null, serial: serial.value, driver: driver.value, parent_id: parent.value || null, order_item_id: item.value ? +item.value : null,
        installed_at: when.value ? Date.parse(when.value + 'T12:00:00') : null, warranty_years: war.value ? +war.value : null })
        .then(function(x){
          S.toast('Техніку додано — клієнт бачить її в кабінеті');
          /* the key is shown once: put it on screen only after the panel is rebuilt, or keep it here if the reload fails */
          openSite(s.id, box).then(function(okd){ if (!x.secret) return; if (okd && box.children[1]) secretBox(box.children[1], x.secret); else { box.appendChild(el('div', 'adm-secret', x.secret)); } });
        }, function(er){ msg.textContent = msgOf(er) + (er.code === 'parent' ? ' Батарею треба підключити до системи на цьому об’єкті.' : ''); });
    });
    return f;
  }

  /* ---------------- people ---------------- */
  var uq = '';
  function users(){
    return A.staff.users({ q: uq }).then(function(list){
      var p = panel('Люди (' + list.length + ')'), q = input(uq, 'ім’я, телефон або пошта'), t = el('table', 'tbl'), tb = el('tbody');
      q.addEventListener('keydown', function(e){ if (e.key === 'Enter') { uq = q.value.trim(); show('users'); } });
      var hr = el('tr'); ['Ім’я', 'Контакт', 'Зареєстровано', 'Останній вхід', 'Роль'].forEach(function(x){ hr.appendChild(el('th', '', x)); }); var th = el('thead'); th.appendChild(hr); t.append(th, tb);
      list.forEach(function(u){
        var r = el('tr'), role = sel(Object.keys(ROLE).map(function(k){ return [k, ROLE[k]]; }), u.role); role.disabled = me.role !== 'admin' || u.id === me.id;
        role.addEventListener('change', function(){ A.staff.setRole(u.id, role.value).then(function(){ S.toast('Роль змінено'); }, function(e){ S.toast(msgOf(e)); role.value = u.role; }); });
        var c = el('td'); c.appendChild(role);
        r.append(el('td', '', u.name || '—'), el('td', 'mono', u.phoneText || u.email || '—'), el('td', 'mono', dt(u.created_at)), el('td', 'mono', dt(u.last_login_at)), c); tb.appendChild(r);
      });
      var w = el('div', 'tblw'); w.appendChild(t); p.append(q, w);
      if (me.role !== 'admin') p.appendChild(el('p', 'hint', 'Ролі змінює адміністратор.'));
      put([p]);
    });
  }
})();
