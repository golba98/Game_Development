const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const createNoise = require('./helpers/p5-noise.js');

function run(context, file) {
  vm.runInContext(fs.readFileSync(path.join(__dirname, '..', file), 'utf8'), context, { filename: file });
}

function gameContext({ seed = 1, deniedStorage = false } = {}) {
  const values = new Map([['tutorialComplete', 'true']]);
  const storage = {
    getItem(key) { if (deniedStorage) throw new Error('Storage denied'); return values.get(key) ?? null; },
    setItem(key, value) { if (deniedStorage) throw new Error('Storage denied'); values.set(key, value); },
    removeItem(key) { if (deniedStorage) throw new Error('Storage denied'); values.delete(key); },
  };
  const math = Object.create(Math);
  math.random = () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0) / 4294967296);
  const context = vm.createContext({
    console: { log() {}, info() {}, warn() {}, error() {} },
    window: { location: { search: '' }, devicePixelRatio: 1, innerWidth: 1280, innerHeight: 720, localStorage: storage, addEventListener() {} },
    localStorage: storage, URLSearchParams, Math: math, noise: createNoise(math),
    createPerformanceTracker: () => ({}), verboseLog() {},
    width: 1280, height: 720, PI: Math.PI, HALF_PI: Math.PI / 2, TWO_PI: Math.PI * 2,
    constrain: (value, min, max) => Math.max(min, Math.min(max, value)),
    cos: Math.cos, sin: Math.sin, floor: Math.floor, abs: Math.abs, min: Math.min, max: Math.max,
    dist: (x, y, a, b) => Math.hypot(x - a, y - b),
    setTimeout() {}, clearTimeout() {},
  });
  for (const file of ['src/shared/shared-constants.js', 'src/game/game-globals.js',
    'src/game/game-world.js', 'src/game/game-map.js', 'src/game/game-movement.js',
    'src/game/game-utils.js', 'src/game/game-io.js', 'src/game/runtime/loading-state.js']) run(context, file);
  vm.runInContext(`
    window.parent = window;
    globalThis.bakes = 0;
    createMapImage = () => { bakes++; };
    updateLoadingOverlayDom = () => {};
    autosaveMap = () => true;
    persistActiveMapToServer = () => false;
    spawnEnemy = (type, x, y) => enemies.push({ type, x, y, health: 3 });
    createMantis = createMaggot = createBeetle = (x, y) => ({ x, y, health: 3 });
  `, context);
  return context;
}

const inspect = (context, expression) => vm.runInContext(expression, context);

test('blocked storage does not abort globals or reload completed training', () => {
  const context = gameContext({ deniedStorage: true });
  assert.equal(inspect(context, 'localStorageAvailable'), false);
  assert.equal(inspect(context, 'isTutorialMap'), true);
  inspect(context, 'isTutorialMap = false; generateMap();');
  assert.equal(inspect(context, 'isTutorialMap'), false);
  assert.equal(inspect(context, 'genPhase'), 1);
});

test('difficulty setter updates generation and persisted settings together', () => {
  const context = gameContext();
  for (const difficulty of ['hard', 'easy', 'normal']) {
    inspect(context, `setDifficulty('${difficulty}', { regenerate: false });`);
    assert.equal(inspect(context, 'currentDifficulty'), difficulty);
    assert.equal(inspect(context, 'difficultySetting'), difficulty);
  }
});

test('saved map validation rejects malformed maps before altering live state', () => {
  const context = gameContext();
  inspect(context, 'mapStates = new Uint8Array([1]); logicalW = logicalH = 1;');
  const payloads = [
    { logicalW: 150, logicalH: 150, mapStates: [1] },
    { logicalW: -1, logicalH: 1, mapStates: [1] },
    { logicalW: 1, logicalH: 1, mapStates: [256] },
    { logicalW: 1, logicalH: 1, mapStates: [1], terrainLayer: [] },
    { logicalW: 1, logicalH: 1, mapStates: [1], playerPosition: { x: 3, y: 0 } },
    { logicalW: 1, logicalH: 1, mapStates: [1], enemies: [{ type: 'beetle', x: 0, y: NaN }] },
  ];
  for (const payload of payloads) {
    context.payload = payload;
    assert.equal(inspect(context, 'applyLoadedMap(payload)'), false);
    assert.equal(inspect(context, 'mapStates[0]'), 1);
    assert.equal(inspect(context, 'logicalW'), 1);
  }
});

test('valid legacy saves restore coins and choose a walkable spawn', () => {
  const context = gameContext();
  const payload = { logicalW: 3, logicalH: 3, mapStates: [1, 103, 1, 1, 2, 1, 1, 1, 1] };
  context.payload = payload;
  assert.equal(inspect(context, 'applyLoadedMap(payload)'), true);
  assert.equal(inspect(context, 'isSolid(getTileState(playerPosition.x, playerPosition.y))'), false);
  assert.equal(inspect(context, 'activeCoins.length'), 1);
  assert.equal(inspect(context, 'mapLoadComplete'), true);
});

test('seeded worlds have reachable objectives, one boss, safe spawns, and one terrain bake', () => {
  for (let seed = 1; seed <= 24; seed++) {
    const context = gameContext({ seed });
    const difficulty = ['easy', 'normal', 'hard'][seed % 3];
    inspect(context, `setDifficulty('${difficulty}', { regenerate: false }); generateMap();`);
    assert.equal(inspect(context, 'generateMap_Part1()'), true);
    assert.equal(inspect(context, 'generateMap_Part2()'), true);
    const result = inspect(context, `(() => {
      const reachable = floodReachable();
      return {
        spawnSafe: !isSolid(getTileState(playerPosition.x, playerPosition.y)),
        objectivesReachable: [...enemies, ...activeCoins, portalPos].every(pos => reachable[pos.y * logicalW + pos.x]),
        bossCount: enemies.filter(enemy => enemy.type === 'beetle').length,
        enemyCount: enemies.length, coins: activeCoins.length, bakes,
        uniquePositions: new Set([...enemies, ...activeCoins].map(pos => pos.y * logicalW + pos.x)).size,
      };
    })()`);
    assert.equal(result.spawnSafe, true, `seed ${seed}`);
    assert.equal(result.objectivesReachable, true, `seed ${seed}`);
    assert.equal(result.bossCount, 1);
    assert.equal(result.coins, 20);
    assert.equal(result.bakes, 1);
    assert.equal(result.uniquePositions, result.enemyCount + result.coins);
    const target = { easy: 6, normal: 12, hard: 24 }[difficulty];
    assert.ok(result.enemyCount >= target && result.enemyCount <= target + 1);
    inspect(context, 'projectiles = [{x: 1}]; vfx = [{}]; generateMap();');
    assert.equal(inspect(context, 'projectiles.length + vfx.length + activeCoins.length'), 0);
    assert.equal(inspect(context, 'generateMap_Part2()'), false, 'stale phase rejected');
  }
});

test('missing or failed Pixi initialization leaves no active application', () => {
  const context = vm.createContext({ console: { warn() {} }, window: {} });
  run(context, 'src/game/runtime/pixi-app.js');
  assert.equal(inspect(context, 'PixiApp.init({width:800,height:600})'), false);
  context.PIXI = { settings: {}, SCALE_MODES: {}, Application: function () { throw new Error('No WebGL'); } };
  assert.equal(inspect(context, 'PixiApp.init({width:800,height:600})'), false);
  assert.equal(inspect(context, 'PixiApp.app'), null);
  assert.equal(inspect(context, 'PixiApp._initialized'), false);
});

test('terrain chunks obey GPU limits, refresh changed tiles, and release previous resources', () => {
  const canvases = [];
  const sprites = [];
  const container = {
    addChild(sprite) { sprite.parent = this; },
    removeChild(sprite) { sprite.parent = null; },
  };
  const context = vm.createContext({
    mapImage: { elt: { width: 4800, height: 4800 } },
    PixiApp: { app: { renderer: { gl: { MAX_TEXTURE_SIZE: 1, getParameter: () => 1024 } } }, terrainContainer: container },
    document: { createElement() {
      const canvas = { getContext: () => ({ drawImage() {}, clearRect() {} }) };
      canvases.push(canvas);
      return canvas;
    } },
    PIXI: {
      Texture: { from: () => ({ baseTexture: { updates: 0, update() { this.updates++; } } }) },
      Sprite: function (texture) {
        this.texture = texture; this.position = { set() {} };
        this.destroy = () => { this.destroyed = true; };
        sprites.push(this);
      },
    },
  });
  run(context, 'src/game/runtime/pixi-world-renderer.js');
  inspect(context, 'PixiWorldRenderer.rebuildTerrainTexture();');
  assert.equal(canvases.length, 25);
  assert.ok(canvases.every(canvas => canvas.width <= 1024 && canvas.height <= 1024));
  inspect(context, 'PixiWorldRenderer.invalidate(0, 0, 32, 32);');
  assert.equal(sprites.filter(sprite => sprite.texture.baseTexture.updates === 1).length, 1);
  inspect(context, 'PixiWorldRenderer.rebuildTerrainTexture();');
  assert.ok(sprites.slice(0, 25).every(sprite => sprite.destroyed));
  inspect(context, 'PixiWorldRenderer.clear();');
  assert.equal(inspect(context, 'PixiWorldRenderer._chunks.length'), 0);
});

test('generation exceptions retry once and then stop with a recovery state', () => {
  const context = gameContext();
  run(context, 'src/game/game-core.js');
  inspect(context, 'genPhase = 3; generationRetries = 0;');
  context.error = new Error('Bad terrain upload');
  inspect(context, 'handlePixiTickError(error);');
  assert.equal(inspect(context, 'generationRetries'), 1);
  assert.equal(inspect(context, 'genPhase'), 1);
  assert.equal(inspect(context, 'runtimeFailed'), false);
  inspect(context, 'handlePixiTickError(error);');
  assert.equal(inspect(context, 'runtimeFailed'), true);
  assert.equal(inspect(context, 'genPhase'), 0);
  assert.doesNotThrow(() => inspect(context, 'draw();'));
});

test('terrain reachability follows diagonal walking and excludes blocking props', () => {
  const context = gameContext();
  inspect(context, `logicalW = logicalH = 3; mapStates = new Uint8Array([1,2,2,2,1,2,2,2,1]);
    playerPosition = {x:0,y:0}; decorativeObstaclePositions = new Set();`);
  assert.equal(inspect(context, 'floodReachable()[8]'), 1);
  inspect(context, 'decorativeObstaclePositions.add(4);');
  assert.equal(inspect(context, 'floodReachable()[8]'), 0);
});

test('saved prop layouts survive loading without blocking the player', () => {
  const context = gameContext();
  context.payload = {
    logicalW: 5, logicalH: 5, mapStates: Array(25).fill(1),
    playerPosition: {x:0,y:0}, portalPos: {x:4,y:4},
    decorativeObjects: [{id:'log_horizontal_1',type:'obstacle',tileX:2,tileY:2}],
  };
  assert.equal(inspect(context, 'applyLoadedMap(payload)'), true);
  assert.equal(inspect(context, 'decorativeObstaclePositions.has(12)'), true);
  const saved = inspect(context, 'buildActiveMapPayload()');
  assert.equal(saved.playerPosition.x, 0);
  assert.equal(saved.decorativeObjects[0].id, 'log_horizontal_1');
});

test('startup timeouts present Retry instead of dismissing a broken loading screen', () => {
  let timeout;
  const overlay = {
    children: [], setAttribute() {}, replaceChildren() { this.children = []; },
    appendChild(child) { this.children.push(child); }, remove() { this.removed = true; },
  };
  let reloads = 0;
  const context = vm.createContext({
    console: {error() {}}, setTimeout(callback) { timeout = callback; }, clearTimeout() {},
    window: {addEventListener() {}, location: {reload() {reloads++;}}},
    document: {
      getElementById: id => id === 'gd-loading-overlay' ? overlay : null,
      createElement: () => ({addEventListener(event, callback) { this.click = callback; }}),
    },
  });
  run(context, 'src/shared/startup.js');
  timeout();
  assert.equal(overlay.children[1].textContent, 'Retry');
  overlay.children[1].click();
  assert.equal(reloads, 1);
  inspect(context, 'GameStartup.finish();');
  assert.equal(overlay.removed, undefined, 'late completion must not hide the error');
});

test('P regenerates an active world and Escape cannot stack pause over game over', () => {
  const context = gameContext();
  run(context, 'src/game/runtime/scene-manager.js');
  run(context, 'src/game/game-input.js');
  inspect(context, `mapLoadComplete = true; showLoadingOverlay = false; key = 'p'; keyCode = 80; keyPressed();`);
  assert.equal(inspect(context, 'genPhase'), 1);
  inspect(context, 'isGameOver = true; inGameMenuVisible = false; togglePauseMenuFromEscape();');
  assert.equal(inspect(context, 'inGameMenuVisible'), false);
});

test('duplicate asset completions cannot mark unfinished assets ready', () => {
  const context = vm.createContext({});
  run(context, 'src/game/game-assets.js');
  inspect(context, `AssetTracker.expect('grass'); AssetTracker.expect('tree');
    AssetTracker.markLoaded('grass'); AssetTracker.markLoaded('grass');`);
  assert.equal(inspect(context, 'AssetTracker.loaded'), 1);
  inspect(context, "AssetTracker.markLoaded('tree');");
  assert.equal(inspect(context, 'AssetTracker.loaded'), 2);
});

test('short movement taps are latched between frames and blur releases all input', () => {
  const context = gameContext();
  const events = {};
  context.window.addEventListener = (name, callback) => { events[name] = callback; };
  context.document = {addEventListener() {}};
  run(context, 'src/game/runtime/input-state.js');
  inspect(context, `logicalW = logicalH = 5; mapStates = new Uint8Array(25).fill(1);
    playerPosition = {x:2,y:2}; updateSprintState = () => {}; getActiveMoveDurationMs = () => 100;
    startMoveVisual = () => {isMoving = true;};`);
  context.millis = () => 100;
  events.keydown({keyCode:68, repeat:false});
  events.keyup({keyCode:68});
  inspect(context, 'handleMovement();');
  assert.equal(inspect(context, 'playerPosition.x'), 3);
  events.blur();
  assert.equal(inspect(context, 'InputState.wasPressed(68)'), false);
  assert.equal(inspect(context, 'InputState.isDown(68)'), false);
});

test('generation clears death overlays and terminal use pauses simulation', () => {
  const context = gameContext();
  let closed = 0;
  context.overlay = {close() {closed++;}};
  inspect(context, 'isGameOver = true; playerHealth = 0; gameOverOverlay = overlay; generateMap();');
  assert.equal(inspect(context, 'isGameOver'), false);
  assert.equal(inspect(context, 'playerHealth'), 7);
  assert.equal(closed, 1);
  run(context, 'src/game/runtime/scene-manager.js');
  inspect(context, 'genPhase = 0; showLoadingOverlay = false; isTerminalOpen = true;');
  assert.equal(inspect(context, 'SceneManager.isSimulating()'), false);
});

test('the passive training dummy stays fixed while tutorial prompts are read', () => {
  const context = gameContext();
  run(context, 'src/game/game-enemies.js');
  const result = inspect(context, `(() => {
    isTutorialMap = true; playerPosition = {x:3,y:15}; gameDelta = 100;
    const dummy = createBeetle(5,5); dummy.aggro = false;
    for (let frame = 0; frame < 1000; frame++) dummy.update();
    return {x:dummy.x,y:dummy.y,attacking:dummy.attacking};
  })()`);
  assert.deepEqual({...result}, {x:5,y:5,attacking:false});
});

test('the configured E attack binding uses melee instead of the legacy mana spell', () => {
  const context = gameContext();
  run(context, 'src/game/runtime/scene-manager.js');
  run(context, 'src/game/game-input.js');
  inspect(context, `mapLoadComplete = true; showLoadingOverlay = false; key = 'e'; keyCode = 69;
    globalThis.attacks = 0; startPlayerAttack = () => {attacks++;}; keyPressed();`);
  assert.equal(inspect(context, 'attacks'), 1);
  assert.equal(inspect(context, 'playerMana'), 100);
  inspect(context, 'inGameMenuVisible = true; keyPressed();');
  assert.equal(inspect(context, 'attacks'), 1);
});


test('renderer override selects Canvas without changing the stored preference', () => {
  const context = vm.createContext({
    window: { location: { search: '?renderBackend=p5' }, localStorage: { setItem() {}, removeItem() {} } },
    localStorage: { getItem: () => 'pixi' }, URLSearchParams,
    console: { warn() {} }, createPerformanceTracker: () => ({}),
  });
  run(context, 'src/shared/shared-constants.js');
  run(context, 'src/game/game-globals.js');
  assert.equal(inspect(context, 'RENDER_BACKEND'), 'p5');
});

test('denied fullscreen is handled without an unhandled rejection', async () => {
  const context = gameContext();
  context.document = { documentElement: { requestFullscreen: () => Promise.reject(new Error('Denied')) } };
  let notice;
  context.showToast = message => { notice = message; };
  run(context, 'src/game/game-input.js');
  inspect(context, "key = 'f'; keyCode = 70; keyPressed();");
  await Promise.resolve();
  assert.match(notice, /Fullscreen is unavailable/);
});

test('props that isolate the portal are removed before objectives are placed', () => {
  const context = gameContext();
  inspect(context, `spawnDecorativeObjects = () => {
    decorativeObjectsList = [{ type: 'obstacle', tileX: portalPos.x, tileY: portalPos.y }];
    decorativeObstaclePositions = new Set([portalPos.y * logicalW + portalPos.x]);
  };
  generateMap(); generateMap_Part1(); generateMap_Part2();`);
  assert.equal(inspect(context, 'decorativeObstaclePositions.size'), 0);
  assert.equal(inspect(context, '!!floodReachable()[portalPos.y * logicalW + portalPos.x]'), true);
});

test('WebGL context loss stops Pixi pacing and resumes Canvas rendering', () => {
  let loops = 0;
  let stopped = 0;
  let cleared = 0;
  const context = vm.createContext({
    console: { warn() {} }, RENDER_BACKEND: 'pixi', targetFps: 60,
    applyGameFpsMode() {}, loop() { loops++; },
    PixiWorldRenderer: { clear() { cleared++; } },
  });
  run(context, 'src/game/runtime/pixi-app.js');
  inspect(context, `PixiApp.app = { ticker: { stop() { stopped++; } }, view: { style: {} } };`);
  context.stopped = 0;
  inspect(context, 'PixiApp.useCanvasFallback();');
  stopped = context.stopped;
  assert.equal(inspect(context, 'RENDER_BACKEND'), 'p5');
  assert.equal(inspect(context, 'PixiApp.app.view.style.display'), 'none');
  assert.equal(loops, 1);
  assert.equal(stopped, 1);
  assert.equal(cleared, 1);
});

test('interrupting menu video playback handles expected browser cancellation', async () => {
  let warnings = 0;
  const context = vm.createContext({
    bgVideo: { elt: { play: () => Promise.reject({ name: 'AbortError' }) } },
    console: { warn() { warnings++; } },
  });
  run(context, 'src/menu/menu-video.js');
  inspect(context, 'playMenuBackgroundVideo();');
  await Promise.resolve();
  assert.equal(warnings, 0);
  assert.equal(context.bgVideo.elt.loop, true);
});
