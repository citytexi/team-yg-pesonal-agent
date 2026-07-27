#!/usr/bin/env python3
"""wiki lint — 결정적 기계 검사.

사용: python3 wiki/script/lint.py     (저장소 루트에서)
종료 코드: 위반 0건이면 0, 있으면 1.

판본 상태(status) 검사는 check-status.py가 담당 — 여기서 함께 실행한다.
사람 판단이 필요한 항목(모순 감지·데이터 공백·stale 서술)은 이 스크립트가 대신하지 않는다.
"""
import pathlib
import re
import subprocess
import sys
import unicodedata
from collections import defaultdict

ROOT = pathlib.Path("wiki")
RAW = pathlib.Path("raw")
SCRIPT_DIR = pathlib.Path(__file__).resolve().parent

# 스키마 산출물 — 고아·깨진링크·frontmatter 검사 제외 (플레이스홀더가 오탐을 만든다)
EXEMPT_DIRS = {"templates", "script", "personal-private"}
# 카탈로그·이력 파일 — 고아 검사 제외
EXEMPT_STEMS = {"index", "log", "CLAUDE"}
# 정책 콘텐츠 페이지 — 구현 문서 링크 금지 대상
CONTENT_DIRS = {"concepts", "entities", "sources"}
CONTENT_STEMS = {"overview", "open-questions"}
# 구현 문서 트리(플랫폼별). 정책 위키는 이쪽을 링크하지 않는다.
IMPL_PREFIXES = ("parfait/",)

LINK = re.compile(r"\[\[([^\]|#]+)(?:[|#][^\]]*)?\]\]")
COMMENT = re.compile(r"<!--.*?-->", re.S)  # 템플릿·주석 블록의 플레이스홀더는 링크가 아니다
FENCE = re.compile(r"```.*?```", re.S)     # 코드 펜스 안 예시도 실제 링크가 아니다
SENSITIVE = {
    "email": r"[\w.+-]+@[\w-]+\.[\w.]+",
    "phone": r"01[016-9][-\s.]?\d{3,4}[-\s.]?\d{4}",
    "credential": r"(?i)(api[_-]?key|secret|password|token)\s*[:=]\s*[\"']?[A-Za-z0-9_\-]{16,}",
    "jwt": r"eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}",
    "resident_id": r"\d{6}[-]\d{7}",
    "abs_path": r"/Users/[a-z]+",
}

violations, notes = [], []


def nfc(s):
    return unicodedata.normalize("NFC", str(s))


def exempt(p):
    return bool(EXEMPT_DIRS & set(p.parts))


def frontmatter(p):
    lines = p.read_text(encoding="utf-8").split("\n")
    if lines[0].strip() != "---":
        return None, lines
    end = next((i for i, l in enumerate(lines[1:], 1) if l.strip() == "---"), None)
    if end is None:
        return None, lines
    return "\n".join(lines[1:end]), lines


def text(p):
    """주석 블록·코드 펜스를 제거한 본문 — 링크 검사는 항상 이걸 쓴다."""
    return FENCE.sub("", COMMENT.sub("", p.read_text(encoding="utf-8")))


def body(p):
    t = text(p)
    parts = t.split("---", 2)
    return parts[2] if t.startswith("---") and len(parts) > 2 else t


files = [p for p in ROOT.rglob("*.md") if not exempt(p)]
names = {nfc(p.stem): p for p in files}
src_stems = {nfc(p.stem) for p in (ROOT / "sources").glob("*.md")}

# ── 1. 민감 데이터 ─────────────────────────────────────────────
for p in files:
    for i, line in enumerate(p.read_text(encoding="utf-8").split("\n"), 1):
        for kind, pat in SENSITIVE.items():
            if re.search(pat, line):
                violations.append(f"[민감데이터/{kind}] {p}:{i} — {line.strip()[:80]}")

# ── 2. frontmatter 필수 필드 ──────────────────────────────────
for p in files:
    if p.stem in ("CLAUDE", "log"):
        continue
    fm, _ = frontmatter(p)
    if fm is None:
        violations.append(f"[frontmatter] {p} — frontmatter 없음")
        continue
    miss = [k for k in ("tags", "updated") if not re.search(rf"^{k}:", fm, re.M)]
    if p.parent.name in CONTENT_DIRS and not re.search(r"^sources:", fm, re.M):
        miss.append("sources")
    if miss:
        violations.append(f"[frontmatter] {p} — {', '.join(miss)} 누락")

# ── 3. 링크 무결성 + 의존 방향 ────────────────────────────────
inbound = defaultdict(set)
for p in files:
    is_content = p.parent.name in CONTENT_DIRS or p.stem in CONTENT_STEMS
    is_report = p.parent.name == "synthesis" and p.stem.startswith("lint-")
    for m in LINK.finditer(text(p)):
        tgt = nfc(m.group(1).strip())
        if tgt.startswith(IMPL_PREFIXES):
            # 정책 → 구현 링크: 콘텐츠 페이지에서는 금지, index 허브만 허용
            if is_content:
                violations.append(
                    f"[의존방향] {p} → [[{tgt}]] — 정책 페이지가 구현 문서를 링크. "
                    f"플랫폼 종속이 생긴다. 플랫폼+심볼을 데이터로 적을 것")
            elif p.stem != "index":
                notes.append(f"[의존방향/참고] {p} → [[{tgt}]]")
            if not pathlib.Path(f"{tgt}.md").exists():
                violations.append(f"[깨진링크] {p} → [[{tgt}]] (대상 파일 없음)")
            continue
        base = tgt.split("/")[-1]
        if base in names:
            inbound[base].add(nfc(p.stem))
        elif is_content or p.stem == "index":
            violations.append(f"[깨진링크] {p} → [[{tgt}]]")
        elif not is_report and p.stem != "CLAUDE":
            notes.append(f"[깨진링크/참고] {p} → [[{tgt}]]")

# ── 4. 고아·약연결 ────────────────────────────────────────────
for n, p in sorted(names.items()):
    if p.stem in EXEMPT_STEMS:
        continue
    deg = len(inbound[n] - {n})
    if deg == 0:
        violations.append(f"[고아] {p} — 인바운드 0")
    elif deg == 1:
        notes.append(f"[약연결] {p} — 인바운드 1건({next(iter(inbound[n]))})")

# ── 5. raw ↔ sources 정합 (유니코드 정규화 필수) ──────────────
raw_stems = {nfc(p.stem) for p in RAW.glob("*.md")}
for miss in sorted(raw_stems - src_stems):
    violations.append(f"[raw정합] raw/{miss}.md — ingest 안 됨(sources 페이지 없음)")
for extra in sorted(src_stems - raw_stems):
    violations.append(f"[raw정합] wiki/sources/{extra}.md — 대응 raw 원본 없음")
for p in (ROOT / "sources").glob("*.md"):
    fm, _ = frontmatter(p)
    m = re.search(r"^sources:\s*\[(.*?)\]", fm or "", re.M)
    for f in [x.strip() for x in (m.group(1).split(",") if m else []) if x.strip()]:
        if nfc(f) not in {nfc(x.name) for x in RAW.glob("*.md")}:
            violations.append(f"[raw정합] {p} — frontmatter가 가리키는 raw/{f} 없음")

# ── 6. 출처 추적(provenance): 본문 인용 ⊆ frontmatter sources ──
for d in CONTENT_DIRS - {"sources"}:
    for p in sorted((ROOT / d).glob("*.md")):
        fm, _ = frontmatter(p)
        m = re.search(r"^sources:\s*\[(.*?)\]", fm or "", re.M)
        declared = {nfc(x.strip()).removesuffix(".md")
                    for x in (m.group(1).split(",") if m else []) if x.strip()}
        cited = {nfc(x.group(1).strip()) for x in LINK.finditer(body(p))} & src_stems
        for miss in sorted(cited - declared):
            violations.append(
                f"[출처추적] {p} — 본문이 [[{miss}]]를 인용하나 frontmatter sources에 없음")

# ── 7. 판본 상태(status) ──────────────────────────────────────
r = subprocess.run([sys.executable, str(SCRIPT_DIR / "check-status.py")],
                   capture_output=True, text=True)
status_out = (r.stdout + r.stderr).strip()
if r.returncode != 0 or "위반 0건" not in status_out:
    violations.append(f"[status] check-status.py 위반:\n{status_out}")

# ── 출력 ──────────────────────────────────────────────────────
print(f"검사 대상 {len(files)}건 (templates·script·personal-private 제외)")
print(f"status: {status_out.splitlines()[-1] if status_out else 'n/a'}\n")
if violations:
    print(f"## 위반 {len(violations)}건")
    print("\n".join(f"- {v}" for v in violations))
else:
    print("## 위반 0건")
if notes:
    print(f"\n## 참고 {len(notes)}건 (판단 필요, 위반 아님)")
    print("\n".join(f"- {n}" for n in notes))
print("\n> 모순 감지·해소분 하류 반영·데이터 공백·stale 서술은 기계 검사 밖 — 사람/LLM이 읽어야 한다.")
sys.exit(1 if violations else 0)
