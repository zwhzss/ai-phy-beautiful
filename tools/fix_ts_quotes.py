"""TS 目录渲染器的单引号嵌套修复器（升级版 v2，滚动流水线工具）。

规则一：以 ' 开头、', 结尾、且第 2 个引号后不是合法标点的行（字符串被嵌套截断）
        → 整行改为双引号包裹。对象键 `'k': 'v',`（第 2 引号后是冒号）不受影响。
规则二：任意行的第 2/3、4/5… 对引号之间若含中文字符（字符串内部被切断），
        将该对引号替换为中文弯引号 U+2018/U+2019——恢复字符串连续性。
        三元结构 `'A' : 'B'` 中间是冒号（无中文）不受影响。
所有索引均基于同一字符串（strip 后的 tr），避免 line/tr 混用错位。
"""
import io, sys, glob, re

root = r"client/src/app/features/experiments/viz/catalog"
# 只处理 index.ts 实际导入（参与构建）的文件——历史参考文件不碰，避免误伤
import os
_index = os.path.join(root, "index.ts")
_imported = set()
with io.open(_index, encoding="utf-8") as fh:
    for line in fh:
        if "from './" in line or "from \"./" in line:
            name = line.split("'./")[1].split("'")[0] if "'./" in line else line.split('"./')[1].split('"')[0]
            _imported.add(name + ".ts")
total1 = total2 = 0

def has_cjk(s: str) -> bool:
    return bool(re.search(r"[\u4e00-\u9fff\uff00-\uffef]", s))

for path in glob.glob(root + r"\*.ts"):
    if os.path.basename(path) not in _imported:
        continue
    with io.open(path, encoding="utf-8") as fh:
        lines = fh.read().split("\n")
    changed = False
    for i, line in enumerate(lines):
        if not line.strip():
            continue
        indent = line[: len(line) - len(line.lstrip())]
        tr = line.strip()
        quotes = [j for j, ch in enumerate(tr) if ch == "'"]
        # ---- 规则一 ----
        if tr.startswith("'") and tr.endswith("',") and len(quotes) >= 4:
            rest = tr[quotes[1] + 1:].lstrip()
            if rest and rest[0] not in ",)]}:+":
                last = tr.rfind("'")
                body = tr[1:last]
                tail = tr[last + 1:]
                lines[i] = indent + '"' + body + '"' + tail
                total1 += 1
                changed = True
                continue
        # ---- 规则二 ----
        if len(quotes) >= 4:
            replacements = []
            pairIdx = 0
            k = 1
            while k + 1 < len(quotes):
                a, b = quotes[k], quotes[k + 1]
                # span 含中文即判定为被嵌套引号切断的字符串内部
                #（合法的 span 是 `: `、` + `、`' : '` 等标点运算符，无中文）
                if b > a and has_cjk(tr[a + 1:b]):
                    replacements.append((a, "\u201c" if pairIdx % 2 == 0 else "\u2018"))
                    replacements.append((b, "\u201d" if pairIdx % 2 == 0 else "\u2019"))
                    pairIdx += 1
                k += 2
            if replacements:
                chars = list(tr)
                for pos, ch in replacements:
                    chars[pos] = ch
                lines[i] = indent + "".join(chars)
                total2 += 1
                changed = True
    if changed:
        with io.open(path, "w", encoding="utf-8", newline="") as fh:
            fh.write("\n".join(lines))
        print("fixed:", path)
print(f"rule1={total1} rule2={total2}")
sys.exit(0)
