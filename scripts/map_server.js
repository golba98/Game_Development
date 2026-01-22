const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');

const PORT = process.env.PORT || 3000;
const WORKSPACE_ROOT = path.join(__dirname, '..');
const MAPS_DIR = path.join(WORKSPACE_ROOT, 'maps');
const ACTIVE_PATH = path.join(MAPS_DIR, 'active_map.json');

function defaultActiveMapPayload() {
  const logicalW = 8;
  const logicalH = 8;
  const cellSize = 32;
  const grass = 1; // matches TILE_TYPES.GRASS in the client
  const baseLayer = new Array(logicalW * logicalH).fill(grass);
  return {
    persistentGameId: 'server_default_' + Date.now(),
    timestamp: Date.now(),
    logicalW,
    logicalH,
    cellSize,
    mapStates: baseLayer,
    terrainLayer: baseLayer,
    treeObjects: []
  };
}

function writeDefaultActiveMap(reason) {
  const payload = defaultActiveMapPayload();
  try {
    fs.writeFileSync(ACTIVE_PATH, JSON.stringify(payload, null, 2), 'utf8');
    console.log(`[map_server] created default active_map.json (${reason || 'init'})`);
  } catch (e) {
    console.error('[map_server] failed to write default active_map.json', e);
  }
  return payload;
}

function ensureActiveMapExists() {
  ensureMapsDir();
  if (!fs.existsSync(ACTIVE_PATH)) {
    writeDefaultActiveMap('missing');
    return true;
  }
  return false;
}

function ensureMapsDir() {
  try { if (!fs.existsSync(MAPS_DIR)) fs.mkdirSync(MAPS_DIR); } catch (e) { console.error('Failed to create maps dir', e); }
}

ensureMapsDir();
ensureActiveMapExists();

function send404(res, msg) {
  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end(msg || 'Not found');
}

function setCorsHeaders(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function contentTypeFor(filePath) {
  const ext = path.extname(filePath).toLowerCase();
  if (ext === '.html') return 'text/html';
  if (ext === '.js') return 'application/javascript';
  if (ext === '.css') return 'text/css';
  if (ext === '.json') return 'application/json';
  if (ext === '.png') return 'image/png';
  if (ext === '.jpg' || ext === '.jpeg') return 'image/jpeg';
  if (ext === '.wav') return 'audio/wav';
  return 'application/octet-stream';
}

const server = http.createServer((req, res) => {
  setCorsHeaders(res);
  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }
  const parsed = url.parse(req.url || '/');
  const pathname = parsed.pathname || '/';

  // Map endpoints
  if (req.method === 'GET' && pathname === '/maps/active_map.json') {
    if (!fs.existsSync(ACTIVE_PATH)) {
      const payload = writeDefaultActiveMap('get-miss');
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(payload));
      return;
    }
    fs.readFile(ACTIVE_PATH, 'utf8', (err, data) => {
      if (err) { const payload = writeDefaultActiveMap('read-error'); res.writeHead(200, { 'Content-Type': 'application/json' }); res.end(JSON.stringify(payload)); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(data);
    });
    return;
  }

  if (req.method === 'POST' && pathname === '/save-map') {
    let body = '';
    req.on('data', chunk => { body += chunk.toString(); });
    req.on('end', () => {
      try {
        const obj = JSON.parse(body);
        // Replace the previous active map with the new payload
        if (fs.existsSync(ACTIVE_PATH)) {
          try { fs.unlinkSync(ACTIVE_PATH); } catch (unlinkErr) { console.warn('[map_server] failed to remove previous active_map.json', unlinkErr); }
        }
        fs.writeFileSync(ACTIVE_PATH, JSON.stringify(obj, null, 2), 'utf8');
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, message: 'active_map.json replaced' }));
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: String(e) }));
      }
    });
    return;
  }

  // list maps
  if (req.method === 'GET' && pathname === '/maps') {
    fs.readdir(MAPS_DIR, (err, files) => {
      if (err) { res.writeHead(500); res.end('err'); return; }
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(files));
    });
    return;
  }

  // Otherwise serve static files from workspace root
  let filePath = path.join(WORKSPACE_ROOT, pathname);
  // sanitize
  if (!filePath.startsWith(WORKSPACE_ROOT)) { send404(res); return; }
  fs.stat(filePath, (err, stats) => {
    if (err) {
      // if directory, try index.html
      const alt = path.join(WORKSPACE_ROOT, pathname, 'Game_Index.html');
      fs.stat(alt, (e2, s2) => {
        if (!e2 && s2 && s2.isFile()) {
          const ct = contentTypeFor(alt);
          res.writeHead(200, { 'Content-Type': ct });
          fs.createReadStream(alt).pipe(res);
        } else {
          // fallback to root Game_Index.html
          const rootIndex = path.join(WORKSPACE_ROOT, 'Game_Index.html');
          fs.stat(rootIndex, (e3, s3) => {
            if (!e3 && s3 && s3.isFile()) {
              res.writeHead(200, { 'Content-Type': 'text/html' });
              fs.createReadStream(rootIndex).pipe(res);
            } else {
              send404(res);
            }
          });
        }
      });
      return;
    }
    if (stats.isDirectory()) {
      // serve Game_Index.html in that directory if present
      const idx = path.join(filePath, 'Game_Index.html');
      fs.stat(idx, (e, s) => {
        if (!e && s && s.isFile()) {
          res.writeHead(200, { 'Content-Type': 'text/html' });
          fs.createReadStream(idx).pipe(res);
        } else {
          send404(res);
        }
      });
      return;
    }
    // file
    const ct = contentTypeFor(filePath);
    res.writeHead(200, { 'Content-Type': ct });
    fs.createReadStream(filePath).pipe(res);
  });
});

server.listen(PORT, () => {
  console.log(`Map & static server listening on http://localhost:${PORT}`);
  console.log(`Workspace root: ${WORKSPACE_ROOT}`);
  console.log(`Serving maps from ${MAPS_DIR}`);
});
