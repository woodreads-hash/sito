(function () {
  var FALLBACK_URL = 'https://yqksdpgkktgppxzdbbgc.supabase.co';
  var FALLBACK_KEY = 'sb_publishable_2wVMVjaEp492prSm71Uz4Q_LwrBv4CC';
  var CACHE_KEY = 'wd_site_settings';
  var CHANNEL_NAME = 'woodreads-site-settings';
  var current = readCache();

  function readCache() {
    try {
      var raw = localStorage.getItem(CACHE_KEY);
      var parsed = raw ? JSON.parse(raw) : null;
      return parsed && typeof parsed === 'object' ? parsed : {};
    } catch (e) {
      return {};
    }
  }

  function writeCache(data) {
    try {
      localStorage.setItem(CACHE_KEY, JSON.stringify(data || {}));
    } catch (e) {}
  }

  function apiUrl() {
    return String(window.SUPABASE_URL || FALLBACK_URL).replace(/\/$/, '');
  }

  function apiKey() {
    return String(window.SUPABASE_ANON_KEY || FALLBACK_KEY);
  }

  function normalizeVat(value) {
    var text = String(value == null ? '' : value).trim().toUpperCase();
    if (text.indexOf('IT') === 0) text = text.slice(2);
    return text.replace(/[^0-9]/g, '');
  }

  function ready() {
    if (window.supabaseConfigReady) {
      return Promise.resolve(window.supabaseConfigReady).catch(function () {});
    }
    return Promise.resolve();
  }

  function request(path, options) {
    return ready().then(function () {
      var opts = Object.assign({}, options || {});
      opts.cache = 'no-store';
      opts.headers = Object.assign({
        apikey: apiKey(),
        Authorization: 'Bearer ' + apiKey(),
        'Content-Type': 'application/json',
      }, opts.headers || {});
      return fetch(apiUrl() + path, opts).then(function (response) {
        return response.text().then(function (text) {
          var data = null;
          try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
          return { ok: response.ok, status: response.status, data: data };
        });
      });
    });
  }

  function apply(data) {
    var vat = normalizeVat(data && (data.vatNumber || data.vat_number || data.vat));
    current = Object.assign({}, data || {}, { vatNumber: vat });
    document.querySelectorAll('[data-site-vat]').forEach(function (el) {
      el.hidden = !vat;
    });
    document.querySelectorAll('[data-site-vat-value]').forEach(function (el) {
      el.textContent = vat;
    });
    var script = document.getElementById('wd-jsonld-business');
    if (script) {
      try {
        var obj = JSON.parse(script.textContent);
        if (vat) obj.vatID = vat;
        else delete obj.vatID;
        script.textContent = JSON.stringify(obj);
      } catch (e) {}
    }
  }

  async function fetchSettings() {
    var site = await request('/rest/v1/site_settings?select=vat_number&id=eq.global&limit=1');
    if (site.ok && Array.isArray(site.data)) {
      var siteVat = site.data[0] && site.data[0].vat_number ? site.data[0].vat_number : '';
      return { vatNumber: siteVat, source: 'site_settings' };
    }

    var fallback = await request('/rest/v1/hermes_settings?select=brand_prompt&id=eq.site&limit=1');
    if (fallback.ok && Array.isArray(fallback.data)) {
      var fallbackVat = fallback.data[0] && fallback.data[0].brand_prompt ? fallback.data[0].brand_prompt : '';
      return { vatNumber: fallbackVat, source: 'hermes_settings' };
    }

    return null;
  }

  async function load() {
    try {
      var data = await fetchSettings();
      if (data) {
        writeCache(data);
        apply(data);
      }
    } catch (e) {}
    return current;
  }

  async function save(value) {
    var vat = normalizeVat(value);
    if (vat && vat.length !== 11) throw new Error('La Partita IVA deve contenere 11 cifre.');
    await ready();
    var now = new Date().toISOString();
    var source = 'site_settings';
    var site = await request('/rest/v1/site_settings?on_conflict=id', {
      method: 'POST',
      headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
      body: JSON.stringify({ id: 'global', vat_number: vat, updated_at: now }),
    });

    if (!site.ok) {
      var siteMissing = site.status === 404 || (site.data && site.data.code === 'PGRST205');
      if (!siteMissing) {
        var siteMessage = site.data && site.data.message ? site.data.message : 'Salvataggio non riuscito.';
        throw new Error(siteMessage);
      }
      var fallback = await request('/rest/v1/hermes_settings?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=representation' },
        body: JSON.stringify({
          id: 'site',
          enabled: false,
          brand_prompt: vat,
          first_message: '',
          fallback_message: '',
          model: 'site-settings',
          updated_at: now,
        }),
      });
      if (!fallback.ok) {
        var message = fallback.data && fallback.data.message ? fallback.data.message : 'Salvataggio non riuscito.';
        throw new Error(message);
      }
      source = 'hermes_settings';
    }

    var data = { vatNumber: vat, source: source };
    writeCache(data);
    apply(data);
    try {
      var channel = new BroadcastChannel(CHANNEL_NAME);
      channel.postMessage(data);
      channel.close();
    } catch (e) {}
    return data;
  }

  window.WD_SITE_SETTINGS = {
    load: load,
    save: save,
    apply: apply,
    get: function () { return current; },
    normalizeVat: normalizeVat,
  };

  apply(current);

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', load);
  } else {
    load();
  }

  window.addEventListener('storage', function (ev) {
    if (ev.key !== CACHE_KEY) return;
    current = readCache();
    apply(current);
  });

  window.addEventListener('focus', function () {
    load();
  });

  document.addEventListener('visibilitychange', function () {
    if (!document.hidden) load();
  });

  try {
    var channel = new BroadcastChannel(CHANNEL_NAME);
    channel.onmessage = function (ev) {
      if (!ev || !ev.data) return;
      current = ev.data;
      writeCache(current);
      apply(current);
    };
  } catch (e) {}
})();
