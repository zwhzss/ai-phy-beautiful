import { Component, Input } from '@angular/core';
import { DomSanitizer, SafeHtml } from '@angular/platform-browser';
import katex from 'katex';

/**
 * 公式渲染：KaTeX 为主，Unicode 近似式为兜底。
 *
 * 思路借鉴同类数学项目（study-math-* 的 render-utils.ts 里 renderFormula）：
 * 它们不指望 KaTeX 处理一切 —— 模型经常写「半 LaTeX」（`\text{中文}`、`\frac`、`\sqrt`、
 * 甚至裸中文写在数学模式里），一旦 KaTeX 不认就会退化成一堆源码。
 * 所以这里做两层：
 *   1. 预处理：把公式里的裸中文包进 \text{}，避免 KaTeX 报 unicodeTextInMathMode；
 *   2. 兜底：KaTeX 报错（或产出 .katex-error）时，改用 Unicode 近似式显示，
 *      绝不把 `\text{...}` 这类源码直接摆给学生看。
 *
 * 输出必须绕过 Angular 的 HTML 清理：KaTeX 的排版（vlist 的 height/top、mspace 宽度、
 * 分数线）全靠 inline style，而 Angular sanitizer 的属性白名单里没有 `style`
 *（见 @angular/core 的 HTML_ATTRS），一旦走普通 [innerHTML]，style 会被整体剥掉，
 * 公式就会退化成"下标掉到下一行、分式没有横线、字符挤成一团"的乱码形态。
 */
@Component({
  selector: 'math-formula',
  standalone: true,
  template: `<span [innerHTML]="html"></span>`,
  styles: [
    '.katex { font-size: 1.1em; }',
    '.formula-fallback { font-family: Consolas, Menlo, monospace; font-size: 1.05em; background: #f7fafc; border-radius: 4px; padding: 0.1rem 0.35rem; }',
  ],
})
export class MathFormulaComponent {
  html: SafeHtml | string = '';

  @Input() set latex(value: string) {
    this._latex = value;
    this.render();
  }

  private _latex = '';

  constructor(private sanitizer: DomSanitizer) {}

  private render(): void {
    if (!this._latex) {
      this.html = '';
      return;
    }
    const prepared = this.prepare(this._latex);
    let out: string;
    try {
      const rendered = katex.renderToString(prepared, { throwOnError: false, displayMode: true });
      out = rendered.includes('katex-error') ? this.fallback(prepared) : rendered;
    } catch {
      out = this.fallback(prepared);
    }
    // KaTeX/兜底 HTML 都由本地库生成，且 KaTeX 会对文本做转义（默认 trust=false，
    // \href 之类不会被信任），因此这里的可信声明只针对本次生成的公式标记。
    this.html = this.sanitizer.bypassSecurityTrustHtml(out);
  }

  /**
   * 预处理：把公式里的裸中文包进 \text{}。
   *
   * KaTeX 在数学模式里遇到裸中文会报警告甚至渲染成错误红字；用 \text{} 包起来才稳。
   * 已经写好的 \text{...} 先被替换成占位符，避免被二次包裹成 \text{\text{...}}。
   */
  private prepare(latex: string): string {
    const protectedTexts: string[] = [];
    let s = latex.replace(/\\text\{([^}]*)\}/g, (_, inner: string) => {
      protectedTexts.push(inner);
      return `\u0001${protectedTexts.length - 1}\u0001`;
    });
    s = s.replace(
      /([\u4e00-\u9fff][\u4e00-\u9fff\u3400-\u4dbf\uff0c\u3002\uff1a\uff1b\u3001\uff08\uff09\uff1f\uff01\s]*)/g,
      (m: string) => '\\text{' + m + '}',
    );
    return s.replace(/\u0001(\d+)\u0001/g, (_, i: string) => `\\text{${protectedTexts[Number(i)]}}`);
  }

  /** 兜底：用 Unicode 近似式渲染（可读，且不会暴露 LaTeX 源码）。 */
  private fallback(latex: string): string {
    const greek: Record<string, string> = {
      alpha: 'α', beta: 'β', gamma: 'γ', delta: 'δ', epsilon: 'ε', zeta: 'ζ', eta: 'η',
      theta: 'θ', iota: 'ι', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ',
      pi: 'π', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω',
      Gamma: 'Γ', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Xi: 'Ξ', Pi: 'Π', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω',
      varepsilon: 'ε', varphi: 'φ',
    };
    const blackboard: Record<string, string> = { R: 'ℝ', N: 'ℕ', Z: 'ℤ', Q: 'ℚ', C: 'ℂ', P: 'ℙ', T: '𝕋' };

    let s = latex;
    // 先处理 \begin{cases}...\end{cases} 分段函数（AI 常用，KaTeX 支持但有时出错）
    s = s.replace(/\\begin\{cases\}([\s\S]*?)\\end\{cases\}/g, (_, body: string) => {
      const rows = body.trim().split('\\\\').map((r: string) => r.trim());
      return rows.map((r: string) => {
        const parts = r.split('&');
        return (parts[0]?.trim() ?? '') + ' 当 ' + (parts[1]?.trim() ?? '');
      }).join('；');
    });
    // \text{...} → 纯文本（先处理，避免后续正则干扰）
    s = s.replace(/\\text\{([^}]*)\}/g, '$1')
      // \mathcal{...} 花体字母
      .replace(/\\mathcal\{([A-Za-z])\}/g, (_, l: string) => {
        // 花体大写字母 Unicode 范围 U+1D4A0..U+1D4B9
        const code = 0x1D4A0 + (l.toUpperCase().charCodeAt(0) - 65);
        return isNaN(code) ? l : String.fromCodePoint(code);
      })
      // \mathbf{...} 粗体（保留原文，浏览器默认加粗即可）
      .replace(/\\mathbf\{([^}]*)\}/g, '$1')
      // \mathrm{...} 正体（保留原文）
      .replace(/\\mathrm\{([^}]*)\}/g, '$1')
      // \over / \atop 是 \frac 的替代写法（AI 偶尔用）
      .replace(/([^{}\\]*)\\over([^{}\\]*)/g, '($1)/($2)')
      .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, '($1)/($2)')
      .replace(/\\sqrt\{([^{}]*)\}/g, '√($1)')
      // \mathbb{...} 黑体字母集（支持多字符，如 \mathbb{R^n} → ℝ^n）
      .replace(/\\mathbb\{([^}]*)\}/g, (_, inner: string) => {
        // 先尝试单个字母映射
        if (inner.length === 1 && blackboard[inner]) return blackboard[inner];
        // 多字符：保留但把已知集合名替换
        return inner.split('').map(ch => blackboard[ch] ?? ch).join('');
      })
      .replace(/\\cdot/g, '·')
      .replace(/\\times/g, '×')
      .replace(/\\div/g, '÷')
      .replace(/\\leq|\\le(?![a-z])/g, '≤')
      .replace(/\\geq|\\ge(?![a-z])/g, '≥')
      .replace(/\\neq|\\ne(?![a-z])/g, '≠')
      .replace(/\\notin/g, '∉')
      .replace(/\\in(?![a-z])/g, '∈')
      .replace(/\\rightarrow|\\to(?![a-z])/g, '→')
      .replace(/\\leftarrow|\\gets(?![a-z])/g, '←')
      .replace(/\\infty/g, '∞')
      .replace(/\\pm/g, '±')
      .replace(/\\approx/g, '≈')
      .replace(/\\equiv/g, '≡')
      .replace(/\\neq|\\ne(?![a-z])/g, '≠')
      // 特殊符号
      .replace(/\\partial/g, '∂')
      .replace(/\\nabla/g, '∇')
      .replace(/\\forall/g, '∀')
      .replace(/\\exists/g, '∃')
      .replace(/\\emptyset/g, '∅')
      .replace(/\\varnothing/g, '∅')
      // 上下标专用符号
      .replace(/\\prime/g, "'")
      .replace(/\\dots/g, '…')
      .replace(/\\ldots/g, '…')
      .replace(/\\cdots/g, '⋯')
      .replace(/\\vdots/g, '⋮')
      .replace(/\\ddots/g, '⋱')
      // 极限/求和/积分：保留命令名，下标在后面统一处理
      .replace(/\\lim/g, 'lim')
      .replace(/\\sum/g, 'Σ')
      .replace(/\\int/g, '∫')
      .replace(/\\prod/g, 'Π')
      .replace(/\\coprod/g, '∐')
      // 去掉 \left \right 等分隔符命令（保留内部内容）
      .replace(/\\left|\\right/g, '')
      // 去掉 \bigl \bigr \Bigl \Bigr 等尺寸分隔符
      .replace(/\\(bigl|bigr|Bigl|Bigr|big|Big)\{([^}]*)\}/g, '$2')
      .replace(/\\(bigl|bigr|Bigl|Bigr|big|Big)(?=[^a-zA-Z])/g, '');

    // Greek letters（只在非命令上下文中替换，避免把 \alphaBeta 之类误替换）
    for (const [name, ch] of Object.entries(greek)) {
      s = s.replace(new RegExp('\\\\' + name + '(?![a-zA-Z])', 'g'), ch);
    }

    // 上下标放在最后转成 HTML（与数学项目一致：避免干扰公式本体）
    // 花括号上下标优先
    s = s
      .replace(/\^\{([^{}]+)\}/g, '<sup>$1</sup>')
      .replace(/_\{([^{}]+)\}/g, '<sub>$1</sub>')
      // 单字符上下标（防止漏网）
      .replace(/\^([A-Za-z0-9])/g, '<sup>$1</sup>')
      .replace(/_([A-Za-z0-9])/g, '<sub>$1</sub>');

    return `<code class="formula-fallback">${s}</code>`;
  }
}
