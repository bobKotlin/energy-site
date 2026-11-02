/* Where the cabinet's backend is. Empty on the static copy of the site
   (GitHub Pages): the cabinet then runs the demo account in the browser.
   The platform build (platform/scripts/build.mjs) writes '/api' here.
   APP_URL — the platform's address, so the static copy can send people to
   the real login; platform/scripts/setup.sh writes it. */
window.APP_API = '';
window.APP_URL = 'https://app.nrgt.workers.dev';
/* the static copy (GitHub Pages) has no server: requests and sign-in would go nowhere,
   so it sends visitors to the same page of the working site */
(function(u){
  if (!u || window.APP_API || !/\.github\.io$/.test(location.hostname)) return;
  location.replace(u.replace(/\/$/, '') + (location.pathname.replace(/^\/[^/]+/, '') || '/') + location.search + location.hash);
})(window.APP_URL);
