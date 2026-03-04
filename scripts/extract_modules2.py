#!/usr/bin/env python3
"""
Second extraction pass from 4-Game.js:
  - src/game/game-hud.js       (HUD drawing)
  - src/game/game-ui.js        (menus, transitions, victory/gameover, audio helpers)
  - src/game/game-settings.js  (settings panels, DOM styles, translation)
  - src/game/game-io.js        (map save/load, settings persistence)
  - src/game/game-terminal.js  (in-game debug terminal)
  - src/game/game-tutorial.js  (tutorial system)
"""

import re
import os

GAME_JS = '4-Game.js'
SRC_DIR = 'src/game'

def find_block_end(lines, start):
    """Brace-match aware; ignores { } inside parentheses (e.g. default params)."""
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

# ── Function groups ──────────────────────────────────────────────────────────

HUD_FUNCTIONS = [
    'drawHealthBar',
    'drawBossHealthBar',
    'drawMinimap',
    'drawScore',
    'drawInventory',
    'drawVignette',
    'drawDifficultyBadge',
    'drawSprintMeter',
    'findGoalPosition',
    'findNearestCoin',
    'drawCompass',
    'locatePortal',
    'updateClouds',
    'drawClouds',
    'spawnCloud',
]

UI_FUNCTIONS = [
    'openInGameMenu',
    'closeInGameMenu',
    'startLevelTransition',
    'handleTransitionLogic',
    'triggerGameOver',
    'hasAnyCoins',
    'triggerVictory',
    'showVictoryScreen',
    'showGameOverScreen',
    'restartGame',
    'exitToMenu',
    'drawInGameMenu',
    'drawInGameMenu_OLD',
    'showToast',
    'styleSmallButton',
    'ensureLoopFallbackBuffer',
    'startMenuMusicIfNeeded',
    'unlockAudioAndStart',
    'attemptStartGameMusic',
]

SETTINGS_FUNCTIONS = [
    'applySettingsTabSkin',
    'applyMenuButtonUI',
    'decorateSettingsPanel',
    'closeInGameSettings',
    'showSubSettings',
    'getTextScale',
    'gTextSize',
    'ensureTextSizeOverride',
    'applyCurrentTextSize',
    'updateLoadingOverlayDom',
    'injectCustomStyles',
    'openInGameSettings',
    'hideCategoryButtons',
    'hideBottomButtons',
    'makeBtn',
    'createBgImg',
    'makeSmallBtn',
    'createSettingLabel',
    'updateTextSizeButtonStyles',
    'syncSlidersToSettings',
    'clearSubSettings',
    'hideMainMenu',
    'showMainMenu',
    'hideSettingsMenu',
    'stylePixelButton',
    'buildAudioSettings',
    'buildGameplaySettings',
    'buildControlsSettings',
    'applyColorMode',
    'buildAccessibilitySettings',
    't',
    'buildLanguageSettings',
    'createSettingsContext',
    'ensureLoadingOverlayDom',
    'measureZoomViaInch',
    'estimateBrowserZoom',
    'makeElementZoomInvariant',
    'createZoomStablePanel',
]

IO_FUNCTIONS = [
    'buildActiveMapPayload',
    'saveMap',
    'downloadMapJSON',
    'autosaveMap',
    'shouldAttemptMapFetch',
    'tryFetchActiveMap',
    'applyLoadedMap',
    'loadMapFromStorage',
    'showFilePickerToLoadActiveMap',
    'persistActiveMapToServer',
    'persistSavedSettings',
    'saveLocalSettings',
    'saveLocalSettingsDebounced',
    'loadLocalSettings',
    'applyVolumes',
]

TERMINAL_FUNCTIONS = [
    'toggleTerminal',
    'createTerminalUI',
    'processTerminalCommand',
]

TUTORIAL_FUNCTIONS = [
    'loadTutorialMap',
    '_countCoins',
    '_sprintKeyLabel',
    '_attackKeyLabel',
    '_advanceTutorial',
    '_setTutorialMsg',
    'showTutorial',
    'handleTutorialLogic',
    'drawTutorial',
    'drawLegacyTutorial',
]

# Functions that appear more than once — keep ONLY the last definition
# (earlier ones are stubs/outdated; last definition wins in JS anyway)
KEEP_LAST_ONLY = {
    'playClickSFX',   # 2774=empty stub, 5032=real → keep 5032 in game-ui.js
    'styleButton',    # 2712=basic, 5106=extended → keep 5106 in game-settings.js
}

# Assign deduped functions to their target module
KEEP_LAST_TARGET = {
    'playClickSFX': 'ui',
    'styleButton': 'settings',
}

# ── Read source ──────────────────────────────────────────────────────────────
with open(GAME_JS, 'r', encoding='utf-8') as f:
    raw_lines = f.readlines()

# Pre-process: split lines like `}function foo() {` so brace-matching works
original_lines = []
for line in raw_lines:
    m = re.match(r'^(\s*\})(function\s+\w+.*)$', line.rstrip())
    if m:
        original_lines.append(m.group(1) + '\n')
        original_lines.append(m.group(2) + '\n')
    else:
        original_lines.append(line)

print(f"Source: {len(raw_lines)} lines (expanded to {len(original_lines)})")

# ── Build target sets ────────────────────────────────────────────────────────
all_target = set(
    HUD_FUNCTIONS + UI_FUNCTIONS + SETTINGS_FUNCTIONS +
    IO_FUNCTIONS + TERMINAL_FUNCTIONS + TUTORIAL_FUNCTIONS
) | KEEP_LAST_ONLY

module_map = {}
for n in HUD_FUNCTIONS:      module_map[n] = 'hud'
for n in UI_FUNCTIONS:       module_map[n] = 'ui'
for n in SETTINGS_FUNCTIONS: module_map[n] = 'settings'
for n in IO_FUNCTIONS:       module_map[n] = 'io'
for n in TERMINAL_FUNCTIONS: module_map[n] = 'terminal'
for n in TUTORIAL_FUNCTIONS: module_map[n] = 'tutorial'
for n, mod in KEEP_LAST_TARGET.items():
    module_map[n] = mod

# ── One-pass extraction ──────────────────────────────────────────────────────
combined_remove = [False] * len(original_lines)

# For KEEP_LAST_ONLY: first collect ALL occurrences, then only keep last
dedup_occurrences = {name: [] for name in KEEP_LAST_ONLY}

blocks_by_module = {
    'hud': [], 'ui': [], 'settings': [], 'io': [], 'terminal': [], 'tutorial': []
}

i = 0
while i < len(original_lines):
    line = original_lines[i]
    m = re.match(r'^(?:async\s+)?function\s+(\w+)', line)
    if m:
        name = m.group(1)
        if name in all_target:
            end = find_block_end(original_lines, i)
            block = (i, end)
            if name in KEEP_LAST_ONLY:
                dedup_occurrences[name].append(block)
            else:
                mod = module_map[name]
                blocks_by_module[mod].append(block)
                for j in range(i, end + 1):
                    combined_remove[j] = True
            i = end + 1
            continue
    i += 1

# Handle KEEP_LAST_ONLY: mark all as remove, but add only last to module
for name, occ_list in dedup_occurrences.items():
    if not occ_list:
        print(f"  WARNING: {name} not found!")
        continue
    # Mark ALL for removal
    for (s, e) in occ_list:
        for j in range(s, e + 1):
            combined_remove[j] = True
    # Add only the LAST occurrence to the module
    last_block = occ_list[-1]
    mod = KEEP_LAST_TARGET[name]
    blocks_by_module[mod].append(last_block)
    if len(occ_list) > 1:
        print(f"  Deduped {name}: removed {len(occ_list)-1} earlier definitions, kept last at line {last_block[0]+1}")

# ── Report ───────────────────────────────────────────────────────────────────
def report(label, func_list, blocks, lines):
    found = set()
    for (s, e) in blocks:
        mx = re.match(r'^(?:async\s+)?function\s+(\w+)', lines[s])
        if mx: found.add(mx.group(1))
    missing = [n for n in func_list if n not in found]
    total_lines = sum(e - s + 1 for s, e in blocks)
    print(f"\n{label}: {len(blocks)} functions, {total_lines} lines")
    if missing:
        print(f"  MISSING: {missing}")
    else:
        print(f"  All {len(func_list)} expected functions found OK")

report("game-hud.js",      HUD_FUNCTIONS,      blocks_by_module['hud'],      original_lines)
report("game-ui.js",       UI_FUNCTIONS,       blocks_by_module['ui'],       original_lines)
report("game-settings.js", SETTINGS_FUNCTIONS, blocks_by_module['settings'], original_lines)
report("game-io.js",       IO_FUNCTIONS,       blocks_by_module['io'],       original_lines)
report("game-terminal.js", TERMINAL_FUNCTIONS, blocks_by_module['terminal'], original_lines)
report("game-tutorial.js", TUTORIAL_FUNCTIONS, blocks_by_module['tutorial'], original_lines)

# ── Write modules ────────────────────────────────────────────────────────────
os.makedirs(SRC_DIR, exist_ok=True)

HEADERS = {
    'hud':      '// game-hud.js — HUD: health bar, minimap, score, inventory, compass, clouds\n// Extracted from 4-Game.js\n',
    'ui':       '// game-ui.js — In-game menus, transitions, victory/game-over, audio helpers\n// Extracted from 4-Game.js\n',
    'settings': '// game-settings.js — Settings panels, DOM styles, translation, zoom helpers\n// Extracted from 4-Game.js\n',
    'io':       '// game-io.js — Map save/load, settings persistence, server sync\n// Extracted from 4-Game.js\n',
    'terminal': '// game-terminal.js — In-game debug terminal (game-side commands)\n// Extracted from 4-Game.js\n',
    'tutorial': '// game-tutorial.js — Tutorial system and legacy tutorial\n// Extracted from 4-Game.js\n',
}
FILENAMES = {
    'hud':      f'{SRC_DIR}/game-hud.js',
    'ui':       f'{SRC_DIR}/game-ui.js',
    'settings': f'{SRC_DIR}/game-settings.js',
    'io':       f'{SRC_DIR}/game-io.js',
    'terminal': f'{SRC_DIR}/game-terminal.js',
    'tutorial': f'{SRC_DIR}/game-tutorial.js',
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

# ── Write trimmed 4-Game.js ──────────────────────────────────────────────────
kept = [line for flag, line in zip(combined_remove, original_lines) if not flag]
with open(GAME_JS, 'w', encoding='utf-8') as f:
    f.writelines(kept)

removed = sum(combined_remove)
print(f"\n4-Game.js: removed {removed} lines, kept {len(kept)} (was {len(original_lines)})")
