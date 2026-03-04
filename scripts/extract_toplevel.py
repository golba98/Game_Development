#!/usr/bin/env python3
"""
Move top-level non-function blocks out of 4-Game.js.

Blocks to move:
  1. window.addEventListener('message', ...) (game-io.js)
  2. try { window.addEventListener('keydown', ...) } Escape handler (game-input.js)
  3. window.locatePortal = locatePortal  — ALREADY added to game-hud.js; just delete
  4. window.addEventListener('keydown', ...) WASD (game-input.js)
  5. const TRANSLATIONS = {...} (game-settings.js)
  6. (function(){...})() error IIFE (game-ui.js)
"""

import re

GAME_JS = '4-Game.js'

with open(GAME_JS, 'r', encoding='utf-8') as f:
    content = f.read()

lines = content.splitlines(keepends=True)

# ── Helper: find matching closing of a brace/paren block ─────────────────────
def find_end_line(lines, start, open_ch, close_ch):
    depth = 0
    for i in range(start, len(lines)):
        for ch in lines[i]:
            if ch == open_ch:
                depth += 1
            elif ch == close_ch:
                depth -= 1
                if depth == 0:
                    return i
    return start

# We'll collect ranges to remove and content to append to target files
removals = []      # list of (start, end) line indices (0-based, inclusive)
appends  = {}      # file path -> list of str chunks

def schedule_append(path, text):
    appends.setdefault(path, []).append(text)

# ── 1. Move window.addEventListener('message', ...) to game-io.js ─────────────
for i, line in enumerate(lines):
    if line.startswith("window.addEventListener('message',"):
        end = find_end_line(lines, i, '{', '}')
        # closing line is `}, false);`
        block = ''.join(lines[i:end+1])
        schedule_append('src/game/game-io.js', '\n// ── Game message handler ──\n' + block + '\n')
        removals.append((i, end))
        break

# ── 2. Move Escape keydown handler to game-input.js ───────────────────────────
for i, line in enumerate(lines):
    stripped = line.strip()
    if stripped == 'try {' and i + 1 < len(lines):
        next_stripped = lines[i+1].strip()
        if next_stripped.startswith("window.addEventListener('keydown'") and 'Escape' in ''.join(lines[i:i+5]):
            # find the outer try { } block
            end = find_end_line(lines, i, '{', '}')
            # Also grab the catch message on the same or next line
            # The block ends with: `} catch (e) { console.warn(...) }`
            block = ''.join(lines[i:end+1])
            schedule_append('src/game/game-input.js', '\n// ── Escape key handler ──\n' + block + '\n')
            removals.append((i, end))
            break

# ── 3. Remove window.locatePortal = locatePortal (already in game-hud.js) ─────
for i, line in enumerate(lines):
    if line.strip() == 'window.locatePortal = locatePortal;':
        removals.append((i, i))
        break

# ── 4. Move WASD keydown handler to game-input.js ────────────────────────────
for i, line in enumerate(lines):
    if line.startswith("window.addEventListener('keydown', (ev) =>"):
        end = find_end_line(lines, i, '{', '}')
        block = ''.join(lines[i:end+1])
        schedule_append('src/game/game-input.js', '\n// ── WASD + P key handler ──\n' + block + '\n')
        removals.append((i, end))
        break

# ── 5. Move TRANSLATIONS to game-settings.js ─────────────────────────────────
for i, line in enumerate(lines):
    if line.startswith('const TRANSLATIONS = {'):
        end = find_end_line(lines, i, '{', '}')
        # closing `};` is on end line — include it
        block = ''.join(lines[i:end+1])
        schedule_append('src/game/game-settings.js', '\n// ── Translations data ──\n' + block + '\n')
        removals.append((i, end))
        break

# ── 6. Move error IIFE to game-ui.js ─────────────────────────────────────────
for i, line in enumerate(lines):
    if line.startswith('(function(){'):
        end = find_end_line(lines, i, '(', ')')
        # Might end with `})();`
        block = ''.join(lines[i:end+1])
        schedule_append('src/game/game-ui.js', '\n// ── Error display helper ──\n' + block + '\n')
        removals.append((i, end))
        break

# ── Report ─────────────────────────────────────────────────────────────────────
print(f"Blocks to remove from 4-Game.js: {len(removals)}")
for s, e in removals:
    preview = lines[s].rstrip()[:70]
    print(f"  lines {s+1}-{e+1}: {preview}")

# ── Apply removals ────────────────────────────────────────────────────────────
remove_set = set()
for s, e in removals:
    for j in range(s, e+1):
        remove_set.add(j)

kept = [line for i, line in enumerate(lines) if i not in remove_set]
with open(GAME_JS, 'w', encoding='utf-8') as f:
    f.writelines(kept)
print(f"\n4-Game.js: removed {len(remove_set)} lines, kept {len(kept)} (was {len(lines)})")

# ── Append to target files ────────────────────────────────────────────────────
for path, chunks in appends.items():
    with open(path, 'a', encoding='utf-8') as f:
        for chunk in chunks:
            f.write(chunk)
    print(f"Appended to {path}: {len(chunks)} block(s)")
