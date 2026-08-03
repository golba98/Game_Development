const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const { createMapServer, MAX_MAP_SIZE } = require('../scripts/map_server.js');

function rawRequest(port, requestPath, options = {}) {
  return new Promise((resolve, reject) => {
    const request = http.request({
      host: '127.0.0.1',
      port,
      path: requestPath,
      method: options.method || 'GET',
      headers: options.headers || {},
    }, response => {
      const chunks = [];
      response.on('data', chunk => chunks.push(chunk));
      response.on('end', () => resolve({
        status: response.statusCode,
        headers: response.headers,
        body: Buffer.concat(chunks).toString('utf8'),
      }));
    });
    request.on('error', reject);
    if (options.body) request.write(options.body);
    request.end();
  });
}

test('map server restricts paths and safely saves maps', async t => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'forest-rpg-server-'));
  fs.mkdirSync(path.join(root, 'assets'), { recursive: true });
  fs.mkdirSync(path.join(root, 'src'), { recursive: true });
  fs.mkdirSync(path.join(root, 'scripts'), { recursive: true });
  fs.writeFileSync(path.join(root, 'index.html'), '<h1>menu</h1>');
  fs.writeFileSync(path.join(root, 'game.html'), '<h1>game</h1>');
  fs.writeFileSync(path.join(root, 'menu.html'), '<h1>menu</h1>');
  fs.writeFileSync(path.join(root, 'package.json'), '{"private":true}');
  fs.writeFileSync(path.join(root, 'assets', 'icon.svg'), '<svg></svg>');
  fs.writeFileSync(path.join(root, 'src', 'app.js'), 'window.app = true;');
  fs.writeFileSync(path.join(root, 'scripts', 'secret.js'), 'secret');

  const server = createMapServer({ root, key: 'test-key', allowedOrigin: 'https://game.test' });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const port = server.address().port;
  t.after(async () => {
    await new Promise(resolve => server.close(resolve));
    fs.rmSync(root, { recursive: true, force: true });
  });

  const rootResponse = await rawRequest(port, '/');
  assert.equal(rootResponse.status, 200);
  assert.match(rootResponse.body, /menu/);
  assert.match(rootResponse.headers['content-type'], /^text\/html/);

  const scriptResponse = await rawRequest(port, '/src/app.js');
  assert.equal(scriptResponse.status, 200);
  assert.match(scriptResponse.headers['content-type'], /^text\/javascript/);
  assert.equal((await rawRequest(port, '/missing')).status, 404);
  assert.equal((await rawRequest(port, '/package.json')).status, 404);
  assert.equal((await rawRequest(port, '/scripts/secret.js')).status, 404);

  for (const maliciousPath of ['/../package.json', '/%2e%2e/package.json', '/assets/%2e%2e/package.json', '/assets/%5c..%5cpackage.json', '/%ZZ']) {
    assert.equal((await rawRequest(port, maliciousPath)).status, 404, maliciousPath);
  }

  const unauthorized = await rawRequest(port, '/save-map', {
    method: 'POST',
    headers: { 'content-type': 'application/json', origin: 'https://game.test' },
    body: '{}',
  });
  assert.equal(unauthorized.status, 401);

  const wrongOrigin = await rawRequest(port, '/save-map', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-map-key': 'test-key', origin: 'https://attacker.test' },
    body: '{}',
  });
  assert.equal(wrongOrigin.status, 403);

  const malformed = await rawRequest(port, '/save-map', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-map-key': 'test-key', origin: 'https://game.test' },
    body: '{bad json',
  });
  assert.equal(malformed.status, 400);
  assert.equal(JSON.parse(malformed.body).error, 'Invalid map payload');
  assert.doesNotMatch(malformed.body, /SyntaxError|stack|JSON at position/i);

  const oversized = await rawRequest(port, '/save-map', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-map-key': 'test-key', origin: 'https://game.test' },
    body: Buffer.alloc(MAX_MAP_SIZE + 1, 97),
  });
  assert.equal(oversized.status, 413);

  const payload = { logicalW: 2, logicalH: 2, mapStates: [1, 1, 1, 1] };
  const saved = await rawRequest(port, '/save-map', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-map-key': 'test-key', origin: 'https://game.test' },
    body: JSON.stringify(payload),
  });
  assert.equal(saved.status, 200);
  const loaded = await rawRequest(port, '/maps/active_map.json');
  assert.equal(loaded.status, 200);
  assert.deepEqual(JSON.parse(loaded.body), payload);
});
