/* =====================================================================
   API client of the cabinet. On the platform (window.APP_API = '/api') it
   talks to our backend. The static copy of the site has no backend: the
   same calls are answered in the browser from the demo account — the same
   fleet.js views over the same demo rows the worker would insert — and the
   owner's changes are kept in localStorage. Every call returns a Promise
   of the same JSON, errors carry .code like the server's { error }.
   ===================================================================== */
window.Api = (function(){
  'use strict';
  var BASE = window.APP_API || '', F = window.FLEET, P = window.PRODUCTS;

  function fail(code, data){ var e = new Error(code); e.code = code; e.data = data || {}; return e; }
  function call(method, path, body){
    return fetch(BASE + path, { method: method, credentials: 'same-origin', headers: body ? { 'content-type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined })
      .then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ if (!r.ok) { var e = fail(j.error || 'http_' + r.status, j); e.status = r.status; throw e; } return j; }); },
        function(){ throw fail('network'); });
  }
  function q(o){ var s = Object.keys(o).filter(function(k){ return o[k] != null && o[k] !== ''; }).map(function(k){ return k + '=' + encodeURIComponent(o[k]); }).join('&'); return s ? '?' + s : ''; }

  var live = {
    mode: 'live',
    config: function(){ return call('GET', '/config'); },
    me: function(){ return call('GET', '/me'); },
    start: function(login){ return call('POST', '/auth/start', { login: login }); },
    verify: function(login, code){ return call('POST', '/auth/verify', { login: login, code: code }); },
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
    saveMe: function(b){ return call('PATCH', '/me', b); },
    contactStart: function(login){ return call('POST', '/me/contact', { login: login }); },
    contactVerify: function(login, code){ return call('POST', '/me/contact/verify', { login: login, code: code }); },
    staff: {
      summary: function(){ return call('GET', '/staff/summary'); },
      orders: function(o){ return call('GET', '/staff/orders' + q(o || {})); },
      order: function(id){ return call('GET', '/staff/orders/' + id); },
      saveOrder: function(id, b){ return call('PATCH', '/staff/orders/' + id, b); },
      sites: function(o){ return call('GET', '/staff/sites' + q(o || {})); },
      site: function(id){ return call('GET', '/staff/sites/' + id); },
      createSite: function(b){ return call('POST', '/staff/sites', b); },
      addDevice: function(b){ return call('POST', '/staff/devices', b); },
      secret: function(id){ return call('POST', '/staff/devices/' + id + '/secret', {}); },
      removeDevice: function(id){ return call('DELETE', '/staff/devices/' + id); },
      users: function(o){ return call('GET', '/staff/users' + q(o || {})); },
      setRole: function(id, role){ return call('PATCH', '/staff/users/' + id, { role: role }); },
      prices: function(){ return call('POST', '/staff/prices', {}); }
    }
  };

  /* ---------------- the static demo ---------------- */
  var KEY = 'cab-demo', D = null, mem = null;
  function state(){ if (mem) return mem; try { mem = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { mem = null; } if (!mem || typeof mem !== 'object') mem = {}; mem.cmds = mem.cmds || []; mem.sites = mem.sites || {}; mem.members = mem.members || {}; return mem; }
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
    me: function(){ return ok(function(){ var d = data(); if (!state().in) throw fail('unauthorized');
      return { user: { id: d.user.id, name: d.user.name, phone: null, phoneText: '', email: null, role: 'client', demo: true, staff: false }, sites: d.sites.map(function(s){ return { id: s.id, name: s.name, segment: s.segment, address: s.address, role: 'owner' }; }) }; }); },
    start: function(){ return Promise.reject(fail('static')); },
    verify: function(){ return Promise.reject(fail('static')); },
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
    saveMe: function(b){ return ok(function(){ var n = String(b.name || '').trim().slice(0, 80); if (!n) throw fail('name'); state().name = n; keep(); data().user.name = n; return { user: { name: n, demo: true } }; }); },
    contactStart: function(){ return Promise.reject(fail('demo')); },
    contactVerify: function(){ return Promise.reject(fail('demo')); },
    staff: null
  };

  /* plain-language messages for the server's error codes */
  var MSG = {
    login: 'Перевірте номер телефону або пошту.', phone: 'Вкажіть телефон для зв’язку.', phone_ua: 'Код SMS надсилаємо лише на українські номери (+380). Увійдіть через пошту.', code: 'Введіть 6 цифр коду.', code_wrong: 'Код не підходить.',
    code_expired: 'Код застарів або вже використаний — надішлемо новий.', code_attempts: 'Забагато спроб. Запросіть новий код.', too_many: 'Забагато запитів. Спробуйте за кілька хвилин.',
    channel_email: 'Вхід через пошту ще не підключено — увійдіть за телефоном.', channel_phone: 'Вхід через SMS ще не підключено — увійдіть через пошту.',
    send_failed: 'Не вдалося надіслати код. Спробуйте ще раз за хвилину.', login_taken: 'Цей телефон чи пошта вже прив’язані до іншого кабінету.',
    unauthorized: 'Увійдіть, щоб продовжити.', forbidden: 'Недостатньо прав.', role: 'Ваша роль на цьому об’єкті не дозволяє цю дію.', not_found: 'Не знайдено.',
    settings: 'Перевірте налаштування.', until: 'Час має бути в межах найближчих 48 годин.', network: 'Немає зв’язку із сервером. Перевірте інтернет.',
    static: 'На цій копії сайту сервер не підключено — працює демо-кабінет.', demo: 'У демо-кабінеті це недоступно.', last_owner: 'На об’єкті має лишитися хоча б один власник.',
    demo_off: 'Демо-кабінет вимкнено.', not_configured: 'Сервер ще налаштовується.', server_error: 'Помилка сервера. Спробуйте ще раз.', name: 'Вкажіть назву.'
  };
  function message(e){ var c = e && (typeof e.code === 'string' ? e.code : e.message); if (c === 'settings' && e.data && e.data.errors && e.data.errors.length) return e.data.errors.map(function(x){ return x.m; }).join(' '); return MSG[c] || 'Щось пішло не так. Спробуйте ще раз.'; }

  var api = BASE ? live : demo;
  api.message = message;
  return api;
})();
