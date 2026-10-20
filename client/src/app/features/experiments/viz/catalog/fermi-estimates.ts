import { defineViz, num } from '../types';
import { registerViz } from '../registry';
import { C, clear, dot, footnotes, grid, heading, poly, seg, text, view } from '../canvas';

/** 费米估算：地球人口。 */
const fermiPopulation = defineViz({
  slug: 'fermi-population', title: '费米估算：世界人口', animated: true,
  params: {
    urban: { type: 'range', min: 20, max: 80, default: 56, step: 1, label: '城市化率 (%)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const urban = num(params, 'urban', 56);
    clear(f);
    // 估算阶梯（三步连乘）
    const steps: [string, string, number][] = [
      ['中国+印度', '各 ~14 亿 → 28 亿', 28],
      ['其余亚洲+非洲+欧美', '每块 ~10-15 亿', 52],
      ['全球合计', '~80 亿（费米三步）', 80],
    ];
    for (let i = 0; i < steps.length; i++) {
      const y = 96 + i * 76;
      const isLast = i === steps.length - 1;
      const pulse = 0.7 + 0.3 * Math.sin(f.t * 2 + i);
      poly(f, [[50, y - 28], [w - 50, y - 28], [w - 50, y + 28], [50, y + 28]],
        { stroke: isLast ? `rgba(16,185,129,${pulse})` : `${C.cool}88`, lw: isLast ? 2.6 : 1.6, fill: isLast ? 'rgba(16,185,129,0.10)' : 'rgba(66,153,225,0.06)' } as any);
      text(f, `${i + 1}. ${steps[i][0]}`, 66, y - 4, { color: isLast ? C.green : C.cyan, font: '14px sans-serif' });
      text(f, steps[i][1], 66, y + 16, { color: C.dim, font: '12px sans-serif' });
      if (isLast) text(f, `${steps[i][2]} 亿`, w - 160, y + 6, { color: C.green, font: '18px sans-serif' });
    }
    // 城乡比例条
    const by = h - 66;
    const bw = w - 140;
    poly(f, [[70, by], [70 + bw * (urban / 100), by], [70 + bw * (urban / 100), by + 30], [70, by + 30]],
      { stroke: 'transparent', fill: 'rgba(66,153,225,0.7)' } as any);
    poly(f, [[70 + bw * (urban / 100), by], [70 + bw, by], [70 + bw, by + 30], [70 + bw * (urban / 100), by + 30]],
      { stroke: 'transparent', fill: 'rgba(237,137,54,0.7)' } as any);
    text(f, `城市 ${urban}% ≈ ${(80 * urban / 100).toFixed(1)} 亿`, 76, by + 20, { color: '#fff', font: '12px sans-serif' });
    text(f, `农村 ${100 - urban}% ≈ ${(80 * (100 - urban) / 100).toFixed(1)} 亿`, 70 + bw * (urban / 100) + 8, by + 20, { color: '#fff', font: '12px sans-serif' });

    footnotes(f, [
      '费米估算的精髓：把大问题拆成两三个敢拍胸脯的量级，误差相乘仍在量级内',
      '好估算的检验不是精确，而是比拍脑袋强两个数量级——政策与工程的第一道筛子',
      '费米 1945 年用碎纸片估出原子弹当量——估算力是他带进洛斯阿拉莫斯的武器',
    ]);
    heading(f, '费米估算：三步算出八十亿');
  },
});
registerViz(fermiPopulation);

/** 费米估算：沙粒与光年。 */
const fermiSand = defineViz({
  slug: 'fermi-sand', title: '费米估算：沙粒与光年', animated: true,
  params: {
    kind: { type: 'select', options: ['地球沙粒', '一光年有几步'], default: '地球沙粒', label: '题目' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const steps = String((params as Record<string, unknown>)['kind'] ?? '').includes('光年');
    clear(f);
    if (!steps) {
      // 沙粒：海滩面积 × 沙深 × 密度
      const factors: [string, string][] = [
        ['沙滩面积', '~10¹⁰ m²（全球海岸带量级）'],
        ['沙层平均厚度', '~1 m → 体积 ~10¹⁰ m³'],
        ['每立方米颗粒', '~10⁹ 粒（0.5mm 沙径）'],
      ];
      for (let i = 0; i < factors.length; i++) {
        const y = 110 + i * 74;
        const pulse = 0.7 + 0.3 * Math.sin(f.t * 2 + i * 1.3);
        poly(f, [[60, y - 26], [w - 60, y - 26], [w - 60, y + 26], [60, y + 26]],
          { stroke: `rgba(237,137,54,${pulse})`, lw: 1.8, fill: 'rgba(237,137,54,0.08)' } as any);
        text(f, `${i + 1}. ${factors[i][0]}`, 76, y - 2, { color: C.warm, font: '14px sans-serif' });
        text(f, factors[i][1], 76, y + 18, { color: C.dim, font: '12px sans-serif' });
      }
      text(f, '连乘：10¹⁰ × 10⁹ ≈ 10¹⁹ 粒（比很多网络流传的 7.5×10¹⁸ 同量级）', 30, 44, { color: C.cyan, font: '14px sans-serif' });
      text(f, '关键在敢估面积与粒径——误差 10 倍仍是 10¹⁸~10²⁰ 的量级判断', 30, h - 34, { color: C.green, font: '12px sans-serif' });
    } else {
      // 一光年步数
      const calc: [string, string][] = [
        ['一光年', '≈9.46×10¹⁵ m'],
        ['一步', '~0.7 m → 步数 ≈ 1.4×10¹⁶'],
        ['步行速度', '1.4×10¹⁶ ÷ 1.4m/s ≈ 3 亿年（不停走）'],
      ];
      for (let i = 0; i < calc.length; i++) {
        const y = 110 + i * 74;
        const pulse = 0.7 + 0.3 * Math.sin(f.t * 2 + i * 1.3);
        poly(f, [[60, y - 26], [w - 60, y - 26], [w - 60, y + 26], [60, y + 26]],
          { stroke: `rgba(66,153,225,${pulse})`, lw: 1.8, fill: 'rgba(66,153,225,0.08)' } as any);
        text(f, `${i + 1}. ${calc[i][0]}`, 76, y - 2, { color: C.cool, font: '14px sans-serif' });
        text(f, calc[i][1], 76, y + 18, { color: C.dim, font: '12px sans-serif' });
      }
      text(f, '天文数字翻译成人能感受的单位——费米估算的诗性用途', 30, 44, { color: C.cyan, font: '14px sans-serif' });
      text(f, '离我们最近的恒星（比邻星）≈4.2 光年 → 步行 13 亿年', 30, h - 34, { color: C.warm, font: '12px sans-serif' });
    }

    footnotes(f, [
      "量级估算法：先问'这个数应该多大'，再用两三个可查的参数钉住它",
      '物理直觉的日常延伸：从铅笔芯原子数到闪电温度都能几十秒内给数',
      'ESTIMA 习惯是科研的基本功——设计实验前先估信号会不会大于噪声',
    ]);
    heading(f, '费米估算：把天文变成可感');
  },
});
registerViz(fermiSand);

/** 费米估算：海水中的分子。 */
const fermiSeawater = defineViz({
  slug: 'fermi-seawater', title: '费米估算：海水的分子数', animated: true,
  params: {
    salt: { type: 'range', min: 1, max: 6, default: 3.5, step: 0.1, label: '盐度 (‰)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const sal = num(params, 'salt', 3.5);
    clear(f);
    const calc: [string, string, string][] = [
      ['海洋体积', '面积 7×10⁸ km² × 平均深 4km', '≈3×10¹⁸ m³'],
      ['每立方米水', '10⁶ L × 6×10²³ / 18', '≈3×10²⁸ 个'],
      ['连乘', '3×10¹⁸ × 3×10²⁸', '≈10⁴⁷ 个分子'],
    ];
    for (let i = 0; i < calc.length; i++) {
      const y = 104 + i * 74;
      const pulse = 0.7 + 0.3 * Math.sin(f.t * 2 + i);
      poly(f, [[46, y - 28], [w - 46, y - 28], [w - 46, y + 28], [46, y + 28]],
        { stroke: `rgba(66,153,225,${pulse})`, lw: 1.8, fill: 'rgba(66,153,225,0.08)' } as any);
      text(f, `${i + 1}. ${calc[i][0]}`, 62, y - 4, { color: C.cool, font: '14px sans-serif' });
      text(f, calc[i][1], 62, y + 16, { color: C.dim, font: '11px sans-serif' });
      text(f, calc[i][2], w - 190, y + 6, { color: C.warm, font: '15px sans-serif' });
    }
    // 盐离子比例（小离子示意）
    const ions = [['Na⁺', 30], ['Cl⁻', 30], ['SO₄²⁻', 15], ['Mg²⁺', 12], ['其他', 13]] as [string, number][];
    const by = h - 66, bw = w - 160;
    let x = 80;
    for (const [name, pct] of ions) {
      const seg2 = (bw * pct) / 100;
      poly(f, [[x, by], [x + seg2, by], [x + seg2, by + 28], [x, by + 28]],
        { stroke: 'transparent', fill: `rgba(66,153,225,${0.35 + pct / 120})` } as any);
      text(f, name, x + 6, by + 19, { color: '#fff', font: '11px sans-serif' });
      x += seg2;
    }
    text(f, `盐度 ${sal}‰：溶质离子虽少（~10⁻² 数量），却是海洋化学的主角`, 30, 44, { color: C.cyan, font: '14px sans-serif' });

    footnotes(f, [
      '10⁴⁷：比可观测宇宙的恒星数（10²² 量级）还大 25 个数量级——水的微观之丰',
      '费米估算里乘法保量级、加法才会放大误差——拆乘不拆加是要诀',
      '同法可估地球大气分子数（~10⁴⁴）与呼吸一口的分子（~10²²）',
    ]);
    heading(f, '海水分子数：10⁴⁷ 的算术体操');
  },
});
registerViz(fermiSeawater);

/** 费米估算：图书馆的字节。 */
const fermiLibrary = defineViz({
  slug: 'fermi-library', title: '费米估算：图书馆的字节', animated: true,
  params: {
    books: { type: 'range', min: 1, max: 50, default: 20, step: 1, label: '藏书量 (百万册)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const M = num(params, 'books', 20);
    clear(f);
    const calc: [string, string][] = [
      ['一本书', '~500 页 × 500 字 ≈ 2.5×10⁵ 字 ≈ 0.5 MB（UTF-8 中文）'],
      ['× 2×10⁷ 册', '~10¹³ B = 10 TB（一座大型图书馆）'],
      ['对照', '一张 1TB 卡装下；人类全部藏书 ≈ 10⁵ TB'],
    ];
    for (let i = 0; i < calc.length; i++) {
      const y = 108 + i * 74;
      const pulse = 0.7 + 0.3 * Math.sin(f.t * 2 + i);
      poly(f, [[54, y - 28], [w - 54, y - 28], [w - 54, y + 28], [54, y + 28]],
        { stroke: `rgba(146,84,222,${pulse})`, lw: 1.8, fill: 'rgba(146,84,222,0.08)' } as any);
      text(f, `${i + 1}. ${calc[i][0]}`, 70, y - 4, { color: '#9254de', font: '14px sans-serif' });
      text(f, calc[i][1], 70, y + 16, { color: C.dim, font: '12px sans-serif' });
    }
    text(f, `当前设定 ${M} 百万册 → ${(M * 0.5).toFixed(0)} GB 级别（文本本就很小！）`, 30, 44, { color: C.cyan, font: '14px sans-serif' });
    // 对比条（文本 vs 图像 vs 视频）
    const items: [string, number, string][] = [
      ['全部书籍文本', 1, '#9254de'],
      ['一张手机照片', 5, C.warm],
      ['一分钟 4K 视频', 400, C.hot],
    ];
    const by = h - 70, bw = w - 200;
    for (let i = 0; i < items.length; i++) {
      const y = by + i * 20;
      const len = Math.max(24, (Math.log10(items[i][1] + 1) / Math.log10(401)) * bw);
      poly(f, [[130, y], [130 + len, y], [130 + len, y + 14], [130, y + 14]],
        { stroke: 'transparent', fill: items[i][2] } as any);
      text(f, items[i][0], 40, y + 11, { color: items[i][2], font: '11px sans-serif' });
    }

    footnotes(f, [
      '文本的信息密度高得惊人——人类全部知识的文字版只是块硬盘的事',
      '费米估算顺带发现反直觉结论：信息的瓶颈从来不是存储而是检索与理解',
      '同思路可估全球数据量（2025 年 ~200 ZB）与 DNA 存储容量（215 PB/克）',
    ]);
    heading(f, '图书馆字节：文字其实很轻');
  },
});
registerViz(fermiLibrary);

/** 费米估算：闪电的能量。 */
const fermiLightning = defineViz({
  slug: 'fermi-lightning', title: '费米估算：闪电的能量', animated: true,
  params: {
    V: { type: 'range', min: 10, max: 100, default: 30, step: 5, label: '闪电电压 (亿 V)' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const V = num(params, 'V', 30);
    clear(f);
    // 闪电路径（锯齿）
    const rand = (i: number): number => Math.abs(Math.sin(i * 91.7) * 43758.5) % 1;
    const bolt: [number, number][] = [[w * 0.5, 56]];
    for (let i = 1; i <= 14; i++) {
      const x = w * 0.5 + (rand(i) - 0.5) * 150;
      const y = 56 + i * ((h - 220) / 14);
      bolt.push([x, y]);
    }
    const glow = 0.6 + 0.4 * Math.sin(f.t * 8);
    poly(f, bolt, { stroke: `rgba(255,250,200,${glow})`, lw: 3.4 });
    poly(f, bolt, { stroke: `rgba(140,210,255,${glow * 0.5})`, lw: 8 });
    // 计算三步
    const calc: [string, string][] = [
      ['电流×时间', '~2×10⁴ A × 3×10⁻² s → 电荷 ~600 C'],
      ['电压×电荷', `${V} 亿 V × 600 C ≈ 10¹⁰~10¹¹ J`],
      ['换算', '≈ 25~250 吨 TNT——却只照亮半秒'],
    ];
    for (let i = 0; i < calc.length; i++) {
      const y = h - 148 + i * 40;
      text(f, `${i + 1}. ${calc[i][0]}：${calc[i][1]}`, 40, y, { color: C.cyan, font: '13px sans-serif' });
    }
    text(f, `电压设定 ${V} 亿 V：全球每秒约 40 道闪电——地球年均 1.4 亿道`, 40, 44, { color: C.warm, font: '14px sans-serif' });

    footnotes(f, [
      '一次闪电 ~10¹⁰ J：够一个家庭用几个月，却在半秒内照亮整座城市',
      '通道温度 ~3×10⁴ K（太阳表面 5 倍）→ 雷声=空气被炸开的冲击波',
      "闪电把 N₂ 变 NO：大气固氮的天然路径——雷雨后空气的'清新'部分来自它",
    ]);
    heading(f, '闪电能量：半秒的 10¹⁰ 焦耳');
  },
});
registerViz(fermiLightning);
