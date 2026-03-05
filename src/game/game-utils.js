// game-utils.js — Shared utilities: tile state, flood fill, color lookup, shuffle
// Extracted from 4-Game.js

const DEFAULT_TILE_COLOR = [255, 0, 255]; // magenta fallback for unmapped tile states

// Clamps `value` to the inclusive range [min, max].
function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

// Shuffles an array in-place using Fisher-Yates algorithm.
function shuffleArray(array) {
  if (!Array.isArray(array) || array.length <= 1) return;
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
}

// Returns the tile state at (x, y) from the given layer, or -1 if out of bounds.
function getTileState(x, y, layer = mapStates) {
  if (x < 0 || x >= logicalW || y < 0 || y >= logicalH) return -1;
  return layer[y * logicalW + x];
}

// BFS flood-fill from the player's position; returns a Uint8Array of reachable tile flags.
function floodReachable(options = {}) {
  let respectEdgeLayer = Object.prototype.hasOwnProperty.call(options, 'respectEdgeLayer') ? !!options.respectEdgeLayer : true;

  if (!EDGE_LAYER_ENABLED) respectEdgeLayer = false;
  if (!logicalW || !logicalH) return new Uint8Array(0);
  const total = logicalW * logicalH;
  const visited = new Uint8Array(total);
  if (!mapStates || mapStates.length !== total) return visited;
  const startIdx = findFloodStart();
  if (startIdx < 0) return visited;
  const queue = new Array(total);
  let head = 0;
  let tail = 0;
  queue[tail++] = startIdx;
  visited[startIdx] = 1;
  while (head < tail) {
    const idx = queue[head++];
    const x = idx % logicalW;
    const y = Math.floor(idx / logicalW);
    const next = [
      { nx: x - 1, ny: y },
      { nx: x + 1, ny: y },
      { nx: x, ny: y - 1 },
      { nx: x, ny: y + 1 }
    ];
    for (const { nx, ny } of next) {
      if (nx < 0 || nx >= logicalW || ny < 0 || ny >= logicalH) continue;
      const nIdx = ny * logicalW + nx;
      if (visited[nIdx]) continue;
      const state = getTileState(nx, ny);
      if (isSolid(state)) continue;
      if (respectEdgeLayer && edgeLayer && edgeLayer.length === total && edgeLayer[nIdx]) continue;
      visited[nIdx] = 1;
      queue[tail++] = nIdx;
    }
  }
  return visited;
}

// Returns the RGB color array for a tile state, or DEFAULT_TILE_COLOR if unmapped.
function getColorForState(state) {
  if (typeof COLORS !== 'undefined' && COLORS[state]) {
    return COLORS[state];
  }
  return DEFAULT_TILE_COLOR;
}
