#!/usr/bin/env python3
"""Verify scene-registry bindings against implemented family mode keys.

Checks:
  1. every regFamily(...) (slug, family, variant) has a matching `case 'variant':`
     (or is reachable via that family's default) in families/<family>.ts
  2. every reg('slug', './scenes/x') points at an existing scene file
  3. every family module file exists and exports `make`
  4. no duplicate slug registrations
"""
import os
import re
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
BASE = os.path.join(ROOT, 'client', 'src', 'app', 'features', 'experiments', 'three-scene')
REG = os.path.join(BASE, 'scene-registry.ts')

text = open(REG, encoding='utf-8').read()
fam_reg = re.findall(r"^regFamily\('([^']+)', '([^']+)', '([^']+)', '([^']+)'\);", text, re.M)
scene_reg = re.findall(r"^reg\('([^']+)', \(\) => import\('\./scenes/([^']+)'\)\);", text, re.M)

problems = []

# 1 + 3: families
fam_variants = {}
for slug, fam, variant, title in fam_reg:
    fam_variants.setdefault(fam, set()).add(variant)

for fam in sorted(fam_variants):
    path = os.path.join(BASE, 'families', f'{fam}.ts')
    if not os.path.exists(path):
        problems.append(f'MISSING family module: families/{fam}.ts ({len(fam_variants[fam])} bindings depend on it)')
        continue
    src = open(path, encoding='utf-8').read()
    if 'export function make' not in src:
        problems.append(f'{fam}.ts does not export make()')
    cases = set(re.findall(r"case '([^']+)':", src))
    missing = fam_variants[fam] - cases
    if missing:
        problems.append(f'{fam}.ts missing case for variants: {sorted(missing)}')

# 2: scene files
for slug, mod in scene_reg:
    p = os.path.join(BASE, 'scenes', f'{mod}.ts')
    if not os.path.exists(p):
        problems.append(f"reg('{slug}') -> missing scenes/{mod}.ts")
    else:
        src = open(p, encoding='utf-8').read()
        # empty stub heuristic: update() body tiny
        m = re.search(r"update\s*\([^)]*\)\s*\{([\s\S]{0,400}?)\n  \}", src)
        if m and len(m.group(1).strip()) < 40:
            problems.append(f"scenes/{mod}.ts (bound to {slug}) has a near-empty update()")

# 4: duplicates
allslugs = [s for s, _ in scene_reg] + [s for s, _, _, _ in fam_reg]
dups = {s for s in allslugs if allslugs.count(s) > 1}
if dups:
    problems.append(f'duplicate slug registrations: {sorted(dups)}')

print(f'bespoke bindings : {len(scene_reg)}')
print(f'family bindings  : {len(fam_reg)}')
print(f'families         : {len(fam_variants)}')
print(f'total            : {len(allslugs)}')
if problems:
    print(f'\n{len(problems)} PROBLEM(S):')
    for p in problems:
        print('  -', p)
    sys.exit(1)
print('\nOK: all bindings resolve to implemented scenes/modes.')
