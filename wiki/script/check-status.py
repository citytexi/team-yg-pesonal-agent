#!/usr/bin/env python3
"""lint 점검 항목 7 — 판본 상태(status) 무결성 검사."""
import pathlib
import re

SRC = pathlib.Path("wiki/sources")
VALID = {"current", "superseded", "partial"}
pages, errs = {}, []


def parse(p):
    lines = p.read_text(encoding="utf-8").split("\n")
    if lines[0].strip() != "---":
        return None
    end = next(i for i, l in enumerate(lines[1:], 1) if l.strip() == "---")
    fm = {}
    for l in lines[1:end]:
        m = re.match(r"^(\w+):\s*(.*)$", l)
        if not m:
            continue
        k, v = m.group(1), m.group(2).strip()
        if v.startswith("[") and v.endswith("]"):
            v = [x.strip() for x in v[1:-1].split(",") if x.strip()]
        fm[k] = v
    return fm


for p in sorted(SRC.glob("*.md")):
    fm = parse(p)
    if fm is None:
        errs.append(f"{p.stem}: 프론트매터 없음")
        continue
    pages[p.stem] = fm

# 1. 필드 누락 / 값 오류 / 필수 필드
for name, fm in pages.items():
    st = fm.get("status")
    if st is None:
        errs.append(f"{name}: status 누락 (판정 불가 = 인용 금지)")
        continue
    if st not in VALID:
        errs.append(f"{name}: status 값 오류 '{st}'")
    if st in ("superseded", "partial") and not fm.get("superseded_by"):
        errs.append(f"{name}: {st}인데 superseded_by 없음")
    if st == "partial" and not fm.get("scope"):
        errs.append(f"{name}: partial인데 scope 없음")
    if st == "current" and fm.get("superseded_by"):
        errs.append(f"{name}: current인데 superseded_by 있음")

# 2. 참조 실재
for name, fm in pages.items():
    for field in ("superseded_by", "supersedes"):
        for t in fm.get(field, []):
            if t not in pages:
                errs.append(f"{name}.{field}: 대상 없음 → {t}")

# 3. 체인 종단 (current 도달, 사이클 금지)
for name, fm in pages.items():
    seen, cur = [name], name
    while pages.get(cur, {}).get("status") in ("superseded", "partial"):
        nxt = pages[cur].get("superseded_by", [])
        if not nxt:
            break
        cur = nxt[0]
        if cur in seen:
            errs.append(f"{name}: superseded_by 사이클 {' → '.join(seen + [cur])}")
            break
        seen.append(cur)
        if cur not in pages:
            break
    else:
        if pages.get(cur, {}).get("status") != "current":
            errs.append(f"{name}: 체인이 current에 도달 못함 ({' → '.join(seen)})")

# 4. 역방향 정합
for name, fm in pages.items():
    for t in fm.get("supersedes", []):
        if t in pages and name not in pages[t].get("superseded_by", []):
            errs.append(f"{name}.supersedes={t} 인데 {t}.superseded_by에 {name} 없음")
    for t in fm.get("superseded_by", []):
        if t in pages and name not in pages[t].get("supersedes", []):
            errs.append(f"[경고] {name}.superseded_by={t} 인데 {t}.supersedes에 {name} 없음")

# 5. index 투영 정합
idx = pathlib.Path("wiki/index.md").read_text(encoding="utf-8")
for name, fm in pages.items():
    line = next((l for l in idx.split("\n") if l.startswith(f"- [[{name}]]")), None)
    if line is None:
        errs.append(f"{name}: index.md에 줄 없음")
        continue
    has_cur, has_sup = "현행 정본" in line, "🔁" in line
    if fm.get("status") == "current" and not has_cur:
        errs.append(f"index 불일치: {name} — status=current인데 '현행 정본' 표기 없음")
    if fm.get("status") in ("superseded", "partial") and not has_sup:
        errs.append(f"index 불일치: {name} — status={fm['status']}인데 🔁 표기 없음")
    if fm.get("status") in ("superseded", "partial") and has_cur:
        errs.append(f"index 불일치: {name} — 폐기본인데 '현행 정본' 표기")

print(f"소스 {len(pages)}건 검사")
print("\n".join(errs) if errs else "위반 0건")
print(f"— 위반 {len([e for e in errs if not e.startswith('[경고]')])}건 "
      f"(경고 {len([e for e in errs if e.startswith('[경고]')])}건)")
