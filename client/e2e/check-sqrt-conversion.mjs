// 复算 unicodeMathToLatex + inlineMath 在「全部含 √ 的种子台词」上的效果，
// 并在浏览器里真实渲染，检查：(1) 是否都转换成功 (2) KaTeX 是否报错 (3) 根号横线（<svg><path>）是否存在。
//
// 与 client/src/app/shared/pipes/inline-math.pipe.ts 的规则保持一致（改那边要同步改这里）。
import { chromium } from 'playwright-core';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { DatabaseSync } from 'node:sqlite';

const db = new DatabaseSync(process.env.APPDATA + '\\phy-beauty\\phy-beauty.db', { readOnly: true });
const lines = db.prepare("select text from narrations where text like '%√%'").all().map((r) => r.text);
console.log('含 √ 的台词:', lines.length);

const katexJs = fs.readFileSync(path.resolve('node_modules/katex/dist/katex.min.js'), 'utf8');
const katexCss = pathToFileURL(path.resolve('node_modules/katex/dist/katex.min.css')).href;

// 把管道源码里的两个关键实现原样搬进来（正则字面量在模板字符串里要转义反斜杠）
const impl = `
const MATH_CHAR = /[0-9A-Za-z\\\\^_{}[\\]()|+\\-*/=<>.,; ]/;
const isMathChar = (ch) => MATH_CHAR.test(ch);
function unicodeMathToLatex(text) {
  if (!text || !text.includes('√')) return text;
  if ((text.match(/\\$/g) ?? []).length % 2 !== 0) return text;
  const protectedRanges = [];
  for (const re of [/\\$[^$\\n]+\\$/g, /\\\\\\([\\s\\S]*?\\\\\\)/g]) {
    for (const m of text.matchAll(re)) protectedRanges.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
  }
  const isProtected = (start, end) => protectedRanges.some(([s, e]) => start < e && end > s);
  const radical = /√\\s*(\\([^()]*(?:\\([^()]*\\)[^()]*)*\\)|[A-Za-z][A-Za-z0-9]*(?:_(?:\\{[^{}]*\\}|[0-9A-Za-z]+))?|[−-][0-9A-Za-z\\u0370-\\u03ff\\u1f00-\\u1fff](?:_(?:\\{[^{}]*\\}|[0-9A-Za-z]+))?|(?:⟨[^⟩]+⟩|[0-9\\u0370-\\u03ff\\u1f00-\\u1fff])(?:_(?:\\{[^{}]*\\}|[0-9A-Za-z]+))?)/g;
  const matches = [...text.matchAll(radical)].filter((m) => !isProtected(m.index ?? 0, (m.index ?? 0) + m[0].length));
  if (matches.length === 0) return text;
  let out = text;
  for (const m of matches.reverse()) {
    const start = m.index ?? 0;
    let radicand = m[1];
    if (radicand.startsWith('(') && radicand.endsWith(')')) radicand = radicand.slice(1, -1);
    radicand = radicand.trim();
    if (!radicand) continue;
    out = out.slice(0, start) + '$\\\\sqrt{' + radicand + '}$' + out.slice(start + m[0].length);
  }
  return out;
}
const ANCHOR = /\\\\[a-zA-Z]+|[A-Za-z0-9)\\]}]\\s*[\\^_]\\s*(?:\\{[^{}]*\\}|\\\\[a-zA-Z]+|[A-Za-z0-9])/g;
function findBareFormula(text, from) {
  ANCHOR.lastIndex = from;
  const anchor = ANCHOR.exec(text);
  if (!anchor) return null;
  let start = anchor.index, end = anchor.index + anchor[0].length;
  while (start > 0 && isMathChar(text[start - 1])) start--;
  while (end < text.length && isMathChar(text[end])) end++;
  while (start < end && text[start] === ' ') start++;
  while (end > start && text[end - 1] === ' ') end--;
  const span = text.slice(start, end);
  if (!/[\\\\^_]/.test(span)) return null;
  return { start, end };
}
function findFormula(text, from) {
  const dollar = /\\$([^$\\n]+)\\$/g; dollar.lastIndex = from;
  const matched = dollar.exec(text);
  const bare = findBareFormula(text, from);
  if (matched && (!bare || matched.index <= bare.start)) return { start: matched.index, end: matched.index + matched[0].length, latex: matched[1], kind: 'dollar' };
  if (bare) return { start: bare.start, end: bare.end, latex: text.slice(bare.start, bare.end), kind: 'bare' };
  return null;
}
window.renderLine = (original) => {
  const converted = unicodeMathToLatex(original);
  const parts = []; let consumed = 0, cursor = 0; let errs = 0; let mathSpans = 0;
  while (cursor < converted.length) {
    const span = findFormula(converted, cursor);
    if (!span) break;
    if (span.start > consumed) parts.push(escapeHtml(converted.slice(consumed, span.start)));
    const html = katex.renderToString(span.latex, { throwOnError: false, displayMode: false });
    if (html.includes('katex-error')) errs++;
    mathSpans++;
    parts.push(html);
    consumed = span.end; cursor = span.end;
  }
  if (consumed < converted.length) parts.push(escapeHtml(converted.slice(consumed)));
  return { converted, html: parts.join(''), errs, mathSpans };
};
function escapeHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
`;

const html = `<!doctype html><html><head><meta charset="utf-8"><link rel="stylesheet" href="${katexCss}"></head>
<body><div id="stage"></div><script>${katexJs}</script><script>${impl}</script></body></html>`;
const tmp = path.resolve('e2e/.sqrt-convert.html');
fs.writeFileSync(tmp, html);

const browser = await chromium.launch({ channel: 'msedge', headless: true });
const page = await browser.newPage();
await page.goto(pathToFileURL(tmp).href, { waitUntil: 'load' });

let unresolved = 0, katexErrors = 0, noSvg = 0, convertedOk = 0;
const failures = [];
for (const line of lines) {
  const r = await page.evaluate((t) => {
    const res = window.renderLine(t);
    document.getElementById('stage').innerHTML = res.html;
    const sqrtEls = document.querySelectorAll('.katex .sqrt');
    let withSvg = 0;
    for (const el of sqrtEls) if (el.querySelector('svg path')) withSvg++;
    return { ...res, sqrtCount: sqrtEls.length, sqrtWithSvg: withSvg };
  }, line);

  const leftOver = r.converted.includes('√');
  if (leftOver) { unresolved++; failures.push({ why: '未转换的 √', line, converted: r.converted }); }
  if (r.errs > 0) { katexErrors++; failures.push({ why: 'KaTeX 报错', line, converted: r.converted }); }
  if (r.sqrtCount > 0 && r.sqrtWithSvg < r.sqrtCount) { noSvg++; failures.push({ why: '根号缺横线路径', line, converted: r.converted, sqrtCount: r.sqrtCount, sqrtWithSvg: r.sqrtWithSvg }); }
  if (!leftOver && r.errs === 0 && r.sqrtCount > 0 && r.sqrtWithSvg === r.sqrtCount) convertedOk++;
}

await browser.close();
fs.unlinkSync(tmp);

console.log('全部转换且渲染出根号横线:', convertedOk, '/', lines.length);
console.log('仍有未转换 √ 的:', unresolved);
console.log('KaTeX 报错的:', katexErrors);
console.log('根号缺横线的:', noSvg);
if (failures.length) {
  console.log('\n--- 失败样例（前 15）---');
  for (const f of failures.slice(0, 15)) console.log(`[${f.why}] ${f.line}\n    → ${f.converted ?? ''}`);
}
process.exit(failures.length ? 1 : 0);
