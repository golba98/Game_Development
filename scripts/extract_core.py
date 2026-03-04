#!/usr/bin/env python3
"""
Final extraction pass from 4-Game.js:
  - src/game/game-core.js  (setup, draw, windowResized, _confirmResize, createFullWindowCanvas)
  - Remaining constants/vars/init code scattered to existing modules
  - 4-Game.js becomes empty (preserved as entry-point stub)
"""

import re, os

GAME_JS = '4-Game.js'

with open(GAME_JS, 'r', encoding='utf-8') as f:
    lines = f.readlines()

print(f"Source: {len(lines)} lines")

def find_block_end(lines, start):
    brace = paren = 0
    has_open = False
    for i in range(start, len(lines)):
        for ch in lines[i]:
            if ch == '(':   paren += 1
            elif ch == ')':
                if paren > 0: paren -= 1
            elif ch == '{' and paren == 0:
                brace += 1; has_open = True
            elif ch == '}' and paren == 0:
                brace -= 1
                if has_open and brace == 0:
                    return i
    return start

# ── 1. Extract named top-level functions to game-core.js ─────────────────────
CORE_FUNCS = ['setup', 'windowResized', '_confirmResize', 'createFullWindowCanvas', 'draw']
core_blocks = []
remove = [False] * len(lines)

i = 0
while i < len(lines):
    m = re.match(r'^function\s+(\w+)', lines[i])
    if m and m.group(1) in CORE_FUNCS:
        end = find_block_end(lines, i)
        core_blocks.append((i, end))
        for j in range(i, end + 1):
            remove[j] = True
        i = end + 1
        continue
    i += 1

print(f"\ngame-core.js: {len(core_blocks)} functions extracted")

# ── 2. Collect remaining non-blank, non-comment content for redistribution ───
# Identify specific blocks to move

appends = {}  # path -> list of text chunks

def sched(path, text):
    appends.setdefault(path, []).append(text)

# DECOR constants -> game-world.js
decor_const_lines = []
in_decor = False
for i, line in enumerate(lines):
    if re.match(r'^const DECOR_MAX_DENSITY', line):
        in_decor = True
    if in_decor:
        decor_const_lines.append(i)
        remove[i] = True
        if line.strip().endswith(';') and 'DECOR_OBSTACLE_SPAWN_CHANCE' in line:
            in_decor = False
            break

if decor_const_lines:
    chunk = ''.join(lines[decor_const_lines[0]:decor_const_lines[-1]+1])
    sched('src/game/game-world.js', '\n// ── Decor density constants ──\n' + chunk)
    print(f"DECOR constants -> game-world.js ({len(decor_const_lines)} lines)")

# CATEGORY_BUILDERS -> game-settings.js
for i, line in enumerate(lines):
    if re.match(r'^const CATEGORY_BUILDERS', line):
        end = find_block_end(lines, i)
        # ends with `};`
        end_line = end
        # include the semicolon line
        if end_line < len(lines) - 1 and lines[end_line].rstrip().endswith('}'):
            if end_line + 1 < len(lines) and lines[end_line + 1].strip() == '':
                pass
        chunk = ''.join(lines[i:end_line+1])
        sched('src/game/game-settings.js', '\n// ── Category builders map ──\n' + chunk + '\n')
        for j in range(i, end_line + 1):
            remove[j] = True
        print(f"CATEGORY_BUILDERS -> game-settings.js")
        break

# _rawTextSizeFn, _textSizeBaseValue, _textSizeOverrideInstalled -> game-settings.js
text_size_var_lines = []
for i, line in enumerate(lines):
    if re.match(r'^let _rawTextSizeFn|^let _textSizeBaseValue|^let _textSizeOverrideInstalled', line):
        text_size_var_lines.append(i)
        remove[i] = True

if text_size_var_lines:
    chunk = ''.join(lines[j] for j in text_size_var_lines)
    sched('src/game/game-settings.js', '\n// ── Text size override state ──\n' + chunk)
    print(f"Text size vars -> game-settings.js")

# clearObjectValues + releaseGameAssets -> game-world.js
for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped.startswith('function clearObjectValues(') or re.match(r'\s+function clearObjectValues\(', line):
        end = find_block_end(lines, i)
        chunk = ''.join(lines[i:end+1]).lstrip()
        sched('src/game/game-world.js', '\n' + chunk + '\n')
        for j in range(i, end+1): remove[j] = True
        print(f"clearObjectValues -> game-world.js")
        break

for i, line in enumerate(lines):
    if re.match(r'\s+function releaseGameAssets\(', line) or line.strip().startswith('function releaseGameAssets('):
        end = find_block_end(lines, i)
        chunk = ''.join(lines[i:end+1]).lstrip()
        sched('src/game/game-world.js', '\n' + chunk + '\n')
        for j in range(i, end+1): remove[j] = True
        print(f"releaseGameAssets -> game-world.js")
        break

# Audio unlock event listener -> game-ui.js
for i, line in enumerate(lines):
    if re.match(r"^\['pointerdown', 'keydown'\]", line):
        end = find_block_end(lines, i)
        # ends with `});`
        chunk = ''.join(lines[i:end+1])
        sched('src/game/game-ui.js', '\n// ── Audio unlock on first interaction ──\n' + chunk + '\n')
        for j in range(i, end+1): remove[j] = True
        print(f"Audio unlock listener -> game-ui.js")
        break

# window.applyCurrentTextSize export -> game-settings.js
for i, line in enumerate(lines):
    if 'window.applyCurrentTextSize' in line and line.strip().startswith('try'):
        end = find_block_end(lines, i)
        chunk = ''.join(lines[i:end+1])
        sched('src/game/game-settings.js', '\n' + chunk + '\n')
        for j in range(i, end+1): remove[j] = True
        print(f"window.applyCurrentTextSize export -> game-settings.js")
        break

# ensureLoadingOverlayDom() init call -> game-ui.js
for i, line in enumerate(lines):
    if line.strip().startswith('try { ensureLoadingOverlayDom()'):
        chunk = lines[i]
        sched('src/game/game-ui.js', '\n' + chunk)
        remove[i] = True
        print(f"ensureLoadingOverlayDom init call -> game-ui.js")
        break

# persistentGameId localStorage init block -> game-io.js
for i, line in enumerate(lines):
    if re.match(r'^try \{$', line.rstrip()) and i + 1 < len(lines):
        if 'localStorage' in lines[i+1] and '__gd_test__' in lines[i+1]:
            end = find_block_end(lines, i)
            chunk = ''.join(lines[i:end+1])
            # Also grab the next try block (persistentGameId init)
            j = end + 1
            while j < len(lines) and not lines[j].strip():
                j += 1
            if j < len(lines) and re.match(r'^try \{', lines[j]):
                end2 = find_block_end(lines, j)
                chunk += ''.join(lines[j:end2+1])
                for k in range(j, end2+1): remove[k] = True
            sched('src/game/game-io.js', '\n// ── localStorage availability check + persistentGameId init ──\n' + chunk + '\n')
            for k in range(i, end+1): remove[k] = True
            print(f"localStorage + persistentGameId init -> game-io.js")
            break

# ── 3. Write game-core.js ─────────────────────────────────────────────────────
core_parts = ['// game-core.js — p5.js lifecycle: setup, draw, windowResized, resize helpers\n// Extracted from 4-Game.js\n\n']
for (s, e) in sorted(core_blocks):
    core_parts.extend(lines[s:e+1])
    if lines[e].strip():
        core_parts.append('\n')

with open('src/game/game-core.js', 'w', encoding='utf-8') as f:
    f.writelines(core_parts)
total_core = sum(e-s+1 for s,e in core_blocks)
print(f"\nWrote src/game/game-core.js ({total_core} lines)")

# ── 4. Append to existing modules ─────────────────────────────────────────────
for path, chunks in appends.items():
    with open(path, 'a', encoding='utf-8') as f:
        for chunk in chunks:
            f.write(chunk)
    print(f"Appended to {path}: {len(chunks)} block(s)")

# ── 5. Write stub 4-Game.js ───────────────────────────────────────────────────
stub = '// 4-Game.js — All logic has been moved to src/game/ modules.\n// This file is preserved as a historical entry point.\n'
with open(GAME_JS, 'w', encoding='utf-8') as f:
    f.write(stub)
print(f"\n4-Game.js -> stub (2 lines). Was {len(lines)} lines.")
