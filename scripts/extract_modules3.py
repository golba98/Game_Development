#!/usr/bin/env python3
"""
Third extraction pass from 4-Game.js:
  - src/game/game-input.js     (player input, attack, key/mouse handlers)
  - src/game/game-world.js     (decor, map image, game state reset, difficulty, environment)
  - src/game/game-utils.js     (getTileState, floodReachable, getColorForState, shuffleArray)
"""

import re
import os

GAME_JS = '4-Game.js'
SRC_DIR = 'src/game'

def find_block_end(lines, start):
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

INPUT_FUNCTIONS = [
    'startPlayerAttack',
    'mousePressed',
    'togglePauseMenuFromEscape',
    'keyPressed',
]

WORLD_FUNCTIONS = [
    'drawTileToMap',
    'createMapImage',
    'clearPreviousGameState',
    'markDecorObjectsDirty',
    'spawnDecorativeObjects',
    'RandomEnvironment',
    'applyEnvironmentDefaults',
    'normalizeDifficultyValue',
    'setDifficulty',
    'getDifficultyDisplayLabel',
]

UTILS_FUNCTIONS = [
    'shuffleArray',
    'getTileState',
    'floodReachable',
    'getColorForState',
]

# ── Read source ──────────────────────────────────────────────────────────────
with open(GAME_JS, 'r', encoding='utf-8') as f:
    raw_lines = f.readlines()

original_lines = []
for line in raw_lines:
    m = re.match(r'^(\s*\})(function\s+\w+.*)$', line.rstrip())
    if m:
        original_lines.append(m.group(1) + '\n')
        original_lines.append(m.group(2) + '\n')
    else:
        original_lines.append(line)

print(f"Source: {len(raw_lines)} lines")

all_target = set(INPUT_FUNCTIONS + WORLD_FUNCTIONS + UTILS_FUNCTIONS)
module_map = {}
for n in INPUT_FUNCTIONS: module_map[n] = 'input'
for n in WORLD_FUNCTIONS: module_map[n] = 'world'
for n in UTILS_FUNCTIONS: module_map[n] = 'utils'

combined_remove = [False] * len(original_lines)
blocks_by_module = {'input': [], 'world': [], 'utils': []}

i = 0
while i < len(original_lines):
    line = original_lines[i]
    m = re.match(r'^(?:async\s+)?function\s+(\w+)', line)
    if m:
        name = m.group(1)
        if name in all_target:
            end = find_block_end(original_lines, i)
            mod = module_map[name]
            blocks_by_module[mod].append((i, end))
            for j in range(i, end + 1):
                combined_remove[j] = True
            i = end + 1
            continue
    i += 1

def report(label, func_list, blocks, lines):
    found = set()
    for (s, e) in blocks:
        mx = re.match(r'^(?:async\s+)?function\s+(\w+)', lines[s])
        if mx: found.add(mx.group(1))
    missing = [n for n in func_list if n not in found]
    total = sum(e - s + 1 for s, e in blocks)
    print(f"\n{label}: {len(blocks)} functions, {total} lines")
    if missing:
        print(f"  MISSING: {missing}")
    else:
        print(f"  All {len(func_list)} expected functions found OK")

report("game-input.js", INPUT_FUNCTIONS, blocks_by_module['input'], original_lines)
report("game-world.js", WORLD_FUNCTIONS, blocks_by_module['world'], original_lines)
report("game-utils.js", UTILS_FUNCTIONS, blocks_by_module['utils'], original_lines)

HEADERS = {
    'input': '// game-input.js — Player input: attack, mouse, keyboard handlers\n// Extracted from 4-Game.js\n',
    'world': '// game-world.js — Decorative objects, map image, game state, difficulty, environment\n// Extracted from 4-Game.js\n',
    'utils': '// game-utils.js — Shared utilities: tile state, flood fill, color lookup, shuffle\n// Extracted from 4-Game.js\n',
}
FILENAMES = {
    'input': f'{SRC_DIR}/game-input.js',
    'world': f'{SRC_DIR}/game-world.js',
    'utils': f'{SRC_DIR}/game-utils.js',
}

for key, path in FILENAMES.items():
    blocks = sorted(blocks_by_module[key], key=lambda b: b[0])
    parts = [HEADERS[key], '\n']
    for (s, e) in blocks:
        parts.extend(original_lines[s:e+1])
        if original_lines[e].strip():
            parts.append('\n')
    with open(path, 'w', encoding='utf-8') as f:
        f.writelines(parts)
    total = sum(e - s + 1 for s, e in blocks)
    print(f"Wrote {path} ({total} extracted lines)")

kept = [line for flag, line in zip(combined_remove, original_lines) if not flag]
with open(GAME_JS, 'w', encoding='utf-8') as f:
    f.writelines(kept)

removed = sum(combined_remove)
print(f"\n4-Game.js: removed {removed} lines, kept {len(kept)} (was {len(raw_lines)})")
