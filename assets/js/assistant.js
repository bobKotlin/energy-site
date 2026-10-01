/* =====================================================================
   Personal project assistant — prototype. Three questions → a system
   from our own stock (window.KITS / window.PRODUCTS) → a step-by-step plan
   of how it will be built: what we install, where it stands, how it is
   wired, the installation day, documents, life after start-up. Answers
   are generated from the real product data; in production the same UI
   talks to an LLM grounded in this data and the handbook.
   What we get back: a qualified lead (contact to save the plan), the kit
   chosen from our stock, and for ОСББ a meeting pack that carries our offer.
   ===================================================================== */
(function(){
  'use strict';
  var S = window.Site, P = window.PRODUCTS, K = window.KITS; if (!P || !K) return;
  var d = document, $ = function(s){ return d.querySelector(s); };
  var nf = S.nf, RM = S.RM;
  var msgs = $('#aMsgs'), quick = $('#aQuick'), form = $('#aForm'), input = $('#aAsk'), planEl = $('#aPlan');
  if (!msgs) return;
  var SEGQ = { flat: 'Квартира', home: 'Приватний дім', osbb: 'ОСББ', biz: 'Бізнес' };
  var st = { seg: null, loads: [], hours: null, phases: null, kit: null, contact: null };
  try { var saved = JSON.parse(localStorage.getItem('bess-project') || 'null'); if (saved && saved.contact) st.contact = saved.contact; } catch (e) {}

  function uah(v){ return nf(Math.round(v)) + ' ₴'; }
  function lc(t){ return t.charAt(0).toLowerCase() + t.slice(1); }
  function el(tag, cls, text){ var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function scroll(){ msgs.scrollTop = msgs.scrollHeight; }
  var BOLT = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8.9 2 4.6 8.6h3.2L6.9 14l4.5-6.6H8.2z" fill="currentColor"/></svg>';

  /* ---------------- chat primitives ---------------- */
  function user(text){ var m = el('div', 'msg msg--u', text); msgs.appendChild(m); scroll(); }
  function bot(parts, done){
    var m = el('div', 'msg msg--a'), av = el('div', 'av'); av.innerHTML = BOLT; var bb = el('div', 'bb'); m.append(av, bb); msgs.appendChild(m);
    var t = el('span', 'typing'); t.innerHTML = '<i></i><i></i><i></i>'; bb.appendChild(t); scroll();
    setTimeout(function(){ t.remove(); (Array.isArray(parts) ? parts : [parts]).forEach(function(p){ bb.appendChild(typeof p === 'string' ? el('p', '', p) : p); }); scroll(); if (done) done(bb); }, RM ? 0 : 420 + Math.random() * 280);
  }
  function list(items){ var ul = el('ul'); items.forEach(function(t){ ul.appendChild(el('li', '', t)); }); return ul; }
  function chips(opts, multi, onDone){
    quick.textContent = ''; var sel = {};
    opts.forEach(function(o){
      var b = el('button', 'chip', o[1]); b.type = 'button';
      if (multi) { b.setAttribute('aria-pressed', String(!!o[2])); if (o[2]) sel[o[0]] = 1; b.addEventListener('click', function(){ var on = b.getAttribute('aria-pressed') !== 'true'; b.setAttribute('aria-pressed', String(on)); if (on) sel[o[0]] = 1; else delete sel[o[0]]; }); }
      else b.addEventListener('click', function(){ quick.textContent = ''; user(o[1]); onDone(o[0]); });
      quick.appendChild(b);
    });
    if (multi) { var ok = el('button', 'btn btn--volt btn--sm', 'Готово'); ok.type = 'button'; ok.addEventListener('click', function(){ var keys = Object.keys(sel); if (!keys.length) return S.toast('Оберіть хоча б одне'); quick.textContent = ''; user(opts.filter(function(o){ return sel[o[0]]; }).map(function(o){ return o[1]; }).join(', ')); onDone(keys); }); quick.appendChild(ok); }
  }
  function actions(list){ quick.textContent = ''; list.forEach(function(a){ var b = el('button', a[2] ? 'btn btn--volt btn--sm' : 'chip', a[0]); b.type = 'button'; b.addEventListener('click', a[1]); quick.appendChild(b); }); }

  /* ---------------- sizing ---------------- */
  function loadRows(){ return (K.LOADS[st.seg] || []).filter(function(r){ return st.loads.indexOf(r[0]) >= 0; }); }
  function avgW(){ return loadRows().reduce(function(s, r){ return s + r[2]; }, 0); }
  function need(){
    var rows = loadRows(), avg = avgW(), peak = rows.reduce(function(m, r){ return Math.max(m, r[3]); }, 0);
    var use = avg * (st.hours || 8) / 1000 / .92, pow = Math.max(avg * 2, peak / 2) / 1000;
    return { use: use, pow: pow, avg: avg };
  }
  function pickKit(){
    if (st.kit && st.kit.fixed) return st.kit;
    var n = need(); st.kit = K.compose({ who: st.seg, usable: n.use, pow: n.pow, phases: st.phases === 3 ? 3 : 1 }); return st.kit;
  }
  function ref(kit){ return kit.custom ? 'sys:' + encodeURIComponent(JSON.stringify(kit.items)) : 'kit:' + kit.id; }

  /* ---------------- product facts for the plan ---------------- */
  function row(p, re){ var out = null; (p.groups || []).forEach(function(g){ g[1].forEach(function(r){ if (!out && re.test(r[0])) out = r[1]; }); }); return out; }
  function dims(p){ return p.dims ? p.dims.map(function(x){ return nf(x); }).join(' × ') + ' мм' : null; }
  function stationary(s){ return s.lines.filter(function(l){ return l.p.cat !== 'portable'; }); }
  function placement(s){
    var out = [], L = s.lines;
    if (!stationary(s).length) { out.push('Станція стоїть поруч із технікою: полиця, підлога чи тумба. Вентиляційні отвори не закривати.'); out.push('Вага ' + nf(L[0].p.kg) + ' кг, габарити ' + dims(L[0].p) + '.'); return out; }
    L.forEach(function(l){
      var p = l.p, bits = [];
      if (dims(p)) bits.push(dims(p)); if (p.kg) bits.push(nf(p.kg, p.kg % 1 ? 1 : 0) + ' кг' + (l.qty > 1 ? ' кожна' : ''));
      var mnt = row(p, /^Монтаж/); if (mnt) bits.push(mnt); if (p.ip) bits.push(p.ip);
      out.push((l.qty > 1 ? l.qty + ' × ' : '') + l.model + ': ' + bits.join(' · ') + '.');
    });
    var heavy = L.some(function(l){ return l.p.kg > 100; }), wall = L.some(function(l){ return /настін/i.test(l.p.name); });
    var temp = L.map(function(l){ return row(l.p, /Температура|температура/); }).filter(Boolean)[0];
    if (wall) out.push('Настінні батареї кріпимо на капітальну стіну: вона має витримати вагу батареї з запасом.');
    if (heavy) out.push('Підлога — рівна й тверда: одна шафа важить понад 100 кг.');
    if (temp) out.push('Температура: ' + temp + '. Узимку — в опалюваному приміщенні або там, де не буває морозу.');
    var noisy = L.map(function(l){ return row(l.p, /Охолодження|Шум/); }).filter(function(v){ return v && /дБ/.test(v); })[0];
    if (noisy) out.push('Під навантаженням працюють вентилятори (' + noisy + ') — краще технічне приміщення, не спальня.');
    if (st.seg === 'osbb') out.push('Для будинку — технічне приміщення поруч із вводом або електрощитовою: коротші кабелі й доступ лише для обслуги.');
    return out;
  }
  function chain(s){
    var box = el('div', 'chain'), L = s.lines, stat = stationary(s).length > 0;
    function node(label, img, cap){
      var n = el('div', 'chain__n');
      if (img) { var f = el('figure', 'ph chain__ph'); f.style.background = img.bg; var i = d.createElement('img'); i.src = img.src; i.alt = ''; i.loading = 'lazy'; f.appendChild(i); n.appendChild(f); }
      else n.appendChild(el('span', 'chain__ic', ''));
      n.appendChild(el('b', '', label)); if (cap) n.appendChild(el('small', '', cap)); box.appendChild(n);
      box.appendChild(el('span', 'chain__arr', '→'));
    }
    if (!stat) { node('Розетка', null, 'заряд від мережі'); node(L[0].model, L[0].img, 'режим UPS'); node('Ваша техніка', null, loadRows().map(function(r){ return lc(r[1]); }).slice(0, 3).join(', ')); }
    else {
      node('Мережа', null, 'ввід у будинок'); node('Щит з АВР', null, 'автоматичне перемикання');
      L.forEach(function(l){ node(l.p.cat === 'inverter' ? 'Інвертор' : l.p.cat === 'aio' ? 'Моноблок' : 'Батарея' + (l.qty > 1 ? ' × ' + l.qty : ''), l.img, l.model); });
      node('Навантаження', null, loadRows().map(function(r){ return lc(r[1]); }).slice(0, 3).join(', '));
    }
    box.lastChild.remove(); return box;
  }
  function wiring(s){
    var inv = s.lines.filter(function(l){ return l.p.cat === 'inverter' || l.p.cat === 'aio'; })[0], sw = inv ? row(inv.p, /Перемикання/) : null;
    if (!stationary(s).length) return ['Вмикаєте станцію в розетку, а техніку — в станцію. Коли світло зникає, вона продовжує живити техніку без перерви.', 'Потужні прилади вмикайте по черзі: сумарно не більше ' + nf(s.kw * 1000) + ' Вт.'];
    var out = ['Під’єднуємо до вводу через щит з автоматичним введенням резерву (АВР): зникла мережа — інвертор перемикається' + (sw ? ' за ' + sw.replace(/^<\s*/, 'менш ніж ') : '') + ', ви цього не помічаєте.',
      st.seg === 'osbb' ? 'Від накопичувача живимо лише спільні лінії: ліфт, насоси, освітлення, ІТП. Квартири лишаються на мережі — так запас триває довше.' : 'Від накопичувача живимо обрані лінії: ' + loadRows().map(function(r){ return lc(r[1]); }).join(', ') + '.',
      'Коли мережа є, накопичувач заряджається й чекає. Енергію в мережу не віддає.'];
    if (s.lines.some(function(l){ return l.p.cat === 'inverter'; })) out.push('Батареї з’єднуються з інвертором кабелями зв’язку (CAN / RS485): інвертор бачить заряд кожної й не дає їй перегрітися чи розрядитися в нуль.');
    return out;
  }
  function installSteps(s){
    if (!stationary(s).length) return ['Доставка', 'Перший повний заряд від розетки', 'Підключення техніки й перевірка перемикання'];
    return ['Огляд: інженер дивиться ввід, щит, місце й навантаження', 'Проєкт щита: які лінії живити, АВР, автомати й кабелі', 'Монтаж обладнання й щита', 'Пусконалагодження: налаштування інвертора й батарей, оновлення прошивки', 'Тест: вимикаємо мережу й перевіряємо, що все працює від накопичувача', 'Навчання: застосунок і що робити, якщо щось піде не так'];
  }
  function docs(){
    return {
      flat: ['Оформлювати нічого не треба: станція працює від розетки.', 'Отримаєте чек і гарантійний талон.'],
      home: ['Якщо накопичувач живить лише ваш дім і не віддає енергію в мережу, окремого приєднання до оператора мережі, як правило, не потрібно — інженер перевірить схему на огляді.', 'Отримаєте договір, акт виконаних робіт і гарантійні документи.'],
      osbb: ['Рішення загальних зборів співвласників — зразок є в пакеті для зборів.', 'Договір з ОСББ і акт виконаних робіт.', 'Для компенсації ГрінДім — заявка й пакет документів: допоможемо зібрати.'],
      biz: ['Для резерву власних навантажень без віддачі в мережу — договір, акти й гарантійні документи.', 'Якщо захочете віддавати енергію в мережу чи працювати на ринку, знадобляться приєднання, двонаправлений облік і, можливо, телеметрія — підкажемо порядок.']
    }[st.seg] || [];
  }
  function after(s){
    var wifi = s.lines.some(function(l){ return /Wi-Fi/i.test(row(l.p, /Зв’язок|Керування/) || ''); });
    var war = s.lines.map(function(l){ return l.p.warranty ? l.model + ' — ' + l.p.warranty : null; }).filter(Boolean);
    return [(wifi ? 'Застосунок: заряд, споживання й перемикання видно з телефона.' : 'Стан видно на дисплеї пристрою.'),
      war.length ? 'Гарантія: ' + war.join('; ') + '. Умови на решту обладнання уточнюємо з виробником.' : 'Гарантія — за умовами виробника: уточнюємо й зафіксуємо в договорі.',
      'Сервіс — наші інженери. Несправний блок міняємо цілком, як вимагає виробник.'];
  }

  /* ---------------- plan panel ---------------- */
  function kitCard(kit, s, compact){
    var c = el('div', 'kitmini'), ph = el('figure', 'ph kitmini__ph'); if (s.img) { ph.style.background = s.img.bg; var i = d.createElement('img'); i.src = s.img.src; i.alt = ''; ph.appendChild(i); }
    var b = el('div', 'kitmini__b'); b.appendChild(el('b', '', kit.custom ? s.lines.map(function(l){ return (l.qty > 1 ? l.qty + ' × ' : '') + l.name; }).join(' + ') : 'Комплект «' + kit.name + '»'));
    b.appendChild(el('small', '', nf(s.kwh, s.kwh < 10 ? 2 : 1) + ' кВт·год · ' + nf(s.kw, s.kw % 1 ? 1 : 0) + ' кВт · ' + P.STOCK[s.stock].toLowerCase()));
    var pr = el('div', 'kitmini__p'); pr.appendChild(el('span', '', s.priced ? uah(s.price) : 'Ціна за запитом')); pr.appendChild(el('small', '', 'обладнання, орієнтовно')); b.appendChild(pr);
    c.append(ph, b); return c;
  }
  function step(n, title, body, ask){
    var a = el('article', 'pstep'), h = el('div', 'pstep__h'); h.appendChild(el('span', 'pstep__n', n)); h.appendChild(el('h3', '', title));
    if (ask) { var q = el('button', 'pstep__ask', 'Запитати'); q.type = 'button'; q.addEventListener('click', function(){ answer(ask); }); h.appendChild(q); }
    a.appendChild(h); (Array.isArray(body) ? body : [body]).forEach(function(x){ a.appendChild(typeof x === 'string' ? el('p', '', x) : x); }); return a;
  }
  function renderPlan(){
    var kit = pickKit(), s = K.summary(kit), n = need(), h = K.hours(s, n.avg || kit.load || 500);
    planEl.textContent = ''; planEl.classList.add('is-on');
    var top = el('div', 'plan__top'), tl = el('div');
    tl.appendChild(el('p', 'eyebrow', 'Ваш проєкт · ' + SEGQ[st.seg])); tl.appendChild(el('h2', 'plan__t', 'Як це буде збудовано'));
    var tb = el('div', 'plan__btns'), save = el('button', 'btn btn--volt btn--sm', st.contact ? 'Збережено ✓' : 'Зберегти план'); save.type = 'button'; save.addEventListener('click', askContact);
    var add = el('button', 'btn btn--ghost btn--sm', 'Додати в заявку'); add.type = 'button'; add.setAttribute('data-add', ref(kit));
    tb.append(save, add);
    if (st.seg === 'osbb') { var pk = el('button', 'btn btn--ghost btn--sm', 'Пакет для зборів'); pk.type = 'button'; pk.addEventListener('click', function(){ packFlow(); }); tb.appendChild(pk); }
    top.append(tl, tb); planEl.appendChild(top);
    var kp = el('dl', 'plan__kpi');
    [['Обладнання', s.priced ? uah(s.price) : 'за запитом'], ['Запас енергії', nf(s.kwh, s.kwh < 10 ? 2 : 1) + ' кВт·год'], ['Потужність', nf(s.kw, s.kw % 1 ? 1 : 0) + ' кВт'], ['Протримає', K.hoursTxt(h) + (n.avg ? ' при ' + nf(n.avg) + ' Вт' : '')]].forEach(function(r){ var x = el('div'); x.append(el('dt', '', r[0]), el('dd', '', r[1])); kp.appendChild(x); });
    planEl.appendChild(kp);
    /* 1 — what we install */
    var items = el('div', 'plines');
    s.lines.forEach(function(l){
      var r = el('a', 'pline'); r.href = 'equipment.html?p=' + l.id;
      var f = el('figure', 'ph pline__ph'); if (l.img) { f.style.background = l.img.bg; var i = d.createElement('img'); i.src = l.img.src; i.alt = ''; i.loading = 'lazy'; f.appendChild(i); }
      var t = el('div', 'pline__t'); t.appendChild(el('b', '', (l.qty > 1 ? l.qty + ' × ' : '') + l.name)); t.appendChild(el('small', '', l.p.maker + ' · ' + l.model + ' · ' + P.STOCK[l.stock].toLowerCase()));
      r.append(f, t, el('span', 'pline__p', l.sum != null ? uah(l.sum) : 'за запитом')); items.appendChild(r);
    });
    var body1 = [items]; if (kit.notes && kit.notes.length) body1.push(list(kit.notes));
    body1.push(el('p', 'hint', stationary(s).length ? 'Щит з АВР, автомати, кабелі й монтаж порахуємо після огляду: залежать від вашого щита й відстаней.' : 'Монтаж не потрібен.'));
    planEl.appendChild(step('1', 'Що встановимо', body1, 'price'));
    planEl.appendChild(step('2', 'Де стоятиме', list(placement(s)), 'place'));
    planEl.appendChild(step('3', 'Як підключимо', [chain(s), list(wiring(s))], 'connect'));
    var ol = el('ol', 'psteps'); installSteps(s).forEach(function(t){ ol.appendChild(el('li', '', t)); });
    planEl.appendChild(step('4', stationary(s).length ? 'Як пройде монтаж' : 'Як почати', ol, 'install'));
    planEl.appendChild(step('5', 'Документи', list(docs()), st.seg === 'osbb' ? 'grindim' : 'docs'));
    planEl.appendChild(step('6', 'Після запуску', list(after(s)), 'service'));
    planEl.appendChild(el('p', 'plan__note', 'Орієнтовний план за типовими значеннями. Склад, ціну й строки зафіксуємо в пропозиції після огляду. Ціни — роздрібні орієнтири з ПДВ.'));
    var mob = $('#aPlanJump'); if (mob) mob.hidden = false;
  }

  /* ---------------- answers ---------------- */
  var ASK = {
    hours: function(){ var s = K.summary(pickKit()), n = need(); var extra = s.lines.some(function(l){ return l.id === 'tmt-051320'; }) ? ' Кожна додаткова батарея 16,4 кВт·год додає ≈ ' + K.hoursTxt(13.1 * .92 / (n.avg / 1000)).replace('≈ ', '') + '.' : '';
      return ['При навантаженні ≈ ' + nf(n.avg) + ' Вт (' + loadRows().map(function(r){ return lc(r[1]); }).join(', ') + ') система протримає ' + K.hoursTxt(K.hours(s, n.avg)) + '.' + extra, 'Це середнє: холодильник і насос вмикаються циклами, тож реальний запас зазвичай такий або трохи більший.']; },
    price: function(){ var s = K.summary(pickKit()), out = ['Обладнання — ' + (s.priced ? uah(s.price) : 'за запитом') + ': орієнтовні роздрібні ціни з ПДВ.', 'Щит з АВР, кабелі й монтаж порахуємо після огляду. Фінальну ціну зафіксуємо в пропозиції.'];
      if (st.seg === 'osbb') out.push('З програмою ГрінДім ОСББ може сплатити лише 30 % вартості.'); return out; },
    place: function(){ return [list(placement(K.summary(pickKit())))]; },
    connect: function(){ return [list(wiring(K.summary(pickKit())))]; },
    install: function(){ var ol = el('ol', 'psteps'); installSteps(K.summary(pickKit())).forEach(function(t){ ol.appendChild(el('li', '', t)); }); return ['Ось як проходить:', ol]; },
    docs: function(){ return [list(docs())]; },
    service: function(){ return [list(after(K.summary(pickKit())))]; },
    grindim: function(){ var s = K.summary(pickKit()), comp = Math.min(s.price * .7, 2e6);
      return ['ГрінДім компенсує ОСББ до 70 % вартості накопичувача — до 2 млн ₴ для будинків до 8 000 м² і до 4 млн ₴ для більших. Є й кредити під 0–7 %.', s.priced ? 'Для цієї системи: компенсація до ' + uah(comp) + ', частка ОСББ — від ' + uah(s.price - comp) + '.' : '', 'Умови програми, зокрема вимоги до обладнання, перевіримо перед заявкою. Документи допоможемо зібрати.'].filter(Boolean); },
    delivery: function(){ var s = K.summary(pickKit()), leads = s.lines.map(function(l){ return l.p.lead; }).filter(Boolean);
      return ['Статус: ' + P.STOCK[s.stock].toLowerCase() + (leads.length ? ' (' + leads[0] + ')' : '') + '. Точний строк поставки підтвердимо в пропозиції.']; },
    expand: function(){ var s = K.summary(pickKit()), par = s.lines.map(function(l){ return l.p.parallel ? l.model + ': ' + l.p.parallel : null; }).filter(Boolean);
      return [par.length ? 'Так. ' + par.join('; ') + '.' : 'Для портативної станції ємність розширюють додатковою батареєю — підберемо модель.', 'Почати можна з меншого й додати батареї пізніше.']; },
    solar: function(){ var s = K.summary(pickKit()), mppt = s.lines.map(function(l){ return row(l.p, /MPPT|Від PV|Сонце/); }).filter(Boolean)[0];
      return [mppt ? 'Так, у системі є входи для сонячних панелей (' + mppt + '). Їх можна додати пізніше — накопичувач працює й без них.' : 'Ця система розрахована на резерв від мережі. Якщо захочете панелі — підберемо сумісну модель.']; },
    noise: function(){ var s = K.summary(pickKit()), n = s.lines.map(function(l){ return row(l.p, /Шум|Охолодження/); }).filter(Boolean)[0]; return [n ? 'Охолодження: ' + n + '. Тихіше, ніж генератор, але для спальні — не найкраще місце.' : 'Працює тихо: вентилятор вмикається лише під навантаженням.']; }
  };
  var MATCH = [['hours', /скільки.*(працю|вистач|трима|годин)|годин|вистачить|протрима/], ['price', /цін|варт|коштує|скільки.*грн|бюджет|входить/], ['place', /де .*(постав|стоя|розмі)|місц|розмір|габарит|ваг|куди/], ['connect', /підключ|щит|авр|перемика|схем/], ['install', /монтаж|встанов|скільки час|день/], ['grindim', /грін|компенс|70|кредит/], ['docs', /документ|дозв|оср|приєдна|оформ/], ['service', /гарант|сервіс|злама|ремонт/], ['delivery', /доставк|коли|наявн|передзам|строк/], ['expand', /розшир|додати батар|більше ємн|пізніше/], ['solar', /сонячн|панел/], ['noise', /шум|гуч|тих/]];
  function answer(key, text){
    if (text) user(text); else user({ hours: 'Скільки протримає?', price: 'Скільки коштує й що входить?', place: 'Де його поставити?', connect: 'Як підключите?', install: 'Як пройде монтаж?', docs: 'Що з документами?', service: 'Гарантія й сервіс?', grindim: 'Що з ГрінДім?', delivery: 'Коли буде?', expand: 'Можна розширити?', solar: 'Можна додати панелі?', noise: 'Чи гучний він?' }[key] || key);
    if (!st.seg) { bot('Спершу підберемо систему — тоді відповім конкретно для неї.'); return askSeg(); }
    bot(ASK[key] ? ASK[key]() : ['Цього я поки не знаю напевно — передам інженеру.', 'Залиште телефон, і він відповість.'], function(){ follow(); });
  }
  function follow(){
    var a = [['Скільки протримає?', function(){ answer('hours'); }], ['Де поставити?', function(){ answer('place'); }], ['Як підключите?', function(){ answer('connect'); }], ['Документи', function(){ answer('docs'); }]];
    if (st.seg === 'osbb') a.push(['ГрінДім', function(){ answer('grindim'); }], ['Пакет для зборів', function(){ packFlow(); }, 1]);
    a.push(['Зберегти план', askContact, st.seg !== 'osbb']); actions(a);
  }

  /* ---------------- flow ---------------- */
  function askSeg(){ bot('Для кого система?', function(){ chips([['flat', 'Квартира'], ['home', 'Приватний дім'], ['osbb', 'ОСББ'], ['biz', 'Бізнес']], false, function(v){ st.seg = v; st.kit = null; askLoads(); }); }); }
  function askLoads(){ bot(st.seg === 'osbb' ? 'Що в будинку має працювати без світла?' : 'Що має працювати без світла?', function(){ chips((K.LOADS[st.seg] || []).map(function(r){ return [r[0], r[1], r[4]]; }), true, function(keys){ st.loads = keys; askHours(); }); }); }
  function askHours(){ bot('Скільки часу треба протриматись без мережі?', function(){ chips([['4', 'До 4 годин'], ['8', 'До 8 годин'], ['12', 'До 12 годин'], ['24', 'Добу']], false, function(v){ st.hours = +v; if (st.seg === 'home' || st.seg === 'biz') askPhases(); else result(); }); }); }
  function askPhases(){ bot('Скільки фаз на вводі?', function(){ chips([['1', 'Одна фаза'], ['3', 'Три фази'], ['0', 'Не знаю']], false, function(v){ st.phases = +v || 1; if (v === '0') st.unknownPhases = true; result(); }); }); }
  function result(){
    st.kit = null; var kit = pickKit(), s = K.summary(kit), n = need();
    var intro = 'Ось що підійде з нашого складу' + (st.unknownPhases ? ' (рахую на одну фазу — інженер перевірить на огляді)' : '') + ':';
    var add = el('button', 'btn btn--volt btn--sm', 'Додати в заявку'); add.type = 'button'; add.setAttribute('data-add', ref(kit));
    bot([intro, kitCard(kit, s), el('p', '', 'Протримає ' + K.hoursTxt(K.hours(s, n.avg)) + ' при ваших ≈ ' + nf(n.avg) + ' Вт. Праворуч — план: де стоятиме, як підключимо, як пройде монтаж.'), add], function(){ renderPlan(); follow(); });
  }
  function fromKit(id){
    var kit = K.byId(id); if (!kit) return askSeg(); st.seg = kit.seg; st.kit = kit; kit.fixed = true;
    st.loads = (K.LOADS[st.seg] || []).filter(function(r){ return r[4]; }).map(function(r){ return r[0]; }); st.hours = 8;
    var s = K.summary(kit);
    bot(['Ви обрали комплект «' + kit.name + '». Покажу, як його встановимо.', kitCard(kit, s)], function(){ renderPlan(); bot('Щоб порахувати запас точніше, скажіть, що саме має працювати без світла.', function(){ chips((K.LOADS[st.seg] || []).map(function(r){ return [r[0], r[1], r[4]]; }), true, function(keys){ st.loads = keys; renderPlan(); bot('Оновив план: протримає ' + K.hoursTxt(K.hours(K.summary(st.kit), need().avg)) + '.', follow); }); }); });
  }
  function fromProduct(id){
    var p = P.byId(id); if (!p) return askSeg();
    bot('Бачу, ви дивились «' + p.name + '». Підберу систему з ним або з аналогом і покажу, як її встановлять у вас.', function(){ chips([['go', 'Так, підберіть'], ['other', 'Хочу інше']], false, function(){ askSeg(); }); });
  }

  /* ---------------- contact → saved project (the lead) ---------------- */
  function askContact(){
    if (!st.seg) return askSeg();
    if (st.contact) { saveProject(); bot('План уже збережено в кабінеті. Інженер зателефонує, щоб домовитися про огляд.', follow); return; }
    bot('Куди надіслати план і з ким зв’язатися інженеру?', function(){
      quick.textContent = ''; var f = el('form', 'cform'); f.noValidate = false;
      var n = el('input', 'input'); n.placeholder = 'Ім’я'; n.required = true; n.autocomplete = 'name'; n.setAttribute('aria-label', 'Ім’я');
      var ph = el('input', 'input'); ph.type = 'tel'; ph.placeholder = 'Телефон або Viber'; ph.required = true; ph.autocomplete = 'tel'; ph.setAttribute('aria-label', 'Телефон');
      var b = el('button', 'btn btn--volt btn--sm', 'Зберегти'); b.type = 'submit';
      f.append(n, ph, b); quick.appendChild(f); n.focus();
      f.addEventListener('submit', function(e){ e.preventDefault(); if (!f.reportValidity()) return; st.contact = { name: n.value.trim(), phone: ph.value.trim() }; quick.textContent = ''; user(st.contact.name + ', ' + st.contact.phone); saveProject();
        bot(['Готово! План збережено в кабінеті, інженер зателефонує й домовиться про огляд.', el('p', 'hint', 'Демо: дані лишаються у вашому браузері.')], function(){ var s = planEl.querySelector('.plan__btns .btn--volt'); if (s) s.textContent = 'Збережено ✓'; if (st.pendingPack) { st.pendingPack = false; openPack(); } follow(); }); });
    });
  }
  function saveProject(){
    var kit = pickKit(), s = K.summary(kit);
    try { localStorage.setItem('bess-project', JSON.stringify({ seg: st.seg, loads: st.loads, hours: st.hours, phases: st.phases, items: kit.items, kitId: kit.custom ? null : kit.id, name: kit.custom ? null : kit.name, price: s.priced ? s.price : null, kwh: s.kwh, kw: s.kw, avg: need().avg, contact: st.contact, at: Date.now() })); } catch (e) {}
  }

  /* ---------------- ОСББ meeting pack ---------------- */
  function packFlow(){ if (!st.contact) { st.pendingPack = true; bot('Підготую пакет для загальних зборів: опис системи, вартість, розрахунок ГрінДім і зразок рішення. Лише скажіть, з ким зв’язатися.', askContact); return; } openPack(); }
  function openPack(){
    var kit = pickKit(), s = K.summary(kit), n = need(), comp = Math.min(s.price * .7, 2e6), pk = $('#pack'), dlg = $('#packDlg');
    pk.textContent = '';
    pk.appendChild(el('p', 'pack__k', 'Пропозиція для загальних зборів співвласників'));
    pk.appendChild(el('h2', '', 'Резервне живлення будинку від накопичувача енергії'));
    pk.appendChild(el('p', '', 'Мета: щоб під час відключень працювали ' + loadRows().map(function(r){ return lc(r[1]); }).join(', ') + '.'));
    var t = el('table'); s.lines.forEach(function(l){ var tr = el('tr'); tr.append(el('td', '', (l.qty > 1 ? l.qty + ' × ' : '') + l.name + ' (' + l.model + ')'), el('td', '', l.sum != null ? uah(l.sum) : 'за запитом')); t.appendChild(tr); });
    var trT = el('tr', 'pack__sum'); trT.append(el('td', '', 'Обладнання разом, орієнтовно з ПДВ'), el('td', '', s.priced ? uah(s.price) : 'за запитом')); t.appendChild(trT);
    pk.appendChild(t);
    pk.appendChild(el('p', '', 'Запас енергії ' + nf(s.kwh, 1) + ' кВт·год, потужність ' + nf(s.kw) + ' кВт. При навантаженні ≈ ' + nf(n.avg) + ' Вт — ' + K.hoursTxt(K.hours(s, n.avg)) + ' роботи. Монтаж і щит — за пропозицією після огляду.'));
    pk.appendChild(el('h3', '', 'Фінансування: програма ГрінДім'));
    pk.appendChild(list(['Компенсація до 70 % вартості, до 2 млн ₴ для будинків до 8 000 м² (до 4 млн ₴ — для більших).', s.priced ? 'Для цієї системи: компенсація до ' + uah(comp) + ', частка ОСББ — від ' + uah(s.price - comp) + '.' : 'Розрахунок частки — після пропозиції.', 'Кредити під 0–7 % на частку ОСББ. Умови програми перевіримо перед заявкою.']));
    pk.appendChild(el('h3', '', 'Зразок проєкту рішення'));
    var ol = el('ol'); ['Встановити систему резервного живлення (накопичувач енергії) для таких навантажень: ' + loadRows().map(function(r){ return lc(r[1]); }).join(', ') + ' — орієнтовною вартістю обладнання ' + (s.priced ? uah(s.price) : '[сума]') + ' плюс монтаж за пропозицією.', 'Подати заявку на участь у програмі ГрінДім і, за потреби, на пільговий кредит.', 'Уповноважити голову правління укласти договір на постачання й монтаж та підписати акти.'].forEach(function(x){ ol.appendChild(el('li', '', x)); });
    pk.appendChild(ol);
    pk.appendChild(el('p', 'pack__note', 'Зразок для обговорення — остаточне формулювання погодьте з юристом ОСББ. Ціни орієнтовні, склад і вартість фіксуються в пропозиції після огляду. Контакт: ' + (st.contact ? st.contact.name + ', ' + st.contact.phone : '')));
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    bot('Пакет готовий: його можна роздрукувати або зберегти в PDF і показати співвласникам.', follow);
  }
  var pdlg = $('#packDlg');
  if (pdlg) {
    $('#packX').addEventListener('click', function(){ pdlg.close(); });
    $('#packPrint').addEventListener('click', function(){ d.body.classList.add('print-pack'); window.print(); setTimeout(function(){ d.body.classList.remove('print-pack'); }, 500); });
    pdlg.addEventListener('click', function(e){ if (e.target === pdlg) pdlg.close(); });
  }

  /* ---------------- free text ---------------- */
  form.addEventListener('submit', function(e){
    e.preventDefault(); var v = input.value.trim(); if (!v) return; input.value = '';
    var t = v.toLowerCase(), key = null; MATCH.forEach(function(m){ if (!key && m[1].test(t)) key = m[0]; });
    if (!st.seg) { var seg = /квартир/.test(t) ? 'flat' : /осбб|будин|під’їзд|ліфт/.test(t) ? 'osbb' : /бізнес|магазин|офіс|кафе|склад/.test(t) ? 'biz' : /дім|будинок|котедж/.test(t) ? 'home' : null;
      user(v); if (seg) { st.seg = seg; bot('Зрозумів: ' + SEGQ[seg].toLowerCase() + '.', askLoads); } else { bot('Щоб відповісти конкретно, спершу підберемо систему.', askSeg); } return; }
    answer(key || '?', v);
  });
  $('#asstReset').addEventListener('click', function(){ msgs.textContent = ''; quick.textContent = ''; planEl.textContent = ''; planEl.classList.remove('is-on'); st = { seg: null, loads: [], hours: null, phases: null, kit: null, contact: st.contact }; start(); });
  var jump = $('#aPlanJump'); if (jump) jump.addEventListener('click', function(){ S.scrollToEl(planEl); });

  function start(){
    var q = S.q, kit = q.get('kit'), p = q.get('p'), seg = q.get('seg');
    bot('Привіт! Я асистент вашого проєкту. Підберу систему з того, що є на складі, і покажу крок за кроком, як її встановлять саме у вас.', function(){
      if (kit) fromKit(kit); else if (p) fromProduct(p); else if (seg && SEGQ[seg]) { st.seg = seg; askLoads(); } else askSeg();
    });
  }
  start();
})();
