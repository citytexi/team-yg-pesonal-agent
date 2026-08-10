#!/usr/bin/env python3
"""open-questions 문서를 GitHub 이슈로 단방향 투영한다.

용법:
    python3 parfait/script/oq_sync.py assign-ids [--check]
    python3 parfait/script/oq_sync.py plan [--out PATH]
    python3 parfait/script/oq_sync.py apply PATH [--limit N]

규약:
- stdlib 전용(pip 의존성 0).
- repo 루트 = Path(__file__).resolve().parents[2] 기준 상대 경로.
- 정본은 문서다. 이슈 → 문서 역방향 반영은 하지 않는다.
"""
import hashlib
import re
from pathlib import Path

REPO_ROOT = Path(__file__).resolve().parents[2]

# (계열, repo 루트 기준 문서 경로)
DOCS = [
    ("W", "wiki/synthesis/open-questions.md"),
    ("P", "parfait/synthesis/open-questions.md"),
]

HEADING_RE = re.compile(r"^### \[(\d{4}-\d{2}-\d{2})\]\s+(.+?)\s*$", re.M)
# ID 줄은 줄바꿈까지 함께 잡아 제거 시 빈 줄이 남지 않게 한다.
ID_LINE_RE = re.compile(r"^- \*\*ID\*\*:\s*(OQ-[WP]-\d+)[ \t]*\n?", re.M)
STATUS_RE = re.compile(r"^- \*\*상태\*\*:\s*(.+?)\s*$", re.M)
COMMENT_RE = re.compile(r"<!--.*?-->", re.S)


def strip_html_comments(text):
    """HTML 주석을 공백으로 치환한다 — 길이와 줄 수를 보존한다.

    문서 말미의 '항목 추가 형식' 예시가 유령 항목으로 잡히는 것을 막는다.
    길이를 보존하는 이유: assign-ids가 원본 텍스트의 오프셋에 삽입하기 때문.
    """

    def repl(m):
        return "".join("\n" if ch == "\n" else " " for ch in m.group(0))

    return COMMENT_RE.sub(repl, text)


def field(body, name):
    """`- **name**: 값`에서 값을 뽑는다. 없으면 빈 문자열."""
    m = re.search(r"^- \*\*" + re.escape(name) + r"\*\*:\s*(.+?)\s*$", body, re.M)
    return m.group(1).strip() if m else ""


def parse_doc(text, series, doc_path):
    """문서 텍스트에서 미결 항목 목록을 뽑는다."""
    clean = strip_html_comments(text)
    matches = list(HEADING_RE.finditer(clean))
    items = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(clean)
        raw_body = clean[m.end() : end]
        id_m = ID_LINE_RE.search(raw_body)
        stripped = ID_LINE_RE.sub("", raw_body)
        # 줄 끝 공백 제거(주석 치환이 남긴 공백 포함) 후 앞뒤 빈 줄 정리
        body = "\n".join(ln.rstrip() for ln in stripped.splitlines()).strip("\n")
        st = STATUS_RE.search(body)
        items.append(
            {
                "series": series,
                "doc": doc_path,
                "date": m.group(1),
                "title": m.group(2),
                "heading_text": m.group(0).strip(),
                "oq_id": id_m.group(1) if id_m else None,
                "body": body,
                "status": st.group(1).strip() if st else "",
            }
        )
    return items


def item_hash(body):
    """항목 본문의 정규화 해시. 줄 끝 공백·빈 줄에는 불변, 내용 변경에는 가변."""
    lines = [ln.rstrip() for ln in body.splitlines()]
    lines = [ln for ln in lines if ln]
    joined = "\n".join(lines)
    return hashlib.sha256(joined.encode("utf-8")).hexdigest()[:12]


def github_anchor(heading_text):
    """GitHub 헤딩 slug. 문서 내부에서 쓰이는 앵커와 같은 결과를 낸다."""
    t = heading_text.lstrip("#").strip().lower()
    t = "".join(ch for ch in t if ch.isalnum() or ch in " -_")
    return t.replace(" ", "-")


def classify(status):
    """문서 상태 서술을 이슈 액션용 분류로 접는다.

    평가 순서가 중요하다 — '미해결 (부분 해소 …)'처럼 접두는 미해결이지만
    부분 해소인 항목이 실재한다.
    """
    s = status.strip()
    if s.startswith("해소됨"):
        return "resolved"
    if "부분 해소" in s:
        return "partial"
    if s.startswith("보류"):
        return "blocked"
    return "open"
