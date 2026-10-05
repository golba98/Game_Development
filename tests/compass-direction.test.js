const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');
const path = require('node:path');
const source = fs.readFileSync(path.join(__dirname, '../src/game/game-hud.js'), 'utf8');
const context = vm.createContext({ Math });
vm.runInContext(source, context);
const geometry = context.getCompassMarkerGeometry;
const bounds = { left: 40, right: 1560, top: 168, bottom: 852 };

function assertAimsAtTarget(marker, x, y, limits = bounds) {
  assert.ok(marker);
  assert.ok(Number.isFinite(marker.x) && Number.isFinite(marker.y) && Number.isFinite(marker.angle));
  assert.ok(marker.x >= limits.left && marker.x <= limits.right);
  assert.ok(marker.y >= limits.top && marker.y <= limits.bottom);
  const dx = x - marker.x;
  const dy = y - marker.y;
  const length = Math.hypot(dx, dy);
  assert.ok(length > 0);
  const dot = Math.cos(marker.angle) * dx / length + Math.sin(marker.angle) * dy / length;
  assert.ok(dot > 0.999999, `arrow must face target, dot=${dot}`);
}

test('visible 13-tile portal stays beside its target and points inward', () => {
  const marker = geometry(784, 432, 464, 176, bounds, 34);
  assert.equal(marker.targetIsVisible, true);
  assertAimsAtTarget(marker, 464, 176);
  assert.ok(marker.x > 464 && marker.y > 176);
  assert.ok(Math.hypot(marker.x - 464, marker.y - 176) <= 34.001);
});

test('visible marker placement does not switch at the 12-tile lock threshold', () => {
  for (const tiles of [11.9, 12, 12.1, 13]) {
    const x = 800 + tiles * 32;
    const marker = geometry(800, 450, x, 450, bounds, 34);
    assert.equal(marker.targetIsVisible, true);
    assert.equal(marker.x, x - 34);
    assertAimsAtTarget(marker, x, 450);
  }
});

test('all bearings remain correct after visible clamping and offscreen lane offsets', () => {
  for (const dx of [-1, 0, 1]) for (const dy of [-1, 0, 1]) {
    if (!dx && !dy) continue;
    for (const distance of [100, 1600]) for (const lane of [-14, 0, 14]) {
      const x = 800 + dx * distance;
      const y = 450 + dy * distance;
      const marker = geometry(800, 450, x, y, bounds, 34, lane);
      assertAimsAtTarget(marker, x, y);
    }
  }
});

test('a player outside HUD bounds never produces a backwards intersection', () => {
  for (const player of [[0, 0], [1700, 950], [800, 100]]) {
    for (const target of [[-100, 200], [1800, -100], [800, 1000], [40, 168]]) {
      assertAimsAtTarget(geometry(...player, ...target, bounds, 34, 14), ...target);
    }
  }
});

test('coincident targets are hidden and collapsed placements recover inward', () => {
  assert.equal(geometry(100, 100, 100, 100, bounds, 34), null);
  assertAimsAtTarget(geometry(0, 0, 40, 168, bounds, 34), 40, 168);
  const tiny = { left: 40, right: 40, top: 40, bottom: 40 };
  assert.equal(geometry(0, 0, 40, 40, tiny, 34), null);
});

test('drawCompass uses final geometry for each objective with fractional camera and movement', () => {
  const drawn = [];
  const ctx = vm.createContext({
    Math, playerPosition: { x: 24, y: 13 }, isMoving: true, renderX: 24.25, renderY: 13.5,
    cellSize: 32, smoothCamX: 0.25, smoothCamY: 0.75,
    enemies: [{ x: 14, y: 5, health: 1 }], activeCoins: [{ x: 35, y: 9 }],
    isPortalActive: true, portalPos: { x: 14, y: 5 }, performanceOverlayEnabled: false,
    uiFont: null, color: (...levels) => ({ levels }), map: () => 255,
    sin: Math.sin, millis: () => 0, CENTER: 0, TOP: 0, BOTTOM: 0, CLOSE: 0,
    push() {}, pop() {},
    translate(x, y) { drawn.push({ x, y }); },
    rotate(angle) { if (drawn.at(-1).angle === undefined) drawn.at(-1).angle = angle; },
  });
  for (const name of ['fill', 'noStroke', 'beginShape', 'vertex', 'endShape', 'stroke',
    'strokeWeight', 'textAlign', 'textSize', 'text']) ctx[name] = () => {};
  vm.runInContext(source, ctx);
  vm.runInContext(`getHudLayout = () => ({ safeArea: { left: 0, top: 0, right: 1600, bottom: 900 },
    uiScaleFactor: 1, margin: 24, playerPanelY: 20, playerPanelH: 120, playerPanelPad: 10 });
    drawCompass();`, ctx);
  assert.equal(drawn.length, 3);
  for (const [index, position] of [[14, 5], [35, 9], [14, 5]].entries()) {
    assertAimsAtTarget(drawn[index], position[0] * 32 + 16 - 0.25,
      position[1] * 32 + 16 - 0.75, { left: 0, right: 1600, top: 0, bottom: 900 });
  }
});
