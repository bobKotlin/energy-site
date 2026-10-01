/* =====================================================================
   AI consultant — the real agent: Claude behind our Cloudflare Worker
   (agent/ in the repo; the API key never reaches the browser). Streams
   the answer, shows the system it picked and the plan it handed to the
   team next to the chat, and keeps the conversation id so a reload
   restores it. Without window.AGENT_API (agent-config.js), or when the
   worker is unreachable, the page keeps only the scripted quick picker
   (assistant.js).
   ===================================================================== */
(function(){
  'use strict';
  var d = document, S = window.Site, P = window.PRODUCTS, K = window.KITS;
  var me = d.currentScript, ver = me && me.src.indexOf('?v=') > 0 ? me.src.split('?v=')[1] : '';
  var $ = function(s){ return d.querySelector(s); };
  var wrap = $('#asstAgent'), demo = $('#asstDemo'); if (!wrap || !demo || !S) return;
  var LOCAL = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/;
  var API = String(window.AGENT_API || '').replace(/\/+$/, '');
  try {  /* local testing: ?agent_api=http://127.0.0.1:8787 on a page served from localhost */
    if (/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      var dev = new URLSearchParams(location.search).get('agent_api');
      if (dev && LOCAL.test(dev)) localStorage.setItem('bess-agent-api', dev);
      var o = localStorage.getItem('bess-agent-api'); if (o && LOCAL.test(o)) API = o;
    }
  } catch (e) {}
  if (!API) return;

  var nf = S.nf, KEY = 'bess-agent';
  var msgs = $('#agMsgs'), quick = $('#agQuick'), form = $('#agForm'), input = $('#agText'), sendBtn = $('#agSend'), meta = $('#agMeta'), planEl = $('#agPlan'), stateEl = $('#agState'), jump = $('#agJump');
  var tabs = $('#aModes'), tA = $('#tabAgent'), tD = $('#tabDemo'), disc = $('#aDisclaimer');
  var SEGQ = { 'Квартира': 'flat', 'Приватний дім': 'home', 'ОСББ': 'osbb', 'Бізнес': 'biz' };
  var SEGN = { flat: 'Квартира', home: 'Приватний дім', osbb: 'ОСББ', biz: 'Бізнес' };
  var GOAL = { backup: 'резерв на час відключень', savings: 'економія', both: 'резерв і економія' };
  var FIN = { own: 'власні кошти', grindim: 'ГрінДім', credit: 'кредит', unknown: 'ще не визначились', other: 'інше' };
  var BOLT = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8.9 2 4.6 8.6h3.2L6.9 14l4.5-6.6H8.2z" fill="currentColor"/></svg>';
  var st = read(), busy = false, access = null, plans = [], payUrl = '', freeN = 0, pending = null, planEmpty = planEl.innerHTML;
  var q = new URLSearchParams(location.search), ctx = {};
  ['kit', 'p', 'seg'].forEach(function(k){ var v = q.get(k); if (v) ctx[k] = v; });

  var css = d.createElement('link'); css.rel = 'stylesheet'; css.href = 'assets/css/agent.css' + (ver ? '?v=' + ver : ''); d.head.appendChild(css);

  function read(){ try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch (e) { return {}; } }
  function save(){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }
  function el(tag, cls, text){ var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function uah(v){ return v == null ? 'за запитом' : nf(Math.round(v)) + ' ₴'; }
  function num(v){ return nf(v, v % 1 ? 1 : 0); }
  function date(t){ return t ? new Date(t).toLocaleDateString('uk-UA', { day: '2-digit', month: '2-digit' }) : ''; }
  var follow = true;   /* keep the newest text in view until the reader scrolls up */
  msgs.addEventListener('scroll', function(){ follow = msgs.scrollHeight - msgs.scrollTop - msgs.clientHeight < 60; }, { passive: true });
  function scroll(force){ if (force) follow = true; if (follow) msgs.scrollTop = msgs.scrollHeight; }
  function api(path, opt){ return fetch(API + path, opt).then(function(r){ return r.json().catch(function(){ return {}; }).then(function(j){ j._status = r.status; return j; }); }); }

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

  function mini(kind, data){
    var b = el('button', 'ag-mini'); b.type = 'button';
    if (kind === 'system') { var s = data.system; b.append(el('b', '', data.ready_kit ? 'Комплект «' + data.ready_kit.name + '»' : 'Підібрана система'), el('small', '', s.items.map(function(i){ return (i.qty > 1 ? i.qty + ' × ' : '') + i.model; }).join(' + ') + ' · ' + uah(s.total_uah))); }
    else b.append(el('b', '', 'План ' + data.id + ' передано інженеру'), el('small', '', 'Він зв’яжеться, щоб домовитися про огляд'));
    b.addEventListener('click', function(){ S.scrollToEl(planEl); });
    return b;
  }

  /* ---------------- project panel ---------------- */
  function photo(img){
    var f = el('figure', 'ph pline__ph'); if (typeof img === 'string') img = { src: img };
    if (img && img.src) { f.style.background = img.bg || '#fff'; var i = el('img'); i.src = img.src; i.alt = ''; i.loading = 'lazy'; f.appendChild(i); }
    return f;
  }
  function kpis(rows){ var dl = el('dl', 'plan__kpi'); rows.forEach(function(r){ var x = el('div'); x.append(el('dt', '', r[0]), el('dd', '', r[1])); dl.appendChild(x); }); return dl; }
  function refItems(items){ return items.map(function(i){ var p = P && P.byId(i.product_id); return [i.product_id, p && p.variants ? i.model : null, i.qty]; }); }
  function sysRef(items){ return 'sys:' + encodeURIComponent(JSON.stringify(refItems(items))); }
  function head(eyebrow, title, btns){ var top = el('div', 'plan__top'), h = el('div'), b = el('div', 'plan__btns'); h.append(el('p', 'eyebrow', eyebrow), el('h2', 'plan__t', title)); btns.forEach(function(x){ b.appendChild(x); }); top.append(h, b); planEl.appendChild(top); }
  function pulse(){ planEl.classList.remove('is-new'); void planEl.offsetWidth; planEl.classList.add('is-new'); if (jump) jump.hidden = false; }

  function showSystem(data, quiet){
    var s = data.system, need = data.need || {};
    planEl.textContent = '';
    var add = el('button', 'btn btn--volt btn--sm', 'Додати в заявку'); add.type = 'button'; add.setAttribute('data-add', sysRef(s.items));
    head('Підібрана система', data.ready_kit ? 'Комплект «' + data.ready_kit.name + '»' : 'Система під ваш об’єкт', [add]);
    planEl.appendChild(kpis([
      ['Корисний запас', num(s.usable_kwh) + ' кВт·год'],
      ['Потужність', num(s.inverter_kw) + ' кВт'],
      ['Протримає', s.hours_at_avg_load ? K.hoursTxt(s.hours_at_avg_load) + (need.avg_w ? ' при ' + nf(need.avg_w) + ' Вт' : '') : '—'],
      ['Обладнання', uah(s.total_uah)]
    ]));
    var lines = el('div', 'plines');
    s.items.forEach(function(i){
      var a = el('a', 'pline'), t = el('div', 'pline__t'); a.href = i.url;
      t.append(el('b', '', (i.qty > 1 ? i.qty + ' × ' : '') + i.name), el('small', '', i.model + ' · ' + String(i.stock).toLowerCase()));
      a.append(photo(i.img), t, el('span', 'pline__p', uah(i.sum_uah))); lines.appendChild(a);
    });
    planEl.appendChild(lines);
    (s.notes || []).forEach(function(n){ planEl.appendChild(el('p', 'plan__note', n)); });
    if (data.grindim) {
      var g = el('div', 'pstep');
      g.append(el('h3', '', 'З програмою ГрінДім'), el('p', '', 'Компенсація до ' + uah(data.grindim.compensation_uah) + ' · частка ОСББ від ' + uah(data.grindim.osbb_share_uah) + '.'), el('p', 'plan__note', 'Від вартості обладнання; ліміт 2 млн ₴, для будинків понад 8 000 м² — до 4 млн ₴. Вимоги програми до обладнання перевіримо перед заявкою.'));
      planEl.appendChild(g);
    }
    planEl.appendChild(el('p', 'plan__note', 'Ціни орієнтовні, з ПДВ. Монтаж, щит з АВР і кабелі — після огляду; фінальну ціну й строк фіксує пропозиція.'));
    if (!quiet) pulse();
  }

  function showPlan(data, quiet){
    var p = data.plan, s = p.system;
    planEl.textContent = '';
    var pr = el('button', 'btn btn--ghost btn--sm', 'Друкувати або PDF'); pr.type = 'button';
    pr.addEventListener('click', function(){ d.body.classList.add('print-agent'); window.print(); setTimeout(function(){ d.body.classList.remove('print-agent'); }, 600); });
    var acc = el('a', 'btn btn--volt btn--sm', 'Кабінет'); acc.href = 'account.html';
    head('План передано інженеру', 'План ' + data.id, [pr, acc]);
    planEl.appendChild(kpis([['Об’єкт', SEGN[p.segment] || '—'], ['Автономія', num(p.backup_hours) + ' год'], ['Корисний запас', num(s.usable_kwh) + ' кВт·год'], ['Обладнання', uah(s.total_uah)]]));
    var kv = el('dl', 'ag-kv');
    [['Об’єкт', p.object_summary + (p.location ? ' · ' + p.location : '')], ['Мета', GOAL[p.goal]],
      ['Що живимо', p.loads.map(function(l){ return (l.qty > 1 ? l.qty + ' × ' : '') + l.name; }).join(', ')],
      ['Система', s.items.map(function(i){ return (i.qty > 1 ? i.qty + ' × ' : '') + i.model; }).join(' + ')],
      p.placement && ['Місце', p.placement], ['Фінансування', (FIN[p.financing] || '—') + (p.budget ? ' · ' + p.budget : '')],
      p.timeline && ['Строки', p.timeline], ['Контакт', p.client_name + ', ' + p.phone]
    ].filter(function(r){ return r && r[1]; }).forEach(function(r){ kv.append(el('dt', '', r[0]), el('dd', '', r[1])); });
    planEl.appendChild(kv);
    if (p.open_questions && p.open_questions.length) {
      var qb = el('div', 'pstep'), ul = el('ul'); qb.appendChild(el('h3', '', 'Що уточнить інженер на огляді'));
      p.open_questions.forEach(function(x){ ul.appendChild(el('li', '', x)); }); qb.appendChild(ul); planEl.appendChild(qb);
    }
    var nx = el('div', 'pstep'); nx.append(el('h3', '', 'Що далі'), el('p', '', 'Інженер зв’яжеться, щоб домовитися про огляд. Після огляду — пропозиція з фінальним складом, ціною й строком; оплата лише після неї.'));
    planEl.appendChild(nx);
    remember(data);
    if (!quiet) pulse();
  }

  /* the account page reads the same keys the quick picker and the request form write */
  function remember(data){
    var p = data.plan, s = p.system;
    try {
      localStorage.setItem('bess-project', JSON.stringify({ seg: p.segment, items: refItems(s.items), name: null, price: s.total_uah, kwh: s.nominal_kwh, kw: s.inverter_kw, hours: p.backup_hours, phases: p.phases, contact: { name: p.client_name, phone: p.phone }, planId: data.id, source: 'agent', at: Date.now() }));
      var snap = window.Cart && window.Cart.snapshot(sysRef(s.items));
      if (snap) { snap.qty = 1; localStorage.setItem('bess-lead', JSON.stringify({ at: Date.now(), items: [snap], total: s.total_uah || 0, install: s.install, grindim: p.financing === 'grindim', who: p.segment, region: p.location, msg: 'План ' + data.id + ' від AI-консультанта', contact: { name: p.client_name, phone: p.phone }, planId: data.id })); }
    } catch (e) {}
  }

  /* ---------------- access ---------------- */
  function codeWhy(e){ return { code_not_found: 'Такого коду немає — перевірте, будь ласка', code_expired: 'Строк дії коду минув', code_used_up: 'Повідомлення за цим кодом закінчились', code_revoked: 'Код більше не діє' }[e] || 'Код не підійшов'; }
  function renderAccess(){
    meta.textContent = '';
    var a = access || {}, t = '';
    if (a.kind === 'free') t = 'Безкоштовно сьогодні: ' + a.msgs_left + ' з ' + freeN + ' повідомлень';
    else if (a.kind === 'one' || a.kind === 'sub') t = (a.kind === 'one' ? 'Разова консультація' : 'Підписка') + ' · лишилось ' + a.msgs_left + ' повідомлень' + (a.expires_at ? ' · до ' + date(a.expires_at) : '');
    else if (a.error) t = 'Потрібен доступ до консультації';
    meta.appendChild(el('span', '', t));
    var b = el('button', 'ag-link', st.code ? 'Інший код' : 'Маю код доступу'); b.type = 'button'; b.addEventListener('click', codeForm); meta.appendChild(b);
    stateEl.textContent = a.kind === 'one' ? 'разова консультація' : a.kind === 'sub' ? 'підписка' : 'консультація й план для інженера';
  }
  function codeForm(){
    meta.textContent = '';
    var f = el('form', 'ag-code'), i = el('input', 'input'), ok = el('button', 'btn btn--volt btn--sm', 'Активувати'), x = el('button', 'ag-link', 'Скасувати');
    i.placeholder = 'NRG-XXXX-XXXX'; i.maxLength = 24; i.autocomplete = 'off'; i.setAttribute('aria-label', 'Код доступу'); i.value = st.code || '';
    ok.type = 'submit'; x.type = 'button'; x.addEventListener('click', renderAccess);
    f.append(i, ok, x); meta.appendChild(f); i.focus();
    f.addEventListener('submit', function(e){
      e.preventDefault(); var code = i.value.trim(); if (!code) return; ok.disabled = true;
      api('/status?code=' + encodeURIComponent(code)).then(function(s){
        ok.disabled = false;
        if (s.access && (s.access.kind === 'one' || s.access.kind === 'sub')) {
          st.code = code; save(); access = s.access; renderAccess(); S.toast('Код активовано — можна продовжувати');
          msgs.querySelectorAll('.ag-pay').forEach(function(n){ n.closest('.msg').remove(); });
          if (pending) { input.value = pending; pending = null; autosize(); input.focus(); }
        } else S.toast(codeWhy(s.access && s.access.error));
      }).catch(function(){ ok.disabled = false; S.toast('Не вдалося перевірити код'); });
    });
  }
  function paywall(info, text){
    pending = text;
    msgs.querySelectorAll('.ag-pay').forEach(function(n){ n.closest('.msg').remove(); });
    var bb = botMsg(), box = el('div', 'ag-pay'), grid = el('div', 'ag-plans');
    var why = { paywall: 'Безкоштовні повідомлення на сьогодні закінчились.', code_used_up: 'Повідомлення за вашим кодом закінчились.', code_expired: 'Строк дії коду минув.', code_not_found: 'Код не знайдено.', code_revoked: 'Код більше не діє.' }[info.error] || 'Щоб продовжити, потрібен доступ.';
    box.appendChild(el('p', '', why + ' Продовжити консультацію з того ж місця можна з доступом:'));
    (info.plans || plans).forEach(function(pl){
      var one = pl.kind === 'one', c = el('div', 'ag-plan'), ul = el('ul');
      c.append(el('b', '', one ? 'Разова консультація' : 'Підписка'), el('span', 'ag-plan__p', pl.price || 'ціну назве менеджер'));
      (one ? ['один об’єкт: розмова, підбір і план для інженера', pl.msgs + ' повідомлень протягом ' + pl.days + ' днів', 'інженер переглядає план і домовляється про огляд']
           : ['кілька об’єктів і повторні консультації', pl.msgs + ' повідомлень на ' + pl.days + ' днів', 'для голів ОСББ, управителів і бізнесу з кількома точками']).forEach(function(t){ ul.appendChild(el('li', '', t)); });
      var btn = el(payUrl ? 'a' : 'button', 'btn btn--sm ' + (one ? 'btn--volt' : 'btn--ghost'), 'Отримати доступ');
      if (payUrl) { btn.href = payUrl; btn.target = '_blank'; btn.rel = 'noopener'; } else { btn.type = 'button'; btn.addEventListener('click', function(){ reqForm(box, pl.kind); }); }
      c.append(ul, btn); grid.appendChild(c);
    });
    box.appendChild(grid);
    var alt = el('p', 'plan__note'), code = el('button', 'ag-link', 'Маю код доступу'), qp = el('button', 'ag-link', 'швидкий підбір'), rq = el('a', 'ag-link', 'заявка без консультації');
    code.type = 'button'; code.addEventListener('click', codeForm); qp.type = 'button'; qp.addEventListener('click', function(){ setMode('demo'); }); rq.href = 'request.html';
    alt.append(code, d.createTextNode(' · безкоштовно: '), qp, d.createTextNode(' або '), rq);
    box.appendChild(alt); bb.appendChild(box); scroll(true);
  }
  function reqForm(box, kind){
    var old = box.querySelector('.ag-req'); if (old) old.remove();
    var f = el('form', 'ag-req cform'), n = el('input', 'input'), ph = el('input', 'input'), b = el('button', 'btn btn--volt btn--sm', 'Надіслати');
    n.placeholder = 'Ім’я'; n.autocomplete = 'name'; ph.placeholder = 'Телефон'; ph.type = 'tel'; ph.required = true; ph.autocomplete = 'tel'; b.type = 'submit';
    n.setAttribute('aria-label', 'Ім’я'); ph.setAttribute('aria-label', 'Телефон');
    try { var pj = JSON.parse(localStorage.getItem('bess-project') || 'null'); if (pj && pj.contact) { n.value = pj.contact.name || ''; ph.value = pj.contact.phone || ''; } } catch (e) {}
    f.append(n, ph, b); box.appendChild(f); (ph.value ? b : ph).focus();
    f.addEventListener('submit', function(e){
      e.preventDefault(); if (!f.reportValidity()) return; b.disabled = true;
      api('/access-request', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ kind: kind, name: n.value.trim(), phone: ph.value.trim(), id: st.id || null }) }).then(function(r){
        if (r._status === 200) f.replaceWith(el('p', 'ag-ok', 'Дякуємо! Менеджер надішле посилання на оплату й код доступу. Введіть код тут — розмова продовжиться з того ж місця.'));
        else { b.disabled = false; S.toast(r.error === 'phone' ? 'Перевірте номер телефону' : r.error === 'too_many' ? 'Запит уже надіслано — менеджер зв’яжеться' : 'Не вдалося надіслати, спробуйте ще раз'); }
      }).catch(function(){ b.disabled = false; S.toast('Немає зв’язку, спробуйте ще раз'); });
    });
  }

  /* ---------------- sending ---------------- */
  function sse(body, on){
    var reader = body.getReader(), dec = new TextDecoder(), buf = '';
    function chunk(c){ var ev = 'message', data = ''; c.split('\n').forEach(function(l){ if (l.indexOf('event:') === 0) ev = l.slice(6).trim(); else if (l.indexOf('data:') === 0) data += l.slice(5).trim(); }); if (data) { try { on(ev, JSON.parse(data)); } catch (e) {} } }
    function pump(){ return reader.read().then(function(r){ if (r.done) { if (buf.trim()) chunk(buf); return; } buf += dec.decode(r.value, { stream: true }); var i; while ((i = buf.indexOf('\n\n')) >= 0) { chunk(buf.slice(0, i)); buf = buf.slice(i + 2); } return pump(); }); }
    return pump();
  }
  function handle(t, ev, data){
    if (ev === 'start') { if (data.id && data.id !== st.id) { st.id = data.id; save(); } }
    else if (ev === 'step') t.step();
    else if (ev === 'delta') t.delta(data.t);
    else if (ev === 'reset') t.reset();
    else if (ev === 'tool') t.status(data.name === 'submit_project_plan' ? 'Передаю план інженеру…' : 'Підбираю систему з каталогу…');
    else if (ev === 'system') { t.card(mini('system', data)); showSystem(data); }
    else if (ev === 'plan') { t.card(mini('plan', data)); showPlan(data); }
    else if (ev === 'refusal') t.replace(data.text);
    else if (ev === 'done') { if (data.access) { access = data.access; renderAccess(); } }
    else if (ev === 'error') t.replace(data.error === 'overloaded' ? 'Консультант зараз перевантажений. Спробуйте ще раз за хвилину.' : 'Не вдалося отримати відповідь. Спробуйте ще раз.');
  }
  function fail(err, text){
    botText({ busy: 'AI-консультант на сьогодні вичерпав ліміт. Скористайтеся швидким підбором або залиште заявку — інженер зв’яжеться.', conversation_full: 'Розмова вже дуже довга. Почніть нову — підібрана система й план збережені.', not_configured: 'AI-консультант ще не підключений. Скористайтеся швидким підбором.', too_long_message: 'Повідомлення задовге — до 2000 символів.' }[err] || 'Немає зв’язку з консультантом. Перевірте інтернет і спробуйте ще раз.');
    if (!err || err === 'network' || err === 'too_long_message') { input.value = text; autosize(); }
  }
  function send(text){
    text = String(text || '').trim(); if (!text || busy) return;
    quick.textContent = ''; userMsg(text); input.value = ''; autosize(); setBusy(true);
    var t = null;
    fetch(API + '/chat', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ id: st.id || null, text: text, code: st.code || null, ctx: st.id ? null : ctx }) })
      .then(function(r){
        if (r.status === 402) return r.json().then(function(j){ access = j.access || access; renderAccess(); paywall(j, text); });
        if (!r.ok || !r.body) return r.json().catch(function(){ return {}; }).then(function(j){ fail(j.error || 'failed', text); });
        t = turn();
        return sse(r.body, function(ev, data){ handle(t, ev, data); });
      })
      .catch(function(){ if (t) t.replace('Зв’язок перервався. Спробуйте ще раз.'); else fail('network', text); })
      .then(function(){ if (t) showChips(t.end()); setBusy(false); });
  }
  function setBusy(b){ busy = b; form.classList.toggle('is-busy', b); sendBtn.disabled = b; }
  function autosize(){ input.style.height = 'auto'; input.style.height = Math.min(input.scrollHeight, 140) + 'px'; }

  /* ---------------- start ---------------- */
  function greet(){
    var k = ctx.kit && K && K.byId(ctx.kit), p = ctx.p && P && P.byId(ctx.p);
    var t = 'Вітаю! Я AI-консультант з накопичувачів енергії. Розпитаю про ваш об’єкт, підберу систему з нашого складу й передам готовий план інженеру.';
    if (k) t += '\n\nБачу, вас цікавить комплект «' + k.name + '» — перевірю, чи він вам підходить.';
    else if (p) t += '\n\nБачу, ви дивились ' + p.model + ' — підкажу, чи підійде ця модель.';
    t += {
      flat: '\n\nЩо має працювати під час відключень?\n>> Холодильник і роутер | Ще й бойлер | Усе необхідне',
      home: '\n\nЩо має працювати під час відключень і скільки годин?\n>> Котел, насос, холодильник | Увесь дім | Світло й зв’язок',
      osbb: '\n\nРозкажіть про будинок: скільки поверхів і що має працювати під час відключень?\n>> Ліфт і насоси | Насоси й світло | Усе спільне',
      biz: '\n\nЯкий у вас бізнес і що має працювати під час відключень?\n>> Магазин | Офіс | Кафе чи ресторан'
    }[ctx.seg] || '\n\nДля якого об’єкта шукаєте резерв?\n>> Квартира | Приватний дім | ОСББ | Бізнес';
    botText(t);
  }
  function restore(){
    return api('/conversation/' + encodeURIComponent(st.id)).then(function(r){
      if (r._status !== 200 || !r.items || !r.items.length) { delete st.id; save(); greet(); return; }
      var sys = null, plan = null, lastText = '';
      function lastBot(){ var m = msgs.lastElementChild; return m && m.classList.contains('msg--a') ? m.querySelector('.bb') : null; }
      r.items.forEach(function(it){
        if (it.role === 'user') userMsg(it.text);
        else if (it.role === 'assistant') { var lb = lastBot(), bb = lb && lb.lastElementChild && lb.lastElementChild.classList.contains('ag-mini') ? lb : botMsg(), tt = el('div', 'ag-t'); bb.appendChild(tt); md(tt, it.text); lastText = it.text; }
        else if (it.type === 'system' || it.type === 'plan') { (lastBot() || botMsg()).appendChild(mini(it.type, it.data)); if (it.type === 'system') sys = it.data; else plan = it.data; }
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
  function status(){ return api('/status' + (st.code ? '?code=' + encodeURIComponent(st.code) : '')); }

  status().then(function(s){
    if (s._status !== 200 || !(s.ready || s.busy)) return;
    if (st.code && s.access && s.access.error) {                       /* the code ran out — carry on with the free part */
      S.toast(codeWhy(s.access.error)); delete st.code; save();
      return status().then(start);
    }
    start(s);
  }).catch(function(){ /* worker unreachable: the quick picker stays */ });

  function start(s){
    access = s.access; plans = s.plans || []; payUrl = s.pay_url || ''; freeN = s.free || 0;
    tabs.hidden = false;
    tA.addEventListener('click', function(){ setMode('agent'); });
    tD.addEventListener('click', function(){ setMode('demo'); });
    var m = null; try { m = sessionStorage.getItem('bess-asst-mode'); } catch (e) {}
    setMode(m === 'demo' ? 'demo' : 'agent');
    renderAccess();
    input.addEventListener('input', autosize);
    input.addEventListener('keydown', function(e){ if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); send(input.value); } });
    form.addEventListener('submit', function(e){ e.preventDefault(); send(input.value); });
    $('#agNew').addEventListener('click', function(){ if (busy) return; delete st.id; save(); msgs.textContent = ''; quick.textContent = ''; planEl.innerHTML = planEmpty; if (jump) jump.hidden = true; greet(); });
    if (jump) jump.addEventListener('click', function(){ S.scrollToEl(planEl); });
    if (s.busy) botText('AI-консультант на сьогодні вичерпав ліміт. Скористайтеся швидким підбором або залиште заявку — інженер зв’яжеться.');
    else if (st.id) restore(); else greet();
  }
})();
