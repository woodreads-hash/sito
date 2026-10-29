const crypto = require('crypto');
const embed = require('../hermes-embed');

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yqksdpgkktgppxzdbbgc.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'sb_publishable_2wVMVjaEp492prSm71Uz4Q_LwrBv4CC';
const PUBLIC_SITE_URL = (process.env.PUBLIC_SITE_URL || 'https://www.woodreads.com').replace(/\/+$/, '');
const META_API_VERSION = process.env.META_API_VERSION || 'v21.0';
const META_GRAPH_BASE = process.env.META_GRAPH_BASE || 'https://graph.facebook.com';

const DEFAULT_SETTINGS = {
  id: 'global',
  enabled: true,
  brand_prompt: 'Sei Hermes, l’assistente AI di WooDreads, studio di dreadmaker a Roma. Parla in italiano con un tono solare, empatico e professionale. Non inventare prezzi. Chiedi foto o un breve video prima di un preventivo. Se non conosci la risposta, dillo con onestà e chiedi aiuto al team.',
  first_message: 'Ciao! ☀️ Benvenut* in WooDreads. Qual è il servizio di cui hai bisogno e come posso esserti utile oggi?',
  fallback_message: 'Ho preso nota della tua richiesta ✨ Ti rispondo a breve con tutte le informazioni. Se preferisci, scrivici direttamente su WhatsApp al 348 539 3826.',
  model: 'openrouter/free'
};

function headers(extra) {
  return Object.assign({
    apikey: SUPABASE_KEY,
    Authorization: 'Bearer ' + SUPABASE_KEY,
    'Content-Type': 'application/json'
  }, extra || {});
}

async function sb(path, options) {
  const response = await fetch(SUPABASE_URL + path, Object.assign({ headers: headers() }, options || {}));
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = text; }
  if (!response.ok) {
    const message = data && data.message ? data.message : response.statusText;
    const error = new Error('Supabase ' + response.status + ': ' + message);
    error.status = response.status;
    error.data = data;
    throw error;
  }
  return data;
}

function rpc(name, body) {
  return sb('/rest/v1/rpc/' + name, { method: 'POST', body: JSON.stringify(body || {}) });
}

function safe(value, fallback) {
  return value === undefined || value === null || value === '' ? fallback : value;
}

function preview(text) {
  return String(text == null ? '' : text).replace(/\s+/g, ' ').trim().slice(0, 180);
}

function normalizeContact(channel, value) {
  const raw = String(value == null ? '' : value).trim();
  if (channel === 'whatsapp') return raw.replace(/[^\d]/g, '');
  return raw;
}

function aiKey() {
  return process.env.HERMES_AI_API_KEY || process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || '';
}

function aiBase() {
  if (process.env.HERMES_AI_BASE_URL) return process.env.HERMES_AI_BASE_URL.replace(/\/+$/, '');
  if (process.env.OPENROUTER_API_KEY || String(aiKey()).indexOf('sk-or-') === 0) return 'https://openrouter.ai/api/v1';
  return 'https://api.openai.com/v1';
}

function aiModel(settings) {
  return process.env.HERMES_AI_MODEL || (settings && settings.model) || 'openrouter/free';
}

function aiEndpoint() {
  const base = aiBase();
  return /\/chat\/completions$/i.test(base) ? base : base + '/chat/completions';
}

async function readSettings() {
  try {
    const rows = await sb('/rest/v1/hermes_settings?select=*&id=eq.global&limit=1');
    return rows && rows[0] ? rows[0] : Object.assign({}, DEFAULT_SETTINGS);
  } catch (error) {
    return Object.assign({}, DEFAULT_SETTINGS, { _schemaMissing: true });
  }
}

async function readChannels() {
  try {
    const rows = await sb('/rest/v1/hermes_channels?select=*&order=channel.asc');
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    return [];
  }
}

async function readChannel(channel) {
  const rows = await readChannels();
  return rows.find(function (row) { return row.channel === channel; }) || { channel: channel, enabled: false, display_name: '', external_id: '' };
}

async function readRules() {
  try {
    const rows = await sb('/rest/v1/hermes_contact_rules?select=*&order=created_at.desc');
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    return [];
  }
}

function ruleMatches(channel, contact, rule) {
  if (!rule || (rule.channel !== 'all' && rule.channel !== channel)) return false;
  return normalizeContact(channel, rule.contact) === normalizeContact(channel, contact);
}

async function contactPolicy(channel, contact) {
  const rules = await readRules();
  const relevant = rules.filter(function (rule) { return rule.channel === 'all' || rule.channel === channel; });
  if (relevant.some(function (rule) { return rule.mode === 'block' && ruleMatches(channel, contact, rule); })) {
    return { blocked: true, reason: 'blacklist' };
  }
  const allow = relevant.filter(function (rule) { return rule.mode === 'allow'; });
  if (allow.length && !allow.some(function (rule) { return ruleMatches(channel, contact, rule); })) {
    return { blocked: true, reason: 'not-in-whitelist' };
  }
  return { blocked: false };
}

async function upsertConversation(event, contact) {
  const row = {
    channel: event.channel,
    contact_id: contact,
    last_message_at: event.timestamp,
    updated_at: new Date().toISOString()
  };
  if (event.contactName) row.contact_name = event.contactName;
  const rows = await sb('/rest/v1/hermes_conversations?on_conflict=channel,contact_id&select=*', {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(row)
  });
  return rows && rows[0] ? rows[0] : null;
}

async function conversationHasOutbound(id) {
  try {
    const rows = await sb('/rest/v1/hermes_messages?select=id&conversation_id=eq.' + encodeURIComponent(id) + '&direction=eq.outbound&limit=1');
    return !!(rows && rows.length);
  } catch (error) {
    return false;
  }
}

async function updateConversation(id, patch) {
  if (!id) return;
  try {
    await sb('/rest/v1/hermes_conversations?id=eq.' + encodeURIComponent(id), {
      method: 'PATCH',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify(Object.assign({ updated_at: new Date().toISOString() }, patch || {}))
    });
  } catch (error) {
    console.warn('[hermes] conversation update failed:', error.message);
  }
}

async function storeInbound(event, conversationId, contact) {
  const externalId = event.externalId || ('in:' + event.channel + ':' + contact + ':' + Date.now());
  const rows = await sb('/rest/v1/hermes_messages?on_conflict=external_id&select=*', {
    method: 'POST',
    headers: headers({ Prefer: 'resolution=ignore-duplicates,return=representation' }),
    body: JSON.stringify({
      conversation_id: conversationId,
      channel: event.channel,
      direction: 'inbound',
      external_id: externalId,
      contact_id: contact,
      body: event.text || '',
      message_type: event.type || 'text',
      metadata: { provider: event.channel },
      created_at: event.timestamp
    })
  });
  return rows && rows[0] ? rows[0] : null;
}

async function storeOutbound(conversationId, channel, contact, text, sent, error) {
  const providerId = sent && sent.id ? sent.id : null;
  const externalId = 'out:' + channel + ':' + (providerId || crypto.randomUUID());
  const metadata = { provider: channel };
  if (sent && sent.raw) metadata.provider_response = sent.raw;
  if (error) metadata.error = error;
  try {
    const rows = await sb('/rest/v1/hermes_messages?select=*', {
      method: 'POST',
      headers: headers({ Prefer: 'return=representation' }),
      body: JSON.stringify({
        conversation_id: conversationId,
        channel: channel,
        direction: 'outbound',
        external_id: externalId,
        contact_id: contact,
        body: text,
        message_type: 'text',
        needs_attention: !!error,
        metadata: metadata
      })
    });
    return rows && rows[0] ? rows[0] : null;
  } catch (err) {
    console.warn('[hermes] outbound store failed:', err.message);
    return null;
  }
}

async function insertUnanswered(data) {
  try {
    await sb('/rest/v1/hermes_unanswered', {
      method: 'POST',
      headers: headers({ Prefer: 'return=minimal' }),
      body: JSON.stringify({
        conversation_id: data.conversation_id || null,
        message_id: data.message_id || null,
        channel: data.channel || '',
        contact_id: data.contact_id || '',
        question: data.question || '',
        reason: data.reason || ''
      })
    });
  } catch (error) {
    console.warn('[hermes] unanswered insert failed:', error.message);
  }
}

async function recentCorrections() {
  try {
    const rows = await sb('/rest/v1/hermes_corrections?select=correction,admin_note,created_at&order=created_at.desc&limit=6');
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    return [];
  }
}

async function ragContext(text) {
  const query = String(text == null ? '' : text).trim();
  if (!query) return [];
  try {
    const rows = await rpc('match_hermes_chunks', { p_query_embedding: embed.embed(query), p_match_count: 5 });
    const useful = (rows || []).filter(function (row) { return Number(row.similarity || 0) > 0.05; });
    if (useful.length) return useful;
  } catch (error) {
    console.warn('[hermes] vector search unavailable:', error.message);
  }
  try {
    const rows = await rpc('search_hermes_chunks', { p_query: query, p_match_count: 5 });
    return Array.isArray(rows) ? rows : [];
  } catch (error) {
    console.warn('[hermes] full-text search unavailable:', error.message);
    return [];
  }
}

function buildMessages(settings, chunks, corrections, text) {
  const context = (chunks || []).map(function (chunk, index) {
    return '[' + (index + 1) + '] ' + chunk.content;
  }).join('\n\n');
  const feedback = (corrections || []).map(function (row) {
    return '- ' + row.correction + (row.admin_note ? ' (' + row.admin_note + ')' : '');
  }).join('\n');
  const system = [
    settings.brand_prompt || DEFAULT_SETTINGS.brand_prompt,
    'Rispondi in italiano, in modo breve e concreto. Non inventare prezzi, disponibilità o dettagli tecnici. Per creazioni, restauri o casi dubbi chiedi foto o un breve video e proponi una consulenza. Se non sai rispondere, scrivi [[UNRESOLVED]] alla fine e chiedi aiuto al team. Non ripetere il messaggio dell’utente e non usare più di 4 frasi.',
    context ? 'CONTESTO DALLA KNOWLEDGE BASE:\n' + context : 'CONTESTO DALLA KNOWLEDGE BASE: nessun documento pertinente trovato.',
    feedback ? 'CORREZIONI RECENTI DEL TEAM:\n' + feedback : '',
    'REGOLE FISSE: studio a Roma, Palazzo Giallo, Civico 9. Metodo senza cera. Caparra 20 euro. Riprogrammazione gratuita fino a 24 ore prima. Non fornire mai dati di pagamento in chat.'
  ].filter(Boolean).join('\n\n');
  return [
    { role: 'system', content: system },
    { role: 'user', content: String(text || '').slice(0, 4000) }
  ];
}

async function callAI(messages, settings) {
  const key = aiKey();
  if (!key) return null;
  const controller = new AbortController();
  const timer = setTimeout(function () { controller.abort(); }, 12000);
  try {
    const response = await fetch(aiEndpoint(), {
      method: 'POST',
      signal: controller.signal,
      headers: {
        Authorization: 'Bearer ' + key,
        'Content-Type': 'application/json',
        'HTTP-Referer': PUBLIC_SITE_URL,
        'X-Title': 'WooDreads Hermes'
      },
      body: JSON.stringify({
        model: aiModel(settings),
        messages: messages,
        temperature: 0.4,
        max_tokens: 420
      })
    });
    const text = await response.text();
    let data = null;
    try { data = text ? JSON.parse(text) : null; } catch (e) { data = null; }
    if (!response.ok) throw new Error((data && data.error && data.error.message) || ('AI ' + response.status));
    const content = data && data.choices && data.choices[0] && data.choices[0].message && data.choices[0].message.content;
    if (Array.isArray(content)) {
      return content.map(function (part) { return part && part.text ? part.text : ''; }).join('').trim() || null;
    }
    return content ? String(content).trim() : null;
  } finally {
    clearTimeout(timer);
  }
}

async function sendMetaMessage(path, token, body) {
  const response = await fetch(META_GRAPH_BASE + '/' + META_API_VERSION + '/' + path, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const text = await response.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch (e) { data = { raw: text }; }
  if (!response.ok) throw new Error((data && data.error && data.error.message) || ('Meta ' + response.status));
  return data || {};
}

async function sendReply(channel, channelRow, contact, text) {
  if (channel === 'whatsapp') {
    const token = process.env.WHATSAPP_TOKEN || process.env.META_WHATSAPP_TOKEN || '';
    const phoneId = process.env.WHATSAPP_PHONE_NUMBER_ID || (channelRow && channelRow.external_id) || '';
    if (!token || !phoneId) throw new Error('WhatsApp non configurato: WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID');
    const data = await sendMetaMessage(phoneId + '/messages', token, {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: contact,
      type: 'text',
      text: { preview_url: false, body: text }
    });
    return { id: data && data.messages && data.messages[0] ? data.messages[0].id : null, raw: data };
  }
  if (channel === 'instagram') {
    const token = process.env.INSTAGRAM_TOKEN || process.env.META_PAGE_TOKEN || '';
    const igId = process.env.INSTAGRAM_USER_ID || (channelRow && channelRow.external_id) || '';
    if (!token || !igId) throw new Error('Instagram non configurato: INSTAGRAM_TOKEN / INSTAGRAM_USER_ID');
    const data = await sendMetaMessage(igId + '/messages', token, {
      recipient: { id: contact },
      message: { text: text }
    });
    return { id: data && (data.message_id || data.id) ? (data.message_id || data.id) : null, raw: data };
  }
  if (channel === 'tiktok') {
    const token = process.env.TIKTOK_ACCESS_TOKEN || '';
    const endpoint = process.env.TIKTOK_SEND_URL || '';
    if (!token || !endpoint) throw new Error('TikTok non configurato: TIKTOK_ACCESS_TOKEN / TIKTOK_SEND_URL');
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        to: contact,
        text: text,
        business_id: process.env.TIKTOK_BUSINESS_ID || (channelRow && channelRow.external_id) || ''
      })
    });
    const rawText = await response.text();
    let data = null;
    try { data = rawText ? JSON.parse(rawText) : null; } catch (e) { data = { raw: rawText }; }
    if (!response.ok) throw new Error((data && data.message) || ('TikTok ' + response.status));
    return { id: data && (data.message_id || (data.data && data.data.message_id)) ? (data.message_id || data.data.message_id) : null, raw: data };
  }
  throw new Error('Canale non supportato: ' + channel);
}

function extractWhatsApp(body) {
  const events = [];
  const entries = Array.isArray(body && body.entry) ? body.entry : [];
  entries.forEach(function (entry) {
    const changes = Array.isArray(entry.changes) ? entry.changes : [];
    changes.forEach(function (change) {
      const value = change && change.value ? change.value : {};
      const messages = Array.isArray(value.messages) ? value.messages : [];
      const contacts = Array.isArray(value.contacts) ? value.contacts : [];
      messages.forEach(function (message) {
        const contact = contacts[0] || {};
        const text = message.text && message.text.body
          ? message.text.body
          : (message.button && message.button.text)
            ? message.button.text
            : (message.interactive && message.interactive.button_reply && message.interactive.button_reply.title)
              ? message.interactive.button_reply.title
              : (message.image && message.image.caption)
                ? message.image.caption
                : (message.video && message.video.caption)
                  ? message.video.caption
                  : '[' + (message.type || 'messaggio') + ']';
        events.push({
          channel: 'whatsapp',
          contactId: message.from,
          contactName: contact.profile && contact.profile.name ? contact.profile.name : '',
          externalId: message.id,
          text: text,
          type: message.type || 'text',
          timestamp: message.timestamp ? new Date(Number(message.timestamp) * 1000).toISOString() : new Date().toISOString(),
          raw: message
        });
      });
    });
  });
  return events;
}

function extractInstagram(body) {
  const events = [];
  const entries = Array.isArray(body && body.entry) ? body.entry : [];
  entries.forEach(function (entry) {
    const messages = Array.isArray(entry.messaging) ? entry.messaging : [];
    messages.forEach(function (item) {
      const message = item && item.message ? item.message : null;
      if (!message || message.is_echo) return;
      const attachments = Array.isArray(message.attachments) ? message.attachments : [];
      const text = message.text || attachments.map(function (attachment) { return '[' + (attachment.type || 'allegato') + ']'; }).join(' ') || '[messaggio]';
      events.push({
        channel: 'instagram',
        contactId: item.sender && item.sender.id ? item.sender.id : '',
        contactName: '',
        externalId: message.mid,
        text: text,
        type: attachments.length ? 'attachment' : 'text',
        timestamp: item.timestamp ? new Date(Number(item.timestamp)).toISOString() : new Date().toISOString(),
        raw: message
      });
    });
  });
  return events;
}

function extractTikTok(body) {
  const events = [];
  const data = body && body.data ? body.data : body;
  const list = data && Array.isArray(data.messages) ? data.messages : (data && (data.message || data.text) ? [data] : []);
  list.forEach(function (item) {
    const contactId = item.sender_id || item.from || item.user_id || item.open_id || (item.sender && item.sender.id) || '';
    const text = item.text || item.content || (item.message && item.message.text) || item.body || '';
    if (!contactId || !text) return;
    const rawTime = item.create_time || item.timestamp || item.time;
    let timestamp = new Date().toISOString();
    if (rawTime) {
      const value = Number(rawTime);
      timestamp = new Date(value < 100000000000 ? value * 1000 : value).toISOString();
    }
    events.push({
      channel: 'tiktok',
      contactId: contactId,
      contactName: item.sender_name || item.username || '',
      externalId: item.message_id || item.id || item.msg_id,
      text: String(text),
      type: 'text',
      timestamp: timestamp,
      raw: item
    });
  });
  return events;
}

function extractEvents(channel, body) {
  if (channel === 'whatsapp') return extractWhatsApp(body);
  if (channel === 'instagram') return extractInstagram(body);
  if (channel === 'tiktok') return extractTikTok(body);
  return [];
}

function verifyMetaSignature(rawBody, signature, secret) {
  if (!secret) return true;
  if (!signature) return false;
  const expected = 'sha256=' + crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(signature);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function verifyTikTokSignature(rawBody, signature, secret) {
  if (!secret) return true;
  if (!signature) return false;
  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  return signature === expected || signature === 'sha256=' + expected;
}

async function processEvent(event) {
  const settings = await readSettings();
  const channelRow = await readChannel(event.channel);
  const contact = normalizeContact(event.channel, event.contactId);
  if (!contact) return { ok: false, error: 'contact mancante' };
  const conversation = await upsertConversation(event, contact);
  if (!conversation) return { ok: false, error: 'conversazione non creata' };
  const hadOutbound = await conversationHasOutbound(conversation.id);
  const inbound = await storeInbound(event, conversation.id, contact);
  if (!inbound) return { ok: true, duplicate: true };
  await updateConversation(conversation.id, {
    unread_count: Number(conversation.unread_count || 0) + 1,
    last_message_at: event.timestamp,
    last_message_preview: preview(event.text)
  });
  if (!settings.enabled || !channelRow.enabled) {
    return { ok: true, replied: false, reason: !settings.enabled ? 'kill-switch' : 'channel-off' };
  }
  const policy = await contactPolicy(event.channel, contact);
  if (policy.blocked) return { ok: true, replied: false, reason: policy.reason };

  let reply = '';
  let unresolved = false;
  let reason = '';
  if (!hadOutbound) {
    reply = settings.first_message || DEFAULT_SETTINGS.first_message;
  } else {
    const chunks = await ragContext(event.text);
    const corrections = await recentCorrections();
    let aiReply = null;
    try {
      aiReply = await callAI(buildMessages(settings, chunks, corrections, event.text), settings);
    } catch (error) {
      console.warn('[hermes] AI failed:', error.message);
    }
    if (aiReply) {
      reply = aiReply;
      if (reply.indexOf('[[UNRESOLVED]]') >= 0) {
        unresolved = true;
        reason = 'AI incerta';
        reply = reply.replace(/\[\[UNRESOLVED\]\]/gi, '').trim();
      }
    } else {
      reply = settings.fallback_message || DEFAULT_SETTINGS.fallback_message;
      unresolved = true;
      reason = 'AI non configurata';
    }
  }
  reply = String(reply || '').trim().slice(0, 1800);
  if (!reply) {
    if (unresolved) {
      await insertUnanswered({
        conversation_id: conversation.id,
        message_id: inbound.id,
        channel: event.channel,
        contact_id: contact,
        question: event.text,
        reason: reason || 'Risposta vuota'
      });
    }
    return { ok: true, replied: false, reason: 'empty-reply' };
  }

  let sent = null;
  let sendError = null;
  try {
    sent = await sendReply(event.channel, channelRow, contact, reply);
  } catch (error) {
    sendError = error.message || String(error);
    unresolved = true;
    reason = 'Invio fallito';
  }
  await storeOutbound(conversation.id, event.channel, contact, reply, sent, sendError);
  await updateConversation(conversation.id, {
    last_message_at: new Date().toISOString(),
    last_message_preview: preview(reply),
    needs_attention: unresolved
  });
  if (unresolved) {
    await insertUnanswered({
      conversation_id: conversation.id,
      message_id: inbound.id,
      channel: event.channel,
      contact_id: contact,
      question: event.text,
      reason: reason
    });
  }
  return { ok: true, replied: true, unresolved: unresolved };
}

async function statusPayload() {
  const settings = await readSettings();
  const channels = await readChannels();
  const byChannel = {};
  channels.forEach(function (row) { byChannel[row.channel] = row; });
  return {
    ok: true,
    service: 'hermes',
    schema: !settings._schemaMissing,
    enabled: settings.enabled !== false,
    aiConfigured: !!aiKey(),
    aiModel: aiModel(settings),
    verifyConfigured: !!(process.env.HERMES_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN),
    signatureConfigured: !!(process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET),
    whatsappConfigured: !!(process.env.WHATSAPP_TOKEN && (process.env.WHATSAPP_PHONE_NUMBER_ID || (byChannel.whatsapp && byChannel.whatsapp.external_id))),
    instagramConfigured: !!((process.env.INSTAGRAM_TOKEN || process.env.META_PAGE_TOKEN) && (process.env.INSTAGRAM_USER_ID || (byChannel.instagram && byChannel.instagram.external_id))),
    tiktokConfigured: !!(process.env.TIKTOK_ACCESS_TOKEN && process.env.TIKTOK_SEND_URL),
    webhookBase: PUBLIC_SITE_URL + '/api/hermes'
  };
}

exports.handler = async (event) => {
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
    'Vary': 'User-Agent'
  };
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: responseHeaders };

  if (event.httpMethod === 'GET') {
    const query = event.queryStringParameters || {};
    if (query['hub.mode'] === 'subscribe') {
      const token = process.env.HERMES_VERIFY_TOKEN || process.env.META_VERIFY_TOKEN || process.env.WHATSAPP_VERIFY_TOKEN || '';
      if (!token) return { statusCode: 500, headers: responseHeaders, body: JSON.stringify({ error: 'HERMES_VERIFY_TOKEN non configurato' }) };
      if (query['hub.verify_token'] !== token) return { statusCode: 403, headers: responseHeaders, body: JSON.stringify({ error: 'verify token non valido' }) };
      return { statusCode: 200, headers: { 'Content-Type': 'text/plain', 'Cache-Control': 'no-store' }, body: String(query['hub.challenge'] || '') };
    }
    if (query.action === 'status' || query.action === 'health') {
      return { statusCode: 200, headers: responseHeaders, body: JSON.stringify(await statusPayload()) };
    }
    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ ok: true, service: 'hermes', webhook: true }) };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: responseHeaders, body: JSON.stringify({ error: 'method not allowed' }) };
  }

  const query = event.queryStringParameters || {};
  const rawBody = typeof event.rawBody === 'string' || Buffer.isBuffer(event.rawBody)
    ? event.rawBody
    : (event.body || '');
  const bodyText = event.body || (Buffer.isBuffer(rawBody) ? rawBody.toString('utf8') : rawBody);
  let body = null;
  try { body = bodyText ? JSON.parse(bodyText) : {}; } catch (error) {
    return { statusCode: 400, headers: responseHeaders, body: JSON.stringify({ error: 'JSON non valido' }) };
  }

  const channel = query.channel || body.channel || (body.object === 'instagram' ? 'instagram' : (body.object === 'whatsapp_business_account' ? 'whatsapp' : 'tiktok'));
  const metaSecret = process.env.META_APP_SECRET || process.env.WHATSAPP_APP_SECRET || '';
  if ((channel === 'whatsapp' || channel === 'instagram') && metaSecret) {
    const signature = event.headers && (event.headers['x-hub-signature-256'] || event.headers['X-Hub-Signature-256']);
    if (!verifyMetaSignature(rawBody, signature, metaSecret)) {
      return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'firma Meta non valida' }) };
    }
  }
  if (channel === 'tiktok' && process.env.TIKTOK_WEBHOOK_SECRET) {
    const signature = event.headers && (event.headers['x-tiktok-signature'] || event.headers['X-TikTok-Signature']);
    if (!verifyTikTokSignature(rawBody, signature, process.env.TIKTOK_WEBHOOK_SECRET)) {
      return { statusCode: 401, headers: responseHeaders, body: JSON.stringify({ error: 'firma TikTok non valida' }) };
    }
  }

  const events = extractEvents(channel, body);
  if (!events.length) {
    return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ ok: true, processed: 0 }) };
  }

  const results = [];
  for (const item of events) {
    try {
      results.push(await processEvent(item));
    } catch (error) {
      console.error('[hermes] event failed:', error.message);
      results.push({ ok: false, error: error.message });
    }
  }
  return { statusCode: 200, headers: responseHeaders, body: JSON.stringify({ ok: true, processed: results.length, results: results }) };
};
