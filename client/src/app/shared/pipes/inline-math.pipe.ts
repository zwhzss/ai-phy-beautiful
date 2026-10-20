import { Pipe, PipeTransform } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import katex from 'katex';

/**
 * 内联公式管道：把文本中的公式片段用 KaTeX 渲染，其余部分保持纯文本。
 *
 * 识别顺序（谁先出现谁先处理，互不重叠）：
 *   0. Unicode 数学片段（`√(…)` / `√x` 这类）先转成 `$\sqrt{…}$`，见 unicodeMathToLatex；
 *   1. `$...$`：提示词要求台词里的数学表达式成对用 $ 包裹，这是首选写法，
 *      种子稿件里的 Unicode 数学转换后也走这条路（定界后不会被边界扩展吃掉邻字）；
 *   2. 裸 LaTeX 片段（兼容历史数据，以及模型没按格式写的情况）：以「\命令」或
 *      「符号/数字 + 上下标」（T_{n}、x^{n}、2^{1-n}）为锚点，向两侧扩展到数学字符的边界，
 *      所以 `T_{n}(x) = \cos(n \arccos x)`、`|x^{n} - p(x)| = 2^{1-n}` 都能整段渲染，
 *      而不是只渲染半个、剩下的当文字念给学生。
 *
 * 渲染失败时保留原始 LaTeX 源码，不报错。
 *
 * 返回值是 SafeHtml：KaTeX 的排版全靠 inline style（vlist 的 height/top、mspace 宽度），
 * 而 Angular sanitizer 的属性白名单里没有 `style`（见 @angular/core 的 HTML_ATTRS），
 * 走普通 [innerHTML] 会把 inline style 全部剥掉，公式就变成"下标错位、字符黏连"的乱码。
 */
@Pipe({
  name: 'inlineMath',
  standalone: true,
})
export class InlineMathPipe implements PipeTransform {
  constructor(private sanitizer: DomSanitizer) {}

  transform(text: string): SafeHtml | string {
    if (!text) return '';
    // 种子稿件里的数学是「朗读友好」的 Unicode 写法（`√((ω₀²−ω²)² + …)`），
    // 直接当纯文本显示就只有 `√(...)` 而没有根号横线。先转成 LaTeX 再走下面的渲染。
    text = unicodeMathToLatex(text);
    const parts: string[] = [];
    let consumed = 0;
    let cursor = 0;

    while (cursor < text.length) {
      const span = this.findFormula(text, cursor);
      if (!span) break;
      if (span.start > consumed) {
        parts.push(escapeHtml(text.slice(consumed, span.start)));
      }
      parts.push(this.renderInline(span.latex));
      consumed = span.end;
      cursor = span.end;
    }

    if (consumed < text.length) {
      parts.push(escapeHtml(text.slice(consumed)));
    }

    // 文本已逐段转义、公式片段由本地 KaTeX 生成，因此这里可以安全地声明为可信 HTML
    return this.sanitizer.bypassSecurityTrustHtml(parts.join(''));
  }

  /** 找出从 from 开始的下一个公式片段（优先 $...$，其次裸片段）。 */
  private findFormula(text: string, from: number): FormulaSpan | null {
    const dollar = /\$([^$\n]+)\$/g;
    dollar.lastIndex = from;
    const matched = dollar.exec(text);
    const bare = this.findBareFormula(text, from);
    if (matched && (!bare || matched.index <= bare.start)) {
      // start/end 含两侧的 $ 定界符（它们要被消费掉），交给 KaTeX 的只有里面的内容
      return {
        start: matched.index,
        end: matched.index + matched[0].length,
        latex: matched[1],
      };
    }
    if (bare) {
      return { start: bare.start, end: bare.end, latex: text.slice(bare.start, bare.end) };
    }
    return null;
  }

  /**
   * 裸公式片段的锚点：`\命令`，或「符号/数字 + 上下标」。
   *
   * 单独出现的数字或英文单词（如 "KaTeX"、"12 个"）不会被当成公式 —— 没有上下标、
   * 也不是命令，就不构成锚点。
   */
  private static readonly ANCHOR =
    /\\[a-zA-Z]+|[A-Za-z0-9)\]}]\s*[\^_]\s*(?:\{[^{}]*\}|\\[a-zA-Z]+|[A-Za-z0-9])/g;

  private findBareFormula(text: string, from: number): { start: number; end: number } | null {
    InlineMathPipe.ANCHOR.lastIndex = from;
    const anchor = InlineMathPipe.ANCHOR.exec(text);
    if (!anchor) return null;

    let start = anchor.index;
    let end = anchor.index + anchor[0].length;
    // 向两侧扩展到"数学字符"的边界：中文、中文标点、引号等都是天然分界
    while (start > 0 && isMathChar(text[start - 1])) start--;
    while (end < text.length && isMathChar(text[end])) end++;
    // 扩展出来的一段可能带着两边空格，去掉
    while (start < end && text[start] === ' ') start++;
    while (end > start && text[end - 1] === ' ') end--;

    const span = text.slice(start, end);
    if (!/[\\^_]/.test(span)) {
      // 扩展后已经不像公式（既没有命令也没有上下标），放弃这一段，交给后面的文本处理
      return null;
    }
    return { start, end };
  }

  private renderInline(latex: string): string {
    try {
      const out = katex.renderToString(latex, {
        throwOnError: false,
        displayMode: false,
        output: 'html',
      });
      return out.includes('katex-error') ? escapeHtml(latex) : out;
    } catch {
      return escapeHtml(latex);
    }
  }
}

/** 裸公式片段允许出现的字符；中文与中文标点是天然边界。空格要算进来，
 * 否则 `\min_{p} \max_{x \in [-1,1]}` 会被空格切成好几段，中间的命令就会露出源码。 */
const MATH_CHAR = /[0-9A-Za-z\\^_{}[\]()|+\-*/=<>.,; ]/;

function isMathChar(ch: string): boolean {
  return MATH_CHAR.test(ch);
}

/**
 * 把台词里的 Unicode 数学片段转成 LaTeX，其余文字原样保留。
 *
 * 为什么需要它（真实反馈）：种子里 63 条台词用「朗读友好」的 Unicode 写法表达根号
 * （`稳态解振幅 A = F₀/√((ω₀²−ω²)² + (2ζω₀ω)²)`）。管道只认 `\命令` 与 `$...$`，
 * 于是这些片段一律按纯文本显示 —— 根号只剩一个 `√` 钩子、被开方数缩在括号里，
 * 看起来就是"根号没有上面的横线"。转成 `$\sqrt{...}$` 后由 KaTeX 排版，横线才画得出来。
 *
 * 两种根号写法都要覆盖（语料里两种都有）：
 *   - `√(…)`：带括号的被开方数（38 条），括号可嵌套一层；
 *   - 裸被开方数（25 条）：`√N`、`√LC`、`√RT`（多字母标识符，只吃「字母数字」，
 *     不会把后面的运算符和空格一起吞进来）、`√s_min`、`√−g`（前置负号）、
 *     `√3`、`√μ`、`√ν`、`√⟨n⟩`（单个原子，可带下标）。
 *
 * 安全边界：
 *   - 先记录 `$...$` 与 `\(...\)` 区间，区间内一个字都不改（用户/AI 写的 LaTeX 不能被二次加工）；
 *   - `$` 个数为奇数（引号里出现美元等）时整条都不转换，避免把正文吞进公式定界符；
 *   - 不认识的字符保持原样，最坏情况就是退化成今天的纯文本显示。
 */
export function unicodeMathToLatex(text: string): string {
  if (!text || !text.includes('√')) return text;

  // `$` 为奇数说明文本里的公式定界符不配对，此时不做任何转换最为安全
  if ((text.match(/\$/g) ?? []).length % 2 !== 0) return text;

  const protectedRanges: Array<[number, number]> = [];
  for (const re of [/\$[^$\n]+\$/g, /\\\([\s\S]*?\\\)/g]) {
    for (const m of text.matchAll(re)) {
      protectedRanges.push([m.index ?? 0, (m.index ?? 0) + m[0].length]);
    }
  }
  const isProtected = (start: number, end: number): boolean =>
    protectedRanges.some(([s, e]) => start < e && end > s);

  // 先匹配「根号 + 被开方数」，从右往左替换，保证一条句子里多个根号都处理得到。
  // 被开方数四种形态：括号（可嵌一层）、标识符（LC、RT、s_min —— 只吃字母数字与下标，
  // 不会把后面的运算符和空格吞进来）、带前置负号的字母、单个原子（数字/Greek/⟨…⟩，可带下标）。
  const radical =
    /√\s*(\([^()]*(?:\([^()]*\)[^()]*)*\)|[A-Za-z][A-Za-z0-9]*(?:_(?:\{[^{}]*\}|[0-9A-Za-z]+))?|[−-][0-9A-Za-z\u0370-\u03ff\u1f00-\u1fff](?:_(?:\{[^{}]*\}|[0-9A-Za-z]+))?|(?:⟨[^⟩]+⟩|[0-9\u0370-\u03ff\u1f00-\u1fff])(?:_(?:\{[^{}]*\}|[0-9A-Za-z]+))?)/g;
  const matches = [...text.matchAll(radical)].filter((m) => !isProtected(m.index ?? 0, (m.index ?? 0) + m[0].length));
  if (matches.length === 0) return text;

  let out = text;
  for (const m of matches.reverse()) {
    const start = m.index ?? 0;
    const whole = m[0];
    let radicand = m[1];
    // 整段是括号时去掉最外层括号：√(a+b) → \sqrt{a+b}
    if (radicand.startsWith('(') && radicand.endsWith(')')) {
      radicand = radicand.slice(1, -1);
    }
    radicand = radicand.trim();
    if (!radicand) continue;
    out = out.slice(0, start) + '$\\sqrt{' + radicand + '}$' + out.slice(start + whole.length);
  }
  return out;
}

/** 一个待渲染的公式片段：start/end 是要消费的原文范围，latex 是交给 KaTeX 的内容。 */
interface FormulaSpan {
  start: number;
  end: number;
  latex: string;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
