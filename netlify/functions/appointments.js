// Netlify Function — Appointment booking proxy
const STRAPI_URL = process.env.STRAPI_URL || 'http://localhost:1337';

function cors(headers) {
  return { ...headers,
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers: cors({}) };

  const path = event.path.replace(/^\/\.netlify\/functions\/appointments\/?/, '');
  const method = event.httpMethod;
  const body = event.body ? JSON.parse(event.body) : null;

  try {
    if (path === 'slots') {
      // GET /slots?date=2026-01-15
      const date = event.queryStringParameters?.date;
      if (!date) return { statusCode: 400, headers: cors({}), body: JSON.stringify({ error: 'date required' }) };

      const dayName = ['sunday','monday','tuesday','wednesday','thursday','friday','saturday'][new Date(date).getDay()];

      // Fetch working hours
      const whRes = await fetch(`${STRAPI_URL}/api/working-hour?populate=*`);
      const wh = await whRes.json();
      const whData = wh.data?.attributes || {};
      const schedules = whData.schedules || [];
      const duration = whData.appointmentDuration || 120;
      const daySchedule = schedules.find(s => s.day === dayName);
      if (!daySchedule || !daySchedule.enabled) {
        return { statusCode: 200, headers: cors({}), body: JSON.stringify({ slots: [] }) };
      }

      // Fetch existing appointments for this date
      const apptRes = await fetch(
        `${STRAPI_URL}/api/appointments?filters[date][$eq]=${date}&filters[status][$ne]=rejected&pagination[pageSize]=100`
      );
      const appts = await apptRes.json();
      const bookedTimes = new Set(
        (appts.data || []).map(a => a.attributes?.time)
      );

      // Generate slots
      const slots = [];
      const [startH, startM] = (daySchedule.startTime || '09:00').split(':').map(Number);
      const [endH, endM] = (daySchedule.endTime || '18:00').split(':').map(Number);
      const [breakS, breakE] = [
        (daySchedule.breakStart || '').split(':').map(Number),
        (daySchedule.breakEnd || '').split(':').map(Number),
      ];
      let current = startH * 60 + startM;
      const end = endH * 60 + endM;
      const breakStart = breakS.length === 2 ? breakS[0] * 60 + breakS[1] : null;
      const breakEnd = breakE.length === 2 ? breakE[0] * 60 + breakE[1] : null;

      while (current + duration <= end) {
        const isBreak = breakStart !== null && current >= breakStart && current < breakEnd;
        if (!isBreak) {
          const h = Math.floor(current / 60);
          const m = current % 60;
          const time = `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
          if (!bookedTimes.has(time)) {
            slots.push(time);
          }
        }
        current += duration;
      }

      return { statusCode: 200, headers: cors({}), body: JSON.stringify({ date, dayName, slots }) };
    }

    if (path === '' && method === 'POST') {
      // POST / — create appointment
      const resp = await fetch(`${STRAPI_URL}/api/appointments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data: body }),
      });
      const data = await resp.json();
      return { statusCode: resp.status, headers: cors({}), body: JSON.stringify(data) };
    }

    return { statusCode: 404, headers: cors({}), body: JSON.stringify({ error: 'Not found' }) };
  } catch (err) {
    return { statusCode: 500, headers: cors({}), body: JSON.stringify({ error: err.message }) };
  }
};
