// 截取关键页面截图存档到 e2e/screenshots/（供交付预览）
// 用法：node e2e/shots.mjs [baseURL]
import { chromium } from 'playwright-core';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE = process.argv[2] || 'http://localhost:8080';
const outDir = join(dirname(fileURLToPath(import.meta.url)), 'screenshots');
mkdirSync(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1440, height: 2000 } });

const shots = [
  ['/', '01-home.png', 1600],
  ['/scale', '02-scale.png', 700],
  ['/milestones', '03-timeline.png', 700],
  ['/milestones/newton-laws', '04-milestone-detail.png', 700],
  ['/figures', '05-figures.png', 700],
  ['/library', '09-library.png', 1500],
  ['/experiment/simple-pendulum', '06-pendulum.png', 1200],
  ['/experiment/carnot-cycle', '07-carnot.png', 900],
  ['/experiment/electric-field', '08-electric-field.png', 900],
];

for (const [path, file, wait] of shots) {
  await page.goto(BASE + path, { waitUntil: 'networkidle' });
  await page.waitForTimeout(wait);
  await page.screenshot({ path: join(outDir, file), fullPage: true });
  console.log('saved', file);
}
await browser.close();
console.log('done ->', outDir);
