/* =====================================================================
   The account on every page (build.py adds this script last):
   - who is signed in: the account icon in the header shows the initial,
     the mobile menu the name;
   - an account whose e-mail is not confirmed yet gets the «підтвердьте
     пошту» card with «надіслати ще раз» (requests and the cabinet work,
     the AI agent waits for the confirmation);
   - the request basket is kept on the account: the newer side wins, and
     a guest basket joins the account's one at the first sign-in here;
   - requests sent from this browser before signing in move into the
     cabinet (their claim tokens are kept in localStorage);
   - unread replies from the team light the dot on the account icon;
   - a manager or an admin gets «Панель» in the header with new requests
     and unread client messages (instead of a Telegram bot).
   Accounts themselves are Firebase's (fb.js, loaded on demand here).
   Other scripts wait for window.Account.ready (a Promise of the user or
   null) or listen to the 'account:ready' event.
   The server sets a readable `in=1` cookie next to the HttpOnly session,
   so guests' pages do not ask /api/me at all.
   ===================================================================== */
(function(){
  'use strict';
  var A = window.Api, C = window.Cart, S = window.Site || {}, d = document;
  var Acc = window.Account = { me: null, unread: { total: 0, orders: {} }, ready: Promise.resolve(null), signedOut: signedOut, claimToken: claimToken, refresh: refresh, logout: logout, fb: fb };
  var ver = (function(){ var c = d.currentScript; return c && c.src.indexOf('?v=') > 0 ? c.src.split('?v=')[1] : ''; })();
  if (!A) return;
  var live = A.mode === 'live', OWNER = 'bess-cart-user', CLAIMS = 'bess-claims';
  function get(k){ try { return localStorage.getItem(k); } catch (e) { return null; } }
  function set(k, v){ try { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch (e) {} }
  function el(tag, cls, text){ var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }

  var signed = !live || /(?:^|;\s*)in=1(?:;|$)/.test(d.cookie);
  Acc.ready = (signed ? A.me().then(function(r){ return r && r.user || null; }, function(){ return null; }) : Promise.resolve(null)).then(function(me){
    Acc.me = me;
    head(me);
    remember(me);
    d.dispatchEvent(new CustomEvent('account:ready', { detail: me }));
    if (me && live && !me.verified && !me.demo) unconfirmed(me);
    if (me && live && !me.demo) { syncCart(me); claimMine(me); unread(); setInterval(function(){ if (d.visibilityState === 'visible') unread(); }, 90000); }
    if (me && live && me.staff && me.verified) { panel(); setInterval(function(){ if (d.visibilityState === 'visible') panel(); }, 60000); }
    return me;
  });
  function refresh(){ return A.me().then(function(r){ Acc.me = r.user; head(Acc.me); remember(Acc.me); return Acc.me; }); }
  /* what the header needs before the first paint of the next page (the boot script in build.py):
     the initial and the name, the team's panel; nothing else of the account is kept here */
  var ME = 'nrgt-me';
  function remember(me){
    d.documentElement.classList.toggle('is-in', !!me);
    if (!live) return;
    set(ME, me ? JSON.stringify({ id: me.id, ini: initial(me), name: me.name || me.email || '', staff: !!(me.staff && me.verified), admin: me.role === 'admin', warn: !me.demo && !me.verified }) : null);
  }
  /* the server's answer changed in the background (api.js keeps answers for the tab) */
  d.addEventListener('api:fresh', function(e){
    var p = e.detail && e.detail.path;
    if (p === '/me') A.me().then(function(r){ var me = r && r.user || null; if ((me && me.id) !== (Acc.me && Acc.me.id)) { A.forget && A.forget(); location.reload(); return; } Acc.me = me; head(me); remember(me); }, function(){});
    else if (p === '/unread' && Acc.me) unread();
    else if (p === '/staff/pulse' && Acc.me) panel();
  });
  d.addEventListener('api:signedout', function(){ Acc.me = null; head(null); remember(null); });

  /* ---------------- the header ---------------- */
  function initial(me){ var s = String(me.name || me.email || '?').trim(); return (s.charAt(0) || '?').toUpperCase(); }
  function head(me){
    d.querySelectorAll('[data-acct]').forEach(function(a){
      a.classList.toggle('is-in', !!me);
      var ini = a.querySelector('.acct__ini');
      if (me) {
        if (!ini) { ini = el('span', 'acct__ini'); ini.setAttribute('aria-hidden', 'true'); a.appendChild(ini); }
        ini.textContent = initial(me);
        a.setAttribute('aria-label', tx('Кабінет: ', 'Account: ') + (me.name || me.email || ''));
      } else if (ini) ini.remove();
    });
    var vc = d.querySelector('[data-vchip]'); if (vc && !(me && live && !me.demo && !me.verified)) vc.remove();
    /* a guest sees «Увійти»; once signed in — the account icon with the initial */
    d.querySelectorAll('[data-login]').forEach(function(x){ x.hidden = !!me; });
    d.querySelectorAll('[data-acct]').forEach(function(x){ x.hidden = !me; });
    var mi = d.querySelector('[data-acct-m]');
    if (mi && me) { mi.href = 'account.html'; mi.firstChild.textContent = mi.getAttribute('data-in'); var sm = mi.querySelector('small'); if (sm) sm.textContent = me.name || me.email || tx('ви увійшли', 'signed in'); }
    dot();
  }
  function dot(){
    var warn = false, n = Acc.unread.total || 0;
    d.querySelectorAll('[data-acct] .acct__dot').forEach(function(x){ x.hidden = !(warn || n); x.classList.toggle('is-warn', warn && !n); x.title = n ? tx('Нові повідомлення: ', 'New messages: ') + n : warn ? tx('Пошту не підтверджено', 'E-mail not confirmed') : ''; });
  }

  /* ---------------- the e-mail is not confirmed yet: a status in the header ----------------
     «Підтвердьте пошту» next to the account icon (build.py draws it before the first paint from the
     last page); hovering — a tap on a phone — opens a small menu: open the mailbox (popular providers
     by the address' domain; others have too many webmails to guess), send the letter again, change
     the address. The page asks Firebase by itself — on opening, on coming back to the tab and every
     30 s — and the status goes away once the address is confirmed. */
  var MAIL = [
    [/^(gmail|googlemail)\.com$/, 'Gmail', function(e, from){ return 'https://mail.google.com/mail/?authuser=' + encodeURIComponent(e) + (from ? '#search/' + encodeURIComponent('from:' + from + ' in:anywhere') : ''); }],
    [/^(outlook|hotmail|live|msn)\.[a-z.]+$/, 'Outlook', 'https://outlook.live.com/mail/0/'],
    [/^(icloud|me|mac)\.com$/, 'iCloud', 'https://www.icloud.com/mail'],
    [/^(proton\.me|pm\.me|protonmail\.(com|ch))$/, 'Proton', 'https://mail.proton.me/'],
    [/^yahoo\.[a-z.]+$/, 'Yahoo', 'https://mail.yahoo.com/'],
    [/^ukr\.net$/, 'Ukr.net', 'https://mail.ukr.net/'],
    [/^i\.ua$/, 'I.UA', 'https://mail.i.ua/'],
    [/^meta\.ua$/, 'META.UA', 'https://webmail.meta.ua/'],
    [/^gmx\.[a-z.]+$/, 'GMX', 'https://www.gmx.com/'],
    [/^aol\.com$/, 'AOL', 'https://mail.aol.com/']
  ];
  function mailbox(email, from){
    var dom = (String(email || '').split('@')[1] || '').toLowerCase();
    for (var i = 0; i < MAIL.length; i++) if (MAIL[i][0].test(dom)) return { name: MAIL[i][1], url: typeof MAIL[i][2] === 'function' ? MAIL[i][2](email, from) : MAIL[i][2] };
    return null;
  }
  function unconfirmed(me){
    var w = d.querySelector('[data-vchip]');
    if (!w) {
      var host = d.querySelector('.hdr__r'), acct = d.querySelector('[data-acct]'); if (!host || !acct) return;
      w = el('div', 'vchip'); w.setAttribute('data-vchip', '');
      var b = el('button', 'vchip__b'); b.type = 'button'; b.setAttribute('aria-expanded', 'false');
      var ic = el('i'); ic.setAttribute('aria-hidden', 'true'); b.append(ic, el('span', '', tx('Підтвердіть пошту', 'Confirm e-mail')));
      w.append(b, el('div', 'vchip__pop')); host.insertBefore(w, acct);
    }
    var pop = w.querySelector('.vchip__pop'); pop.textContent = '';
    pop.setAttribute('role', 'group'); pop.setAttribute('aria-label', tx('Підтвердження пошти', 'E-mail confirmation'));
    pop.append(el('b', '', tx('Пошта не підтверджена', 'E-mail not confirmed')), el('span', 'vchip__mail', me.email || ''));
    var acts = el('div', 'vchip__acts'), box = mailbox(me.email);
    if (box) {
      var open = el('a', 'btn btn--volt btn--sm'); open.href = box.url; open.target = '_blank'; open.rel = 'noopener'; open.appendChild(el('span', '', tx('Відкрити ', 'Open ') + box.name)); acts.appendChild(open);
      /* Gmail opens right on our letter (it comes from the Firebase project's address), spam included */
      if (box.name === 'Gmail') A.config().then(function(c){ var f = c && c.firebase && c.firebase.authDomain; if (f) open.href = mailbox(me.email, 'noreply@' + f).url; }, function(){});
    }
    var again = el('button', 'btn btn--ghost btn--sm'); again.type = 'button'; again.appendChild(el('span', '', tx('Надіслати лист ще раз', 'Send the e-mail again')));
    again.addEventListener('click', function(){
      again.disabled = true;
      fb().then(function(F){ return F.sendVerification(location.pathname.split('/').pop() || 'index.html'); })
        .then(function(){ again.firstChild.textContent = tx('Лист надіслано', 'E-mail sent'); },
          function(e){ again.disabled = false; S.toast && S.toast(e.code === 'fb_signin' ? tx('Увійдіть ще раз на цьому пристрої — і повторіть.', 'Sign in again on this device and repeat.') : A.message(e)); });
    });
    acts.appendChild(again);
    var change = el('a', 'link vchip__ch', tx('Змінити пошту', 'Change the e-mail')); change.href = 'account.html#settings';
    pop.append(acts, change);
    check(true);
    d.addEventListener('visibilitychange', function(){ if (d.visibilityState === 'visible') check(); });
    window.addEventListener('focus', function(){ check(); });
    setInterval(function(){ if (d.visibilityState === 'visible') check(); }, 30000);
  }
  /* the menu: hover on a computer (CSS), a tap toggles it; a tap elsewhere or Esc closes it */
  function vclose(){ var w = d.querySelector('.vchip.is-open'); if (w) { w.classList.remove('is-open'); w.querySelector('.vchip__b').setAttribute('aria-expanded', 'false'); } }
  d.addEventListener('click', function(e){
    var b = e.target.closest && e.target.closest('.vchip__b');
    if (b) { var w = b.parentNode, on = !w.classList.contains('is-open'); w.classList.toggle('is-open', on); b.setAttribute('aria-expanded', String(on)); return; }
    var open = d.querySelector('.vchip.is-open'); if (open && (!open.contains(e.target) || (e.target.closest && e.target.closest('a')))) vclose();
  });
  d.addEventListener('keydown', function(e){ if (e.key === 'Escape') vclose(); });
  var checked = 0, checking = false;
  function check(now){
    var me = Acc.me; if (!me || me.verified || me.demo || !live || checking || (!now && Date.now() - checked < 5000)) return;
    checked = Date.now(); checking = true;
    fb().then(function(F){ return F.check(); }).then(function(r){
      checking = false; if (!r.verified) return;
      A.forget && A.forget();
      S.toast && S.toast(tx('Пошту підтверджено', 'E-mail confirmed'));
      setTimeout(function(){ location.reload(); }, 700);
    }, function(){ checking = false; });
  }

  /* ---------------- the basket on the account ---------------- */
  var pushT = 0;
  function push(){ clearTimeout(pushT); pushT = setTimeout(function(){ A.saveCart(C.load(), C.at()).catch(function(){}); }, 700); }
  function merge(a, b){
    var out = a.map(function(x){ return Object.assign({}, x); });
    b.forEach(function(x){ var f = out.filter(function(y){ return y.key === x.key; })[0]; if (f) f.qty = Math.max(f.qty || 1, x.qty || 1); else out.push(x); });
    return out.slice(0, 30);
  }
  function syncCart(me){
    if (!C) return;
    A.cart().then(function(r){
      var srv = r.items || [], sat = r.at || 0, lat = C.at();
      if (get(OWNER) !== me.id) { set(OWNER, me.id); C.replace(merge(srv, C.load()), Date.now()); push(); }
      else if (sat > lat) C.replace(srv, sat);
      else if (lat > sat) push();
    }, function(){});
    d.addEventListener('cart:change', function(e){ if (!e.detail || e.detail.from !== 'account') push(); });
  }

  /* ---------------- requests sent before signing in ---------------- */
  function claims(){ try { var a = JSON.parse(get(CLAIMS) || '[]'); return Array.isArray(a) ? a : []; } catch (e) { return []; } }
  function claimToken(t){ if (!t) return; var a = claims(); a.push(t); set(CLAIMS, JSON.stringify(a.slice(-20))); }
  /* the person decides: a browser can be shared, or signed in to someone else's account */
  function claimMine(me){
    var a = claims(); if (!a.length || d.body.dataset.page === 'login') return;
    try { if (sessionStorage.getItem('claim-off') === me.id) return; } catch (e) {}
    var bar = el('div', 'vbar vbar--claim'); bar.setAttribute('role', 'status');
    var p = el('p'); p.append(d.createTextNode(tx('Заявки без входу: ', 'Requests without an account: ') + a.length + tx('. Перенести в кабінет ', '. Move them to ')), el('b', '', me.email || me.name || ''), d.createTextNode('?'));
    var acts = el('div', 'vbar__acts'), yes = el('button', '', tx('Перенести', 'Move them')), no = el('button', '', tx('Ні', 'No'));
    yes.type = no.type = 'button';
    yes.addEventListener('click', function(){ yes.disabled = true; A.claim(a).then(function(r){ set(CLAIMS, null); bar.remove(); if (S.toast) S.toast(r.claimed ? tx('Заявки тепер у кабінеті.', 'The requests are in your account now.') : tx('Ці заявки вже в кабінеті.', 'These requests are in an account already.')); }, function(e){ yes.disabled = false; if (S.toast) S.toast(A.message(e)); }); });
    no.addEventListener('click', function(){ bar.remove(); try { sessionStorage.setItem('claim-off', me.id); } catch (e) {} });
    acts.append(yes, no); bar.append(p, acts);
    var other = d.querySelector('.vbar'); if (other) bar.style.bottom = (other.offsetHeight + 28) + 'px';
    d.body.appendChild(bar);
  }

  /* ---------------- unread replies from the team ---------------- */
  function unread(){
    return A.unread().then(function(r){ Acc.unread = r || { total: 0, orders: {} }; dot(); d.dispatchEvent(new CustomEvent('account:unread', { detail: Acc.unread })); }, function(){});
  }

  /* Firebase in the browser, loaded when an account action needs it */
  var fbP = null;
  function fb(){
    if (window.FB) return Promise.resolve(window.FB);
    if (fbP) return fbP;
    fbP = new Promise(function(res, rej){ var sc = d.createElement('script'); sc.src = S.asset('assets/js/fb.js') + (ver ? '?v=' + ver : ''); sc.onload = function(){ res(window.FB); }; sc.onerror = function(){ fbP = null; var e = new Error('network'); e.code = 'network'; rej(e); }; d.head.appendChild(sc); });
    return fbP;
  }
  /* signing out: our session (here or everywhere), the Firebase one on this device, the basket copy here */
  function logout(all){
    return A.logout(all).catch(function(){}).then(function(){ return fb().then(function(F){ return F.signOut(); }, function(){}); }).then(signedOut);
  }
  /* signing out on this device: the basket stays on the account, not here */
  function signedOut(){ set(OWNER, null); if (C) C.replace([], 0); Acc.me = null; remember(null); A.forget && A.forget(); }

  /* ---------------- the panel of a manager / an admin ---------------- */
  function panel(){
    if (!A.staff) return;
    A.staff.pulse().then(function(r){
      var n = (r.new_orders || 0) + (r.unread || 0), a = d.querySelector('[data-panel-link]');
      if (!a) {
        var host = d.querySelector('.hdr__r'), acct = d.querySelector('[data-acct]'); if (!host || !acct) return;
        a = el('a', 'hdr-panel'); a.href = 'admin.html'; a.setAttribute('data-panel-link', '');
        a.append(el('span', '', Acc.me.role === 'admin' ? tx('Адмін', 'Admin') : tx('Панель', 'Panel')), el('b', 'hdr-panel__n'));
        host.insertBefore(a, acct);
        var mnav = d.getElementById('mnav'), ma = el('a', ''); ma.href = 'admin.html'; ma.append(d.createTextNode(Acc.me.role === 'admin' ? tx('Адмін-панель', 'Admin panel') : tx('Панель менеджера', 'Manager panel')), el('small', 'hdr-panel__m'));
        if (mnav) mnav.insertBefore(ma, mnav.querySelector('.btn') || null);
      }
      var b = a.querySelector('.hdr-panel__n'); b.textContent = n ? String(n) : ''; b.hidden = !n;
      a.title = tx('Нові заявки: ', 'New requests: ') + (r.new_orders || 0) + tx(', повідомлення: ', ', messages: ') + (r.unread || 0);
      var m = d.querySelector('.hdr-panel__m'); if (m) m.textContent = n ? String(n) : '';
    }, function(){});
  }
})();
