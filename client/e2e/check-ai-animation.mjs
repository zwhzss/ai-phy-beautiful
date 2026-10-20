// AI 演示图动画的生产构建冒烟检查。
//
// 分工说明（避免验证重复或虚假覆盖）：
//   - 逐帧"画面真的在动"的判据由 karma 组件测试承担
//     （ai-graph-canvas.component.spec.ts：真 Canvas、真 requestAnimationFrame、逐帧像素对比）；
//   - 本脚本负责 karma 覆盖不到的**生产构建产物与真实服务**：
//     组件是否被打进交付的 JS、页面能否正常加载、AI 图形渲染器是否随产物发布、有没有运行时报错。
//
// 用法：node e2e/check-ai-animation.mjs [baseURL]   （默认 http://127.0.0.1:8099）
// 前置：后端已启动并托管前端构建产物（STATIC_DIR 指向 dist/phy-beauty-client/browser）。
import { chromium } from 'playwright-core';

const BASE = process.argv[2] || 'http://127.0.0.1:8099';
const results = [];
const check = (name, cond, extra = '') => results.push({ name, pass: !!cond, extra });

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
const jsErrors = [];
const loadedScripts = [];
page.on('pageerror', (e) => jsErrors.push(`pageerror: ${e.message}`));
page.on('console', (m) => {
  if (m.type() !== 'error') return;
  const t = m.text();
  if (t.includes('401') || t.includes('404')) return;
  jsErrors.push(`console: ${t}`);
});
page.on('response', (r) => {
  if (r.url().endsWith('.js')) loadedScripts.push(r.url().split('/').pop());
});

try {
  await page.goto(`${BASE}/experiment/simple-pendulum`, { waitUntil: 'networkidle' });
  const title = await page.locator('h1').innerText();
  check('展项详情页可打开', title.includes('单摆'), title);

  // 生效版本是 AI 版时，图形区显示的是 app-ai-graph-canvas（种子版画布不再出现）
  const aiTag = await page.locator('.viz-tag').first().innerText().catch(() => '');
  const isAiVersion = aiTag.includes('AI');
  check('生效版本为 AI 版（需先注入 AI 版内容）', isAiVersion, `实际标记：${aiTag || '(无)'}`);

  // 种子版渲染器作画：用没有 AI 版内容的展项检查，确认没把种子版可视化改坏
  await page.goto(`${BASE}/experiment/carnot-cycle`, { waitUntil: 'networkidle' });
  await page.waitForTimeout(900);
  const painted = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    if (!c) return false;
    const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
    let n = 0;
    for (let i = 0; i < d.length; i += 4000) if (d[i] + d[i + 1] + d[i + 2] > 60 && d[i + 3] > 0) n++;
    return n > 10;
  });
  check('种子版渲染器仍作画（卡诺循环）', painted);
  await page.goto(`${BASE}/experiment/simple-pendulum`, { waitUntil: 'networkidle' });

  // 生产 chunk 里必须带得动 AI 图形渲染器（含新增的 motion 图元与动画条文案）
  const chunks = loadedScripts.filter((n) => /chunk-.*\.js$/.test(n));
  let hasCanvas = false;
  let hasMotion = false;
  let hasBar = false;
  for (const name of chunks) {
    const txt = await page.evaluate(async (n) => {
      const url = performance.getEntriesByType('resource').map((r) => r.name).find((u) => u.endsWith('/' + n));
      if (!url) return '';
      const resp = await fetch(url);
      return resp.ok ? await resp.text() : '';
    }, name);
    if (!txt) continue;
    if (txt.includes('app-ai-graph-canvas')) hasCanvas = true;
    if (txt.includes("case 'motion'") || txt.includes('"motion"')) hasMotion = true;
    if (txt.includes('anim-bar')) hasBar = true;
  }
  check('生产产物含 AI 图形渲染器组件', hasCanvas, `${chunks.length} 个 chunk`);
  check('生产产物含 motion 图元动画分支', hasMotion);
  check('生产产物含播放/暂停控制条', hasBar);

  // 动画参数面板要能正常渲染（参数联动是 AI 图形的前提）
  check('参数面板存在', (await page.locator('app-param-panel, .param-row').count()) > 0);

  // ---------- 真实页面路径：生效版本为 AI 版时，图形真的在动 ----------
  // 前置：已用 `go run ./cmd/e2e-inject-ai -db <副本库> -slug simple-pendulum`
  // 把一份带动画的 AI 版内容写入**副本库**并置为生效版本。
  if (isAiVersion) {
    await page.waitForSelector('app-ai-graph-canvas canvas', { timeout: 10000 });
    await page.waitForTimeout(500);

    const sampleCanvas = () =>
      page.evaluate(() => document.querySelector('app-ai-graph-canvas canvas').toDataURL());
    const barText = await page.locator('app-ai-graph-canvas .anim-bar').innerText().catch(() => '');
    check('页面上出现播放/暂停条与 t 读数', barText.includes('暂停') && barText.includes('t ='), barText.replace(/\s+/g, ' '));

    const frames = [];
    for (let i = 0; i < 5; i++) {
      frames.push(await sampleCanvas());
      await page.waitForTimeout(200);
    }
    const distinct = new Set(frames).size;
    check('AI 图形逐帧变化（真实页面里在动）', distinct >= 4, `不同画面数=${distinct}/5`);

    const tReads = await page.evaluate(async () => {
      const out = [];
      for (let i = 0; i < 4; i++) {
        const el = document.querySelector('app-ai-graph-canvas .anim-time');
        out.push(el ? el.textContent.trim() : '');
        await new Promise((r) => setTimeout(r, 180));
      }
      return out;
    });
    check('t 读数在推进', new Set(tReads).size >= 3, tReads.join(' | '));

    const shotDir = new URL('./screenshots/', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
    await page.locator('app-ai-graph-canvas').screenshot({ path: `${shotDir}ai-animation-frame1.png` });
    await page.waitForTimeout(700);
    await page.locator('app-ai-graph-canvas').screenshot({ path: `${shotDir}ai-animation-frame2.png` });
    const fs = await import('node:fs');
    const s1 = fs.statSync(`${shotDir}ai-animation-frame1.png`).size;
    const s2 = fs.statSync(`${shotDir}ai-animation-frame2.png`).size;
    check('两帧截图都非空（供肉眼核对动图）', s1 > 10000 && s2 > 10000, `${s1}B / ${s2}B`);

    // 暂停后必须定格
    await page.locator('app-ai-graph-canvas .anim-btn').first().click();
    await page.waitForTimeout(200);
    const frozenA = await sampleCanvas();
    await page.waitForTimeout(400);
    const frozenB = await sampleCanvas();
    check('点击暂停后画面定格', frozenA === frozenB);
    const pausedText = await page.locator('app-ai-graph-canvas .anim-btn').first().innerText();
    check('暂停按钮变为「播放」', pausedText.includes('播放'), pausedText.trim());
  }

  check('全程无页面 JS 错误', jsErrors.length === 0, jsErrors.slice(0, 3).join(' | '));
} catch (e) {
  check('测试执行未抛异常', false, String(e).slice(0, 300));
} finally {
  await browser.close();
}

let failed = 0;
for (const r of results) {
  console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}${r.extra ? `  [${r.extra}]` : ''}`);
  if (!r.pass) failed++;
}
console.log(`\n结果：${results.length - failed}/${results.length} 通过`);
process.exit(failed ? 1 : 0);
