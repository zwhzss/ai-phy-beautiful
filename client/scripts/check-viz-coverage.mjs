#!/usr/bin/env node
/**
 * 可视化覆盖率自检。
 *
 * 对比种子数据里的全部实验（server/internal/seed/data/experiments.json）
 * 与 catalog 目录中已注册的渲染器，输出缺口清单。
 *
 * 用法：node scripts/check-viz-coverage.mjs [--missing]
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, '..');
const repoRoot = path.resolve(clientRoot, '..');

const seedDir = path.resolve(repoRoot, 'server', 'internal', 'seed', 'data');
// 目录分文件维护（展项主批 + 滚动扩充批次），全部纳入覆盖统计
const seedFiles = [
  'experiments.json',
  'experiments-b.json',
  'experiments-c.json',
  'experiments-d.json',
  'experiments-e.json',
  'experiments-f.json',
  'experiments-g.json',
  'experiments-h.json',
  'experiments-i.json',
];
const catalogDir = path.join(clientRoot, 'src', 'app', 'features', 'experiments', 'viz', 'catalog');

const seed = { categories: [], experiments: [] };
for (const fname of seedFiles) {
  const fp = path.join(seedDir, fname);
  if (!fs.existsSync(fp)) continue;
  const one = JSON.parse(fs.readFileSync(fp, 'utf8'));
  seed.experiments.push(...(one.experiments ?? []));
  seed.categories.push(...(one.categories ?? []));
}
const categorized = new Map();
for (const exp of seed.experiments) {
  if (!categorized.has(exp.category_slug)) categorized.set(exp.category_slug, []);
  categorized.get(exp.category_slug).push(exp);
}

// 只统计 index.ts 实际导入的渲染器模块（目录中保留的历史参考文件不计）
const indexSrc = fs.readFileSync(path.join(catalogDir, 'index.ts'), 'utf8');
const imported = new Set();
for (const m of indexSrc.matchAll(/import\s+'\.\/([^']+)'/g)) imported.add(m[1] + '.ts');

const implemented = new Set();
for (const file of fs.readdirSync(catalogDir)) {
  if (!file.endsWith('.ts') || file === 'index.ts') continue;
  if (!imported.has(file)) continue;
  const src = fs.readFileSync(path.join(catalogDir, file), 'utf8');
  for (const m of src.matchAll(/\bslug:\s*'([^']+)'/g)) implemented.add(m[1]);
}

const all = seed.experiments.map((e) => e.slug);
const missing = all.filter((s) => !implemented.has(s));
const stray = [...implemented].filter((s) => !all.includes(s));

const pct = ((all.length - missing.length) / all.length) * 100;
console.log(`可视化覆盖：${all.length - missing.length}/${all.length}（${pct.toFixed(1)}%）`);

if (stray.length > 0) {
  console.log(`\n⚠ catalog 中存在种子数据未定义的 slug：${stray.join(', ')}`);
}

const showMissing = process.argv.includes('--missing');
if (missing.length > 0 && showMissing) {
  console.log('\n未实现清单：');
  for (const [cat, exps] of categorized) {
    const gap = exps.filter((e) => missing.includes(e.slug));
    if (gap.length === 0) continue;
    console.log(`\n## ${cat} (${gap.length}/${exps.length})`);
    for (const e of gap) console.log(`  - ${e.number} ${e.slug} ${e.title}`);
  }
} else if (missing.length > 0) {
  const byCat = [...categorized]
    .map(([cat, exps]) => [cat, exps.filter((e) => missing.includes(e.slug)).length, exps.length])
    .filter(([, gap]) => gap > 0)
    .map(([cat, gap, total]) => `${cat} ${gap}/${total}`);
  console.log(`\n缺口按分类：${byCat.join(' | ')}`);
  console.log('（加 --missing 查看逐个实验清单）');
}

process.exitCode = missing.length > 0 ? 0 : 0;
