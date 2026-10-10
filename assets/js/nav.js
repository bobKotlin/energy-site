/* =====================================================================
   Moving between pages without reloading them: the header, the footer and
   the AI button stay, only <main> changes.
   - A click on a link of this site fetches the page (usually already
     fetched while the pointer rested on the link), swaps <main>, the title
     and the active menu item, and runs the page's own script (PAGE below).
     Shared scripts — data, the basket, the account — are loaded once; a
     page needing one it has not loaded yet gets it.
   - The old page's listeners, timers and polls end first (Site.page in
     core.js); the API answers kept for the tab (api.js) make the new page
     show its data at once.
   - Back / forward work; the scroll is restored.
   - Anything unusual — the other language, a new release of the site, an
     error — falls back to an ordinary page load.
   build.py adds this script after account.js on every page.
   ===================================================================== */
(function(){
  'use strict';
  var d = document, html = d.documentElement, S = window.Site;
  if (!S || !S.page || !window.fetch || !window.DOMParser || !history.pushState || !window.URL) return;
  var PAGE = /\/(pages|equipment|calculator|cabinet|staff|agent|assistant)(-en)?\.js(\?|$)/;
  var cache = {}, busy = null, cur = here();
  function here(){ return location.pathname + location.search; }
  function noVer(u){ return String(u).split('?')[0]; }
  function css(doc){ var l = doc.querySelector('link[rel=stylesheet][href*="site.css"]'); return l ? l.getAttribute('href') : ''; }

  /* links this navigation takes: our pages, not files, anchors on the same page, the API or the other language */
  function ours(a, e){
    if (!a || !a.href || (a.target && a.target !== '_self') || a.hasAttribute('download') || a.hasAttribute('data-lang-switch') || a.hasAttribute('data-hard')) return null;
    if (e && (e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey)) return null;
    var u; try { u = new URL(a.href, location.href); } catch (x) { return null; }
    if (u.origin !== location.origin || /\/api\//.test(u.pathname)) return null;
    if (!/(\.html|\/[^.\/]*)$/.test(u.pathname)) return null;
    if (u.pathname === location.pathname && u.search === location.search && u.hash) return null;
    return u;
  }
  function get(u){
    var k = u.pathname + u.search, c = cache[k];
    if (c && Date.now() - c.t < 30000) return c.p;
    var p = fetch(k, { credentials: 'same-origin', headers: { accept: 'text/html' } }).then(function(r){
      if (!r.ok || !/text\/html/.test(r.headers.get('content-type') || '')) throw new Error('not a page');
      return r.text().then(function(t){ return { html: t, url: r.url || k }; });
    });
    cache[k] = { t: Date.now(), p: p };
    p.catch(function(){ delete cache[k]; });
    return p;
  }

  /* fetch on intent: hover, touch, keyboard focus */
  function intent(e){ var u = ours(e.target.closest && e.target.closest('a[href]')); if (u) get(u).catch(function(){}); }
  d.addEventListener('pointerover', intent, { passive: true });
  d.addEventListener('touchstart', intent, { passive: true });
  d.addEventListener('focusin', intent);

  d.addEventListener('click', function(e){
    var u = ours(e.target.closest && e.target.closest('a[href]'), e);
    if (!u) return;
    e.preventDefault();
    go(u, true);
  });
  window.addEventListener('popstate', function(){ if (here() !== cur) go(new URL(location.href), false); });
  if ('scrollRestoration' in history) history.scrollRestoration = 'manual';

  function remember(){ try { history.replaceState(Object.assign({}, history.state, { y: window.scrollY }), ''); } catch (e) {} }
  function go(u, push){
    var my = busy = {};
    if (push) remember();
    html.classList.add('is-nav');
    get(u).then(function(res){ if (busy === my) return swap(res, u, push, my); })
      .catch(function(err){ if (busy !== my) return; console.warn('nav: full load', err); location.href = u.href; })
      .then(function(){ if (busy === my) html.classList.remove('is-nav'); });
  }

  function swap(res, u, push, my){
    var doc = new DOMParser().parseFromString(res.html, 'text/html'), main = doc.getElementById('main'), old = d.getElementById('main');
    if (!main || !old || doc.documentElement.lang !== html.lang || css(doc) !== css(d)) throw new Error('different page shell');
    var ru = new URL(res.url, location.href), url = ru.pathname + (ru.search || u.search) + u.hash;   /* the address after a redirect (/login.html → /login) */
    var styles = [].filter.call(doc.querySelectorAll('link[rel=stylesheet]'), function(l){ return !d.querySelector('link[rel=stylesheet][href="' + l.getAttribute('href') + '"]'); });
    return Promise.all(styles.map(addCss)).then(function(){
      if (busy !== my) return;
      var have = {}; d.querySelectorAll('script[src]').forEach(function(x){ have[noVer(x.src)] = 1; });
      var run = [].map.call(doc.querySelectorAll('body script[src]'), function(x){ return x.getAttribute('src'); })
        .filter(function(src){ return PAGE.test(src) || !have[noVer(new URL(src, location.href).href)]; });
      var y = push ? 0 : (history.state && history.state.y) || 0;
      function apply(){
        S.page.end();
        if (window.ScrollTrigger) window.ScrollTrigger.getAll().forEach(function(t){ t.kill(); });
        if (push) history.pushState({ y: 0 }, '', url);
        cur = here();
        S.q = new URLSearchParams(location.search);
        d.title = doc.title;
        var md = d.querySelector('meta[name=description]'), nd = doc.querySelector('meta[name=description]'); if (md && nd) md.setAttribute('content', nd.getAttribute('content'));
        var alt = d.querySelector('link[rel=alternate]'), nalt = doc.querySelector('link[rel=alternate]'); if (alt && nalt) alt.setAttribute('href', nalt.getAttribute('href'));
        d.body.dataset.page = doc.body.dataset.page;
        var fresh = d.importNode(main, true); old.replaceWith(fresh);
        shell(doc);
        html.classList.add('is-warm');
        S.closeMenu && S.closeMenu();
        if (S.lenis) { S.lenis.resize(); S.lenis.scrollTo(y, { immediate: true, force: true }); }
        window.scrollTo(0, y);
        S.enter(fresh);
      }
      var vt = d.startViewTransition && !S.RM && !d.hidden ? d.startViewTransition(apply) : null, no = function(){};
      if (vt) { vt.ready.catch(no); vt.finished.catch(no); }   /* a skipped animation is fine: the page is swapped anyway */
      var done = vt ? vt.updateCallbackDone : Promise.resolve(apply());
      return done.then(function(){ return scripts(run); }).then(function(){
        if (push && u.hash) { var t = null; try { t = d.querySelector(u.hash); } catch (e) {} if (t) S.scrollToEl(t); }
        if (window.ScrollTrigger) window.ScrollTrigger.refresh();
        d.dispatchEvent(new CustomEvent('page:load'));
      });
    });
  }

  /* the parts around <main>: the active menu item, the other language's link, the footer and the AI button */
  function shell(doc){
    d.querySelectorAll('.hdr [aria-current], #mnav [aria-current]').forEach(function(a){ a.removeAttribute('aria-current'); });
    doc.querySelectorAll('.hdr [aria-current], #mnav [aria-current]').forEach(function(n){
      var sel = (n.closest('#mnav') ? '#mnav' : '.hdr') + ' a[href="' + n.getAttribute('href') + '"]';
      d.querySelectorAll(sel).forEach(function(a){ a.setAttribute('aria-current', 'page'); });
    });
    var ls = doc.querySelectorAll('[data-lang-switch]');
    d.querySelectorAll('[data-lang-switch]').forEach(function(a, i){ if (ls[i]) { a.setAttribute('data-base', ls[i].getAttribute('href')); a.href = ls[i].getAttribute('href'); } });
    [['footer.foot', 'main'], ['[data-asst-fab]', 'footer.foot, main']].forEach(function(x){
      var mine = d.querySelector(x[0]), theirs = doc.querySelector(x[0]);
      if (mine) mine.hidden = !theirs;
      else if (theirs) { var after = d.querySelectorAll(x[1]); after = after[after.length - 1]; if (after) after.after(d.importNode(theirs, true)); }
    });
  }

  function addCss(l){
    return new Promise(function(res){ var n = d.createElement('link'); n.rel = 'stylesheet'; n.href = l.getAttribute('href'); n.onload = n.onerror = res; d.head.appendChild(n); });
  }
  /* the page's scripts in order; a page script runs again each time its page opens */
  function scripts(list){
    d.querySelectorAll('script[src]').forEach(function(x){ if (PAGE.test(x.getAttribute('src'))) x.remove(); });
    return list.reduce(function(p, src){
      return p.then(function(){ return new Promise(function(res){ var s = d.createElement('script'); s.src = src; s.async = false; s.onload = s.onerror = function(){ res(); }; d.body.appendChild(s); }); });
    }, Promise.resolve());
  }
})();
