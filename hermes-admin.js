(function () {
  var DEFAULTS = {
    id: 'global',
    enabled: true,
    brand_prompt: 'Sei Hermes, l’assistente AI di WooDreads, studio di dreadmaker a Roma. Parla in italiano con un tono solare, empatico e professionale. Non inventare prezzi. Chiedi foto o un breve video prima di un preventivo. Se non conosci la risposta, dillo con onestà e chiedi aiuto al team.',
    first_message: 'Ciao! ☀️ Benvenut* in WooDreads. Qual è il servizio di cui hai bisogno e come posso esserti utile oggi?',
    fallback_message: 'Ho preso nota della tua richiesta ✨ Ti rispondo a breve con tutte le informazioni. Se preferisci, scrivici direttamente su WhatsApp al 348 539 3826.',
    model: 'openrouter/free'
  };

  var state = {
    built: false,
    schema: true,
    loading: false,
    settings: null,
    channels: [],
    conversations: [],
    messages: [],
    activeConversation: null,
    unanswered: [],
    docs: [],
    rules: [],
    corrections: [],
    status: null,
    search: '',
    channelFilter: 'all',
    activePanel: 'overview',
    selectedMessage: null,
    answerId: null,
    settingsPopulated: false,
    messagesToday: 0,
    training: false,
    rtInit: false,
    rt: null,
    pollTimer: null,
    reloadTimer: null
  };

  function hEsc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, function (char) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[char];
    });
  }

  function hToast(message, error) {
    if (typeof window.toast === 'function') window.toast(message, error);
    else if (window.console) console.log(message);
  }

  function hDate(value, options) {
    if (!value) return '—';
    try {
      return new Date(value).toLocaleString('it-IT', options || { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
    } catch (error) {
      return '—';
    }
  }

  function hAgo(value) {
    if (!value) return '—';
    var diff = Date.now() - new Date(value).getTime();
    if (!isFinite(diff)) return '—';
    var minutes = Math.round(diff / 60000);
    if (minutes < 1) return 'ora';
    if (minutes < 60) return minutes + 'm';
    var hours = Math.round(minutes / 60);
    if (hours < 24) return hours + 'h';
    var days = Math.round(hours / 24);
    if (days < 7) return days + 'g';
    return hDate(value, { day: '2-digit', month: 'short' });
  }

  function hChannelLabel(channel) {
    return channel === 'whatsapp' ? 'WhatsApp' : channel === 'instagram' ? 'Instagram' : channel === 'tiktok' ? 'TikTok' : 'Tutti';
  }

  function hChannelIcon(channel) {
    return channel === 'whatsapp' ? '✆' : channel === 'instagram' ? '◎' : channel === 'tiktok' ? '♪' : '◈';
  }

  function hChannelClass(channel) {
    return channel === 'whatsapp' ? 'green' : channel === 'instagram' ? 'pink' : channel === 'tiktok' ? 'cyan' : '';
  }

  function hTag(cls, text) {
    return '<span class="h-tag ' + (cls || '') + '">' + hEsc(text) + '</span>';
  }

  function hInitial(name, contact) {
    var value = String(name || contact || '?').trim();
    return value ? value.charAt(0).toUpperCase() : '?';
  }

  function hSettings() {
    return state.settings || DEFAULTS;
  }

  function hChannelRow(channel) {
    return state.channels.find(function (row) { return row.channel === channel; }) || {
      channel: channel,
      enabled: false,
      display_name: '',
      external_id: ''
    };
  }

  function hConfigured(channel) {
    if (!state.status) return null;
    return !!state.status[channel + 'Configured'];
  }

  function hWebhook(channel) {
    var base = (state.status && state.status.webhookBase) || 'https://www.woodreads.com/api/hermes';
    return base + '?channel=' + channel;
  }

  async function sb(path, options) {
    if (typeof window.supabaseFetch !== 'function') throw new Error('Supabase non disponibile');
    return window.supabaseFetch(path, options || {});
  }

  function build() {
    var host = document.getElementById('tab-hermes');
    if (!host) return;
    host.innerHTML = [
      heroTemplate(),
      overviewTemplate(),
      trainingTemplate(),
      chatsTemplate(),
      contactsTemplate(),
      channelsTemplate(),
      settingsTemplate(),
      modalTemplate()
    ].join('');
    host.querySelectorAll('[data-hsub]').forEach(function (button) {
      button.addEventListener('click', function () {
        setPanel(button.getAttribute('data-hsub'));
      });
    });
    var drop = document.getElementById('h-drop');
    if (drop) {
      drop.addEventListener('dragover', function (event) {
        event.preventDefault();
        drop.classList.add('drag');
      });
      drop.addEventListener('dragleave', function () {
        drop.classList.remove('drag');
      });
      drop.addEventListener('drop', function (event) {
        event.preventDefault();
        drop.classList.remove('drag');
        if (event.dataTransfer && event.dataTransfer.files) handleTrainFile(event.dataTransfer.files);
      });
    }
    var modal = document.getElementById('h-answer-modal');
    if (modal) {
      modal.addEventListener('click', function (event) {
        if (event.target === modal) closeAnswerModal();
      });
    }
    state.built = true;
  }

  function setPanel(name) {
    state.activePanel = name || 'overview';
    document.querySelectorAll('[data-hsub]').forEach(function (button) {
      button.classList.toggle('active', button.getAttribute('data-hsub') === state.activePanel);
    });
    document.querySelectorAll('.hermes-panel').forEach(function (panel) {
      panel.classList.toggle('active', panel.id === 'h-panel-' + state.activePanel);
    });
    if (state.activePanel === 'channels') {
      renderChannels();
      if (!state.status) loadStatus();
    }
    if (state.activePanel === 'settings' && !state.settingsPopulated) renderSettings();
  }

  function show() {
    if (!state.built) {
      build();
      initRealtime();
    }
    setPanel(state.activePanel);
    loadAll().then(function () {
      loadStatus();
    }).catch(function (error) {
      hToast('Hermes non caricato: ' + error.message, true);
    });
  }

  function heroTemplate() {
    return `<div class="hermes-shell">
      <div class="hermes-hero">
        <div class="hermes-hero-top">
          <div class="hermes-kicker">Hermes · Multi-channel agent</div>
          <div class="hermes-live" id="h-live"><span class="dot"></span><span id="h-live-text">Connessione…</span></div>
        </div>
        <div class="hermes-hero-grid">
          <div>
            <h1 class="hermes-title">Hermes <span>Command Center</span></h1>
            <p class="hermes-sub">Addestra la memoria, monitora WhatsApp, Instagram Direct e TikTok, correggi le risposte e gestisci le regole di ingaggio da un unico punto. Il master switch ferma tutto in un clic.</p>
            <div class="hermes-pills" id="h-pills"></div>
          </div>
          <div class="hermes-kill">
            <div class="hermes-kill-label">Kill switch globale</div>
            <button class="hermes-master" id="h-master" onclick="WDHermes.toggleMaster()"><span class="dot"></span><span id="h-master-text">ON</span></button>
            <div class="hermes-kill-note" id="h-master-note">Hermes risponde su tutti i canali attivi.</div>
          </div>
        </div>
        <div class="hermes-hero-stats">
          <div class="hermes-hero-stat"><b id="h-stat-conv">0</b><span>Chat attive</span></div>
          <div class="hermes-hero-stat"><b id="h-stat-unanswered">0</b><span>Da chiarire</span></div>
          <div class="hermes-hero-stat"><b id="h-stat-docs">0</b><span>Documenti training</span></div>
          <div class="hermes-hero-stat"><b id="h-stat-msgs">0</b><span>Messaggi oggi</span></div>
        </div>
      </div>
      <div class="hermes-banner" id="h-schema-banner"></div>
      <div class="hermes-subnav">
        <button data-hsub="overview" class="active">Panoramica</button>
        <button data-hsub="training">Training & domande</button>
        <button data-hsub="chats">Chat live</button>
        <button data-hsub="contacts">Contatti & regole</button>
        <button data-hsub="channels">Canali & guide</button>
        <button data-hsub="settings">Prompt & AI</button>
      </div>`;
  }

  function overviewTemplate() {
    return `<div id="h-panel-overview" class="hermes-panel active">
      <div class="h-grid two">
        <div class="h-card">
          <div class="h-card-h"><h3>Stato canali</h3><span class="h-count" id="h-channel-count">0/3</span></div>
          <div class="h-card-b" id="h-overview-channels"></div>
        </div>
        <div class="h-card">
          <div class="h-card-h"><h3>Come lavora Hermes</h3><span class="h-count">RAG + AI</span></div>
          <div class="h-card-b">
            <div class="h-grid three">
              <div class="h-schema-step"><b>1 · Ascolta</b>Ogni messaggio entra nella chat live con canale, contatto e cronologia completa.</div>
              <div class="h-schema-step"><b>2 · Cerca</b>La knowledge base Supabase pgvector recupera i contenuti più vicini alla domanda.</div>
              <div class="h-schema-step"><b>3 · Risponde</b>Hermes risponde con il tono WooDreads e segnala al team ciò che non sa.</div>
            </div>
            <p class="h-small h-muted" style="margin-top:.9rem;">Il primo messaggio ricevuto da ogni nuovo contatto usa sempre il messaggio standard di benvenuto. Le risposte successive passano da RAG, correzioni RLHF e AI.</p>
            <div class="h-actions"><button class="h-btn cyan" onclick="WDHermes.setPanel('training')">Apri training</button><button class="h-btn" onclick="WDHermes.setPanel('channels')">Configura canali</button></div>
          </div>
        </div>
      </div>
      <div class="h-grid two" style="margin-top:1rem;">
        <div class="h-card">
          <div class="h-card-h"><h3>Ultime chat</h3><span class="h-count" id="h-overview-conv-count">0</span></div>
          <div class="h-card-b flush h-overview-list" id="h-overview-conversations"></div>
        </div>
        <div class="h-card">
          <div class="h-card-h"><h3>Da chiarire</h3><span class="h-count" id="h-overview-unanswered-count">0</span></div>
          <div class="h-card-b flush h-overview-list" id="h-overview-unanswered"></div>
        </div>
      </div>
    </div>`;
  }

  function trainingTemplate() {
    return `<div id="h-panel-training" class="hermes-panel">
      <div class="h-grid two">
        <div class="h-card">
          <div class="h-card-h"><h3>Carica conoscenza</h3><span class="h-count">RAG</span></div>
          <div class="h-card-b">
            <label class="h-label">Titolo documento</label>
            <input id="h-train-title" class="h-field" placeholder="Es. Listino servizi, FAQ, conversazione esempio…">
            <div class="h-drop" id="h-drop" onclick="document.getElementById('h-train-file').click()">
              <b>Trascina qui un file di testo</b>
              <span>.txt, .md, .csv, .json o .html · max 600 KB</span>
              <input type="file" id="h-train-file" accept=".txt,.md,.markdown,.csv,.json,.html,.htm" style="display:none" onchange="WDHermes.handleTrainFile(this.files)">
            </div>
            <div class="h-progress" id="h-train-progress"><div class="h-progress-bar"><i id="h-train-bar"></i></div><div class="h-progress-text" id="h-train-status"></div></div>
            <label class="h-label" style="margin-top:.9rem;">Oppure incolla testo o una conversazione</label>
            <textarea id="h-train-text" class="h-field" placeholder="Incolla qui conoscenza, obiezioni, script di vendita, esempi di conversazioni…"></textarea>
            <div class="h-actions">
              <button class="h-btn primary" onclick="WDHermes.trainText()">Addestra Hermes</button>
              <button class="h-btn" onclick="WDHermes.importFaqs()">Importa FAQ del sito</button>
            </div>
            <p class="h-small h-muted" style="margin-top:.7rem;">I testi vengono spezzati in chunk, trasformati in embedding e salvati su Supabase pgvector. Le correzioni salvate nella chat live finiscono automaticamente in memoria.</p>
          </div>
        </div>
        <div class="h-card">
          <div class="h-card-h"><h3>Documenti in memoria</h3><span class="h-count" id="h-doc-count">0</span></div>
          <div class="h-card-b flush" id="h-docs"></div>
        </div>
      </div>
      <div class="h-card" style="margin-top:1rem;">
        <div class="h-card-h"><h3>Domande e obiezioni non risolte</h3><span class="h-count" id="h-unanswered-count">0</span></div>
        <div class="h-card-b flush" id="h-unanswered"></div>
      </div>
    </div>`;
  }

  function chatsTemplate() {
    return `<div id="h-panel-chats" class="hermes-panel">
      <div class="h-chat-layout">
        <div class="h-card">
          <div class="h-card-h"><h3>Chat</h3><span class="h-count" id="h-conv-count">0</span></div>
          <div class="h-card-b" style="padding:.7rem;">
            <input id="h-conv-search" class="h-field" placeholder="Cerca contatto o messaggio…" oninput="WDHermes.filterConversations(this.value)">
            <div style="display:flex;gap:.3rem;margin-top:.5rem;flex-wrap:wrap;">
              <button class="h-btn small primary" data-hfilter="all" onclick="WDHermes.setChannelFilter('all')">Tutti</button>
              <button class="h-btn small" data-hfilter="whatsapp" onclick="WDHermes.setChannelFilter('whatsapp')">WhatsApp</button>
              <button class="h-btn small" data-hfilter="instagram" onclick="WDHermes.setChannelFilter('instagram')">Instagram</button>
              <button class="h-btn small" data-hfilter="tiktok" onclick="WDHermes.setChannelFilter('tiktok')">TikTok</button>
            </div>
          </div>
          <div class="h-conv-list" id="h-conv-list"></div>
        </div>
        <div class="h-card h-chat-pane">
          <div class="h-chat-head" id="h-chat-head"></div>
          <div class="h-messages" id="h-messages"><div class="h-empty-big"><b>Nessuna chat selezionata</b>Scegli una conversazione a sinistra per vedere la cronologia completa.</div></div>
          <div class="h-correct">
            <h4>Correzione / RLHF</h4>
            <p id="h-correct-hint">Seleziona un messaggio e scrivi la risposta corretta. La correzione viene salvata e usata come esempio per le risposte future.</p>
            <textarea id="h-correction" class="h-field" placeholder="Scrivi la risposta ideale che Hermes avrebbe dovuto dare…"></textarea>
            <div class="h-actions">
              <button class="h-btn primary" onclick="WDHermes.saveCorrection()">Salva correzione</button>
              <button class="h-btn" onclick="WDHermes.clearCorrection()">Annulla</button>
            </div>
          </div>
        </div>
      </div>
    </div>`;
  }

  function contactsTemplate() {
    return `<div id="h-panel-contacts" class="hermes-panel">
      <div class="h-card">
        <div class="h-card-h"><h3>Regole di ingaggio</h3><span class="h-count" id="h-rule-count">0</span></div>
        <div class="h-card-b">
          <div class="h-contact-form">
            <div><label class="h-label">Canale</label><select id="h-rule-channel" class="h-field"><option value="all">Tutti</option><option value="whatsapp">WhatsApp</option><option value="instagram">Instagram</option><option value="tiktok">TikTok</option></select></div>
            <div><label class="h-label">Contatto / numero</label><input id="h-rule-contact" class="h-field" placeholder="+39… oppure ID Instagram/TikTok"></div>
            <div><label class="h-label">Regola</label><select id="h-rule-mode" class="h-field"><option value="block">Blocca</option><option value="allow">Consenti</option></select></div>
            <button class="h-btn primary" onclick="WDHermes.addRule()">Aggiungi</button>
          </div>
          <input id="h-rule-note" class="h-field" placeholder="Nota interna (opzionale)" style="margin-top:.6rem;">
          <p class="h-small h-muted" style="margin-top:.6rem;">La blacklist ha priorità sulla whitelist. Se esiste almeno una regola “Consenti” per un canale, Hermes risponde solo ai contatti presenti in whitelist. Il numero studio è già bloccato.</p>
        </div>
        <div class="h-card-b flush" id="h-rules"></div>
      </div>
    </div>`;
  }

  function channelsTemplate() {
    return `<div id="h-panel-channels" class="hermes-panel">
      <div class="h-grid three" id="h-channels"></div>
      <div class="h-card" style="margin-top:1rem;">
        <div class="h-card-h"><h3>Sicurezza credenziali</h3><span class="h-count">Server-side</span></div>
        <div class="h-card-b">
          <p class="h-small h-muted">Le chiavi API, i token Meta/TikTok e i segreti webhook non vengono mai salvati nelle tabelle pubbliche e non vengono mostrati nel pannello. Restano nelle variabili d’ambiente Vercel e vengono letti solo da <code>api/hermes.js</code>. Qui vedi lo stato “configurato / da collegare” e le istruzioni per autorizzare ogni canale.</p>
          <div class="h-actions"><button class="h-btn cyan" onclick="WDHermes.loadStatus()">Verifica configurazione</button><button class="h-btn" onclick="WDHermes.copy('https://www.woodreads.com/api/hermes')">Copia base webhook</button></div>
        </div>
      </div>
    </div>`;
  }

  function settingsTemplate() {
    return `<div id="h-panel-settings" class="hermes-panel">
      <div class="h-grid two">
        <div class="h-card">
          <div class="h-card-h"><h3>Prompt di marca</h3><span class="h-count">AI</span></div>
          <div class="h-card-b">
            <textarea id="h-brand-prompt" class="h-field" style="min-height:280px;" placeholder="Definisci personalità, tono, regole e cosa Hermes non deve mai dire…"></textarea>
            <div class="h-actions"><button class="h-btn primary" onclick="WDHermes.saveSettings()">Salva prompt</button></div>
          </div>
        </div>
        <div class="h-card">
          <div class="h-card-h"><h3>Messaggi e modello</h3><span class="h-count">Runtime</span></div>
          <div class="h-card-b">
            <label class="h-label">Primo messaggio automatico</label>
            <textarea id="h-first-message" class="h-field" style="min-height:90px;"></textarea>
            <label class="h-label" style="margin-top:.8rem;">Risposta di fallback</label>
            <textarea id="h-fallback-message" class="h-field" style="min-height:90px;"></textarea>
            <label class="h-label" style="margin-top:.8rem;">Modello AI</label>
            <input id="h-model" class="h-field" placeholder="openrouter/free">
            <div class="h-actions"><button class="h-btn primary" onclick="WDHermes.saveSettings()">Salva impostazioni</button></div>
          </div>
        </div>
      </div>
      <div class="h-card" style="margin-top:1rem;">
        <div class="h-card-h"><h3>Stato integrazione AI</h3><span class="h-count" id="h-ai-state">Verifica…</span></div>
        <div class="h-card-b" id="h-ai-status"></div>
      </div>
    </div>
  </div>`;
  }

  function modalTemplate() {
    return `<div class="h-modal" id="h-answer-modal">
      <div class="h-modal-box">
        <h3>Risposta manuale</h3>
        <p id="h-answer-question"></p>
        <textarea id="h-answer-text" class="h-field" placeholder="Scrivi la risposta corretta. Verrà salvata come esempio di training."></textarea>
        <div class="h-modal-actions">
          <button class="h-btn" onclick="WDHermes.closeAnswerModal()">Annulla</button>
          <button class="h-btn primary" onclick="WDHermes.saveAnswer()">Salva e addestra</button>
        </div>
      </div>
    </div>`;
  }

  function missingSchema(result) {
    return result.status === 'rejected' && result.reason && (
      result.reason.status === 404 ||
      /does not exist|schema cache|PGRST205|42P01|could not find/i.test(String(result.reason.message || ''))
    );
  }

  async function loadAll() {
    if (state.loading) return;
    state.loading = true;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var results = await Promise.allSettled([
      sb('/rest/v1/hermes_settings?select=*&id=eq.global&limit=1'),
      sb('/rest/v1/hermes_channels?select=*&order=channel.asc'),
      sb('/rest/v1/hermes_conversations?select=*&order=last_message_at.desc&limit=80'),
      sb('/rest/v1/hermes_unanswered?select=*&resolved=eq.false&order=created_at.desc&limit=60'),
      sb('/rest/v1/hermes_training_documents?select=*&order=created_at.desc&limit=60'),
      sb('/rest/v1/hermes_contact_rules?select=*&order=created_at.desc'),
      sb('/rest/v1/hermes_corrections?select=*&order=created_at.desc&limit=12'),
      sb('/rest/v1/hermes_messages?select=id&created_at=gte.' + encodeURIComponent(today.toISOString()) + '&limit=1000')
    ]);

    if (results.some(missingSchema)) state.schema = false;
    else if (results.every(function (result) { return result.status === 'fulfilled'; })) state.schema = true;

    state.settings = results[0].status === 'fulfilled' && results[0].value && results[0].value[0]
      ? results[0].value[0]
      : Object.assign({}, DEFAULTS);
    state.settingsPopulated = false;
    state.channels = results[1].status === 'fulfilled' && Array.isArray(results[1].value) ? results[1].value : [];
    state.conversations = results[2].status === 'fulfilled' && Array.isArray(results[2].value) ? results[2].value : [];
    state.unanswered = results[3].status === 'fulfilled' && Array.isArray(results[3].value) ? results[3].value : [];
    state.docs = results[4].status === 'fulfilled' && Array.isArray(results[4].value) ? results[4].value : [];
    state.rules = results[5].status === 'fulfilled' && Array.isArray(results[5].value) ? results[5].value : [];
    state.corrections = results[6].status === 'fulfilled' && Array.isArray(results[6].value) ? results[6].value : [];
    state.messagesToday = results[7].status === 'fulfilled' && Array.isArray(results[7].value) ? results[7].value.length : 0;

    var activeId = state.activeConversation && state.activeConversation.id;
    if (activeId) {
      state.activeConversation = state.conversations.find(function (row) { return row.id === activeId; }) || null;
    }
    if (!state.activeConversation && state.conversations.length) state.activeConversation = state.conversations[0];
    if (state.activeConversation) {
      try {
        state.messages = await fetchMessages(state.activeConversation.id);
      } catch (error) {
        state.messages = [];
      }
    } else {
      state.messages = [];
    }

    state.loading = false;
    renderAll();
  }

  async function loadStatus() {
    try {
      var response = await fetch('/api/hermes?action=status', { cache: 'no-store' });
      var data = await response.json();
      state.status = data;
      if (data && data.schema === false) state.schema = false;
    } catch (error) {
      state.status = null;
    }
    renderStatus();
  }

  function renderAll() {
    renderMaster();
    renderPills();
    renderStats();
    renderSchemaBanner();
    renderOverviewChannels();
    renderOverviewRecent();
    renderOverviewUnanswered();
    renderDocs();
    renderUnanswered();
    renderConversations();
    renderChatHead();
    renderMessages();
    renderCorrection();
    renderRules();
    renderChannels();
    renderSettings();
    renderAiStatus();
  }

  function renderStatus() {
    renderMaster();
    renderPills();
    renderOverviewChannels();
    renderChannels();
    renderAiStatus();
    renderSchemaBanner();
  }

  function renderMaster() {
    var button = document.getElementById('h-master');
    if (!button) return;
    var enabled = hSettings().enabled !== false;
    var text = document.getElementById('h-master-text');
    var note = document.getElementById('h-master-note');
    button.classList.toggle('off', !enabled || !state.schema);
    button.disabled = !state.schema;
    if (text) text.textContent = !state.schema ? 'OFFLINE' : enabled ? 'ON' : 'OFF';
    if (note) note.textContent = !state.schema
      ? 'Esegui il setup Supabase per attivare il kill switch.'
      : enabled
        ? 'Hermes risponde su tutti i canali attivi.'
        : 'Hermes è fermo: i messaggi vengono registrati ma non ricevono risposta.';
  }

  function renderPills() {
    var host = document.getElementById('h-pills');
    if (!host) return;
    host.innerHTML = ['whatsapp', 'instagram', 'tiktok'].map(function (channel) {
      var row = hChannelRow(channel);
      var configured = hConfigured(channel);
      var on = row.enabled && configured !== false;
      var stateLabel = row.enabled ? (configured === false ? 'Da collegare' : 'ON') : 'OFF';
      return '<span class="hermes-pill ' + (on ? 'on' : '') + '"><span class="dot"></span>' +
        hEsc(hChannelLabel(channel)) + ' · ' + stateLabel + '</span>';
    }).join('');
  }

  function renderStats() {
    var conv = document.getElementById('h-stat-conv');
    var unanswered = document.getElementById('h-stat-unanswered');
    var docs = document.getElementById('h-stat-docs');
    var messages = document.getElementById('h-stat-msgs');
    if (conv) conv.textContent = state.conversations.length;
    if (unanswered) unanswered.textContent = state.unanswered.length;
    if (docs) docs.textContent = state.docs.length;
    if (messages) messages.textContent = state.messagesToday;
    var docCount = document.getElementById('h-doc-count');
    if (docCount) docCount.textContent = state.docs.length;
    var unansweredCount = document.getElementById('h-unanswered-count');
    if (unansweredCount) unansweredCount.textContent = state.unanswered.length;
    var ruleCount = document.getElementById('h-rule-count');
    if (ruleCount) ruleCount.textContent = state.rules.length;
    var convCount = document.getElementById('h-conv-count');
    if (convCount) convCount.textContent = state.conversations.length;
    var overviewConv = document.getElementById('h-overview-conv-count');
    if (overviewConv) overviewConv.textContent = state.conversations.length;
    var overviewUnanswered = document.getElementById('h-overview-unanswered-count');
    if (overviewUnanswered) overviewUnanswered.textContent = state.unanswered.length;
  }

  function renderSchemaBanner() {
    var host = document.getElementById('h-schema-banner');
    if (!host) return;
    if (state.schema) {
      host.classList.remove('show');
      host.innerHTML = '';
      return;
    }
    host.classList.add('show');
    host.innerHTML = '<strong>Setup Supabase richiesto.</strong> Le tabelle Hermes non sono ancora presenti nel database. Apri Supabase → SQL Editor, incolla il contenuto di <code>supabase/hermes.sql</code> (oppure <code>supabase/schema.sql</code>) e premi Run. Poi torna qui e ricontrolla. Senza schema il kill switch, il training, le chat e le regole non possono essere salvati.' +
      '<div class="h-actions"><button class="h-btn primary" onclick="WDHermes.reload()">Ricontrolla</button><button class="h-btn" onclick="WDHermes.copy(\'supabase/hermes.sql\')">Copia percorso</button><a class="h-btn" href="https://github.com/woodreads-hash/sito/blob/main/supabase/hermes.sql" target="_blank" rel="noopener">Apri SQL su GitHub</a></div>';
  }

  function renderOverviewChannels() {
    var host = document.getElementById('h-overview-channels');
    if (!host) return;
    var enabledCount = 0;
    host.innerHTML = ['whatsapp', 'instagram', 'tiktok'].map(function (channel) {
      var row = hChannelRow(channel);
      var configured = hConfigured(channel);
      if (row.enabled) enabledCount++;
      var status = configured === true ? 'Credenziali OK' : configured === false ? 'Da collegare' : 'Stato non verificato';
      return '<div class="h-list-item">' +
        '<div class="h-list-main"><div class="h-list-title">' + hChannelIcon(channel) + ' ' + hEsc(hChannelLabel(channel)) + ' ' + hTag(row.enabled ? 'green' : 'red', row.enabled ? 'Attivo' : 'Spento') + '</div>' +
        '<div class="h-list-sub">' + hEsc(row.display_name || 'Profilo non configurato') + ' · ' + hEsc(status) + '</div></div>' +
        '<div class="h-list-actions"><button class="h-btn small" onclick="WDHermes.toggleChannel(\'' + channel + '\',' + (row.enabled ? 'false' : 'true') + ')">' + (row.enabled ? 'Spegni' : 'Accendi') + '</button></div></div>';
    }).join('');
    var count = document.getElementById('h-channel-count');
    if (count) count.textContent = enabledCount + '/3';
  }

  function renderOverviewRecent() {
    var host = document.getElementById('h-overview-conversations');
    if (!host) return;
    if (!state.conversations.length) {
      host.innerHTML = '<div class="h-empty">Nessuna conversazione ancora. Quando arriva un messaggio da un canale collegato, comparirà qui in tempo reale.</div>';
      return;
    }
    host.innerHTML = state.conversations.slice(0, 5).map(function (row) {
      return '<div class="h-list-item" style="cursor:pointer;" onclick="WDHermes.openConversation(\'' + hEsc(row.id) + '\')">' +
        '<div class="h-list-main"><div class="h-list-title">' + hEsc(row.contact_name || row.contact_id) + ' ' + hTag(hChannelClass(row.channel), hChannelLabel(row.channel)) + '</div>' +
        '<div class="h-list-sub">' + hEsc(row.last_message_preview || 'Nessun messaggio') + '</div></div>' +
        '<div class="h-list-actions"><span class="h-conv-time">' + hAgo(row.last_message_at) + '</span></div></div>';
    }).join('');
  }

  function renderOverviewUnanswered() {
    var host = document.getElementById('h-overview-unanswered');
    if (!host) return;
    if (!state.unanswered.length) {
      host.innerHTML = '<div class="h-empty">Nessuna domanda in sospeso. Hermes sta gestendo tutto con la knowledge base attuale.</div>';
      return;
    }
    host.innerHTML = state.unanswered.slice(0, 5).map(function (row) {
      return '<div class="h-list-item"><div class="h-list-main"><div class="h-list-title">' + hEsc(row.question || 'Domanda senza testo') + '</div>' +
        '<div class="h-list-sub">' + hEsc(row.reason || 'Da chiarire') + ' · ' + hAgo(row.created_at) + '</div></div>' +
        '<div class="h-list-actions"><button class="h-btn small primary" onclick="WDHermes.openAnswer(\'' + hEsc(row.id) + '\')">Rispondi</button></div></div>';
    }).join('');
  }

  function renderDocs() {
    var host = document.getElementById('h-docs');
    if (!host) return;
    if (!state.docs.length) {
      host.innerHTML = '<div class="h-empty">Nessun documento ancora. Carica un file, incolla testo o importa le FAQ per creare la memoria di Hermes.</div>';
      return;
    }
    host.innerHTML = state.docs.map(function (row) {
      return '<div class="h-doc"><div class="h-doc-top"><div><div class="h-doc-title">' + hEsc(row.title || 'Senza titolo') + '</div>' +
        '<div class="h-doc-meta">' + hEsc(row.source_type || 'text') + ' · ' + Number(row.char_count || 0).toLocaleString('it-IT') + ' caratteri · ' + hAgo(row.created_at) + '</div></div>' +
        '<div class="h-list-actions"><button class="h-btn small danger" onclick="WDHermes.deleteDoc(\'' + hEsc(row.id) + '\')">Elimina</button></div></div></div>';
    }).join('');
  }

  function renderUnanswered() {
    var host = document.getElementById('h-unanswered');
    if (!host) return;
    if (!state.unanswered.length) {
      host.innerHTML = '<div class="h-empty">Nessuna domanda in sospeso. Le domande su cui Hermes è incerto compariranno qui con il contesto della chat.</div>';
      return;
    }
    host.innerHTML = state.unanswered.map(function (row) {
      return '<div class="h-list-item"><div class="h-list-main"><div class="h-list-title">' + hEsc(row.question || 'Domanda senza testo') + ' ' + hTag(hChannelClass(row.channel), hChannelLabel(row.channel)) + '</div>' +
        '<div class="h-list-sub">' + hEsc(row.reason || 'Da chiarire') + ' · ' + hAgo(row.created_at) + '</div></div>' +
        '<div class="h-list-actions"><button class="h-btn small primary" onclick="WDHermes.openAnswer(\'' + hEsc(row.id) + '\')">Rispondi</button>' +
        (row.conversation_id ? '<button class="h-btn small" onclick="WDHermes.openConversation(\'' + hEsc(row.conversation_id) + '\')">Apri chat</button>' : '') +
        '</div></div>';
    }).join('');
  }

  function renderConversations() {
    var host = document.getElementById('h-conv-list');
    if (!host) return;
    document.querySelectorAll('[data-hfilter]').forEach(function (button) {
      button.classList.toggle('primary', button.getAttribute('data-hfilter') === state.channelFilter);
    });
    var search = state.search.trim().toLowerCase();
    var rows = state.conversations.filter(function (row) {
      if (state.channelFilter !== 'all' && row.channel !== state.channelFilter) return false;
      if (!search) return true;
      return String(row.contact_name || '').toLowerCase().indexOf(search) >= 0 ||
        String(row.contact_id || '').toLowerCase().indexOf(search) >= 0 ||
        String(row.last_message_preview || '').toLowerCase().indexOf(search) >= 0;
    });
    if (!rows.length) {
      host.innerHTML = '<div class="h-empty">Nessuna conversazione con questo filtro.</div>';
      return;
    }
    host.innerHTML = rows.map(function (row) {
      var active = state.activeConversation && state.activeConversation.id === row.id;
      return '<div class="h-conv ' + (active ? 'active' : '') + '" onclick="WDHermes.openConversation(\'' + hEsc(row.id) + '\')">' +
        '<div class="h-conv-top"><div class="h-conv-name">' + hEsc(row.contact_name || row.contact_id) + '</div><div class="h-conv-time">' + hAgo(row.last_message_at) + '</div></div>' +
        '<div class="h-conv-preview">' + hEsc(row.last_message_preview || 'Nessun messaggio') + '</div>' +
        '<div class="h-conv-meta">' + hTag(hChannelClass(row.channel), hChannelLabel(row.channel)) +
        (row.needs_attention ? hTag('gold', 'Da correggere') : '') +
        (Number(row.unread_count || 0) > 0 ? '<span class="h-unread">' + Number(row.unread_count) + '</span>' : '') +
        '</div></div>';
    }).join('');
  }

  function renderChatHead() {
    var host = document.getElementById('h-chat-head');
    if (!host) return;
    if (!state.activeConversation) {
      host.innerHTML = '<div class="h-empty" style="padding:.2rem;">Seleziona una conversazione per aprire la cronologia completa.</div>';
      return;
    }
    var row = state.activeConversation;
    host.innerHTML = '<div class="h-chat-who"><div class="h-avatar">' + hEsc(hInitial(row.contact_name, row.contact_id)) + '</div>' +
      '<div><div class="h-chat-name">' + hEsc(row.contact_name || row.contact_id) + '</div><div class="h-chat-sub">' + hEsc(hChannelLabel(row.channel)) + ' · ' + hEsc(row.contact_id) + '</div></div></div>' +
      '<div class="h-btn-row">' + hTag(row.needs_attention ? 'gold' : 'green', row.needs_attention ? 'Da correggere' : 'In ordine') +
      (row.needs_attention ? '<button class="h-btn small" onclick="WDHermes.markResolved()">Segna risolto</button>' : '') +
      '<button class="h-btn small" onclick="WDHermes.refreshLive(true)">Ricarica</button></div>';
  }

  function renderMessages() {
    var host = document.getElementById('h-messages');
    if (!host) return;
    if (!state.activeConversation) {
      host.innerHTML = '<div class="h-empty-big"><b>Nessuna chat selezionata</b>Scegli una conversazione a sinistra per vedere la cronologia completa.</div>';
      return;
    }
    if (!state.messages.length) {
      host.innerHTML = '<div class="h-empty">Nessun messaggio in questa conversazione.</div>';
      return;
    }
    var lastDay = '';
    var html = state.messages.map(function (message) {
      var day = hDate(message.created_at, { weekday: 'long', day: 'numeric', month: 'long' });
      var dayHtml = day !== lastDay ? '<div class="h-day">' + hEsc(day) + '</div>' : '';
      lastDay = day;
      var out = message.direction === 'outbound';
      var error = message.metadata && message.metadata.error;
      var meta = '<div class="h-bubble-meta"><span>' + hDate(message.created_at, { hour: '2-digit', minute: '2-digit' }) + '</span>' +
        hTag(hChannelClass(message.channel), hChannelLabel(message.channel)) +
        (message.corrected ? hTag('cyan', 'Corretto') : '') +
        (error ? hTag('red', 'Errore invio') : '') +
        '</div>';
      return dayHtml + '<div class="h-bubble ' + (out ? 'out' : '') + ' ' + (error ? 'err' : '') + '">' + hEsc(message.body || '[messaggio]') + meta +
        '<div class="h-bubble-actions"><button onclick="WDHermes.selectMessage(\'' + hEsc(message.id) + '\')">Correggi</button></div></div>';
    }).join('');
    var atBottom = host.scrollHeight - host.scrollTop - host.clientHeight < 80;
    host.innerHTML = html;
    if (atBottom) host.scrollTop = host.scrollHeight;
  }

  function renderCorrection() {
    var hint = document.getElementById('h-correct-hint');
    if (!hint) return;
    if (state.selectedMessage && !state.messages.some(function (row) { return row.id === state.selectedMessage.id; })) {
      state.selectedMessage = null;
    }
    if (!state.selectedMessage) {
      hint.textContent = 'Seleziona un messaggio e scrivi la risposta corretta. La correzione viene salvata e usata come esempio per le risposte future.';
      return;
    }
    var direction = state.selectedMessage.direction === 'outbound' ? 'Risposta di Hermes' : 'Messaggio del cliente';
    hint.textContent = direction + ': “' + String(state.selectedMessage.body || '').slice(0, 220) + '”';
  }

  function renderRules() {
    var host = document.getElementById('h-rules');
    if (!host) return;
    if (!state.rules.length) {
      host.innerHTML = '<div class="h-empty">Nessuna regola personalizzata. Il numero studio è già bloccato dal setup iniziale.</div>';
      return;
    }
    host.innerHTML = state.rules.map(function (row) {
      return '<div class="h-rule"><div>' + hTag(hChannelClass(row.channel), hChannelLabel(row.channel)) + '</div>' +
        '<div><div class="h-rule-contact">' + hEsc(row.contact) + '</div><div class="h-rule-note">' + hEsc(row.note || '') + '</div></div>' +
        '<div>' + hTag(row.mode === 'block' ? 'red' : 'green', row.mode === 'block' ? 'Blocca' : 'Consenti') + '</div>' +
        '<div class="h-btn-row"><button class="h-btn small danger" onclick="WDHermes.deleteRule(\'' + hEsc(row.id) + '\')">Rimuovi</button></div></div>';
    }).join('');
  }

  function channelEnv(channel) {
    var values = channel === 'whatsapp'
      ? ['WHATSAPP_TOKEN', 'WHATSAPP_PHONE_NUMBER_ID', 'HERMES_VERIFY_TOKEN', 'META_APP_SECRET']
      : channel === 'instagram'
        ? ['INSTAGRAM_TOKEN', 'INSTAGRAM_USER_ID', 'HERMES_VERIFY_TOKEN', 'META_APP_SECRET']
        : ['TIKTOK_ACCESS_TOKEN', 'TIKTOK_SEND_URL', 'TIKTOK_BUSINESS_ID', 'TIKTOK_WEBHOOK_SECRET'];
    return '<div class="h-env">' + values.map(function (value) { return '<span>' + value + '</span>'; }).join('') + '</div>';
  }

  function channelGuide(channel) {
    if (channel === 'whatsapp') {
      return '<ol><li>Apri Meta for Developers e crea (o riusa) un’app con il prodotto WhatsApp Business.</li>' +
        '<li>Collega il numero WooDreads e copia il <b>Phone number ID</b>.</li>' +
        '<li>Genera un token permanente e salvalo su Vercel come <b>WHATSAPP_TOKEN</b>; imposta <b>WHATSAPP_PHONE_NUMBER_ID</b>.</li>' +
        '<li>In Meta → WhatsApp → Configuration aggiungi il webhook qui sopra, inserisci lo stesso <b>HERMES_VERIFY_TOKEN</b> e sottoscrivi <b>messages</b>.</li>' +
        '<li>Attiva il canale e invia un messaggio di test da un altro numero. La prima risposta è il benvenuto standard.</li></ol>';
    }
    if (channel === 'instagram') {
      return '<ol><li>Usa un account Instagram Professional collegato a una Pagina Facebook.</li>' +
        '<li>Nell’app Meta abilita <b>Instagram Messaging</b> e collega la Pagina.</li>' +
        '<li>Salva su Vercel <b>INSTAGRAM_TOKEN</b> e <b>INSTAGRAM_USER_ID</b> (ID dell’account IG).</li>' +
        '<li>Aggiungi il webhook qui sopra nelle impostazioni Instagram, verifica il token e sottoscrivi <b>messages</b>.</li>' +
        '<li>Attiva il canale e scrivi da un account esterno per testare la chat live.</li></ol>';
    }
    return '<ol><li>Serve un account TikTok Business e l’accesso alla <b>Direct Message API</b> (approvazione TikTok).</li>' +
      '<li>Salva <b>TIKTOK_ACCESS_TOKEN</b>, <b>TIKTOK_BUSINESS_ID</b> e l’endpoint di invio in <b>TIKTOK_SEND_URL</b>.</li>' +
      '<li>Configura il webhook TikTok con l’URL qui sopra e il segreto <b>TIKTOK_WEBHOOK_SECRET</b>.</li>' +
      '<li>Attiva il canale. Se l’invio non è ancora approvato, Hermes registra i messaggi e li segnala come “Invio fallito”.</li>' +
      '<li>Testa con un messaggio da un account esterno e controlla la chat live.</li></ol>';
  }

  function renderChannels() {
    var host = document.getElementById('h-channels');
    if (!host) return;
    host.innerHTML = ['whatsapp', 'instagram', 'tiktok'].map(function (channel) {
      var row = hChannelRow(channel);
      var configured = hConfigured(channel);
      var webhook = hWebhook(channel);
      var status = configured === true ? hTag('cyan', 'Credenziali OK') : configured === false ? hTag('gold', 'Da collegare') : hTag('', 'Stato non verificato');
      return '<div class="h-card h-channel-card ' + channel + '"><div class="h-card-b">' +
        '<div class="h-channel-top"><div class="h-channel-name"><span class="h-channel-icon">' + hChannelIcon(channel) + '</span><span>' + hEsc(hChannelLabel(channel)) + '</span></div>' +
        '<label class="h-switch"><input type="checkbox" ' + (row.enabled ? 'checked' : '') + ' onchange="WDHermes.toggleChannel(\'' + channel + '\', this.checked)"><span></span></label></div>' +
        '<div class="h-kpi-row">' + hTag(row.enabled ? 'green' : 'red', row.enabled ? 'Attivo' : 'Spento') + status + '</div>' +
        '<label class="h-label" style="margin-top:.9rem;">Nome profilo</label><input id="h-ch-name-' + channel + '" class="h-field" value="' + hEsc(row.display_name || '') + '" placeholder="WooDreads">' +
        '<label class="h-label" style="margin-top:.6rem;">ID esterno / numero</label><input id="h-ch-id-' + channel + '" class="h-field" value="' + hEsc(row.external_id || '') + '" placeholder="Phone number ID o IG user ID">' +
        '<div class="h-actions"><button class="h-btn primary" onclick="WDHermes.saveChannel(\'' + channel + '\')">Salva profilo</button></div>' +
        '<label class="h-label" style="margin-top:.9rem;">Webhook URL</label><div class="h-code"><code>' + hEsc(webhook) + '</code><button class="h-btn small" onclick="WDHermes.copy(\'' + hEsc(webhook) + '\')">Copia</button></div>' +
        channelEnv(channel) +
        '<details class="h-guide"><summary>Guida passo-passo</summary>' + channelGuide(channel) + '</details>' +
        '</div></div>';
    }).join('');
  }

  function renderSettings() {
    if (state.settingsPopulated) return;
    var settings = hSettings();
    var brand = document.getElementById('h-brand-prompt');
    var first = document.getElementById('h-first-message');
    var fallback = document.getElementById('h-fallback-message');
    var model = document.getElementById('h-model');
    if (brand) brand.value = settings.brand_prompt || '';
    if (first) first.value = settings.first_message || '';
    if (fallback) fallback.value = settings.fallback_message || '';
    if (model) model.value = settings.model || 'openrouter/free';
    state.settingsPopulated = true;
  }

  function renderAiStatus() {
    var host = document.getElementById('h-ai-status');
    var badge = document.getElementById('h-ai-state');
    if (!host) return;
    var status = state.status;
    if (!status) {
      if (badge) badge.textContent = 'Non verificato';
      host.innerHTML = '<p class="h-small h-muted">Lo stato del runtime non è disponibile. Verifica che <code>api/hermes.js</code> sia deployato su Vercel.</p><div class="h-actions"><button class="h-btn cyan" onclick="WDHermes.loadStatus()">Riprova</button></div>';
      return;
    }
    var ai = status.aiConfigured ? hTag('green', 'Configurata') : hTag('red', 'Da configurare');
    var verify = status.verifyConfigured ? hTag('green', 'OK') : hTag('gold', 'Da impostare');
    var signature = status.signatureConfigured ? hTag('green', 'Attiva') : hTag('gold', 'Opzionale');
    if (badge) badge.textContent = status.aiConfigured ? 'AI pronta' : 'AI da configurare';
    host.innerHTML = '<div class="h-kpi-row">' + ai + verify + signature + '</div>' +
      '<p class="h-small h-muted" style="margin-top:.7rem;">Modello: <b>' + hEsc(status.aiModel || hSettings().model || '—') + '</b> · Webhook: <b>' + hEsc(status.webhookBase || '—') + '</b></p>' +
      '<p class="h-small h-muted">Per attivare le risposte AI imposta <code>HERMES_AI_API_KEY</code> (o <code>OPENROUTER_API_KEY</code>) e, se vuoi, <code>HERMES_AI_MODEL</code> su Vercel. Senza chiave Hermes usa il fallback e mette le domande nella coda “Da chiarire”.</p>' +
      '<div class="h-actions"><button class="h-btn cyan" onclick="WDHermes.loadStatus()">Verifica configurazione</button></div>';
  }

  function reload() {
    state.settingsPopulated = false;
    return Promise.all([loadAll(), loadStatus()]);
  }

  async function toggleMaster() {
    if (!state.schema) {
      hToast('Esegui prima il setup Supabase (supabase/hermes.sql)', true);
      return;
    }
    var current = hSettings().enabled !== false;
    var next = !current;
    state.settings = Object.assign({}, hSettings(), { enabled: next });
    renderMaster();
    renderPills();
    try {
      await sb('/rest/v1/hermes_settings?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ id: 'global', enabled: next, updated_at: new Date().toISOString() })
      });
      hToast(next ? 'Hermes ON: risposte attive' : 'Hermes OFF: kill switch attivo');
    } catch (error) {
      state.settings.enabled = current;
      renderMaster();
      renderPills();
      hToast('Kill switch non salvato: ' + error.message, true);
    }
  }

  async function saveSettings() {
    var body = {
      id: 'global',
      brand_prompt: (document.getElementById('h-brand-prompt') || {}).value || '',
      first_message: (document.getElementById('h-first-message') || {}).value || '',
      fallback_message: (document.getElementById('h-fallback-message') || {}).value || '',
      model: (document.getElementById('h-model') || {}).value || 'openrouter/free',
      updated_at: new Date().toISOString()
    };
    try {
      await sb('/rest/v1/hermes_settings?on_conflict=id', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify(body)
      });
      state.settings = Object.assign({}, hSettings(), body);
      state.settingsPopulated = false;
      renderSettings();
      renderMaster();
      hToast('Impostazioni Hermes salvate');
    } catch (error) {
      hToast('Impostazioni non salvate: ' + error.message, true);
    }
  }

  async function fetchMessages(id) {
    var all = [];
    var offset = 0;
    while (all.length < 5000) {
      var rows = await sb('/rest/v1/hermes_messages?select=*&conversation_id=eq.' + encodeURIComponent(id) + '&order=created_at.asc&limit=1000&offset=' + offset);
      if (!Array.isArray(rows) || !rows.length) break;
      all = all.concat(rows);
      if (rows.length < 1000) break;
      offset += rows.length;
    }
    return all;
  }

  async function openConversation(id) {
    var row = state.conversations.find(function (item) { return item.id === id; }) || state.activeConversation;
    if (!row) return;
    state.activeConversation = row;
    state.selectedMessage = null;
    var correctionBox = document.getElementById('h-correction');
    if (correctionBox) correctionBox.value = '';
    setPanel('chats');
    if (Number(row.unread_count || 0) > 0) {
      row.unread_count = 0;
      sb('/rest/v1/hermes_conversations?id=eq.' + encodeURIComponent(id), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ unread_count: 0, updated_at: new Date().toISOString() })
      }).catch(function () {});
    }
    try {
      state.messages = await fetchMessages(id);
    } catch (error) {
      state.messages = [];
    }
    renderConversations();
    renderChatHead();
    var messageHost = document.getElementById('h-messages');
    if (messageHost) messageHost.scrollTop = messageHost.scrollHeight;
    renderMessages();
    renderCorrection();
  }

  async function refreshLive(force) {
    if (!state.built) return;
    var tab = document.getElementById('tab-hermes');
    if (!force && (!tab || tab.style.display === 'none' || document.hidden)) return;
    var activeId = state.activeConversation && state.activeConversation.id;
    var today = new Date();
    today.setHours(0, 0, 0, 0);
    var results = await Promise.allSettled([
      sb('/rest/v1/hermes_settings?select=*&id=eq.global&limit=1'),
      sb('/rest/v1/hermes_conversations?select=*&order=last_message_at.desc&limit=80'),
      sb('/rest/v1/hermes_unanswered?select=*&resolved=eq.false&order=created_at.desc&limit=60'),
      sb('/rest/v1/hermes_messages?select=id&created_at=gte.' + encodeURIComponent(today.toISOString()) + '&limit=1000'),
      activeId ? fetchMessages(activeId) : Promise.resolve([])
    ]);
    if (results[0].status === 'fulfilled' && results[0].value && results[0].value[0]) {
      state.settings = results[0].value[0];
    }
    if (results[1].status === 'fulfilled' && Array.isArray(results[1].value)) state.conversations = results[1].value;
    if (results[2].status === 'fulfilled' && Array.isArray(results[2].value)) state.unanswered = results[2].value;
    if (results[3].status === 'fulfilled' && Array.isArray(results[3].value)) state.messagesToday = results[3].value.length;
    if (activeId) {
      state.activeConversation = state.conversations.find(function (row) { return row.id === activeId; }) || null;
    }
    if (!state.activeConversation && state.conversations.length) {
      state.activeConversation = state.conversations[0];
      try {
        state.messages = await fetchMessages(state.activeConversation.id);
      } catch (error) {
        state.messages = [];
      }
    } else if (results[4].status === 'fulfilled' && Array.isArray(results[4].value)) {
      state.messages = results[4].value;
    }
    renderMaster();
    renderPills();
    renderStats();
    renderOverviewChannels();
    renderConversations();
    renderOverviewRecent();
    renderOverviewUnanswered();
    renderUnanswered();
    renderChatHead();
    renderMessages();
    renderCorrection();
  }

  function setLive(on, text) {
    var host = document.getElementById('h-live');
    var label = document.getElementById('h-live-text');
    if (host) host.classList.toggle('on', !!on);
    if (label) label.textContent = text || (on ? 'Live Supabase' : 'Polling');
  }

  function scheduleLive() {
    clearTimeout(state.reloadTimer);
    state.reloadTimer = setTimeout(function () {
      refreshLive(false);
    }, 450);
  }

  function startPolling() {
    if (state.pollTimer) return;
    state.pollTimer = setInterval(function () {
      if (!document.hidden) refreshLive(false);
    }, 10000);
  }

  async function initRealtime() {
    if (state.rtInit) return;
    state.rtInit = true;
    try {
      if (window.supabaseConfigReady) await window.supabaseConfigReady;
    } catch (error) {}
    var lib = window.supabase;
    if (!lib || typeof lib.createClient !== 'function' || !window.SUPABASE_URL || !window.SUPABASE_ANON_KEY) {
      setLive(false, 'Polling 10s');
      startPolling();
      return;
    }
    try {
      var client = lib.createClient(window.SUPABASE_URL, window.SUPABASE_ANON_KEY);
      state.rt = client.channel('hermes-live')
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hermes_conversations' }, scheduleLive)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hermes_messages' }, scheduleLive)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hermes_unanswered' }, scheduleLive)
        .on('postgres_changes', { event: '*', schema: 'public', table: 'hermes_settings' }, scheduleLive)
        .subscribe(function (status) {
          if (status === 'SUBSCRIBED') setLive(true, 'Live Supabase');
          else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
            setLive(false, 'Polling 10s');
            startPolling();
          }
        });
    } catch (error) {
      setLive(false, 'Polling 10s');
      startPolling();
    }
    startPolling();
  }

  function filterConversations(value) {
    state.search = String(value || '');
    renderConversations();
  }

  function setChannelFilter(channel) {
    state.channelFilter = channel || 'all';
    renderConversations();
  }

  function selectMessage(id) {
    var message = state.messages.find(function (row) { return row.id === id; });
    if (!message) return;
    state.selectedMessage = message;
    var textarea = document.getElementById('h-correction');
    if (textarea) textarea.value = '';
    renderCorrection();
    if (textarea) textarea.focus();
  }

  function clearCorrection() {
    state.selectedMessage = null;
    var textarea = document.getElementById('h-correction');
    if (textarea) textarea.value = '';
    renderCorrection();
  }

  async function saveCorrection() {
    if (!state.activeConversation) {
      hToast('Apri prima una conversazione', true);
      return;
    }
    if (!state.selectedMessage) {
      hToast('Seleziona il messaggio da correggere', true);
      return;
    }
    var textarea = document.getElementById('h-correction');
    var correction = textarea ? textarea.value.trim() : '';
    if (!correction) {
      hToast('Scrivi la risposta corretta', true);
      return;
    }
    var message = state.selectedMessage;
    var conversation = state.activeConversation;
    try {
      await sb('/rest/v1/hermes_corrections', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({
          conversation_id: conversation.id,
          message_id: message.id,
          correction: correction,
          admin_note: ''
        })
      });
      await sb('/rest/v1/hermes_messages?id=eq.' + encodeURIComponent(message.id), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ corrected: true })
      });
      await sb('/rest/v1/hermes_conversations?id=eq.' + encodeURIComponent(conversation.id), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ needs_attention: false, updated_at: new Date().toISOString() })
      });
      message.corrected = true;
      conversation.needs_attention = false;
      var question = message.direction === 'inbound' ? message.body : '';
      if (!question) {
        var index = state.messages.indexOf(message);
        for (var i = index - 1; i >= 0; i--) {
          if (state.messages[i].direction === 'inbound') {
            question = state.messages[i].body;
            break;
          }
        }
      }
      if (!question) question = conversation.last_message_preview || '';
      var content = 'Domanda cliente: ' + question + '\nRisposta corretta: ' + correction;
      trainDocument('Correzione — ' + (conversation.contact_name || conversation.contact_id), content, 'correction', { silent: true }).catch(function (error) {
        hToast('Correzione salvata; training non riuscito: ' + error.message, true);
      });
      hToast('Correzione salvata e inviata al training');
      clearCorrection();
      renderMessages();
      renderChatHead();
      renderConversations();
    } catch (error) {
      hToast('Correzione non salvata: ' + error.message, true);
    }
  }

  async function markResolved() {
    if (!state.activeConversation) return;
    try {
      await sb('/rest/v1/hermes_conversations?id=eq.' + encodeURIComponent(state.activeConversation.id), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ needs_attention: false, updated_at: new Date().toISOString() })
      });
      state.activeConversation.needs_attention = false;
      renderChatHead();
      renderConversations();
      hToast('Conversazione segnata come risolta');
    } catch (error) {
      hToast('Stato non aggiornato: ' + error.message, true);
    }
  }

  async function addRule() {
    if (!state.schema) {
      hToast('Esegui prima il setup Supabase (supabase/hermes.sql)', true);
      return;
    }
    var channel = (document.getElementById('h-rule-channel') || {}).value || 'all';
    var rawContact = ((document.getElementById('h-rule-contact') || {}).value || '').trim();
    var mode = (document.getElementById('h-rule-mode') || {}).value || 'block';
    var note = ((document.getElementById('h-rule-note') || {}).value || '').trim();
    if (!rawContact) {
      hToast('Inserisci un contatto o un numero', true);
      return;
    }
    var contact = /^\+?[\d\s().-]+$/.test(rawContact) ? rawContact.replace(/[^\d]/g, '') : rawContact;
    try {
      await sb('/rest/v1/hermes_contact_rules', {
        method: 'POST',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ channel: channel, contact: contact, mode: mode, note: note })
      });
      var rows = await sb('/rest/v1/hermes_contact_rules?select=*&order=created_at.desc');
      state.rules = Array.isArray(rows) ? rows : [];
      renderRules();
      renderStats();
      var input = document.getElementById('h-rule-contact');
      if (input) input.value = '';
      var noteInput = document.getElementById('h-rule-note');
      if (noteInput) noteInput.value = '';
      hToast('Regola aggiunta');
    } catch (error) {
      hToast('Regola non aggiunta: ' + error.message, true);
    }
  }

  async function deleteRule(id) {
    if (!confirm('Rimuovere questa regola?')) return;
    try {
      await sb('/rest/v1/hermes_contact_rules?id=eq.' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' }
      });
      state.rules = state.rules.filter(function (row) { return row.id !== id; });
      renderRules();
      renderStats();
      hToast('Regola rimossa');
    } catch (error) {
      hToast('Regola non rimossa: ' + error.message, true);
    }
  }

  async function toggleChannel(channel, enabled) {
    if (!state.schema) {
      hToast('Esegui prima il setup Supabase (supabase/hermes.sql)', true);
      return;
    }
    var row = hChannelRow(channel);
    var next = !!enabled;
    try {
      await sb('/rest/v1/hermes_channels?on_conflict=channel', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ channel: channel, enabled: next, updated_at: new Date().toISOString() })
      });
      row.enabled = next;
      var found = state.channels.find(function (item) { return item.channel === channel; });
      if (found) found.enabled = next;
      else state.channels.push(row);
      renderChannels();
      renderPills();
      renderOverviewChannels();
      hToast(hChannelLabel(channel) + (next ? ' attivo' : ' spento'));
      if (next && hConfigured(channel) === false) {
        hToast('Canale attivo, ma mancano le credenziali: apri la guida e configura le env Vercel', true);
      }
    } catch (error) {
      hToast('Canale non aggiornato: ' + error.message, true);
      renderChannels();
    }
  }

  async function saveChannel(channel) {
    if (!state.schema) {
      hToast('Esegui prima il setup Supabase (supabase/hermes.sql)', true);
      return;
    }
    var name = ((document.getElementById('h-ch-name-' + channel) || {}).value || '').trim();
    var external = ((document.getElementById('h-ch-id-' + channel) || {}).value || '').trim();
    try {
      await sb('/rest/v1/hermes_channels?on_conflict=channel', {
        method: 'POST',
        headers: { Prefer: 'resolution=merge-duplicates,return=minimal' },
        body: JSON.stringify({ channel: channel, display_name: name, external_id: external, updated_at: new Date().toISOString() })
      });
      var row = hChannelRow(channel);
      row.display_name = name;
      row.external_id = external;
      var found = state.channels.find(function (item) { return item.channel === channel; });
      if (!found) state.channels.push(row);
      renderChannels();
      renderOverviewChannels();
      loadStatus();
      hToast('Profilo ' + hChannelLabel(channel) + ' salvato');
    } catch (error) {
      hToast('Profilo non salvato: ' + error.message, true);
    }
  }

  async function copy(text) {
    try {
      await navigator.clipboard.writeText(text);
      hToast('Copiato negli appunti');
    } catch (error) {
      var area = document.createElement('textarea');
      area.value = text;
      document.body.appendChild(area);
      area.select();
      try { document.execCommand('copy'); hToast('Copiato negli appunti'); }
      catch (err) { hToast('Copia manuale: ' + text, true); }
      document.body.removeChild(area);
    }
  }

  function setProgress(percent, text) {
    var box = document.getElementById('h-train-progress');
    var bar = document.getElementById('h-train-bar');
    var status = document.getElementById('h-train-status');
    if (box) box.classList.add('show');
    if (bar) bar.style.width = Math.max(0, Math.min(100, percent)) + '%';
    if (status) status.textContent = text || '';
  }

  function hideProgress(delay) {
    setTimeout(function () {
      var box = document.getElementById('h-train-progress');
      var bar = document.getElementById('h-train-bar');
      if (box) box.classList.remove('show');
      if (bar) bar.style.width = '0';
    }, delay || 1600);
  }

  function readFileAsText(file) {
    return new Promise(function (resolve, reject) {
      var reader = new FileReader();
      reader.onload = function () { resolve(String(reader.result || '')); };
      reader.onerror = function () { reject(new Error('Lettura file non riuscita')); };
      reader.readAsText(file);
    });
  }

  async function handleTrainFile(files) {
    var file = files && files[0];
    if (!file) return;
    if (!/\.(txt|md|markdown|csv|json|html?)$/i.test(file.name)) {
      var invalidInput = document.getElementById('h-train-file');
      if (invalidInput) invalidInput.value = '';
      hToast('Formato non supportato: usa .txt, .md, .csv, .json o .html', true);
      return;
    }
    if (file.size > 600 * 1024) {
      var largeInput = document.getElementById('h-train-file');
      if (largeInput) largeInput.value = '';
      hToast('File troppo grande: massimo 600 KB', true);
      return;
    }
    try {
      var text = await readFileAsText(file);
      var titleInput = document.getElementById('h-train-title');
      var textarea = document.getElementById('h-train-text');
      if (titleInput && !titleInput.value.trim()) titleInput.value = file.name.replace(/\.[^.]+$/, '');
      if (textarea) textarea.value = text;
      await trainDocument(titleInput && titleInput.value.trim() ? titleInput.value.trim() : file.name, text, 'file');
      var input = document.getElementById('h-train-file');
      if (input) input.value = '';
    } catch (error) {
      var failedInput = document.getElementById('h-train-file');
      if (failedInput) failedInput.value = '';
      hToast('Training file non riuscito: ' + error.message, true);
    }
  }

  async function trainText() {
    var title = ((document.getElementById('h-train-title') || {}).value || '').trim();
    var text = ((document.getElementById('h-train-text') || {}).value || '').trim();
    if (!text) {
      hToast('Incolla del testo da addestrare', true);
      return;
    }
    if (!title) title = 'Knowledge ' + new Date().toLocaleDateString('it-IT');
    try {
      await trainDocument(title, text, 'text');
    } catch (error) {
      hToast('Training non riuscito: ' + error.message, true);
    }
  }

  async function trainDocument(title, content, sourceType, options) {
    var opts = options || {};
    if (!state.schema) throw new Error('Esegui prima il setup Supabase (supabase/hermes.sql)');
    if (!window.WDHermesEmbed) throw new Error('Embedding locale non disponibile');
    if (!String(content || '').trim()) throw new Error('Contenuto vuoto');
    var ownLock = !opts.silent;
    if (ownLock && state.training) throw new Error('Training già in corso');
    if (ownLock) state.training = true;
    var docId = null;
    try {
      var chunks = window.WDHermesEmbed.chunkText(content, 1200, 120);
      if (!chunks.length) throw new Error('Nessun chunk creato');
      if (chunks.length > 250) {
        chunks = chunks.slice(0, 250);
        if (!opts.silent) hToast('Documento molto lungo: addestrati i primi 250 chunk', true);
      }
      if (!opts.silent) setProgress(6, 'Creo il documento…');
      var created = await sb('/rest/v1/hermes_training_documents?select=*', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          title: title || 'Senza titolo',
          source_type: sourceType || 'text',
          content: content,
          char_count: content.length,
          status: 'ready'
        })
      });
      var document = created && created[0];
      if (!document || !document.id) throw new Error('Documento non creato');
      docId = document.id;
      for (var i = 0; i < chunks.length; i += 25) {
        var batch = chunks.slice(i, i + 25).map(function (chunk) {
          return {
            document_id: docId,
            content: chunk,
            embedding: window.WDHermesEmbed.embed(chunk),
            metadata: { source: sourceType || 'text' }
          };
        });
        await sb('/rest/v1/hermes_training_chunks', {
          method: 'POST',
          headers: { Prefer: 'return=minimal' },
          body: JSON.stringify(batch)
        });
        if (!opts.silent) {
          var done = Math.min(chunks.length, i + batch.length);
          setProgress(10 + Math.round((done / chunks.length) * 85), 'Indicizzo ' + done + '/' + chunks.length + ' chunk…');
        }
      }
      if (!opts.silent) {
        setProgress(100, 'Completato: ' + chunks.length + ' chunk in memoria');
        hToast('Hermes ha imparato: ' + chunks.length + ' chunk');
        hideProgress(1800);
        var titleInput = document.getElementById('h-train-title');
        var textarea = document.getElementById('h-train-text');
        if (titleInput) titleInput.value = '';
        if (textarea) textarea.value = '';
      }
      var docs = await sb('/rest/v1/hermes_training_documents?select=*&order=created_at.desc&limit=60');
      state.docs = Array.isArray(docs) ? docs : [];
      renderDocs();
      renderStats();
      return document;
    } catch (error) {
      if (docId) {
        sb('/rest/v1/hermes_training_documents?id=eq.' + encodeURIComponent(docId), {
          method: 'DELETE',
          headers: { Prefer: 'return=minimal' }
        }).catch(function () {});
      }
      if (!opts.silent) {
        setProgress(0, 'Errore: ' + error.message);
        hideProgress(2600);
      }
      throw error;
    } finally {
      if (ownLock) state.training = false;
    }
  }

  async function importFaqs() {
    if (typeof window.supabaseGetFaqs !== 'function') {
      hToast('FAQ Supabase non disponibili', true);
      return;
    }
    try {
      var faqs = await window.supabaseGetFaqs();
      var published = (faqs || []).filter(function (row) { return row && row.published !== false; });
      if (!published.length) {
        hToast('Nessuna FAQ pubblicata da importare', true);
        return;
      }
      var content = published.map(function (row) {
        return 'DOMANDA: ' + (row.question || '') + '\nRISPOSTA: ' + (row.answer || '');
      }).join('\n\n---\n\n');
      await trainDocument('FAQ WooDreads — ' + new Date().toLocaleDateString('it-IT'), content, 'faq');
    } catch (error) {
      hToast('Import FAQ non riuscito: ' + error.message, true);
    }
  }

  async function deleteDoc(id) {
    if (!confirm('Eliminare questo documento e tutti i suoi chunk?')) return;
    try {
      await sb('/rest/v1/hermes_training_documents?id=eq.' + encodeURIComponent(id), {
        method: 'DELETE',
        headers: { Prefer: 'return=minimal' }
      });
      state.docs = state.docs.filter(function (row) { return row.id !== id; });
      renderDocs();
      renderStats();
      hToast('Documento eliminato');
    } catch (error) {
      hToast('Documento non eliminato: ' + error.message, true);
    }
  }

  function openAnswer(id) {
    var row = state.unanswered.find(function (item) { return item.id === id; });
    if (!row) return;
    state.answerId = id;
    var question = document.getElementById('h-answer-question');
    var text = document.getElementById('h-answer-text');
    if (question) question.textContent = row.question || 'Domanda senza testo';
    if (text) text.value = '';
    var modal = document.getElementById('h-answer-modal');
    if (modal) modal.classList.add('open');
  }

  function closeAnswerModal() {
    state.answerId = null;
    var modal = document.getElementById('h-answer-modal');
    if (modal) modal.classList.remove('open');
  }

  async function saveAnswer() {
    if (!state.answerId) return;
    var textarea = document.getElementById('h-answer-text');
    var answer = textarea ? textarea.value.trim() : '';
    if (!answer) {
      hToast('Scrivi la risposta', true);
      return;
    }
    var row = state.unanswered.find(function (item) { return item.id === state.answerId; });
    try {
      await sb('/rest/v1/hermes_unanswered?id=eq.' + encodeURIComponent(state.answerId), {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ resolved: true, answer: answer, resolved_at: new Date().toISOString() })
      });
      if (row) {
        trainDocument('Risposta — ' + (row.question || 'domanda'), 'Domanda cliente: ' + (row.question || '') + '\nRisposta corretta: ' + answer, 'answer', { silent: true }).catch(function (error) {
          hToast('Risposta salvata; training non riuscito: ' + error.message, true);
        });
      }
      state.unanswered = state.unanswered.filter(function (item) { return item.id !== state.answerId; });
      closeAnswerModal();
      renderUnanswered();
      renderOverviewUnanswered();
      renderStats();
      hToast('Risposta salvata e aggiunta al training');
    } catch (error) {
      hToast('Risposta non salvata: ' + error.message, true);
    }
  }

  window.WDHermes = {
    show: show,
    init: show,
    setPanel: setPanel,
    reload: reload,
    toggleMaster: toggleMaster,
    saveSettings: saveSettings,
    loadStatus: loadStatus,
    toggleChannel: toggleChannel,
    saveChannel: saveChannel,
    copy: copy,
    trainText: trainText,
    handleTrainFile: handleTrainFile,
    importFaqs: importFaqs,
    deleteDoc: deleteDoc,
    openConversation: openConversation,
    filterConversations: filterConversations,
    setChannelFilter: setChannelFilter,
    refreshLive: refreshLive,
    selectMessage: selectMessage,
    saveCorrection: saveCorrection,
    clearCorrection: clearCorrection,
    markResolved: markResolved,
    addRule: addRule,
    deleteRule: deleteRule,
    openAnswer: openAnswer,
    closeAnswerModal: closeAnswerModal,
    saveAnswer: saveAnswer
  };
})();
