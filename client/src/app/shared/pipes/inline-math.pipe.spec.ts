import { unicodeMathToLatex } from './inline-math.pipe';

/**
 * 覆盖「根号没有上面的横线」这个缺陷：种子台词用朗读友好的 Unicode 写根号（`√(…)`），
 * 管道只认 `\命令` 与 `$...$`，于是这类片段一直按纯文本显示 —— 只剩一个 `√` 钩子。
 * 这里逐条钉住转换规则；真实语料（全库 63 条含 √ 的台词）另用
 * `e2e/check-sqrt-conversion.mjs` 在浏览器里跑 KaTeX 核对。
 */
describe('unicodeMathToLatex', () => {
  it('把带括号的被开方数转成 $\\sqrt{…}$（用户报的那条）', () => {
    const src = '稳态解振幅 A = F₀/√((ω₀²−ω²)² + (2ζω₀ω)²)：共振峰位置略低于固有频率。';
    const got = unicodeMathToLatex(src);
    expect(got).toContain('$\\sqrt{(ω₀²−ω²)² + (2ζω₀ω)²}$');
    expect(got).not.toContain('√');
    expect(got).toContain('稳态解振幅 A = F₀/');
    expect(got.endsWith('：共振峰位置略低于固有频率。')).toBeTrue();
  });

  it('支持一层嵌套括号（√(2gL(1−cosθ))）', () => {
    expect(unicodeMathToLatex('v = (M+m)/m · √(2gL(1−cosθ))')).toBe('v = (M+m)/m · $\\sqrt{2gL(1−cosθ)}$');
  });

  it('裸被开方数：字母、数字、多字母、希腊字母、带下标、前置负号', () => {
    expect(unicodeMathToLatex('噪声 ∝√N')).toBe('噪声 ∝$\\sqrt{N}$');
    expect(unicodeMathToLatex('相位差 √3 倍')).toBe('相位差 $\\sqrt{3}$ 倍');
    expect(unicodeMathToLatex('f₀=1/(2π√LC)')).toBe('f₀=1/(2π$\\sqrt{LC}$)');
    expect(unicodeMathToLatex('振幅 ~√μ')).toBe('振幅 ~$\\sqrt{μ}$');
    expect(unicodeMathToLatex('阈值 √s_min = Σm')).toBe('阈值 $\\sqrt{s_min}$ = Σm');
    expect(unicodeMathToLatex('作用量 ∫(R−2Λ)√−g d⁴x')).toBe('作用量 ∫(R−2Λ)$\\sqrt{−g}$ d⁴x');
    expect(unicodeMathToLatex('涨落 √⟨n⟩')).toBe('涨落 $\\sqrt{⟨n⟩}$');
  });

  it('同一条台词里的多个根号全部转换', () => {
    const got = unicodeMathToLatex('v_p : v_avg : v_rms = √2 : √(8/π) : √3');
    expect(got).toBe('v_p : v_avg : v_rms = $\\sqrt{2}$ : $\\sqrt{8/π}$ : $\\sqrt{3}$');
  });

  it('没有 √ 的文本原样返回（不引入任何公式定界符）', () => {
    const src = '旋转矢量在 x 轴的投影就是简谐振动：圆周匀速运动与直线简谐互为表里。';
    expect(unicodeMathToLatex(src)).toBe(src);
  });

  it('不动 $...$ 与 \\(...\\) 里已有的 LaTeX', () => {
    expect(unicodeMathToLatex('密度 $\\sqrt{\\rho}$ 与 √ρ')).toBe('密度 $\\sqrt{\\rho}$ 与 $\\sqrt{ρ}$');
    expect(unicodeMathToLatex('写作 \\(\\sqrt{x}\\) 与 √x')).toBe('写作 \\(\\sqrt{x}\\) 与 $\\sqrt{x}$');
  });

  it('$ 个数为奇数时不转换（避免把正文吞进公式定界符）', () => {
    const src = '价格 100$ 与 √2';
    expect(unicodeMathToLatex(src)).toBe(src);
  });
});
