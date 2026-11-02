/* =====================================================================
   Firebase Authentication in the browser — loaded only where accounts are
   handled (login, settings, the «confirm your e-mail» card). Sign-up and
   login by e-mail + password, Google, the confirmation letter, a new
   password and a new e-mail are Firebase's (its letters come from Google,
   no domain of ours needed); then the fresh ID token goes to our server once
   (POST /api/auth/firebase) and our own session takes over.
   The SDK is imported from Google's CDN on first use; the project comes from
   /api/config (public by design). Locally the Auth emulator stands in.
   window.FB.* returns Promises; errors carry .code like our API ('login_failed', …).
   ===================================================================== */
window.FB = (function(){
  'use strict';
  var V = '13.0.0', CDN = 'https://www.gstatic.com/firebasejs/' + V + '/', S = window.Site || {}, A = window.Api;
  var ready = null, m = null, auth = null;

  function fail(code, data){ var e = new Error(code); e.code = code; e.data = data || {}; return e; }
  /* Firebase's error codes → ours (api.js words them) */
  var CODES = {
    'auth/invalid-credential': 'login_failed', 'auth/wrong-password': 'login_failed', 'auth/user-not-found': 'login_failed', 'auth/invalid-login-credentials': 'login_failed',
    'auth/email-already-in-use': 'exists', 'auth/weak-password': 'password_short', 'auth/invalid-email': 'email', 'auth/missing-password': 'password_short',
    'auth/too-many-requests': 'too_many', 'auth/network-request-failed': 'network', 'auth/requires-recent-login': 'reauth', 'auth/user-disabled': 'blocked',
    'auth/popup-closed-by-user': 'cancelled', 'auth/cancelled-popup-request': 'cancelled', 'auth/popup-blocked': 'popup_blocked',
    'auth/operation-not-allowed': 'auth_off', 'auth/unauthorized-domain': 'auth_domain', 'auth/unauthorized-continue-uri': 'auth_domain',
    'auth/account-exists-with-different-credential': 'exists_other', 'auth/invalid-action-code': 'link', 'auth/expired-action-code': 'link_expired'
  };
  function ours(e){ if (e && e.code && !/^auth\//.test(e.code)) return e; return fail(CODES[e && e.code] || 'auth_failed', { firebase: e && e.code }); }

  function load(){
    if (ready) return ready;
    ready = (A ? A.config() : Promise.reject(fail('static'))).then(function(cfg){
      if (!cfg || !cfg.firebase) throw fail('auth_off');
      return Promise.all([import(CDN + 'firebase-app.js'), import(CDN + 'firebase-auth.js')]).then(function(mods){
        var app = mods[0].initializeApp(cfg.firebase);
        m = mods[1];
        auth = m.initializeAuth(app, { persistence: [m.indexedDBLocalPersistence, m.browserLocalPersistence], popupRedirectResolver: m.browserPopupRedirectResolver });
        if (cfg.emulator) m.connectAuthEmulator(auth, cfg.emulator, { disableWarnings: true });
        auth.languageCode = S.lang || 'uk';   // Google's letters and pages in the page's language
        return new Promise(function(res){ var off = m.onAuthStateChanged(auth, function(){ off(); res(auth); }); });
      });
    });
    ready.catch(function(){ ready = null; });
    return ready;
  }
  /* back to our site after a link in a Firebase letter */
  function back(path){ var dir = location.pathname.replace(/[^/]*$/, ''); return location.origin + dir + path; }

  /* the Firebase user → our session (a fresh token each time) */
  function session(user, extra){
    return user.getIdToken(true).then(function(t){ return A.firebase(t, extra || {}); });
  }
  function run(p){ return p.catch(function(e){ throw ours(e); }); }

  return {
    load: load,
    current: function(){ return load().then(function(a){ return a.currentUser; }); },
    signIn: function(email, password){ return run(load().then(function(a){ return m.signInWithEmailAndPassword(a, email, password); }).then(function(c){ return session(c.user); })); },
    signUp: function(email, password, name, next){
      return run(load().then(function(a){ return m.createUserWithEmailAndPassword(a, email, password); }).then(function(c){
        var u = c.user;
        return (name ? m.updateProfile(u, { displayName: name }) : Promise.resolve())
          .then(function(){ return m.sendEmailVerification(u, { url: back('login.html?verified=1' + (next ? '&next=' + encodeURIComponent(next) : '')) }).catch(function(){}); })
          .then(function(){ return session(u, { name: name }); });
      }));
    },
    google: function(){
      return run(load().then(function(a){ var p = new m.GoogleAuthProvider(); p.setCustomParameters({ prompt: 'select_account' }); return m.signInWithPopup(a, p); }).then(function(c){ return session(c.user); }));
    },
    resetPassword: function(email){ return run(load().then(function(a){ return m.sendPasswordResetEmail(a, email, { url: back('login.html') }); })); },
    /* the confirmation letter again; needs the Firebase account on this device */
    sendVerification: function(next){
      return run(load().then(function(a){
        if (!a.currentUser) throw fail('fb_signin');
        return m.sendEmailVerification(a.currentUser, { url: back('login.html?verified=1' + (next ? '&next=' + encodeURIComponent(next) : '')) }).then(function(){ return { to: a.currentUser.email }; });
      }));
    },
    /* after the link in the letter (here or on another device): Firebase knows it now, our server learns it */
    refresh: function(){
      return run(load().then(function(a){
        if (!a.currentUser) throw fail('fb_signin');
        return a.currentUser.reload().then(function(){ return session(a.currentUser).then(function(r){ return { verified: a.currentUser.emailVerified, user: r.user }; }); });
      }));
    },
    /* has the address been confirmed by now (the link opened here, in the mail app or on a phone)? Asks Firebase;
       our server hears of it only once it is — no new session on every check */
    check: function(){
      return run(load().then(function(a){
        if (!a.currentUser) throw fail('fb_signin');
        return a.currentUser.reload().then(function(){
          return a.currentUser.emailVerified ? session(a.currentUser).then(function(r){ return { verified: true, user: r.user }; }) : { verified: false };
        });
      }));
    },
    /* a new password / a new e-mail: Firebase asks for the current password first (recent sign-in) */
    changePassword: function(current, next){
      return run(load().then(function(a){
        var u = a.currentUser; if (!u) throw fail('fb_signin');
        return m.reauthenticateWithCredential(u, m.EmailAuthProvider.credential(u.email, current)).then(function(){ return m.updatePassword(u, next); });
      }));
    },
    changeEmail: function(current, email){
      return run(load().then(function(a){
        var u = a.currentUser; if (!u) throw fail('fb_signin');
        var re = current ? m.reauthenticateWithCredential(u, m.EmailAuthProvider.credential(u.email, current)) : Promise.resolve();
        return re.then(function(){ return m.verifyBeforeUpdateEmail(u, email, { url: back('login.html?verified=1') }); }).then(function(){ return { to: email }; });
      }));
    },
    signOut: function(){ return load().then(function(a){ return m.signOut(a); }).catch(function(){}); }
  };
})();
