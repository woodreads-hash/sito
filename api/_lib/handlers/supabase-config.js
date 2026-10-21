// Netlify Function — Configurazione Supabase per il browser
//
// In un sito statico le variabili NEXT_PUBLIC_* non vengono iniettate
// automaticamente nel browser (prefisso valido solo per Next.js): questa
// funzione le legge dall'ambiente e le restituisce al client, che le usa per
// configurare Supabase al posto dei valori scritti a mano.
const DEFAULT_URL = 'https://yqksdpgkktgppxzdbbgc.supabase.co';
const DEFAULT_KEY = 'sb_publishable_2wVMVjaEp492prSm71Uz4Q_LwrBv4CC';

function cors(headers) {
  return {
    ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
    'Cache-Control': 'no-store',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors({}) };

  const url = String(process.env.NEXT_PUBLIC_SUPABASE_URL || DEFAULT_URL).trim() || DEFAULT_URL;
  const anonKey =
    String(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || DEFAULT_KEY).trim() || DEFAULT_KEY;

  return {
    statusCode: 200,
    headers: cors({}),
    body: JSON.stringify({ url, anonKey }),
  };
};
