// WooDreads API Gateway — replaces Netlify functions on VPS
// Run with: node server.js (port 3001)

const express = require('express');
const fetch = require('node-fetch');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());

const STRAPI = process.env.STRAPI_URL || 'http://127.0.0.1:1337';
const PORT = process.env.GATEWAY_PORT || 3001;
const DATA_FILE = path.join(__dirname, 'data', 'day-data.json');

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 50 * 1024 * 1024 },
});

// ── helpers ──
async function strapi(path) {
  const r = await fetch(`${STRAPI}/api/${path}`, {
    headers: { 'Content-Type': 'application/json' },
  });
  if (!r.ok) throw new Error(`Strapi ${r.status}`);
  return r.json();
}

function readDayData() {
  try {
    return JSON.parse(fs.readFileSync(DATA_FILE, 'utf-8'));
  } catch (e) {
    return { notes: {}, overrides: {} };
  }
}

function writeDayData(data) {
  const dir = path.dirname(DATA_FILE);
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(DATA_FILE, JSON.stringify(data, null, 2));
}

// ── Showroom: categories ──
app.get('/.netlify/functions/showroom/categories', async (req, res) => {
  try {
    const d = await strapi('photo-categories?sort=order');
    res.json(d);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── Showroom: photos (paginated) ──
app.get('/.netlify/functions/showroom/photos', async (req, res) => {
  try {
    const p = req.query.p || 1;
    const n = req.query.n || 20;
    const cat = req.query.cat ? `&filters[category][slug][$eq]=${req.query.cat}` : '';
    const d = await strapi(`photos?populate=*&sort=featured:desc,order&pagination[page]=${p}&pagination[pageSize]=${n}${cat}`);
    res.json(d);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── Appointments: available slots ──
app.get('/.netlify/functions/appointments/slots', async (req, res) => {
  try {
    const date = req.query.date;
    if (!date) return res.status(400).json({ error: 'date required' });

    const dayName = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(date).getDay()];
    const wh = await strapi('working-hour?populate=*');
    const whData = (wh.data || {}).attributes || {};
    const schedules = whData.schedules || [];
    const duration = whData.appointmentDuration || 120;
    const daySchedule = schedules.find(s => s.day === dayName);

    // Check for admin override
    const dayData = readDayData();
    const override = dayData.overrides && dayData.overrides[date];

    // If day is normally closed but overridden, return empty slots (admin will set availability)
    if ((!daySchedule || !daySchedule.enabled) && !override)
      return res.json({ date, dayName, slots: [] });

    // If overridden but no schedule, use default working hours 10:00-18:00
    const startTime = daySchedule?.startTime || '10:00';
    const endTime = daySchedule?.endTime || '18:00';

    // Fetch booked appointments for this date
    const apptRes = await fetch(
      `${STRAPI}/api/appointments?filters[date][$eq]=${date}&filters[status][$ne]=rejected&pagination[pageSize]=100`
    );
    const appts = await apptRes.json();
    const booked = new Set((appts.data || []).map(a => a.attributes?.time));

    // Build slots
    const [sh, sm] = startTime.split(':').map(Number);
    const [eh, em] = endTime.split(':').map(Number);
    const [bs, be] = [
      (daySchedule?.breakStart || '').split(':').map(Number),
      (daySchedule?.breakEnd || '').split(':').map(Number),
    ];
    const breakStart = bs.length === 2 ? bs[0]*60 + bs[1] : null;
    const breakEnd   = be.length === 2 ? be[0]*60 + be[1] : null;

    const slots = [];
    for (let cur = sh*60+sm; cur + duration <= eh*60+em; cur += duration) {
      if (breakStart !== null && cur >= breakStart && cur < breakEnd) continue;
      const h = Math.floor(cur/60), m = cur%60;
      const time = `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}`;
      if (!booked.has(time)) slots.push(time);
    }

    res.json({ date, dayName, slots });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── Appointments: create ──
app.post('/.netlify/functions/appointments', async (req, res) => {
  try {
    const r = await fetch(`${STRAPI}/api/appointments`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ data: req.body }),
    });
    const d = await r.json();
    res.status(r.status).json(d);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── Social stats ──
app.get('/.netlify/functions/social-stats', async (req, res) => {
  try {
    const d = await strapi('social-stat');
    res.json(d);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── Legacy data endpoint (tickers) ──
app.get('/.netlify/functions/data', async (req, res) => {
  try {
    const d = await strapi('site-config?populate=*');
    res.json(d);
  } catch (e) {
    res.json({});
  }
});

// ── Day Notes ──
app.get('/.netlify/functions/day-notes', (req, res) => {
  const data = readDayData();
  res.json(data.notes);
});

app.post('/.netlify/functions/day-notes', (req, res) => {
  const { date, note } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });
  const data = readDayData();
  if (note && note.trim()) {
    data.notes[date] = note.trim();
  } else {
    delete data.notes[date];
  }
  writeDayData(data);
  res.json({ ok: true, note: data.notes[date] || null });
});

app.delete('/.netlify/functions/day-notes/:date', (req, res) => {
  const { date } = req.params;
  const data = readDayData();
  delete data.notes[date];
  writeDayData(data);
  res.json({ ok: true });
});

// ── Day Overrides ──
app.get('/.netlify/functions/day-overrides', (req, res) => {
  const data = readDayData();
  res.json(data.overrides || {});
});

app.post('/.netlify/functions/day-overrides', (req, res) => {
  const { date } = req.body;
  if (!date) return res.status(400).json({ error: 'date required' });
  const data = readDayData();
  if (data.overrides[date]) {
    delete data.overrides[date];
  } else {
    data.overrides[date] = true;
  }
  writeDayData(data);
  res.json({ ok: true, overrides: data.overrides, active: !!data.overrides[date] });
});

// ── Photo Upload ──
app.post('/.netlify/functions/upload', upload.single('files'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'no file' });

    const FormData = require('form-data');
    const form = new FormData();
    form.append('files', req.file.buffer, {
      filename: req.file.originalname,
      contentType: req.file.mimetype,
    });

    const uploadRes = await fetch(`${STRAPI}/api/upload`, {
      method: 'POST',
      body: form,
      headers: form.getHeaders(),
    });

    if (!uploadRes.ok) {
      const errText = await uploadRes.text();
      return res.status(uploadRes.status).json({ error: errText });
    }

    const uploaded = await uploadRes.json();
    const fileInfo = uploaded[0] || uploaded;
    const title = req.body.title || req.file.originalname.replace(/\.[^/.]+$/, '');
    const description = req.body.description || '';
    const category = req.body.category || null;
    const featured = req.body.featured === 'true';

    const photoRes = await fetch(`${STRAPI}/api/photos?populate=*`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: { title, description, category, featured, image: fileInfo.id, order: 0 },
      }),
    });

    let photoData = null;
    if (photoRes.ok) {
      photoData = await photoRes.json();
    }

    res.json({ ok: true, file: fileInfo, photo: photoData });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// ── Blog: categories ──
app.get('/.netlify/functions/blog/categories', async (req, res) => {
  try {
    const d = await strapi('blog-categories?sort=name');
    res.json(d);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── Blog: single post by slug ──
app.get('/.netlify/functions/blog/post', async (req, res) => {
  try {
    const slug = String(req.query.slug || '').replace(/[^a-zA-Z0-9\-_]/g, '').slice(0, 120);
    if (!slug) return res.status(400).json({ error: 'slug required' });
    const d = await strapi(`blog-posts?filters[slug][$eq]=${encodeURIComponent(slug)}&populate=*`);
    res.json(d);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── Blog: posts list ──
app.get('/.netlify/functions/blog', async (req, res) => {
  try {
    const p = req.query.p || 1;
    const n = Math.min(50, req.query.n || 10);
    const cat = req.query.cat ? `&filters[category][slug][$eq]=${encodeURIComponent(req.query.cat)}` : '';
    const search = req.query.search ? `&filters[title][$containsi]=${encodeURIComponent(req.query.search)}` : '';
    const d = await strapi(`blog-posts?populate=*&sort=publishedAt:desc&pagination[page]=${p}&pagination[pageSize]=${n}${cat}${search}`);
    res.json(d);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── Day Config (availability): helper to upsert a day ──
async function dcFind(date) {
  const r = await fetch(`${STRAPI}/api/day-configs?filters[date][$eq]=${encodeURIComponent(date)}`);
  const d = await r.json();
  const item = (d.data || [])[0];
  return item ? { id: item.id, ...(item.attributes || item) } : null;
}
async function dcUpsert(date, fields) {
  const cfg = await dcFind(date);
  const payload = { data: { date, closed: !!(fields.closed), note: fields.note === undefined ? (cfg && cfg.note) : (fields.note || null) } };
  const url = cfg ? `${STRAPI}/api/day-configs/${cfg.id}` : `${STRAPI}/api/day-configs`;
  const method = cfg ? 'PUT' : 'POST';
  const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
  return r.json();
}
async function dcAll() {
  const r = await fetch(`${STRAPI}/api/day-configs?pagination[pageSize]=1000`);
  const d = await r.json();
  return (d.data || []).map(i => ({ id: i.id, ...(i.attributes || i) }));
}

// ── Day Notes ──
app.get('/.netlify/functions/day-notes', async (req, res) => {
  try {
    const configs = await dcAll();
    const notes = {};
    configs.forEach(c => { if (c.note) notes[c.date] = c.note; });
    res.json(notes);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/.netlify/functions/day-notes', async (req, res) => {
  try {
    const { date, note } = req.body || {};
    if (!date) return res.status(400).json({ error: 'date required' });
    const cfg = await dcUpsert(date, { note: note ? String(note) : null, closed: (await dcFind(date))?.closed || false });
    const item = cfg.data || cfg;
    res.json({ ok: true, note: item?.attributes?.note || item?.note || null });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.delete('/.netlify/functions/day-notes/:date', async (req, res) => {
  try {
    const date = decodeURIComponent(req.params.date);
    const cfg = await dcFind(date);
    if (cfg) await dcUpsert(date, { note: null, closed: cfg.closed });
    res.json({ ok: true });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── Day Overrides ──
app.get('/.netlify/functions/day-overrides', async (req, res) => {
  try {
    const configs = await dcAll();
    const overrides = {};
    configs.forEach(c => { if (c.closed) overrides[c.date] = true; });
    res.json(overrides);
  } catch (e) { res.status(502).json({ error: e.message }); }
});

app.post('/.netlify/functions/day-overrides', async (req, res) => {
  try {
    const { date } = req.body || {};
    if (!date) return res.status(400).json({ error: 'date required' });
    const cfg = await dcFind(date);
    const newClosed = cfg ? !cfg.closed : true;
    await dcUpsert(date, { closed: newClosed });
    const configs = await dcAll();
    const overrides = {};
    configs.forEach(c => { if (c.closed) overrides[c.date] = true; });
    res.json({ ok: true, overrides });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── Day Bands ──
app.get('/.netlify/functions/day-bands', async (req, res) => {
  try {
    const r = await fetch(`${STRAPI}/api/day-configs?pagination[pageSize]=1000`);
    const d = await r.json();
    const bands = {};
    (d.data || []).forEach(i => { const a = i.attributes || i; if (a.timeBand) bands[a.date] = a.timeBand; });
    res.json(bands);
  } catch (e) { res.status(502).json({ error: e.message }); }
});
app.post('/.netlify/functions/day-bands', async (req, res) => {
  try {
    const { date, band } = req.body || {};
    if (!date) return res.status(400).json({ error: 'date required' });
    const find = await fetch(`${STRAPI}/api/day-configs?filters[date][$eq]=${encodeURIComponent(date)}`);
    const fd = await find.json();
    const existing = (fd.data || [])[0];
    const closed = !band;
    const payload = { data: { date, closed, timeBand: band || null } };
    const url = existing ? `${STRAPI}/api/day-configs/${existing.id}` : `${STRAPI}/api/day-configs`;
    const method = existing ? 'PUT' : 'POST';
    const r = await fetch(url, { method, headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
    const d = await r.json();
    const item = d.data || d;
    res.json({ ok: true, band: item?.attributes?.timeBand || item?.timeBand || null });
  } catch (e) { res.status(502).json({ error: e.message }); }
});

// ── Health check ──
app.get('/health', (req, res) => res.json({ ok: true }));

app.listen(PORT, () => {
  console.log(`[woodreads-gateway] gateway listening on :${PORT}`);
});
