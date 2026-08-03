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

test('FPS modes keep 60 as default while supporting 120 and unlimited', () => {
  const applied = [];
  const context = vm.createContext({ frameRate: value => applied.push(value) });
  runScript('src/shared/shared-constants.js', context);
  assert.equal(vm.runInContext('DEFAULT_SETTINGS.fpsMode', context), '60');
  assert.equal(vm.runInContext('normalizeFpsMode("120")', context), '120');
  assert.equal(vm.runInContext('getFpsTargetForMode("unlimited")', context), 0);
  vm.runInContext('applyFpsModeToP5("60"); applyFpsModeToP5("120"); applyFpsModeToP5("unlimited")', context);
  assert.deepEqual(applied, [60, 120, Infinity]);
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
