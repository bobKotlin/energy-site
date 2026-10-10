/* =====================================================================
   Component catalogue — one source for the 3D plan cards, the cost table
   and the equipment page. Values are TYPICAL examples until the partner
   catalogue is confirmed; each spec row is marked as such in the UI.
   ===================================================================== */
window.CATALOG = (function(){
  'use strict';
  var LOCALE = window.Site ? window.Site.locale : 'uk-UA';
  var nf = function(n, d){ return n.toLocaleString(LOCALE, { minimumFractionDigits: d || 0, maximumFractionDigits: d || 0 }); };
  var C = {
    homeModule: {
      k: tx('Батарея', 'Battery'), name: tx('Батарейний модуль 5,12 кВт·год', 'Battery module 5.12 kWh'), short: tx('Модулі LFP', 'LFP modules'),
      desc: tx('Більше модулів — довший резерв.', 'More modules — longer backup.'),
      specs: function(it){ return [[tx('Хімія', 'Chemistry'), 'LiFePO₄'], [tx('Ємність модуля', 'Module capacity'), tx('5,12 кВт·год', '5.12 kWh')], [tx('Разом у системі', 'Total in the system'), nf(it.qty * 5.12, 2) + tx(' кВт·год', ' kWh')], [tx('Напруга', 'Voltage'), tx('51,2 В', '51.2 V')], [tx('Ресурс', 'Cycle life'), tx('6 000+ циклів', '6,000+ cycles')], [tx('Захист', 'Protection'), 'IP65']]; }
    },
    hybridInverter: {
      k: tx('Перетворення', 'Conversion'), name: tx('Гібридний інвертор', 'Hybrid inverter'), short: tx('Інвертор', 'Inverter'),
      desc: tx('Заряд, живлення й автоперемикання на резерв.', 'Charging, power and automatic switch to backup.'),
      specs: function(it){ return [[tx('Потужність', 'Power'), nf(it.kw) + tx(' кВт', ' kW') + (it.qty > 1 ? ' × ' + it.qty : '')], [tx('ККД', 'Efficiency'), tx('до 97,6 %', 'up to 97.6 %')], [tx('Режими', 'Modes'), tx('мережа · автономія · резерв', 'grid · off-grid · backup')], [tx('Перемикання на резерв', 'Switch to backup'), tx('до 20 мс', 'up to 20 ms')], [tx('Моніторинг', 'Monitoring'), tx('Wi-Fi, застосунок', 'Wi-Fi, app')]]; }
    },
    cabinet: {
      k: tx('Накопичувач', 'Storage'), name: tx('Шафа 215 кВт·год · 100 кВт', 'Cabinet 215 kWh · 100 kW'), short: tx('Шафи BESS', 'BESS cabinets'),
      desc: tx('Усе в одному корпусі.', 'All in one enclosure.'),
      specs: function(it){ return [[tx('Ємність', 'Capacity'), tx('215 кВт·год', '215 kWh') + (it.qty > 1 ? ' × ' + it.qty : '')], [tx('Інвертор', 'Inverter'), tx('вбудований, 100 кВт', 'built-in, 100 kW')], [tx('Хімія', 'Chemistry'), tx('LiFePO₄, 280 А·год', 'LiFePO₄, 280 Ah')], [tx('Охолодження', 'Cooling'), tx('рідинне', 'liquid')], [tx('Пожежогасіння', 'Fire suppression'), tx('аерозольне + датчики газу', 'aerosol + gas sensors')], [tx('Захист', 'Protection'), 'IP54'], [tx('Габарити', 'Dimensions'), tx('≈ 1,0 × 1,4 × 2,3 м', '≈ 1.0 × 1.4 × 2.3 m')]]; },
      parts: [tx('Модулі LFP з BMS', 'LFP modules with BMS'), tx('Інвертор 100 кВт', '100 kW inverter'), tx('Рідинне охолодження', 'Liquid cooling'), tx('Пожежогасіння', 'Fire suppression'), tx('Контролер і дисплей', 'Controller and display')]
    },
    container: {
      k: tx('Накопичувач', 'Storage'), name: tx('Контейнер 2,5 МВт·год', 'Container 2.5 MWh'), short: tx('Контейнери BESS', 'BESS containers'),
      desc: tx('Промисловий 20-футовий формат.', 'Industrial 20-foot format.'),
      specs: function(it){ return [[tx('Ємність', 'Capacity'), tx('2,5 МВт·год', '2.5 MWh') + (it.qty > 1 ? ' × ' + it.qty : '')], [tx('Формат', 'Format'), tx('20-футовий контейнер', '20-foot container')], [tx('Хімія', 'Chemistry'), 'LiFePO₄'], [tx('Охолодження', 'Cooling'), tx('рідинне', 'liquid')], [tx('Пожежогасіння', 'Fire suppression'), tx('газове + аерозольне', 'gas + aerosol')], [tx('Захист', 'Protection'), 'IP55'], [tx('Габарити', 'Dimensions'), tx('6,06 × 2,44 × 2,9 м', '6.06 × 2.44 × 2.9 m')]]; },
      parts: [tx('Батарейні стелажі', 'Battery racks'), tx('Рідинне охолодження', 'Liquid cooling'), tx('Газове пожежогасіння', 'Gas fire suppression'), tx('BMS і шафа керування', 'BMS and control cabinet')]
    },
    pcs: {
      k: tx('Перетворення', 'Conversion'), name: tx('Інвертор (PCS) 1 250 кВт', 'Inverter (PCS) 1,250 kW'), short: tx('Інвертори PCS', 'PCS inverters'),
      desc: tx('Постійний струм батарей ↔ змінний мережі.', 'Battery DC ↔ grid AC.'),
      specs: function(it){ return [[tx('Потужність', 'Power'), tx('1 250 кВт', '1,250 kW') + (it.qty > 1 ? ' × ' + it.qty : '')], [tx('ККД', 'Efficiency'), tx('до 98,5 %', 'up to 98.5 %')], [tx('Режими', 'Modes'), tx('з мережею · острівний', 'grid-tied · island')], [tx('Сертифікати', 'Certificates'), 'EN 50549-1/-2, EN 62109'], [tx('Охолодження', 'Cooling'), tx('примусове повітряне', 'forced air')]]; }
    },
    transformer: {
      k: tx('Приєднання', 'Grid connection'), name: tx('Трансформатор 0,4 / 10 кВ', 'Transformer 0.4 / 10 kV'), short: tx('Трансформатор', 'Transformer'),
      desc: tx('Для мереж 10 кВ, від кількох сотень кВт.', 'For 10 kV networks, from a few hundred kW.'),
      specs: function(it){ return [[tx('Потужність', 'Power'), nf(it.kva) + tx(' кВА', ' kVA') + (it.qty > 1 ? ' × ' + it.qty : '')], [tx('Напруга', 'Voltage'), tx('0,4 / 10 кВ', '0.4 / 10 kV')], [tx('Тип', 'Type'), tx('сухий або масляний', 'dry or oil-filled')], [tx('ККД', 'Efficiency'), '≈ 99 %']]; }
    },
    ems: {
      k: tx('Керування', 'Control'), name: tx('EMS і телеметрія', 'EMS and telemetry'), short: 'EMS',
      desc: tx('Розклад заряду під ціни й телеметрія.', 'Charge schedule by price, telemetry.'),
      specs: function(){ return [[tx('Функції', 'Functions'), tx('арбітраж · зрізання піків · резерв', 'arbitrage · peak shaving · backup')], [tx('Телеметрія', 'Telemetry'), 'IEC 60870-5-104'], [tx('Канал зв’язку', 'Communication link'), tx('основний + резервний', 'main + backup')], [tx('Моніторинг', 'Monitoring'), tx('веб-панель, сповіщення', 'web dashboard, alerts')]]; }
    },
    switchboard: {
      k: tx('Розподіл', 'Distribution'), name: tx('Головний щит', 'Main switchboard'), short: tx('Щит', 'Switchboard'),
      desc: tx('Підключення за лічильником, захист, АВР.', 'Behind-the-meter connection, protection, ATS.'),
      specs: function(it){ return [[tx('Виконання', 'Design'), it.mv ? tx('КРП 10 кВ', '10 kV switchgear') : tx('0,4 кВ', '0.4 kV')], [tx('Захист', 'Protection'), tx('автомати, ПЗВ, від зворотного живлення', 'breakers, RCD, reverse-power protection')], [tx('АВР', 'ATS'), tx('автоматичне введення резерву', 'automatic transfer to backup')]]; }
    },
    meter: {
      k: tx('Облік', 'Metering'), name: tx('Комерційний облік', 'Commercial metering'), short: tx('Лічильник', 'Meter'),
      desc: tx('Погодинний облік в обидва боки.', 'Hourly metering both ways.'),
      specs: function(){ return [[tx('Тип', 'Type'), tx('двонаправлений, погодинний', 'bidirectional, hourly')], [tx('Вимоги', 'Requirements'), tx('Кодекс комерційного обліку, пост. НКРЕКП № 311', 'Commercial Metering Code, NEURC resolution No. 311')], [tx('Дані', 'Data'), tx('для ОСР і ринку', 'for the DSO and the market')]]; }
    },
    grid: { k: tx('Мережа', 'Grid'), name: tx('Точка приєднання', 'Connection point'), short: tx('Мережа', 'Grid'), desc: tx('Лінія ОСР вашого регіону.', 'Your region’s DSO line.'), specs: function(){ return [[tx('Оператор', 'Operator'), tx('ОСР вашого регіону', 'the DSO of your region')], [tx('Плата за приєднання', 'Connection fee'), tx('за ставками НКРЕКП', 'at NEURC rates')]]; } },
    site: { k: tx('Споживач', 'Consumer'), name: tx('Ваш об’єкт', 'Your site'), short: tx('Об’єкт', 'Site'), desc: tx('Живиться від накопичувача в пік і без світла.', 'Runs on the storage at peaks and in outages.'), specs: function(){ return [[tx('Живлення в пік', 'Power at the peak'), tx('від накопичувача', 'from the storage')], [tx('Під час відключення', 'During an outage'), tx('резерв через АВР', 'backup via the ATS')]]; } },
    install: { k: tx('Роботи', 'Works'), name: tx('Монтаж і пусконалагодження', 'Installation and commissioning'), short: tx('Монтаж', 'Installation'), desc: '' },
    design: { k: tx('Роботи', 'Works'), name: tx('Проєкт, дозволи, сертифікація', 'Design, permits, certification'), short: tx('Проєкт', 'Design'), desc: '' }
  };
  /* Equipment page: products shown in the 3D viewer, each maps to a component model. */
  var PRODUCTS = [
    { id: 'home-module', model: 'homeModule', seg: 'home', title: tx('Батарейний модуль 5,12 кВт·год', 'Battery module 5.12 kWh'), sub: tx('Для дому · настінна стійка до 6 модулів', 'For homes · wall rack for up to 6 modules') },
    { id: 'hybrid-10', model: 'hybridInverter', seg: 'home', title: tx('Гібридний інвертор 5–10 кВт', 'Hybrid inverter 5–10 kW'), sub: tx('Для дому · перемикання на резерв до 20 мс', 'For homes · switches to backup in up to 20 ms'), it: { kw: 10, qty: 1 } },
    { id: 'cab-215', model: 'cabinet', seg: 'biz', title: tx('Шафа 215 кВт·год · 100 кВт', 'Cabinet 215 kWh · 100 kW'), sub: tx('Для бізнесу · все в одному корпусі', 'For business · all in one enclosure') },
    { id: 'cont-25', model: 'container', seg: 'ind', title: tx('Контейнер 2,5 МВт·год', 'Container 2.5 MWh'), sub: tx('Промисловий · 20-футовий формат', 'Industrial · 20-foot format') },
    { id: 'pcs-1250', model: 'pcs', seg: 'ind', title: tx('Інвертор PCS 1 250 кВт', 'PCS inverter 1,250 kW'), sub: tx('Промисловий · EN 50549', 'Industrial · EN 50549') },
    { id: 'tr-1600', model: 'transformer', seg: 'grid', title: tx('Трансформатор 0,4 / 10 кВ', 'Transformer 0.4 / 10 kV'), sub: tx('Приєднання · 400–2 500 кВА', 'Grid connection · 400–2,500 kVA'), it: { kva: 1600, qty: 1 } },
    { id: 'ems', model: 'ems', seg: 'grid', title: tx('EMS і телеметрія', 'EMS and telemetry'), sub: tx('Керування · IEC 60870-5-104', 'Control · IEC 60870-5-104') },
    { id: 'meter', model: 'meter', seg: 'grid', title: tx('Комерційний облік', 'Commercial metering'), sub: tx('Облік · пост. НКРЕКП № 311', 'Metering · NEURC resolution No. 311') }
  ];
  function specs(key, it){ var c = C[key]; return c && c.specs ? c.specs(Object.assign({ qty: 1, kw: 10, kva: 1600 }, it || {})) : []; }
  return { C: C, PRODUCTS: PRODUCTS, specs: specs };
})();
