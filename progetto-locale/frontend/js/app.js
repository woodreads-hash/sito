// Configurazione URL Base del backend locale
const API_BASE_URL = 'http://localhost:1337/api';

// --- SCRIPT 1: FETCH E RENDERING PHOTO SHOWROOM ---
async function renderPhotoShowroom() {
  try {
    // Richiediamo la collezione inserendo '?populate=*' per ottenere i file media (immagini)
    const response = await fetch(`${API_BASE_URL}/photo-showrooms?populate=*`);
    if (!response.ok) throw new Error('Errore nel recupero dei dati del showroom');
    
    const { data } = await response.json();
    const container = document.getElementById('showroom-container');
    if (!container) return;
    
    container.innerHTML = ''; // Resetta il vecchio HTML statico

    data.forEach(item => {
      const attrs = item.attributes;
      // Strapi memorizza l'URL relativo del file multimediale
      const imgUrl = `http://localhost:1337${attrs.Media.data.attributes.url}`;

      container.innerHTML += `
        <div class="gallery-card">
          <img src="${imgUrl}" alt="${attrs.Title}">
          <h3>${attrs.Title}</h3>
          <p>${attrs.Description || ''}</p>
        </div>
      `;
    });
  } catch (error) {
    console.error('Showroom Error:', error);
  }
}

// --- SCRIPT 2: INVIO PRENOTAZIONE APPUNTAMENTO (POST) ---
async function inviaAppuntamento(event) {
  event.preventDefault(); // Blocca il refresh del browser

  const nome = document.getElementById('input-nome').value;
  const email = document.getElementById('input-email').value;
  const dataOra = document.getElementById('input-data').value;
  const note = document.getElementById('input-note').value;

  // Struttura JSON richiesta obbligatoriamente da Strapi
  const payload = {
    data: {
      ClientName: nome,
      ClientEmail: email,
      AppointmentDate: dataOra,
      Notes: note,
      Status: 'Pending' // Forzato come "In attesa" per l'approvazione dell'Admin
    }
  };

  try {
    const response = await fetch(`${API_BASE_URL}/appointments`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (response.ok) {
      alert('Richiesta inviata! L\'amministratore verificherà la disponibilità.');
      document.getElementById('form-appuntamento').reset();
    } else {
      throw new Error('Impossibile salvare l\'appuntamento.');
    }
  } catch (error) {
    console.error('Booking Error:', error);
    alert('Errore durante la prenotazione. Riprova più tardi.');
  }
}

// --- SCRIPT 3: FETCH DELLE STATISTICHE SOCIAL ---
async function caricaStatisticheSocial() {
  try {
    // Trattandosi di un Single Type, la risposta non conterrà un array ma un oggetto singolo
    const response = await fetch(`${API_BASE_URL}/social-statistic`);
    if (!response.ok) throw new Error('Errore nel recupero delle statistiche');
    
    const { data } = await response.json();
    if (!data) return;

    const attrs = data.attributes;
    
    // Iniezione dei dati numerici nei tag HTML dedicati
    if(document.getElementById('stat-instagram')) {
        document.getElementById('stat-instagram').innerText = attrs.InstagramFollowers.toLocaleString();
    }
    if(document.getElementById('stat-youtube')) {
        document.getElementById('stat-youtube').innerText = attrs.YouTubeSubscribers.toLocaleString();
    }
    if(document.getElementById('stat-tiktok')) {
        document.getElementById('stat-tiktok').innerText = attrs.TikTokFollowers.toLocaleString();
    }
  } catch (error) {
    console.error('Stats Error:', error);
  }
}

// Inizializzazione al caricamento della pagina HTML
document.addEventListener('DOMContentLoaded', () => {
  renderPhotoShowroom();
  caricaStatisticheSocial();

  const formBooking = document.getElementById('form-appuntamento');
  if (formBooking) {
    formBooking.addEventListener('submit', inviaAppuntamento);
  }
});
