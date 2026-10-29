/* Called only by the GTM consent-aware template. No consent defaults here. */
(function () {
  var measurement = { 'planos.rayafit.com.br': 'G-W7XWP0QP8Q', 'www.rayafit.com.br': 'G-0609LXW8FD', 'rayafit.com.br': 'G-0609LXW8FD' }[location.hostname];
  if (!measurement || window.__orbeGa4Consent) return;
  var active = false, generation = 0, client = '', session = '';
  var keys = ['ga_measurement_id', 'ga_client_id', 'ga_session_id', 'ga_consent'];
  function decorate() {
    var valid = active && /^\d{1,20}\.\d{1,20}$/.test(client) && /^\d{10}$/.test(session);
    var links = document.querySelectorAll('a[href]');
    for (var i = 0; i < links.length; i++) {
      try {
        var a = links[i], u = new URL(a.href, location.href);
        if (u.origin !== 'https://studio.agenciaorbe.co' || u.pathname !== '/api/wa-redirect' || u.searchParams.get('connection') !== '1fd22072-6932-4122-941f-cb31c55efd66') continue;
        keys.forEach(function (key) { u.searchParams.delete(key); });
        if (valid) {
          u.searchParams.set(keys[0], measurement);
          u.searchParams.set(keys[1], client);
          u.searchParams.set(keys[2], session);
          u.searchParams.set(keys[3], 'granted');
        }
        if (a.href !== u.toString()) a.setAttribute('href', u.toString());
      } catch (_) { /* A malformed link must not interrupt navigation. */ }
    }
  }
  window.__orbeGa4Consent = function (granted) {
    active = granted === true;
    var current = ++generation;
    client = ''; session = ''; decorate();
    if (!active) return;
    var get = window.gtag || function () { window.dataLayer = window.dataLayer || []; window.dataLayer.push(arguments); };
    get('get', measurement, 'client_id', function (value) {
      if (active && generation === current) { client = String(value || ''); decorate(); }
    });
    get('get', measurement, 'session_id', function (value) {
      if (active && generation === current) { session = String(value || ''); decorate(); }
    });
  };
  new MutationObserver(decorate).observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['href'] });
  decorate();
})();
