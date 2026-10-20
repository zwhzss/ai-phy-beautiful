"""文稿要点 → 7 行分节 JSON 组装器（滚动扩充流水线组件）。

用法：python tools/gen_narrations.py <要点文件.json> <输出.json>
要点文件结构：
[
  { "slug": "...", "concept": ["要点1", "要点2"], "conditions": "...",
    "impacts": ["影响1", "影响2"], "source": "...", "formula": null | "公式行" }
]
输出：{ slug: { source: "phy-seed", lines: [7 行分节] } }
- 有 formula 时用 "公式内容" 小节（statement×2 = 要点1 + 公式行），否则 "核心概念"
"""
import json, sys, os

SEC_INTRO = "开场"
SEC_STMT_CONCEPT = "核心概念"
SEC_STMT_FORMULA = "公式内容"
SEC_COND = "适用条件"
SEC_IMP = "历史影响"
SEC_SRC = "出处"

def build(item: dict) -> dict:
    lines = []
    def add(sec, title, idx, text):
        lines.append({
            "section_id": sec, "section_title": title,
            "line_index": idx, "line_id": f"{sec}-{idx + 1}",
            "text": text, "duration_ms": 0,
        })

    add("intro", SEC_INTRO, 0, item["intro"])
    has_formula = bool(item.get("formula"))
    stmt_sec = SEC_STMT_FORMULA if has_formula else SEC_STMT_CONCEPT
    add("statement", stmt_sec, 0, item["concept"][0])
    if has_formula:
        add("statement", stmt_sec, 1, item["formula"])
    else:
        add("statement", stmt_sec, 1, item["concept"][1])
    add("conditions", SEC_COND, 0, item["conditions"])
    add("impact", SEC_IMP, 0, item["impacts"][0])
    add("impact", SEC_IMP, 1, item["impacts"][1])
    add("source", SEC_SRC, 0, item["source"])
    return {"source": "phy-seed", "lines": lines}

def main():
    src, out = sys.argv[1], sys.argv[2]
    items = json.load(open(src, encoding="utf-8"))
    result = {}
    for it in items:
        missing = [k for k in ("slug", "intro", "concept", "conditions", "impacts", "source") if k not in it]
        if missing:
            sys.exit(f"{it.get('slug','?')}: 缺字段 {missing}")
        if len(it["concept"]) < 2 or len(it["impacts"]) < 2:
            sys.exit(f"{it['slug']}: concept/impacts 至少 2 条")
        result[it["slug"]] = build(it)
    # 文稿内嵌 JSON 需避免 ASCII 引号破坏（此处全部由字段值透传，值内引号由 JSON 序列化自动转义）
    with open(out, "w", encoding="utf-8") as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    print(f"生成 {len(result)} 份文稿 → {out}（共 {sum(len(v['lines']) for v in result.values())} 行）")

if __name__ == "__main__":
    main()
