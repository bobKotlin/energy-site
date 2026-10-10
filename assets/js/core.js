/* =====================================================================
   Site shell — shared by every page: helpers, brand, header and mobile
   menu, smooth scroll, reveals, magnetic buttons, project store.
   Language: the page's <html lang> (uk, or en for the pages in en/);
   scripts write their texts as tx('Українською', 'In English').
   ===================================================================== */
(function(){
  'use strict';
  var d = document, html = d.documentElement;
  html.classList.remove('no-js');
  var LANG = html.lang === 'en' ? 'en' : 'uk', EN = LANG === 'en';
  window.tx = function(uk, en){ return EN && en != null ? en : uk; };
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches, G = window.gsap, ST = window.ScrollTrigger;
  var fine = window.matchMedia('(pointer:fine)').matches;
  if (RM || !G) html.classList.add('rm');
  if (G && ST) G.registerPlugin(ST); if (G && window.SplitText) G.registerPlugin(window.SplitText);

  var LOCALE = EN ? 'en-GB' : 'uk-UA';
  var nf = function(n, dg){ return n.toLocaleString(LOCALE, { minimumFractionDigits: dg || 0, maximumFractionDigits: dg || 0 }); };
  function money(n, sign){ var a = Math.abs(n), s = n < -.5 ? '−' : (sign && n > .5 ? '+' : '');
    if (EN) { if (a >= 1e6) return s + '₴' + nf(a / 1e6, 2) + 'M'; if (a >= 1e5) return s + '₴' + nf(Math.round(a / 1e3)) + 'k'; return s + '₴' + nf(Math.round(a)); }
    if (a >= 1e6) return s + nf(a / 1e6, 2) + ' млн ₴'; if (a >= 1e5) return s + nf(Math.round(a / 1e3)) + ' тис. ₴'; return s + nf(Math.round(a)) + ' ₴'; }
  /* a sum in hryvnias: «12 400 ₴» / «₴12,400» */
  function uah(v, sign){ if (v == null) return '—'; var a = Math.abs(v), s = v < -.5 ? '−' : sign && v > .5 ? '+' : ''; return EN ? s + '₴' + nf(Math.round(a)) : s + nf(Math.round(a)) + ' ₴'; }
  function years(y){ if (!isFinite(y) || y <= 0) return tx('не окупиться', 'never pays back'); if (y > 30) return tx('понад 30 років', 'over 30 years'); var r = Math.round(y * 10) / 10;
    if (EN) return nf(r, r % 1 ? 1 : 0) + (r === 1 ? ' year' : ' years');
    if (r % 1) return nf(r, 1) + ' року';
    var m10 = r % 10, m100 = r % 100; return nf(r) + (m10 === 1 && m100 !== 11 ? ' рік' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? ' роки' : ' років'); }
  /* Ukrainian plural forms (1 / 2–4 / 5+) or English (1 / many): plural(n, ['день', 'дні', 'днів'], ['day', 'days']) */
  function plural(n, uk, en){ if (EN) return n === 1 ? en[0] : en[1]; var m10 = n % 10, m100 = n % 100; return m10 === 1 && m100 !== 11 ? uk[0] : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? uk[1] : uk[2]; }
  function capTxt(c){ return c >= 1000 ? nf(c / 1000, c % 1000 ? 2 : 0) + tx(' МВт·год', ' MWh') : nf(c, c % 1 ? 2 : 0) + tx(' кВт·год', ' kWh'); }
  function powTxt(p){ return p >= 1000 ? nf(p / 1000, p % 1000 ? 2 : 0) + tx(' МВт', ' MW') : nf(p, p < 10 && p % 1 ? 1 : 0) + tx(' кВт', ' kW'); }

  /* the page's lifetime: nav.js swaps <main> without reloading — a page script (pages, equipment,
     calculator, cabinet, staff…) ties its document/window listeners to { signal: S.page.signal } and
     its timers and loops to S.page.leave(fn); both end when the visitor moves to another page */
  var leaves = [], pageCtl = new AbortController();
  var page = { signal: pageCtl.signal, leave: function(fn){ leaves.push(fn); },
    end: function(){ pageCtl.abort(); leaves.splice(0).forEach(function(f){ try { f(); } catch (e) { console.error(e); } }); pageCtl = new AbortController(); page.signal = pageCtl.signal; } };

  /* project store: the calculator writes it, AI / report / account read it */
  var KEY = 'bess-calc';
  function load(){ try { return JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (e) { return null; } }
  function save(st){ try { localStorage.setItem(KEY, JSON.stringify(st)); } catch (e) {} }

  /* brand placeholder: ?brand=Назва switches it for the whole prototype */
  var q = new URLSearchParams(location.search), brand = q.get('brand');
  try { if (brand) localStorage.setItem('brand', brand); else brand = localStorage.getItem('brand'); } catch (e) {}
  brand = brand || html.getAttribute('data-brand-name') || 'NRGT';
  d.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = brand; });

  /* toast */
  var toastEl = null, toastT = 0;
  function toast(msg){
    if (!toastEl) { toastEl = d.createElement('div'); toastEl.className = 'toast'; toastEl.setAttribute('role', 'status'); d.body.appendChild(toastEl); }
    toastEl.textContent = msg; toastEl.classList.add('is-on'); clearTimeout(toastT); toastT = setTimeout(function(){ toastEl.classList.remove('is-on'); }, 3600);
  }

  /* smooth scroll */
  var lenis = null;
  if (!RM && window.Lenis && G && !html.hasAttribute('data-no-lenis')) {
    lenis = new window.Lenis({ lerp: .1 });
    if (ST) lenis.on('scroll', ST.update);
    G.ticker.add(function(t){ lenis.raf(t * 1000); }); G.ticker.lagSmoothing(0);
  }
  function scrollToEl(t){ var off = -(parseInt(getComputedStyle(html).getPropertyValue('--hdr'), 10) || 74) - 16;
    var y = t.getBoundingClientRect().top + window.scrollY + off;
    if (lenis) { lenis.resize(); lenis.scrollTo(y, { duration: 1.2 }); } else window.scrollTo({ top: y, behavior: RM ? 'auto' : 'smooth' }); }
  /* in-page anchors; hashes like #devices=… (cabinet routes) are not selectors */
  function byHash(h){ try { return d.querySelector(h); } catch (e) { return null; } }
  d.addEventListener('click', function(e){
    var a = e.target.closest('a[href^="#"]'); if (!a) return; var id = a.getAttribute('href');
    if (id.length < 2) { e.preventDefault(); return; }
    var t = byHash(id); if (!t) return; e.preventDefault(); closeMenu(); scrollToEl(t);
  });
  if (location.hash.length > 1) window.addEventListener('load', function(){ var t = byHash(location.hash); if (t) setTimeout(function(){ scrollToEl(t); }, 60); });

  /* header + mobile menu */
  var hdr = d.querySelector('.hdr'), burger = d.querySelector('.burger'), mnav = d.getElementById('mnav');
  function hs(){ if (hdr) hdr.classList.toggle('is-solid', window.scrollY > 8); }
  window.addEventListener('scroll', hs, { passive: true }); hs();
  function setMenu(open){ if (!mnav) return; mnav.classList.toggle('is-open', open); hdr.classList.toggle('is-open', open); burger.setAttribute('aria-expanded', String(open)); burger.setAttribute('aria-label', open ? tx('Закрити меню', 'Close menu') : tx('Відкрити меню', 'Open menu')); d.body.style.overflow = open ? 'hidden' : ''; if (lenis) open ? lenis.stop() : lenis.start(); }
  function closeMenu(){ if (mnav && mnav.classList.contains('is-open')) setMenu(false); }
  if (burger) burger.addEventListener('click', function(){ setMenu(!mnav.classList.contains('is-open')); });
  d.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', function(){ if (window.innerWidth > 1180) closeMenu(); });

  /* the signed-in user (or null) once account.js — the last script of every page — knows it */
  function whenAccount(cb){
    function go(){ (window.Account ? window.Account.ready : Promise.resolve(null)).then(cb); }
    if (window.Account || d.readyState !== 'loading') go(); else d.addEventListener('DOMContentLoaded', go);
  }

  /* asset paths in data are relative to the site root; English pages are one folder down */
  function asset(src){ return EN && /^assets\//.test(src || '') ? '../' + src : src; }

  /* UA / EN: the same page in the other language, with the same query and anchor */
  d.querySelectorAll('[data-lang-switch]').forEach(function(a){
    a.setAttribute('data-base', a.getAttribute('href'));   /* nav.js sets it for each page */
    function keep(){ a.href = a.getAttribute('data-base') + location.search + location.hash; }
    keep(); a.addEventListener('pointerenter', keep); a.addEventListener('focus', keep);
    a.addEventListener('click', function(){ keep(); try { localStorage.setItem('lang', a.getAttribute('hreflang')); } catch (e) {} });
  });

  /* headings split + reveals — on the first page of a visit only: later pages (html.is-warm, set in
     the page's head) open with everything in place, like an app */
  var warm = html.classList.contains('is-warm');
  if (G && !RM && !warm && window.SplitText) {
    d.querySelectorAll('[data-split]').forEach(function(el){
      window.SplitText.create(el, { type: 'lines,words,chars', mask: 'lines', autoSplit: true,
        onSplit: function(self){ return G.from(self.chars, { yPercent: 120, opacity: 0, rotate: 5, duration: 1.05, ease: 'expo.out', stagger: .018, delay: .05 }); } });
    });
    if (d.querySelector('[data-hero]')) G.from('[data-hero]', { y: 20, opacity: 0, duration: .9, ease: 'power3.out', stagger: .08, delay: .35 });
  }
  if (G && !RM && !warm && ST) {
    ST.batch('[data-reveal]', { start: 'top 90%', once: true, onEnter: function(els){ G.to(els, { opacity: 1, y: 0, duration: .9, ease: 'power3.out', stagger: .07, overwrite: true }); els.forEach(function(el){ if (el.classList.contains('card')) el.classList.add('is-in'); }); } });
  } else d.querySelectorAll('.card').forEach(function(c){ c.classList.add('is-in'); });
  if (ST) window.addEventListener('load', function(){ ST.refresh(); });

  /* magnetic CTAs + card spotlight */
  function magnet(el){
    var xTo = G.quickTo(el, 'x', { duration: .5, ease: 'power3.out' }), yTo = G.quickTo(el, 'y', { duration: .5, ease: 'power3.out' });
    el.addEventListener('pointermove', function(e){ var r = el.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * .25); yTo((e.clientY - r.top - r.height / 2) * .35); });
    el.addEventListener('pointerleave', function(){ G.to(el, { x: 0, y: 0, duration: .9, ease: 'elastic.out(1,.4)' }); });
  }
  if (G && !RM && fine) d.querySelectorAll('.magnetic').forEach(magnet);
  /* new page content after a soft navigation (nav.js): the brand, cards shown at once, magnetic buttons */
  function enter(root){
    root.querySelectorAll('[data-brand]').forEach(function(el){ el.textContent = brand; });
    root.querySelectorAll('.card').forEach(function(c){ c.classList.add('is-in'); });
    if (G && !RM && fine) root.querySelectorAll('.magnetic').forEach(magnet);
    hs();
  }
  d.addEventListener('pointermove', function(e){ var c = e.target.closest && e.target.closest('.card'); if (!c) return; var r = c.getBoundingClientRect(); c.style.setProperty('--x', (e.clientX - r.left) + 'px'); c.style.setProperty('--y', (e.clientY - r.top) + 'px'); }, { passive: true });

  window.Site = { lang: LANG, en: EN, locale: LOCALE, asset: asset, whenAccount: whenAccount, page: page, enter: enter, closeMenu: closeMenu, RM: RM, fine: fine, nf: nf, money: money, uah: uah, years: years, plural: plural, capTxt: capTxt, powTxt: powTxt, load: load, save: save, toast: toast, lenis: lenis, q: q, scrollToEl: scrollToEl };
})();
