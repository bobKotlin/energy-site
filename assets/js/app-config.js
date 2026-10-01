/* Where the cabinet's backend is. Empty on the static copy of the site
   (GitHub Pages): the cabinet then runs the demo account in the browser.
   The platform build (platform/scripts/build.mjs) writes '/api' here.
   APP_URL — the platform's address, so the static copy can send people to
   the real login; platform/scripts/setup.sh writes it. */
window.APP_API = '';
window.APP_URL = '';
