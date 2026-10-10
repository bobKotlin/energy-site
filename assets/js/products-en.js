/* =====================================================================
   English overlay for products.js — the build loads it right after
   products.js on the English pages only (site/en/); the servers bundle
   products.js without it and stay Ukrainian. It replaces the visible
   texts of window.PRODUCTS in place: category, segment and stock labels,
   the offer note and, by product id, names, descriptions, highlights, lead times,
   specs and notes. Ids, prices, numbers, models and makers are not
   touched. A product missing from EN keeps its Ukrainian texts — when
   you change a product in products.js, change it here too.
   ===================================================================== */
(function(){
  'use strict';
  var D = window.PRODUCTS; if (!D) return;
  function set(o, en){ Object.keys(en).forEach(function(k){ if (k in o) o[k] = en[k]; }); }
  set(D.CAT, { aio: 'All-in-one units', battery: '51.2 V batteries', hv: 'High-voltage batteries', inverter: 'Hybrid inverters', portable: 'Portable power stations' });
  set(D.WHO, { flat: 'Flat', home: 'Home', osbb: 'Apartment building', biz: 'Business' });
  set(D.STOCK, { 'in': 'In stock', pre: 'Pre-order', order: 'To order' });
  D.OFFER.note = 'Prices are indicative, VAT included, based on retail prices of the same or similar models in Ukraine. We confirm the final price and lead time in the offer.';
  var dm = /^(\d{1,2})\.(\d{2})\.(\d{4})$/.exec(D.OFFER.date);   /* 26.09.2026 → 26 Sep 2026 */
  if (dm) D.OFFER.date = +dm[1] + ' ' + 'Jan Feb Mar Apr May Jun Jul Aug Sep Oct Nov Dec'.split(' ')[dm[2] - 1] + ' ' + dm[3];

  /* texts several products share, by their Ukrainian text */
  var SRC = {
    'Каталог TMT 2026': 'TMT 2026 catalogue',
    'Каталог виробника (CN)': 'Manufacturer catalogue (CN)',
    'Специфікація виробника': 'Manufacturer specification',
    'Даташит виробника': 'Manufacturer datasheet',
    'Сайт виробника': 'Manufacturer’s website'
  };
  var CAP = {
    'Фото виробника в інтер’єрі': 'Manufacturer’s photo in an interior',
    'Фото з даташиту': 'Photo from the datasheet',
    'Монтаж: підлога, стійка, стос, стіна': 'Mounting: floor, rack, stack, wall',
    'Виконання IP20 з дисплеєм': 'IP20 version with a display',
    'Виконання IP65': 'IP65 version',
    'Ряд HV-G5…G8 Pro': 'HV-G5…G8 Pro range',
    'Ряд R20K…R60K': 'R20K…R60K range',
    'Корпус як у 051280A-B-GBP2': 'Same enclosure as the 051280A-B-GBP2'
  };

  var LFP = 'LiFePO₄', V = '51.2 V', FIRST = 'first batch', TEMP = 'charge 0…55 °C · discharge −20…55 °C';
  var EN = {
    /* ---------------- all-in-one ---------------- */
    'mes11ke-15k': { name: 'All-in-one 11 kW · 14.3 kWh', lead: FIRST,
      desc: 'An 11 kW inverter and a 14.3 kWh battery in one cabinet on wheels: factory wiring, two solar inputs, switchover to backup in 10 ms. For backing up the critical loads of apartment buildings and small businesses.',
      hl: ['All in one cabinet', 'On wheels', '10 ms switchover'],
      volt: '51.2 V · 230 V output', parallel: 'up to 6 per phase · 2 in a three-phase setup',
      groups: [['Battery', [['Chemistry', LFP + ' · 280 Ah'], ['Capacity', '14.336 kWh'], ['Voltage', V], ['Cycles', '≥ 8,000'], ['Expansion', 'up to 14 battery packs']]],
        ['Inverter', [['Power', '11 kW · 230 V · up to 48 A'], ['Overload', '2 × rated power for 5 s · motors up to 7 hp'], ['Grid input', '170–280 V, 50/60 Hz · charging up to 19 A'], ['Switchover', '10 ms'], ['Efficiency', '> 95% · idle consumption < 80 W']]],
        ['Solar panels', [['MPPT', '2 inputs · 90–450 V · Voc 500 V'], ['Max. power', '5.5 + 5.5 kW · 22 + 22 A']]],
        ['Enclosure', [['Dimensions', '610 × 846 × 260 mm (W × H × D)'], ['Weight', '≈ 157 kg'], ['Cooling', 'air · up to 60 dB'], ['Temperature', TEMP]]]],
      note: 'To confirm: communication, IP rating, certificates.' },
    'mes6k0e-p': { name: 'All-in-one on wheels 6.2 kW · 6.6 kWh',
      desc: 'A portable all-in-one: backup for a flat or a home, charges from the grid and solar, seamless switchover.',
      hl: ['Portable', 'Charges from grid and solar', 'Seamless switchover'],
      volt: '51.2 V · 230 V output',
      groups: [['Battery', [['Chemistry', LFP], ['Capacity', '6.6 kWh'], ['Voltage', '51.2 V · 44.8–58.6 V'], ['Current', 'up to 1C charge and discharge']]],
        ['Output', [['Power', '6.2 kW · 230 V · 22 A'], ['Frequency', '50/60 Hz, pure sine wave'], ['Sockets', '2 universal']]],
        ['Charging', [['From the grid', '100–450 V · up to 50 A'], ['From PV', 'up to 6 kW · 100–450 V · Voc 500 V · up to 80 A']]],
        ['Enclosure', [['Dimensions', '300 × 540 × 560 mm (W × H × D)'], ['Weight', '87 kg'], ['Cooling', 'forced air'], ['Operating temperature', '0…55 °C'], ['Communication', 'Wi-Fi, RS485']]]] },
    'mes5k0e-d': { name: 'Suitcase station 5 kW · 5.4 kWh',
      desc: 'A mobile system on wheels with a telescopic handle: backup for a flat, charges from the grid, solar or a generator.',
      hl: ['Wheels and handle', 'Charges: grid, solar, generator'],
      volt: '51.2 V · 230 V output',
      groups: [['Battery', [['Chemistry', LFP + ' 3.2 V · 105 Ah, 16S1P'], ['Capacity', '5.376 kWh'], ['Voltage', '51.2 V · 44.8–57.6 V']]],
        ['Output', [['Power', '5 kW · peak 11,000 VA'], ['Voltage', '230 V, single-phase, 50/60 Hz'], ['Efficiency', '92%']]],
        ['Charging', [['From the grid', 'UPS 176–276 V · APL 90–280 V'], ['From PV', '1 MPPT · up to 6 kW · 120–450 V · 22 A · Voc 500 V']]],
        ['Enclosure', [['Dimensions', '310 × 480 × 790 mm'], ['Weight', '80 kg'], ['Operating temperature', '−10…+55 °C'], ['Cooling', 'forced air']]]] },
    /* ---------------- low-voltage batteries ---------------- */
    'tmt-5k': { name: 'Battery module 5.12 kWh with display', lead: FIRST,
      desc: 'A versatile module: stands on the floor, goes in a rack, in a stack or on the wall. Touchscreen, Wi-Fi and Bluetooth, built-in aerosol fire suppression. Up to 18 in parallel — 92.16 kWh.',
      hl: ['Floor, rack or wall', 'Touchscreen', 'Fire suppression', 'Up to 18 in parallel'],
      volt: V, parallel: 'up to 18 · up to 92.16 kWh', warranty: '10 years',
      groups: [['Battery', [['Chemistry', LFP + ' · 100 Ah'], ['Capacity', '5.12 kWh'], ['Usable capacity', '4.864 kWh (DoD 90%)'], ['Voltage', '51.2 V · operating 46–56 V'], ['Current', 'recommended 100 A · max. 150 A'], ['Cycles', '≥ 6,500 (0.5C, 80% EOL)']]],
        ['Enclosure', [['Mounting', 'floor, rack, stack or wall'], ['Dimensions', '400 × 687 × 142 mm'], ['Weight', '62.5 kg'], ['Display', 'touchscreen'], ['Safety', 'aerosol fire suppression'], ['Temperature', TEMP], ['Communication', 'CAN, RS485, Bluetooth, Wi-Fi']]]] },
    'tmt-051200': { name: 'Wall battery 10.24 kWh', lead: FIRST,
      desc: 'A slim wall-mounted battery for a home system, IP65 enclosure. Up to 16 in parallel.',
      hl: ['Slim, wall-mounted', 'IP65', 'Up to 16 in parallel'],
      volt: V, parallel: 'up to 16 · up to 163.8 kWh', warranty: '10 years',
      groups: [['Battery', [['Chemistry', LFP], ['Capacity', '10.24 kWh · 200 Ah'], ['Usable capacity', '9.22 kWh (DoD 80%)'], ['Voltage', '51.2 V · operating 46–56 V'], ['Current', 'recommended 100 A · max. 150 A · peak 200 A (2 min)'], ['Cycles', '≥ 6,500 (0.5C, 80% EOL)']]],
        ['Enclosure', [['Mounting', 'wall-mounted'], ['Dimensions', '550 × 800 × 160 mm'], ['Weight', '102.5 kg'], ['Indicators', '4 charge LEDs + 2 status LEDs'], ['Temperature', TEMP], ['Communication', 'CAN 2.0, RS485']]]] },
    'tmt-051280': { name: 'Wall battery 14.34 kWh',
      volt: '51.2 / 48 V', parallel: 'up to 16 · up to 229 kWh', warranty: '15 years (per catalogue)',
      groups: [['Battery', [['Chemistry', LFP], ['Capacity', '14.34 kWh · 280 Ah'], ['Usable capacity', '12.91 kWh (DoD 80%)'], ['Voltage', '51.2 / 48 V · operating 46–56 V'], ['Current', 'recommended 100 A · max. 150 A · peak 200 A'], ['Cycles', '≥ 8,500']]],
        ['Enclosure', [['Mounting', 'wall-mounted'], ['Dimensions', '900 × 675 × 200 mm'], ['Weight', '128.5 kg'], ['Temperature', TEMP], ['Communication', 'CAN 2.0, RS485']]]],
      note: 'The catalogue lists IP65 and 10 years or IP20 and 15 years. Final values are in the contract.' },
    'tmt-051320': { name: 'Wall battery 16.38 kWh', lead: FIRST,
      volt: V, parallel: 'up to 16 · up to 262 kWh', warranty: '10 years',
      groups: [['Battery', [['Chemistry', LFP], ['Capacity', '16.38 kWh · 320 Ah'], ['Usable capacity', '13.10 kWh'], ['Voltage', '51.2 V · operating 46–56 V'], ['Current', 'recommended 100 A · max. 150 A · peak 200 A'], ['Cycles', '≥ 8,500']]],
        ['Enclosure', [['Mounting', 'wall-mounted'], ['Dimensions', '900 × 675 × 200 mm'], ['Weight', '146.5 kg'], ['Communication', 'CAN 2.0, RS485']]]] },
    'tmt-w16k': { name: 'Floor battery 16.08 kWh',
      desc: 'A floor-standing battery on feet in two versions: IP20 with a display for indoor rooms and IP65 for damp or unheated spaces.',
      hl: ['IP20 with display', 'IP65 for damp spaces'],
      volt: V,
      groups: [['Battery', [['Chemistry', LFP], ['Capacity', '16.08 kWh · 314 Ah'], ['Voltage', '51.2 V · operating 46–56 V · charge up to 56 V'], ['Current', 'charge and discharge up to 200 A'], ['Max. power', '7,680 W'], ['Cycles', '≥ 8,500 (0.5C, 80% EOL)'], ['Design life', '10 years']]],
        ['Enclosure', [['Dimensions', '522.6 × 1007 × 343 mm'], ['Weight', '145.5 kg'], ['Operating temperature', '−20…60 °C'], ['Storage', '5 months at 25 °C · 3 months at 35 °C']]]] },
    'esb-fl16-f01': { name: 'Battery on wheels 16.1 kWh',
      desc: 'A 51.2 V floor-standing battery for SPI series hybrid inverters; up to 16 in parallel.',
      hl: ['For SPI inverters', 'Up to 16 in parallel'],
      volt: V, parallel: 'up to 16', warranty: '5 years',
      groups: [['Battery', [['Chemistry', LFP], ['Capacity', '16.076 kWh'], ['Voltage', V], ['Cycles', '6,500']]],
        ['Enclosure', [['Dimensions', '522.6 × 1007 × 343 mm'], ['Weight', '118 kg'], ['Communication', 'CAN 2.0, RS485'], ['In the box', 'communication cable, + and − power cables']]]] },
    'esb-fl10-f01': { name: 'Battery on wheels 23.6 kWh',
      volt: V, parallel: 'up to 16', warranty: '5 years',
      groups: [['Battery', [['Chemistry', LFP], ['Capacity', '23.556 kWh'], ['Voltage', V], ['Cycles', '6,500']]],
        ['Enclosure', [['Dimensions', '775 × 1007 × 543 mm'], ['Weight', '192 kg'], ['Communication', 'CAN 2.0, RS485']]]] },
    'esb-3u05': { name: 'Rack module 5.12 kWh',
      desc: 'A 3U rack module: automatic paralleling without DIP switches, Bluetooth for updates and monitoring.',
      hl: ['3U rack', 'Auto paralleling', 'Bluetooth'],
      volt: V, parallel: 'up to 16',
      groups: [['Battery', [['Chemistry', LFP + ', 16S1P · 100 Ah'], ['Capacity', '5.12 kWh'], ['Voltage', V], ['Cycles', '6,000']]],
        ['Enclosure', [['Dimensions', '460 × 482 × 132 mm'], ['Weight', '45 kg'], ['Communication', 'CAN, RS485, Bluetooth']]]] },
    'esb-pw12': { name: 'Wall battery 11.78 kWh',
      volt: V, parallel: 'up to 6',
      groups: [['Battery', [['Chemistry', LFP + ', 16S1P · 230 Ah'], ['Capacity', '11.78 kWh'], ['Voltage', V], ['Cycles', '6,000']]],
        ['Enclosure', [['Dimensions', '680 × 480 × 250 mm'], ['Weight', '63 kg'], ['Communication', 'CAN, RS485, Bluetooth']]]] },
    'esb-fl16-a01': { name: 'Battery on wheels 16.07 kWh',
      volt: V, parallel: 'up to 6',
      groups: [['Battery', [['Chemistry', LFP + ', 16S1P · 314 Ah'], ['Capacity', '16.067 kWh'], ['Voltage', V], ['Cycles', '6,000']]],
        ['Enclosure', [['Dimensions', '750 × 370 × 250 mm'], ['Weight', '110 kg'], ['Communication', 'CAN, RS485, Bluetooth']]]] },
    'esb-fl31': { name: 'Battery on wheels 32.13 kWh',
      volt: V, parallel: 'up to 6',
      groups: [['Battery', [['Chemistry', LFP + ', 16S2P · 2 × 314 Ah'], ['Capacity', '32.13 kWh'], ['Voltage', V], ['Cycles', '6,000']]],
        ['Enclosure', [['Dimensions', '790 × 390 × 700 mm (780 with wheels)'], ['Weight', '255 kg'], ['Communication', 'CAN, RS485, Bluetooth']]]] },
    /* ---------------- high-voltage stacks ---------------- */
    'tmt-hvg': { name: 'High-voltage rack 20–41 kWh',
      desc: 'A modular rack: 4–8 modules in series, 204.8–409.6 V, for high-voltage hybrid inverters.',
      hl: ['4–8 modules', 'For HV inverters'],
      volt: '204.8–409.6 V', parallel: 'up to 5 racks',
      variants: { 'HV-G4 Pro': { v: '204.8 V' }, 'HV-G5 Pro': { v: '256 V' }, 'HV-G6 Pro': { v: '307.2 V' }, 'HV-G7 Pro': { v: '358.4 V' }, 'HV-G8 Pro': { v: '409.6 V' } },
      groups: [['System', [['Chemistry', LFP], ['Modules', '3S–8S in series'], ['Operating current', '100 A · peak 65 A (5 s)'], ['Self-discharge', '≤ 6% per month'], ['Temperature', 'charge 0…55 °C · discharge −20…60 °C'], ['Communication', 'CAN, TCP/IP'], ['Mounting', 'floor-standing']]]] },
    'tmt-r': { model: 'R series', name: 'High-voltage rack 20–61 kWh',
      volt: '204.8–614.4 V', parallel: 'up to 5 racks', warranty: '10 years',
      variants: { R20K: { v: '204.8 V' }, R30K: { v: '307.2 V' }, R40K: { v: '409.6 V' }, R50K: { v: '512 V' }, R60K: { v: '614.4 V' } },
      groups: [['System', [['Chemistry', LFP], ['Range', 'R20K, R25K … R60K — in 5.12 kWh steps'], ['Operating current', '100 A · peak 125 A (5 s)'], ['Self-discharge', '≤ 3.5% per month'], ['Temperature', 'charge 0…55 °C · discharge −20…60 °C'], ['Communication', 'CAN, TCP/IP'], ['Mounting', 'floor-standing']]]] },
    /* ---------------- inverters ---------------- */
    'tmt-3ph': { name: 'Hybrid inverter 8–24 kW, three-phase', lead: 'first batch: 10, 12, 16, 20, 24 kW',
      desc: 'A three-phase low-voltage hybrid for homes, apartment buildings and small businesses: 51.2 V battery, up to 500 A charge and discharge, two MPPTs, IP66 aluminium enclosure. Up to 8 in parallel; connects to an existing solar plant via AC coupling.',
      hl: ['51.2 V battery', 'IP66, aluminium', 'Up to 8 in parallel', 'AC coupling to solar'],
      volt: '380/400 V · battery 40–60 V', parallel: 'up to 8',
      variants: { '8K-3PH': { rows: [['Battery current', 'up to 200 A'], ['Max. PV', '16 kW']] }, '10K-3PH': { rows: [['Battery current', 'up to 250 A'], ['Max. PV', '20 kW']] },
        '12K-3PH': { rows: [['Battery current', 'up to 280 A'], ['Max. PV', '24 kW']] }, '15K-3PH': { rows: [['Battery current', 'up to 375 A'], ['Max. PV', '30 kW']] },
        '18K-3PH': { rows: [['Battery current', 'up to 430 A'], ['Max. PV', '36 kW']] }, '20K-3PH': { rows: [['Battery current', 'up to 450 A'], ['Max. PV', '40 kW']] },
        '24K-3PH': { rows: [['Battery current', 'up to 500 A'], ['Max. PV', '48 kW']] } },
      groups: [['Inverter', [['Output', '380/400 V, 3W+N+PE, 50/60 Hz'], ['Grid input', '154–286 V per phase, frequency detected automatically'], ['Off-grid', 'overload 200% for 10 s · phase imbalance up to 150%'], ['Switchover', '< 20 ms'], ['Efficiency', 'max. 97.5–98% · European 97–97.2%']]],
        ['Battery', [['Type', 'lithium or lead-acid'], ['Voltage', '51.2 V (40–60 V)'], ['Inputs', 'three battery inputs']]],
        ['Solar panels', [['MPPT', '2 · strings 2 + 2'], ['Voltage', '150–950 V · start-up 180 V · max. 1000 V'], ['Current', '4 × 20 A']]],
        ['Enclosure', [['Dimensions', '448 × 660 × 265 mm'], ['Protection', 'IP66, aluminium enclosure'], ['Noise', '< 40–45 dB'], ['Temperature', '−25…60 °C, derating above 45 °C'], ['Communication', 'RS485, Wi-Fi, CAN, DRM; optional Bluetooth, LAN, meter'], ['Display', 'LCD + app']]]],
      note: 'Also available: 16 kW.' },
    'spi48120v100': { name: 'Hybrid inverter 10 kW, single-phase',
      desc: 'A hybrid inverter for grid-tied and off-grid use; EU standard. Optional: a current transformer for zero export and a Wi-Fi module.',
      hl: ['Grid and off-grid', 'EU standard', 'Wi-Fi optional'],
      volt: '230 V · battery 40–60 V', warranty: '5 years',
      groups: [['Inverter', [['Power', '10 kW'], ['Output', '220/230 V (L-N), 50/60 Hz'], ['Battery', '40–60 V']]], ['Solar panels', [['Max. PV', '12 kW'], ['PV range', '90–450 V']]],
        ['Enclosure', [['Dimensions', '515 × 365 × 120 mm'], ['Weight', '13 kg'], ['In the box', 'mounting kit, parallel cable, manual']]]] },
    'spi4862v100': { name: 'Hybrid inverter 6.2 kW, single-phase',
      volt: '230 V · battery 51.2 V', parallel: 'up to 6, three-phase',
      groups: [['Inverter', [['Power', '6,200 W · peak 12,000 VA (200% for 5 s)'], ['Efficiency', '> 94%'], ['Grid input', '170–280 V (UPS) · 90–280 V (APL)'], ['Functions', 'UPS, generator, battery-free operation, zero export']]],
        ['Battery', [['Type', 'AGM / GEL / LiFePO₄'], ['Voltage', V], ['Charging', 'up to 80 A']]], ['Solar panels', [['MPPT', '1 · 90–450 V'], ['Max. PV', '6,000 W · 27 A · Voc 500 V']]],
        ['Enclosure', [['Dimensions', '428 × 280 × 110 mm'], ['Weight', '8.2 kg'], ['Temperature', '−10…55 °C'], ['Communication', 'USB, RS485, Wi-Fi, GPRS, dry contact']]]] },
    'spi48120v150': { name: 'Hybrid inverter 12 kW, single-phase',
      volt: '230 V · battery 51.2 V', parallel: 'up to 6, three-phase',
      groups: [['Inverter', [['Power', '12,000 W · peak 24,000 VA'], ['Efficiency', '> 94%'], ['Grid input', '170–280 V (UPS) · 90–280 V (APL)'], ['Functions', 'UPS, generator, battery-free operation, over-the-air updates']]],
        ['Battery', [['Type', 'AGM / GEL / LiFePO₄'], ['Voltage', V], ['Charging', 'up to 150 A']]], ['Solar panels', [['MPPT', '2 · 90–450 V'], ['Max. PV', '9,000 + 9,000 W · 27 + 27 A']]],
        ['Enclosure', [['Dimensions', '540 × 350 × 120 mm'], ['Weight', '19.5 kg'], ['Communication', 'USB, RS485, Wi-Fi, GPRS, dry contact']]]] },
    /* ---------------- portable & micro ---------------- */
    'e500': { name: 'Portable power station 576 Wh', lead: FIRST,
      groups: [['Battery', [['Chemistry', LFP], ['Capacity', '576 Wh'], ['Cycles', '3,500+ to 80%']]], ['Inputs', [['Mains', '500 W · charges in 1.5 h'], ['Solar', '12–28 V · 100 W'], ['Car', '12–24 V · 100 W']]],
        ['Outputs', [['AC', '600 W (UPS)'], ['DC', '12 V 10/5 A · 24 V 5 A'], ['USB', 'USB-C 100 W · 2 × USB-A 18 W · wireless 15 W']]], ['Enclosure', [['Dimensions', '254 × 172 × 189 mm'], ['Weight', '6.75 kg']]]] },
    'e1000': { name: 'Portable power station 1,024 Wh', lead: FIRST,
      groups: [['Battery', [['Chemistry', LFP + ' · 51.2 V 20 Ah'], ['Capacity', '1,024 Wh'], ['Cycles', '3,500+ to 80%']]], ['Inputs', [['Mains', '1,000 W · charges in 1.3 h'], ['Solar', '11–60 V · 600 W'], ['Car', '11–60 V · 600 W']]],
        ['Outputs', [['AC', '1,800 W, pure sine wave (UPS)'], ['DC', '12 V 20/10/5 A'], ['USB', '2 × USB-C 100 W · 2 × USB-A 18 W']]], ['Enclosure', [['Dimensions', '378 × 239 × 255 mm'], ['Weight', '13.5 kg']]]] },
    'e1500': { name: 'Portable power station 1,536 Wh', lead: FIRST,
      groups: [['Battery', [['Chemistry', LFP + ' · 51.2 V 30 Ah'], ['Capacity', '1,536 Wh, expandable'], ['Cycles', '3,500+ to 80%']]],
        ['Inputs', [['Mains', 'up to 1,400 W · full charge in 1.8 h'], ['Solar', '12–25 V up to 100 W · 32–95 V up to 700 W'], ['Car', '12–18 V · 100 W']]],
        ['Outputs', [['AC', '2,200 W, pure sine wave · UPS 210–230 V'], ['DC', '12 V 30 A'], ['USB', 'USB-C 100 + 18 W · 4 × USB-A 18 W · wireless 15 W']]],
        ['Enclosure', [['Dimensions', '377 × 237 × 305 mm'], ['Weight', '≈ 18.5 kg'], ['Operating temperature', '−20…45 °C'], ['Control', 'app']]]] },
    'e2400': { name: 'Portable power station 2,048 Wh', lead: FIRST,
      groups: [['Battery', [['Chemistry', LFP + ' · 51.2 V 40 Ah'], ['Capacity', '2,048 Wh, expandable'], ['Cycles', '3,500+ to 80%']]],
        ['Inputs', [['Mains', 'up to 2,000 W · full charge in 1.6 h'], ['Solar', '12–28 V up to 100 W · 32–95 V up to 700 W'], ['Car', '12–18 V · 100 W']]],
        ['Outputs', [['AC', '2,400 W, pure sine wave · UPS'], ['DC', '12 V: 30 A, 10 A, 5 A'], ['USB', 'USB-C 100 + 18 W · 4 × USB-A 18 W · wireless 15 W']]],
        ['Enclosure', [['Dimensions', '377 × 237 × 329 mm'], ['Weight', '≈ 20.5 kg'], ['Operating temperature', '−20…45 °C'], ['Control', 'app']]]] },
    'e3600': { name: 'Portable power station 3,072 Wh', lead: FIRST,
      groups: [['Battery', [['Chemistry', LFP + ' · 51.2 V 60 Ah'], ['Capacity', '3,072 Wh, expandable'], ['Cycles', '3,500+ to 80%']]],
        ['Inputs', [['Mains', 'up to 3,200 W · full charge in 1.5 h'], ['Solar', '12–30 V up to 150 W · 2 × 32–150 V up to 1,200 W'], ['Car', '12–30 V · 150 W']]],
        ['Outputs', [['AC', '3,600 W, pure sine wave · UPS'], ['DC', '12 V: 30 A, 10 A, 5 A'], ['USB', 'USB-C 100 + 18 W · 4 × USB-A 18 W · 2 wireless, 15 W each']]],
        ['Enclosure', [['Dimensions', '445 × 307 × 350 mm'], ['Weight', '≈ 36 kg'], ['Operating temperature', '−20…45 °C'], ['Control', 'IPS touchscreen, app']]]] },
    'f5000': { name: 'High-power station 5,120 Wh · 7.2 kW', lead: FIRST,
      desc: 'The largest station in the line-up: 7.2 kW of output runs a water heater, a pump or an electric cooker. Charges from the mains or from two 3 kW solar inputs.',
      hl: ['Runs a water heater or cooker', '2 × 3 kW solar inputs'],
      groups: [['Battery', [['Chemistry', LFP + ' · 51.2 V 100 Ah'], ['Capacity', '5,120 Wh, expandable'], ['Cycles', '3,500+ to 80%']]],
        ['Inputs', [['Mains', 'up to 3,600 W · full charge in 2.4 h'], ['Solar', '2 × 30–200 V up to 3,000 W, 20 A'], ['UPS', '220–240 V, up to 15 A']]],
        ['Outputs', [['AC', '7,200 W, pure sine wave'], ['DC', '12–40 V · 30 A · up to 800 W'], ['USB', '2 × USB-C PD 100 W · 2 × USB-A 18 W']]],
        ['Enclosure', [['Dimensions', '550 × 380 × 285 mm'], ['Weight', '≈ 60 kg'], ['Operating temperature', '−10…45 °C'], ['Control', 'touchscreen, app, statistics']]]] },
    'ph1600': { name: 'Balcony micro-station 1,024 Wh',
      desc: 'The core of a balcony system: works with the grid and micro-inverters, charges in the cheap hours. Up to 6 units in parallel — up to 21.6 kW.',
      hl: ['Works with micro-inverters', 'Charges in cheap hours', 'Up to 6 in parallel'],
      groups: [['Key specs', [['Chemistry', LFP], ['Capacity', '1,024 Wh'], ['Voltage', '45–58.4 V'], ['Output', '1,200 W'], ['PV input', 'up to 1,200 W']]],
        ['Enclosure', [['Dimensions', '320 × 200 × 198 mm'], ['Weight', '9.27 kg'], ['Temperature', 'charge 0…55 °C · operation −25…65 °C'], ['Communication', 'CAN, RS485']]]] },
    'ex800': { name: 'Balcony micro-station 2,160 Wh',
      groups: [['Key specs', [['Chemistry', LFP], ['Capacity', '2,160 Wh'], ['Voltage', '37.5–54.75 V'], ['PV input', 'up to 1,200 W']]],
        ['Enclosure', [['Dimensions', '480 × 204 × 157 mm'], ['Weight', '21.45 kg'], ['Communication', 'CAN, RS485, Wi-Fi, Bluetooth']]]] }
  };

  /* rows per spec group: if products.js changed a product's specs, its English needs the same change */
  function shape(g){ return (g || []).map(function(x){ return x[1].length; }).join(); }
  D.list.forEach(function(p){
    (p.sources || []).forEach(function(s){ if (SRC[s.t]) s.t = SRC[s.t]; });
    (p.img || []).forEach(function(i){ if (CAP[i.cap]) i.cap = CAP[i.cap]; });
    var e = EN[p.id]; if (!e) return;
    ['model', 'name', 'desc', 'hl', 'lead', 'volt', 'parallel', 'warranty', 'note'].forEach(function(k){ if (e[k] != null && p[k] != null) p[k] = e[k]; });
    if (e.groups) { if (shape(e.groups) !== shape(p.groups) && window.console) console.warn('products-en.js: specs of ' + p.id + ' differ from products.js'); p.groups = e.groups; }
    (p.variants || []).forEach(function(v){ var x = e.variants && e.variants[v.model]; if (!x) return; if (x.v && v.v) v.v = x.v; if (x.rows && v.rows) v.rows = x.rows; });
  });
})();
