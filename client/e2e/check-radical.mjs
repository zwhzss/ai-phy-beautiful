// 根号横线回归检查：KaTeX 的根号是一段内联 SVG（<svg><path>），横线画在 path 里。
// 这个脚本渲染几条带根号的公式，确认 SVG 与 path 确实生成、并截一张图供肉眼核对。
//
// 用法：node e2e/check-radical.mjs [样式文件...]
//   例：node e2e/check-radical.mjs dist/phy-beauty-client/browser/styles-XXXX.css
//
// 说明：KaTeX 的排版（分数线用 border-bottom、根号横线用 SVG）都依赖样式表；
// 带上构建产物里的 styles-*.css 就等于在"打包后的真实样式环境"下检查。
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const cssPaths = process.argv.slice(2);
const katexDir = path.resolve('node_modules/katex');
const katexJs = fs.readFileSync(path.join(katexDir, 'dist/katex.min.js'), 'utf8');
const extraLinks = cssPaths
  .map((p) => `<link rel="stylesheet" href="${pathToFileURL(path.resolve(p)).href}">`)
  .join('\n');

const FORMULAS = [
  'A = \\frac{F_0}{\\sqrt{(\\omega_0^2-\\omega^2)^2 + (2\\zeta\\omega_0\\omega)^2}}',
  'T = 2\\pi\\sqrt{I/mgh}',
  '\\lambda = h/\\sqrt{2m_e eV}',
];

const html = `<!doctype html><html lang="zh"><head><meta charset="utf-8">
<link rel="stylesheet" href="${pathToFileURL(path.join(katexDir, 'dist/katex.min.css')).href}">
${extraLinks}</head><body style="padding:16px;font-size:20px">
<div id="mount"></div>
<script>${katexJs}</script>
<script>
document.getElementById('mount').innerHTML = ${JSON.stringify(FORMULAS)}
  .map((f) => '<div>' + katex.renderToString(f, { displayMode: true, throwOnError: false }) + '</div>')
  .join('');
</script></body></html>`;

const tmp = path.resolve('e2e/.radical-check.html');
fs.writeFileSync(tmp, html);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage({ viewport: { width: 1100, height: 520 } });
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });

const result = await page.evaluate(() => {
  const sqrts = [...document.querySelectorAll('.katex .sqrt')];
  const fracs = [...document.querySelectorAll('.katex .mfrac .frac-line')];
  const cs = (el) => getComputedStyle(el);
  return {
    根号个数: sqrts.length,
    带SVG横线的根号: sqrts.filter((el) => el.querySelector('svg path')).length,
    分数线个数: fracs.length,
    分数线实心: fracs.filter((el) => parseFloat(cs(el).borderBottomWidth) > 0).length,
    katex报错: document.querySelectorAll('.katex-error').length,
  };
});

await page.screenshot({ path: 'e2e/screenshots/radical-check.png' });
await browser.close();
fs.unlinkSync(tmp);

console.log(JSON.stringify(result, null, 2));
console.log('截图: e2e/screenshots/radical-check.png');
const ok = result.katex报错 === 0 &&
  result.根号个数 === FORMULAS.length &&
  result.带SVG横线的根号 === result.根号个数 &&
  result.分数线实心 === result.分数线个数;
console.log(ok ? '\n结论：根号横线与分数线都在（样式正常）' : '\n结论：根号横线或分数线缺失');
process.exit(ok ? 0 : 1);
