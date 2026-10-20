import type { SceneFactory, SceneLoader } from './types';

/**
 * 3D 场景注册表：展项 slug → 场景加载器（《架构设计.md》§6.2 L2 懒加载）。
 *
 * 绑定分两类：
 *  1. 专属场景 scenes/<name>.ts —— 每个知识点一份手写实现（148 个）。
 *  2. 场景族 families/<族>.ts —— 同族知识点共用一份参数化实现，
 *     按 slug 绑定 (variant, title)（233 个），variant 决定族内具体形态，
 *     title 用于在场景中渲染知识点标题。
 *
 * 每个 loader 内部动态 import —— three 与场景模块打进独立 chunk，首次进入 3D 才加载。
 */
const loaders = new Map<string, SceneLoader>();

function reg(slug: string, loader: SceneLoader): void {
  loaders.set(slug, loader);
}

// ————————————————————————————————————————————————
// 一、专属场景（scenes/）：知识点与场景 1:1 手写实现
// ————————————————————————————————————————————————

// 阿贝成像与空间频率
reg('abbe-imaging', () => import('./scenes/abbe-imaging'));
// 神经动作电位
reg('action-potential', () => import('./scenes/action-potential'));
// 自适应光学
reg('adaptive-optics', () => import('./scenes/adaptive-optics'));
// 角动量守恒
// 安培环路定理的应用
reg('ampere-circuital-law', () => import('./scenes/ampere-circuital-law'));
reg('angular-momentum', () => import('./scenes/angular-momentum'));
// 天线阵列方向图
reg('antenna-pattern', () => import('./scenes/antenna-pattern'));
// 天体测量观测（盖亚）
reg('astrometry', () => import('./scenes/astrometry'));
// 原子钟
reg('atomic-clock', () => import('./scenes/atomic-clock'));
// 双折射
// 玻色-爱因斯坦凝聚实现
reg('bec-1995', () => import('./scenes/bec-1995'));
// 贝塞尔函数与圆柱问题
reg('bessel-cylindrical', () => import('./scenes/bessel-cylindrical'));
// β 衰变与弱作用
reg('beta-decay', () => import('./scenes/beta-decay'));
reg('birefringence', () => import('./scenes/birefringence'));
// 黑洞热力学四定律
reg('black-hole-thermo', () => import('./scenes/black-hole-thermo'));
// 黑洞与吸积盘
reg('blackhole-accretion', () => import('./scenes/blackhole-accretion'));
// 血液流变与法-朗效应
reg('blood-rheology', () => import('./scenes/blood-rheology'));
// 最速降线
reg('brachistochrone', () => import('./scenes/brachistochrone'));
// 布里渊区
// 分支点与多值函数
reg('branch-cuts', () => import('./scenes/branch-cuts'));
// 布儒斯特角与偏振
reg('brewsters-angle', () => import('./scenes/brewsters-angle'));
reg('brillouin-zone', () => import('./scenes/brillouin-zone'));
// 正则变换
reg('canonical-transform', () => import('./scenes/canonical-transform'));
// 悬链线
// 平行板电容器
reg('capacitor', () => import('./scenes/capacitor'));
// 电容器的能量
reg('capacitor-energy', () => import('./scenes/capacitor-energy'));
reg('catenary', () => import('./scenes/catenary'));
// 圆周运动与向心力
// 陶瓷与共价网络固体
reg('ceramic-solid', () => import('./scenes/ceramic-solid'));
// 度规与克里斯托费尔符号
reg('christoffel-symbols', () => import('./scenes/christoffel-symbols'));
reg('circular-motion', () => import('./scenes/circular-motion'));
// 骨骼与胶原复合力学
// 相干态
reg('coherent-state', () => import('./scenes/coherent-state'));
// 谐振子的相干态
reg('coherent-state-oscillator', () => import('./scenes/coherent-state-oscillator'));
reg('collagen-bone', () => import('./scenes/collagen-bone'));
// 碰撞与恢复系数
reg('collision-restitution', () => import('./scenes/collision-restitution'));
// 点的复合运动
reg('composed-motion', () => import('./scenes/composed-motion'));
// 成分过冷与凝固
reg('constitutional-supercooling', () => import('./scenes/constitutional-supercooling'));
// 科里奥利力
reg('coriolis', () => import('./scenes/coriolis-force'));
// 宇宙线观测（广延大气簇射）
reg('cosmic-ray-observation', () => import('./scenes/cosmic-ray-observation'));
// 宇宙网与大尺度结构
reg('cosmic-web', () => import('./scenes/cosmic-web'));
// 协变导数与平行输运
reg('covariant-derivative', () => import('./scenes/covariant-derivative'));
// 阻尼振动
reg('damped-oscillation', () => import('./scenes/damped-oscillation'));
// 直流电动机
reg('dc-motor', () => import('./scenes/dc-motor'));
// 景深
reg('depth-of-field', () => import('./scenes/depth-of-field'));
// 位移电流
// 介电老化与绝缘击穿
reg('dielectric-aging', () => import('./scenes/dielectric-aging'));
reg('displacement-current', () => import('./scenes/displacement-current'));
// DNA 双螺旋与 X 射线衍射
reg('dna-diffraction', () => import('./scenes/dna-diffraction'));
// 电磁波的产生与传播 —— 改绑 emwave/hertz（偶极振荡子向外辐射波面）；
// 原 scenes/em-wave-polarization.ts 只画静态偏振态，与「产生与传播」不匹配。
// 等效原理
reg('equivalence-principle', () => import('./scenes/equivalence-principle'));
// 视向速度法搜寻系外行星
// 遍历假说与系综
reg('ergodic-hypothesis', () => import('./scenes/ergodic-hypothesis'));
reg('exoplanet-rv', () => import('./scenes/exoplanet-rv'));
// FLRW 宇宙与尺度因子
reg('flrw-cosmology', () => import('./scenes/flrw-universe'));
// 参考系拖曳
// 功能磁共振成像 fMRI
reg('fmri-bold', () => import('./scenes/fmri-bold'));
// 断裂韧性
reg('fracture-toughness', () => import('./scenes/fracture-toughness'));
reg('frame-dragging', () => import('./scenes/frame-dragging'));
// 荧光共振能量转移 FRET
reg('fret-fluorescence', () => import('./scenes/fret-fluorescence'));
// 伽马射线天文观测
reg('gamma-astronomy', () => import('./scenes/gamma-astronomy'));
// 测地线与惯性运动
reg('geodesic', () => import('./scenes/geodesic'));
// 测地偏离与潮汐
reg('geodesic-deviation', () => import('./scenes/geodesic-deviation'));
// 测地线方程与变分
reg('geodesic-variation', () => import('./scenes/geodesic-variation'));
// 引力波与应变波形
reg('gw-ripple', () => import('./scenes/gw-ripple'));
// 陀螺进动与章动
// 引力波应变与灵敏度
reg('gw-strain', () => import('./scenes/gw-strain'));
reg('gyroscopic', () => import('./scenes/gyroscope-precession'));
// 哈密顿力学
// 霍尔-佩奇强化
reg('hall-petch', () => import('./scenes/hall-petch'));
reg('hamiltonian-mechanics', () => import('./scenes/hamiltonian-mechanics'));
// 希格斯粒子发现实验
reg('higgs-discovery', () => import('./scenes/higgs-discovery'));
// 霍曼转移轨道
// 希格斯真空亚稳态
reg('higgs-vacuum-stability', () => import('./scenes/higgs-vacuum-stability'));
reg('hohmann', () => import('./scenes/hohmann'));
// 哈勃图与宇宙膨胀
reg('hubble-diagram', () => import('./scenes/hubble-diagram'));
// 斜面与摩擦力
// 磁滞回线
reg('hysteresis', () => import('./scenes/hysteresis'));
// 磁滞回线与磁化曲线
reg('hysteresis-loop', () => import('./scenes/hysteresis-loop'));
reg('inclined-plane', () => import('./scenes/inclined-plane'));
// 红外天文观测
// 感应圈与高压火花
reg('induction-coil', () => import('./scenes/induction-coil'));
reg('infrared-astronomy', () => import('./scenes/infrared-astronomy'));
// 最内稳定圆轨道
// 离子声波
reg('ion-acoustic', () => import('./scenes/ion-acoustic'));
reg('isco', () => import('./scenes/isco'));
// 伊辛模型与相变
reg('ising-model', () => import('./scenes/ising-model'));
// 拉格朗日点
// 阴极射线荷质比
reg('jj-thomson-em', () => import('./scenes/jj-thomson-em'));
reg('lagrange-points', () => import('./scenes/lagrange-points'));
// 晶格振动与声子
reg('lattice-vibration', () => import('./scenes/phonon-dispersion'));
// LC 谐振
reg('lc-resonance', () => import('./scenes/lc-resonance'));
// 引力透镜时间延迟
reg('lensing-time-delay', () => import('./scenes/lensing-time-delay'));
// 透镜制作者公式
reg('lensmaker', () => import('./scenes/lensmaker'));
// 楞次定律与跳环实验
reg('lenz-law', () => import('./scenes/lenz-law'));
// 光线偏折
reg('light-deflection', () => import('./scenes/light-deflection'));
// 电流的磁场
reg('magnetic-field', () => import('./scenes/magnetic-field'));
// 膜电位与离子通道
// 磁粒子成像 MPI
reg('magnetic-particle-imaging', () => import('./scenes/magnetic-particle-imaging'));
// 马兰戈尼效应
reg('marangoni', () => import('./scenes/marangoni'));
reg('membrane-potential', () => import('./scenes/membrane-potential'));
// 多极辐射
// 金属玻璃
reg('metallic-glass', () => import('./scenes/metallic-glass'));
// 显微镜与分辨极限
reg('microscope-resolution', () => import('./scenes/microscope-resolution'));
// 密立根油滴实验
reg('millikan-oil-drop', () => import('./scenes/millikan-oil-drop'));
reg('multipole-radiation', () => import('./scenes/multipole-radiation'));
// 纳维-斯托克斯方程
reg('navier-stokes', () => import('./scenes/navier-stokes'));
// 中微子天文学
reg('neutrino-observation', () => import('./scenes/neutrino-observation'));
// 简正模式与耦合摆
reg('normal-modes', () => import('./scenes/normal-modes'));
// 佩尔斯-纳巴罗应力
// 核子结构与夸克
reg('nucleon-structure', () => import('./scenes/nucleon-structure'));
// 光程与费马原理
reg('optical-path-length', () => import('./scenes/optical-path-length'));
// 旋光与偏振面旋转
reg('optical-rotation', () => import('./scenes/optical-rotation'));
// 序参量
reg('order-parameter', () => import('./scenes/order-parameter'));
reg('peierls-nabarro', () => import('./scenes/peierls-nabarro'));
// 佩兰布朗运动实验
reg('perrin-experiment', () => import('./scenes/perrin-experiment'));
// 分波法与相移
reg('phase-shift-scattering', () => import('./scenes/phase-shift-scattering'));
// 天体偏振观测
// 等离子体频率
reg('plasma-frequency', () => import('./scenes/plasma-frequency'));
reg('polarimetry', () => import('./scenes/polarimetry'));
// 坡印廷矢量与能流
// 高分子玻璃化转变
reg('polymer-glass-transition', () => import('./scenes/polymer-glass-transition'));
reg('poynting-vector', () => import('./scenes/poynting-vector'));
// 抛体运动
reg('projectile-motion', () => import('./scenes/projectile-motion'));
// 脉冲星观测
reg('pulsar-discovery', () => import('./scenes/pulsar-discovery'));
// 引力波四极公式
reg('quadrupole-formula', () => import('./scenes/quadrupole-formula'));
// 量子霍尔效应与拓扑序
// 量子纠错码
reg('quantum-error-correct', () => import('./scenes/quantum-error-correct'));
reg('quantum-hall', () => import('./scenes/quantum-hall'));
// 射电望远镜
// 量子测量与坍缩
reg('quantum-measurement', () => import('./scenes/quantum-measurement'));
reg('radio-telescope', () => import('./scenes/radio-telescope'));
// 彩虹的形成
// 放射治疗与剂量
reg('radiotherapy-dose', () => import('./scenes/radiotherapy-dose'));
reg('rainbow', () => import('./scenes/rainbow'));
// 晶格与倒格子
reg('reciprocal-lattice', () => import('./scenes/reciprocal-lattice'));
// 星系红移巡天
reg('redshift-survey', () => import('./scenes/redshift-survey'));
// 反射望远镜
reg('reflecting-telescope', () => import('./scenes/reflecting-telescope'));
// 折射望远镜
reg('refracting-telescope', () => import('./scenes/refracting-telescope'));
// 相对论多普勒效应
// 制冷循环与制冷系数
reg('refrigeration-cop', () => import('./scenes/refrigeration-cop'));
reg('relativistic-doppler', () => import('./scenes/relativistic-doppler'));
// 谐振腔与驻波模式
// 同时的相对性
reg('relativity-simultaneity', () => import('./scenes/relativity-simultaneity'));
// 重正化群
reg('renormalization-group', () => import('./scenes/renormalization-group'));
reg('resonant-cavity', () => import('./scenes/resonant-cavity'));
// 刚体平面运动
reg('rigid-plane-motion', () => import('./scenes/rigid-plane-motion'));
// 刚体转动与转动惯量
reg('rigid-rotation', () => import('./scenes/rigid-body-rotation'));
// 里德伯原子与电离
reg('rydberg-series', () => import('./scenes/rydberg-series'));
// 平方-立方律
reg('scaling-law', () => import('./scenes/scaling-law'));
// 球坐标分离与角动量
// 散射截面
reg('scattering-cross-section', () => import('./scenes/scattering-cross-section'));
// 跃迁选择定则
reg('selection-rules', () => import('./scenes/selection-rules'));
reg('separation-spherical', () => import('./scenes/separation-spherical'));
// 单摆
reg('simple-pendulum', () => import('./scenes/simple-pendulum'));
// 固溶与沉淀强化
reg('solid-solution-strengthening', () => import('./scenes/solid-solution-strengthening'));
// 空间望远镜
reg('space-telescope', () => import('./scenes/space-telescope'));
// 时空弯曲与测地线
reg('spacetime-bending', () => import('./scenes/spacetime-bending'));
// 观测光谱仪
reg('spectrograph', () => import('./scenes/spectrograph'));
// 掩星观测
reg('stellar-occultation', () => import('./scenes/stellar-occultation'));
// 三角视差测距
reg('stellar-parallax', () => import('./scenes/stellar-parallax'));
// 恒星光谱观测
reg('stellar-spectroscopy', () => import('./scenes/stellar-spectroscopy'));
// 共振特斯拉线圈
// 随机引力波背景
reg('stochastic-gw', () => import('./scenes/stochastic-gw'));
// 摩擦磨损与润滑
reg('striebeck-lubrication', () => import('./scenes/striebeck-lubrication'));
// 表面催化与吸附
reg('surface-catalysis', () => import('./scenes/surface-catalysis'));
// 对称性破缺与序参量
reg('symmetry-breaking-order', () => import('./scenes/symmetry-breaking-order'));
reg('tesla-coil', () => import('./scenes/tesla-coil'));
// 三相电
// 薄膜应力与界面
reg('thin-film-stress', () => import('./scenes/thin-film-stress'));
reg('three-phase', () => import('./scenes/three-phase'));
// 拓扑不变量
reg('topological-invariant', () => import('./scenes/topological-invariant'));
// 波的叠加与双源干涉
// 变压器
reg('transformer', () => import('./scenes/transformer'));
// 湍流间歇性
reg('turbulence-intermittency', () => import('./scenes/turbulence-intermittency'));
reg('wave-superposition', () => import('./scenes/wave-superposition'));
// 矩形波导与截止频率
reg('waveguide', () => import('./scenes/waveguide'));
// 布朗运动与随机路径
reg('wiener-brownian-path', () => import('./scenes/wiener-brownian-path'));
// X 射线天文观测
reg('xray-astronomy', () => import('./scenes/xray-astronomy'));

// ————————————————————————————————————————————————
// 二、场景族绑定（families/）：族实现 + (variant, title) 参数
// ————————————————————————————————————————————————

type FamilyModule = { make: (variant: string, title: string) => SceneFactory };
type FamilyKey =
  'oscillator' |
  'orbit' |
  'fieldlines' |
  'emwave' |
  'waveoptics' |
  'rayoptics' |
  'condensed' |
  'quantum' |
  'thermal' |
  'fluid' |
  'spacetime' |
  'cosmos' |
  'instrument' |
  'biomol' |
  'circuit' |
  'plasma' |
  'mechwave'

const familyLoaders: Record<FamilyKey, () => Promise<FamilyModule>> = {
  oscillator: () => import('./families/oscillator'),
  orbit: () => import('./families/orbit'),
  fieldlines: () => import('./families/fieldlines'),
  emwave: () => import('./families/emwave'),
  waveoptics: () => import('./families/waveoptics'),
  rayoptics: () => import('./families/rayoptics'),
  condensed: () => import('./families/condensed'),
  quantum: () => import('./families/quantum'),
  thermal: () => import('./families/thermal'),
  fluid: () => import('./families/fluid'),
  spacetime: () => import('./families/spacetime'),
  cosmos: () => import('./families/cosmos'),
  instrument: () => import('./families/instrument'),
  biomol: () => import('./families/biomol'),
  circuit: () => import('./families/circuit'),
  plasma: () => import('./families/plasma'),
  mechwave: () => import('./families/mechwave'),
};

function regFamily(slug: string, family: FamilyKey, variant: string, title: string): void {
  reg(slug, async () => {
    const mod = await familyLoaders[family]();
    return { create: mod.make(variant, title) };
  });
}

// oscillator：18 个知识点 / 8 种形态
regFamily('angular-momentum-chair', 'oscillator', 'default', '转椅与角动量守恒');
regFamily('angular-momentum-scenarios', 'oscillator', 'rotation', '角动量守恒的综合应用');
regFamily('ballistic-pendulum', 'oscillator', 'default', '弹道摆');
regFamily('coupled-beats-energy', 'oscillator', 'coupled', '耦合振子的能量拍');
regFamily('double-pendulum-lagrange', 'oscillator', 'chaos', '拉格朗日方程解双摆');
regFamily('elastic-collision', 'oscillator', 'default', '动量守恒与弹性碰撞');
regFamily('forced-resonance-peak', 'oscillator', 'forced', '受迫振动与共振峰');
regFamily('foucault-pendulum', 'oscillator', 'default', '傅科摆');
regFamily('gyroscopic-nutation', 'oscillator', 'gyro', '陀螺进动与章动');
regFamily('hamilton-phase-space', 'oscillator', 'phasespace', '哈密顿方程与相空间');
regFamily('inertia-parallel-axis', 'oscillator', 'rotation', '转动惯量与平行轴定理');
regFamily('limit-cycle-bifurcation', 'oscillator', 'phasespace', '极限环与分岔');
regFamily('lissajous-figures', 'oscillator', 'lissajous', '振动合成与李萨如图形');
regFamily('particle-system-dynamics', 'oscillator', 'default', '质点系与质心运动定理');
regFamily('pendulum-chaos', 'oscillator', 'chaos', '混沌双摆');
regFamily('phase-plane-stability', 'oscillator', 'phasespace', '相平面与稳定性分析');
regFamily('resonance-forced', 'oscillator', 'forced', '受迫振动与共振');
regFamily('spring-oscillator', 'oscillator', 'default', '弹簧振子与相图');

// orbit：12 个知识点 / 12 种形态
regFamily('binary-inspiral', 'orbit', 'inspiral', '双致密天体旋进');
regFamily('eclipsing-binary', 'orbit', 'eclipsebinary', '食双星测质量');
regFamily('exoplanet-transit', 'orbit', 'transit', '凌星法搜寻系外行星');
regFamily('gravitational-potential', 'orbit', 'potential-well', '引力势与逃逸速度');
regFamily('gravity-assist', 'orbit', 'flyby', '引力弹弓');
regFamily('kepler-orbit', 'orbit', 'kepler', '开普勒轨道');
regFamily('nbody-simulation', 'orbit', 'nbody', 'N 体模拟与星系并合');
regFamily('orbital-transfer-speeds', 'orbit', 'transfer', '变轨与宇宙速度');
regFamily('schwarzschild-orbit', 'orbit', 'schwarzschild', '史瓦西轨道与进动');
regFamily('three-body', 'orbit', 'threebody', '三体问题');
regFamily('tidal-force', 'orbit', 'tidal', '潮汐力');
regFamily('weightlessness', 'orbit', 'lorbit', '完全失重与轨道运动');

// fieldlines：15 个知识点 / 12 种形态
regFamily('charge-distribution', 'fieldlines', 'distribution', '电荷分布与库仑扭秤');
regFamily('conductor-electrostat', 'fieldlines', 'conductor', '静电平衡与尖端放电');
regFamily('cylindrical-gauss-law', 'fieldlines', 'gauss', '柱对称高斯定理');
regFamily('dielectric-polarization', 'fieldlines', 'dielectric', '电介质的极化');
regFamily('eddy-current', 'fieldlines', 'eddy', '涡流与电磁阻尼');
regFamily('electric-dipole-field', 'fieldlines', 'dipole', '电偶极子的电场与势');
regFamily('electric-field', 'fieldlines', 'dipole', '电场线与电势');
regFamily('electric-potential', 'fieldlines', 'potential', '电势与等势面');
regFamily('faraday-disk', 'fieldlines', 'fardisk', '法拉第圆盘发电机');
regFamily('faraday-lenz-law', 'fieldlines', 'eddy', '法拉第定律与楞次方向');
regFamily('gauss-law', 'fieldlines', 'gauss', '高斯定律');
regFamily('image-charge', 'fieldlines', 'imagecharge', '镜像电荷');
regFamily('magnetic-dipole', 'fieldlines', 'magdipole', '磁偶极与磁矩');
regFamily('potential-multipole-expansion', 'fieldlines', 'multipole', '电势的多极展开');
regFamily('quadrupole', 'fieldlines', 'quadrupole', '四极场');

// emwave：10 个知识点 / 7 种形态
regFamily('em-wave', 'emwave', 'hertz', '电磁波的产生与传播');
regFamily('hertz-electromagnetic-wave', 'emwave', 'hertz', '赫兹电磁波实验');
regFamily('laser-cavity', 'emwave', 'cavity', '激光谐振腔与纵模');
regFamily('laser-threshold', 'emwave', 'lasing', '激光原理与振荡阈值');
regFamily('maxwell-displacement-current', 'emwave', 'maxwell', '位移电流与全电流定律');
regFamily('maxwell-equations', 'emwave', 'maxwell', '麦克斯韦方程组');
regFamily('poynting-energy-flow', 'emwave', 'poynting', '坡印廷矢量与电磁能流');
regFamily('retarded-potential', 'emwave', 'retarded', '推迟势与电磁因果');
regFamily('skin-effect', 'emwave', 'skin', '趋肤效应');
regFamily('stimulated-emission', 'emwave', 'lasing', '受激辐射与激光原理');

// waveoptics：15 个知识点 / 11 种形态
regFamily('airy-disk', 'waveoptics', 'airy', '艾里斑与分辨极限');
regFamily('double-slit', 'waveoptics', 'double-slit', '双缝干涉');
regFamily('evanescent', 'waveoptics', 'evanescent', '倏逝波');
regFamily('fresnel-diffraction', 'waveoptics', 'fresnel', '菲涅耳衍射与半波带');
regFamily('fresnel-mirror', 'waveoptics', 'lloyd', '菲涅耳双面镜');
regFamily('grating', 'waveoptics', 'grating', '衍射光栅');
regFamily('grating-resolving-power', 'waveoptics', 'grating', '光栅分辨本领与缺级');
regFamily('lloyd-mirror', 'waveoptics', 'lloyd', '劳埃德镜实验');
regFamily('multidim-fourier-diffraction', 'waveoptics', 'fourier', '多维傅里叶变换与衍射');
regFamily('poisson-spot', 'waveoptics', 'poisson', '泊松亮斑');
regFamily('quarter-wave-plate', 'waveoptics', 'polarization', '四分之一波片与椭圆偏振');
regFamily('single-slit', 'waveoptics', 'single-slit', '单缝衍射');
regFamily('single-slit-fraunhofer', 'waveoptics', 'single-slit', '单缝夫琅禾费衍射');
regFamily('spatial-coherence', 'waveoptics', 'double-slit', '空间相干性与缝宽');
regFamily('thin-film', 'waveoptics', 'thinfilm', '薄膜干涉');

// rayoptics：7 个知识点 / 6 种形态
regFamily('eye-optics', 'rayoptics', 'eye', '人眼与调焦');
regFamily('fiber', 'rayoptics', 'fiber', '光纤传输');
regFamily('lens-refraction', 'rayoptics', 'lens', '折射与透镜成像');
regFamily('mirror-concave', 'rayoptics', 'mirror', '球面镜成像');
regFamily('optical-aberration', 'rayoptics', 'aberration', '像差与校正');
regFamily('prism-dispersion', 'rayoptics', 'prism', '棱镜色散');
regFamily('thick-lens', 'rayoptics', 'lens', '厚透镜与主面');

// condensed：31 个知识点 / 19 种形态
regFamily('annealing-recrystallization', 'condensed', 'crystalgrowth', '退火与再结晶');
regFamily('anyon', 'condensed', 'topo', '任意子与统计');
regFamily('band-structure', 'condensed', 'band', '能带的形成');
regFamily('bragg-diffraction', 'condensed', 'bragg', '布拉格衍射与晶格分析');
regFamily('chern-insulator', 'condensed', 'topo', '陈绝缘体与陈数');
regFamily('crystal-defect', 'condensed', 'defect', '晶体缺陷');
regFamily('czochralski', 'condensed', 'crystalgrowth', '晶体生长与区域提纯');
regFamily('dislocation-slip', 'condensed', 'defect', '位错与塑性滑移');
regFamily('doping', 'condensed', 'band', '掺杂与半导体');
regFamily('edge-state', 'condensed', 'topo', '边缘态与体边对应');
regFamily('fatigue-crack', 'condensed', 'fracture', '疲劳与裂纹扩展');
regFamily('fermi-surface', 'condensed', 'fermi', '费米面');
regFamily('fiber-composite', 'condensed', 'composite', '纤维增强复合材料');
regFamily('fick-diffusion', 'condensed', 'diffusion', '扩散与菲克定律');
regFamily('graphene', 'condensed', 'band', '石墨烯与狄拉克锥');
regFamily('hall-effect', 'condensed', 'hall', '霍尔效应');
regFamily('hall-effect-carriers', 'condensed', 'hall', '霍尔效应与载流子判型');
regFamily('martensitic-transformation', 'condensed', 'phase', '马氏体相变');
regFamily('phase-diagram', 'condensed', 'phase', '二元相图与吉布斯自由能');
regFamily('piezoelectric-ferrcelectric', 'condensed', 'ferro', '压电与铁电材料');
regFamily('pn-junction', 'condensed', 'pn', '半导体 PN 结');
regFamily('quantum-well', 'condensed', 'band', '量子阱');
regFamily('quasicrystal', 'condensed', 'quasicrystal', '准晶与五重对称');
regFamily('rubber-elasticity', 'condensed', 'polymer', '橡胶弹性与熵弹簧');
regFamily('shape-memory-alloy', 'condensed', 'phase', '形状记忆合金');
regFamily('superconductivity-discovery', 'condensed', 'meissner', '迈斯纳效应实验');
regFamily('surface-plasmon', 'condensed', 'plasmon', '纳米颗粒与等离激元');
regFamily('thin-film-deposition', 'condensed', 'film', '薄膜沉积与外延');
regFamily('tight-binding', 'condensed', 'band', '紧束缚与能带');
regFamily('type-ii-superconductor', 'condensed', 'vortex', '第二类超导与磁通涡旋');
regFamily('vacancy-diffusion', 'condensed', 'defect', '空位与间隙扩散');

// quantum：35 个知识点 / 16 种形态
regFamily('alpha-decay-tunnel', 'quantum', 'barrier', 'α 衰变与量子隧穿');
regFamily('angular-momentum-qm', 'quantum', 'ladder', '角动量量子化');
regFamily('atomic-levels', 'quantum', 'levels', '氢原子能级与跃迁');
regFamily('bloch-sphere', 'quantum', 'qubit', '量子比特与布洛赫球');
regFamily('compton-scattering', 'quantum', 'compton', '康普顿散射实验');
regFamily('critical-mass', 'quantum', 'nuclear', '临界质量');
regFamily('de-broglie-wave', 'quantum', 'wavepacket', '物质波与驻波条件');
regFamily('delta-potential', 'quantum', 'well', 'δ 势的束缚与散射');
regFamily('electron-diffraction', 'quantum', 'compton', '电子衍射实验');
regFamily('entanglement-swapping', 'quantum', 'qubit', '纠缠交换');
regFamily('finite-square-well', 'quantum', 'well', '有限深方势阱');
regFamily('hydrogen-wavefunction', 'quantum', 'hydrogen', '氢原子波函数');
regFamily('infinite-well', 'quantum', 'well', '无限深势阱');
regFamily('legendre-spherical-harmonics', 'quantum', 'hydrogen', '勒让德多项式与球谐函数');
regFamily('liquid-drop-model', 'quantum', 'nuclear', '液滴模型与裂变垒');
regFamily('nuclear-force', 'quantum', 'nuclear', '核力与介子交换');
regFamily('nuclear-reactor', 'quantum', 'nuclear', '核反应堆');
regFamily('pair-production', 'quantum', 'nuclear', '对产生与吸收');
regFamily('pauli-matrices-spin', 'quantum', 'spin', '泡利矩阵与自旋 1/2');
regFamily('quantum-oscillator', 'quantum', 'qho', '量子谐振子');
regFamily('rabi-oscillation', 'quantum', 'rabi', '拉比振荡与两能级系统');
regFamily('raman-scattering', 'quantum', 'raman', '拉曼散射');
regFamily('rectangular-barrier', 'quantum', 'barrier', '方势垒透射系数');
regFamily('shell-model', 'quantum', 'levels', '壳层模型与幻数');
regFamily('so3-su2-representation', 'quantum', 'spin', 'SO(3) 与 SU(2) 表示');
regFamily('spin-precession', 'quantum', 'spin', '自旋进动');
regFamily('stark-effect', 'quantum', 'zeeman', '斯塔克效应');
regFamily('stern-gerlach', 'quantum', 'sterngerlach', '斯特恩-格拉赫实验');
regFamily('symmetry-breaking', 'quantum', 'vacuum', '自发对称破缺');
regFamily('tunneling', 'quantum', 'barrier', '量子隧穿');
regFamily('vacuum-fluctuation', 'quantum', 'vacuum', '真空涨落');
regFamily('wavepacket', 'quantum', 'wavepacket', '波包扩散');
regFamily('wkb-approximation', 'quantum', 'barrier', 'WKB 近似');
regFamily('zeeman-effect', 'quantum', 'zeeman', '塞曼效应');
regFamily('zeeman-splitting-pattern', 'quantum', 'zeeman', '塞曼效应与能级分裂');

// thermal：8 个知识点 / 6 种形态
regFamily('blackbody-lab', 'thermal', 'blackbody', '黑体辐射测量');
regFamily('boltzmann-distribution', 'thermal', 'mbdist', '玻尔兹曼分布');
regFamily('heat-conduction-rod', 'thermal', 'conduction', '一维热传导');
regFamily('langevin-fokkerplanck', 'thermal', 'langevin', '朗之万方程与福克-普朗克');
regFamily('maxwell-boltzmann', 'thermal', 'mbdist', '麦克斯韦速率分布');
regFamily('monte-carlo-sampling', 'thermal', 'montecarlo', '蒙特卡洛方法与重要性抽样');
regFamily('speed-distribution-derivation', 'thermal', 'mbdist', '麦克斯韦速率分布');
regFamily('superfluid-helium', 'thermal', 'superfluid', '超流与量子流体');

// fluid：16 个知识点 / 11 种形态
regFamily('bernoulli-equation', 'fluid', 'venturi', '伯努利方程');
regFamily('boundary-layer', 'fluid', 'airfoil', '边界层');
regFamily('capillary-wave', 'fluid', 'droplet', '毛细波与表面张力');
regFamily('cavitation', 'fluid', 'cavitation', '空化');
regFamily('convection-cell', 'fluid', 'instability', '瑞利-贝纳德对流胞');
regFamily('droplet-surface-tension', 'fluid', 'droplet', '液滴与表面张力测量');
regFamily('kolmogorov-cascade', 'fluid', 'turbulence', '湍流级串');
regFamily('lift-curve', 'fluid', 'airfoil', '升力曲线与攻角');
regFamily('magnus', 'fluid', 'magnus', '马格努斯效应');
regFamily('poiseuille', 'fluid', 'pipeflow', '泊肃叶流');
regFamily('rayleigh-taylor', 'fluid', 'instability', '瑞利-泰勒不稳定性');
regFamily('reynolds-transition', 'fluid', 'pipeflow', '雷诺转捩');
regFamily('stokes-drag', 'fluid', 'drag', '斯托克斯阻力');
regFamily('taylor-couette', 'fluid', 'couette', '泰勒-库埃特流');
regFamily('venturi', 'fluid', 'venturi', '文丘里管');
regFamily('vortex-street', 'fluid', 'vortexstreet', '卡门涡街');

// spacetime：16 个知识点 / 15 种形态
regFamily('accretion-disk-temp', 'spacetime', 'disk', '吸积盘温度分布');
regFamily('colliding-beams', 'spacetime', 'beams', '对撞机与质心能量');
regFamily('gravitational-lensing', 'spacetime', 'einsteinring', '爱因斯坦环与引力透镜');
regFamily('gravitational-redshift', 'spacetime', 'redshift', '引力红移');
regFamily('gw-chirp', 'spacetime', 'gwchirp', '引力波旋进信号');
regFamily('hawking-radiation', 'spacetime', 'hawking', '霍金辐射');
regFamily('invariant-mass-collision', 'spacetime', 'beams', '相对论碰撞与不变质量');
regFamily('kerr-black-hole', 'spacetime', 'kerr', '克尔黑洞与能层');
regFamily('length-contraction', 'spacetime', 'contraction', '长度收缩');
regFamily('light-cone', 'spacetime', 'lightcone', '光锥与因果结构');
regFamily('minkowski-spacetime', 'spacetime', 'minkowski', '闵可夫斯基时空');
regFamily('penrose-process', 'spacetime', 'penrose', '彭罗斯过程');
regFamily('riemann-curvature', 'spacetime', 'curvature', '黎曼曲率张量');
regFamily('time-dilation', 'spacetime', 'dilation', '时间膨胀与钟慢效应');
regFamily('twin-paradox', 'spacetime', 'twins', '双生子佯谬');
regFamily('worldline', 'spacetime', 'worldline', '世界线与固有时');

// cosmos：4 个知识点 / 2 种形态
regFamily('cosmic-inflation', 'cosmos', 'default', '宇宙暴胀');
regFamily('cosmological-horizon', 'cosmos', 'default', '宇宙视界');
regFamily('matter-antimatter', 'cosmos', 'default', '重子不对称');
regFamily('neutron-star-eos', 'cosmos', 'nsstar', '中子星状态方程');

// instrument：20 个知识点 / 14 种形态
regFamily('cmb-discovery', 'instrument', 'cmb', '微波背景辐射观测');
regFamily('coronagraphy', 'instrument', 'corona', '日冕观测');
regFamily('ct-reconstruction', 'instrument', 'ct', 'CT 反投影重建');
regFamily('doppler-ultrasound', 'instrument', 'ultrasound', '多普勒超声');
regFamily('dual-energy-ct', 'instrument', 'ct', '双能 CT 与能谱成像');
regFamily('gw-detector', 'instrument', 'gwdetector', '激光干涉引力波探测器');
regFamily('gw150914', 'instrument', 'gwdetector', '首次引力波观测');
regFamily('hifu', 'instrument', 'ultrasound', '高强度聚焦超声 HIFU');
regFamily('interferometer-array', 'instrument', 'array', '干涉阵与综合孔径');
regFamily('michelson-interferometer', 'instrument', 'michelson', '迈克尔逊干涉仪');
regFamily('mri-k-space', 'instrument', 'mri', 'MRI 与 k 空间');
regFamily('oct-imaging', 'instrument', 'oct', '光学相干断层 OCT');
regFamily('pet-imaging', 'instrument', 'pet', 'PET 正电子发射断层');
regFamily('phase-contrast', 'instrument', 'phasecontrast', '相位衬度显微');
regFamily('solar-observation', 'instrument', 'sun', '太阳观测');
regFamily('spect-imaging', 'instrument', 'pet', 'SPECT 单光子成像');
regFamily('telescope-diffraction-limit', 'instrument', 'resolution', '望远镜的衍射极限');
regFamily('telescope-resolution', 'instrument', 'resolution', '望远镜的分辨极限');
regFamily('ultrasound-echo', 'instrument', 'ultrasound', '超声回波成像');
regFamily('xray-attenuation', 'instrument', 'xray', 'X 射线衰减成像');

// biomol：9 个知识点 / 5 种形态
regFamily('bacterial-flagellum', 'biomol', 'motor', '细菌鞭毛马达');
regFamily('cell-membrane', 'biomol', 'membrane', '细胞膜与脂双层');
regFamily('dna-replication', 'biomol', 'dna', 'DNA 复制与半保留');
regFamily('hemoglobin', 'biomol', 'hemoglobin', '协同结合与血红蛋白');
regFamily('molecular-motor', 'biomol', 'motor', '分子马达');
regFamily('muscle-contraction', 'biomol', 'motor', '肌肉收缩的横桥周期');
regFamily('photosynthesis', 'biomol', 'membrane', '光合作用与光系统');
regFamily('protein-folding', 'biomol', 'folding', '蛋白质折叠与能量景观');
regFamily('protein-structure', 'biomol', 'folding', '蛋白质结构层次');

// circuit：3 个知识点 / 3 种形态
regFamily('rlc-impedance-resonance', 'circuit', 'rlc', 'RLC 串联谐振与复阻抗');
regFamily('transformer-mutual-inductance', 'circuit', 'transformer', '互感与理想变压器');
regFamily('transmission-line-matching', 'circuit', 'txline', '传输线与阻抗匹配');

// plasma：5 个知识点 / 5 种形态
regFamily('debye-shielding', 'plasma', 'debye', '德拜屏蔽');
regFamily('icf-inertial-confinement', 'plasma', 'icf', '惯性约束聚变');
regFamily('magnetic-reconnection', 'plasma', 'reconnection', '磁重联');
regFamily('magnetohydrodynamic', 'plasma', 'mhd', '磁流体动力学');
regFamily('plasma-confinement', 'plasma', 'tokamak', '托卡马克与磁约束聚变');

// mechwave：9 个知识点 / 6 种形态
regFamily('dispersion', 'mechwave', 'dispersion', '波的色散');
regFamily('doppler-effect', 'mechwave', 'doppler', '多普勒效应');
regFamily('doppler-wave', 'mechwave', 'doppler', '声波多普勒效应');
regFamily('helmholtz-modes', 'mechwave', 'pipe', '亥姆霍兹方程与本征模');
regFamily('shock-wave', 'mechwave', 'shock', '激波与马赫锥');
regFamily('soliton', 'mechwave', 'soliton', '孤子');
regFamily('standing-pipe', 'mechwave', 'pipe', '驻波与管乐器');
regFamily('vibrating-string', 'mechwave', 'string', '振动弦与驻波');
regFamily('wave-dalembert-solution', 'mechwave', 'string', '波动方程的达朗贝尔解');

/** 该展项是否有 3D 场景（experiment-detail 据此显示 2D/3D 切换）。 */
export function hasScene(slug: string): boolean {
  return loaders.has(slug);
}

export function getSceneLoader(slug: string): SceneLoader | undefined {
  return loaders.get(slug);
}

export function sceneSlugs(): string[] {
  return [...loaders.keys()];
}
