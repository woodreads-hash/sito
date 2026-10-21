const http = require('http');
const fs = require('fs');
const path = require('path');

const ROOT = process.cwd();
const PORT = Number(process.env.PORT || 3000);

// Carica .env (stesso comportamento di "vercel dev") per le variabili d'ambiente
try {
  if (typeof process.loadEnvFile === 'function') {
    process.loadEnvFile(path.join(ROOT, '.env'));
  }
} catch (err) {
  // .env assente: si usano i valori di fallback
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.mjs': 'application/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.avif': 'image/avif',
  '.ico': 'image/x-icon',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.ttf': 'font/ttf',
  '.txt': 'text/plain; charset=utf-8',
  '.xml': 'application/xml',
  '.webmanifest': 'application/manifest+json',
  '.mp4': 'video/mp4',
};

const FUNCTION_PREFIXES = ['/.netlify/functions', '/api'];

function sendFile(res, file, statusCode) {
  const ext = path.extname(file).toLowerCase();
  const stat = fs.statSync(file);
  res.writeHead(statusCode, {
    'Content-Type': MIME[ext] || 'application/octet-stream',
    'Content-Length': stat.size,
    'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=0, must-revalidate',
  });
  fs.createReadStream(file).pipe(res);
}

function resolveFunction(pathname) {
  let rest = null;
  for (const prefix of FUNCTION_PREFIXES) {
    if (pathname === prefix || pathname.startsWith(prefix + '/')) {
      rest = pathname.slice(prefix.length);
      break;
    }
  }
  if (rest === null) return null;
  rest = rest.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!rest || rest.includes('..')) return null;
  if (rest.split('/').some((part) => part.startsWith('_'))) return null;
  const legacyDate = rest.match(/^day-notes\/([^/]+)$/);
  if (legacyDate) {
    const legacy = path.join(ROOT, 'api', 'day-notes.js');
    if (fs.existsSync(legacy)) {
      return { file: legacy, query: { date: legacyDate[1] } };
    }
  }
  const candidates = [
    path.join(ROOT, 'api', rest + '.js'),
    path.join(ROOT, 'api', rest, 'index.js'),
  ];
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
      return { file: candidate, query: null };
    }
  }
  return null;
}

function createResponse() {
  const res = {
    statusCode: 200,
    headers: {},
    status(code) {
      res.statusCode = code;
      return res;
    },
    setHeader(key, value) {
      res.headers[key] = value;
      return res;
    },
    set(key, value) {
      res.headers[key] = value;
      return res;
    },
    json(payload) {
      res.headers['Content-Type'] = 'application/json; charset=utf-8';
      res.body = JSON.stringify(payload);
      return res;
    },
    send(body) {
      res.body = body;
      return res;
    },
    end(body) {
      if (body !== undefined) res.body = body;
      return res;
    },
  };
  return res;
}

function parseQuery(url) {
  const query = {};
  url.searchParams.forEach((value, key) => {
    if (!(key in query)) query[key] = value;
  });
  return query;
}

function parseBody(headers, raw) {
  if (!raw || !raw.length) return null;
  const contentType = String(headers['content-type'] || '');
  const text = raw.toString('utf8');
  if (contentType.includes('application/json')) {
    try {
      return JSON.parse(text);
    } catch (err) {
      return text;
    }
  }
  if (contentType.includes('application/x-www-form-urlencoded')) {
    const form = {};
    new URLSearchParams(text).forEach((value, key) => {
      form[key] = value;
    });
    return form;
  }
  return text;
}

async function handleFunction(file, req, res) {
  const handler = require(file);
  const out = createResponse();
  await handler(req, out);
  const headers = Object.assign({}, out.headers);
  const body = out.body === undefined || out.body === null ? '' : out.body;
  res.writeHead(out.statusCode, headers);
  res.end(body);
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, 'http://127.0.0.1');
  const pathname = decodeURIComponent(url.pathname);

  const chunks = [];
  req.on('data', (chunk) => chunks.push(chunk));
  req.on('end', async () => {
    try {
      const functionFile = resolveFunction(pathname);
      if (functionFile) {
        const request = {
          method: req.method,
          url: req.url,
          headers: req.headers,
          query: Object.assign(parseQuery(url), functionFile.query || {}),
          body: parseBody(req.headers, Buffer.concat(chunks)),
        };
        await handleFunction(functionFile.file, request, res);
        return;
      }

      if (pathname === '/wd-panel-x7q9' || pathname === '/wd-panel-x7q9/') {
        sendFile(res, path.join(ROOT, 'admin.html'), 200);
        return;
      }

      let file = path.join(ROOT, pathname);
      if (!file.startsWith(ROOT)) {
        res.writeHead(403).end('Forbidden');
        return;
      }
      // I file nascosti (.env, .git, ...) non sono mai pubblici
      const relPath = path.relative(ROOT, file);
      if (relPath.split(path.sep).some((part) => part.startsWith('.') && part !== '..')) {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }
      // La cartella api/ è riservata alle funzioni: mai servita come file statico
      if (relPath.split(path.sep)[0] === 'api') {
        res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
        return;
      }
      if (fs.existsSync(file) && fs.statSync(file).isDirectory()) {
        file = path.join(file, 'index.html');
      }
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        sendFile(res, file, 200);
        return;
      }

      const notFound = path.join(ROOT, '404.html');
      if (fs.existsSync(notFound)) {
        sendFile(res, notFound, 404);
        return;
      }
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' }).end('Not found');
    } catch (err) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ error: (err && err.message) || 'Internal error' }));
    }
  });
});

server.listen(PORT, () => {
  console.log('WooDreads dev server on http://127.0.0.1:' + PORT);
});
