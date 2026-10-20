package ai

import (
	"regexp"
	"strings"
)

// SpeakableText 把讲解稿里的数学标记转成"能自然念出来"的文本。
//
// 台词里的公式是给学生**看**的：前端拿 KaTeX 渲染 `$y = kx + b$`、`T_{n}(x)`，
// 但同一份文本直接交给 TTS，就会念出 "$"、"反斜杠 cos"、"下划线 n" 这类源码噪音。
// 所以合成前先过一遍这个函数：去掉 $ 定界符、把 LaTeX 命令换成中文读法、
// 把上下标换成"的 n 次方"。
//
// 它只影响送进 TTS 的文本，不改动库里存的台词（显示与朗读各用一份）——
// 种子文稿与 AI 文稿都不受任何影响。
//
//	y = kx + b 里的 k 和 b        <- 它的表达式只有两个字母要操心：$y = kx + b$ 里的 $k$ 和 $b$。
//	T n(x) = 余弦(n 反余弦 x)      <- $T_{n}(x) = \cos(n \arccos x)$
//	x 的 n 次方 = 2 的 1-n 次方    <- $x^{n} = 2^{1-n}$
func SpeakableText(text string) string {
	s := strings.TrimSpace(text)
	if s == "" {
		return ""
	}
	// 绝大多数台词是纯中文，没有数学标记 —— 直接原样返回，避免多余的改写风险
	if !strings.ContainsAny(s, "$\\^_{}") {
		return s
	}

	// 1. 去掉行内/行间公式的 $ 定界符，保留公式内容
	s = strings.ReplaceAll(s, "$$", "")
	s = strings.ReplaceAll(s, "$", "")

	// 2. 由内向外处理带花括号的结构（\frac / \sqrt 的内容里常带 ^{2} 之类，可能多层嵌套，
	//    所以上下标也放在这一轮里，反复处理到稳定为止）
	for i := 0; i < 8; i++ {
		before := s
		s = reSpeakFrac.ReplaceAllString(s, "$2 分之 $1")
		s = reSpeakSqrt.ReplaceAllString(s, "根号 $1")
		s = reSpeakBinom.ReplaceAllString(s, "$1 选 $2 的组合数")
		s = reSpeakStyle.ReplaceAllString(s, "$1") // \text{中文}、\mathbb{N} 等：只留内容
		// 上下标：^{2} → "的 2 次方"，_{n} → 直接连读成 "n"
		s = reSpeakSupBraced.ReplaceAllString(s, " 的 $1 次方")
		s = reSpeakSubBraced.ReplaceAllString(s, " $1")
		s = reSpeakSupPlain.ReplaceAllString(s, " 的 $1 次方")
		s = reSpeakSubPlain.ReplaceAllString(s, " $1")
		if s == before {
			break
		}
	}

	// 3. 命令 → 中文读法；表里没有的多是排版命令（\left、\quad、\displaystyle…），直接丢掉
	s = reSpeakCommand.ReplaceAllStringFunc(s, func(cmd string) string {
		if read, ok := latexSpeak[strings.TrimPrefix(cmd, `\`)]; ok {
			return read
		}
		return ""
	})

	// 4. 去掉剩余的间距命令（\, \; 等）与结构字符；残留的 ^ _ 换成空格，避免"P_n"被念成下划线
	s = reSpeakSlashNonLetter.ReplaceAllString(s, "")
	s = strings.NewReplacer(
		"{", "", "}", "", `\`, "", "&", "",
		"~", " ", "_", " ", "^", " ",
	).Replace(s)

	// 5. 收尾：压缩空白
	return strings.TrimSpace(reSpeakSpaces.ReplaceAllString(s, " "))
}

var (
	reSpeakFrac      = regexp.MustCompile(`\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}`)
	reSpeakSqrt      = regexp.MustCompile(`\\sqrt\s*\{([^{}]*)\}`)
	reSpeakBinom     = regexp.MustCompile(`\\binom\s*\{([^{}]*)\}\s*\{([^{}]*)\}`)
	reSpeakStyle     = regexp.MustCompile(`\\(?:text|textrm|textbf|textit|mathrm|mathbf|mathit|mathbb|mathcal|mathfrak|mathsf|mathtt|operatorname)\s*\{([^{}]*)\}`)
	reSpeakSupBraced = regexp.MustCompile(`\^\s*\{([^{}]*)\}`)
	reSpeakSubBraced = regexp.MustCompile(`_\s*\{([^{}]*)\}`)
	reSpeakSupPlain  = regexp.MustCompile(`\^\s*([0-9A-Za-z])`)
	reSpeakSubPlain  = regexp.MustCompile(`_\s*([0-9A-Za-z])`)
	reSpeakCommand   = regexp.MustCompile(`\\[a-zA-Z]+`)
	// \, \; \! \\ 这类"反斜杠 + 非字母"的间距/换行命令
	reSpeakSlashNonLetter = regexp.MustCompile(`\\[^a-zA-Z]`)
	reSpeakSpaces         = regexp.MustCompile(`\s+`)
)

// latexSpeak 是 LaTeX 命令的中文读法（键不带反斜杠）。
//
// 只收录"念出来要让人听懂"的符号与算符；括号、逗号、加减乘除等普通符号保持原样，
// 交给 TTS 自己读（中文 TTS 会把 = 读成"等于"、+ 读成"加"）。
var latexSpeak = map[string]string{
	// 三角函数与常用函数
	"cos": "余弦", "sin": "正弦", "tan": "正切", "cot": "余切", "sec": "正割", "csc": "余割",
	"arccos": "反余弦", "arcsin": "反正弦", "arctan": "反正切",
	"log": "对数", "lg": "常用对数", "ln": "自然对数", "exp": "指数",
	"lim": "极限", "max": "最大值", "min": "最小值", "sup": "上确界", "inf": "下确界",
	"gcd": "最大公约数", "lcm": "最小公倍数", "det": "行列式", "dim": "维数", "deg": "次数",
	"sqrt": "根号",
	// 大运算符
	"sum": "求和", "prod": "连乘", "coprod": "连乘",
	"int": "积分", "iint": "二重积分", "iiint": "三重积分", "oint": "环路积分",
	"partial": "偏导", "nabla": "梯度",
	// 关系与集合
	"le": "小于等于", "leq": "小于等于", "geq": "大于等于", "ge": "大于等于",
	"ne": "不等于", "neq": "不等于", "approx": "约等于", "equiv": "恒等于",
	"sim": "相似于", "propto": "正比于", "cong": "全等于",
	"to": "趋于", "rightarrow": "趋于", "leftarrow": "得到",
	"Rightarrow": "推出", "Leftrightarrow": "等价于",
	"infty": "无穷大",
	"in":    "属于", "notin": "不属于",
	"subset": "包含于", "subseteq": "包含于", "supset": "包含", "supseteq": "包含",
	"cup": "并", "cap": "交", "emptyset": "空集", "varnothing": "空集",
	"forall": "任意", "exists": "存在", "nexists": "不存在",
	// 运算与几何
	"pm": "正负", "mp": "负正", "cdot": "乘", "times": "乘", "div": "除以",
	"circ": "度", "angle": "角", "triangle": "三角形",
	"perp": "垂直于", "parallel": "平行于",
	"ldots": "等等", "dots": "等等", "cdots": "等等", "vdots": "", "ddots": "",
	// 希腊字母
	"alpha": "阿尔法", "beta": "贝塔", "gamma": "伽马", "delta": "德尔塔",
	"epsilon": "艾普西隆", "varepsilon": "艾普西隆", "zeta": "泽塔", "eta": "伊塔",
	"theta": "西塔", "vartheta": "西塔", "iota": "约塔", "kappa": "卡帕",
	"lambda": "兰姆达", "mu": "缪", "nu": "纽", "xi": "克西", "pi": "派", "varpi": "派",
	"rho": "柔", "sigma": "西格玛", "tau": "陶", "upsilon": "宇普西隆",
	"phi": "斐", "varphi": "斐", "chi": "卡", "psi": "普西", "omega": "欧米伽",
	"Gamma": "伽马", "Delta": "德尔塔", "Theta": "西塔", "Lambda": "兰姆达",
	"Xi": "克西", "Pi": "派", "Sigma": "西格玛", "Phi": "斐", "Psi": "普西", "Omega": "欧米伽",
	// 向量/装饰（内容由结构与上下标规则保留下来）
	"vec": "向量", "boldsymbol": "", "overline": "", "bar": "", "hat": "", "tilde": "",
	// 明确要丢掉的排版命令
	"left": "", "right": "", "quad": "", "qquad": "", "big": "", "Big": "", "bigl": "",
	"bigr": "", "Bigl": "", "Bigr": "", "displaystyle": "", "textstyle": "",
	"limits": "", "nolimits": "", "begin": "", "end": "", "nonumber": "",
}
