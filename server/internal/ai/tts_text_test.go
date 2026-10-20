package ai

import (
	"strings"
	"testing"
)

// 送进 TTS 的台词不能带 LaTeX 源码：$ 定界符、反斜杠命令、上下标都要转成读法。
// 这里覆盖线上真实出现过的写法，尤其是"行内公式只留字母"这一条。
func TestSpeakableText(t *testing.T) {
	cases := []struct {
		name string
		in   string
		want string
	}{
		{
			name: "用户例子：行内公式只留下字母",
			in:   "它的表达式只有两个字母要操心：$y = kx + b$ 里的 $k$ 和 $b$。",
			want: "它的表达式只有两个字母要操心：y = kx + b 里的 k 和 b。",
		},
		{
			name: "三角函数与下标",
			in:   `切比雪夫多项式定义为 $T_{n}(x) = \cos(n \arccos x)$，在区间 $[-1,1]$ 上取值始终不超过 1。`,
			want: "切比雪夫多项式定义为 T n(x) = 余弦(n 反余弦 x)，在区间 [-1,1] 上取值始终不超过 1。",
		},
		{
			name: "幂次与分式",
			in:   `$x^{n} = 2^{1-n}$、$\frac{2k+1}{2n+2}$`,
			want: "x 的 n 次方 = 2 的 1-n 次方、2n+2 分之 2k+1",
		},
		{
			name: "极限、趋于与集合黑体",
			in:   `极小极大性质说：$\min_{p \in \mathcal{P}_{n}} \max_{x \in [-1,1]} |x^{n} - p(x)| = 2^{1-n}$`,
			want: "极小极大性质说：最小值 p 属于 P n 最大值 x 属于 [-1,1] |x 的 n 次方 - p(x)| = 2 的 1-n 次方",
		},
		{
			name: "排版命令被丢掉",
			in:   `能量 $E = \sqrt{m^{2} + p^{2}}$，其中 $\left( m \right)$ 是质量`,
			want: "能量 E = 根号 m 的 2 次方 + p 的 2 次方，其中 ( m ) 是质量",
		},
		{
			name: "纯中文台词原样返回",
			in:   "同学们好，今天我们来认识一个在数值计算里几乎无处不在的多项式家族。",
			want: "同学们好，今天我们来认识一个在数值计算里几乎无处不在的多项式家族。",
		},
		{
			name: "不带 $ 的裸公式同样处理",
			in:   "递推式 T_{n+1}(x) = 2x T_{n}(x) - T_{n-1}(x)。",
			want: "递推式 T n+1(x) = 2x T n(x) - T n-1(x)。",
		},
		{
			name: "整句都是定界符时退化为空",
			in:   "$$",
			want: "",
		},
	}

	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			if got := SpeakableText(tc.in); got != tc.want {
				t.Errorf("SpeakableText()\n  in   = %q\n  got  = %q\n  want = %q", tc.in, got, tc.want)
			}
		})
	}
}

// 幂等：处理过的文本再处理一次不应继续变化（合成失败重试、重复合成时用得上）。
func TestSpeakableTextIdempotent(t *testing.T) {
	in := `它的表达式只有两个字母要操心：$y = kx + b$ 里的 $k$ 和 $b$。`
	once := SpeakableText(in)
	if twice := SpeakableText(once); twice != once {
		t.Errorf("SpeakableText 不是幂等：once=%q twice=%q", once, twice)
	}
}

// 线上真实台词（实验 226「切比雪夫多项式深化」AI 版）：转换后不能残留任何 LaTeX 源码，
// 否则 TTS 会把 $、反斜杠命令、下划线念出来。
func TestSpeakableTextOnRealLines(t *testing.T) {
	lines := []string{
		`同学们好，今天我们来认识一个在数值计算里几乎无处不在的多项式家族——切比雪夫多项式。`,
		`切比雪夫多项式定义为 T_{n}(x) = \cos(n \arccos x)，在区间 [-1,1] 上取值始终不超过 1。`,
		`它的关键性质是：在所有首项系数为 1 的 n 次多项式中，$|x^{n} - p(x)| \le 2^{1-n}$ 恒成立，这就是极小极大逼近。`,
		`从三角恒等式出发：\cos((n+1)\theta) + \cos((n-1)\theta) = 2\cos\theta \cos(n\theta)，令 x = \cos\theta 就得到三项递推。`,
		`极小极大性质说：\min_{p} \max_{x \in [-1,1]} |x^{n} - p(x)| = 2^{1-n}，误差下界由 T_{n} 达到。`,
		`注意适用条件是区间 [-1,1] 与首项系数固定；换区间要做线性变换，否则结论要改写。`,
		`它们的坐标是 cos((2k+1)π 除以 2n)，两端密、中间疏。`,
	}
	for _, line := range lines {
		got := SpeakableText(line)
		if strings.ContainsAny(got, "$\\^_{}") {
			t.Errorf("朗读文本仍残留 LaTeX 标记：%q -> %q", line, got)
		}
		t.Logf("%s\n  -> %s", line, got)
	}
}
