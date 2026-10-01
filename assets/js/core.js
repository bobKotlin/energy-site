/* =====================================================================
   Site shell — shared by every page: helpers, brand, header and mobile
   menu, smooth scroll, reveals, magnetic buttons, project store.
   ===================================================================== */
(function(){
  'use strict';
  var d = document, html = d.documentElement;
  html.classList.remove('no-js');
  var RM = window.matchMedia('(prefers-reduced-motion: reduce)').matches, G = window.gsap, ST = window.ScrollTrigger;
  var fine = window.matchMedia('(pointer:fine)').matches;
  if (RM || !G) html.classList.add('rm');
  if (G && ST) G.registerPlugin(ST); if (G && window.SplitText) G.registerPlugin(window.SplitText);

  var nf = function(n, dg){ return n.toLocaleString('uk-UA', { minimumFractionDigits: dg || 0, maximumFractionDigits: dg || 0 }); };
  function money(n, sign){ var a = Math.abs(n), s = n < -.5 ? '−' : (sign && n > .5 ? '+' : '');
    if (a >= 1e6) return s + nf(a / 1e6, 2) + ' млн ₴'; if (a >= 1e5) return s + nf(Math.round(a / 1e3)) + ' тис. ₴'; return s + nf(Math.round(a)) + ' ₴'; }
  function years(y){ if (!isFinite(y) || y <= 0) return 'не окупиться'; if (y > 30) return 'понад 30 років'; var r = Math.round(y * 10) / 10; if (r % 1) return nf(r, 1) + ' року';
    var m10 = r % 10, m100 = r % 100; return nf(r) + (m10 === 1 && m100 !== 11 ? ' рік' : m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14) ? ' роки' : ' років'); }
  function capTxt(c){ return c >= 1000 ? nf(c / 1000, c % 1000 ? 2 : 0) + ' МВт·год' : nf(c, c % 1 ? 2 : 0) + ' кВт·год'; }
  function powTxt(p){ return p >= 1000 ? nf(p / 1000, p % 1000 ? 2 : 0) + ' МВт' : nf(p, p < 10 && p % 1 ? 1 : 0) + ' кВт'; }

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
  function setMenu(open){ if (!mnav) return; mnav.classList.toggle('is-open', open); hdr.classList.toggle('is-open', open); burger.setAttribute('aria-expanded', String(open)); burger.setAttribute('aria-label', open ? 'Закрити меню' : 'Відкрити меню'); d.body.style.overflow = open ? 'hidden' : ''; if (lenis) open ? lenis.stop() : lenis.start(); }
  function closeMenu(){ if (mnav && mnav.classList.contains('is-open')) setMenu(false); }
  if (burger) burger.addEventListener('click', function(){ setMenu(!mnav.classList.contains('is-open')); });
  d.addEventListener('keydown', function(e){ if (e.key === 'Escape') closeMenu(); });
  window.addEventListener('resize', function(){ if (window.innerWidth > 1180) closeMenu(); });

  d.querySelectorAll('.lang').forEach(function(b){ b.addEventListener('click', function(){ toast('EN-версія — у робочому релізі: переклад через AI з перевіркою людиною, правки в адмінці.'); }); });

  /* headings split + reveals */
  if (G && !RM && window.SplitText) {
    d.querySelectorAll('[data-split]').forEach(function(el){
      window.SplitText.create(el, { type: 'lines,words,chars', mask: 'lines', autoSplit: true,
        onSplit: function(self){ return G.from(self.chars, { yPercent: 120, opacity: 0, rotate: 5, duration: 1.05, ease: 'expo.out', stagger: .018, delay: .05 }); } });
    });
    if (d.querySelector('[data-hero]')) G.from('[data-hero]', { y: 20, opacity: 0, duration: .9, ease: 'power3.out', stagger: .08, delay: .35 });
  }
  if (G && !RM && ST) {
    ST.batch('[data-reveal]', { start: 'top 90%', once: true, onEnter: function(els){ G.to(els, { opacity: 1, y: 0, duration: .9, ease: 'power3.out', stagger: .07, overwrite: true }); els.forEach(function(el){ if (el.classList.contains('card')) el.classList.add('is-in'); }); } });
    window.addEventListener('load', function(){ ST.refresh(); });
  } else d.querySelectorAll('.card').forEach(function(c){ c.classList.add('is-in'); });

  /* magnetic CTAs + card spotlight */
  if (G && !RM && fine) d.querySelectorAll('.magnetic').forEach(function(el){
    var xTo = G.quickTo(el, 'x', { duration: .5, ease: 'power3.out' }), yTo = G.quickTo(el, 'y', { duration: .5, ease: 'power3.out' });
    el.addEventListener('pointermove', function(e){ var r = el.getBoundingClientRect(); xTo((e.clientX - r.left - r.width / 2) * .25); yTo((e.clientY - r.top - r.height / 2) * .35); });
    el.addEventListener('pointerleave', function(){ G.to(el, { x: 0, y: 0, duration: .9, ease: 'elastic.out(1,.4)' }); });
  });
  d.addEventListener('pointermove', function(e){ var c = e.target.closest && e.target.closest('.card'); if (!c) return; var r = c.getBoundingClientRect(); c.style.setProperty('--x', (e.clientX - r.left) + 'px'); c.style.setProperty('--y', (e.clientY - r.top) + 'px'); }, { passive: true });

  window.Site = { RM: RM, fine: fine, nf: nf, money: money, years: years, capTxt: capTxt, powTxt: powTxt, load: load, save: save, toast: toast, lenis: lenis, q: q, scrollToEl: scrollToEl };
})();
