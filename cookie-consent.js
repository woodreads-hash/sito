(function(){
  if (window.__wdCookieConsent) return;
  window.__wdCookieConsent = true;

  var KEY = 'wd_cookie_consent';
  var VERSION = 1;
  var DELAY = 900;

  function readConsent(){
    try {
      var raw = localStorage.getItem(KEY);
      if (!raw) return null;
      var data = JSON.parse(raw);
      if (data && data.v === VERSION) return data;
    } catch(e){}
    return null;
  }

  function storeConsent(){
    try {
      localStorage.setItem(KEY, JSON.stringify({ v: VERSION, choice: 'accepted', ts: Date.now() }));
    } catch(e){}
  }

  function removeConsent(){
    try { localStorage.removeItem(KEY); } catch(e){}
  }

  function getBanner(){
    return document.getElementById('wd-cookie-notice');
  }

  function buildBanner(){
    var el = document.createElement('div');
    el.id = 'wd-cookie-notice';
    el.setAttribute('role', 'region');
    el.setAttribute('aria-label', 'Informativa cookie e privacy');
    el.innerHTML =
      '<span class="wd-cookie-icon" aria-hidden="true"><svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5"/><path d="M8.5 8.5v.01"/><path d="M16 15.5v.01"/><path d="M12 12v.01"/><path d="M11 17v.01"/><path d="M7 14v.01"/></svg></span>' +
      '<div class="wd-cookie-text"><strong>[ COOKIE :: privacy ]</strong> WooDreads non raccoglie nomi, cognomi, numeri di telefono o dati personali di alcun genere. I dati tecnici minimi sono utilizzati esclusivamente per migliorare il sito e il servizio offerto agli utenti, non vengono mai commercializzati o diffusi a terzi e puoi richiederne la cancellazione in qualsiasi momento. <a href="cookie-policy.html">Cookie Policy</a> · <a href="privacy.html">Privacy Policy</a></div>' +
      '<div class="wd-cookie-actions"><button type="button" class="wd-cookie-accept" id="wd-cookie-accept">Accetta</button></div>';
    document.body.appendChild(el);
    return el;
  }

  function showBanner(){
    var el = getBanner() || buildBanner();
    el.classList.remove('wd-hide', 'wd-glitch');
    el.removeAttribute('aria-hidden');
    el.inert = false;
    document.documentElement.classList.add('wd-cookie-open');
  }

  function hideBanner(animate){
    var el = getBanner();
    if (!el) return;
    var done = function(){
      el.classList.add('wd-hide');
      el.setAttribute('aria-hidden', 'true');
      el.inert = true;
      document.documentElement.classList.remove('wd-cookie-open');
    };
    if (!animate){ done(); return; }
    el.classList.add('wd-glitch');
    setTimeout(function(){
      el.classList.remove('wd-glitch');
      done();
    }, 700);
  }

  function acceptCookies(){
    storeConsent();
    hideBanner(true);
  }

  document.addEventListener('click', function(ev){
    var t = ev.target;
    if (!t || !t.closest) return;
    if (t.closest('#wd-cookie-accept')){ ev.preventDefault(); acceptCookies(); return; }
    if (t.closest('[data-cookie-reopen]')){ ev.preventDefault(); removeConsent(); showBanner(); }
  });

  window.wdShowCookieBanner = function(){
    removeConsent();
    showBanner();
  };

  function init(){
    if (readConsent()) return;
    setTimeout(showBanner, DELAY);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
