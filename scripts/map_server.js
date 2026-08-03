const http = require('http');
const fs = require('fs');
const path = require('path');

const DEFAULT_PORT = Number(process.env.PORT) || 3000;
const DEFAULT_ROOT = path.resolve(__dirname, '..');
const MAX_MAP_SIZE = 5 * 1024 * 1024;
const PUBLIC_FILES = new Set(['index.html', 'menu.html', 'game.html', 'favicon.ico']);
const PUBLIC_DIRECTORIES = new Set(['assets', 'src']);

function defaultActiveMapPayload() {
  const logicalW = 8;
  const logicalH = 8;
  const cellSize = 32;
  const baseLayer = new Array(logicalW * logicalH).fill(1);
  return {
    persistentGameId: `server_default_${Date.now()}`,
    timestamp: Date.now(),
    logicalW,
    logicalH,
    cellSize,
    mapStates: baseLayer,
    terrainLayer: baseLayer,
    treeObjects: [],
  };
}

function isContained(base, candidate) {
  const relative = path.relative(base, candidate);
  return relative === '' || (!relative.startsWith(`..${path.sep}`) && relative !== '..' && !path.isAbsolute(relative));
}

function decodeRequestPath(requestUrl) {
  let encodedPath;
  try {
    encodedPath = new URL(requestUrl || '/', 'http://localhost').pathname;
  } catch (error) {
    return null;
  }
  let pathname;
  try {
    pathname = decodeURIComponent(encodedPath);
  } catch (error) {
    return null;
  }
  if (pathname.includes('\0') || pathname.includes('\\')) return null;
  return pathname;
}

function resolveContained(base, pathname) {
  const candidate = path.resolve(base, `.${pathname}`);
  return isContained(base, candidate) ? candidate : null;
}

function contentTypeFor(filePath) {
  const types = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'text/javascript; charset=utf-8',
    '.mjs': 'text/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.ttf': 'font/ttf',
    '.wav': 'audio/wav',
    '.mp3': 'audio/mpeg',
    '.mp4': 'video/mp4',
  };
  return types[path.extname(filePath).toLowerCase()] || 'application/octet-stream';
}

function sendJson(res, status, body) {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

function sendNotFound(res) {
  res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
  res.end('Not found');
}

function streamFile(res, filePath) {
  const stream = fs.createReadStream(filePath);
  stream.on('error', error => {
    console.error('[map_server] static read failed', error);
    if (!res.headersSent) sendNotFound(res);
    else res.destroy();
  });
  res.writeHead(200, {
    'Content-Type': contentTypeFor(filePath),
    'X-Content-Type-Options': 'nosniff',
  });
  stream.pipe(res);
}

function createMapServer(options = {}) {
  const root = path.resolve(options.root || DEFAULT_ROOT);
  const mapsDir = path.resolve(options.mapsDir || path.join(root, 'maps'));
  if (!isContained(root, mapsDir) && !options.allowExternalMapsDir) {
    throw new Error('mapsDir must be contained within root');
  }
  const activePath = path.join(mapsDir, 'active_map.json');
  const mapServerKey = options.key ?? process.env.MAP_SERVER_KEY ?? '';
  const allowedOrigin = options.allowedOrigin ?? process.env.ALLOWED_ORIGIN ?? '*';

  fs.mkdirSync(mapsDir, { recursive: true });
  if (!fs.existsSync(activePath)) {
    fs.writeFileSync(activePath, JSON.stringify(defaultActiveMapPayload(), null, 2), 'utf8');
  }

  function setCorsHeaders(req, res) {
    const requestOrigin = req.headers.origin;
    if (allowedOrigin === '*') res.setHeader('Access-Control-Allow-Origin', '*');
    else if (!requestOrigin || requestOrigin === allowedOrigin) res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Map-Key');
    res.setHeader('Vary', 'Origin');
  }

  function originAllowed(req) {
    return allowedOrigin === '*' || !req.headers.origin || req.headers.origin === allowedOrigin;
  }

  function serveStatic(pathname, res) {
    let relativePath = pathname === '/' ? 'index.html' : pathname.slice(1);
    const firstPart = relativePath.split('/')[0];
    if (!PUBLIC_FILES.has(relativePath) && !PUBLIC_DIRECTORIES.has(firstPart)) {
      sendNotFound(res);
      return;
    }
    const filePath = resolveContained(root, `/${relativePath}`);
    if (!filePath) {
      sendNotFound(res);
      return;
    }
    fs.stat(filePath, (error, stats) => {
      if (error || !stats.isFile()) {
        sendNotFound(res);
        return;
      }
      streamFile(res, filePath);
    });
  }

  return http.createServer((req, res) => {
    setCorsHeaders(req, res);
    const pathname = decodeRequestPath(req.url);
    if (!pathname) {
      sendNotFound(res);
      return;
    }

    if (req.method === 'OPTIONS') {
      if (!originAllowed(req)) {
        sendJson(res, 403, { ok: false, error: 'Origin not allowed' });
        return;
      }
      res.writeHead(204);
      res.end();
      return;
    }

    if (req.method === 'GET' && pathname === '/maps/active_map.json') {
      fs.readFile(activePath, 'utf8', (error, data) => {
        if (error) {
          console.error('[map_server] active map read failed', error);
          sendJson(res, 500, { ok: false, error: 'Unable to load map' });
          return;
        }
        res.writeHead(200, {
          'Content-Type': 'application/json; charset=utf-8',
          'Cache-Control': 'no-store',
          'X-Content-Type-Options': 'nosniff',
        });
        res.end(data);
      });
      return;
    }

    if (req.method === 'GET' && pathname === '/maps') {
      fs.readdir(mapsDir, (error, files) => {
        if (error) {
          console.error('[map_server] map list failed', error);
          sendJson(res, 500, { ok: false, error: 'Unable to list maps' });
          return;
        }
        sendJson(res, 200, files.filter(file => file.endsWith('.json')).sort());
      });
      return;
    }

    if (req.method === 'GET' && pathname.startsWith('/maps/') && pathname.endsWith('.json')) {
      const mapPath = resolveContained(mapsDir, pathname.slice('/maps'.length));
      if (!mapPath) {
        sendNotFound(res);
        return;
      }
      fs.stat(mapPath, (error, stats) => {
        if (error || !stats.isFile()) sendNotFound(res);
        else streamFile(res, mapPath);
      });
      return;
    }

    if (req.method === 'POST' && pathname === '/save-map') {
      if (!originAllowed(req)) {
        sendJson(res, 403, { ok: false, error: 'Origin not allowed' });
        return;
      }
      if (mapServerKey && req.headers['x-map-key'] !== mapServerKey) {
        console.warn(`[security] unauthorized save-map attempt from ${req.socket.remoteAddress}`);
        sendJson(res, 401, { ok: false, error: 'Unauthorized' });
        return;
      }

      const chunks = [];
      let received = 0;
      let tooLarge = false;
      req.on('data', chunk => {
        if (tooLarge) return;
        received += chunk.length;
        if (received > MAX_MAP_SIZE) {
          tooLarge = true;
          sendJson(res, 413, { ok: false, error: 'Payload too large' });
          return;
        }
        chunks.push(chunk);
      });
      req.on('end', () => {
        if (tooLarge || res.writableEnded) return;
        try {
          const payload = JSON.parse(Buffer.concat(chunks).toString('utf8'));
          if (!payload || typeof payload !== 'object' || Array.isArray(payload)) throw new Error('Map payload must be an object');
          const tempPath = path.join(mapsDir, `.active-map-${process.pid}-${Date.now()}.tmp`);
          fs.writeFileSync(tempPath, JSON.stringify(payload, null, 2), 'utf8');
          fs.renameSync(tempPath, activePath);
          sendJson(res, 200, { ok: true, message: 'active_map.json replaced' });
        } catch (error) {
          console.error('[map_server] invalid map payload', error);
          sendJson(res, 400, { ok: false, error: 'Invalid map payload' });
        }
      });
      req.on('error', error => console.error('[map_server] request failed', error));
      return;
    }

    if (req.method !== 'GET') {
      sendJson(res, 405, { ok: false, error: 'Method not allowed' });
      return;
    }
    serveStatic(pathname, res);
  });
}

if (require.main === module) {
  const server = createMapServer();
  server.listen(DEFAULT_PORT, () => {
    console.log(`Map & static server listening on http://localhost:${DEFAULT_PORT}`);
    console.log(`Workspace root: ${DEFAULT_ROOT}`);
    console.log(`Serving maps from ${path.join(DEFAULT_ROOT, 'maps')}`);
  });
}

module.exports = {
  MAX_MAP_SIZE,
  createMapServer,
  decodeRequestPath,
  isContained,
};
