"""把第二批专属场景按字母序插入 scene-registry.ts（幂等：已存在则跳过）。"""
import json, re, sys

REG = sys.argv[2] if len(sys.argv) > 2 else 'client/src/app/features/experiments/three-scene/scene-registry.ts'
LIST = sys.argv[1] if len(sys.argv) > 1 else '_wave_next50.json'

items = json.load(open(LIST, encoding='utf-8'))
src = open(REG, encoding='utf-8').read()
lines = src.split('\n')

start = next(i for i, l in enumerate(lines) if l.startswith("reg('"))
end = max(i for i, l in enumerate(lines) if l.startswith("reg('"))
existing = set(re.findall(r"^reg\('([^']+)'", src, re.M))
added = []

for it in sorted(items, key=lambda x: x['slug']):
    s, title = it['slug'], it['title']
    if s in existing:
        continue
    block = [f'// {title}', f"reg('{s}', () => import('./scenes/{s}'));"]
    tgt = end + 1
    for i in range(start, end + 1):
        m = re.match(r"reg\('([^']+)'", lines[i])
        if m and m.group(1) > s:
            tgt = i
            break
    lines[tgt:tgt] = block
    src = '\n'.join(lines)
    end += 2
    added.append(s)

n = len(existing) + len(added)
src = re.sub(r'手写实现（\d+ 个）', f'手写实现（{n} 个）', src)
open(REG, 'w', encoding='utf-8', newline='\n').write(src)
print(f'inserted {len(added)} bespoke bindings; bespoke total = {n}')
print('\n'.join('  ' + a for a in added))
