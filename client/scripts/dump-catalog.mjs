#!/usr/bin/env node
// 导出全部种子展项目录（按分类分组），用于 3D 沉浸场景规划审计。
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const here = path.dirname(fileURLToPath(import.meta.url));
const clientRoot = path.resolve(here, '..');
const repoRoot = path.resolve(clientRoot, '..');
const seedDir = path.join(repoRoot, 'server', 'internal', 'seed', 'data');
const files = [
  'experiments.json', 'experiments-b.json', 'experiments-c.json', 'experiments-d.json',
  'experiments-e.json', 'experiments-f.json', 'experiments-g.json', 'experiments-h.json',
  'experiments-i.json',
];

const all = [];
for (const f of files) {
  const fp = path.join(seedDir, f);
  if (!fs.existsSync(fp)) continue;
  const o = JSON.parse(fs.readFileSync(fp, 'utf8'));
  (o.experiments ?? []).forEach((e) => all.push(e));
}

// 去重（按 slug）
const seen = new Set();
const unique = [];
for (const e of all) {
  if (seen.has(e.slug)) continue;
  seen.add(e.slug);
  unique.push(e);
}
unique.sort((a, b) => a.number.localeCompare(b.number));

const byCat = {};
for (const e of unique) {
  (byCat[e.category_slug] ??= []).push(e);
}

let out = `# 种子展项完整目录\n`;
out += `总计 ${unique.length} 个展项、${Object.keys(byCat).length} 个分类\n\n`;
for (const [cat, exps] of Object.entries(byCat)) {
  out += `\n## ${cat} (${exps.length})\n`;
  for (const e of exps) {
    out += `${e.number}\t${e.slug}\t[${e.level ?? ''}]${e.difficulty ? ' / ' + e.difficulty : ''}\t${e.title}\n`;
  }
}

fs.writeFileSync(path.join(here, '..', '..', 'docs', 'seed-catalog.txt'), out + '\n');
console.log(`dumped ${unique.length} experiments, ${Object.keys(byCat).length} categories`);
