const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const root = path.resolve(__dirname, '..');

function runScript(relativePath, context) {
  const source = fs.readFileSync(path.join(root, relativePath), 'utf8');
  vm.runInContext(source, context, { filename: relativePath });
}

test('FPS modes keep 60 as default while preserving every cap and unlimited', () => {
  const applied = [];
  const context = vm.createContext({ frameRate: value => applied.push(value) });
  runScript('src/shared/shared-constants.js', context);
  assert.equal(vm.runInContext('DEFAULT_SETTINGS.fpsMode', context), '60');
  assert.equal(vm.runInContext('normalizeFpsMode("120")', context), '120');
  assert.equal(vm.runInContext('normalizeFpsMode("144")', context), '144');
  assert.equal(vm.runInContext('normalizeFpsMode(165)', context), '165');
  assert.equal(vm.runInContext('normalizeFpsMode("240")', context), '240');
  assert.equal(vm.runInContext('getFpsTargetForMode("unlimited")', context), 0);
  assert.equal(vm.runInContext('FPS_MODE_OPTIONS.length', context), 6);
  vm.runInContext('applyFpsModeToP5("60"); applyFpsModeToP5("120"); applyFpsModeToP5("144"); applyFpsModeToP5("165"); applyFpsModeToP5("240"); applyFpsModeToP5("unlimited")', context);
  assert.deepEqual(applied, [60, 120, 144, 165, 240, Infinity]);
});

test('Pixi unlimited mode bypasses the requestAnimationFrame ticker', () => {
  const queued = [];
  const cleared = [];
  let now = 100;
  const context = vm.createContext({
    console,
    performance: { now: () => (now += 2) },
    setTimeout: callback => { queued.push(callback); return queued.length; },
    clearTimeout: id => cleared.push(id),
    document: { hidden: false },
  });
  runScript('src/game/runtime/pixi-app.js', context);
  vm.runInContext(`
    globalThis.tickPeriods = [];
    globalThis.renderCount = 0;
    PixiApp.app = {
      ticker: {
        maxFPS: 60,
        add() {},
        remove() {},
        start() { this.started = true; },
        stop() { this.stopped = true; }
      },
      renderer: { render() { renderCount += 1; } },
      stage: {}
    };
    PixiApp.setGameLoop((period, isElapsedMs) => tickPeriods.push([period, isElapsedMs]));
    PixiApp.setTargetFps(0);
  `, context);

  assert.equal(vm.runInContext('PixiApp.app.ticker.maxFPS', context), 0);
  assert.equal(vm.runInContext('PixiApp.app.ticker.stopped', context), true);
  queued.shift()();
  assert.equal(vm.runInContext('tickPeriods.length', context), 1);
  assert.equal(vm.runInContext('tickPeriods[0][0]', context), 2);
  assert.equal(vm.runInContext('tickPeriods[0][1]', context), true);
  assert.equal(vm.runInContext('renderCount', context), 1);

  vm.runInContext('PixiApp.setTargetFps(60)', context);
  assert.equal(vm.runInContext('PixiApp.app.ticker.maxFPS', context), 60);
  assert.equal(vm.runInContext('PixiApp.app.ticker.started', context), true);
  assert.ok(cleared.length > 0);
});

test('camera impulse is directional, bounded, and settles within its duration', () => {
  const context = vm.createContext({ window: {}, screenShakeEnabled: true, Math });
  runScript('src/game/runtime/camera-shake.js', context);
  vm.runInContext('CameraShake.kick({ x: -1, y: 0, magnitude: 4, duration: 130 })', context);
  const first = vm.runInContext('CameraShake.update(16).x', context);
  assert.ok(first < 0 && Math.abs(first) <= 4);
  vm.runInContext('for (let i = 0; i < 10; i++) CameraShake.update(16)', context);
  assert.equal(vm.runInContext('CameraShake.offset.x', context), 0);
  assert.equal(vm.runInContext('CameraShake.impulses.length', context), 0);
  vm.runInContext('screenShakeEnabled = false; CameraShake.kick({ x: 1, magnitude: 6 })', context);
  assert.equal(vm.runInContext('CameraShake.offset.x', context), 0);
});

test('central combat path applies armor, feedback, invulnerability, and knockback', () => {
  const calls = { text: [], knockback: [], shake: [] };
  const context = vm.createContext({
    window: {},
    playerHealth: 7,
    playerHurtTimer: 0,
    playerPosition: { x: 5, y: 4 },
    equipment: { armor: { defense: 1 } },
    lastHealthChange: 0,
    millis: () => 123,
    spawnDamageText: (...args) => calls.text.push(args),
    _knockbackPlayer: (...args) => calls.knockback.push(args),
    CameraShake: { kick: options => calls.shake.push(options) },
  });
  runScript('src/game/game-combat.js', context);
  const result = vm.runInContext('GameCombat.applyPlayerDamage({ amount: 3, sourceX: 3, sourceY: 4, invulnerabilityMs: 500, knockback: 0.5 })', context);
  assert.deepEqual({ applied: result.applied, damage: result.damage }, { applied: true, damage: 2 });
  assert.equal(context.playerHealth, 5);
  assert.equal(context.playerHurtTimer, 500);
  assert.equal(context.lastHealthChange, 123);
  assert.equal(calls.text.length, 1);
  assert.deepEqual(calls.knockback[0].slice(0, 3), [2, 0, 0.5]);
  assert.equal(calls.shake[0].x, 2);
});

test('HTML script graph only references files that exist', () => {
  for (const htmlFile of ['menu.html', 'game.html']) {
    const html = fs.readFileSync(path.join(root, htmlFile), 'utf8');
    const sources = [...html.matchAll(/<script[^>]+src="([^"]+)"/g)].map(match => match[1].split('?')[0]);
    for (const source of sources) {
      if (/^https?:/.test(source)) continue;
      assert.ok(fs.existsSync(path.join(root, source)), `${htmlFile}: missing ${source}`);
    }
  }
});

test('terminal command output never assigns user text through innerHTML', () => {
  const menuTerminal = fs.readFileSync(path.join(root, 'src/menu/menu-terminal.js'), 'utf8');
  const gameTerminal = fs.readFileSync(path.join(root, 'src/game/game-terminal.js'), 'utf8');
  assert.doesNotMatch(menuTerminal, /cmdLine\.innerHTML/);
  assert.doesNotMatch(gameTerminal, /div\.innerHTML\s*=\s*msg/);
  assert.match(menuTerminal, /cmdLine\.textContent/);
  assert.match(gameTerminal, /div\.textContent/);
});

test('night lighting enters gradually on one shared darkness curve', () => {
  const context = vm.createContext({ Math });
  runScript('src/game/game-weather.js', context);

  const samples = vm.runInContext(`(() => {
    const alphas = [0, 24, 72, 140, WeatherSystem.colors.night[3]];
    return alphas.map(alpha => {
      WeatherSystem.currentColor = [0, 0, 0, alpha];
      return [WeatherSystem.getDarknessProgress(), WeatherSystem.getLightRadius()];
    });
  })()`, context);

  assert.equal(samples[0][0], 0);
  assert.equal(samples.at(-1)[0], 1);
  assert.equal(samples[0][1], 520);
  assert.equal(samples.at(-1)[1], 230);
  for (let i = 1; i < samples.length; i++) {
    assert.ok(samples[i][0] > samples[i - 1][0], 'darkness should rise continuously');
    assert.ok(samples[i][1] < samples[i - 1][1], 'torch radius should contract continuously');
  }

  const renderer = fs.readFileSync(path.join(root, 'src/game/runtime/renderer.js'), 'utf8');
  assert.match(renderer, /intensity: 0\.42 \* darknessProgress/);
  assert.match(renderer, /eraseStrength: 0\.72 \* darknessProgress/);
});

test('pause panels keep readable text on day and night scenes', () => {
  const context = vm.createContext({ Math, MENU_GOLD_BORDER: '#b8860b' });
  runScript('src/game/game-settings.js', context);

  const palettes = vm.runInContext(`({
    day: getScenePanelPalette(0),
    night: getScenePanelPalette(218)
  })`, context);

  assert.equal(palettes.day.darkScene, false);
  assert.equal(palettes.night.darkScene, true);
  assert.equal(palettes.day.palette.panel, 'rgba(19, 35, 24, 0.94)');
  assert.equal(palettes.night.palette.panel, 'rgba(9, 15, 29, 0.95)');
  assert.equal(palettes.night.palette.text, '#eef4ff');
  assert.doesNotMatch(palettes.night.palette.panel, /207, 172, 108/);
});

test('performance panel is compact and only shows requested summary rows', () => {
  const sharedUi = fs.readFileSync(path.join(root, 'src/shared/shared-ui.js'), 'utf8');
  assert.match(sharedUi, /width: Math\.round\(220 \* scaleFactor\)/);
  assert.match(sharedUi, /height: Math\.round\(24 \* scaleFactor\)/);
  assert.match(sharedUi, /\["CUR"/);
  assert.match(sharedUi, /\["AVG"/);
  assert.match(sharedUi, /\["1%"/);
  assert.match(sharedUi, /\["MODE"/);
  assert.doesNotMatch(sharedUi, /text\("PERFORMANCE"/);
  assert.doesNotMatch(sharedUi, /\["rAF fps"/);
  assert.doesNotMatch(sharedUi, /\["backend"/);
});

test('unlimited Pixi FPS uses the independent loop period, not stale ticker FPS', () => {
  const context = vm.createContext({
    Math,
    Date,
    console,
    performance: { now: () => 1000 },
    window: { _gameFramePeriodMs: 5 },
    RENDER_BACKEND: 'pixi',
    targetFps: 0,
    PixiApp: { app: { ticker: { FPS: 60 } } },
  });
  runScript('src/game/runtime/game-loop.js', context);
  assert.equal(vm.runInContext('FramePerf.snapshot().fps', context), 200);
});

test('objective tracker independently selects the closest living mob and coin', () => {
  const context = vm.createContext({
    Math,
    activeCoins: [{ x: 9, y: 9 }, { x: 2, y: 1 }],
    enemies: [
      { x: 1, y: 1, health: 0 },
      { x: 8, y: 8, health: 4 },
      { x: 3, y: 2, health: 2 },
    ],
  });
  runScript('src/game/game-hud.js', context);
  const targets = vm.runInContext(`({
    coin: findNearestCoin(0, 0),
    mob: findNearestLivingEnemy(0, 0)
  })`, context);
  assert.deepEqual({ ...targets.coin }, { x: 2, y: 1 });
  assert.deepEqual({ ...targets.mob }, { x: 3, y: 2 });

  const locked = vm.runInContext(`(() => {
    const firstMob = getTrackedLivingEnemy(0, 0);
    const firstCoin = getTrackedCoin(0, 0);
    enemies.push({ x: 0.5, y: 0.5, health: 2 });
    activeCoins.push({ x: 0.25, y: 0.25 });
    return {
      firstMob,
      heldMob: getTrackedLivingEnemy(0, 0),
      firstCoin,
      heldCoin: getTrackedCoin(0, 0)
    };
  })()`, context);
  assert.deepEqual({ ...locked.firstMob }, { x: 3, y: 2 });
  assert.deepEqual({ ...locked.heldMob }, { x: 3, y: 2 });
  assert.deepEqual({ ...locked.firstCoin }, { x: 2, y: 1 });
  assert.deepEqual({ ...locked.heldCoin }, { x: 2, y: 1 });

  const hud = fs.readFileSync(path.join(root, 'src/game/game-hud.js'), 'utf8');
  assert.match(hud, /type: 'coin', label: 'COIN', lane: 1/);
  assert.match(hud, /type: 'enemy', label: 'MOB', lane: -1/);
  assert.doesNotMatch(hud, /If on screen, skip pointer/);
  assert.match(hud, /targetIsNearbyAndVisible/);
  assert.doesNotMatch(hud, /markerAngle = Math\.PI \/ 2/);
  assert.match(hud, /lockedObjectiveCoinKey/);
  assert.match(hud, /lockedObjectiveEnemy/);
});

test('loaded maps rebuild the live coin tracker from coin tiles', () => {
  const gameIo = fs.readFileSync(path.join(root, 'src/game/game-io.js'), 'utf8');
  assert.match(gameIo, /function rebuildActiveCoinsFromMap\(\)/);
  assert.match(gameIo, /mapStates\[index\] !== TILE_TYPES\.COIN/);
  assert.equal((gameIo.match(/rebuildActiveCoinsFromMap\(\);/g) || []).length, 2);
});
test('changed runtime scripts use the current cache version', () => {
  const gameHtml = fs.readFileSync(path.join(root, 'game.html'), 'utf8');
  const menuHtml = fs.readFileSync(path.join(root, 'menu.html'), 'utf8');
  assert.match(gameHtml, /src\/shared\/shared-ui\.js\?v=20260804-3/);
  assert.match(gameHtml, /src\/game\/runtime\/game-loop\.js\?v=20260804-1/);
  assert.match(gameHtml, /src\/game\/game-hud\.js\?v=20260804-5/);
  assert.match(gameHtml, /src\/game\/game-io\.js\?v=20260804-1/);
  assert.match(menuHtml, /src\/shared\/shared-ui\.js\?v=20260804-3/);
});
