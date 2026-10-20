package ai

import (
	"encoding/json"
	"fmt"
	"strings"

	"github.com/ai-phy-beautiful/server/internal/model"
)

// SystemPrompt 是教学内容生成的系统提示词（todo 第 7 项：生成文稿时须遵守的通用规则）。
const SystemPrompt = `你是"物理之美"教育软件的教学内容作者，负责把一个物理主题写成有历史纵深、能联系现实的教学内容与逐句讲解稿。

## 〇、输出纪律（最高优先级，先读这一条）
1. **只输出最终结果，不要输出思考过程**：不要写推理步骤、分析过程、自我检查、备选方案，也不要写"让我想想""首先…其次…最后…""等等，我重新考虑一下"这类过渡性文字；
2. 回复必须**直接以一个 JSON 对象开头**（第一个非空白字符就是左花括号 {），不要 Markdown 代码块标记（不要三个反引号），JSON 前后不要任何解释性文字；
3. 需要在内部推理时请在内部完成，**不要把推理内容写进回复**；思考越短越好，把额度留给正文；
4. 一次回复只给一份完整 JSON，不要在 JSON 之后再补充说明或追加第二份内容。

## 一、最高原则：真实（不可违背）
1. 你提到的定律、公式、理论与实验必须真实存在，严禁编造、张冠李戴或把假说说成定律；
2. 人名、生卒年、年代、事件必须准确；若把握不足，使用保守表述（如"约公元 3 世纪"），绝不虚构细节；
3. 先讲清"它是什么、断言了什么、推导的关键思想是什么"，再展开背景与影响；
4. 至今未解决的问题必须明确标注"至今未解"；已被证明的要写清由谁在何时完成。

## 二、内容维度（必须逐一覆盖）
1. 发现者与年代；当时的历史背景；它究竟解决了什么问题；
2. 它对人类历史、科学技术与文明进步的影响；所获荣誉（诺贝尔奖、菲尔兹奖、阿贝尔奖等；若无则明确写"无"）；
3. 现实应用场景（至少 2 条，要具体，例如"用于 GPS 相对论修正""用于 JPEG 图像压缩"，不要空泛）；
4. 它是否仍是未解之谜；是否推动了物理、化学、生物、计算机等其他学科。

## 三、叙事原则
物理学不是凭空想象，也不是天才一蹴而就。每一次突破都与实验观测、技术需求、生产实践紧密相连，
并往往伴随争论、错误与逐步完善。请把这种真实的过程讲出来，让读者理解"实验是检验理论的唯一标准，历史的进步与物理学的发展相辅相成"。

## 三·五、图形规范（graph 字段）
除文字与公式外，你必须给出可直接绘制的图形，让抽象内容"看得见"。

1. kind 为 "2d" 时给出 elements（二维图元），坐标为**数学坐标**（可正可负，y 轴向上）。
   每种图元**只支持下面列出的字段**；多写的字段不会生效（例如 rect 没有 label、line 的 dash 是布尔不是数组）：
     · line：{"type":"line","from":[x,y],"to":[x,y],"color":"#667eea","width":2,"dash":true}
     · polyline / polygon：{"type":"polyline","points":[[x,y],[x,y]],"closed":false,"color":"#667eea","fill":"rgba(102,126,234,0.3)","width":2}
     · rect：{"type":"rect","at":[x,y],"w":3,"h":2,"fill":"rgba(102,126,234,0.3)","color":"#667eea","width":1.6}
     · circle：{"type":"circle","center":[x,y],"r":1,"fill":"rgba(102,126,234,0.3)","color":"#ed8936","width":2}
     · curve：{"type":"curve","fn":"x^2","fromX":-3,"toX":3,"samples":200,"color":"#48bb78","width":2.2}
       （曲线的横轴范围必须写在 fromX / toX，不要写 "from": -3）
     · **sequence（数列专用：等差、等比、斐波那契等一律用它）**：
       {"type":"sequence","fn":"1 + (n-1)*num_d","from":1,"to":"$num_n","mode":"bars","color":"#667eea","label":"等差数列"}
       fn 是通项（自变量写 n，可以是含参数与 n 的表达式）；from/to 是**项号范围**（可写 "$参数名"）；
       mode 取 points（散点，默认）/ bars（柱状）/ line（折线）；label 画在数列上方。
     · point：{"type":"point","at":[x,y],"color":"#ed8936","size":5,"label":"标注文字"}
     · text：{"type":"text","at":[x,y],"text":"文字","size":14,"color":"#2d3748"}
   注意：point 的 label 与 text 的 text 是纯文本，但**支持写 $参数名**，会被实时替换成当前参数值
   （例："text": "当前和 = $num_a + $num_b"）；不过**只把参数写在文字里不算联动** ——
   至少要有 2 个图元在数值字段或表达式里引用参数（见下面第 4 条）。
   **严禁写空的 "points": []**：那画不出任何东西；需要"由参数算出来的一串点"时就用 sequence。
   **常见数学场景怎么画（上面第 1 条的补充，可直接套用；示例里的参数名换成你自己定义的）**：
   · 数列 / 递推 / 逐项求和 → sequence（散点 points、柱状 bars 或折线 line）
     {"type":"sequence","fn":"1 + (n-1)*num_d","from":1,"to":"$num_n","mode":"bars","color":"#667eea","label":"等差数列"}
     {"type":"sequence","fn":"2^(n-1)","from":1,"to":"$num_n","mode":"line","color":"#ed8936","label":"等比数列"}
   · 函数图象 / 曲线族 → axes 定范围 + curve（横轴范围写 fromX/toX）
     {"type":"curve","fn":"num_a * x^2 + num_b","fromX":-5,"toX":5,"color":"#48bb78","samples":200}
   · 三角形 / 多边形 / 面积分割 → polygon（closed:true 会填充）
     {"type":"polygon","points":[[0,0],["$num_a",0],[0,"$num_b"]],"closed":true,"fill":"rgba(102,126,234,0.25)","color":"#667eea"}
   · 圆 / 单位圆 / 扇形 → circle + line（半径或角度用参数）
     {"type":"circle","center":[0,0],"r":"$num_a","fill":"rgba(237,137,54,0.2)","color":"#ed8936"}
   · 数轴 / 区间 / 距离 → line + point + text
     {"type":"line","from":[-5,0],"to":[5,0],"color":"#4a5568","width":1.5}
     {"type":"point","at":["$num_a",0],"color":"#e53e3e","size":6,"label":"a = $num_a"}
   · 柱状比较 / 面积对比 → rect（宽高用参数）
     {"type":"rect","at":[0,0],"w":"$num_a","h":"$num_b","fill":"rgba(102,126,234,0.35)","color":"#667eea"}
   · 向量 / 变换 / 位移 → line + point（标出起点终点）
     {"type":"line","from":[0,0],"to":["$num_a","$num_b"],"color":"#667eea","width":2}
     {"type":"point","at":["$num_a","$num_b"],"color":"#e53e3e","size":5,"label":"终点"}
   · 分数 / 比例分割 → 把整体分成若干份（并排的 rect，涂色份数用参数控制）
     {"type":"rect","at":[0,0],"w":1,"h":"$num_b","fill":"rgba(237,137,54,0.45)","color":"#ed8936"}
     {"type":"rect","at":[1,0],"w":1,"h":"$num_b","fill":"rgba(226,232,240,0.6)","color":"#a0aec0"}
   · 统计分布 / 频数 → sequence 的柱状模式（纵轴是频数）
     {"type":"sequence","fn":"8 * exp(-(n-8)^2/6)","from":1,"to":"$num_n","mode":"bars","color":"#48bb78"}
   · 集合 / 交集并集 → 两个交叠的 circle
     {"type":"circle","center":[-0.6,0],"r":1.2,"fill":"rgba(102,126,234,0.25)","color":"#667eea"}
     {"type":"circle","center":[0.6,0],"r":1.2,"fill":"rgba(237,137,54,0.25)","color":"#ed8936"}
2. kind 为 "3d" 时给出 surface：fn 为关于 x、y 的表达式（可用 sin/cos/exp/log/sqrt/abs/^ 与常数），
   如 "sin(x)*cos(y)"、"x^2-y^2"；range 为坐标范围；resolution 建议 24~48。
    **严禁在 fn 中使用 piecewise / 分段函数**：渲染器不支持，会直接报错；如需表达分段含义，
    拆成多个 curve 图元分别绘制，或用 abs、sign 等组合写成单一表达式。
3. **参数联动**：图元与表达式里可以直接引用 params_schema 的参数名，
   例如把 a 设为参数后写 "w": "$num_a" 或 "fn": "num_a * x"。
   这样学生拖动参数时图形会实时重绘——这是必须做到的。
4. **图形必须与参数联动（硬性要求）**：graph 中至少要有 2 个图元引用 params_schema 里的参数名，
   引用写法是在字符串值前加 $ ，或在表达式里直接使用参数名。例如：
     · 尺寸引用："{"type":"rect","at":[0,0],"w":"$num_a","h":"$num_b"}"
     · 表达式引用："{"type":"curve","fn":"num_a * x","from":0,"to":10}"
   引用规则（**只有数值字段与表达式字段会参与联动**）：
     · 数值字段（at / center / from / to / points / w / h / r）：可以是数字、整串 "$参数名"，
       也可以是以 $ 开头的算式 —— "at": ["$num_a / 2 - 0.5", "-0.8"]、"w": "$num_a * 2" 都会被求值。
     · **算式必须整串用引号包住（强烈建议以 $ 开头）**：
       正确 "at": ["$num_focus_pos - $num_p", 0] 或 "at": ["num_focus_pos - num_p", 0]；
       错误 "at": [num_focus_pos - num_p, 0] —— 裸写会让整份 JSON 解析失败、本次生成直接作废
       （解析器把 num_ 的 n 当成 null 字面量开头，报 invalid character 'm' in literal null）。
       布尔与 null 之外，方括号里不允许出现任何不加引号的标识符。
     · 表达式字段（curve.fn、surface.fn）：直接把参数名写进式子参与运算，如 "fn": "num_a * sin(num_b * x)"。
     · 3D 的 surface.range 只写数字，不要引用参数。
     · **只能引用 params_schema 里定义过的参数名**：写 $area_a、$sqrt_c 这类没定义的名字，
       画面上会原样显示成 "$area_a"；需要派生量（面积 a²、斜边 c）请用算式表达，不要凭空造参数名。
   提交前自检：确认至少 2 个图元的**尺寸、坐标或表达式**里出现了你定义的参数名；
   如果这些位置全是固定数字、只在 text 或 label 里写了 $参数名，仍然视为不合格，必须重写。
   禁止把所有图元都写成固定数字——那样学生拖动参数时图形不会变化，等于没做交互。
   **params_schema 里的每一个参数都必须至少被一个图元引用（硬性要求）**：
   参数面板里出现、图形里却没用到的滑块，学生拖了没有任何反应，会以为功能坏了。
   自检时逐个参数过一遍：num_a 出现在哪个图元的哪个字段里？找不到就补上引用；
   如果某个参数确实无法体现在图形里（例如它只影响旁白提到的物理量），
   就**把它从 params_schema 里删掉**，不要留一个死滑块。
   注意：把参数写进 text / label 只算"画面上的数字会变"，**不算图形联动**，
   必须让形状、位置、尺寸或曲线本身随它变化（动画图里就让动点的轨迹/相位随它变化）。
5. **图形必须针对本实验的数学内容设计（硬性要求）**：图元类型、数量、位置与标注都要服务本题的数学概念
   （分数画分割的饼图/条形图；罗马数字画符号排列与加减规则；函数画它在坐标平面上的形态；几何定理画对应图形与标注）。
   【JSON 结构】里的图元只是"怎么写"的格式演示，**严禁照抄**：不要每个实验都摆矩形 + 圆 + 正弦曲线，
   也不要照抄示例里的文字标注；带 "_demo": true 标记的示例图元必须换成你自己设计的图元，并删掉该字段。
   换个实验如果你的图还是一模一样，那就是错的。
6. 图形要与讲解稿的内容一致：讲解说到哪一步，图形就应该呈现那一步的形态。
7. 颜色使用十六进制或 rgba 字符串；填充用 rgba 并带透明度。
8. **严禁生成空的 graph 或 elements**：graph 字段必须存在且非空；elements 数组至少包含 1 个图元。
    如果某个实验确实无法可视化，把 kind 设为 "2d" 并在 elements 中画一条提示文字（用 text 图元）。
9. **graph / params_schema 等字段必须直接写 JSON 对象，严禁写成字符串**：
    错误示例："graph": "{\"kind\":\"2d\",...}"（整个 graph 是一个字符串）；
    正确示例："graph": {"kind": "2d", "elements": [...]}。
    模型有时会把整个 graph 对象包成字符串，前端无法解析，必须避免。
10. **同一张图里的多条曲线必须给出不同的表达式（硬性要求）**：严禁用同一个表达式
    （或只把自变量做平移、缩放）画两条曲线 —— 默认参数下两条线会完全重合，
    后画的把先画的整条盖住，学生只能看到一条线。
    要对比两个量就分别写两条真正不同的表达式（例如一条 $T_{n}(x)$、一条它的误差曲线），
    并在 label 或 text 里说明哪条是哪条，颜色也要区分开。

## 三·六、动起来优先（硬性要求：能动的主题不许只给静态图）
静态图只能展示"某一瞬间"，而物理的美与直觉恰恰在**过程**里。凡是主题**随时间演化**
（振动、波动、圆周与轨道运动、单摆/弹簧振子、碰撞、衰变、传播、脉冲、追赶相遇、
生态/种群演化、迭代与递推的逐项推进、算法逐步执行…），**必须**让图形动起来；
只有"静态几何图形、结构、分布、数轴区间"这类本身无时间过程的主题才保持静态。

怎么让图动起来（两种手段，二选一或并用）：

1. **表达式里写时间变量 t（秒）**：渲染器每帧把 t 递增后整幅重绘。
   · 行进波：{"type":"curve","fn":"sin(2*x - 3*t)","fromX":-6,"toX":6,"color":"#48bb78"}
   · 沿轨道转动的点（配合 axes 用 [-1.2,1.2] 的方框）：{"type":"point","at":["cos(t)","sin(t)"]}
   · 随时间往复的竖线/摆杆：{"type":"line","from":[0,0],"to":["sin(t)","-cos(t)"]}
   · 只想要"一眼看清形状"的对照曲线，就不要写 t。
2. **motion 图元（参数方程动图，最像内置单摆）**：
   {"type":"motion","x":"sin(s)","y":"-cos(s)","sFrom":0,"sTo":1,"span":[0,1],
    "trail":0.25,"color":"#f6ad55","size":7,"label":"摆球"}
   · x / y 是以 s 为参数的坐标方程（s 默认在 sFrom..sTo 上取，通常写 0..1）；
   · span 是动点在一个周期内扫过的 s 区间，默认整个定义域；动点会随动画自动运动；
   · trail 是拖尾长度（占 span 的比例，0 表示不留拖尾），用来表现"划过"的轨迹；
   · pingpong 为 true 时动点在两端往返（单摆、往复运动请设为 true）；
   · 轨迹曲线会自动画出，不需要另外用 polyline 重画一遍；
   · **x / y 里同样可以写参数名**（如 "x":"num_theta0 * sin(s)"，s 与参数一起参与运算）——
     把"摆动幅度""转速""轨道半径"做成参数让学生拖，动画会实时改变，这是最直观的联动方式；
     但参数名不能叫 t 或 s。

配套的时间轴配置（可选，缺省 4 秒/周期）：
  "animate": {"period": 4, "tRange": [0, 6.283], "pingpong": true}
  · period 是一个周期的时长（秒），tRange 是 t 的取值区间，pingpong 控制是否往返；
  · 一般情况下**不用写 animate**：只要表达式里出现了 t，或用了 motion 图元，就会自动播放；
  · 只想画静态图时，也不要在表达式里出现 t —— 不要把 t 当"顺手写的变量"。

动画与坐标的配合（重要）：
  · 动画图上坐标范围必须留出运动空间，例如圆周运动用 {"x":[-1.4,1.4],"y":[-1.4,1.4]}；
  · 参数联动照旧有效，拖动参数时动画不停，图形实时变化；
  · 讲解稿台词里可以用 $t{单位} 之外的方式描述过程（台词本身不参与动画）。

## 四、呈现原则
抽象内容必须落地：用图形、实践应用、生活比喻、动画动作等方式呈现。
参数的取值范围要能让可视化实验真实演示出该现象。

## 五、格式要求
1. 语言亲切、口语化但严谨，面向中国学生；
2. formulas[].latex 使用 LaTeX，**不带 $ 定界符**（该字段会直接交给 KaTeX 渲染），语法须能被 KaTeX 渲染；
   **formulas 里只写纯数学表达式**（如 "a + b = c"、"\\int_0^1 x^2 dx"），
   不要把中文说明写进 latex（禁止 \\text{中文}、禁止在 latex 里写"表示从点 a 向右移动"这类解释文字）；
   中文说明放到 label 字段，例如 label="加法：向右移动 b 个单位"；
   **讲解稿台词中的公式格式（硬性要求）**：
   - **台词里的数学表达式必须成对用 $ 包裹**，例如 "由 $T_{n}(x) = \\cos(n \\arccos x)$ 可知"、
     "误差下界 $|x^{n} - p(x)| = 2^{1-n}$ 由 $T_{n}$ 达到"；
     没有 $ 包裹的裸 LaTeX（T_{n}、x^{n}、\\cos）会被当成普通文字原样念出来，学生看到的就是 LaTeX 源码
   - 下标必须用花括号：a_{n}、x_{i}、S_{n}，不要写 a_n（KaTeX 对单字符下标有时渲染异常）
   - 极限写法：\\lim_{n \\to \\infty}，不要写 \\lim_n 或 \\lim_{{n \\to \\infty}}
   - 求和/积分下标：\\sum_{i=1}^{n}、\\int_0^1（下标必须用花括号）
   - 集合黑体：\\mathbb{N}、\\mathbb{R}、\\mathbb{Z}、\\mathbb{Q}（KaTeX 原生支持）
   - 禁止使用 KaTeX 不支持的命令：\\operatorname、\\lvert、\\rvert、\\DeclareMathOperator；
     绝对值写 |x| 即可，集合元素个数写 |S|
3. 讲解稿为 PPT 式逐句播放，每句 20-60 字，句与句之间递进；
   **台词是要念给学生听的最终稿**：不许出现自我更正、思考过程或元信息
   （如"不对，应该是…""让我们重新算一下""我需要考虑…""根据题目要求…"），也不许出现 Markdown 标记或 JSON 片段；
   算错了就直接写正确的那句，不要写两遍。
4. **字段形态必须与下方【JSON 结构】完全一致，类型写错整份内容都会作废**：
   - params_schema 是 JSON **对象**：键是参数名，值是参数定义；**严禁写成数组或列表**，
     也严禁给参数定义添加 parameter_name / name 之类的名字字段（键名本身就是参数名）；
   - 参数名只能是 ASCII 标识符（如 num_a、num_b），因为 graph 里要用它当变量名；
     **t 与 s 是渲染器的保留变量名**（t = 动画时间，s = motion 图元的参数），**严禁用作参数名**，
     否则动画表达式里 t 的含义会被参数值顶掉，图形不会动；
   - 讲解稿每行的 animation 是 **对象** {"action": "reset"}，**严禁写成字符串 "reset"**；
     需要带参数的动作用 {"action": "setParam", "params": {"num_a": 19}}（参数放进 params 对象，
     不要写成 "param": "num_a", "value": 19 这种平铺字段）；
   - graph 里 2d 图元放 elements、3d 曲面放 surface，不要把 surface 混进 elements；
    - graph / params_schema 等字段一律直接写 JSON 对象，不要写成被转义的 JSON 字符串；
    - **数组值中禁止裸写标识符**：如 [-1.2*A, 1.2*A] 是非法 JSON，必须写成 ["-1.2*A", "1.2*A"]（带引号）；
      渲染器会把带引号的字符串当作表达式求值，裸标识符会导致 JSON.parse 直接报错。
    - **严禁在 graph.fn 中使用 piecewise / 分段函数**：渲染器不支持，必须拆成多个 curve 或用 abs/sign 组合。
    - **严禁生成空的 elements 数组**：elements 至少要有 1 个图元；如果实验确实无法可视化，用 text 图元写提示文字。
 5. 只输出 JSON，不要输出任何解释文字或 Markdown 代码块。
    JSON 必须严格合法：括号成对（对象用 {}、数组用 []），没有尾随逗号，没有注释，字符串只用双引号。
    **字符串内部不要出现英文双引号**（需要强调时用中文引号「」或直接不加引号），字符串内不能有真实换行。`

// contentSchemaHint 描述期望的 JSON 结构，直接拼进用户提示词。
const contentSchemaHint = `{
  "description": "80-150字的教学简介，说明这个实验展示什么、为什么重要",
  "formulas": [{"label": "公式名称", "latex": "LaTeX 公式"}],
  "history_info": {
    "mathematician": "主要发现者及其生卒年（不确定时用保守表述）",
    "background": "产生的历史背景与要解决的问题（80字以上，须真实）",
    "story": "思想演进或探索过程的故事（80字以上，体现真实与曲折）",
    "legacy": "对科技/文明的影响与所获荣誉（如诺贝尔奖、菲尔兹奖；若无写「无」）",
    "open_problem": "是否仍是未解之谜；若已解决，写明由谁在何时解决",
    "cross_discipline": "对物理、化学、生物、计算机等其他学科的推动"
  },
  "app_hooks": [{"title": "应用领域", "desc": "该物理规律/技术在现实/科技中的具体应用"}],
  "params_schema": {
    "num_a": {"type": "range", "min": 0, "max": 10, "step": 0.1, "default": 2, "label": "参数一的中文标签"},
    "num_b": {"type": "range", "min": 0, "max": 10, "step": 0.1, "default": 3, "label": "参数二的中文标签"}
  },
  "graph": {
    "kind": "2d 或 3d",
    "axes": {"x": [-5, 5], "y": [-5, 5]},
    "animate": {"period": 4, "pingpong": false},
    "elements": [
      {"type": "rect", "at": [0, 0], "w": "$num_a", "h": "$num_b", "fill": "rgba(102,126,234,0.3)", "_demo": true},
      {"type": "circle", "center": [0, 0], "r": "$num_a", "color": "#ed8936", "_demo": true},
      {"type": "curve", "fn": "num_b * sin(num_a * x - 2*t)", "fromX": -3, "toX": 3, "color": "#48bb78", "samples": 200, "_demo": true},
      {"type": "line", "from": [0, 0], "to": ["$num_a", "$num_b"], "color": "#667eea", "width": 2, "_demo": true},
      {"type": "motion", "x": "cos(s)", "y": "sin(s)", "sFrom": 0, "sTo": 1, "span": [0, 1], "trail": 0.25, "color": "#f6ad55", "size": 7, "label": "动点", "_demo": true},
      {"type": "point", "at": ["$num_a", "$num_b"], "label": "（示例标注，请换成与本题相关的说明）", "_demo": true},
      {"type": "text", "at": [0, 0], "text": "（示例文字，请换成与本实验相关的操作提示）", "size": 14, "_demo": true}
    ],
    "surface": {"fn": "num_a * sin(x - t) * cos(num_b * y)", "range": [-3, 3], "resolution": 36, "palette": "rainbow"}
  },
  "prerequisites": ["前置实验 slug"],
  "related": ["相关实验 slug"],
  "narration": {
    "sections": [
      {
        "id": "intro",
        "title": "开场引入",
        "lines": [
          {"id": "intro-1", "text": "开场第一句台词（每句 20-60 字）", "animation": {"action": "reset"}},
          {"id": "intro-2", "text": "开场第二句台词"}
        ]
      },
      {
        "id": "concept",
        "title": "核心概念",
        "lines": [
          {"id": "concept-1", "text": "讲清它是什么、断言了什么"},
          {"id": "concept-2", "text": "关键定义与适用条件"}
        ]
      },
      {
        "id": "formula",
        "title": "公式与推导",
        "lines": [
          {"id": "formula-1", "text": "公式的含义与推导的关键一步"},
          {"id": "formula-2", "text": "成立条件或常见误区"}
        ]
      },
      {
        "id": "application",
        "title": "现实应用",
        "lines": [
          {"id": "application-1", "text": "具体行业或技术中的应用"},
          {"id": "application-2", "text": "生活中的例子"}
        ]
      },
      {
        "id": "summary",
        "title": "总结",
        "lines": [
          {"id": "summary-1", "text": "回顾本实验的要点"},
          {"id": "summary-2", "text": "引出相关实验"}
        ]
      }
    ]
  }
}`

// 允许在讲解台词中使用动画动作（与前端可视化接口一致）。
const allowedActions = "reset | setParam | startAnimation | stopAnimation | highlight | scrollTo | setFormula"

// BuildContentPrompt 根据实验元信息构造用户提示词。
func BuildContentPrompt(exp *model.Experiment, categoryName string) string {
	var sb strings.Builder

	sb.WriteString("请为下面这个物理实验生成完整的教学内容（图文说明、公式、历史背景、应用场景、交互参数、双人讲解稿件）。\n\n")
	sb.WriteString("【实验信息】\n")
	sb.WriteString(fmt.Sprintf("- 编号：%s\n", orDefault(exp.Number, "未编号")))
	sb.WriteString(fmt.Sprintf("- 标题：%s\n", exp.Title))
	sb.WriteString(fmt.Sprintf("- 难度等级：%s（%s）\n", exp.Level, exp.Difficulty))
	if categoryName != "" {
		sb.WriteString(fmt.Sprintf("- 所属分组：%s\n", categoryName))
	}
	if exp.Concept != "" {
		sb.WriteString(fmt.Sprintf("- 核心物理概念：%s\n", exp.Concept))
	}
	if d := strings.TrimSpace(exp.Description); d != "" {
		sb.WriteString(fmt.Sprintf("- 现有简介（可润色）：%s\n", d))
	}
	// 主题专属提示词（todo 第 7 项）：针对当前概念的准确性与呈现方式提出要求。
	subject := exp.Title
	if exp.Concept != "" {
		subject = exp.Concept
	}
	sb.WriteString("\n【本主题的专属要求】\n")
	sb.WriteString(fmt.Sprintf("1. 必须围绕「%s」的真实物理内容展开，讲清它的准确陈述、关键推理思路与适用条件（近似、量纲）。\n", subject))
	sb.WriteString("2. 明确该主题的真实性质：是已被实验验证的定律、还是理论预言/未证实的假说？不可含混或夸大。\n")
	sb.WriteString("3. 至少给出一个具体的现实应用场景，要能说出行业或技术名称，不要泛泛而谈。\n")
	sb.WriteString("4. 用一个生活化比喻解释其中最难理解的部分，帮助建立直观。\n")
	if exp.Concept != "" {
		sb.WriteString(fmt.Sprintf("5. 参数与可视化要能直接演示「%s」这一现象，便于交互验证。\n", exp.Concept))
	}
	sb.WriteString("6. 若该主题在历史上有过争论、错误或不完整的阶段，请如实呈现其演进过程。\n")
	sb.WriteString("\n【输出要求】\n")
	sb.WriteString("0. 【最重要】**直接输出 JSON 本体，不要输出任何思考过程**：不要写推理步骤、分析、自我检查，也不要写「让我想想」「首先…其次…」这类过渡文字。第一个非空白字符必须是 {，不要在 JSON 前后加解释，不要用代码块包裹。思考请在内部完成，尽量简短，把额度留给正文。\n")
	sb.WriteString("1. 讲解稿必须写全 5 个段落，缺一不可：intro（开场引入）、concept（核心概念）、formula（公式与推导）、application（现实应用）、summary（总结）。\n")
	sb.WriteString("2. 每个段落 2-4 行，全文不少于 14 行；【JSON 结构】里 narration.sections 的文字只是格式占位，必须换成与本题相关的内容，段落数量不能照抄示例（只写 intro 一段视为不合格）。\n")
	sb.WriteString(fmt.Sprintf(`3. 每行台词可带 animation 对象（形如 {"action": "reset"}），action 取值限定为：%s。
`, allowedActions))
	sb.WriteString("4. formulas 给出 2-4 条核心公式；app_hooks 给出 3 条现实应用；params_schema 给出 2-4 个可调参数用于交互可视化。\n")
	sb.WriteString("5. params_schema 是 JSON 对象（键 = 参数名，值 = 参数定义），不是数组；animation 是 JSON 对象，不是字符串。\n")
	sb.WriteString(`6. graph 必须与参数联动：至少 2 个图元的尺寸/坐标写成 "$参数名"（如 "w": "$num_a"），
   curve.fn / surface.fn 表达式里直接使用参数名（如 "num_a * sin(x)"）；数值字段不要写算式，
   也禁止整张图全是固定数字 —— 学生拖动参数时必须能看到图形变化。
   **params_schema 里的每个参数都要在图形里被引用一次**（写进 text/label 不算）：
   找不到用法就把它从 params_schema 删掉，绝不留"拖了没反应"的死滑块。
7. graph 的图元要按本实验的数学内容自己设计（类型/数量/位置/标注都对得上本题）：
   【JSON 结构】里带 "_demo": true 的图元只是格式演示，必须换成你自己设计的图元并删掉 "_demo" 字段，
   绝不能整张图照抄示例（否则每个实验的画面都会一模一样，等于没做）。` + "\n")
	sb.WriteString("8. 所有文本使用简体中文；LaTeX 中的反斜杠请正确转义。\n")
	sb.WriteString("9. **graph 字段必须是 JSON 对象，不是字符串**：`\"graph\": {\"kind\": \"2d\", ...}` 是错的，`\"graph\": {\"kind\": \"2d\", \"elements\": [...]}` 才对。\n")
	sb.WriteString("10. **数组与数值字段里禁止裸写标识符或算式**：`[-1.2*A, 1.2*A]`、`[num_focus_pos - num_p, 0]` 都是非法 JSON，必须写成 `[\"-1.2*A\", \"1.2*A\"]`、`[\"num_focus_pos - num_p\", 0]`（整串加引号）；裸写会被解析器当成 null 字面量直接报错，整份内容作废。渲染器会把带引号的字符串当表达式求值。\n")
	sb.WriteString("11. **严禁在 graph.fn 中使用 piecewise/分段函数**：渲染器不支持，必须拆成多个 curve 或用 abs/sign 组合。\n")
	sb.WriteString("12. **elements 数组不能为空**：至少 1 个图元；无法可视化时用 text 图元写提示文字。\n")
	sb.WriteString("13. **能动的主题必须动起来（硬性要求）**：凡是「随时间演化」的主题（振动、波动、圆周/轨道运动、摆、振荡、碰撞、衰变、传播、迭代推进等），图形里必须出现时间变量 t 或 motion 图元，让学生看到过程；物理/几何静态结构类主题保持静态即可。写法见系统提示词「三·六、动起来优先」。\n")
	sb.WriteString("14. **讲解稿台词中的公式格式（硬性要求）**：台词里的数学表达式必须成对用 $ 包裹（如 $x^{n} + y^{n} = z^{n}$），没有 $ 包裹的裸 LaTeX 会被当成普通文字原样念出来；下标必须用花括号 a_{n}、S_{n}，极限 \\lim_{n \\to \\infty}，求和 \\sum_{i=1}^{n}；集合黑体用 \\mathbb{N}、\\mathbb{R}；禁止 \\operatorname、\\lvert、\\rvert 等 KaTeX 不支持的命令。\n\n")
	sb.WriteString("【JSON 结构】\n")
	sb.WriteString(contentSchemaHint)

	return sb.String()
}

// ParseContent 解析大模型返回的教学内容 JSON。
// 兼容 ```json 代码块包裹、以及前后附带解释文字的情况。
func ParseContent(raw string) (*model.ExperimentContent, error) {
	text := strings.TrimSpace(raw)
	text = stripCodeFence(text)

	// 截取第一个 { 到最后一个 }，容忍模型输出多余前后缀
	start := strings.Index(text, "{")
	end := strings.LastIndex(text, "}")
	if start >= 0 && end > start {
		text = text[start : end+1]
	}

	var content model.ExperimentContent
	firstErr := json.Unmarshal([]byte(text), &content)
	if firstErr == nil {
		if strings.TrimSpace(content.Description) == "" && len(content.Narration.Sections) == 0 {
			return nil, fmt.Errorf("大模型返回的教学内容为空")
		}
		return &content, nil
	}

	// 再试一次「宽松解码」：从第一个 { 起只解出第一个完整 JSON 值。
	// 上面按「第一个 { 到最后一个 }」截取，如果 JSON 之后还跟着解释文字（其中含 }），
	// 截取就会把尾巴带进来；Decoder 只吃到第一个完整值，天然免疫这个问题。
	if loose, ok := decodeFirstJSONValue(text); ok {
		return loose, nil
	}

	// 直接解析失败：按「可能性从高到低」依次尝试修复后再解析。
	//   1. 字符串内未转义的英文双引号 / 裸换行（新模型尤其中文表达强时常见）；
	//   2. 结构偏差归一化（params_schema 写成数组、animation 写成字符串等）；
	//   3. 符号级语法修复（括号配对写错、尾随逗号、注释）；
	//   4. 输出被 max_tokens 截断的修复（截断处可能落在多字节中文字符上，
	//      报错形如 invalid character 'ç'）；
	// 以上修复还可以叠加使用（先修引号再修括号、先修引号再补截断等）。
	candidates := make([]string, 0, 12)
	addCandidate := func(s string) {
		if s == "" || s == text {
			return
		}
		for _, existing := range candidates {
			if existing == s {
				return
			}
		}
		candidates = append(candidates, s)
	}

	// 数值字段里裸写标识符/算式（"at": [num_focus_pos - num_p, 0]）：补引号即可 ——
	// 前端会把带引号的字符串当表达式求值；不修的话整份内容会因解析失败而作废。
	if identFixed, ok := repairUnquotedIdentifiers(text); ok {
		addCandidate(identFixed)
		if normalized, ok := normalizeContentJSON(identFixed); ok {
			addCandidate(normalized)
		}
		if syntaxFixed, ok := repairJSONSyntax(identFixed); ok {
			addCandidate(syntaxFixed)
			if normalized, ok := normalizeContentJSON(syntaxFixed); ok {
				addCandidate(normalized)
			}
		}
	}
	if quoted, ok := repairUnescapedQuotes(text); ok {
		addCandidate(quoted)
		if normalized, ok := normalizeContentJSON(quoted); ok {
			addCandidate(normalized)
		}
		if syntaxFixed, ok := repairJSONSyntax(quoted); ok {
			addCandidate(syntaxFixed)
			if normalized, ok := normalizeContentJSON(syntaxFixed); ok {
				addCandidate(normalized)
			}
		}
	}
	if normalized, ok := normalizeContentJSON(text); ok {
		addCandidate(normalized)
	}
	if fixed, ok := repairJSONSyntax(text); ok {
		addCandidate(fixed)
		if normalized, ok := normalizeContentJSON(fixed); ok {
			addCandidate(normalized)
		}
	}
	if fixed, ok := repairTruncatedJSON(text); ok {
		addCandidate(fixed)
		if normalized, ok := normalizeContentJSON(fixed); ok {
			addCandidate(normalized)
		}
		if syntaxFixed, ok := repairJSONSyntax(fixed); ok {
			addCandidate(syntaxFixed)
		}
	}

	for _, candidate := range candidates {
		var c model.ExperimentContent
		if err := json.Unmarshal([]byte(candidate), &c); err != nil {
			continue
		}
		if strings.TrimSpace(c.Description) == "" && len(c.Narration.Sections) == 0 {
			continue
		}
		return &c, nil
	}
	return nil, fmt.Errorf("解析教学内容 JSON 失败: %w", firstErr)
}

// decodeFirstJSONValue 从文本里解出**第一个完整**的 JSON 值，容忍前面有说明文字、后面有多余内容。
//
// 与「第一个 { 到最后一个 }」的截取方式不同：它不会因为尾部文字里出现 } 而多带垃圾，
// 也不会因为尾部还有第二个 JSON 片段而整体失败。
func decodeFirstJSONValue(text string) (*model.ExperimentContent, bool) {
	trimmed := strings.TrimSpace(text)
	if start := strings.Index(trimmed, "{"); start > 0 {
		trimmed = trimmed[start:]
	}
	if !strings.HasPrefix(trimmed, "{") {
		return nil, false
	}
	dec := json.NewDecoder(strings.NewReader(trimmed))
	for {
		var c model.ExperimentContent
		if err := dec.Decode(&c); err != nil {
			return nil, false
		}
		if strings.TrimSpace(c.Description) != "" || len(c.Narration.Sections) > 0 {
			return &c, true
		}
		// 解出的是空壳（例如前面某个碎片对象），继续尝试下一个值
	}
}

// stripCodeFence 去掉 ```json ... ``` 包裹。
func stripCodeFence(s string) string {
	if !strings.HasPrefix(s, "```") {
		return s
	}
	lines := strings.Split(s, "\n")
	if len(lines) < 2 {
		return s
	}
	lines = lines[1:]
	if n := len(lines); n > 0 && strings.HasPrefix(strings.TrimSpace(lines[n-1]), "```") {
		lines = lines[:n-1]
	}
	return strings.Join(lines, "\n")
}

func orDefault(v, def string) string {
	if strings.TrimSpace(v) == "" {
		return def
	}
	return v
}

// repairTruncatedJSON 尝试修复被截断的 JSON 文本。
//
// 做法：从头扫描，记录最后一个「在对象/数组层级完整闭合」的位置，
// 然后截断到该位置并补齐未闭合的括号。被截断的尾部元素直接丢弃。
func repairTruncatedJSON(s string) (string, bool) {
	depth := 0
	inStr := false
	escaped := false
	// 记录每个深度的「最后一个安全切点」（值结束、位于逗号或闭合括号之后）
	lastSafe := -1
	stack := make([]byte, 0, 16)

	for i := 0; i < len(s); i++ {
		c := s[i]
		if escaped {
			escaped = false
			continue
		}
		if inStr {
			if c == '\\' {
				escaped = true
			} else if c == '"' {
				inStr = false
				// 字符串刚闭合，若后面紧跟 , } ] 则为安全切点
				lastSafe = i + 1
			}
			continue
		}
		switch c {
		case '"':
			inStr = true
		case '{', '[':
			depth++
			stack = append(stack, c)
		case '}', ']':
			depth--
			if len(stack) > 0 {
				stack = stack[:len(stack)-1]
			}
			lastSafe = i + 1
		}
	}

	// 已经平衡且不在字符串中？那交给调用方正常解析
	if !inStr && depth == 0 {
		return s, false
	}
	if lastSafe <= 0 {
		return s, false
	}

	trimmed := strings.TrimRight(s[:lastSafe], " \t\r\n,")
	// 重新计算 trimmed 的未闭合括号
	stack2 := make([]byte, 0, 16)
	inStr2 := false
	esc2 := false
	for i := 0; i < len(trimmed); i++ {
		c := trimmed[i]
		if esc2 {
			esc2 = false
			continue
		}
		if inStr2 {
			if c == '\\' {
				esc2 = true
			} else if c == '"' {
				inStr2 = false
			}
			continue
		}
		switch c {
		case '"':
			inStr2 = true
		case '{', '[':
			stack2 = append(stack2, c)
		case '}', ']':
			if len(stack2) > 0 {
				stack2 = stack2[:len(stack2)-1]
			}
		}
	}
	if inStr2 {
		trimmed += `"`
	}
	for i := len(stack2) - 1; i >= 0; i-- {
		if stack2[i] == '{' {
			trimmed += "}"
		} else {
			trimmed += "]"
		}
	}
	return trimmed, true
}
