/**
 * 可视化目录：物理之美知识体系（见 架构设计.md §4.1）。
 *
 * 每个模块在被导入时调用 registerViz 完成注册。新增展项只需：
 * 1) 在对应分类文件里 defineViz + registerViz；
 * 2) 若为新分类，在本文件追加一行 import。
 *
 * 说明：原系统（前身项目）归档的渲染器文件（calculus/math-history-* 等）保留在
 * catalog/ 目录中作历史参考，但不再导入打包（物理种子清单未引用其 slug）。
 */
import './special-physics';

// ===== 物理之美分类渲染器 =====
import './classical-mechanics';
import './relativistic-motion';
import './wave-optics';
import './geometric-optics';
import './electrostatics';
import './thermodynamics';
import './quantum-foundations';
import './nuclear-physics';
import './spacetime-scenes';
import './scale-journey';
import './quantum-information';
import './solid-state';
import './cosmology';
import './graduate-core';
import './graduate-frontiers';

// ===== 滚动扩充批次（experiments-b.json 配套）=====
import './rigid-rotational';
import './wave-acoustics';
import './fluid-mechanics';
import './wave-optics-2';
import './geometric-optics-2';
import './electrostatics-2';
import './thermodynamics-2';
import './quantum-basics';

// ===== 滚动扩充批次 C（experiments-c.json 配套）=====
import './circuits-ac';
import './relativistic-motion-2';
import './spacetime-basics';
import './black-hole-2';
import './gr-formal';
import './quantum-atoms';
import './solid-state-2';
import './nuclear-structure';
import './cosmology-2';

// ===== 滚动扩充批次 D（experiments-d.json 配套）=====
import './fluid-2';
import './analytical-mechanics';
import './wave-optics-3';
import './geometric-optics-3';
import './maxwell-theory';
import './phase-transitions-2';
import './laser-quantum-optics';
import './gravitational-waves';
import './quantum-information-2';
import './topological-phases-2';
import './plasma-2';
import './qft-advanced';
import './fermi-estimates';

// ===== 滚动扩充批次 E（experiments-e.json 配套）=====
import './cosmic-observation';
import './classic-experiments';
import './classic-experiments-2';

// ===== 滚动扩充批次 F（experiments-f.json 配套）=====
import './biophysics';
import './medical-imaging';
import './materials-science';
import './materials-science-2';

// ===== 滚动扩充批次 G（experiments-g.json 配套）=====
import './open-problems';
import './open-problems-2';
import './core-foundations';
import './quantum-nuclear-solid';

// ===== 滚动扩充批次 H（experiments-h.json 配套·考研核心专题）=====
import './exam-mechanics';
import './exam-electromagnetism';
import './exam-thermal';
import './exam-quantum';
import './exam-optics-modern';

// ===== 滚动扩充批次 I（experiments-i.json 配套·数学物理方法）=====
import './mpm-ode';
import './mpm-pde';
import './mpm-complex';
import './mpm-transform-tensor';
import './mpm-variational-linear';
import './mpm-probability-group';
