/* =====================================================================
   API client of the cabinet. On the platform (window.APP_API = '/api') it
   talks to our backend. The static copy of the site has no backend: the
   same calls are answered in the browser from the demo account — the same
   fleet.js views over the same demo rows the worker would insert — and the
   owner's changes are kept in localStorage. Every call returns a Promise
   of the same JSON, errors carry .code like the server's { error }.
   Loaded on every page (build.py): account.js uses it for the header,
   the e-mail notice and the basket on the account.
   ===================================================================== */
window.Api = (function(){
  'use strict';
  var BASE = window.APP_API || '', F = window.FLEET, P = window.PRODUCTS, S = window.Site || {}, LANG = S.lang || 'uk';

  function fail(code, data){ var e = new Error(code); e.code = code; e.data = data || {}; return e; }
  function send(method, path, body){
    var h = { 'x-lang': LANG }; if (body) h['content-type'] = 'application/json';
    return fetch(BASE + path, { method: method, credentials: 'same-origin', headers: h, body: body ? JSON.stringify(body) : undefined })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) { var e = fail(j.error || 'http_' + r.status, j); e.status = r.status; throw e; } return j; }); },
        function(){ throw fail('network'); });
  }
  /* Answers to GETs are kept for the browser tab (sessionStorage): the next page or tab shows them
     at once while the server is asked in the background; a different answer comes as the
     'api:fresh' event { path }, a lost session as 'api:signedout'. Any change (POST, PATCH, PUT,
     DELETE — signing in and out too) drops everything kept. Live data, chats and the basket
     always go to the server. */
  var KEEP = 'nrgt-api:', FRESH = 5000, NOKEEP = /\/live$|\/messages|^\/cart/, flying = {};
  function kept(path){ try { var x = JSON.parse(sessionStorage.getItem(KEEP + path) || 'null'); return x && typeof x.s === 'string' ? x : null; } catch (e) { return null; } }
  function keep(path, s){ try { sessionStorage.setItem(KEEP + path, JSON.stringify({ t: Date.now(), s: s })); } catch (e) { drop(); } }
  function drop(){ try { Object.keys(sessionStorage).forEach(function(k){ if (k.indexOf(KEEP) === 0) sessionStorage.removeItem(k); }); } catch (e) {} }
  function emit(name, detail){ document.dispatchEvent(new CustomEvent(name, { detail: detail })); }
  function cached(path){
    var hit = kept(path);
    if (hit && Date.now() - hit.t < FRESH) return Promise.resolve(JSON.parse(hit.s));
    var net = flying[path] || (flying[path] = send('GET', path).then(function(j){
      delete flying[path];
      var s = JSON.stringify(j), was = kept(path); keep(path, s);
      if (was && was.s !== s) emit('api:fresh', { path: path });
      return j;
    }, function(e){ delete flying[path]; if (e.status === 401) { drop(); if (hit) emit('api:signedout', { path: path }); } throw e; }));
    if (!hit) return net;
    net.catch(function(){});
    return Promise.resolve(JSON.parse(hit.s));
  }
  function call(method, path, body){
    if (method === 'GET' && !NOKEEP.test(path)) return cached(path);
    if (method !== 'GET') drop();
    var r = send(method, path, body);
    return method === 'GET' ? r : r.then(function(j){ drop(); return j; }, function(e){ drop(); throw e; });
  }
  function q(o){ var s = Object.keys(o).filter(function(k){ return o[k] != null && o[k] !== ''; }).map(function(k){ return k + '=' + encodeURIComponent(o[k]); }).join('&'); return s ? '?' + s : ''; }

  var live = {
    mode: 'live',
    forget: drop,
    config: function(){ return call('GET', '/config'); },
    me: function(){ return call('GET', '/me'); },
    /* a Firebase account signed in in this browser (fb.js) → our session */
    firebase: function(idToken, extra){ return call('POST', '/auth/firebase', Object.assign({ idToken: idToken, lang: LANG }, extra || {})); },
    logout: function(all){ return call('POST', '/auth/logout', { all: !!all }); },
    demo: function(){ return call('POST', '/demo', {}); },
    overview: function(s){ return call('GET', '/sites/' + s + '/overview'); },
    energy: function(s, range, day){ return call('GET', '/sites/' + s + '/energy' + q({ range: range, day: day })); },
    economics: function(s){ return call('GET', '/sites/' + s + '/economics'); },
    live: function(s){ return call('GET', '/sites/' + s + '/live'); },
    site: function(s){ return call('GET', '/sites/' + s); },
    saveSite: function(s, b){ return call('PATCH', '/sites/' + s, b); },
    invite: function(s, login, role){ return call('POST', '/sites/' + s + '/members', { login: login, role: role }); },
    removeMember: function(s, u){ return call('DELETE', '/sites/' + s + '/members/' + u); },
    removeInvite: function(s, i){ return call('DELETE', '/sites/' + s + '/invites/' + i); },
    device: function(id){ return call('GET', '/devices/' + id); },
    command: function(id, b){ return call('POST', '/devices/' + id + '/commands', b); },
    orders: function(){ return call('GET', '/orders'); },
    order: function(b){ return call('POST', '/orders', b); },
    claim: function(tokens){ return call('POST', '/orders/claim', { tokens: tokens }); },
    messages: function(id, after){ return call('GET', '/orders/' + id + '/messages' + q({ after: after })); },
    send: function(id, body){ return call('POST', '/orders/' + id + '/messages', { body: body }); },
    unread: function(){ return call('GET', '/unread'); },
    cart: function(){ return call('GET', '/cart'); },
    saveCart: function(items, at){ return call('PUT', '/cart', { items: items, at: at }); },
    saveMe: function(b){ return call('PATCH', '/me', b); },
    staff: {
      summary: function(){ return call('GET', '/staff/summary'); },
      orders: function(o){ return call('GET', '/staff/orders' + q(o || {})); },
      order: function(id){ return call('GET', '/staff/orders/' + id); },
      saveOrder: function(id, b){ return call('PATCH', '/staff/orders/' + id, b); },
      messages: function(id, after){ return call('GET', '/staff/orders/' + id + '/messages' + q({ after: after })); },
      send: function(id, body){ return call('POST', '/staff/orders/' + id + '/messages', { body: body }); },
      unread: function(){ return call('GET', '/staff/unread'); },
      sites: function(o){ return call('GET', '/staff/sites' + q(o || {})); },
      site: function(id){ return call('GET', '/staff/sites/' + id); },
      createSite: function(b){ return call('POST', '/staff/sites', b); },
      addDevice: function(b){ return call('POST', '/staff/devices', b); },
      secret: function(id){ return call('POST', '/staff/devices/' + id + '/secret', {}); },
      removeDevice: function(id){ return call('DELETE', '/staff/devices/' + id); },
      users: function(o){ return call('GET', '/staff/users' + q(o || {})); },
      user: function(id){ return call('GET', '/staff/users/' + id); },
      setRole: function(id, role){ return call('PATCH', '/staff/users/' + id, { role: role }); },
      block: function(id, on, reason){ return call('PATCH', '/staff/users/' + id, { blocked: !!on, reason: reason || undefined }); },
      endSessions: function(id, ref){ return call('DELETE', '/staff/users/' + id + '/sessions' + q({ ref: ref })); },
      audit: function(o){ return call('GET', '/staff/audit' + q(o || {})); },
      pulse: function(){ return call('GET', '/staff/pulse'); },
      team: function(){ return call('GET', '/staff/team'); },
      prices: function(){ return call('POST', '/staff/prices', {}); }
    }
  };

  /* ---------------- the static demo ---------------- */
  var KEY = 'cab-demo', D = null, mem = null;
  F = F || window.FLEET; P = P || window.PRODUCTS;
  function state(){ if (mem) return mem; try { mem = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { mem = null; } if (!mem || typeof mem !== 'object') mem = {}; mem.cmds = mem.cmds || []; mem.sites = mem.sites || {}; mem.members = mem.members || {}; mem.chat = mem.chat || {}; return mem; }
  function keep(){ try { localStorage.setItem(KEY, JSON.stringify(mem)); } catch (e) {} }
  function data(){
    if (!D) D = F.demo(Date.now(), P);
    var st = state();
    D.sites.forEach(function(s){ var p = st.sites[s.id]; if (p) Object.keys(p).forEach(function(k){ s[k] = p[k]; }); });
    if (st.name) D.user.name = st.name;
    return D;
  }
  function commands(){ var d = data(); return d.commands.concat(state().cmds).sort(function(a, b){ return a.created_at - b.created_at; }); }
  function ctx(siteId){
    var d = data(), site = d.sites.filter(function(s){ return s.id === siteId; })[0];
    if (!site) throw fail('not_found');
    var c = F.context(site, d.devices, d.orders, commands(), [], window.DAM_DATA, Date.now());
    c.site.role = 'owner';
    return c;
  }
  function siteOut(site){ var v = F.siteView(site); v.region = 'м. Київ'; v.can = { control: true, own: true }; return v; }
  function ok(fn){ return new Promise(function(res, rej){ try { res(fn()); } catch (e) { rej(e.code ? e : fail('demo_error')); } }); }
  function mine(siteId){ var d = data(), st = state(), base = d.members.filter(function(m){ return m.site_id === siteId; }), extra = st.members[siteId] || [];
    return { members: base.concat(extra.filter(function(x){ return !x.invite; })).map(function(m){ return { user_id: m.user_id, name: m.name, login: m.login, role: m.role }; }),
      invites: extra.filter(function(x){ return x.invite; }).map(function(x){ return { id: x.id, login: x.login, role: x.role, created_at: x.created_at }; }) }; }

  var demo = {
    mode: 'demo',
    config: function(){ return ok(function(){ return { email: false, phone: false, dev: false, demo: true, static: true }; }); },
    me: function(){ return ok(function(){ if (!state().in) throw fail('unauthorized');
      var u = { phone: null, phoneText: '', email: null, role: 'client', demo: true, staff: false, verified: true, google: false, password: false, lang: LANG };
      /* pages without the cabinet's model only need to know that the demo is open */
      if (!window.FLEET) { u.id = 'demo'; u.name = state().name || tx('Демо-користувач', 'Demo user'); return { user: u, sites: [] }; }
      F = window.FLEET; P = window.PRODUCTS; var d = data(); u.id = d.user.id; u.name = d.user.name;
      return { user: u, sites: d.sites.map(function(s){ return { id: s.id, name: s.name, segment: s.segment, address: s.address, role: 'owner' }; }) }; }); },
    firebase: function(){ return Promise.reject(fail('static')); },
    logout: function(){ return ok(function(){ state().in = false; keep(); return { ok: true }; }); },
    demo: function(){ return ok(function(){ state().in = true; keep(); return { user: data().user }; }); },
    overview: function(s){ return ok(function(){ var c = ctx(s), v = F.overview(c); v.site = siteOut(c.site); return v; }); },
    energy: function(s, range, day){ return ok(function(){ return F.energy(ctx(s), range, day); }); },
    economics: function(s){ return ok(function(){ return F.economics(ctx(s)); }); },
    live: function(s){ return ok(function(){ return F.live(ctx(s)); }); },
    site: function(s){ return ok(function(){ var c = ctx(s), v = siteOut(c.site), m = mine(s); v.members = m.members; v.invites = m.invites; return v; }); },
    saveSite: function(s, b){ return ok(function(){ var c = ctx(s), p = state().sites[s] || (state().sites[s] = {});
      if (b.name != null) p.name = String(b.name).trim().slice(0, 100) || c.site.name;
      if (b.address != null) p.address = String(b.address).trim().slice(0, 160);
      if (b.tariff) p.tariff = F.cleanTariff(b.tariff, c.site.segment);
      if (b.gen_cost != null) p.gen_cost = +b.gen_cost > 0 ? Math.min(200, +b.gen_cost) : null;
      keep(); return siteOut(ctx(s).site); }); },
    invite: function(s, login, role){ return ok(function(){ if (!/\d{9}|@/.test(String(login || ''))) throw fail('login');
      var l = state().members[s] || (state().members[s] = []); l.push({ invite: true, id: Date.now(), login: String(login).trim(), role: role || 'viewer', created_at: Date.now() }); keep(); return mine(s); }); },
    removeMember: function(s){ return Promise.reject(fail('demo')); },
    removeInvite: function(s, i){ return ok(function(){ state().members[s] = (state().members[s] || []).filter(function(x){ return String(x.id) !== String(i); }); keep(); return mine(s); }); },
    device: function(id){ return ok(function(){ var d = data(), dev = d.devices.filter(function(x){ return x.id === id; })[0]; if (!dev) throw fail('not_found');
      var c = ctx(dev.site_id), v = F.device(c, dev.parent_id || dev.id); v.site = siteOut(c.site); return v; }); },
    command: function(id, b){ return ok(function(){
      var d = data(), dev = d.devices.filter(function(x){ return x.id === id; })[0]; if (!dev || dev.parent_id) throw fail('not_found');
      var now = Date.now(), payload;
      if (b.kind === 'settings') { var n = F.normalize(b.payload, dev.spec); if (!n.ok) throw fail('settings', { errors: n.errors }); payload = n.value; }
      else if (b.kind === 'boost') { var u = Math.round(+(b.payload && b.payload.until)); if (!(u > now + 300000 && u <= now + 48 * 3600000)) throw fail('until'); payload = { until: u }; }
      else if (b.kind === 'cancel') payload = {};
      else throw fail('kind');
      var cur = F.settingsAt({ id: dev.id, spec: dev.spec, log: F.logOf(commands(), dev.id) }, now);
      var cmd = { id: now, device_id: id, user_name: d.user.name, kind: b.kind, payload: payload, prev: b.kind === 'settings' ? cur : null, status: 'applied', created_at: now, done_at: now };
      state().cmds.push(cmd); keep();
      var c = ctx(dev.site_id), v = F.device(c, id); v.site = siteOut(c.site);
      return { command: cmd, device: v }; }); },
    orders: function(){ return ok(function(){ var d = data(); return d.orders.slice().sort(function(a, b){ return b.created_at - a.created_at; }).map(function(o){ var v = F.orderView(o); v.site_name = (d.sites.filter(function(s){ return s.id === o.site_id; })[0] || {}).name; return v; }); }); },
    order: function(){ return Promise.reject(fail('static')); },
    claim: function(){ return ok(function(){ return { claimed: 0 }; }); },
    /* the chat on the demo orders: a reply from the team on the offer, the owner's messages stay in this browser */
    messages: function(id){ return ok(function(){ var o = data().orders.filter(function(x){ return x.id === id; })[0]; if (!o) throw fail('not_found');
      var base = [{ id: 1, at: o.created_at, staff: true, system: true, mine: false, author: '', body: '@new' }];
      if (o.status === 'offer') base.push({ id: 2, at: o.created_at + 26 * 3600000, staff: true, system: false, mine: false, author: tx('Менеджер (демо)', 'Manager (demo)'),
        body: tx('Добрий день! Пропозицію на додаткову батарею додали в заявку: ціну монтажу підтвердить інженер після огляду щита. Зручно в четвер зранку?', 'Hello! We added the offer for the extra battery to the request: the engineer confirms the installation price after looking at the switchboard. Is Thursday morning convenient?') });
      return { order: { id: o.id, number: o.number, status: o.status }, messages: base.concat(state().chat[id] || []) }; }); },
    send: function(id, body){ return ok(function(){ var t = String(body || '').trim().slice(0, 2000); if (!t) throw fail('message'); var l = state().chat[id] || (state().chat[id] = []), m = { id: 100 + l.length, at: Date.now(), staff: false, system: false, mine: true, author: '', body: t }; l.push(m); keep(); return { id: m.id, at: m.at }; }); },
    unread: function(){ return ok(function(){ return { total: 0, orders: {} }; }); },
    cart: function(){ return ok(function(){ return { items: [], at: 0 }; }); },
    saveCart: function(){ return ok(function(){ return { ok: true, at: 0 }; }); },
    saveMe: function(b){ return ok(function(){ var n = String(b.name || '').trim().slice(0, 80); if (!n) throw fail('name'); state().name = n; keep(); data().user.name = n; return { user: { name: n, demo: true, verified: true } }; }); },
    staff: null
  };

  /* plain-language messages for the server's error codes */
  var MSG = {
    email: tx('Перевірте адресу пошти.', 'Check the e-mail address.'), phone: tx('Перевірте номер телефону.', 'Check the phone number.'),
    contact: tx('Вкажіть телефон або пошту.', 'Enter a phone or an e-mail.'),
    password_short: tx('Пароль — щонайменше 8 символів.', 'The password needs at least 8 characters.'), password_long: tx('Задовгий пароль.', 'The password is too long.'),
    password_weak: tx('Пароль не може збігатися з поштою.', 'The password cannot be your e-mail.'), password_wrong: tx('Поточний пароль не підходить.', 'The current password is wrong.'),
    login_failed: tx('Невірна пошта або пароль. Або «Увійти з Google».', 'Wrong e-mail or password. Or «Continue with Google».'),
    exists: tx('Пошта вже зареєстрована — увійдіть або відновіть пароль.', 'This e-mail is registered — sign in or reset the password.'),
    email_taken: tx('Ця пошта вже прив’язана до іншого кабінету.', 'This e-mail belongs to another account.'), email_same: tx('Це ваша поточна пошта.', 'This is your current e-mail.'),
    link: tx('Посилання не підходить — відкрийте останній лист.', 'This link does not work — open the latest e-mail.'),
    link_used: tx('Посилання вже використане.', 'This link has already been used.'), link_expired: tx('Посилання застаріло — надішлемо нове.', 'This link has expired — we will send a new one.'),
    not_verified: tx('Підтвердьте пошту — посилання в листі.', 'Confirm your e-mail — the link is in our e-mail.'),
    invite_email: tx('Вкажіть пошту.', 'Enter an e-mail.'), message: tx('Напишіть повідомлення.', 'Write a message.'),
    too_many: tx('Забагато запитів — спробуйте за кілька хвилин.', 'Too many requests — try again in a few minutes.'),
    unauthorized: tx('Увійдіть, щоб продовжити.', 'Sign in to continue.'), forbidden: tx('Недостатньо прав.', 'Not allowed.'), role: tx('Ваша роль цього не дозволяє.', 'Your role does not allow this.'), not_found: tx('Не знайдено.', 'Not found.'),
    settings: tx('Перевірте налаштування.', 'Check the settings.'), until: tx('Час — у межах 48 годин.', 'The time must be within 48 hours.'), network: tx('Немає зв’язку. Перевірте інтернет.', 'No connection. Check the internet.'),
    static: tx('Вхід ще не працює — відкрийте демо.', 'Sign-in is not live yet — open the demo.'), demo: tx('У демо-кабінеті це недоступно.', 'Not available in the demo account.'),
    last_owner: tx('На об’єкті має лишитися хоча б один власник.', 'The site must keep at least one owner.'), demo_off: tx('Демо-кабінет вимкнено.', 'The demo account is off.'),
    not_configured: tx('Сервер ще налаштовується.', 'The server is still being set up.'), server_error: tx('Помилка сервера. Спробуйте ще раз.', 'Server error. Please try again.'), name: tx('Вкажіть назву.', 'Enter a name.'),
    empty: tx('Додайте обладнання або напишіть коментар.', 'Add equipment or write a comment.'), items: tx('Перевірте склад заявки.', 'Check the items of the request.'),
    ai_off: tx('AI-агент ще не підключений.', 'The AI agent is not connected yet.'), ai_limit: tx('Ліміт на сьогодні вичерпано — продовжимо завтра або напишіть менеджеру.', 'Today’s limit is used up — continue tomorrow or write to a manager.'),
    ai_busy: tx('AI-агент перевантажений — спробуйте за хвилину.', 'The AI agent is busy — try again in a minute.'), user: tx('Акаунта з такою поштою немає.', 'No account with this e-mail.'),
    user_unverified: tx('Акаунт ще не підтвердив пошту — спробуйте після підтвердження.', 'This account has not confirmed its e-mail — try after the confirmation.'),
    too_long: tx('Задовге повідомлення.', 'The message is too long.'),
    verify_first: tx('Акаунт уже готовий — підтвердьте пошту з листа.', 'Your account is ready — confirm the e-mail from our letter.'),
    blocked: tx('Акаунт заблоковано. Напишіть нам, якщо це помилка.', 'This account is blocked. Write to us if this is a mistake.'),
    fb_signin: tx('Увійдіть ще раз на цьому пристрої — і повторіть.', 'Sign in again on this device and repeat.'),
    reauth: tx('Введіть поточний пароль.', 'Enter your current password.'), cancelled: '',
    popup_blocked: tx('Дозвольте спливні вікна для входу з Google.', 'Allow pop-ups to sign in with Google.'),
    auth_off: tx('Вхід ще не підключено.', 'Sign-in is not connected yet.'), auth_domain: tx('Цю адресу ще не дозволено для входу (Firebase).', 'This address is not allowed for sign-in yet (Firebase).'),
    exists_other: tx('Пошта зареєстрована іншим способом — увійдіть, як реєструвалися.', 'This e-mail uses another sign-in method — sign in the way you signed up.'),
    auth_failed: tx('Не вдалося увійти — спробуйте ще раз.', 'Could not sign in — please try again.'), token: tx('Вхід не вдався — спробуйте ще раз.', 'Sign-in failed — please try again.'), token_old: tx('Вхід не вдався — спробуйте ще раз.', 'Sign-in failed — please try again.'),
    admin_only: tx('Це може лише адмін.', 'Only an admin can do this.'), self: tx('Це не можна зробити зі своїм акаунтом.', 'You cannot do this to your own account.'), manager: tx('Оберіть менеджера з команди.', 'Pick a manager from the team.')
  };
  function message(e){ var c = e && (typeof e.code === 'string' ? e.code : e.message); if (c === 'settings' && e.data && e.data.errors && e.data.errors.length) return e.data.errors.map(function(x){ return x.m; }).join(' '); return MSG[c] || tx('Щось пішло не так. Спробуйте ще раз.', 'Something went wrong. Please try again.'); }

  var api = BASE ? live : demo;
  api.message = message;
  return api;
})();
