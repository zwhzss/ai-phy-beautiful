# -*- coding: utf-8 -*-
"""核对 docs/3d-scene-plan.md 的 🟢/🟡/⚪ 分类与注册表实际绑定的差异。"""
import json, re, glob, io, sys, os
from collections import defaultdict

sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
ROOT = os.path.dirname(os.path.abspath(__file__))
REG = os.path.join(ROOT, 'client/src/app/features/experiments/three-scene/scene-registry.ts')

kps = {}
for f in glob.glob(os.path.join(ROOT, 'server/internal/seed/data/experiments*.json')):
    for e in json.load(open(f, encoding='utf-8'))['experiments']:
        kps[e['slug']] = {'id': str(e.get('number', '')), 'title': e['title'],
                          'cat': e.get('category_slug', ''), 'desc': e.get('description', '')}

bound = set(re.findall(r"^reg(?:Family)?\('([^']+)'", open(REG, encoding='utf-8').read(), re.M))

plan = open(os.path.join(ROOT, 'docs/3d-scene-plan.md'), encoding='utf-8').read()
tier = {}          # P-number -> marker
for m in re.finditer(r'^-\s*P(\d+)\s+([^\s].*?)\s*(🟢|🟡|⚪|✅)', plan, re.M):
    tier['P' + m.group(1)] = m.group(3)

byid = {k['id']: s for s, k in kps.items()}
print('kps=%d bound=%d plan-marked=%d' % (len(kps), len(bound), len(tier)))

rows = defaultdict(list)
for pid, mk in tier.items():
    s = byid.get(pid)
    if not s:
        rows['BADID'].append((pid, '', mk, ''))
        continue
    rows[mk].append((pid, s, kps[s]['title'], kps[s]['cat']))

for mk in ['🟢', '🟡', '⚪', '✅', 'BADID']:
    rs = rows.get(mk, [])
    nb = [r for r in rs if r[1] not in bound]
    print('%s total=%d unbound=%d' % (mk, len(rs), len(nb)))

# 已绑定但计划里标 ⚪/ 的（反向不一致）
rev = [(pid, s, t, mk) for pid, mk in tier.items() for s in [byid.get(pid)]
       if s and s in bound and mk in ('⚪', '🟡')]
print('bound-but-not-green:', len(rev), rev[:10])

# 绑定了但计划未标记的
unmarked = [s for s in bound if kps.get(s, {}).get('id', '') not in tier]
print('bound-but-unmarked-in-plan:', len(unmarked), unmarked[:15])

yellow = sorted(rows['🟡'], key=lambda r: (r[3], r[0]))
json.dump([{'id': r[0], 'slug': r[1], 'title': r[2], 'cat': r[3]} for r in yellow],
          open(os.path.join(ROOT, '_yellow_unbound.json'), 'w', encoding='utf-8'),
          ensure_ascii=False, indent=1)
cat = defaultdict(int)
for r in yellow:
    cat[r[1] not in bound and r[3] or '(already-bound)'] += 1
print('--- 🟡 by category (unbound only) ---')
for c, n in sorted(cat.items(), key=lambda x: -x[1]):
    print('%4d  %s' % (n, c))
