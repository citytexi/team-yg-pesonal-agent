#!/usr/bin/env python3
"""Rank vendored skills by a natural-language query over SKILL.md frontmatter.

용법:
    python3 parfait/script/search.py "<자연어 쿼리>" [--top N]

규약: stdlib 전용. repo 루트 = Path(__file__).resolve().parents[2].
"""
import argparse
import re
from pathlib import Path

SKILLS_DIR = Path(__file__).resolve().parents[2] / ".claude" / "skills"   # parfait/script → repo/.claude/skills


def tokenize(s):
    return re.findall(r"[a-z0-9]+", s.lower())


def parse_skill(md_path):
    text = md_path.read_text(encoding="utf-8", errors="ignore")
    desc = ""
    m = re.search(r"^---\n(.*?)\n---", text, re.S)
    if m:
        dm = re.search(r"^description:\s*(.+)$", m.group(1), re.M)
        if dm:
            desc = dm.group(1).strip().strip("\"'")
    headings = " ".join(re.findall(r"^#{1,3}\s+(.+)$", text, re.M))
    return {"name": md_path.parent.name, "desc": desc, "headings": headings, "path": str(md_path)}


def score(query, skill):
    q = set(tokenize(query))
    if not q:
        return 0.0
    name_t = tokenize(skill["name"])
    desc_t = tokenize(skill["desc"])
    head_t = tokenize(skill.get("headings", ""))
    total = 0.0
    for t in q:
        total += 4 * name_t.count(t) + 2 * desc_t.count(t) + 1 * head_t.count(t)
        if any(t in n for n in name_t):
            total += 1
    return total


def search(query, top=8):
    skills = []
    for d in sorted(SKILLS_DIR.iterdir()):
        md = d / "SKILL.md"
        if md.is_file():
            skills.append(parse_skill(md))
    ranked = sorted(((score(query, s), s) for s in skills), key=lambda x: -x[0])
    return [(sc, s) for sc, s in ranked if sc > 0][:top]


def main():
    ap = argparse.ArgumentParser(description="Search vendored skills")
    ap.add_argument("query", nargs="+")
    ap.add_argument("--top", type=int, default=8)
    a = ap.parse_args()
    q = " ".join(a.query)
    res = search(q, a.top)
    if not res:
        print(f"매칭 스킬 없음: {q}")
        return
    for sc, s in res:
        print(f"{s['name']}  (score {sc:.0f}) — {s['desc'][:120]}")


if __name__ == "__main__":
    main()
