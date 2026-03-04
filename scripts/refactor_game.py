import re

with open('4-Game.js', 'r', encoding='utf-8') as f:
    lines = f.readlines()

# Collect all identifiers from src/game files
src_ids = set()
for fname in ['src/game/game-globals.js', 'src/game/game-assets.js', 'src/shared/shared-constants.js']:
    with open(fname, 'r', encoding='utf-8') as f2:
        for line in f2:
            m = re.match(r'^(?:function|let|const|var) (\w+)', line)
            if m:
                src_ids.add(m.group(1))

def find_block_end(lines, start):
    depth = 0
    has_open = False
    for i in range(start, len(lines)):
        for ch in lines[i]:
            if ch == '{':
                depth += 1
                has_open = True
            elif ch == '}':
                depth -= 1
                if has_open and depth == 0:
                    return i
    return start

# Mark lines to remove
remove = [False] * len(lines)

i = 0
while i < len(lines):
    line = lines[i]
    stripped = line.rstrip()

    # Top-level duplicated declaration
    m = re.match(r'^(function|let|const|var) (\w+)', stripped)
    if m:
        kind = m.group(1)
        name = m.group(2)
        if name in src_ids:
            if kind == 'function' or '{' in stripped:
                end = find_block_end(lines, i)
            else:
                end = i
                while end < len(lines) - 1:
                    s = lines[end].rstrip()
                    if s.endswith(';'):
                        break
                    if not s.endswith(',') and not s.endswith('{') and not s.endswith('('):
                        break
                    end += 1
            for j in range(i, end + 1):
                remove[j] = True
            i = end + 1
            continue

    # Canvas patching block
    if stripped.startswith('if (typeof HTMLCanvasElement'):
        end = find_block_end(lines, i)
        for j in range(i, end + 1):
            remove[j] = True
        i = end + 1
        continue

    # try { window.setEdgeLayer... } one-liners
    if stripped.startswith('try { window.setEdgeLayer'):
        remove[i] = True
        i += 1
        continue

    i += 1

# Write cleaned file
kept = [line for r, line in zip(remove, lines) if not r]
with open('4-Game.js', 'w', encoding='utf-8') as f:
    f.writelines(kept)

print(f"Done. Removed {sum(remove)} lines, kept {len(kept)} lines.")
print(f"New file has {len(kept)} lines.")
