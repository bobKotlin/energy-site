/* design.html — the design system for developers: one section at a time (#color, #c-menu…),
   live demos (chips, segments, slider, motion). A page script: nav.js runs it on every visit. */
(function(){
  'use strict';
  var d = document, nav = d.getElementById('dsNav'); if (!nav) return;
  var secs = [].slice.call(d.querySelectorAll('.ds__sec')), btns = [].slice.call(nav.querySelectorAll('[data-s]'));
  function show(s, push){
    if (!secs.some(function(x){ return x.getAttribute('data-sec') === s; })) s = 'tokens';
    secs.forEach(function(x){ x.hidden = x.getAttribute('data-sec') !== s; });
    btns.forEach(function(b){ b.setAttribute('aria-current', String(b.getAttribute('data-s') === s)); });
    if (push) history.replaceState(history.state, '', location.pathname + location.search + '#' + s);
  }
  nav.addEventListener('click', function(e){ var b = e.target.closest('[data-s]'); if (!b) return; show(b.getAttribute('data-s'), true); window.scrollTo({ top: 0 }); });
  show(location.hash.slice(1), false);
  var fn = d.documentElement.getAttribute('data-faces');   /* the faces picked in the Studio preview (core.js) */
  if (fn) d.querySelectorAll('[data-faces-name]').forEach(function(el){ el.textContent = fn; });

  /* chips: several on; segments: one on */
  d.querySelectorAll('[data-toggle]').forEach(function(g){
    g.addEventListener('click', function(e){
      var b = e.target.closest('button'); if (!b) return;
      if (g.getAttribute('data-toggle') === 'one') g.querySelectorAll('button').forEach(function(x){ x.setAttribute('aria-pressed', String(x === b)); });
      else b.setAttribute('aria-pressed', String(b.getAttribute('aria-pressed') !== 'true'));
    });
  });
  var r = d.getElementById('dsRange');
  if (r) r.addEventListener('input', function(){ r.style.setProperty('--p', r.value + '%'); });
  var play = d.getElementById('dsPlay'), mo = d.getElementById('dsMotion');
  if (play && mo) play.addEventListener('click', function(){ mo.classList.toggle('is-on'); });
})();
