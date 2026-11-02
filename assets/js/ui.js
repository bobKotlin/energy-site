/* =====================================================================
   Design-system components (M3) — shared by every page, loaded once.
   Exposed dropdown: every <select> inside .select gets the site's own menu
   instead of the system picker. The native <select> stays in the page and
   holds the value: page scripts read and set it, listen to its `change`,
   fill its options — as before; the button and the menu follow it.
   New selects (a page swapped by nav.js, options built later) are picked
   up by themselves. Reference: design.html.
   ===================================================================== */
(function(){
  'use strict';
  var d = document, P = HTMLSelectElement.prototype, open = null, uid = 0;
  var CHECK = '<svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true"><path d="M4 9.4l3.2 3.1L14 5.6" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round"/></svg>';

  function nameOf(sel){
    var n = sel.getAttribute('aria-label'); if (n) return n;
    var w = sel.closest('label'); if (w) return (w.textContent || '').replace(sel.textContent, '').trim();
    var l = sel.id && d.querySelector('label[for="' + sel.id + '"]'); return l ? l.textContent.trim() : '';
  }

  function enhance(sel){
    sel.setAttribute('data-ui', '');
    var wrap = sel.parentNode, btn = d.createElement('button'), val = d.createElement('span');
    btn.type = 'button'; btn.className = 'select__btn'; btn.setAttribute('aria-haspopup', 'listbox'); btn.setAttribute('aria-expanded', 'false');
    btn.id = 'sb' + (++uid); btn.appendChild(val);
    wrap.classList.add('select--ui'); wrap.insertBefore(btn, wrap.firstChild);
    sel.tabIndex = -1; sel.setAttribute('aria-hidden', 'true');
    var label = nameOf(sel);
    function sync(){
      var o = sel.options[sel.selectedIndex];
      val.textContent = o ? o.textContent : '';
      btn.disabled = sel.disabled; btn.hidden = sel.hidden;
      btn.setAttribute('aria-label', (label ? label + ': ' : '') + val.textContent);
      var cs = getComputedStyle(sel); btn.style.font = cs.font; btn.style.fontSize = cs.fontSize;
    }
    /* a script that sets .value / .selectedIndex moves the button too */
    ['value', 'selectedIndex'].forEach(function(k){ var p = Object.getOwnPropertyDescriptor(P, k);
      Object.defineProperty(sel, k, { configurable: true, get: function(){ return p.get.call(this); }, set: function(v){ p.set.call(this, v); sync(); } }); });
    new MutationObserver(sync).observe(sel, { childList: true, subtree: true, attributes: true, characterData: true });
    sel.addEventListener('change', sync);
    sel.addEventListener('focus', function(){ btn.focus(); });   /* <label for> and scripts focus the select */
    btn.addEventListener('click', function(){ if (open && open.btn === btn) close(true); else show(sel, btn, wrap); });
    btn.addEventListener('keydown', function(e){
      if (e.key === 'ArrowDown' || e.key === 'ArrowUp') { e.preventDefault(); show(sel, btn, wrap); }
    });
    sel._ui = sync; sync();
  }

  function show(sel, btn, wrap){
    close(false);
    var m = d.createElement('div'); m.className = 'menu'; m.setAttribute('role', 'listbox'); m.setAttribute('aria-labelledby', btn.id); m.setAttribute('data-lenis-prevent', '');   /* the wheel scrolls the menu, not the page */
    var items = [];
    function add(o){
      var i = d.createElement('div'); i.className = 'menu__i'; i.setAttribute('role', 'option'); i.tabIndex = -1;
      i.setAttribute('aria-selected', String(o.selected)); if (o.disabled) i.setAttribute('aria-disabled', 'true');
      i.innerHTML = CHECK; var t = d.createElement('span'); t.textContent = o.textContent; i.appendChild(t);
      i._o = o; items.push(i); m.appendChild(i);
    }
    [].forEach.call(sel.children, function(c){
      if (c.tagName === 'OPTGROUP') { var g = d.createElement('div'); g.className = 'menu__g'; g.setAttribute('role', 'presentation'); g.textContent = c.label; m.appendChild(g); [].forEach.call(c.children, add); }
      else if (c.tagName === 'OPTION' && !c.hidden) add(c);
    });
    d.body.appendChild(m);
    open = { m: m, btn: btn, wrap: wrap, sel: sel, items: items };
    btn.setAttribute('aria-expanded', 'true'); wrap.classList.add('is-open');
    place();
    var cur = items.filter(function(i){ return i._o.selected; })[0] || items[0]; if (cur) { cur.focus({ preventScroll: true }); cur.scrollIntoView({ block: 'nearest' }); }
    m.addEventListener('click', function(e){ var i = e.target.closest('.menu__i'); if (i) pick(i); });
    m.addEventListener('keydown', key);
  }
  function place(){
    if (!open) return;
    if (!open.btn.isConnected) { close(false); return; }
    var r = open.btn.getBoundingClientRect(), m = open.m, h = m.offsetHeight, below = innerHeight - r.bottom - 8, up = below < h && r.top > below;
    m.classList.toggle('is-up', up);
    m.style.minWidth = r.width + 'px';
    m.style.top = (up ? Math.max(8, r.top - h - 6) : r.bottom + 6) + 'px';
    m.style.left = Math.max(8, Math.min(r.left, innerWidth - m.offsetWidth - 8)) + 'px';
  }
  function pick(i){
    if (i.getAttribute('aria-disabled') === 'true') return;
    var sel = open.sel, n = [].indexOf.call(sel.options, i._o);
    close(true);
    if (n !== sel.selectedIndex) {
      sel.selectedIndex = n;
      sel.dispatchEvent(new Event('input', { bubbles: true }));
      sel.dispatchEvent(new Event('change', { bubbles: true }));
    }
  }
  function key(e){
    var it = open.items.filter(function(i){ return i.getAttribute('aria-disabled') !== 'true'; }), k = it.indexOf(d.activeElement);
    function go(n){ var t = it[(n + it.length) % it.length]; if (t) { t.focus(); t.scrollIntoView({ block: 'nearest' }); } }
    if (e.key === 'ArrowDown') { e.preventDefault(); go(k + 1); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); go(k - 1); }
    else if (e.key === 'Home') { e.preventDefault(); go(0); }
    else if (e.key === 'End') { e.preventDefault(); go(it.length - 1); }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); if (k >= 0) pick(it[k]); }
    else if (e.key === 'Escape') { e.preventDefault(); close(true); }
    else if (e.key === 'Tab') close(true);
    else if (e.key.length === 1) {   /* type-ahead: the next item starting with the letter */
      var ch = e.key.toLowerCase(), from = k + 1;
      for (var j = 0; j < it.length; j++) { var t = it[(from + j) % it.length]; if (t.textContent.trim().toLowerCase().indexOf(ch) === 0) { go((from + j) % it.length); break; } }
    }
  }
  function close(focus){
    if (!open) return;
    var o = open; open = null;
    o.m.remove(); o.btn.setAttribute('aria-expanded', 'false'); o.wrap.classList.remove('is-open');
    if (focus && o.btn.isConnected) o.btn.focus({ preventScroll: true });
  }
  d.addEventListener('pointerdown', function(e){ if (open && !open.m.contains(e.target) && !open.btn.contains(e.target)) close(false); }, true);
  window.addEventListener('scroll', place, { passive: true, capture: true });
  window.addEventListener('resize', place);

  /* every .select > select, now and whenever the page adds one */
  function scan(){ d.querySelectorAll('.select > select:not([data-ui])').forEach(enhance); }
  var queued = false;
  new MutationObserver(function(){ if (queued) return; queued = true; requestAnimationFrame(function(){ queued = false; scan(); if (open && !open.btn.isConnected) close(false); }); })
    .observe(d.body, { childList: true, subtree: true });
  scan();

  window.UI = { refresh: function(sel){ if (sel && sel._ui) sel._ui(); else scan(); } };
})();
