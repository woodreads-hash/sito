// Supabase cloud backend (publishable anon key is safe for read/public + RLS-protected operations)
// Fallback statici: in produzione i valori arrivano dall'ambiente (Vercel)
// tramite /.netlify/functions/supabase-config e sostituiscono questi.
window.SUPABASE_URL = 'https://yqksdpgkktgppxzdbbgc.supabase.co';
window.SUPABASE_ANON_KEY = 'sb_publishable_2wVMVjaEp492prSm71Uz4Q_LwrBv4CC';
window.SUPABASE_TABLE = 'blog_posts';
window.CALENDAR_TABLE = 'day_configs';
window.FAQ_TABLE = 'faqs';
window.GALLERY_TABLE = 'gallery_photos';
window.GALLERY_BUCKET = 'gallery';
window.QUIZ_TABLE = 'quiz_results';

// ── Configurazione dall'ambiente ───────────────────────────────────────────
// Le variabili NEXT_PUBLIC_* non vengono iniettate da sole in un sito statico:
// vengono lette server-side dalla funzione supabase-config e applicate qui
// prima di qualsiasi chiamata a Supabase.
window.SUPABASE_CONFIG_SOURCE = 'static';
window.supabaseConfigReady = (function () {
  var timeout = new Promise(function (resolve) { setTimeout(resolve, 4000); });
  var request = fetch('/.netlify/functions/supabase-config', { cache: 'no-store' })
    .then(function (r) { return r.ok ? r.json() : null; })
    .then(function (cfg) {
      if (!cfg || !cfg.url || !cfg.anonKey) return null;
      if (cfg.url !== window.SUPABASE_URL || cfg.anonKey !== window.SUPABASE_ANON_KEY) {
        window.SUPABASE_URL = cfg.url;
        window.SUPABASE_ANON_KEY = cfg.anonKey;
        window.SUPABASE_CONFIG_SOURCE = 'env';
      }
      return { url: window.SUPABASE_URL, anonKey: window.SUPABASE_ANON_KEY };
    })
    .catch(function () { return null; });
  return Promise.race([request, timeout]);
})();

window.supabaseHeaders = function (extra) {
  return Object.assign({
    'apikey': window.SUPABASE_ANON_KEY,
    'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY,
    'Content-Type': 'application/json',
  }, extra || {});
};

window.supabaseUrl = function (path) {
  return window.SUPABASE_URL + path;
};

window.supabaseFetch = async function (path, options) {
  if (window.supabaseConfigReady) {
    try { await window.supabaseConfigReady; } catch (e) {}
  }
  const opts = Object.assign({}, options || {});
  opts.headers = window.supabaseHeaders(opts.headers || {});
  const response = await fetch(window.supabaseUrl(path), opts);
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!response.ok) {
    const message = data && data.message ? data.message : response.statusText;
    throw new Error('Supabase ' + response.status + ': ' + message);
  }
  return data;
};

window.WD_WEEKLY_METRICS = {};
window.WD_WEEKLY_READY = false;
window.WD_WEEKLY = (function () {
  var refreshPromise = null;
  var refreshQueued = false;
  var autoTimer = null;
  var channel = null;
  var started = false;
  var version = 0;
  var loadToken = 0;
  var pending = {};
  var pendingAt = {};
  var expected = {};
  function formatValue(metric, mode, denominatorMetric) {
    var value = Math.max(0, Number(window.WD_WEEKLY_METRICS[metric] || 0));
    var average = mode === 'duration-avg' || mode === 'duration-ms-avg';
    if (mode === 'duration' || mode === 'duration-ms' || average) {
      var seconds = mode === 'duration-ms' || mode === 'duration-ms-avg' ? value / 1000 : value;
      if (average) {
        var denominator = Number(window.WD_WEEKLY_METRICS[denominatorMetric] || 0);
        seconds = denominator > 0 ? seconds / denominator : 0;
      }
      if (seconds < 60) return '+' + Math.round(seconds) + 's';
      if (seconds < 3600) return '+' + Math.round(seconds / 60) + 'm';
      return '+' + (seconds / 3600).toFixed(1).replace('.0', '') + 'h';
    }
    return '+' + value.toLocaleString('it-IT');
  }
  function apply(map) {
    var values = map || window.WD_WEEKLY_METRICS || {};
    window.WD_WEEKLY_METRICS = values;
    if (typeof document === 'undefined' || !document.querySelectorAll) return;
    var title = 'Incremento della settimana corrente (' + weekRange() + ', Europe/Rome)';
    document.querySelectorAll('[data-weekly]').forEach(function (el) {
      var metric = el.getAttribute('data-weekly');
      var mode = el.getAttribute('data-weekly-format') || '';
      var denominator = el.getAttribute('data-weekly-denominator') || '';
      var average = mode === 'duration-avg' || mode === 'duration-ms-avg';
      var raw = Number(values[metric] || 0);
      var denom = Number(values[denominator] || 0);
      el.textContent = formatValue(metric, mode, denominator);
      el.classList.toggle('is-zero', raw <= 0 || (average && denom <= 0));
      el.setAttribute('title', title);
    });
  }
  function mergePending(map) {
    var merged = Object.assign({}, map || {});
    Object.keys(pending).forEach(function (metric) {
      var value = Number(merged[metric] || 0);
      var target = Number(expected[metric] || 0);
      if (Date.now() - Number(pendingAt[metric] || 0) > 30000) {
        delete pending[metric];
        delete pendingAt[metric];
        delete expected[metric];
        return;
      }
      if (value < target) {
        merged[metric] = target;
      } else {
        delete pending[metric];
        delete pendingAt[metric];
        delete expected[metric];
      }
    });
    return merged;
  }
  function bumpMany(metrics) {
    if (!metrics || typeof metrics !== 'object') return;
    var map = Object.assign({}, window.WD_WEEKLY_METRICS || {});
    var changed = false;
    Object.keys(metrics).forEach(function (metric) {
      var delta = Number(metrics[metric]);
      if (!metric || !isFinite(delta) || !delta) return;
      map[metric] = Math.max(0, Number(map[metric] || 0) + delta);
      pending[metric] = Number(pending[metric] || 0) + delta;
      pendingAt[metric] = Date.now();
      expected[metric] = map[metric];
      changed = true;
    });
    if (changed) {
      version += 1;
      window.WD_WEEKLY_METRICS = map;
      apply(map);
    }
  }
  function bump(metric, amount) {
    if (!metric) return;
    var metrics = {};
    metrics[metric] = amount;
    bumpMany(metrics);
  }
  function rollback(metric, amount) {
    if (!metric) return;
    var delta = Number(amount);
    if (!isFinite(delta) || !delta) return;
    var map = Object.assign({}, window.WD_WEEKLY_METRICS || {});
    map[metric] = Math.max(0, Number(map[metric] || 0) - delta);
    pending[metric] = Math.max(0, Number(pending[metric] || 0) - delta);
    expected[metric] = map[metric];
    if (!pending[metric]) {
      delete pending[metric];
      delete pendingAt[metric];
      delete expected[metric];
    }
    version += 1;
    window.WD_WEEKLY_METRICS = map;
    apply(map);
  }
  function getChannel() {
    if (!channel) channel = new BroadcastChannel('woodreads-weekly');
    return channel;
  }
  function publish(metrics, reset) {
    var payload = {
      type: 'weekly-update',
      metrics: metrics || {},
      reset: !!reset,
      ts: Date.now()
    };
    try { getChannel().postMessage(payload); } catch (e) {}
    try { localStorage.setItem('wd_weekly_ts', String(Date.now())); } catch (e) {}
  }
  async function load() {
    var token = ++loadToken;
    try {
      var rows = await window.supabaseFetch('/rest/v1/rpc/get_weekly_metrics', {
        method: 'POST',
        cache: 'no-store',
        body: '{}'
      });
      var map = {};
      (rows || []).forEach(function (row) {
        if (row && row.metric) map[row.metric] = Number(row.count || 0);
      });
      if (token === loadToken) window.WD_WEEKLY_READY = true;
      return map;
    } catch (e) {
      if (token === loadToken) window.WD_WEEKLY_READY = false;
      return window.WD_WEEKLY_METRICS;
    }
  }
  function refresh() {
    if (refreshPromise) {
      refreshQueued = true;
      return refreshPromise.then(function () {
        if (!refreshQueued) return window.WD_WEEKLY_METRICS;
        refreshQueued = false;
        return refresh();
      });
    }
    var versionAtStart = version;
    var request = load();
    var token = loadToken;
    refreshPromise = request.then(function (map) {
      refreshPromise = null;
      if (version !== versionAtStart) refreshQueued = true;
      if (refreshQueued) {
        refreshQueued = false;
        return refresh();
      }
      if (token === loadToken) apply(mergePending(map));
      return map;
    }, function (error) {
      refreshPromise = null;
      refreshQueued = false;
      throw error;
    });
    return refreshPromise;
  }
  function reload() {
    var versionAtStart = version;
    var request = load();
    var token = loadToken;
    return request.then(function (map) {
      if (version === versionAtStart && token === loadToken) apply(mergePending(map));
      return map;
    });
  }
  async function reset() {
    try {
      await window.supabaseFetch('/rest/v1/rpc/reset_weekly_metrics', {
        method: 'POST',
        cache: 'no-store',
        body: '{}'
      });
    } catch (error) {
      const rows = await load();
      if (!window.WD_WEEKLY_READY) throw error;
      const entries = Object.keys(rows || {}).filter(function (metric) {
        return Number(rows[metric] || 0) !== 0;
      });
      await Promise.all(entries.map(function (metric) {
        return window.supabaseFetch('/rest/v1/rpc/increment_weekly_metric', {
          method: 'POST',
          keepalive: true,
          cache: 'no-store',
          body: JSON.stringify({ p_metric: metric, p_amount: -Number(rows[metric]) })
        });
      }));
    }
    pending = {};
    pendingAt = {};
    expected = {};
    version += 1;
    window.WD_WEEKLY_METRICS = {};
    apply({});
    publish({}, true);
    return reload();
  }
  function get(metric) {
    return Number(window.WD_WEEKLY_METRICS[metric] || 0);
  }
  function weekStart() {
    var now = new Date();
    var day = (now.getDay() + 6) % 7;
    now.setHours(0, 0, 0, 0);
    now.setDate(now.getDate() - day);
    return now;
  }
  function weekRange() {
    var start = weekStart();
    var end = new Date(start.getTime());
    end.setDate(end.getDate() + 6);
    var format = new Intl.DateTimeFormat('it-IT', { day: '2-digit', month: 'short' });
    return format.format(start) + ' – ' + format.format(end);
  }
  function onVisible() {
    if (!document.hidden) refresh();
  }
  function start() {
    if (started) return;
    started = true;
    try {
      channel = getChannel();
      channel.onmessage = function (event) {
        var data = event && event.data;
        if (!data || data.type !== 'weekly-update') return;
        if (data.reset) {
          pending = {};
          pendingAt = {};
          expected = {};
          version += 1;
          window.WD_WEEKLY_METRICS = {};
          apply({});
        } else {
          bumpMany(data.metrics);
        }
        refresh();
      };
    } catch (e) {}
    window.addEventListener('focus', onVisible);
    document.addEventListener('visibilitychange', onVisible);
    window.addEventListener('storage', function (event) {
      if (event.key === 'wd_weekly_ts') refresh();
    });
    autoTimer = setInterval(function () {
      if (!document.hidden) refresh();
    }, 15000);
    window.__weeklyInterval = autoTimer;
  }
  return {
    load: load,
    refresh: refresh,
    reload: reload,
    reset: reset,
    get: get,
    format: formatValue,
    apply: apply,
    bump: bump,
    bumpMany: bumpMany,
    rollback: rollback,
    publish: publish,
    start: start,
    weekStart: weekStart,
    weekRange: weekRange
  };
})();

window.supabaseIncrementWeeklyMetric = async function (metric, amount, options) {
  if (!metric) return null;
  var delta = amount === undefined || amount === null ? 1 : Number(amount);
  if (!isFinite(delta) || !delta) return null;
  var optimistic = !options || options.optimistic !== false;
  var weekly = window.WD_WEEKLY;
  if (optimistic && weekly && weekly.bump) weekly.bump(metric, delta);
  var body = JSON.stringify({ p_metric: metric, p_amount: delta });
  try {
    var result = await window.supabaseFetch('/rest/v1/rpc/increment_weekly_metric', {
      method: 'POST',
      keepalive: true,
      cache: 'no-store',
      body: body
    });
    if (weekly) {
      var metrics = {};
      metrics[metric] = delta;
      weekly.publish(metrics);
      weekly.refresh();
    }
    return result;
  } catch (error) {
    if (optimistic && weekly && weekly.rollback) weekly.rollback(metric, delta);
    throw error;
  }
};

window.supabaseRecordSocialSnapshots = async function (stats) {
  if (!stats || typeof stats !== 'object') return null;
  var fields = [
    'instagramFollowers', 'instagramPosts', 'instagramFollowing',
    'tiktokFollowers', 'tiktokLikes', 'tiktokViews', 'tiktokVideos',
    'youtubeSubscribers', 'youtubeViews', 'youtubeVideos', 'youtubeWatchHours',
    'facebookFollowers'
  ];
  var metrics = {};
  fields.forEach(function (field) {
    var raw = String(stats[field] == null ? '' : stats[field]).trim().replace(/\s+/g, '');
    if (!raw) return;
    raw = /^-?\d{1,3}(,\d{3})+(\.\d+)?$/.test(raw) ? raw.replace(/,/g, '') : raw.replace(',', '.');
    var match = raw.match(/^(-?\d+(?:\.\d+)?)([kKmM])?$/);
    var value = match ? Number(match[1]) : Number(raw);
    if (match && match[2]) value *= match[2].toLowerCase() === 'k' ? 1000 : 1000000;
    if (isFinite(value) && value >= 0) metrics[field] = value;
  });
  if (!Object.keys(metrics).length) return null;
  return window.supabaseFetch('/rest/v1/rpc/record_social_snapshots', {
    method: 'POST',
    cache: 'no-store',
    body: JSON.stringify({ p_metrics: metrics })
  }).then(function (result) {
    if (window.WD_WEEKLY) window.WD_WEEKLY.refresh();
    return result;
  });
};

window.supabaseGetBlogPosts = async function (opts) {
  opts = opts || {};
  let query = '/rest/v1/' + window.SUPABASE_TABLE + '?select=*&order=created_at.desc';
  if (opts.status) query += '&status=eq.' + encodeURIComponent(opts.status);
  if (opts.slug) query += '&slug=eq.' + encodeURIComponent(opts.slug);
  if (opts.limit) query += '&limit=' + Number(opts.limit);
  const rows = await window.supabaseFetch(query);
  return rows || [];
};

window.supabaseGetBlogPostBySlug = async function (slug) {
  if (!slug) return null;
  const rows = await window.supabaseGetBlogPosts({ slug: slug, status: 'published', limit: 1 });
  return rows && rows[0] ? rows[0] : null;
};

window.__wdBlogVideoUrlSupported = window.__wdBlogVideoUrlSupported === false ? false : null;

window.supabaseSaveBlogPost = async function (post) {
  if (!post || !post.title) throw new Error('titolo richiesto');
  const baseRow = {
    title: String(post.title).trim(),
    slug: String(post.slug || '').trim(),
    text: String(post.text || ''),
    category: String(post.category || ''),
    excerpt: String(post.excerpt || ''),
    cover_url: String(post.coverUrl || ''),
    video_name: '',
    youtube: String(post.youtube || ''),
    reading_time: Number(post.readingTime || 1),
    status: post.status === 'published' ? 'published' : 'draft',
    updated_at: new Date().toISOString()
  };
  if (!baseRow.slug) throw new Error('slug richiesto');
  const path = '/rest/v1/' + window.SUPABASE_TABLE;
  const video = String(post.videoUrl || '');

  async function writeRow(row, id) {
    if (id) {
      const updated = await window.supabaseFetch(path + '?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: window.supabaseHeaders({ 'Prefer': 'return=representation' }),
        body: JSON.stringify(row)
      });
      if (!updated || !updated[0]) throw new Error('Articolo non trovato o non aggiornato');
      return updated[0];
    }
    row.created_at = new Date().toISOString();
    const created = await window.supabaseFetch(path, {
      method: 'POST',
      headers: window.supabaseHeaders({ 'Prefer': 'return=representation' }),
      body: JSON.stringify(row)
    });
    if (!created || !created[0]) throw new Error('Articolo non creato');
    return created[0];
  }

  const attempts = [];
  if (window.__wdBlogVideoUrlSupported !== false) attempts.push('video_url');
  if (window.__wdBlogVideoUrlSupported !== true) attempts.push('video_name');
  let lastError = null;
  for (const field of attempts) {
    const row = Object.assign({}, baseRow);
    row[field] = video;
    try {
      const saved = await writeRow(row, post.id);
      window.__wdBlogVideoUrlSupported = field === 'video_url';
      return saved;
    } catch(e) {
      lastError = e;
      const msg = e && e.message ? e.message : '';
      if (field === 'video_url' && /video_url/i.test(msg) && /(does not exist|schema cache|42703)/i.test(msg)) {
        window.__wdBlogVideoUrlSupported = false;
        continue;
      }
      throw e;
    }
  }
  throw lastError || new Error('Salvataggio non riuscito');
};

window.supabaseDeleteBlogPost = async function (id) {
  if (!id) throw new Error('id richiesto');
  return window.supabaseFetch(
    '/rest/v1/' + window.SUPABASE_TABLE + '?id=eq.' + encodeURIComponent(id),
    {
      method: 'DELETE',
      headers: window.supabaseHeaders({ 'Prefer': 'return=minimal' })
    }
  );
};

window.supabaseTrackBlogView = async function (id) {
  if (!id) return null;
  const result = await window.supabaseFetch('/rest/v1/rpc/blog_track_view', {
    method: 'POST',
    keepalive: true,
    body: JSON.stringify({ p_post_id: id })
  });
  if (window.WD_WEEKLY) {
    const metrics = { blog_views: 1 };
    metrics['blog_view:' + id] = 1;
    window.WD_WEEKLY.bumpMany(metrics);
    window.WD_WEEKLY.publish(metrics);
    window.WD_WEEKLY.refresh();
  }
  return result;
};

window.supabaseTrackBlogTime = function (id, seconds) {
  const value = Math.max(0, Math.min(3600, Math.round(Number(seconds) || 0)));
  if (!id || value < 2) return;
  try {
    fetch(window.supabaseUrl('/rest/v1/rpc/blog_track_time'), {
      method: 'POST',
      keepalive: true,
      cache: 'no-store',
      headers: window.supabaseHeaders(),
      body: JSON.stringify({ p_post_id: id, p_seconds: value })
    }).then(function (response) {
      if (!response || !response.ok || !window.WD_WEEKLY) return;
      const metrics = { blog_time: value };
      metrics['blog_time:' + id] = value;
      window.WD_WEEKLY.bumpMany(metrics);
      window.WD_WEEKLY.publish(metrics);
    }).catch(function () {});
  } catch (e) {}
};

window.supabaseGetDayConfigs = async function () {
  const rows = await window.supabaseFetch(
    '/rest/v1/' + window.CALENDAR_TABLE + '?select=date,closed,note,time_band'
  );
  const notes = {};
  const overrides = {};
  const bands = {};
  (rows || []).forEach(function (row) {
    if (!row || !row.date) return;
    if (row.note) notes[row.date] = row.note;
    if (row.time_band) bands[row.date] = row.time_band;
    if (row.closed) overrides[row.date] = true;
  });
  return { notes: notes, overrides: overrides, bands: bands };
};

window.supabaseSaveDayConfig = async function (date, patch) {
  if (!date) throw new Error('date required');
  const body = Object.assign({ date: date, updated_at: new Date().toISOString() }, patch || {});
  return window.supabaseFetch(
    '/rest/v1/' + window.CALENDAR_TABLE + '?on_conflict=date',
    {
      method: 'POST',
      headers: window.supabaseHeaders({
        'Prefer': 'resolution=merge-duplicates,return=representation',
      }),
      body: JSON.stringify(body),
    }
  );
};

window.supabaseGetFaqs = async function () {
  return window.supabaseFetch(
    '/rest/v1/' + window.FAQ_TABLE +
    '?select=id,question,answer,category,sort_order,published,clicks,read_ms,read_count,shares,created_at,updated_at' +
    '&order=sort_order.asc,created_at.asc'
  );
};

window.supabaseSaveFaq = async function (faq, includeStats) {
  if (!faq || !faq.id) throw new Error('faq.id required');
  const row = {
    id: faq.id,
    question: faq.question,
    answer: faq.answer,
    category: faq.category || '',
    sort_order: Number(faq.sort_order || 0),
    published: faq.published !== false,
    updated_at: new Date().toISOString(),
  };
  if (includeStats) {
    row.clicks = Number(faq.clicks || 0);
    row.read_ms = Number(faq.read_ms || 0);
    row.read_count = Number(faq.read_count || 0);
    row.shares = Number(faq.shares || 0);
  }
  return window.supabaseFetch(
    '/rest/v1/' + window.FAQ_TABLE + '?on_conflict=id',
    {
      method: 'POST',
      headers: window.supabaseHeaders({
        'Prefer': 'resolution=merge-duplicates,return=representation',
      }),
      body: JSON.stringify(row),
    }
  );
};

window.supabaseDeleteFaq = async function (id) {
  if (!id) throw new Error('faq.id required');
  return window.supabaseFetch(
    '/rest/v1/' + window.FAQ_TABLE + '?id=eq.' + encodeURIComponent(id),
    {
      method: 'DELETE',
      headers: window.supabaseHeaders({ 'Prefer': 'return=minimal' }),
    }
  );
};

window.supabaseTrackFaq = async function (id, deltas) {
  if (!id || !deltas || typeof deltas !== 'object') throw new Error('id e deltas richiesti');
  const payload = {
    p_id: id,
    p_clicks: Math.max(0, Math.round(Number(deltas.clicks || 0))),
    p_shares: Math.max(0, Math.round(Number(deltas.shares || 0))),
    p_read_ms: Math.max(0, Math.round(Number(deltas.read_ms || 0))),
    p_read_count: Math.max(0, Math.round(Number(deltas.read_count || 0)))
  };
  const weekly = [];
  if (payload.p_clicks > 0) {
    weekly.push(['faq_clicks', payload.p_clicks]);
    weekly.push(['faq_click:' + id, payload.p_clicks]);
  }
  if (payload.p_shares > 0) {
    weekly.push(['faq_shares', payload.p_shares]);
    weekly.push(['faq_share:' + id, payload.p_shares]);
  }
  if (payload.p_read_ms > 0) {
    weekly.push(['faq_read_ms', payload.p_read_ms]);
    weekly.push(['faq_read:' + id, payload.p_read_ms]);
  }
  if (payload.p_read_count > 0) weekly.push(['faq_reads', payload.p_read_count]);
  function applyWeekly() {
    if (!weekly.length || !window.WD_WEEKLY) return;
    const metrics = {};
    weekly.forEach(function (entry) {
      metrics[entry[0]] = Number(metrics[entry[0]] || 0) + entry[1];
    });
    window.WD_WEEKLY.bumpMany(metrics);
    window.WD_WEEKLY.publish(metrics);
    window.WD_WEEKLY.refresh();
  }
  function persistWeekly() {
    if (!weekly.length || !window.supabaseIncrementWeeklyMetric) return;
    weekly.forEach(function (entry) {
      window.supabaseIncrementWeeklyMetric(entry[0], entry[1], { optimistic: false }).catch(function () {});
    });
  }
  try {
    const result = await window.supabaseFetch('/rest/v1/rpc/faq_track', {
      method: 'POST',
      keepalive: true,
      body: JSON.stringify(payload)
    });
    applyWeekly();
    return result;
  } catch (rpcError) {
    const allowed = ['clicks', 'shares', 'read_ms', 'read_count'];
    const rows = await window.supabaseFetch(
      '/rest/v1/' + window.FAQ_TABLE +
      '?id=eq.' + encodeURIComponent(id) +
      '&select=clicks,shares,read_ms,read_count'
    );
    const row = rows && rows[0];
    if (!row) return null;
    const patch = { updated_at: new Date().toISOString() };
    allowed.forEach(function (key) {
      const inc = Number(deltas[key] || 0);
      if (inc) patch[key] = Number(row[key] || 0) + inc;
    });
    if (Object.keys(patch).length === 1) {
      persistWeekly();
      return row;
    }
    const result = await window.supabaseFetch(
      '/rest/v1/' + window.FAQ_TABLE + '?id=eq.' + encodeURIComponent(id),
      {
        method: 'PATCH',
        headers: window.supabaseHeaders({ 'Prefer': 'return=minimal' }),
        body: JSON.stringify(patch),
      }
    );
    persistWeekly();
    return result;
  }
};

window.supabaseSaveQuizResult = async function (result) {
  const row = {
    result: String(result && result.result ? result.result : 'Risultato').slice(0, 240),
    consult: !!(result && result.consult),
    path: Array.isArray(result && result.path) ? result.path.map(String).slice(0, 30) : [],
    created_at: (result && result.ts) || new Date().toISOString()
  };
  const metrics = ['quiz_results', row.consult ? 'quiz_consult' : 'quiz_booking'];
  function bumpWeekly() {
    if (!window.WD_WEEKLY) return;
    const weekly = {};
    metrics.forEach(function (metric) { weekly[metric] = 1; });
    window.WD_WEEKLY.bumpMany(weekly);
    window.WD_WEEKLY.publish(weekly);
    window.WD_WEEKLY.refresh();
  }
  try {
    const id = await window.supabaseFetch('/rest/v1/rpc/quiz_track_result', {
      method: 'POST',
      keepalive: true,
      body: JSON.stringify({
        p_result: row.result,
        p_consult: row.consult,
        p_path: row.path,
        p_created_at: row.created_at
      })
    });
    bumpWeekly();
    return id ? Object.assign({ id: id }, row) : null;
  } catch (rpcError) {
    const msg = rpcError && rpcError.message ? rpcError.message : '';
    if (!/PGRST202|Could not find the function|schema cache|does not exist|404/i.test(msg)) throw rpcError;
  }
  const created = await window.supabaseFetch('/rest/v1/' + window.QUIZ_TABLE, {
    method: 'POST',
    headers: window.supabaseHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(row)
  });
  await Promise.all(metrics.map(function (metric) {
    return window.supabaseIncrementWeeklyMetric(metric, 1).catch(function () {});
  }));
  return created && created[0] ? created[0] : null;
};

window.supabaseGetQuizResults = async function (limit) {
  const rows = await window.supabaseFetch(
    '/rest/v1/' + window.QUIZ_TABLE +
    '?select=id,result,consult,path,created_at&order=created_at.desc&limit=' + Number(limit || 300)
  );
  return rows || [];
};

window.supabaseGetQuizStats = async function () {
  try {
    const rows = await window.supabaseFetch('/rest/v1/rpc/get_quiz_stats', {
      method: 'POST',
      cache: 'no-store',
      body: '{}'
    });
    const row = rows && rows[0];
    if (!row) return null;
    return {
      total: Number(row.total || 0),
      consult: Number(row.consult || 0),
      booking: Number(row.booking || 0)
    };
  } catch (e) {
    return null;
  }
};

window.supabaseDeleteQuizResults = async function () {
  return window.supabaseFetch(
    '/rest/v1/' + window.QUIZ_TABLE + '?id=not.is.null',
    {
      method: 'DELETE',
      headers: window.supabaseHeaders({ 'Prefer': 'return=minimal' })
    }
  );
};

/* ── Gallery: foto gestite dall'admin (tabella + bucket Storage) ───────────── */

window.supabaseGalleryPublicUrl = function (path) {
  if (!path) return '';
  if (/^https?:\/\//i.test(path)) return path;
  const bucket = encodeURIComponent(window.GALLERY_BUCKET);
  const enc = String(path).split('/').map(encodeURIComponent).join('/');
  return window.supabaseUrl('/storage/v1/object/public/' + bucket + '/' + enc);
};

window.supabaseGetGalleryPhotos = async function (opts) {
  opts = opts || {};
  let query = '/rest/v1/' + window.GALLERY_TABLE +
    '?select=id,url,storage_path,bucket,title,description,category,tags,featured,sort_order,published,created_at,updated_at' +
    '&order=sort_order.asc,created_at.asc';
  if (opts.publishedOnly !== false) query += '&published=eq.true';
  if (opts.limit) query += '&limit=' + Number(opts.limit);
  const rows = await window.supabaseFetch(query);
  return rows || [];
};

window.supabaseSaveGalleryPhoto = async function (photo) {
  if (!photo || !photo.url) throw new Error('url richiesta');
  const row = {
    url: photo.url,
    storage_path: photo.storage_path || null,
    bucket: photo.bucket || window.GALLERY_BUCKET,
    title: photo.title || '',
    description: photo.description || '',
    category: photo.category || 'generale',
    tags: Array.isArray(photo.tags) ? photo.tags : [],
    featured: !!photo.featured,
    sort_order: Number(photo.sort_order || 0),
    published: photo.published !== false,
    updated_at: new Date().toISOString(),
  };
  const path = '/rest/v1/' + window.GALLERY_TABLE;
  if (photo.id) {
    await window.supabaseFetch(path + '?id=eq.' + encodeURIComponent(photo.id), {
      method: 'PATCH',
      headers: window.supabaseHeaders({ 'Prefer': 'return=minimal' }),
      body: JSON.stringify(row),
    });
    return photo.id;
  }
  row.created_at = new Date().toISOString();
  const created = await window.supabaseFetch(path, {
    method: 'POST',
    headers: window.supabaseHeaders({ 'Prefer': 'return=representation' }),
    body: JSON.stringify(row),
  });
  const id = (created && created[0] && created[0].id) || null;
  if (id) await window.supabaseIncrementWeeklyMetric('gallery_uploads', 1).catch(function () {});
  return id;
};

window.supabaseDeleteGalleryPhoto = async function (id) {
  if (!id) throw new Error('id richiesto');
  return window.supabaseFetch(
    '/rest/v1/' + window.GALLERY_TABLE + '?id=eq.' + encodeURIComponent(id),
    {
      method: 'DELETE',
      headers: window.supabaseHeaders({ 'Prefer': 'return=minimal' }),
    }
  );
};

window.supabaseListGalleryFiles = async function (prefixes) {
  if (window.supabaseConfigReady) {
    try { await window.supabaseConfigReady; } catch (e) {}
  }
  const roots = Array.isArray(prefixes) && prefixes.length ? prefixes : ['', 'photos', 'blog'];
  const files = [];
  const seenFolders = {};
  const seenFiles = {};

  async function walk(prefix, depth) {
    if (depth > 2 || seenFolders[prefix]) return;
    seenFolders[prefix] = true;
    let rows = [];
    try {
      rows = await window.supabaseFetch('/storage/v1/object/list/' + encodeURIComponent(window.GALLERY_BUCKET), {
        method: 'POST',
        body: JSON.stringify({ prefix: prefix, limit: 100, offset: 0, sortBy: { column: 'name', order: 'asc' } })
      });
    } catch (e) { return; }
    for (const row of (rows || [])) {
      if (!row || !row.name) continue;
      const path = prefix ? prefix.replace(/\/+$/, '') + '/' + row.name : row.name;
      if (row.id == null) {
        await walk(path, depth + 1);
        continue;
      }
      const meta = row.metadata || {};
      const mime = meta.mimetype || '';
      if (!/^image\//i.test(mime) && !/^video\//i.test(mime)) continue;
      if (seenFiles[path]) continue;
      seenFiles[path] = true;
      files.push({
        path: path,
        name: row.name,
        mime: mime,
        size: Number(meta.size || 0),
        url: window.supabaseGalleryPublicUrl(path)
      });
    }
  }

  for (const prefix of roots) await walk(prefix, 0);
  return files;
};

window.supabaseUploadGalleryFile = async function (file, prefix) {
  if (!file) throw new Error('file richiesto');
  if (window.supabaseConfigReady) {
    try { await window.supabaseConfigReady; } catch (e) {}
  }
  const safe = String(file.name || 'file')
    .toLowerCase()
    .replace(/[^a-z0-9._-]+/g, '-')
    .replace(/-+/g, '-')
    .slice(-60) || 'file';
  const path = (prefix || 'blog') + '/' + Date.now() + '-' + safe;
  const bucket = encodeURIComponent(window.GALLERY_BUCKET);
  const enc = path.split('/').map(encodeURIComponent).join('/');
  const response = await fetch(window.supabaseUrl('/storage/v1/object/' + bucket + '/' + enc), {
    method: 'POST',
    headers: {
      'apikey': window.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY,
      'Content-Type': file.type || 'application/octet-stream',
      'x-upsert': 'false',
    },
    body: file,
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error('Upload ' + response.status + ': ' + text);
  }
  return { path: path, url: window.supabaseGalleryPublicUrl(path) };
};

window.supabaseUploadGalleryImage = function (file, prefix) {
  return window.supabaseUploadGalleryFile(file, prefix || 'photos');
};

window.supabaseDeleteGalleryObject = async function (path) {
  if (!path) return false;
  if (window.supabaseConfigReady) {
    try { await window.supabaseConfigReady; } catch (e) {}
  }
  const bucket = encodeURIComponent(window.GALLERY_BUCKET);
  const enc = String(path).split('/').map(encodeURIComponent).join('/');
  const response = await fetch(window.supabaseUrl('/storage/v1/object/' + bucket + '/' + enc), {
    method: 'DELETE',
    headers: {
      'apikey': window.SUPABASE_ANON_KEY,
      'Authorization': 'Bearer ' + window.SUPABASE_ANON_KEY,
    },
  });
  if (!response.ok && response.status !== 404) {
    const text = await response.text();
    throw new Error('Delete ' + response.status + ': ' + text);
  }
  return true;
};
