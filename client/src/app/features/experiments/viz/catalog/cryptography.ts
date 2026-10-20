import { defineViz, num, str } from '../types';
import { registerViz } from '../registry';
import {
  C,
  PALETTE,
  bars,
  dot,
  footnotes,
  grid,
  heading,
  poly,
  rng,
  seg,
  text,
  view,
} from '../canvas';

/** 模幂。 */
function modPow(base: number, exp: number, mod: number): number {
  let result = 1;
  let b = base % mod;
  let e = exp;
  while (e > 0) {
    if (e & 1) result = (result * b) % mod;
    b = (b * b) % mod;
    e >>= 1;
  }
  return result;
}

/** 最大公约数（扩展欧几里得同时给出系数）。 */
function extGcd(a: number, b: number): { g: number; x: number; y: number } {
  if (b === 0) return { g: a, x: 1, y: 0 };
  const r = extGcd(b, a % b);
  return { g: r.g, x: r.y, y: r.x - Math.floor(a / b) * r.y };
}

/** 模逆元。 */
function modInverse(a: number, m: number): number {
  const r = extGcd(((a % m) + m) % m, m);
  return r.g === 1 ? ((r.x % m) + m) % m : NaN;
}

/** 素性判断。 */
function isPrime(n: number): boolean {
  if (n < 2) return false;
  for (let i = 2; i * i <= n; i++) if (n % i === 0) return false;
  return true;
}

/** 欧拉函数。 */
function eulerPhi(n: number): number {
  let result = n;
  let x = n;
  for (let p = 2; p * p <= x; p++) {
    if (x % p === 0) {
      while (x % p === 0) x /= p;
      result -= result / p;
    }
  }
  if (x > 1) result -= result / x;
  return result;
}

/** A80 密码学入门。 */
const cryptography = defineViz({
  slug: 'cryptography',
  title: '密码学入门',
  params: {
    kind: { type: 'select', options: ['对称加密（AES）', '非对称加密（RSA）', '哈希与签名'], default: '非对称加密（RSA）', label: '方案' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const kind = str(params, 'kind', '非对称加密（RSA）');
    const midY = h / 2;
    const boxOf = (x: number, y: number, label: string, color: string): void => {
      f.ctx.save();
      f.ctx.fillStyle = `${color}33`;
      f.ctx.strokeStyle = color;
      f.ctx.lineWidth = 2;
      f.ctx.fillRect(x - 52, y - 26, 104, 52);
      f.ctx.strokeRect(x - 52, y - 26, 104, 52);
      f.ctx.restore();
      text(f, label, x, y + 5, { align: 'center', color: C.fg, font: '12px "Segoe UI", system-ui, sans-serif' });
    };

    if (kind.startsWith('对称')) {
      boxOf(w * 0.16, midY, '发送方 A', C.accent);
      boxOf(w * 0.84, midY, '接收方 B', C.green);
      seg(f, w * 0.24, midY, w * 0.76, midY, C.warm, 2.4);
      text(f, '同一把密钥 K 加密 / 解密', w / 2, midY - 14, { align: 'center', color: C.warm, font: '12px sans-serif' });
      text(f, 'K', w / 2, midY + 22, { align: 'center', color: C.warm, font: 'bold 15px sans-serif' });
      text(f, '密钥分发是难题：怎么安全地把 K 交给对方？', w / 2, midY + 70, { align: 'center', color: C.dim, font: '12px sans-serif' });
      footnotes(f, [
        '对称加密：加解密用同一密钥，速度快（AES 每秒可处理 GB 级数据）',
        '致命问题：n 个用户两两通信需要 n(n-1)/2 把密钥，且密钥分发本身需要安全信道',
        '实际系统用"非对称协商密钥 + 对称加密数据"的混合方案（如 TLS）',
      ]);
    } else if (kind.startsWith('非对称')) {
      boxOf(w * 0.16, midY, '发送方 A', C.accent);
      boxOf(w * 0.84, midY, '接收方 B', C.green);
      // 公钥与私钥
      text(f, '公钥 (n, e)', w * 0.84, midY - 44, { align: 'center', color: C.cool, font: '12px sans-serif' });
      text(f, '私钥 d', w * 0.84, midY + 48, { align: 'center', color: C.hot, font: '12px sans-serif' });
      seg(f, w * 0.24, midY, w * 0.76, midY, C.cool, 2.4);
      text(f, '用公钥加密', w / 2, midY - 12, { align: 'center', color: C.cool, font: '12px sans-serif' });
      seg(f, w * 0.76, midY + 20, w * 0.24, midY + 20, C.hot, 2.4);
      text(f, '用私钥解密', w / 2, midY + 38, { align: 'center', color: C.hot, font: '12px sans-serif' });
      footnotes(f, [
        '非对称加密：公钥公开、私钥保密；公钥加密的数据只有私钥能解（RSA 基于大整数分解难题）',
        'RSA 的数学基础：知道 n = p·q 求 p、q 极难；而知道 p、q 就能算出解密指数 d',
        '非对称加密很慢（比 AES 慢千倍），因此只用来传密钥或做签名',
      ]);
    } else {
      boxOf(w * 0.16, midY, '原文 M', C.accent);
      boxOf(w * 0.5, midY, '哈希 H(M)', C.warm);
      boxOf(w * 0.84, midY, '摘要固定长度', C.green);
      seg(f, w * 0.22, midY, w * 0.44, midY, C.warm, 2.2);
      seg(f, w * 0.56, midY, w * 0.78, midY, C.green, 2.2);
      footnotes(f, [
        '哈希函数把任意长度输入压成固定长度摘要（SHA-256 → 256 bit）',
        '三大性质：单向（不可逆）、抗碰撞（找两个同摘要的输入不可行）、雪崩效应（改一位输出全变）',
        '数字签名 = 用私钥对摘要签名，任何人都能用公钥验证 —— 保证完整性与不可否认性',
      ]);
    }
    heading(f, `密码学：${kind}`);
  },
});

/** A81 凯撒密码。 */
const caesarCipher = defineViz({
  slug: 'caesar-cipher',
  title: '凯撒密码',
  params: {
    shift: { type: 'range', min: 1, max: 25, default: 3, label: '移位量' },
    text: { type: 'select', options: ['MATH IS BEAUTIFUL', 'HELLO WORLD', 'CRYPTOGRAPHY'], default: 'MATH IS BEAUTIFUL', label: '明文' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const shift = Math.round(num(params, 'shift', 3));
    const plain = str(params, 'text', 'MATH IS BEAUTIFUL');
    const encrypt = (s: string): string =>
      s.split('').map((ch) => (ch >= 'A' && ch <= 'Z' ? String.fromCharCode(((ch.charCodeAt(0) - 65 + shift) % 26) + 65) : ch)).join('');
    const cipher = encrypt(plain);

    // 字母环
    const cx = w * 0.3;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.24;
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2 - Math.PI / 2;
      const a2 = ((i + shift) % 26 / 26) * Math.PI * 2 - Math.PI / 2;
      dot(f, cx + r * Math.cos(a), cy + r * Math.sin(a), 9, C.accent);
      text(f, String.fromCharCode(65 + i), cx + r * Math.cos(a), cy + r * Math.sin(a) + 4, { align: 'center', color: '#fff', font: '10px sans-serif' });
      const x2 = cx + r * 1.42 * Math.cos(a2);
      const y2 = cy + r * 1.42 * Math.sin(a2);
      dot(f, x2, y2, 9, C.warm);
      text(f, String.fromCharCode(65 + i), x2, y2 + 4, { align: 'center', color: '#fff', font: '10px sans-serif' });
      if (i % 4 === 0) {
        seg(f, cx + r * Math.cos(a), cy + r * Math.sin(a), x2, y2, 'rgba(160,174,192,0.35)', 1);
      }
    }

    // 文字对照
    text(f, `明文：${plain}`, w * 0.58, h / 2 - 24, { color: C.accent, font: '14px Consolas, monospace' });
    text(f, `密文：${cipher}`, w * 0.58, h / 2 + 6, { color: C.warm, font: '14px Consolas, monospace' });
    text(f, `移位 ${shift}：密钥空间只有 25 种，暴力破解瞬间完成`, w * 0.58, h / 2 + 36, { color: C.dim, font: '12px sans-serif' });

    footnotes(f, [
      `凯撒密码：每个字母向后移 ${shift} 位（环上旋转），是很早的替换密码`,
      '破解方法：只有 25 种可能，试一遍即可；即使不穷举，用字母频率分析（E/T/A 最常见）也能秒破',
      '移位密码的安全性来自"密钥空间"，而不是算法保密 —— 柯克霍夫原则：算法公开，安全性只在密钥',
    ]);
    heading(f, '凯撒密码：字母环上的旋转');
  },
});

/** A82 希尔密码。 */
const hillCipher = defineViz({
  slug: 'hill-cipher',
  title: '希尔密码',
  params: {
    a: { type: 'range', min: 0, max: 25, default: 3, label: 'K₁₁' },
    b: { type: 'range', min: 0, max: 25, default: 3, label: 'K₁₂' },
    c: { type: 'range', min: 0, max: 25, default: 2, label: 'K₂₁' },
    d: { type: 'range', min: 0, max: 25, default: 5, label: 'K₂₂' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = Math.round(num(params, 'a', 3));
    const b = Math.round(num(params, 'b', 3));
    const c = Math.round(num(params, 'c', 2));
    const d = Math.round(num(params, 'd', 5));
    const det = ((a * d - b * c) % 26 + 26) % 26;
    const detInv = modInverse(det, 26);
    const invertible = !Number.isNaN(detInv);

    const plain = 'HI';
    const nums = plain.split('').map((ch) => ch.charCodeAt(0) - 65);
    const enc = [((a * nums[0] + b * nums[1]) % 26 + 26) % 26, ((c * nums[0] + d * nums[1]) % 26 + 26) % 26];
    const cipher = enc.map((n) => String.fromCharCode(65 + n)).join('');
    const dec = invertible
      ? [
        (((detInv * (d * enc[0] - b * enc[1])) % 26) + 26) % 26,
        (((detInv * (-c * enc[0] + a * enc[1])) % 26) + 26) % 26,
      ]
      : [NaN, NaN];
    const decrypted = dec.map((n) => (Number.isNaN(n) ? '?' : String.fromCharCode(65 + n))).join('');

    // 矩阵展示
    const cell = 46;
    const oy = h / 2 - 60;
    const mat: Array<[number, number, number]> = [[0, 0, a], [0, 1, b], [1, 0, c], [1, 1, d]];
    mat.forEach(([r, cc, val]) => {
      f.ctx.save();
      f.ctx.fillStyle = `${C.accent}55`;
      f.ctx.fillRect(w * 0.12 + cc * (cell + 3), oy + r * (cell + 3), cell, cell);
      f.ctx.restore();
      text(f, String(val), w * 0.12 + cc * (cell + 3) + cell / 2, oy + r * (cell + 3) + cell * 0.65, { align: 'center', color: C.fg, font: '14px Consolas, monospace' });
    });
    text(f, '密钥矩阵 K', w * 0.12, oy - 10, { color: C.accent, font: '12px sans-serif' });

    text(f, `明文向量 (${nums[0]}, ${nums[1]}) → 密文向量 (${enc[0]}, ${enc[1]})`, w * 0.42, oy + 30, { color: C.fg, font: '13px Consolas, monospace' });
    text(f, `${plain} → ${cipher}`, w * 0.42, oy + 60, { color: C.warm, font: '16px Consolas, monospace' });
    seg(f, w * 0.12, oy + 100, w - 40, oy + 100, 'rgba(160,174,192,0.3)', 1);
    text(f, `det(K) mod 26 = ${det}，逆元 = ${invertible ? detInv : '不存在（矩阵不可逆，无法解密）'}`, w * 0.42, oy + 130, { color: invertible ? C.green : C.hot, font: '13px Consolas, monospace' });
    text(f, `解密：${cipher} → ${decrypted}${decrypted === plain ? ' ✓ 还原成功' : ''}`, w * 0.42, oy + 158, { color: C.green, font: '13px Consolas, monospace' });

    footnotes(f, [
      '希尔密码把字母分组当作向量，用矩阵乘法加密：c = K·p (mod 26)',
      invertible ? '解密需要矩阵的模逆：K⁻¹ = det⁻¹·adj(K) mod 26，因此 det 必须与 26 互质' : '当前密钥矩阵行列式与 26 不互质，无法解密 —— 这正体现了"可逆性"要求',
      '希尔密码是"分组密码"的雏形：一次处理多个字母，频率分析更难奏效（但有已知明文攻击）',
    ]);
    heading(f, '希尔密码：矩阵加密');
  },
});

/** A83 RSA 密码。 */
const rsaCipher = defineViz({
  slug: 'rsa-cipher',
  title: 'RSA密码',
  params: {
    p: { type: 'range', min: 3, max: 31, default: 11, label: '素数 p' },
    q: { type: 'range', min: 3, max: 31, default: 17, label: '素数 q' },
    e: { type: 'range', min: 3, max: 40, default: 7, label: '公钥指数 e' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    let p = Math.round(num(params, 'p', 11));
    let q = Math.round(num(params, 'q', 17));
    if (!isPrime(p)) p = 11;
    if (!isPrime(q)) q = 17;
    if (p === q) q = 17;
    const e = Math.round(num(params, 'e', 7));
    const n = p * q;
    const phi = (p - 1) * (q - 1);
    const d = modInverse(e, phi);
    const valid = !Number.isNaN(d);
    const message = 42 % n;
    const cipher = modPow(message, e, n);
    const decrypted = valid ? modPow(cipher, d, n) : NaN;

    const rows: Array<[string, string, string]> = [
      ['素数 p、q', `${p}、${q}`, '保密（选两个大素数）'],
      ['公开模数 n = p·q', String(n), '公开'],
      ['欧拉函数 φ(n) = (p-1)(q-1)', String(phi), '保密（知道 n 但不知 p、q 就算不出）'],
      ['公钥指数 e（与 φ 互质）', String(e), '公开'],
      ['私钥指数 d = e⁻¹ mod φ', valid ? String(d) : '不存在', '严格保密'],
    ];
    rows.forEach(([label, value, note], i) => {
      const y = 68 + i * 30;
      text(f, label, 40, y, { color: C.dim, font: '12px sans-serif' });
      text(f, value, w * 0.48, y, { color: C.accent, font: 'bold 13px Consolas, monospace' });
      text(f, note, w * 0.62, y, { color: C.dim, font: '11px sans-serif' });
    });
    seg(f, 40, 68 + rows.length * 30 + 4, w - 40, 68 + rows.length * 30 + 4, 'rgba(160,174,192,0.3)', 1);

    const y2 = 68 + rows.length * 30 + 34;
    text(f, `加密：c = m^e mod n = ${message}^${e} mod ${n} = ${cipher}`, 40, y2, { color: C.warm, font: '13px Consolas, monospace' });
    text(f, `解密：m = c^d mod n = ${cipher}^${valid ? d : '?'} mod ${n} = ${Number.isNaN(decrypted) ? '—' : decrypted}`, 40, y2 + 26, { color: C.green, font: '13px Consolas, monospace' });
    text(f, valid && decrypted === message ? '✓ 解密还原出原始消息' : '✗ e 与 φ(n) 不互质，无法生成私钥', 40, y2 + 52, { color: valid && decrypted === message ? C.green : C.hot, font: '13px sans-serif' });

    footnotes(f, [
      `密钥生成：选素数 ${p}、${q} → n = ${n}，φ(n) = ${phi}，e = ${e}，d = ${valid ? d : '—'}`,
      '安全性根基：已知 n 求 p、q（大整数分解）在计算上不可行；而知道 p、q 就能算出 d',
      '实际 RSA 用 2048~4096 位模数；破解 2048 位 RSA 需要远超现有算力的时间（量子计算机是潜在威胁）',
    ]);
    heading(f, 'RSA：公钥密码的数学结构');
  },
});

/** A84 Diffie-Hellman。 */
const diffieHellman = defineViz({
  slug: 'diffie-hellman',
  title: 'Diffie-Hellman',
  params: {
    g: { type: 'range', min: 2, max: 12, default: 5, label: '生成元 g' },
    p: { type: 'range', min: 11, max: 61, default: 23, label: '模数 p（素数）' },
    a: { type: 'range', min: 2, max: 15, default: 6, label: 'A 的私钥 a' },
    b: { type: 'range', min: 2, max: 15, default: 9, label: 'B 的私钥 b' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const g = Math.round(num(params, 'g', 5));
    let p = Math.round(num(params, 'p', 23));
    if (!isPrime(p)) p = 23;
    const a = Math.round(num(params, 'a', 6));
    const b = Math.round(num(params, 'b', 9));
    const A = modPow(g, a, p);
    const B = modPow(g, b, p);
    const sA = modPow(B, a, p);
    const sB = modPow(A, b, p);

    const steps: Array<[string, string, string]> = [
  ['公开参数', `p = ${p}，g = ${g}`, '双方与攻击者都知道'],
      ['A 选私钥 a 并发送', `A = g^a mod p = ${g}^${a} mod ${p} = ${A}`, `a = ${a} 保密`],
      ['B 选私钥 b 并发送', `B = g^b mod p = ${g}^${b} mod ${p} = ${B}`, `b = ${b} 保密`],
      ['A 计算共享密钥', `s = B^a mod p = ${B}^${a} mod ${p} = ${sA}`, '攻击者只知道 A、B'],
      ['B 计算共享密钥', `s = A^b mod p = ${A}^${b} mod ${p} = ${sB}`, '与 A 的结果相同'],
    ];
    steps.forEach(([label, formula, note], i) => {
      const y = 64 + i * 34;
      const ok = i >= 3 && sA === sB;
      text(f, label, 40, y, { color: ok ? C.green : C.dim, font: '12px sans-serif' });
      text(f, formula, w * 0.36, y, { color: ok ? C.green : C.accent, font: '13px Consolas, monospace' });
      text(f, note, w * 0.72, y, { color: C.dim, font: '11px sans-serif' });
    });

    // 交换示意
    const cx = w / 2;
    const cy = h - 60;
    dot(f, cx - 180, cy, 10, C.accent);
    dot(f, cx + 180, cy, 10, C.hot);
    text(f, 'A', cx - 180, cy + 26, { align: 'center', color: C.accent, font: '12px sans-serif' });
    text(f, 'B', cx + 180, cy + 26, { align: 'center', color: C.hot, font: '12px sans-serif' });
    seg(f, cx - 170, cy, cx + 170, cy, `${C.cool}cc`, 2);
    text(f, `公开交换 A=${A}、B=${B}`, cx, cy - 12, { align: 'center', color: C.cool, font: '11px sans-serif' });

    footnotes(f, [
      `双方独立算出同一共享密钥 s = ${sA} = g^(ab) mod p，但从未直接传输它`,
      '安全性来自离散对数难题：已知 g、p、g^a mod p 求 a 很难（当 p 很大时）',
      'DH 只协商密钥（不加密数据）；实际协议用 ECDH（椭圆曲线版）以获得更短的密钥与更高强度',
    ]);
    heading(f, 'Diffie-Hellman 密钥交换');
  },
});

/** A85 一次性密码本。 */
const oneTimePad = defineViz({
  slug: 'one-time-pad',
  title: '一次性密码本',
  params: {
    seed: { type: 'range', min: 1, max: 30, default: 7, label: '密钥种子' },
    bits: { type: 'range', min: 8, max: 40, default: 20, label: '比特数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const seed = Math.round(num(params, 'seed', 7));
    const bits = Math.round(num(params, 'bits', 20));
    const rand = rng(seed);
    const message = Array.from({ length: bits }, (_, i) => ((i * 7 + seed) % 3 === 0 ? 1 : 0));
    const key = Array.from({ length: bits }, () => (rand() < 0.5 ? 0 : 1));
    const cipher = message.map((m, i) => m ^ key[i]);
    const decrypted = cipher.map((c, i) => c ^ key[i]);

    const cellW = (w - 120) / bits;
    const rows: Array<[string, number[], string]> = [
      ['明文 M', message, C.accent],
      ['密钥 K', key, C.warm],
      ['密文 C = M⊕K', cipher, C.hot],
      ['解密 M = C⊕K', decrypted, C.green],
    ];
    rows.forEach(([label, arr, color], ri) => {
      const y = 70 + ri * 56;
      text(f, label, 30, y + 14, { color, font: '12px sans-serif' });
      arr.forEach((bit, i) => {
        const x = 110 + i * cellW;
        f.ctx.save();
        f.ctx.fillStyle = bit === 1 ? `${color}cc` : `${color}33`;
        f.ctx.fillRect(x, y, Math.max(3, cellW - 2), 26);
        f.ctx.restore();
      });
    });
    // 香农定理说明
    const y = 70 + rows.length * 56 + 10;
    text(f, `密钥长度 = 明文长度 = ${bits} bit；密文的每一位都与明文无统计关联`, 30, y, { color: C.dim, font: '12px sans-serif' });
    text(f, decrypted.join('') === message.join('') ? '✓ 解密完全还原' : '✗', 30, y + 24, { color: C.green, font: '12px sans-serif' });

    footnotes(f, [
      '一次性密码本：密钥必须真随机、与明文等长、且绝不复用（三条缺一不可）',
      '香农证明它是唯一具有"完善保密性"的加密方案：密文不泄露明文的任何信息（无论算力多强）',
      '缺点：密钥分发与保管极难（密钥和消息一样长）；现实中用 AES 等流密码近似其效果',
    ]);
    heading(f, '一次性密码本：完美但昂贵');
  },
});

/** A86 椭圆曲线。 */
const ellipticCurve = defineViz({
  slug: 'elliptic-curve',
  title: '椭圆曲线密码',
  params: {
    a: { type: 'range', min: -4, max: 2, default: -2, step: 0.1, label: '系数 a' },
    b: { type: 'range', min: -3, max: 4, default: 1, step: 0.1, label: '系数 b' },
    px: { type: 'range', min: -3, max: 3, default: 1.2, step: 0.1, label: '点 P 的 x' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const a = num(params, 'a', -2);
    const b = num(params, 'b', 1);
    const pxVal = num(params, 'px', 1.2);
    const disc = -16 * (4 * a * a * a + 27 * b * b);
    const v = view(f, { xMin: -4, xMax: 4, yMin: -4, yMax: 4, inset: 40 });
    grid(f, v, { divisions: 6, ticks: true });

    // 曲线 y² = x³ + ax + b
    for (const sign of [1, -1]) {
      const pts: Array<[number, number]> = [];
      for (let x = -4; x <= 4; x += 0.01) {
        const rhs = x * x * x + a * x + b;
        if (rhs < 0) {
          if (pts.length > 1) poly(f, pts.splice(0, pts.length), { stroke: C.accent, lw: 2.4 });
          continue;
        }
        const y = sign * Math.sqrt(rhs);
        if (Math.abs(y) > 4) {
          if (pts.length > 1) poly(f, pts.splice(0, pts.length), { stroke: C.accent, lw: 2.4 });
          continue;
        }
        pts.push([v.sx(x), v.sy(y)]);
      }
      if (pts.length > 1) poly(f, pts, { stroke: C.accent, lw: 2.4 });
    }

    // 点 P 与 2P（切线法）
    const pySq = pxVal ** 3 + a * pxVal + b;
    if (pySq >= 0) {
      const py = Math.sqrt(pySq);
      dot(f, v.sx(pxVal), v.sy(py), 5.5, C.warm);
      text(f, 'P', v.sx(pxVal) + 8, v.sy(py) - 6, { color: C.warm, font: 'bold 12px sans-serif' });
      // 切线斜率
      const slope = (3 * pxVal * pxVal + a) / (2 * py);
      const x2 = slope * slope - 2 * pxVal;
      const y2 = slope * (pxVal - x2) - py;
      if (Math.abs(x2) < 4 && Math.abs(y2) < 4) {
        dot(f, v.sx(x2), v.sy(-y2), 4, C.cool);
        dot(f, v.sx(x2), v.sy(y2), 5.5, C.green);
        text(f, '2P', v.sx(x2) + 8, v.sy(y2) - 6, { color: C.green, font: 'bold 12px sans-serif' });
        seg(f, v.sx(pxVal - 1.4), v.sy(py - 1.4 * slope), v.sx(x2 + 0.6), v.sy(slope !== 0 ? py + (x2 + 0.6 - pxVal) * slope : 0), 'rgba(160,174,192,0.5)', 1.4);
      }
    }

    footnotes(f, [
  `曲线 y² = x³ ${a >= 0 ? '+ ' + a : '- ' + Math.abs(a)}x ${b >= 0 ? '+ ' + b : '- ' + Math.abs(b)}，判别式 -16(4a³+27b²) = ${disc.toFixed(2)}${disc !== 0 ? ' ≠ 0（光滑，可用于密码学）' : ' = 0（奇异，不可用）'}`,
      '点加法：P + Q 定义为连线与曲线的第三个交点的镜像；点倍加 P + P 用切线（绿点即 2P）',
      '椭圆曲线群是一个阿贝尔群；在有限域上的点构成循环群，其离散对数问题比整数分解更难',
    ]);
    heading(f, '椭圆曲线与点加法');
  },
});

/** A87 中国剩余定理。 */
const chineseRemainder = defineViz({
  slug: 'chinese-remainder',
  title: '中国剩余定理深化',
  params: {
    r1: { type: 'range', min: 0, max: 6, default: 2, label: '除以 3 的余数' },
    r2: { type: 'range', min: 0, max: 9, default: 3, label: '除以 5 的余数' },
    r3: { type: 'range', min: 0, max: 6, default: 2, label: '除以 7 的余数' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const r1 = Math.round(num(params, 'r1', 2));
    const r2 = Math.round(num(params, 'r2', 3));
    const r3 = Math.round(num(params, 'r3', 2));
    const M = 3 * 5 * 7;
    // 暴力找解（也可用 CRT 公式）
    let solution = -1;
    for (let x = 0; x < M; x++) {
      if (x % 3 === r1 && x % 5 === r2 && x % 7 === r3) {
        solution = x;
        break;
      }
    }

    // 三组同余的数轴
    const rows: Array<[number, number, string, string]> = [[3, r1, C.accent, `x ≡ ${r1} (mod 3)`], [5, r2, C.warm, `x ≡ ${r2} (mod 5)`], [7, r3, C.green, `x ≡ ${r3} (mod 7)`]];
    rows.forEach(([mod, rem, color, label], ri) => {
      const y = 70 + ri * 76;
      text(f, label, 30, y - 12, { color, font: '12px sans-serif' });
      seg(f, 30, y + 14, w - 40, y + 14, 'rgba(160,174,192,0.3)', 1);
      for (let x = 0; x < M; x++) {
        const px = 30 + (x / (M - 1)) * (w - 80);
        if (x % mod === rem) dot(f, px, y + 14, 4.5, color);
      }
      // 解的位置
      if (solution >= 0) {
        const px = 30 + (solution / (M - 1)) * (w - 80);
        seg(f, px, y, px, y + 28, `${C.hot}aa`, 1.6);
      }
    });

    const y2 = 70 + 3 * 76 + 10;
    text(f, `模数 3、5、7 两两互质 ⇒ 在模 ${M} 下有唯一解`, 30, y2, { color: C.dim, font: '12px sans-serif' });
    text(f, solution >= 0 ? `x = ${solution}（在 0 ≤ x < ${M} 内唯一）` : '无解（余数组合不相容）', 30, y2 + 26, {
      color: solution >= 0 ? C.green : C.hot,
      font: 'bold 14px "Segoe UI", system-ui, sans-serif',
    });
    // CRT 公式
    let x0 = 0;
    rows.forEach(([mod, rem]) => {
      const Mi = M / mod;
      const inv = modInverse(Mi % mod, mod);
      if (!Number.isNaN(inv)) x0 += rem * Mi * inv;
    });
    text(f, `CRT 公式：x = Σ rᵢ·Mᵢ·(Mᵢ⁻¹ mod mᵢ) mod M = ${((x0 % M) + M) % M}`, 30, y2 + 52, { color: C.cool, font: '12px Consolas, monospace' });

    footnotes(f, [
      `求解 x ≡ ${r1}(mod 3)、x ≡ ${r2}(mod 5)、x ≡ ${r3}(mod 7)：三组同余条件的交点唯一`,
      '中国剩余定理：模数两两互质时，同余方程组在模 M 下有唯一解（《孙子算经》"物不知数"问题）',
      '应用：RSA 加速解密（把大模数运算拆成小模数）、大整数运算、秘密共享（Shamir 方案）',
    ]);
    heading(f, '中国剩余定理：同余方程组的唯一解');
  },
});

/** A88 模运算深化。 */
const modularArithmetic = defineViz({
  slug: 'modular-arithmetic',
  title: '模运算深化',
  params: {
    mod: { type: 'range', min: 3, max: 12, default: 7, label: '模数 m' },
    table: { type: 'select', options: ['加法表', '乘法表', '乘法群'], default: '乘法表', label: '运算表' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const m = Math.round(num(params, 'mod', 7));
    const table = str(params, 'table', '乘法表');
    const size = Math.min((w - 120) / (m + 1), (h - 185) / (m + 1), 40);
    const ox = (w - (m + 1) * size) / 2;
    const oy = 60;

    for (let i = 0; i <= m; i++) {
      text(f, i === 0 ? '×' : String(i % m), ox + i * size + size / 2, oy + size * 0.65, { align: 'center', color: C.dim, font: '11px sans-serif' });
      text(f, i === 0 ? '' : String(i % m), ox - 14, oy + i * size + size * 0.65, { align: 'right', color: C.dim, font: '11px sans-serif' });
    }
    for (let i = 1; i <= m; i++) {
      for (let j = 1; j <= m; j++) {
        const val = table === '加法表' ? (i + j) % m : (i * j) % m;
        const x = ox + j * size;
        const y = oy + i * size;
        const invertible = table !== '加法表' && extGcd(i * j, m).g === 1;
        f.ctx.save();
        f.ctx.fillStyle = table === '加法表'
          ? `hsla(230, 60%, ${22 + (val / m) * 30}%, 0.92)`
          : val === 0 ? 'rgba(58,74,99,0.75)' : invertible ? `hsla(${230 - (val / m) * 100}, 60%, 45%, 0.9)` : `hsla(200, 30%, ${25 + (val / m) * 20}%, 0.9)`;
        f.ctx.fillRect(x, y, size - 1.5, size - 1.5);
        f.ctx.restore();
        text(f, String(val), x + size / 2, y + size * 0.66, { align: 'center', color: C.fg, font: `${Math.max(9, size * 0.32)}px Consolas, monospace` });
      }
    }

    const phi = eulerPhi(m);
    const isPrimeM = isPrime(m);
    footnotes(f, [
      `${table}（mod ${m}）：${table === '乘法表' ? '灰暗格表示结果为 0（无逆元）；亮色格与 m 互质，有逆元' : '每个值都均匀出现，构成循环群 Z_m'}`,
      `与 ${m} 互质的数有 φ(${m}) = ${phi} 个${isPrimeM ? '（m 是素数，因此除 0 外全部可逆）' : ''}`,
      '模运算把无穷整数折成有限环：这是 RSA、椭圆曲线、哈希、校验码的共同数学舞台',
    ]);
    heading(f, `模运算：${table} mod ${m}`);
  },
});

/** A89 欧拉定理深化。 */
const eulerTotient = defineViz({
  slug: 'euler-totient',
  title: '欧拉定理深化',
  params: {
    n: { type: 'range', min: 3, max: 40, default: 15, label: '模数 n' },
    a: { type: 'range', min: 1, max: 20, default: 7, label: '底数 a' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    const n = Math.round(num(params, 'n', 15));
    const a = Math.round(num(params, 'a', 7));
    const phi = eulerPhi(n);
    const coprime = extGcd(a, n).g === 1;

    // φ(n) 曲线
    const v = view(f, { xMin: 1, xMax: 60, yMin: 0, yMax: 60, inset: 42 });
    grid(f, v, { divisions: 5, ticks: true });
    const pts: Array<[number, number]> = [];
    for (let i = 1; i <= 60; i++) pts.push([v.sx(i), v.sy(eulerPhi(i))]);
    poly(f, pts, { stroke: C.accent, lw: 2 });
    pts.forEach(([x, y]) => dot(f, x, y, 1.8, `${C.accent}88`));
    dot(f, v.sx(n), v.sy(phi), 6, C.warm);

    // 幂序列
    const powers: number[] = [];
    let cur = 1;
    for (let i = 1; i <= phi + 4; i++) {
      cur = (cur * a) % n;
      powers.push(cur);
    }
    const cell = Math.min(34, (w - 120) / powers.length, 30);
    const oy = h - 90;
    powers.forEach((val, i) => {
      const x = 40 + i * (cell + 3);
      const highlight = i + 1 === phi;
      f.ctx.save();
      f.ctx.fillStyle = highlight ? C.green : val === 1 ? `${C.warm}cc` : C.panel;
      f.ctx.fillRect(x, oy, cell, 28);
      f.ctx.restore();
      text(f, String(val), x + cell / 2, oy + 19, { align: 'center', color: C.fg, font: '11px Consolas, monospace' });
      if (cell > 20) text(f, String(i + 1), x + cell / 2, oy + 42, { align: 'center', color: C.dim, font: '9px sans-serif' });
    });
    text(f, `a^k mod n 序列（第 ${phi} 项应为 1）`, 40, oy - 10, { color: C.dim, font: '11px sans-serif' });

    footnotes(f, [
      `φ(${n}) = ${phi}（不大于 ${n} 且与 ${n} 互质的数的个数${isPrime(n) ? '，因为 ' + n + ' 是素数所以 φ = n-1' : ''}）`,
      coprime ? `欧拉定理：a^φ(n) ≡ 1 (mod n)，验证 7^${phi} mod ${n} = ${modPow(a, phi, n)}` : `注意：gcd(${a}, ${n}) ≠ 1，欧拉定理不适用`,
      '欧拉定理是 RSA 的核心（e·d ≡ 1 mod φ(n) 保证解密正确）；n 为素数时退化为费马小定理',
    ]);
    heading(f, '欧拉函数与欧拉定理');
  },
});

/** A90 本原根。 */
const primitiveRoot = defineViz({
  slug: 'primitive-root',
  title: '本原根',
  params: {
    p: { type: 'range', min: 5, max: 31, default: 17, label: '素数 p' },
    g: { type: 'range', min: 2, max: 16, default: 3, label: '候选生成元 g' },
  },
  draw: (f) => {
    const { w, h, params } = f;
    let p = Math.round(num(params, 'p', 17));
    if (!isPrime(p)) p = 17;
    const g = Math.round(num(params, 'g', 3));
    const order = (): number => {
      let cur = 1;
      for (let k = 1; k < p * 2; k++) {
        cur = (cur * g) % p;
        if (cur === 1) return k;
      }
      return -1;
    };
    const ord = order();
    const isPrimitive = ord === p - 1;

    // 循环图
    const cx = w * 0.32;
    const cy = h / 2;
    const r = Math.min(w, h) * 0.28;
    const seq: number[] = [];
    let cur = 1;
    for (let i = 0; i < ord; i++) {
      seq.push(cur);
      cur = (cur * g) % p;
    }
    // 顶点位置（按值排布）
    const posOf = (val: number): [number, number] => {
      const a = (val / p) * Math.PI * 2 - Math.PI / 2;
      return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
    };
    for (let val = 1; val < p; val++) {
      const [x, y] = posOf(val);
      const inCycle = seq.includes(val);
      dot(f, x, y, 8, inCycle ? C.accent : C.panel);
      text(f, String(val), x, y + 4, { align: 'center', color: '#fff', font: '10px sans-serif' });
    }
    // 幂序列的弧
    for (let i = 0; i < seq.length; i++) {
      const from = posOf(seq[i]);
      const to = posOf(seq[(i + 1) % seq.length]);
      seg(f, from[0], from[1], to[0], to[1], `${C.warm}88`, 1.2);
    }

    // 幂表
    const cell = Math.min(26, (w * 0.4) / Math.max(1, ord));
    seq.forEach((val, i) => {
      const x = w * 0.6 + (i % 8) * (cell + 3);
      const y = 70 + Math.floor(i / 8) * (cell + 16);
      f.ctx.save();
      f.ctx.fillStyle = val === 1 ? C.green : C.accent;
      f.ctx.fillRect(x, y, cell, cell);
      f.ctx.restore();
      text(f, String(val), x + cell / 2, y + cell * 0.68, { align: 'center', color: '#fff', font: '10px Consolas, monospace' });
      text(f, String(i + 1), x + cell / 2, y + cell + 12, { align: 'center', color: C.dim, font: '9px sans-serif' });
    });
    text(f, `g^k mod ${p} 序列`, w * 0.6, 56, { color: C.dim, font: '11px sans-serif' });

    footnotes(f, [
      `g = ${g} mod ${p} 的阶 = ${ord}${isPrimitive ? ` = p-1 ⇒ 是模 ${p} 的本原根（生成元）` : ` < p-1 ⇒ 不是本原根（只生成子群）`}`,
      isPrimitive ? `它的幂遍历了 1..${p - 1} 的全部元素（图中所有顶点都被访问）` : `它的幂只覆盖 ${seq.length} 个元素，其余元素无法生成`,
      '本原根的存在性：模 p（素数）总有 φ(p-1) 个本原根；离散对数问题就建立在"g^x = y 反解 x 很难"之上',
    ]);
    heading(f, '本原根：乘法群的生成元');
  },
});

registerViz(
  cryptography,
  caesarCipher,
  hillCipher,
  rsaCipher,
  diffieHellman,
  oneTimePad,
  ellipticCurve,
  chineseRemainder,
  modularArithmetic,
  eulerTotient,
  primitiveRoot,
);
