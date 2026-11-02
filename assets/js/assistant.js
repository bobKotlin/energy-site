/* =====================================================================
   Quick pick (no AI). Three questions → a system from our own stock
   (window.KITS / window.PRODUCTS) → a compact plan of how it will be
   built: equipment, wiring, placement, installation, paperwork, service.
   Numbers go into tiles, facts, tags and a step track — not prose; the
   details of an estimate sit in a tooltip. Everything comes from the
   real product data.
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
  var planEmpty = planEl.innerHTML;
  var SEGQ = { flat: tx('Квартира', 'Flat'), home: tx('Приватний дім', 'Home'), osbb: tx('ОСББ', 'Apartment building'), biz: tx('Бізнес', 'Business') };
  var st = { seg: null, loads: [], hours: null, phases: null, kit: null, contact: null };
  try { var saved = JSON.parse(localStorage.getItem('bess-project') || 'null'); if (saved && saved.contact) st.contact = saved.contact; } catch (e) {}

  function uah(v){ return S.uah(v); }
  /* first letter in lower case, unless the label starts with an abbreviation (ІТП, TV) */
  function lc(t){ var c = t.charAt(1); return c && c !== c.toLowerCase() ? t : t.charAt(0).toLowerCase() + t.slice(1); }
  function el(tag, cls, text){ var e = d.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function scroll(){ msgs.scrollTop = msgs.scrollHeight; }
  var BOLT = '<svg width="16" height="16" viewBox="0 0 16 16" aria-hidden="true"><path d="M8.9 2 4.6 8.6h3.2L6.9 14l4.5-6.6H8.2z" fill="currentColor"/></svg>';

  /* ---------------- chat primitives ---------------- */
  function user(text){ var m = el('div', 'msg msg--u', text); msgs.appendChild(m); scroll(); }
  function bot(parts, done){
    var m = el('div', 'msg msg--a'), av = el('div', 'av'); av.innerHTML = BOLT; var bb = el('div', 'bb'); m.append(av, bb); msgs.appendChild(m);
    var t = el('span', 'typing'); t.innerHTML = '<i></i><i></i><i></i>'; bb.appendChild(t); scroll();
    setTimeout(function(){ t.remove(); (Array.isArray(parts) ? parts : [parts]).filter(Boolean).forEach(function(p){ bb.appendChild(typeof p === 'string' ? el('p', '', p) : p); }); scroll(); if (done) done(bb); }, RM ? 0 : 420 + Math.random() * 280);
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
    if (multi) { var ok = el('button', 'btn btn--volt btn--sm', tx('Готово', 'Done')); ok.type = 'button'; ok.addEventListener('click', function(){ var keys = Object.keys(sel); if (!keys.length) return S.toast(tx('Оберіть хоча б одне', 'Choose at least one')); quick.textContent = ''; user(opts.filter(function(o){ return sel[o[0]]; }).map(function(o){ return o[1]; }).join(', ')); onDone(keys); }); quick.appendChild(ok); }
  }
  function actions(list){ quick.textContent = ''; list.forEach(function(a){ var b = el('button', a[2] ? 'btn btn--volt btn--sm' : 'chip', a[0]); b.type = 'button'; b.addEventListener('click', a[1]); quick.appendChild(b); }); }

  /* ---------------- compact visuals: tiles, facts, tags, a step track, a 24-hour strip ---------------- */
  var EST = tx('Орієнтовна роздрібна ціна з ПДВ. Фінальну фіксує пропозиція після огляду.', 'Indicative retail price incl. VAT. The offer after the survey fixes the final one.');
  function est(title){ var a = el('abbr', 'ap-est', '≈'); a.title = title || EST; return a; }
  /* a day as 24 blocks: the hours the battery covers */
  function strip(h){ var n = Math.max(0, Math.min(24, Math.round(h))), s = el('span', 'hstrip'); s.title = tx('Годин доби: ', 'Hours of a day: ') + n + ' / 24'; for (var i = 0; i < 24; i++) s.appendChild(el('i', i < n ? 'on' : '')); return s; }
  /* rows: { k: label, v: value, sub: 2–3 words, est: true | tooltip, h: hours for the strip, tip: tooltip } */
  function tiles(rows){
    var dl = el('dl', 'plan__kpi');
    rows.filter(Boolean).forEach(function(r){
      var x = el('div'), dd = el('dd', '', r.v);
      if (r.est) dd.appendChild(est(r.est === true ? null : r.est));
      if (r.sub) dd.appendChild(el('small', '', r.sub));
      if (r.h != null) dd.appendChild(strip(r.h));
      if (r.tip) x.title = r.tip;
      x.append(el('dt', '', r.k), dd); dl.appendChild(x);
    });
    return dl;
  }
  /* facts: [label, value, tooltip?] */
  function facts(rows){ var dl = el('dl', 'pfacts'); rows.filter(function(r){ return r && r[1]; }).forEach(function(r){ var x = el('div'); x.append(el('dt', '', r[0]), el('dd', '', r[1])); if (r[2]) x.title = r[2]; dl.appendChild(x); }); return dl; }
  /* tags: 'text' or [text, '' | 'warn' | 'mu', tooltip?] */
  function tags(items){ var w = el('div', 'ptags'); items.filter(Boolean).forEach(function(t){ if (typeof t === 'string') t = [t]; var s = el('span', 'ptag' + (t[1] ? ' ptag--' + t[1] : ''), t[0]); if (t[2]) s.title = t[2]; w.appendChild(s); }); return w; }
  /* steps: 'label' or [label, tooltip] */
  function track(items){ var ol = el('ol', 'ptrack'); items.forEach(function(t){ if (typeof t === 'string') t = [t]; var li = el('li', '', t[0]); if (t[1]) li.title = t[1]; ol.appendChild(li); }); return ol; }
  function W(v){ return nf(v) + tx(' Вт', ' W'); }
  function hoursTiles(s, avg, tip, extra){ var h = K.hours(s, avg); return tiles([{ k: tx('Протримає', 'Lasts'), v: K.hoursTxt(h), h: h, tip: tip }, { k: tx('Навантаження', 'Load'), v: W(avg) }, extra]); }

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
  function dims(p){ return p.dims ? p.dims.map(function(x){ return nf(x); }).join(' × ') + tx(' мм', ' mm') : null; }
  function kg(p){ return p.kg ? nf(p.kg, p.kg % 1 ? 1 : 0) + tx(' кг', ' kg') : null; }
  function stationary(s){ return s.lines.filter(function(l){ return l.p.cat !== 'portable'; }); }
  /* spec rows are read by their labels: the Ukrainian ones or those of the English overlay */
  function specOf(L, re){ return L.map(function(l){ return row(l.p, re); }).filter(Boolean)[0] || null; }
  function noiseOf(L){
    var v = L.map(function(l){ return row(l.p, /Охолодження|Шум|Cooling|Noise/); }).filter(function(x){ return x && /дБ|dB/.test(x); })[0];
    if (!v) return null; var m = v.match(/(?:до|up to|<|≤)?\s*[\d–-]+\s*(?:дБ|dB)/); return m ? m[0].trim() : v;
  }
  function placeView(s){
    var L = s.lines;
    if (!stationary(s).length) return [facts([[tx('Габарити', 'Size'), dims(L[0].p)], [tx('Вага', 'Weight'), kg(L[0].p)]]), tags([tx('Поруч із технікою', 'Next to the appliances'), [tx('Отвори відкриті', 'Vents clear'), 'warn', tx('Вентиляційні отвори не закривати', 'Keep the vents uncovered')]])];
    var spec = el('div', 'pspec');
    L.forEach(function(l){
      var r = el('div'); r.appendChild(el('b', '', (l.qty > 1 ? l.qty + ' × ' : '') + l.model));
      [dims(l.p), l.p.kg ? kg(l.p) + (l.qty > 1 ? tx(' кожна', ' each') : '') : null, row(l.p, /^Монтаж|^Mounting/), l.p.ip].filter(Boolean).forEach(function(t){ r.appendChild(el('span', '', t)); });
      spec.appendChild(r);
    });
    var temp = specOf(L, /Температура|температура|Temperature|temperature/), noise = noiseOf(L);
    var heavy = L.some(function(l){ return l.p.kg > 100; }), wall = L.some(function(l){ return /настін|wall/i.test(l.p.name); });
    return [spec, (temp || noise) && facts([[tx('Температура', 'Temperature'), temp], [tx('Шум', 'Noise'), noise]]), tags([
      wall && [tx('Капітальна стіна', 'Load-bearing wall'), 'warn', tx('Стіна має витримати вагу батареї з запасом', 'The wall must carry the battery’s weight with room to spare')],
      heavy && [tx('Тверда рівна підлога', 'Solid, level floor'), 'warn', tx('Одна шафа важить понад 100 кг', 'One cabinet weighs over 100 kg')],
      temp && [tx('Без морозу', 'Frost-free'), 'warn', tx('Узимку — в опалюваному приміщенні', 'In winter — a heated room')],
      noise && [tx('Не в спальні', 'Not in a bedroom'), 'mu', tx('Під навантаженням працюють вентилятори', 'The fans run under load')],
      st.seg === 'osbb' && [tx('Біля вводу чи щитової', 'Near the supply or switch room'), '', tx('Коротші кабелі, доступ лише для обслуги', 'Shorter cables, access for maintenance staff only')]
    ])];
  }
  function chain(s){
    var box = el('div', 'chain'), L = s.lines, stat = stationary(s).length > 0;
    function node(label, img, cap){
      var n = el('div', 'chain__n');
      if (img) { var f = el('figure', 'ph chain__ph'); f.style.background = img.bg; var i = d.createElement('img'); i.src = S.asset(img.src); i.alt = ''; i.loading = 'lazy'; f.appendChild(i); n.appendChild(f); }
      else n.appendChild(el('span', 'chain__ic', ''));
      n.appendChild(el('b', '', label)); if (cap) n.appendChild(el('small', '', cap)); box.appendChild(n);
      box.appendChild(el('span', 'chain__arr', '→'));
    }
    if (!stat) { node(tx('Розетка', 'Socket'), null, tx('заряд від мережі', 'grid charging')); node(L[0].model, L[0].img, tx('режим UPS', 'UPS mode')); node(tx('Ваша техніка', 'Your appliances'), null, loadRows().map(function(r){ return lc(r[1]); }).slice(0, 3).join(', ')); }
    else {
      node(tx('Мережа', 'Grid'), null, tx('ввід у будинок', 'incoming supply')); node(tx('Щит з АВР', 'ATS panel'), null, tx('автоперемикання', 'auto switchover'));
      L.forEach(function(l){ node(l.p.cat === 'inverter' ? tx('Інвертор', 'Inverter') : l.p.cat === 'aio' ? tx('Моноблок', 'All-in-one') : tx('Батарея', 'Battery') + (l.qty > 1 ? ' × ' + l.qty : ''), l.img, l.model); });
      node(tx('Навантаження', 'Loads'), null, loadRows().map(function(r){ return lc(r[1]); }).slice(0, 3).join(', '));
    }
    box.lastChild.remove(); return box;
  }
  function wireTags(s){
    var inv = s.lines.filter(function(l){ return l.p.cat === 'inverter' || l.p.cat === 'aio'; })[0], sw = inv ? row(inv.p, /Перемикання|Switchover/) : null;
    if (!stationary(s).length) return tags([tx('Від розетки', 'From a socket'), tx('Без перерви', 'No break'), [tx('Разом до ', 'Up to ') + W(s.kw * 1000) + tx('', ' in total'), 'warn', tx('Потужні прилади вмикайте по черзі', 'Switch on powerful appliances one at a time')]]);
    return tags([
      sw ? tx('Перемикання ', 'Switchover ') + sw : tx('Автоперемикання', 'Auto switchover'),
      st.seg === 'osbb' ? [tx('Лише спільні лінії', 'Shared circuits only'), '', tx('Ліфт, насоси, освітлення, ІТП. Квартири лишаються на мережі.', 'Lift, pumps, lighting, heating substation. The flats stay on the grid.')] : [tx('Лише обрані лінії', 'Chosen circuits only'), '', loadRows().map(function(r){ return r[1]; }).join(', ')],
      [tx('У мережу не віддає', 'No export to the grid'), 'mu'],
      s.lines.some(function(l){ return l.p.cat === 'inverter'; }) && [tx('Батареї на CAN / RS485', 'Batteries on CAN / RS485'), 'mu', tx('Інвертор бачить заряд кожної й не дає перегрітися чи розрядитися в нуль', 'The inverter sees each one’s charge and keeps it from overheating or running flat')]
    ]);
  }
  function installTrack(s){
    if (!stationary(s).length) return track([tx('Доставка', 'Delivery'), [tx('Повний заряд', 'Full charge'), tx('Перший повний заряд від розетки', 'First full charge from a socket')], [tx('Підключення', 'Plug in'), tx('Підключення техніки й перевірка перемикання', 'Connecting the appliances and testing the switchover')]]);
    return track([[tx('Огляд', 'Survey'), tx('Інженер дивиться ввід, щит, місце й навантаження', 'An engineer checks the supply, the panel, the location and the loads')], [tx('Проєкт щита', 'Panel design'), tx('Які лінії живити, АВР, автомати й кабелі', 'Which circuits to power, the ATS, breakers and cables')], [tx('Монтаж', 'Installation'), tx('Обладнання й щит', 'The equipment and the panel')],
      [tx('Налаштування', 'Set-up'), tx('Інвертор, батареї, оновлення прошивки', 'Inverter, batteries, firmware update')], [tx('Тест без мережі', 'Grid-off test'), tx('Вимикаємо мережу й перевіряємо роботу від накопичувача', 'We switch off the grid and check that everything runs from the storage')], [tx('Навчання', 'Training'), tx('Застосунок і що робити, якщо щось піде не так', 'The app, and what to do if something goes wrong')]]);
  }
  function docTags(){
    return tags({
      flat: [tx('Без дозволів', 'No permits'), tx('Чек', 'Receipt'), tx('Гарантійний талон', 'Warranty card')],
      home: [tx('Договір', 'Contract'), tx('Акт робіт', 'Completion certificate'), tx('Гарантія', 'Warranty'), [tx('ОСР — зазвичай не треба', 'DSO — usually not needed'), 'mu', tx('Якщо накопичувач не віддає енергію в мережу. Інженер перевірить схему на огляді.', 'If the storage sends no energy to the grid. The engineer checks the wiring at the survey.')]],
      osbb: [[tx('Рішення зборів', 'Meeting resolution'), '', tx('Зразок — у пакеті для зборів', 'A template is in the meeting pack')], tx('Договір з ОСББ', 'Contract with the OSBB'), tx('Акт робіт', 'Completion certificate')],
      biz: [tx('Договір', 'Contract'), tx('Акти', 'Certificates'), tx('Гарантія', 'Warranty'), [tx('Віддача в мережу — окремо', 'Grid export — separately'), 'warn', tx('Приєднання, двонаправлений облік, можливо телеметрія — підкажемо порядок', 'A grid connection, two-way metering, possibly telemetry — we explain the steps')]]
    }[st.seg] || []);
  }
  function afterFacts(s){
    var wifi = s.lines.some(function(l){ return /Wi-Fi/i.test(row(l.p, /Зв’язок|Керування|Communication|Control/) || ''); });
    var war = s.lines.filter(function(l){ return l.p.warranty; }), all = war.length === s.lines.length && war.every(function(l){ return l.p.warranty === war[0].p.warranty; });
    var rows = [[tx('Моніторинг', 'Monitoring'), wifi ? tx('Застосунок', 'App') : tx('Дисплей', 'Display')]];
    if (all) rows.push([tx('Гарантія', 'Warranty'), war[0].p.warranty]);
    else war.forEach(function(l){ rows.push([tx('Гарантія · ', 'Warranty · ') + l.model, l.p.warranty]); });
    if (!all) rows.push([war.length ? tx('Решта', 'The rest') : tx('Гарантія', 'Warranty'), tx('Від виробника', 'Manufacturer’s'), tx('Умови уточнимо й зафіксуємо в договорі', 'We confirm the terms and put them in the contract')]);
    rows.push([tx('Сервіс', 'Service'), tx('Наші інженери', 'Our engineers'), tx('Несправний блок міняємо цілком, як вимагає виробник', 'A faulty unit is replaced as a whole, as the manufacturer requires')]);
    return facts(rows);
  }

  /* ---------------- plan panel ---------------- */
  function kitCard(kit, s){
    var c = el('div', 'kitmini'), ph = el('figure', 'ph kitmini__ph'); if (s.img) { ph.style.background = s.img.bg; var i = d.createElement('img'); i.src = S.asset(s.img.src); i.alt = ''; ph.appendChild(i); }
    var b = el('div', 'kitmini__b'); b.appendChild(el('b', '', kit.custom ? s.lines.map(function(l){ return (l.qty > 1 ? l.qty + ' × ' : '') + l.name; }).join(' + ') : tx('Комплект «' + kit.name + '»', '“' + kit.name + '” kit')));
    var sp = el('div', 'kitmini__s'); sp.append(el('span', '', nf(s.kwh, s.kwh < 10 ? 2 : 1) + tx(' кВт·год', ' kWh')), el('span', '', nf(s.kw, s.kw % 1 ? 1 : 0) + tx(' кВт', ' kW')), el('span', 'ptag' + (s.stock === 'in' ? '' : ' ptag--warn'), P.STOCK[s.stock].toLowerCase())); b.appendChild(sp);
    var pr = el('div', 'kitmini__p'); pr.appendChild(el('span', '', s.priced ? uah(s.price) : tx('Ціна за запитом', 'Price on request'))); if (s.priced) pr.appendChild(est()); b.appendChild(pr);
    c.append(ph, b); return c;
  }
  function card(n, title, body, ask, wide){
    var a = el('article', 'pstep' + (wide ? ' pstep--w' : '')), h = el('div', 'pstep__h'); h.appendChild(el('span', 'pstep__n', n)); h.appendChild(el('h3', '', title));
    if (ask) { var q = el('button', 'pstep__ask', tx('Запитати', 'Ask')); q.type = 'button'; q.addEventListener('click', function(){ answer(ask); }); h.appendChild(q); }
    a.appendChild(h); (Array.isArray(body) ? body : [body]).filter(Boolean).forEach(function(x){ a.appendChild(typeof x === 'string' ? el('p', '', x) : x); }); return a;
  }
  function renderPlan(){
    var kit = pickKit(), s = K.summary(kit), n = need(), avg = n.avg || kit.load || 500, h = K.hours(s, avg), stat = stationary(s).length > 0;
    planEl.textContent = ''; planEl.classList.add('is-on');
    var top = el('div', 'plan__top'), tl = el('div');
    tl.appendChild(el('p', 'eyebrow', SEGQ[st.seg])); tl.appendChild(el('h2', 'plan__t', kit.custom ? tx('Ваша система', 'Your system') : kit.name));
    var tb = el('div', 'plan__btns'), save = el('button', 'btn btn--volt btn--sm', st.contact ? tx('Збережено ✓', 'Saved ✓') : tx('Зберегти план', 'Save the plan')); save.type = 'button'; save.addEventListener('click', askContact);
    var add = el('button', 'btn btn--ghost btn--sm', tx('Додати в заявку', 'Add to request')); add.type = 'button'; add.setAttribute('data-add', ref(kit));
    tb.append(save, add);
    if (st.seg === 'osbb') { var pk = el('button', 'btn btn--ghost btn--sm', tx('Пакет для зборів', 'Meeting pack')); pk.type = 'button'; pk.addEventListener('click', function(){ packFlow(); }); tb.appendChild(pk); }
    top.append(tl, tb); planEl.appendChild(top);
    planEl.appendChild(tiles([
      { k: tx('Обладнання', 'Equipment'), v: s.priced ? uah(s.price) : tx('за запитом', 'on request'), est: s.priced },
      { k: tx('Запас енергії', 'Capacity'), v: nf(s.kwh, s.kwh < 10 ? 2 : 1) + tx(' кВт·год', ' kWh') },
      { k: tx('Потужність', 'Power'), v: nf(s.kw, s.kw % 1 ? 1 : 0) + tx(' кВт', ' kW') },
      { k: tx('Протримає', 'Lasts'), v: K.hoursTxt(h), sub: tx('при ', 'at ') + W(avg), h: h }
    ]));
    /* what we install: photos, models, prices */
    var items = el('div', 'plines');
    s.lines.forEach(function(l){
      var r = el('a', 'pline'); r.href = 'equipment.html?p=' + l.id;
      var f = el('figure', 'ph pline__ph'); if (l.img) { f.style.background = l.img.bg; var i = d.createElement('img'); i.src = S.asset(l.img.src); i.alt = ''; i.loading = 'lazy'; f.appendChild(i); }
      var t = el('div', 'pline__t'); t.appendChild(el('b', '', (l.qty > 1 ? l.qty + ' × ' : '') + l.name)); var sm = el('small', '', l.p.maker + ' ' + l.model); sm.appendChild(el('span', 'ptag' + (l.stock === 'in' ? '' : ' ptag--warn'), P.STOCK[l.stock].toLowerCase())); t.appendChild(sm);
      r.append(f, t, el('span', 'pline__p', l.sum != null ? uah(l.sum) : tx('за запитом', 'on request'))); items.appendChild(r);
    });
    var notes = (kit.notes || []).map(function(x){ return [x, 'mu']; });
    notes.push(stat ? [tx('Монтаж і щит — після огляду', 'Installation and panel — after the survey'), 'warn', tx('Щит з АВР, автомати, кабелі й монтаж залежать від вашого щита й відстаней', 'The ATS panel, breakers, cables and installation depend on your panel and the distances')] : tx('Без монтажу', 'No installation'));
    var grid = el('div', 'psgrid');
    grid.appendChild(card('1', tx('Обладнання', 'Equipment'), [items, tags(notes)], 'price', true));
    grid.appendChild(card('2', tx('Підключення', 'Connection'), [chain(s), wireTags(s)], 'connect', true));
    grid.appendChild(card('3', tx('Розміщення', 'Placement'), placeView(s), 'place'));
    grid.appendChild(card('4', stat ? tx('Монтаж', 'Installation') : tx('Старт', 'Getting started'), installTrack(s), 'install'));
    grid.appendChild(card('5', tx('Документи', 'Paperwork'), docTags(), 'docs'));
    grid.appendChild(card('6', tx('Сервіс', 'Service'), afterFacts(s), 'service'));
    planEl.appendChild(grid);
    var mob = $('#aPlanJump'); if (mob) mob.hidden = false;
  }

  /* ---------------- answers: tiles, facts and tags ---------------- */
  var ASK = {
    hours: function(){ var s = K.summary(pickKit()), n = need(), bat = s.lines.some(function(l){ return l.id === 'tmt-051320'; }), h1 = 13.1 * .92 / (n.avg / 1000);
      return [hoursTiles(s, n.avg, tx('Середнє: холодильник і насос працюють циклами, тож запас зазвичай такий або більший', 'An average: the fridge and pump run in cycles, so the reserve is usually the same or longer'), bat && { k: tx('+1 батарея', '+1 battery'), v: '+' + K.hoursTxt(h1).replace('≈ ', ''), sub: tx('16,4 кВт·год', '16.4 kWh') }),
        tags(loadRows().map(function(r){ return [r[1], 'mu']; }))]; },
    price: function(){ var s = K.summary(pickKit());
      return [tiles([{ k: tx('Обладнання', 'Equipment'), v: s.priced ? uah(s.price) : tx('за запитом', 'on request'), est: s.priced }, { k: tx('Монтаж і щит', 'Installation and panel'), v: tx('після огляду', 'after the survey') }])]; },
    place: function(){ return placeView(K.summary(pickKit())); },
    connect: function(){ return [wireTags(K.summary(pickKit()))]; },
    install: function(){ return [installTrack(K.summary(pickKit()))]; },
    docs: function(){ return [docTags()]; },
    service: function(){ return [afterFacts(K.summary(pickKit()))]; },
    delivery: function(){ var s = K.summary(pickKit()), leads = s.lines.map(function(l){ return l.p.lead; }).filter(Boolean);
      return [tiles([{ k: tx('Статус', 'Status'), v: P.STOCK[s.stock] }, leads.length && { k: tx('Поставка', 'Supply'), v: leads[0], est: tx('Точний строк — у пропозиції', 'The exact date comes in the offer') }])]; },
    expand: function(){ var s = K.summary(pickKit()), par = s.lines.filter(function(l){ return l.p.parallel; });
      return par.length ? [tx('Так:', 'Yes:'), facts(par.map(function(l){ return [l.model, l.p.parallel]; })), tags([tx('Можна почати з меншого', 'You can start smaller')])] : [tx('Так — додатковою батареєю. Підберемо модель.', 'Yes — with an extra battery. We’ll pick the model.')]; },
    solar: function(){ var s = K.summary(pickKit()), mppt = s.lines.map(function(l){ return row(l.p, /MPPT|Від PV|Сонце|From PV|Solar/); }).filter(Boolean)[0];
      return mppt ? [tx('Так — зараз або пізніше.', 'Yes — now or later.'), facts([[tx('Входи PV', 'PV inputs'), mppt]])] : [tx('Ця система — резерв від мережі. Для панелей підберемо сумісну.', 'This system is grid backup. For panels we’ll pick a compatible one.')]; },
    noise: function(){ var s = K.summary(pickKit()), n = s.lines.map(function(l){ return row(l.p, /Шум|Охолодження|Noise|Cooling/); }).filter(Boolean)[0];
      return n ? [facts([[tx('Охолодження', 'Cooling'), n]]), tags([tx('Тихіше за генератор', 'Quieter than a generator'), [tx('Не в спальні', 'Not in a bedroom'), 'warn']])] : [tx('Тихо: вентилятор — лише під навантаженням.', 'Quiet: the fan runs only under load.')]; }
  };
  /* free-text questions: keywords of the page's language */
  var MATCH = [['hours', tx(/скільки.*(працю|вистач|трима|годин)|годин|вистачить|протрима/, /how long.*(last|run|work|keep|power)|\bhours?\b|\blasts?\b|enough|run ?time|backup time/)],
    ['price', tx(/цін|варт|коштує|скільки.*грн|бюджет|входить/, /pric|cost|how much|budget|includ|\buah\b|hryvn|₴/)],
    ['place', tx(/де .*(постав|стоя|розмі)|місц|розмір|габарит|ваг|куди/, /where|place|space|size|dimension|\bbig\b|weigh|heavy|room/)],
    ['connect', tx(/підключ|щит|авр|перемика|схем/, /connect|wir(e|ing)|\bats\b|switch|diagram|circuit|fuse ?box|consumer unit/)],
    ['install', tx(/монтаж|встанов|скільки час|день/, /install|mount|fitting|how long|\bdays?\b/)],
    ['docs', tx(/документ|дозв|оср|приєдна|оформ/, /document|paperwork|permit|permission|\bdso\b|licen[cs]|registr/)],
    ['service', tx(/гарант|сервіс|злама|ремонт/, /warrant|guarantee|service|breaks?\b|broke|repair|fault/)],
    ['delivery', tx(/доставк|коли|наявн|передзам|строк/, /deliver|when|stock|pre-?order|lead time|availab/)],
    ['expand', tx(/розшир|додати батар|більше ємн|пізніше/, /expand|extend|add.*batter|more capacity|later|upgrade/)],
    ['solar', tx(/сонячн|панел/, /solar|panel|\bpv\b/)],
    ['noise', tx(/шум|гуч|тих/, /nois|loud|quiet|sound|\bdb\b|\bfans?\b/)]];
  function answer(key, text){
    if (text) user(text); else user({ hours: tx('Скільки протримає?', 'How long will it last?'), price: tx('Скільки коштує?', 'How much is it?'), place: tx('Де поставити?', 'Where should it go?'), connect: tx('Як підключите?', 'How will you connect it?'), install: tx('Як пройде монтаж?', 'How does installation go?'), docs: tx('Що з документами?', 'What about paperwork?'),
      service: tx('Гарантія й сервіс?', 'Warranty and service?'), delivery: tx('Коли буде?', 'When will it arrive?'), expand: tx('Можна розширити?', 'Can it be expanded?'), solar: tx('Можна додати панелі?', 'Can I add solar panels?'), noise: tx('Чи гучний він?', 'Is it loud?') }[key] || key);
    if (!st.seg) { bot(tx('Спершу підберемо систему.', 'Let’s pick a system first.')); return askSeg(); }
    bot(ASK[key] ? ASK[key]() : tx('Передам інженеру — залиште телефон.', 'I’ll pass this to an engineer — leave your phone number.'), function(){ follow(); });
  }
  function follow(){
    var a = [[tx('Скільки протримає?', 'How long will it last?'), function(){ answer('hours'); }], [tx('Де поставити?', 'Where to put it?'), function(){ answer('place'); }], [tx('Як підключите?', 'How will you connect it?'), function(){ answer('connect'); }], [tx('Документи', 'Paperwork'), function(){ answer('docs'); }]];
    if (st.seg === 'osbb') a.push([tx('Пакет для зборів', 'Meeting pack'), function(){ packFlow(); }, 1]);
    a.push([tx('Зберегти план', 'Save the plan'), askContact, st.seg !== 'osbb']); actions(a);
  }

  /* ---------------- flow ---------------- */
  function askSeg(){ bot(tx('Для кого система?', 'Who is the system for?'), function(){ chips([['flat', tx('Квартира', 'Flat')], ['home', tx('Приватний дім', 'Home')], ['osbb', tx('ОСББ', 'Apartment building')], ['biz', tx('Бізнес', 'Business')]], false, function(v){ st.seg = v; st.kit = null; askLoads(); }); }); }
  function askLoads(){ bot(tx('Що має працювати без світла?', 'What must keep working in a power cut?'), function(){ chips((K.LOADS[st.seg] || []).map(function(r){ return [r[0], r[1], r[4]]; }), true, function(keys){ st.loads = keys; askHours(); }); }); }
  function askHours(){ bot(tx('Скільки годин без мережі?', 'How many hours without the grid?'), function(){ chips([['4', tx('До 4 год', 'Up to 4 h')], ['8', tx('До 8 год', 'Up to 8 h')], ['12', tx('До 12 год', 'Up to 12 h')], ['24', tx('Добу', 'A whole day')]], false, function(v){ st.hours = +v; if (st.seg === 'home' || st.seg === 'biz') askPhases(); else result(); }); }); }
  function askPhases(){ bot(tx('Скільки фаз на вводі?', 'How many phases is your supply?'), function(){ chips([['1', tx('Одна фаза', 'Single-phase')], ['3', tx('Три фази', 'Three-phase')], ['0', tx('Не знаю', 'Not sure')]], false, function(v){ st.phases = +v || 1; if (v === '0') st.unknownPhases = true; result(); }); }); }
  function result(){
    st.kit = null; var kit = pickKit(), s = K.summary(kit), n = need();
    var add = el('button', 'btn btn--volt btn--sm', tx('Додати в заявку', 'Add to request')); add.type = 'button'; add.setAttribute('data-add', ref(kit));
    bot([tx('Підійде зі складу:', 'From our stock:'), kitCard(kit, s), hoursTiles(s, n.avg), st.unknownPhases && tags([[tx('Рахую на 1 фазу', 'Assumed single-phase'), 'warn', tx('Інженер перевірить на огляді', 'The engineer checks at the survey')]]), add], function(){ renderPlan(); follow(); });
  }
  function fromKit(id){
    var kit = K.byId(id); if (!kit) return askSeg(); st.seg = kit.seg; st.kit = kit; kit.fixed = true;
    st.loads = (K.LOADS[st.seg] || []).filter(function(r){ return r[4]; }).map(function(r){ return r[0]; }); st.hours = 8;
    var s = K.summary(kit);
    bot([tx('Ваш вибір:', 'Your choice:'), kitCard(kit, s)], function(){ renderPlan(); bot(tx('Що має працювати без світла?', 'What must keep working in a power cut?'), function(){ chips((K.LOADS[st.seg] || []).map(function(r){ return [r[0], r[1], r[4]]; }), true, function(keys){ st.loads = keys; renderPlan(); bot([tx('План оновлено:', 'Plan updated:'), hoursTiles(K.summary(st.kit), need().avg)], follow); }); }); });
  }
  function fromProduct(id){
    var p = P.byId(id); if (!p) return askSeg();
    bot(tx('«' + p.name + '» — підібрати систему з ним?', 'Build a system around the “' + p.name + '”?'), function(){ chips([['go', tx('Так', 'Yes')], ['other', tx('Інше', 'Something else')]], false, function(){ askSeg(); }); });
  }

  /* ---------------- contact → saved project (the lead) ---------------- */
  function askContact(){
    if (!st.seg) return askSeg();
    if (st.contact) { saveProject(); bot(tx('План уже збережено. Інженер зателефонує.', 'The plan is already saved. An engineer will call.'), follow); return; }
    bot(tx('Кому надіслати план?', 'Who should get the plan?'), function(){
      quick.textContent = ''; var f = el('form', 'cform'); f.noValidate = false;
      var n = el('input', 'input'); n.placeholder = tx('Ім’я', 'Name'); n.required = true; n.autocomplete = 'name'; n.setAttribute('aria-label', tx('Ім’я', 'Name'));
      var ph = el('input', 'input'); ph.type = 'tel'; ph.placeholder = tx('Телефон або Viber', 'Phone or Viber'); ph.required = true; ph.autocomplete = 'tel'; ph.setAttribute('aria-label', tx('Телефон', 'Phone'));
      var b = el('button', 'btn btn--volt btn--sm', tx('Зберегти', 'Save')); b.type = 'submit';
      f.append(n, ph, b); quick.appendChild(f); n.focus();
      f.addEventListener('submit', function(e){ e.preventDefault(); if (!f.reportValidity()) return; st.contact = { name: n.value.trim(), phone: ph.value.trim() }; quick.textContent = ''; user(st.contact.name + ', ' + st.contact.phone); saveProject();
        var okP = el('p', '', tx('Збережено. Інженер зателефонує. ', 'Saved. An engineer will call. ')), dm = el('span', 'demo', tx('демо', 'demo')); dm.title = tx('Дані лишаються у вашому браузері', 'Your details stay in your browser'); okP.appendChild(dm);
        bot(okP, function(){ var s = planEl.querySelector('.plan__btns .btn--volt'); if (s) s.textContent = tx('Збережено ✓', 'Saved ✓'); if (st.pendingPack) { st.pendingPack = false; openPack(); } follow(); }); });
    });
  }
  function saveProject(){
    var kit = pickKit(), s = K.summary(kit);
    try { localStorage.setItem('bess-project', JSON.stringify({ seg: st.seg, loads: st.loads, hours: st.hours, phases: st.phases, items: kit.items, kitId: kit.custom ? null : kit.id, name: kit.custom ? null : kit.name, price: s.priced ? s.price : null, kwh: s.kwh, kw: s.kw, avg: need().avg, contact: st.contact, at: Date.now() })); } catch (e) {}
  }

  /* ---------------- ОСББ meeting pack (a printable document) ---------------- */
  function packFlow(){ if (!st.contact) { st.pendingPack = true; bot([tx('Пакет для зборів:', 'Meeting pack:'), tags([tx('Система', 'System'), tx('Вартість', 'Cost'), tx('Зразок рішення', 'Sample resolution')])], askContact); return; } openPack(); }
  function openPack(){
    var kit = pickKit(), s = K.summary(kit), n = need(), pk = $('#pack'), dlg = $('#packDlg');
    var loads = loadRows().map(function(r){ return lc(r[1]); }).join(', ');
    pk.textContent = '';
    pk.appendChild(el('p', 'pack__k', tx('Пропозиція для загальних зборів співвласників', 'Proposal for the general meeting of co-owners')));
    pk.appendChild(el('h2', '', tx('Резервне живлення будинку від накопичувача енергії', 'Backup power for the building from energy storage')));
    pk.appendChild(el('p', '', tx('Мета: щоб під час відключень працювали ', 'Goal: to keep these running during power cuts: ') + loads + '.'));
    var t = el('table'); s.lines.forEach(function(l){ var tr = el('tr'); tr.append(el('td', '', (l.qty > 1 ? l.qty + ' × ' : '') + l.name + ' (' + l.model + ')'), el('td', '', l.sum != null ? uah(l.sum) : tx('за запитом', 'on request'))); t.appendChild(tr); });
    var trT = el('tr', 'pack__sum'); trT.append(el('td', '', tx('Обладнання разом, орієнтовно з ПДВ', 'Equipment total, indicative, incl. VAT')), el('td', '', s.priced ? uah(s.price) : tx('за запитом', 'on request'))); t.appendChild(trT);
    pk.appendChild(t);
    var tf = el('table'); [[tx('Запас енергії', 'Capacity'), nf(s.kwh, 1) + tx(' кВт·год', ' kWh')], [tx('Потужність', 'Power'), nf(s.kw) + tx(' кВт', ' kW')], [tx('Протримає', 'Runs for'), K.hoursTxt(K.hours(s, n.avg)) + tx(' при ', ' at ') + W(n.avg)], [tx('Монтаж і щит', 'Installation and panel'), tx('за пропозицією після огляду', 'per the offer after the survey')]].forEach(function(r){ var tr = el('tr'); tr.append(el('td', '', r[0]), el('td', '', r[1])); tf.appendChild(tr); });
    pk.appendChild(tf);
    pk.appendChild(el('h3', '', tx('Зразок проєкту рішення', 'Sample draft resolution')));
    var ol = el('ol'); [tx('Встановити систему резервного живлення (накопичувач енергії) для таких навантажень: ', 'To install a backup power system (energy storage) for these loads: ') + loads + tx(' — орієнтовною вартістю обладнання ', ', with an indicative equipment cost of ') + (s.priced ? uah(s.price) : tx('[сума]', '[amount]')) + tx(' плюс монтаж за пропозицією.', ' plus installation as per the offer.'),
      tx('Уповноважити голову правління укласти договір на постачання й монтаж та підписати акти.', 'To authorise the chair of the board to sign the supply and installation contract and the completion certificates.')].forEach(function(x){ ol.appendChild(el('li', '', x)); });
    pk.appendChild(ol);
    pk.appendChild(el('p', 'pack__note', tx('Зразок для обговорення — формулювання погодьте з юристом ОСББ. Ціни орієнтовні; склад і вартість фіксує пропозиція після огляду. Контакт: ', 'A sample for discussion — agree the wording with the OSBB’s lawyer. Prices are indicative; the offer after the survey fixes the equipment and cost. Contact: ') + (st.contact ? st.contact.name + ', ' + st.contact.phone : '')));
    if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', '');
    bot(tx('Пакет готовий — друк або PDF.', 'The pack is ready — print or PDF.'), follow);
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
    if (!st.seg) { var seg = tx(/квартир/, /\bflat\b|apartment(?! (building|block))/).test(t) ? 'flat' : tx(/осбб|будин|під’їзд|ліфт/, /osbb|apartment (building|block)|block of flats|building|stairwell|\blift\b|elevator/).test(t) ? 'osbb' : tx(/бізнес|магазин|офіс|кафе|склад/, /business|shop|store\b|office|caf[eé]|restaurant|warehouse/).test(t) ? 'biz' : tx(/дім|будинок|котедж/, /house|home|cottage/).test(t) ? 'home' : null;
      user(v); if (seg) { st.seg = seg; bot(tx('Зрозумів: ', 'Got it: ') + SEGQ[seg].toLowerCase() + '.', askLoads); } else { bot(tx('Спершу підберемо систему.', 'Let’s pick a system first.'), askSeg); } return; }
    answer(key || '?', v);
  });
  $('#asstReset').addEventListener('click', function(){ msgs.textContent = ''; quick.textContent = ''; planEl.innerHTML = planEmpty; planEl.classList.remove('is-on'); if (jump) jump.hidden = true; st = { seg: null, loads: [], hours: null, phases: null, kit: null, contact: st.contact }; start(); });
  var jump = $('#aPlanJump'); if (jump) jump.addEventListener('click', function(){ S.scrollToEl(planEl); });

  function start(){
    var q = S.q, kit = q.get('kit'), p = q.get('p'), seg = q.get('seg');
    bot(tx('Привіт! Підберу систему зі складу за 3 питання.', 'Hi! I’ll pick a system from our stock in 3 questions.'), function(){
      if (kit) fromKit(kit); else if (p) fromProduct(p); else if (seg && SEGQ[seg]) { st.seg = seg; askLoads(); } else askSeg();
    });
  }
  start();
})();
