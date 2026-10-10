/* =====================================================================
   AI consultant — Claude behind our platform (platform/src/ai/: the API
   key never reaches the browser). Open to signed-in clients whose e-mail
   is confirmed (or who came with Google); others see what to do to open
   it, and the scripted quick picker (assistant.js) works for everyone.
   Streams the answer, shows the system it picked and the plan it sent to
   the team next to the chat — the plan is a request in the cabinet with a
   chat with a manager — and keeps the conversation id so a reload (or
   another device) restores it. On the static copy of the site (no server)
   only the quick picker is shown.
   ===================================================================== */
(function(){
  'use strict';
  var d = document, S = window.Site, P = window.PRODUCTS, K = window.KITS, A = window.Api;
  var me0 = d.currentScript, ver = me0 && me0.src.indexOf('?v=') > 0 ? me0.src.split('?v=')[1] : '';
  var $ = function(s){ return d.querySelector(s); };
  var wrap = $('#asstAgent'), demo = $('#asstDemo'); if (!wrap || !demo || !S || !A) return;
  var live = A.mode === 'live';   // the static copy shows the AI tab with its sign-in card; the quick pick works everywhere
  var BASE = String(window.APP_API || '/api').replace(/\/+$/, '');

  var nf = S.nf, KEY = 'bess-agent';
  var msgs = $('#agMsgs'), quick = $('#agQuick'), form = $('#agForm'), input = $('#agText'), sendBtn = $('#agSend'), meta = $('#agMeta'), planEl = $('#agPlan'), stateEl = $('#agState'), jump = $('#agJump');
  var tabs = $('#aModes'), tA = $('#tabAgent'), tD = $('#tabDemo'), disc = $('#aDisclaimer');
  var SEGQ = {}; [[tx('Квартира', 'Flat'), 'flat'], [tx('Приватний дім', 'Home'), 'home'], [tx('ОСББ', 'Apartment building'), 'osbb'], [tx('Бізнес', 'Business'), 'biz']].forEach(function(x){ SEGQ[x[0]] = x[1]; });
  var SEGN = { flat: tx('Квартира', 'Flat'), home: tx('Приватний дім', 'Home'), osbb: tx('ОСББ', 'Apartment building'), biz: tx('Бізнес', 'Business') };
  var GOAL = { backup: tx('резерв на час відключень', 'backup during outages'), savings: tx('економія', 'savings'), both: tx('резерв і економія', 'backup and savings') };
  var FIN = { own: tx('власні кошти', 'own funds'), credit: tx('кредит', 'a loan'), unknown: tx('ще не визначились', 'not decided yet'), other: tx('інше', 'other') };
  var BOLT = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8.9 2 4.6 8.6h3.2L6.9 14l4.5-6.6H8.2z" fill="currentColor"/></svg>';
  var st = read(), busy = false, ready = false, planEmpty = planEl.innerHTML, info = null;
  var q = new URLSearchParams(location.search), ctx = {};
  ['kit', 'p', 'seg'].forEach(function(k){ var v = q.get(k); if (v) ctx[k] = v; });

  var css = d.createElement('link'); css.rel = 'stylesheet'; css.href = S.asset('assets/css/agent.css') + (ver ? '?v=' + ver : ''); d.head.appendChild(css);

  function read(){ try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function el(tag, cls, text){ var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function uah(v){ return v == null ? tx('за запитом', 'on request') : S.uah(v); }
  function num(v){ return nf(v, v % 1 ? 1 : 0); }
  var follow = true;   /* keep the newest text in view until the reader scrolls up */
  msgs.addEventListener('scroll', function(){ follow = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 60; }, { passive: true });
  function scroll(force){ if (force) follow = true; if (follow) msgs.scrollTop = msgs.scrollHeight; }
  function api(path, opt){
    opt = opt || {}; opt.credentials = 'same-origin'; opt.headers = Object.assign({ 'x-lang': S.lang }, opt.headers || {});
    return fetch(BASE + path, opt).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ j._status = r.status; return j; }); });
  }

  /* ---------------- text: paragraphs, lists, **bold** — always as text nodes ---------------- */
  function inline(node, text){
    text.split(/(\*\*[^*\n]+\*\*)/g).forEach(function(part){
      if (/^\*\*[^*\n]+\*\*$/.test(part)) { node.appendChild(el('b', '', part.slice(2, -2))); return; }
      part.split('\n').forEach(function(s, i){ if (i) node.appendChild(el('br')); if (s) node.appendChild(d.createTextNode(s)); });
    });
  }
  function md(node, text){
    node.textContent = '';
    var list = null, para = [];
    function flush(){ if (para.length) { var p = el('p'); inline(p, para.join('\n')); node.appendChild(p); para = []; } }
    String(text).replace(/\r/g, '').split('\n').forEach(function(ln){
      if (/^\s*>>/.test(ln)) return;                        /* quick replies → chips */
      var h = ln.match(/^\s*#{1,4}\s+(.+)$/);
      if (h) { flush(); list = null; var hp = el('p'); hp.appendChild(el('b', '', h[1].replace(/\*\*/g, ''))); node.appendChild(hp); return; }
      var m = ln.match(/^\s*(?:[-•*]|(\d+)[.)])\s+(.+)$/);
      if (m) { flush(); var tag = m[1] ? 'OL' : 'UL'; if (!list || list.tagName !== tag) { list = el(tag.toLowerCase()); node.appendChild(list); } var li = el('li'); inline(li, m[2]); list.appendChild(li); return; }
      if (!ln.trim()) { flush(); list = null; return; }
      list = null; para.push(ln);
    });
    flush();
  }
  function chipsOf(text){ var m = String(text || '').match(/(?:^|\n)\s*>>\s*([^\n]+)\s*$/); return m ? m[1].split('|').map(function(s){ return s.trim(); }).filter(Boolean).slice(0, 5) : []; }

  /* ---------------- chat primitives ---------------- */
  function userMsg(text){ msgs.appendChild(el('div', 'msg msg--u', text)); scroll(true); }
  function botMsg(){ var m = el('div', 'msg msg--a'), av = el('div', 'av'), bb = el('div', 'bb'); av.innerHTML = BOLT; m.append(av, bb); msgs.appendChild(m); scroll(true); return bb; }
  function botText(text){ var bb = botMsg(), t = el('div', 'ag-t'); bb.appendChild(t); md(t, text); showChips(chipsOf(text)); return bb; }
  function showChips(list){
    quick.textContent = '';
    if (!ready) return;
    list.forEach(function(c){ var b = el('button', 'chip', c); b.type = 'button'; b.addEventListener('click', function(){ if (!st.id && SEGQ[c]) ctx.seg = SEGQ[c]; send(c); }); quick.appendChild(b); });
  }

  /* one streamed answer: text of each model step, tool status, cards in between */
  function turn(){
    var bb = botMsg(), cur = null, texts = [], raf = 0, status = null;
    var typing = el('span', 'typing'); typing.innerHTML = '<i></i><i></i><i></i>'; bb.appendChild(typing); bb.setAttribute('aria-busy', 'true');
    function seg(){ cur = { el: el('div', 'ag-t'), text: '' }; bb.insertBefore(cur.el, typing); texts.push(cur); }
    function paint(){ raf = 0; if (cur) md(cur.el, cur.text); scroll(); }
    function unstatus(){ if (status) { status.remove(); status = null; } }
    return {
      step: function(){ unstatus(); if (!cur || cur.text) seg(); },
      delta: function(t){ if (!cur) seg(); cur.text += t; if (!raf) raf = requestAnimationFrame(paint); },
      reset: function(){ if (cur) { cur.text = ''; md(cur.el, ''); } },
      status: function(t){ unstatus(); status = el('p', 'ag-status', t); bb.insertBefore(status, typing); scroll(); },
      card: function(node){ unstatus(); bb.insertBefore(node, typing); cur = null; scroll(); },
      replace: function(t){ unstatus(); bb.querySelectorAll('.ag-t,.ag-mini').forEach(function(n){ n.remove(); }); texts = []; seg(); cur.text = t; md(cur.el, t); },
      end: function(){
        if (raf) { cancelAnimationFrame(raf); paint(); }
        unstatus(); typing.remove(); bb.removeAttribute('aria-busy');
        texts.forEach(function(x){ if (!x.text.trim()) x.el.remove(); });
        if (!bb.children.length) bb.parentNode.remove();
        var last = texts.filter(function(x){ return x.text.trim(); }).pop();
        return last ? chipsOf(last.text) : [];
      }
    };
  }

  function orderHref(data){ return data.order_id ? 'account.html?site=' + encodeURIComponent(data.site_id || '') + '#orders=' + encodeURIComponent(data.order_id) : 'account.html#orders'; }
  function mini(kind, data){
    var b = el('button', 'ag-mini'), t = el('span', 'ag-mini__t'); b.type = 'button';
    if (kind === 'system') { var s = data.system; t.append(el('b', '', data.ready_kit ? tx('Комплект «', 'Kit «') + data.ready_kit.name + '»' : tx('Підібрана система', 'The system picked')), el('small', '', s.items.map(function(i){ return (i.qty > 1 ? i.qty + ' × ' : '') + i.model; }).join(' + '))); b.append(t, el('span', 'ag-mini__p', uah(s.total_uah))); }
    else { t.append(el('b', '', tx('Заявка ', 'Request ') + (data.number || data.id) + tx(' — у команди', ' is with the team')), el('small', '', tx('Чат — у кабінеті', 'Chat in your account'))); b.append(t, el('span', 'ag-mini__p', '✓')); }
    b.addEventListener('click', function(){ S.scrollToEl(planEl); });
    return b;
  }

  /* ---------------- project panel ---------------- */
  function photo(img){
    var f = el('figure', 'ph pline__ph'); if (typeof img === 'string') img = { src: img };
    if (img && img.src) { f.style.background = img.bg || '#fff'; var i = el('img'); i.src = S.asset(img.src); i.alt = ''; i.loading = 'lazy'; f.appendChild(i); }
    return f;
  }
  /* compact visuals (CSS in site.css, «AI page»): tiles, tags, a step track, a 24-hour strip; an estimate is a «≈» with a tooltip */
  var EST = tx('Орієнтовно, з ПДВ. Фінальну ціну й строк фіксує пропозиція після огляду.', 'Indicative, VAT included. The offer after the survey fixes the final price and lead time.');
  function est(title){ var a = el('abbr', 'ap-est', '≈'); a.title = title || EST; return a; }
  function strip(h){ var n = Math.max(0, Math.min(24, Math.round(h))), s = el('span', 'hstrip'); s.title = tx('Годин доби: ', 'Hours of a day: ') + n + ' / 24'; for (var i = 0; i < 24; i++) s.appendChild(el('i', i < n ? 'on' : '')); return s; }
  /* rows: { k: label, v: value, est: true, h: hours for the strip } */
  function tiles(rows){ var dl = el('dl', 'plan__kpi'); rows.filter(Boolean).forEach(function(r){ var x = el('div'), dd = el('dd', '', r.v); if (r.est) dd.appendChild(est()); if (r.sub) dd.appendChild(el('small', '', r.sub)); if (r.h) dd.appendChild(strip(r.h)); x.append(el('dt', '', r.k), dd); dl.appendChild(x); }); return dl; }
  /* tags: [text, '' | 'warn' | 'mu', tooltip?] */
  function tags(items){ var w = el('div', 'ptags'); items.filter(Boolean).forEach(function(t){ var s = el('span', 'ptag' + (t[1] ? ' ptag--' + t[1] : ''), t[0]); if (t[2]) s.title = t[2]; w.appendChild(s); }); return w; }
  function track(items){ var ol = el('ol', 'ptrack'); items.forEach(function(t){ var li = el('li', '', t[0]); if (t[1]) li.title = t[1]; ol.appendChild(li); }); return ol; }
  var AFTER_SURVEY = [tx('Монтаж і щит — після огляду', 'Installation and panel — after the survey'), 'warn', tx('Монтаж, щит з АВР і кабелі рахуємо після огляду', 'Installation, the ATS panel and cables are priced after the survey')];
  function refItems(items){ return items.map(function(i){ var p = P && P.byId(i.product_id); return [i.product_id, p && p.variants ? i.model : null, i.qty]; }); }
  function sysRef(items){ return 'sys:' + encodeURIComponent(JSON.stringify(refItems(items))); }
  function head(eyebrow, title, btns){ var top = el('div', 'plan__top'), h = el('div'), b = el('div', 'plan__btns'); h.append(el('p', 'eyebrow', eyebrow), el('h2', 'plan__t', title)); btns.forEach(function(x){ b.appendChild(x); }); top.append(h, b); planEl.appendChild(top); }
  function pulse(){ planEl.classList.remove('is-new'); void planEl.offsetWidth; planEl.classList.add('is-new'); if (jump) jump.hidden = false; }
  /* product names and stock come from the catalogue of this page's language */
  function lineName(i){ var p = P && P.byId(i.product_id); return p ? (p.variants && i.model ? p.name.replace(/\d+(–\d+)? (кВт(·год)?|kWh?)/, String(i.model).replace(/K-3PH$/, '') + tx(' кВт', ' kW')) : p.name) : i.name; }
  function stockOf(i){ var p = P && P.byId(i.product_id); return p && P.STOCK ? P.STOCK[p.stock] || '' : String(i.stock || ''); }
  /* 'in' when in stock: the catalogue key, or the server's label as a fallback */
  function stockKey(i){ var p = P && P.byId(i.product_id); return p ? p.stock : (/наявн|in stock/i.test(String(i.stock || '')) ? 'in' : ''); }

  function showSystem(data, quiet){
    var s = data.system, need = data.need || {};
    planEl.textContent = '';
    var add = el('button', 'btn btn--volt btn--sm', tx('Додати в заявку', 'Add to request')); add.type = 'button'; add.setAttribute('data-add', sysRef(s.items));
    head(tx('Система', 'System'), data.ready_kit ? tx('Комплект «', 'Kit «') + data.ready_kit.name + '»' : tx('Під ваш об’єкт', 'For your site'), [add]);
    planEl.appendChild(tiles([
      { k: tx('Корисний запас', 'Usable energy'), v: num(s.usable_kwh) + tx(' кВт·год', ' kWh') },
      { k: tx('Потужність', 'Power'), v: num(s.inverter_kw) + tx(' кВт', ' kW') },
      { k: tx('Без світла', 'In an outage'), v: s.hours_at_avg_load ? K.hoursTxt(s.hours_at_avg_load) : '—', sub: need.avg_w ? tx('при ', 'at ') + nf(need.avg_w) + tx(' Вт', ' W') : null, h: s.hours_at_avg_load },
      { k: tx('Обладнання', 'Equipment'), v: uah(s.total_uah), est: s.total_uah != null }
    ]));
    var lines = el('div', 'plines');
    s.items.forEach(function(i){
      var a = el('a', 'pline'), t = el('div', 'pline__t'); a.href = 'equipment.html?p=' + encodeURIComponent(i.product_id);
      var sm = el('small', '', i.model), sk = stockKey(i); if (stockOf(i)) sm.appendChild(el('span', 'ptag' + (sk === 'in' ? '' : ' ptag--warn'), stockOf(i).toLowerCase()));
      t.append(el('b', '', (i.qty > 1 ? i.qty + ' × ' : '') + lineName(i)), sm);
      a.append(photo(i.img), t, el('span', 'pline__p', uah(i.sum_uah))); lines.appendChild(a);
    });
    planEl.appendChild(lines);
    planEl.appendChild(tags((S.en ? [] : (s.notes || []).map(function(n){ return [n, 'mu']; })).concat([AFTER_SURVEY])));
    if (!quiet) pulse();
  }

  function showPlan(data, quiet){
    var p = data.plan, s = p.system;
    planEl.textContent = '';
    var pr = el('button', 'btn btn--ghost btn--sm', tx('Друк або PDF', 'Print or PDF')); pr.type = 'button';
    pr.addEventListener('click', function(){ d.body.classList.add('print-agent'); window.print(); setTimeout(function(){ d.body.classList.remove('print-agent'); }, 600); });
    var acc = el('a', 'btn btn--volt btn--sm', tx('Заявка й чат', 'Request and chat')); acc.href = orderHref(data);
    head(tx('Передано команді', 'With our team'), (data.number ? tx('Заявка ', 'Request ') + data.number : tx('План ', 'Plan ') + data.id), [pr, acc]);
    planEl.appendChild(tiles([{ k: tx('Об’єкт', 'Site'), v: SEGN[p.segment] || '—' }, { k: tx('Без світла', 'In an outage'), v: num(p.backup_hours) + tx(' год', ' h'), h: p.backup_hours }, { k: tx('Корисний запас', 'Usable energy'), v: num(s.usable_kwh) + tx(' кВт·год', ' kWh') }, { k: tx('Обладнання', 'Equipment'), v: uah(s.total_uah), est: s.total_uah != null }]));
    var kv = el('dl', 'ag-kv');
    [[tx('Об’єкт', 'Site'), p.object_summary + (p.location ? ' · ' + p.location : '')], [tx('Мета', 'Goal'), GOAL[p.goal]],
      [tx('Що живимо', 'What it powers'), p.loads.map(function(l){ return (l.qty > 1 ? l.qty + ' × ' : '') + l.name; }).join(', ')],
      [tx('Система', 'System'), s.items.map(function(i){ return (i.qty > 1 ? i.qty + ' × ' : '') + i.model; }).join(' + ')],
      p.placement && [tx('Місце', 'Placement'), p.placement], [tx('Фінансування', 'Financing'), (FIN[p.financing] || '—') + (p.budget ? ' · ' + p.budget : '')],
      p.timeline && [tx('Строки', 'Timing'), p.timeline], [tx('Контакт', 'Contact'), p.client_name + (p.phone ? ', ' + p.phone : '')]
    ].filter(function(r){ return r && r[1]; }).forEach(function(r){ kv.append(el('dt', '', r[0]), el('dd', '', r[1])); });
    planEl.appendChild(kv);
    if (p.open_questions && p.open_questions.length) {
      var qb = el('div', 'pstep'), ul = el('ul'); qb.appendChild(el('h3', '', tx('Уточнимо на огляді', 'To check at the survey')));
      p.open_questions.forEach(function(x){ ul.appendChild(el('li', '', x)); }); qb.appendChild(ul); planEl.appendChild(qb);
    }
    var nx = el('div', 'pstep'); nx.append(el('h3', '', tx('Що далі', 'What next')), track([
      [tx('Чат з менеджером', 'Chat with a manager'), tx('Менеджер напише в чаті заявки або зателефонує', 'A manager writes in the request’s chat or calls')],
      [tx('Огляд', 'Site survey')],
      [tx('Пропозиція', 'Offer'), tx('Фінальний склад, ціна й строк', 'The final system, price and lead time')],
      [tx('Оплата', 'Payment'), tx('Лише після пропозиції', 'Only after the offer')]]));
    planEl.appendChild(nx);
    remember(data);
    if (!quiet) pulse();
  }

  /* the request form and the quick picker read the same project key */
  function remember(data){
    var p = data.plan, s = p.system;
    try { localStorage.setItem('bess-project', JSON.stringify({ seg: p.segment, items: refItems(s.items), name: null, price: s.total_uah, kwh: s.nominal_kwh, kw: s.inverter_kw, hours: p.backup_hours, phases: p.phases, contact: { name: p.client_name, phone: p.phone }, planId: data.id, source: 'agent', at: Date.now() })); } catch (e) {}
  }

  /* ---------------- who may use it ---------------- */
  function gate(kind){
    ready = false; form.hidden = true; meta.textContent = ''; quick.textContent = '';
    var bb = botMsg(), box = el('div', 'ag-gate'), acts = el('div', 'ag-gate__b');
    var next = encodeURIComponent('assistant.html' + location.search);
    if (kind === 'guest') {
      box.appendChild(el('p', '', tx('Увійдіть — і план одразу стане вашою заявкою.', 'Sign in and the plan becomes your request at once.')));
      var up = el('a', 'btn btn--volt btn--sm', tx('Зареєструватися', 'Sign up')); up.href = 'login.html?mode=signup&next=' + next;
      var inn = el('a', 'btn btn--ghost btn--sm', tx('Увійти', 'Sign in')); inn.href = 'login.html?next=' + next;
      acts.append(up, inn);
      /* Google sign-in sits on the sign-in page (one click there) */
    } else if (kind === 'verify') {
      box.appendChild(el('p', '', tx('Підтвердьте пошту — посилання в листі.', 'Confirm your e-mail — the link is in our e-mail.')));
      var again = el('button', 'btn btn--volt btn--sm', tx('Надіслати ще раз', 'Send again')), done = el('button', 'btn btn--ghost btn--sm', tx('Я підтвердив(ла)', 'I have confirmed')); again.type = done.type = 'button';
      var fbOf = function(){ return window.Account && window.Account.fb ? window.Account.fb() : Promise.reject(Object.assign(new Error('network'), { code: 'network' })); };
      var oops = function(e){ S.toast(e.code === 'fb_signin' ? tx('Увійдіть ще раз на цьому пристрої — і повторіть.', 'Sign in again on this device and repeat.') : A.message(e)); };
      again.addEventListener('click', function(){ again.disabled = true; fbOf().then(function(F){ return F.sendVerification('assistant.html'); }).then(function(r){ again.textContent = tx('Надіслали на ', 'Sent to ') + r.to; }, function(e){ again.disabled = false; oops(e); }); });
      done.addEventListener('click', function(){ done.disabled = true; fbOf().then(function(F){ return F.refresh(); }).then(function(r){ if (r.verified) location.reload(); else { done.disabled = false; S.toast(tx('Ще не підтверджено — відкрийте посилання з листа.', 'Not confirmed yet — open the link in the e-mail.')); } }, function(e){ done.disabled = false; oops(e); }); });
      acts.append(again, done);
    } else if (kind === 'demo') {
      box.appendChild(el('p', '', tx('У демо-кабінеті недоступно. Реєстрація — хвилина.', 'Not available in the demo account. Signing up takes a minute.')));
      var su = el('a', 'btn btn--volt btn--sm', tx('Зареєструватися', 'Sign up')); su.href = 'login.html?mode=signup&next=' + next; acts.appendChild(su);
    } else {
      box.appendChild(el('p', '', kind === 'busy' ? tx('Ліміт сайту на сьогодні вичерпано.', 'The site’s limit for today is used up.') : tx('AI-агент ще не підключений.', 'The AI agent is not connected yet.')));
      var qp = el('button', 'btn btn--volt btn--sm', tx('Швидкий підбір', 'Quick pick')); qp.type = 'button'; qp.addEventListener('click', function(){ setMode('demo'); });
      var rq = el('a', 'btn btn--ghost btn--sm', tx('Заявка', 'Request')); rq.href = 'request.html';
      acts.append(qp, rq);
    }
    box.appendChild(acts); bb.appendChild(box);
  }
  function renderMeta(){
    meta.textContent = '';
    if (!info) return;
    /* messages left today: «Лишилось 12 / 30» and a thin bar */
    var w = el('span', 'ag-left'), bar = el('i', 'ag-left__bar'), fill = el('i'); w.title = tx('Повідомлень на сьогодні', 'Messages left today');
    fill.style.width = (info.daily ? Math.max(0, Math.min(100, info.left / info.daily * 100)) : 0) + '%'; bar.appendChild(fill);
    w.append(el('b', '', tx('Лишилось', 'Left')), el('span', '', info.left + ' / ' + info.daily), bar); meta.appendChild(w);
  }

  /* ---------------- sending ---------------- */
  function sse(body, on){
    var reader = body.getReader(), dec = new TextDecoder(), buf = '';
    function chunk(c){ var ev = 'message', data = ''; c.split('\n').forEach(function(l){ if (l.indexOf('event:') === 0) ev = l.slice(6).trim(); else if (l.indexOf('data:') === 0) data += l.slice(5).trim(); }); if (data) { try { on(ev, JSON.parse(data)); } catch (e) {} } }
    function pump(){ return reader.read().then(function(r){ if (r.done) { if (buf.trim()) chunk(buf); return; } buf += dec.decode(r.value, { stream: true }); var i; while ((i = buf.indexOf('\n\n')) >= 0) { chunk(buf.slice(0, i)); buf = buf.slice(i + 2); } return pump(); }); }
    return pump();
  }
  function handle(t, ev, data){
    if (ev === 'start') { if (data.id && data.id !== st.id) { st.id = data.id; st.fresh = false; save(); } }
    else if (ev === 'step') t.step();
    else if (ev === 'delta') t.delta(data.t);
    else if (ev === 'reset') t.reset();
    else if (ev === 'tool') t.status(data.name === 'submit_project_plan' ? tx('Передаю план…', 'Sending the plan…') : tx('Підбираю систему…', 'Picking a system…'));
    else if (ev === 'system') { t.card(mini('system', data)); showSystem(data); }
    else if (ev === 'plan') { t.card(mini('plan', data)); showPlan(data); }
    else if (ev === 'refusal') t.replace(tx('З цим не допоможу. Розкажіть про ваш об’єкт.', 'I can’t help with that. Tell me about your site.'));
    else if (ev === 'done') { if (data.id === null) { delete st.id; save(); } if (info) { info.left = data.left; renderMeta(); } }
    else if (ev === 'error') t.replace(data.error === 'ai_busy' ? tx('AI-агент перевантажений — спробуйте за хвилину.', 'The AI agent is busy — try again in a minute.') : tx('Немає відповіді. Спробуйте ще раз.', 'No answer. Please try again.'));
  }
  function fail(err, text){
    if (err === 'not_verified' || err === 'unauthorized') { gate(err === 'unauthorized' ? 'guest' : 'verify'); return; }
    botText({ ai_limit: A.message({ code: 'ai_limit' }), ai_busy: tx('Ліміт сайту на сьогодні вичерпано — спробуйте швидкий підбір.', 'The site’s limit for today is used up — try the quick pick.'),
      conversation_full: tx('Розмова задовга — почніть нову. План збережено.', 'The conversation is too long — start a new one. The plan is saved.'),
      ai_off: tx('AI-агент ще не підключений.', 'The AI agent is not connected yet.'), too_many: A.message({ code: 'too_many' }), too_long: tx('Задовге — до 2000 символів.', 'Too long — up to 2000 characters.'),
      not_found: tx('Розмову не знайдено — почніть нову.', 'Conversation not found — start a new one.') }[err] || tx('Не надіслано. Перевірте зв’язок.', 'Not sent. Check the connection.'));
    if (err === 'not_found') { delete st.id; save(); }
    if (!err || err === 'network' || err === 'too_long' || err === 'too_many') { input.value = text; autosize(); }
  }
  function send(text){
    text = String(text || '').trim(); if (!text || busy || !ready) return;
    quick.textContent = ''; userMsg(text); input.value = ''; autosize(); setBusy(true);
    var t = null;
    fetch(BASE + '/ai/chat', { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json', 'x-lang': S.lang }, body: JSON.stringify({ id: st.id || null, text: text, lang: S.lang, ctx: st.id ? null : ctx }) })
      .then(function(r){
        if (!r.ok || !r.body) return r.json().catch(function(){ return {}; }).then(function(j){ fail(j.error || 'failed', text); if (j.error === 'ai_limit' && info) { info.left = 0; renderMeta(); } });
        t = turn();
        return sse(r.body, function(ev, data){ handle(t, ev, data); });
      })
      .catch(function(){ if (t) t.replace(tx('Зв’язок перервався. Спробуйте ще раз.', 'The connection dropped. Please try again.')); else fail('network', text); })
      .then(function(){ if (t) showChips(t.end()); setBusy(false); });
  }
  function setBusy(b){ busy = b; form.classList.toggle('is-busy', b); sendBtn.disabled = b; }
  function autosize(){ input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; }

  /* ---------------- start ---------------- */
  function greet(){
    var k = ctx.kit && K && K.byId(ctx.kit), p = ctx.p && P && P.byId(ctx.p);
    var t = tx('Вітаю! Підберу накопичувач зі складу й передам план команді.', 'Hello! I’ll pick storage from our stock and send the plan to our team.');
    if (k) t += tx('\n\nКомплект «' + k.name + '» — перевірю, чи підійде.', '\n\nThe «' + k.name + '» kit — let me check it fits.');
    else if (p) t += tx('\n\n' + p.model + ' — перевірю, чи підійде.', '\n\n' + p.model + ' — let me check it fits.');
    t += {
      flat: tx('\n\nЩо має працювати без світла?\n>> Холодильник і роутер | Ще й бойлер | Усе необхідне', '\n\nWhat must run in a power cut?\n>> Fridge and router | Also the boiler | Everything essential'),
      home: tx('\n\nЩо має працювати без світла і скільки годин?\n>> Котел, насос, холодильник | Увесь дім | Світло й зв’язок', '\n\nWhat must run in a power cut, and for how long?\n>> Boiler, pump, fridge | The whole house | Lights and internet'),
      osbb: tx('\n\nСкільки поверхів і що має працювати без світла?\n>> Ліфт і насоси | Насоси й світло | Усе спільне', '\n\nHow many floors, and what must run in a power cut?\n>> Lift and pumps | Pumps and lights | All common areas'),
      biz: tx('\n\nЯкий бізнес і що має працювати без світла?\n>> Магазин | Офіс | Кафе чи ресторан', '\n\nWhat business, and what must run in a power cut?\n>> Shop | Office | Café or restaurant')
    }[ctx.seg] || tx('\n\nДля якого об’єкта?\n>> Квартира | Приватний дім | ОСББ | Бізнес', '\n\nWhat kind of site?\n>> Flat | Home | Apartment building | Business');
    botText(t);
  }
  /* the conversation of this browser, or — on another device — the latest one, unless «Нова розмова» was pressed here */
  function restore(){
    var path = st.id ? '/ai/chat?id=' + encodeURIComponent(st.id) : '/ai/chat';
    return api(path).then(function(r){
      if (r._status !== 200 || !r.items || !r.items.length) { if (st.id) { delete st.id; save(); } greet(); return; }
      st.id = r.id; save();
      var sys = null, plan = null, lastText = '';
      function lastBot(){ var m = msgs.lastElementChild; return m && m.classList.contains('msg--a') ? m.querySelector('.bb') : null; }
      var byPlan = {}; (r.plans || []).forEach(function(x){ byPlan[x.id] = x; });
      r.items.forEach(function(it){
        if (it.role === 'user') userMsg(it.text);
        else if (it.role === 'assistant') { var lb = lastBot(), bb = lb && lb.lastElementChild && lb.lastElementChild.classList.contains('ag-mini') ? lb : botMsg(), tt = el('div', 'ag-t'); bb.appendChild(tt); md(tt, it.text); lastText = it.text; }
        else if (it.type === 'system' || it.type === 'plan') {
          if (it.type === 'plan' && byPlan[it.data.id]) { var x = byPlan[it.data.id]; it.data.number = it.data.number || x.number; it.data.order_id = x.order_id; it.data.site_id = x.site_id; }
          (lastBot() || botMsg()).appendChild(mini(it.type, it.data)); if (it.type === 'system') sys = it.data; else plan = it.data;
        }
      });
      if (plan) showPlan(plan, true); else if (sys) showSystem(sys, true);
      if (jump) jump.hidden = !(plan || sys);
      showChips(chipsOf(lastText)); scroll(true);
    }).catch(function(){ greet(); });
  }
  function setMode(m){
    var ag = m === 'agent';
    wrap.hidden = !ag; demo.hidden = ag;
    tA.setAttribute('aria-selected', String(ag)); tD.setAttribute('aria-selected', String(!ag));
    if (disc) disc.textContent = ag ? disc.getAttribute('data-agent') : disc.getAttribute('data-demo');
    try { sessionStorage.setItem('bess-asst-mode', m); } catch (e) {}
  }

  tabs.hidden = false;
  tA.addEventListener('click', function(){ setMode('agent'); });
  tD.addEventListener('click', function(){ setMode('demo'); });
  var m0 = null; try { m0 = sessionStorage.getItem('bess-asst-mode'); } catch (e) {}
  setMode(m0 === 'demo' ? 'demo' : 'agent');
  input.addEventListener('input', autosize);
  input.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });
  form.addEventListener('submit', function(e){ e.preventDefault(); send(input.value); });
  $('#agNew').addEventListener('click', function(){ if (busy || !ready) return; st = { fresh: true }; save(); msgs.textContent = ''; quick.textContent = ''; planEl.innerHTML = planEmpty; if (jump) jump.hidden = true; greet(); });
  if (jump) jump.addEventListener('click', function(){ S.scrollToEl(planEl); });

  S.whenAccount(function(me){
    if (!live) { gate(me && me.demo ? 'demo' : 'guest'); return; }
    if (!me) { gate('guest'); return; }
    if (me.demo) { gate('demo'); return; }
    if (!me.verified) { gate('verify'); return; }
    api('/ai/status').then(function(s){
      if (s._status !== 200) { gate(s.error === 'not_verified' ? 'verify' : 'off'); return; }
      if (!s.on) { gate('off'); return; }
      if (s.busy) { gate('busy'); return; }
      info = s; ready = true; form.hidden = false; renderMeta();
      stateEl.textContent = tx('підбір і план', 'pick and plan');
      if (st.fresh && !st.id) greet(); else restore();
    }, function(){ gate('off'); });
  });
})();
