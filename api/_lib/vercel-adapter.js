function normalizeQuery(query) {
  const out = {};
  if (!query || typeof query !== 'object') return out;
  Object.keys(query).forEach((key) => {
    const value = query[key];
    out[key] = Array.isArray(value) ? value[0] : value;
  });
  return out;
}

function serializeBody(req) {
  let body;
  try {
    body = req.body;
  } catch (err) {
    body = null;
  }
  if (body === undefined || body === null) return null;
  if (typeof body === 'string') return body;
  if (Buffer.isBuffer(body)) return body.toString('utf8');
  try {
    return JSON.stringify(body);
  } catch (err) {
    return null;
  }
}

function buildEvent(req, path) {
  return {
    httpMethod: req.method,
    path: path,
    queryStringParameters: normalizeQuery(req.query),
    body: serializeBody(req),
    headers: req.headers || {},
  };
}

function sendResult(res, result) {
  const statusCode = (result && result.statusCode) || 200;
  const headers = (result && result.headers) || {};
  res.status(statusCode);
  Object.keys(headers).forEach((key) => {
    const value = headers[key];
    if (value !== undefined && value !== null) res.setHeader(key, value);
  });
  if (!Object.keys(headers).some((key) => key.toLowerCase() === 'cache-control')) {
    res.setHeader('Cache-Control', 'no-store');
  }
  const body = result && result.body !== undefined && result.body !== null ? result.body : '';
  res.send(body);
}

function adapt(netlifyHandler, path) {
  return async function vercelHandler(req, res) {
    try {
      const resolvedPath = typeof path === 'function' ? path(req) : path;
      const result = await netlifyHandler(buildEvent(req, resolvedPath));
      sendResult(res, result);
    } catch (err) {
      if (!res.headersSent) {
        res.status(500);
        res.setHeader('Content-Type', 'application/json');
        res.send(JSON.stringify({ error: (err && err.message) || 'Internal error' }));
      }
    }
  };
}

module.exports = adapt;
module.exports.adapt = adapt;
module.exports.normalizeQuery = normalizeQuery;
module.exports.serializeBody = serializeBody;
module.exports.buildEvent = buildEvent;
module.exports.sendResult = sendResult;
