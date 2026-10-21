// Netlify Function — YouTube stats via official Data API
const YOUTUBE_API_KEY = process.env.YOUTUBE_API_KEY || '';
const YOUTUBE_HANDLE = process.env.YOUTUBE_HANDLE || '@woodreads';
const YOUTUBE_CHANNEL_ID = process.env.YOUTUBE_CHANNEL_ID || '';

exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers };

  if (!YOUTUBE_API_KEY) {
    return { statusCode: 200, headers, body: JSON.stringify({ error: 'Missing YOUTUBE_API_KEY' }) };
  }

  try {
    let url = '';
    if (YOUTUBE_CHANNEL_ID) {
      url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&id=${encodeURIComponent(YOUTUBE_CHANNEL_ID)}&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;
    } else {
      url = `https://www.googleapis.com/youtube/v3/channels?part=statistics&forHandle=${encodeURIComponent(YOUTUBE_HANDLE)}&key=${encodeURIComponent(YOUTUBE_API_KEY)}`;
    }

    const resp = await fetch(url);
    if (!resp.ok) {
      return { statusCode: resp.status, headers, body: JSON.stringify({ error: 'YouTube API error' }) };
    }

    const data = await resp.json();
    const stats = data.items && data.items[0] ? data.items[0].statistics : null;
    if (!stats) {
      return { statusCode: 200, headers, body: JSON.stringify({ error: 'Channel not found' }) };
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        data: {
          attributes: {
            youtubeSubscribers: Number(stats.subscriberCount || 0),
            youtubeViews: Number(stats.viewCount || 0),
            youtubeVideos: Number(stats.videoCount || 0),
          },
        },
      }),
    };
  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
