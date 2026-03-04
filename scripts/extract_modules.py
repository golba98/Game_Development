#!/usr/bin/env python3
"""
Extract three modules from 4-Game.js:
  - src/game/game-map.js
  - src/game/game-enemies.js
  - src/game/game-movement.js
"""

import re
import os

GAME_JS = '4-Game.js'
SRC_DIR = 'src/game'

def find_block_end(lines, start):
    """Return the index of the closing } for the block starting at `start`.
    Ignores { } inside parentheses (e.g. default parameter values like opts = {}).
    """
    brace_depth = 0
    paren_depth = 0
    has_open = False
    for i in range(start, len(lines)):
        for ch in lines[i]:
            if ch == '(':
                paren_depth += 1
            elif ch == ')':
                if paren_depth > 0:
                    paren_depth -= 1
            elif ch == '{' and paren_depth == 0:
                brace_depth += 1
                has_open = True
            elif ch == '}' and paren_depth == 0:
                brace_depth -= 1
                if has_open and brace_depth == 0:
                    return i
    return start

def extract_functions(lines, func_names):
    """
    Given a list of lines and function names to extract,
    return (extracted_blocks, remove_flags).
    extracted_blocks: list of (start, end, block_lines)
    remove_flags: bool list parallel to lines
    """
    # Build a set for fast lookup
    name_set = set(func_names)
    remove = [False] * len(lines)
    blocks = []  # list of (start_line_0idx, end_line_0idx)

    i = 0
    while i < len(lines):
        line = lines[i]
        stripped = line.rstrip()
        m = re.match(r'^(?:async\s+)?function\s+(\w+)', stripped)
        if m and m.group(1) in name_set:
            end = find_block_end(lines, i)
            blocks.append((i, end))
            for j in range(i, end + 1):
                remove[j] = True
            i = end + 1
            continue
        i += 1

    return blocks, remove

def build_module_content(lines, blocks, header_comment):
    """Collect lines for a module file from the extracted blocks."""
    parts = [header_comment, '\n']
    for (start, end) in sorted(blocks, key=lambda b: b[0]):
        block_lines = lines[start:end+1]
        parts.extend(block_lines)
        # Ensure blank line separator between functions
        if block_lines and block_lines[-1].strip():
            parts.append('\n')
    return parts

# ── Read source ──────────────────────────────────────────────────────────────
with open(GAME_JS, 'r', encoding='utf-8') as f:
    raw_lines = f.readlines()

# Pre-process: split lines like `}function foo() {` into `}\n` + `function foo() {\n`
# so that brace matching works correctly across adjacent top-level function definitions.
original_lines = []
for line in raw_lines:
    m = re.match(r'^(\s*\})(function\s+\w+.*)$', line.rstrip())
    if m:
        original_lines.append(m.group(1) + '\n')
        original_lines.append(m.group(2) + '\n')
    else:
        original_lines.append(line)

print(f"Source: {len(raw_lines)} lines (expanded to {len(original_lines)} after split)")

# ── Define which functions go where ─────────────────────────────────────────

MAP_FUNCTIONS = [
    'generateMap',
    'generateMap_Part1',
    'generateMap_Part2',
    'computeClearArea',
    'applyNoiseTerrain',
    'postProcessRiversAndClearArea',
    'pruneUnreachable',
    'generateHills',
    'getHillTileType',
    'carveRivers',
    'layBridgeTile',
    'ensureEdgeLayerConnectivity',
    'carveRiversMaybeThrough',
    'carveBranchFromRiver',
    'ensureInteractiveClearArea',
    'smoothRiverTiles',
    'roundRiverTips',
]

ENEMY_FUNCTIONS = [
    'spawnEnemy',
    'createBeetle',
    'createMantis',
    'createMaggot',
    'spawnAcidBlob',
    'updateProjectiles',
    'spawnDamageText',
    'spawnSplat',
    'spawnRipple',
    'spawnFirefly',
    'updateVFX',
    'updateEnemies',
]

MOVEMENT_FUNCTIONS = [
    'handleMovement',
    'tryMoveDirection',
    'handleItemInteraction',
    'canMoveTo',
    'isSolid',
    'deltaToDirection',
    'directionToDelta',
    'startMoveVisual',
    'updateMovementInterpolation',
    'updateSprintState',
    'getActiveMoveDurationMs',
    'getActiveMoveCooldownMs',
    'getCellSizeSpeedScale',
    'drawPlayer',
    '_drawPlayerInternal',
    'findFloodStart',
    'neighbors',
    'findNextStep',
]

# ── Extract all three groups in one pass ─────────────────────────────────────
all_target = set(MAP_FUNCTIONS + ENEMY_FUNCTIONS + MOVEMENT_FUNCTIONS)

combined_remove = [False] * len(original_lines)
map_blocks = []
enemy_blocks = []
movement_blocks = []

i = 0
while i < len(original_lines):
    line = original_lines[i]
    stripped = line.rstrip()
    m = re.match(r'^(?:async\s+)?function\s+(\w+)', stripped)
    if m:
        name = m.group(1)
        if name in all_target:
            end = find_block_end(original_lines, i)
            block = (i, end)
            if name in MAP_FUNCTIONS:
                map_blocks.append(block)
            elif name in ENEMY_FUNCTIONS:
                enemy_blocks.append(block)
            elif name in MOVEMENT_FUNCTIONS:
                movement_blocks.append(block)
            for j in range(i, end + 1):
                combined_remove[j] = True
            i = end + 1
            continue
    i += 1

# ── Report what was found ────────────────────────────────────────────────────
def report(label, blocks, expected_names, all_lines):
    found_names = []
    for (s, e) in blocks:
        m = re.match(r'^(?:async\s+)?function\s+(\w+)', all_lines[s])
        if m:
            found_names.append(m.group(1))
    missing = [n for n in expected_names if n not in found_names]
    print(f"\n{label}: found {len(blocks)} functions, {sum(e-s+1 for s,e in blocks)} lines")
    if missing:
        print(f"  MISSING: {missing}")
    else:
        print(f"  All {len(expected_names)} functions found OK")

report("game-map.js", map_blocks, MAP_FUNCTIONS, original_lines)
report("game-enemies.js", enemy_blocks, ENEMY_FUNCTIONS, original_lines)
report("game-movement.js", movement_blocks, MOVEMENT_FUNCTIONS, original_lines)

# ── Write new module files ───────────────────────────────────────────────────
os.makedirs(SRC_DIR, exist_ok=True)

def write_module(path, blocks, header):
    content = build_module_content(original_lines, blocks, header)
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(content)
    total = sum(e - s + 1 for s, e in blocks)
    print(f"Wrote {path} ({total} extracted lines, file has {len(content)} lines with separators)")

write_module(
    f'{SRC_DIR}/game-map.js',
    map_blocks,
    '// game-map.js — Map generation and river carving\n// Extracted from 4-Game.js\n'
)
write_module(
    f'{SRC_DIR}/game-enemies.js',
    enemy_blocks,
    '// game-enemies.js — Enemy creation, AI, projectiles, and VFX\n// Extracted from 4-Game.js\n'
)
write_module(
    f'{SRC_DIR}/game-movement.js',
    movement_blocks,
    '// game-movement.js — Player movement, collision, interpolation, rendering, pathfinding\n// Extracted from 4-Game.js\n'
)

# ── Write trimmed 4-Game.js ──────────────────────────────────────────────────
kept = [line for flag, line in zip(combined_remove, original_lines) if not flag]
with open(GAME_JS, 'w', encoding='utf-8') as f:
    f.writelines(kept)

removed = sum(combined_remove)
print(f"\n4-Game.js: removed {removed} lines, kept {len(kept)} lines (was {len(original_lines)})")
