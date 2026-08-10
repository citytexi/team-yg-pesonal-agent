# open-questions → GitHub 이슈 동기화 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `wiki/synthesis/open-questions.md`·`parfait/synthesis/open-questions.md`의 미결 항목을 이 저장소의 GitHub 이슈로 단방향 투영하고, 반복 실행으로 현행화하는 도구를 만든다.

**Architecture:** 결정적 로직은 전부 `parfait/script/oq_sync.py`(stdlib 전용)에 넣고, 스킬은 게이트와 보고만 담당한다. 문서 항목에 불변 ID(`OQ-W-###`/`OQ-P-###`)를 부여해 이슈와 짝짓고, 이슈 본문의 숨김 마커(`oq-id`/`oq-hash`)로 delta를 판정한다. `plan`(읽기 전용)과 `apply`(쓰기)를 별도 서브커맨드로 분리해 dry-run 게이트를 스크립트 구조가 강제한다.

**Tech Stack:** Python 3 stdlib(`re`·`hashlib`·`json`·`argparse`·`subprocess`·`unittest`), `gh` CLI, GitHub Issue Forms(YAML).

**Spec:** [`docs/superpowers/specs/2026-08-10-open-questions-github-issue-sync-design.md`](../specs/2026-08-10-open-questions-github-issue-sync-design.md)

## Global Constraints

- **stdlib 전용.** pip 의존성 0. `parfait/script/README.md` 규약.
- **repo 루트 = `Path(__file__).resolve().parents[2]`.** 절대경로 하드코딩 금지.
- 테스트는 같은 디렉토리 `parfait/script/test_oq_sync.py`, stdlib `unittest`.
  실행: `python3 -m unittest discover -s parfait/script -t parfait/script -v`
- **문서가 정본.** 이슈 → 문서 역방향 반영은 구현하지 않는다.
- **투영 범위는 전량 미러.** 문서 상태가 `해소됨`으로 시작하지 않는 모든 항목을 이슈로 만든다. `보류`·`부분 해소`도 만든다.
- **`gh`는 `plan`에서 읽기만, `apply`에서만 쓴다.** 순수 함수는 `gh`를 호출하지 않는다(테스트 가능성).
- 이슈 생성 대상 저장소는 이 repo 하나(`citytexi/team-yg-pesonal-agent`). TJYG-Android에 만들지 않는다.
- 커밋은 브랜치에서. `main` 직접 커밋 금지. push·PR·이슈 쓰기는 사용자 확인 후(`CLAUDE.md`).
- 코드 주석·문서는 한국어. 기존 `parfait/script/*.py` 스타일을 따른다.

---

### Task 1: 문서 파서

**Files:**
- Create: `parfait/script/oq_sync.py`
- Test: `parfait/script/test_oq_sync.py`

**Interfaces:**
- Consumes: 없음(첫 태스크)
- Produces:
  - `DOCS: list[tuple[str, str]]` — `[("W", "wiki/synthesis/open-questions.md"), ("P", "parfait/synthesis/open-questions.md")]`
  - `strip_html_comments(text: str) -> str` — HTML 주석을 **길이·줄 수 보존**하며 공백으로 치환
  - `parse_doc(text: str, series: str, doc_path: str) -> list[dict]` — 항목 dict 목록.
    dict 키: `series`, `doc`, `date`, `title`, `heading_text`, `oq_id`(없으면 `None`), `body`, `status`
  - `field(body: str, name: str) -> str` — `- **이름**: 값`에서 값 추출, 없으면 `""`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`parfait/script/test_oq_sync.py`를 새로 만든다:

```python
import unittest

import oq_sync


DOC = """---
tags: [meta]
---
# Open Questions

설명 문단.

---

### [2026-07-10] YGButton 디자인 토큰 규칙 미확정
- **출처**: `component/ygbutton/YGButtonType.kt` — 값 잠정.
- **항목**: ① 시맨틱 계층 정리, ② 토큰 매핑 확정.
- **상태**: 미해결
- **해소 메모**: 규칙 확정 시 반영.

### [2026-07-12] BitmapWrapper stub
- **ID**: OQ-P-007
- **출처 A**: `core/util/jvm` — 멤버 없음.
- **출처 B**: `core/util/android` — delegate 미사용.
- **상태**: 해소됨 (2026-08-04, PR #190 develop 머지)
- **해소 메모**: 계약 확정.

<!--
항목 추가 형식:

### [YYYY-MM-DD] [주제 요약]
- **출처**: `경로/파일` — 근거
- **상태**: 미해결 | 해소됨 | 보류
-->
"""


class ParseTest(unittest.TestCase):
    def test_html_comment_example_is_not_an_item(self):
        items = oq_sync.parse_doc(DOC, "P", "parfait/synthesis/open-questions.md")
        self.assertEqual(len(items), 2)
        self.assertNotIn("[주제 요약]", [i["title"] for i in items])

    def test_strip_html_comments_preserves_offsets(self):
        text = "a\n<!-- xx\nyy -->\nb\n"
        out = oq_sync.strip_html_comments(text)
        self.assertEqual(len(out), len(text))
        self.assertEqual(out.count("\n"), text.count("\n"))
        self.assertNotIn("xx", out)

    def test_heading_fields(self):
        items = oq_sync.parse_doc(DOC, "P", "parfait/synthesis/open-questions.md")
        first = items[0]
        self.assertEqual(first["date"], "2026-07-10")
        self.assertEqual(first["title"], "YGButton 디자인 토큰 규칙 미확정")
        self.assertEqual(first["series"], "P")
        self.assertEqual(first["doc"], "parfait/synthesis/open-questions.md")
        self.assertIsNone(first["oq_id"])
        self.assertEqual(first["status"], "미해결")

    def test_existing_id_is_read_and_removed_from_body(self):
        items = oq_sync.parse_doc(DOC, "P", "parfait/synthesis/open-questions.md")
        second = items[1]
        self.assertEqual(second["oq_id"], "OQ-P-007")
        self.assertNotIn("**ID**", second["body"])
        self.assertTrue(second["body"].startswith("- **출처 A**:"))

    def test_multiple_source_fields_preserved(self):
        items = oq_sync.parse_doc(DOC, "P", "parfait/synthesis/open-questions.md")
        body = items[1]["body"]
        self.assertIn("출처 A", body)
        self.assertIn("출처 B", body)

    def test_status_with_parenthetical_is_kept_whole(self):
        items = oq_sync.parse_doc(DOC, "P", "parfait/synthesis/open-questions.md")
        self.assertEqual(
            items[1]["status"], "해소됨 (2026-08-04, PR #190 develop 머지)"
        )

    def test_field_helper(self):
        items = oq_sync.parse_doc(DOC, "P", "parfait/synthesis/open-questions.md")
        self.assertEqual(oq_sync.field(items[0]["body"], "해소 메모"), "규칙 확정 시 반영.")
        self.assertEqual(oq_sync.field(items[0]["body"], "없는필드"), "")


if __name__ == "__main__":
    unittest.main()
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `python3 -m unittest discover -s parfait/script -t parfait/script -v`
Expected: FAIL — `ModuleNotFoundError: No module named 'oq_sync'`

- [ ] **Step 3: 최소 구현을 쓴다**

`parfait/script/oq_sync.py`를 새로 만든다:

```python
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
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `python3 -m unittest discover -s parfait/script -t parfait/script -v`
Expected: PASS — 7 tests

- [ ] **Step 5: 커밋한다**

```bash
git add parfait/script/oq_sync.py parfait/script/test_oq_sync.py
git commit -m "feat(oq-sync): open-questions 문서 파서"
```

---

### Task 2: 해시·앵커·상태 판정

**Files:**
- Modify: `parfait/script/oq_sync.py`
- Test: `parfait/script/test_oq_sync.py`

**Interfaces:**
- Consumes: Task 1의 `parse_doc`, 항목 dict의 `body`·`status`·`heading_text`
- Produces:
  - `item_hash(body: str) -> str` — 정규화 후 SHA-256 앞 12자(hex)
  - `github_anchor(heading_text: str) -> str` — GitHub 헤딩 slug
  - `classify(status: str) -> str` — `"resolved"` | `"partial"` | `"blocked"` | `"open"`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`parfait/script/test_oq_sync.py` 끝의 `if __name__` 블록 **앞에** 추가한다:

```python
class HashTest(unittest.TestCase):
    BODY = "- **출처**: 가\n- **상태**: 미해결\n"

    def test_trailing_whitespace_does_not_change_hash(self):
        self.assertEqual(
            oq_sync.item_hash(self.BODY),
            oq_sync.item_hash("- **출처**: 가   \n- **상태**: 미해결\t\n"),
        )

    def test_blank_lines_do_not_change_hash(self):
        self.assertEqual(
            oq_sync.item_hash(self.BODY),
            oq_sync.item_hash("- **출처**: 가\n\n\n- **상태**: 미해결\n"),
        )

    def test_content_change_changes_hash(self):
        self.assertNotEqual(
            oq_sync.item_hash(self.BODY),
            oq_sync.item_hash("- **출처**: 나\n- **상태**: 미해결\n"),
        )

    def test_hash_is_twelve_hex_chars(self):
        h = oq_sync.item_hash(self.BODY)
        self.assertEqual(len(h), 12)
        self.assertRegex(h, r"^[0-9a-f]{12}$")


class AnchorTest(unittest.TestCase):
    def test_matches_anchor_used_in_parfait_doc(self):
        self.assertEqual(
            oq_sync.github_anchor("### [2026-08-01] 카메라 줌 UI가 死코드로 남음"),
            "2026-08-01-카메라-줌-ui가-死코드로-남음",
        )

    def test_punctuation_removed_and_hyphen_kept(self):
        self.assertEqual(
            oq_sync.github_anchor("### [2026-07-10] YGButton `토큰`·규칙 (미확정)"),
            "2026-07-10-ygbutton-토큰규칙-미확정",
        )


class ClassifyTest(unittest.TestCase):
    def test_resolved_prefix(self):
        self.assertEqual(oq_sync.classify("해소됨 (2026-08-04, PR #190)"), "resolved")

    def test_partial_beats_unresolved_prefix(self):
        self.assertEqual(
            oq_sync.classify("미해결 (부분 해소 — ⑤ 확정, 금칙어만 잔존)"), "partial"
        )

    def test_partial_with_bold_markers(self):
        self.assertEqual(
            oq_sync.classify("**부분 해소** (공백은 메웠고 구조는 미해결)"), "partial"
        )

    def test_blocked_prefix(self):
        self.assertEqual(oq_sync.classify("보류 (원격 연동 이후)"), "blocked")

    def test_default_is_open(self):
        self.assertEqual(oq_sync.classify("미해결"), "open")
        self.assertEqual(oq_sync.classify(""), "open")
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `python3 -m unittest discover -s parfait/script -t parfait/script -v`
Expected: FAIL — `AttributeError: module 'oq_sync' has no attribute 'item_hash'`

- [ ] **Step 3: 구현을 쓴다**

`parfait/script/oq_sync.py`의 `import re` 다음 줄에 `import hashlib`을 추가하고(알파벳 순: `hashlib` → `re`), `parse_doc` 아래에 붙인다:

```python
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
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `python3 -m unittest discover -s parfait/script -t parfait/script -v`
Expected: PASS — 18 tests

- [ ] **Step 5: 커밋한다**

```bash
git add parfait/script/oq_sync.py parfait/script/test_oq_sync.py
git commit -m "feat(oq-sync): 해시·앵커·상태 판정 유틸"
```

---

### Task 3: ID 부여(`assign-ids`)

**Files:**
- Modify: `parfait/script/oq_sync.py`
- Test: `parfait/script/test_oq_sync.py`

**Interfaces:**
- Consumes: Task 1의 `strip_html_comments`·`HEADING_RE`·`ID_LINE_RE`
- Produces:
  - `next_counter(text: str, series: str) -> int` — 다음 채번 값
  - `assign_ids(text: str, series: str) -> tuple[str, list[tuple[str, str]]]` — `(새 텍스트, [(oq_id, 제목), ...])`
  - 모듈 상수 `NEXT_RE` — `<!-- oq-next: N -->` 마커 정규식

번호 재사용 금지를 위해 문서 말미에 `<!-- oq-next: N -->` 하이워터마크를 둔다. 항목이 삭제돼도 그 번호가 새 항목에 다시 붙지 않는다(닫힌 이슈가 엉뚱한 항목으로 되살아나는 사고 방지).

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`if __name__` 블록 앞에 추가한다:

```python
class AssignIdsTest(unittest.TestCase):
    DOC = (
        "# Open Questions\n\n"
        "### [2026-07-10] 가\n"
        "- **상태**: 미해결\n\n"
        "### [2026-07-12] 나\n"
        "- **ID**: OQ-P-007\n"
        "- **상태**: 미해결\n"
    )

    def test_assigns_from_max_plus_one(self):
        out, assigned = oq_sync.assign_ids(self.DOC, "P")
        self.assertEqual(assigned, [("OQ-P-008", "가")])
        self.assertIn("### [2026-07-10] 가\n- **ID**: OQ-P-008\n", out)

    def test_heading_unchanged(self):
        out, _ = oq_sync.assign_ids(self.DOC, "P")
        self.assertIn("### [2026-07-10] 가\n", out)
        self.assertIn("### [2026-07-12] 나\n", out)

    def test_idempotent(self):
        once, _ = oq_sync.assign_ids(self.DOC, "P")
        twice, assigned = oq_sync.assign_ids(once, "P")
        self.assertEqual(once, twice)
        self.assertEqual(assigned, [])

    def test_writes_high_water_marker(self):
        out, _ = oq_sync.assign_ids(self.DOC, "P")
        self.assertIn("<!-- oq-next: 9 -->", out)

    def test_deleted_id_number_is_not_reused(self):
        out, _ = oq_sync.assign_ids(self.DOC, "P")
        # OQ-P-008 항목을 통째로 지운 뒤 새 항목을 붙인다
        shrunk = out.replace("### [2026-07-10] 가\n- **ID**: OQ-P-008\n- **상태**: 미해결\n\n", "")
        shrunk += "\n### [2026-07-20] 다\n- **상태**: 미해결\n"
        out2, assigned = oq_sync.assign_ids(shrunk, "P")
        self.assertEqual(assigned, [("OQ-P-009", "다")])

    def test_starts_at_one_when_empty(self):
        doc = "# X\n\n### [2026-01-01] 첫\n- **상태**: 미해결\n"
        _, assigned = oq_sync.assign_ids(doc, "W")
        self.assertEqual(assigned, [("OQ-W-001", "첫")])

    def test_comment_example_gets_no_id(self):
        doc = (
            "### [2026-01-01] 진짜\n- **상태**: 미해결\n\n"
            "<!--\n### [YYYY-MM-DD] [주제 요약]\n- **상태**: 미해결\n-->\n"
        )
        out, assigned = oq_sync.assign_ids(doc, "W")
        self.assertEqual(len(assigned), 1)
        self.assertNotIn("**ID**", out.split("<!--")[1])
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `python3 -m unittest discover -s parfait/script -t parfait/script -v`
Expected: FAIL — `AttributeError: module 'oq_sync' has no attribute 'assign_ids'`

- [ ] **Step 3: 구현을 쓴다**

`COMMENT_RE` 선언 아래에 상수를 추가한다:

```python
NEXT_RE = re.compile(r"<!--\s*oq-next:\s*(\d+)\s*-->")
```

`classify` 아래에 붙인다:

```python
def next_counter(text, series):
    """다음 채번 값. 문서 내 최대 ID+1과 하이워터마크 중 큰 쪽."""
    clean = strip_html_comments(text)
    used = [int(m.group(1)) for m in re.finditer(r"OQ-" + series + r"-(\d+)", clean)]
    hi = max(used) + 1 if used else 1
    m = NEXT_RE.search(text)
    if m:
        hi = max(hi, int(m.group(1)))
    return hi


def _write_next_marker(text, counter):
    marker = "<!-- oq-next: %d -->" % counter
    if NEXT_RE.search(text):
        return NEXT_RE.sub(marker, text)
    return text.rstrip("\n") + "\n\n" + marker + "\n"


def assign_ids(text, series):
    """ID 없는 항목에 번호를 부여한다. 멱등 — 이미 있는 ID는 건드리지 않는다."""
    clean = strip_html_comments(text)
    counter = next_counter(text, series)
    matches = list(HEADING_RE.finditer(clean))
    pieces = []
    cursor = 0
    assigned = []
    for i, m in enumerate(matches):
        end = matches[i + 1].start() if i + 1 < len(matches) else len(clean)
        if ID_LINE_RE.search(clean[m.end() : end]):
            continue
        oq_id = "OQ-%s-%03d" % (series, counter)
        counter += 1
        pieces.append(text[cursor : m.end()])
        pieces.append("\n- **ID**: " + oq_id)
        cursor = m.end()
        assigned.append((oq_id, m.group(2)))
    pieces.append(text[cursor:])
    out = "".join(pieces)
    return _write_next_marker(out, counter), assigned
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `python3 -m unittest discover -s parfait/script -t parfait/script -v`
Expected: PASS — 25 tests

- [ ] **Step 5: 커밋한다**

```bash
git add parfait/script/oq_sync.py parfait/script/test_oq_sync.py
git commit -m "feat(oq-sync): 안정 ID 부여(멱등·번호 미재사용)"
```

---

### Task 4: 이슈 제목·본문·라벨 렌더링

**Files:**
- Modify: `parfait/script/oq_sync.py`
- Test: `parfait/script/test_oq_sync.py`

**Interfaces:**
- Consumes: Task 1~2의 항목 dict, `item_hash`, `github_anchor`, `classify`
- Produces:
  - `SERIES_LABEL: dict[str, str]`, `STATE_LABEL: dict[str, str]`, `LABEL_SPECS: list[dict]`
  - `issue_title(item: dict) -> str`
  - `issue_body(item: dict, repo: str) -> str`
  - `labels_for(item: dict) -> list[str]`
  - `marker(body: str, name: str) -> str` — 이슈 본문에서 `<!-- name: 값 -->` 추출, 없으면 `""`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`if __name__` 블록 앞에 추가한다:

```python
class RenderTest(unittest.TestCase):
    ITEM = {
        "series": "P",
        "doc": "parfait/synthesis/open-questions.md",
        "date": "2026-07-10",
        "title": "YGButton `토큰` 규칙 **미확정**",
        "heading_text": "### [2026-07-10] YGButton 토큰 규칙 미확정",
        "oq_id": "OQ-P-001",
        "body": "- **출처**: 가\n- **상태**: 미해결",
        "status": "미해결",
    }

    def test_title_has_id_prefix_and_no_inline_markdown(self):
        self.assertEqual(
            oq_sync.issue_title(self.ITEM), "[OQ-P-001] YGButton 토큰 규칙 미확정"
        )

    def test_title_truncated_at_256(self):
        item = dict(self.ITEM, title="가" * 400)
        t = oq_sync.issue_title(item)
        self.assertLessEqual(len(t), 256)
        self.assertTrue(t.endswith("…"))

    def test_body_has_three_markers(self):
        body = oq_sync.issue_body(self.ITEM, "citytexi/team-yg-pesonal-agent")
        self.assertIn("<!-- oq-id: OQ-P-001 -->", body)
        self.assertIn("<!-- oq-hash: %s -->" % oq_sync.item_hash(self.ITEM["body"]), body)
        self.assertIn("<!-- oq-source: parfait/synthesis/open-questions.md -->", body)

    def test_body_has_absolute_permalink_with_anchor(self):
        body = oq_sync.issue_body(self.ITEM, "citytexi/team-yg-pesonal-agent")
        self.assertIn(
            "https://github.com/citytexi/team-yg-pesonal-agent/blob/main/"
            "parfait/synthesis/open-questions.md#2026-07-10-ygbutton-토큰-규칙-미확정",
            body,
        )

    def test_body_carries_source_text_verbatim(self):
        body = oq_sync.issue_body(self.ITEM, "o/r")
        self.assertIn("- **출처**: 가", body)
        self.assertIn("- **상태**: 미해결", body)

    def test_body_states_document_is_source_of_truth(self):
        body = oq_sync.issue_body(self.ITEM, "o/r")
        self.assertIn("정본은 문서다", body)

    def test_labels(self):
        self.assertEqual(oq_sync.labels_for(self.ITEM), ["oq:parfait", "oq:open"])
        blocked = dict(self.ITEM, status="보류 (원격 연동 이후)")
        self.assertEqual(oq_sync.labels_for(blocked), ["oq:parfait", "oq:blocked"])
        wiki = dict(self.ITEM, series="W", status="해소됨 (2026-08-04)")
        self.assertEqual(oq_sync.labels_for(wiki), ["oq:wiki", "oq:resolved"])

    def test_marker_roundtrip(self):
        body = oq_sync.issue_body(self.ITEM, "o/r")
        self.assertEqual(oq_sync.marker(body, "oq-id"), "OQ-P-001")
        self.assertEqual(oq_sync.marker(body, "없음"), "")

    def test_label_specs_cover_every_label(self):
        names = {spec["name"] for spec in oq_sync.LABEL_SPECS}
        self.assertEqual(
            names,
            set(oq_sync.SERIES_LABEL.values()) | set(oq_sync.STATE_LABEL.values()),
        )
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `python3 -m unittest discover -s parfait/script -t parfait/script -v`
Expected: FAIL — `AttributeError: module 'oq_sync' has no attribute 'issue_title'`

- [ ] **Step 3: 구현을 쓴다**

`NEXT_RE` 아래에 상수를 추가한다:

```python
SERIES_LABEL = {"W": "oq:wiki", "P": "oq:parfait"}
STATE_LABEL = {
    "open": "oq:open",
    "partial": "oq:partial",
    "blocked": "oq:blocked",
    "resolved": "oq:resolved",
}
LABEL_SPECS = [
    {"name": "oq:wiki", "color": "0075ca", "desc": "정책·기획 미결(wiki open-questions)"},
    {"name": "oq:parfait", "color": "5319e7", "desc": "구현·계약 미결(parfait open-questions)"},
    {"name": "oq:open", "color": "d73a4a", "desc": "미결"},
    {"name": "oq:partial", "color": "fbca04", "desc": "부분 해소 — 잔존 항목 있음"},
    {"name": "oq:blocked", "color": "cfd3d7", "desc": "보류"},
    {"name": "oq:resolved", "color": "0e8a16", "desc": "해소됨"},
]
TITLE_LIMIT = 256
SOT_NOTE = "> 정본은 문서다. 이 이슈는 투영이며, 여기서 본문을 고쳐도 다음 동기화에 덮어써진다."
```

`assign_ids` 아래에 붙인다:

```python
def marker(body, name):
    """이슈 본문의 `<!-- name: 값 -->` 마커를 읽는다."""
    m = re.search(r"<!--\s*" + re.escape(name) + r":\s*(.+?)\s*-->", body or "")
    return m.group(1).strip() if m else ""


def issue_title(item):
    t = re.sub(r"[`*]", "", item["title"]).strip()
    prefix = "[%s] " % item["oq_id"]
    limit = TITLE_LIMIT - len(prefix)
    if len(t) > limit:
        t = t[: limit - 1] + "…"
    return prefix + t


def issue_body(item, repo):
    url = "https://github.com/%s/blob/main/%s#%s" % (
        repo,
        item["doc"],
        github_anchor(item["heading_text"]),
    )
    return "\n".join(
        [
            "<!-- oq-id: %s -->" % item["oq_id"],
            "<!-- oq-hash: %s -->" % item_hash(item["body"]),
            "<!-- oq-source: %s -->" % item["doc"],
            "",
            SOT_NOTE,
            "> 원본: [%s](%s)" % (item["doc"], url),
            "",
            "**발견일**: %s" % item["date"],
            "",
            item["body"],
            "",
        ]
    )


def labels_for(item):
    return [SERIES_LABEL[item["series"]], STATE_LABEL[classify(item["status"])]]
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `python3 -m unittest discover -s parfait/script -t parfait/script -v`
Expected: PASS — 34 tests

- [ ] **Step 5: 커밋한다**

```bash
git add parfait/script/oq_sync.py parfait/script/test_oq_sync.py
git commit -m "feat(oq-sync): 이슈 제목·본문·라벨 렌더링"
```

---

### Task 5: 계획 산출(`plan`)

**Files:**
- Modify: `parfait/script/oq_sync.py`
- Test: `parfait/script/test_oq_sync.py`

**Interfaces:**
- Consumes: Task 1~4 전부
- Produces:
  - `build_plan(items: list[dict], issues: list[dict], repo: str) -> dict` — **순수 함수. `gh`를 호출하지 않는다.**
    반환: `{"repo": str, "summary": dict, "actions": list[dict]}`
  - `render_plan_table(plan: dict) -> str` — 사람이 읽는 요약 표
  - `gh(args: list[str], input_: str | None = None) -> str` — `gh` CLI 래퍼(여기서 정의만, `plan`에서는 조회에만 사용)
  - `fetch_issues() -> list[dict]`, `current_repo() -> str`

액션 dict 공통 키: `action`, `oq_id`. 액션별 추가 키:
- `create`: `title`, `body`, `labels`
- `update`·`reopen`: `issue`, `title`, `body`, `add_labels`, `remove_labels`
- `close`: `issue`, `comment`, `add_labels`, `remove_labels`, `title`, `body`
- `orphan`·`unmanaged`: `issue`, `title`

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`if __name__` 블록 앞에 추가한다:

```python
def _item(oq_id, status="미해결", body="- **상태**: 미해결", series="P"):
    return {
        "series": series,
        "doc": "parfait/synthesis/open-questions.md",
        "date": "2026-07-10",
        "title": "제목 " + oq_id,
        "heading_text": "### [2026-07-10] 제목 " + oq_id,
        "oq_id": oq_id,
        "body": body,
        "status": status,
    }


def _issue(number, oq_id, hash_, state="OPEN", labels=("oq:parfait", "oq:open"), title=None):
    return {
        "number": number,
        "title": title or ("[%s] 제목 %s" % (oq_id, oq_id)),
        "body": "<!-- oq-id: %s -->\n<!-- oq-hash: %s -->\n본문" % (oq_id, hash_),
        "state": state,
        "labels": [{"name": n} for n in labels],
    }


class BuildPlanTest(unittest.TestCase):
    REPO = "citytexi/team-yg-pesonal-agent"

    def test_new_unresolved_item_creates(self):
        plan = oq_sync.build_plan([_item("OQ-P-001")], [], self.REPO)
        self.assertEqual(plan["summary"]["create"], 1)
        act = plan["actions"][0]
        self.assertEqual(act["action"], "create")
        self.assertEqual(act["labels"], ["oq:parfait", "oq:open"])

    def test_new_resolved_item_is_skipped(self):
        plan = oq_sync.build_plan([_item("OQ-P-001", status="해소됨 (2026-08-04)")], [], self.REPO)
        self.assertEqual(plan["summary"]["create"], 0)
        self.assertEqual(plan["actions"], [])

    def test_same_hash_and_labels_is_noop(self):
        it = _item("OQ-P-001")
        iss = _issue(1, "OQ-P-001", oq_sync.item_hash(it["body"]), title=oq_sync.issue_title(it))
        plan = oq_sync.build_plan([it], [iss], self.REPO)
        self.assertEqual(plan["summary"]["noop"], 1)
        self.assertEqual(plan["actions"], [])

    def test_hash_change_updates(self):
        it = _item("OQ-P-001", body="- **상태**: 미해결\n- **항목**: 새 내용")
        iss = _issue(1, "OQ-P-001", "000000000000", title=oq_sync.issue_title(it))
        plan = oq_sync.build_plan([it], [iss], self.REPO)
        self.assertEqual(plan["summary"]["update"], 1)
        self.assertEqual(plan["actions"][0]["issue"], 1)

    def test_label_change_updates_with_add_and_remove(self):
        it = _item("OQ-P-001", status="보류 (원격 연동 이후)")
        iss = _issue(1, "OQ-P-001", oq_sync.item_hash(it["body"]), title=oq_sync.issue_title(it))
        plan = oq_sync.build_plan([it], [iss], self.REPO)
        act = plan["actions"][0]
        self.assertEqual(act["action"], "update")
        self.assertEqual(act["add_labels"], ["oq:blocked"])
        self.assertEqual(act["remove_labels"], ["oq:open"])

    def test_resolved_item_closes_with_comment(self):
        it = _item(
            "OQ-P-001",
            status="해소됨 (2026-08-04, PR #190)",
            body="- **상태**: 해소됨 (2026-08-04, PR #190)\n- **해소 메모**: 계약 확정.",
        )
        iss = _issue(1, "OQ-P-001", "000000000000")
        plan = oq_sync.build_plan([it], [iss], self.REPO)
        act = plan["actions"][0]
        self.assertEqual(act["action"], "close")
        self.assertIn("계약 확정.", act["comment"])
        self.assertIn("해소됨 (2026-08-04, PR #190)", act["comment"])
        self.assertEqual(act["add_labels"], ["oq:resolved"])

    def test_closed_issue_reopens_when_doc_unresolved(self):
        it = _item("OQ-P-001")
        iss = _issue(1, "OQ-P-001", oq_sync.item_hash(it["body"]), state="CLOSED",
                     labels=("oq:parfait", "oq:resolved"))
        plan = oq_sync.build_plan([it], [iss], self.REPO)
        act = plan["actions"][0]
        self.assertEqual(act["action"], "reopen")
        self.assertEqual(act["add_labels"], ["oq:open"])
        self.assertEqual(act["remove_labels"], ["oq:resolved"])

    def test_closed_and_resolved_is_noop(self):
        it = _item("OQ-P-001", status="해소됨 (2026-08-04)")
        iss = _issue(1, "OQ-P-001", oq_sync.item_hash(it["body"]), state="CLOSED",
                     labels=("oq:parfait", "oq:resolved"))
        plan = oq_sync.build_plan([it], [iss], self.REPO)
        self.assertEqual(plan["actions"], [])

    def test_missing_doc_item_is_orphan_not_closed(self):
        iss = _issue(9, "OQ-P-099", "000000000000")
        plan = oq_sync.build_plan([], [iss], self.REPO)
        self.assertEqual(plan["summary"]["orphan"], 1)
        self.assertEqual(plan["actions"][0]["action"], "orphan")

    def test_issue_without_marker_is_unmanaged(self):
        iss = {"number": 5, "title": "손으로 쓴 이슈", "body": "마커 없음", "state": "OPEN", "labels": []}
        plan = oq_sync.build_plan([], [iss], self.REPO)
        self.assertEqual(plan["summary"]["unmanaged"], 1)
        self.assertEqual(plan["actions"][0]["action"], "unmanaged")

    def test_closed_orphan_is_ignored(self):
        iss = _issue(9, "OQ-P-099", "000000000000", state="CLOSED")
        plan = oq_sync.build_plan([], [iss], self.REPO)
        self.assertEqual(plan["summary"]["orphan"], 0)

    def test_build_plan_never_touches_gh(self):
        def boom(*a, **kw):
            raise AssertionError("plan은 리모트에 쓰지 않는다")

        original = oq_sync.gh
        oq_sync.gh = boom
        try:
            oq_sync.build_plan([_item("OQ-P-001")], [], self.REPO)
        finally:
            oq_sync.gh = original

    def test_render_plan_table_has_counts(self):
        plan = oq_sync.build_plan([_item("OQ-P-001")], [], self.REPO)
        table = oq_sync.render_plan_table(plan)
        self.assertIn("create", table)
        self.assertIn("1", table)
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `python3 -m unittest discover -s parfait/script -t parfait/script -v`
Expected: FAIL — `AttributeError: module 'oq_sync' has no attribute 'build_plan'`

- [ ] **Step 3: 구현을 쓴다**

`import` 블록에 `import json`·`import subprocess`를 추가한다(최종 순서: `hashlib`, `json`, `re`, `subprocess`, `from pathlib import Path`).

`labels_for` 아래에 붙인다:

```python
ACTION_KINDS = ["create", "update", "close", "reopen", "noop", "orphan", "unmanaged"]


def gh(args, input_=None):
    """`gh` CLI 래퍼. 실패하면 stderr를 담아 예외를 던진다."""
    proc = subprocess.run(
        ["gh"] + args, capture_output=True, text=True, input=input_
    )
    if proc.returncode != 0:
        raise RuntimeError("gh %s 실패: %s" % (" ".join(args), (proc.stderr or proc.stdout).strip()))
    return proc.stdout


def current_repo():
    return json.loads(gh(["repo", "view", "--json", "nameWithOwner"]))["nameWithOwner"]


def fetch_issues():
    """이슈 전량을 받아온다.

    `--label`을 여러 번 주면 gh는 AND로 묶어 oq:wiki·oq:parfait 동시 지정 시
    결과가 0건이 된다. 라벨로 거르지 않고 마커로 판별한다.
    """
    out = gh(
        [
            "issue", "list", "--state", "all", "--limit", "1000",
            "--json", "number,title,body,state,labels",
        ]
    )
    return json.loads(out)


def _label_diff(current, wanted):
    """우리가 관리하는 라벨만 대상으로 add/remove를 계산한다."""
    managed = set(SERIES_LABEL.values()) | set(STATE_LABEL.values())
    cur = set(current) & managed
    want = set(wanted)
    return sorted(want - cur), sorted(cur - want)


def build_plan(items, issues, repo):
    """문서 항목과 기존 이슈를 대조해 액션 계획을 만든다. 순수 함수."""
    by_id = {}
    actions = []
    for iss in issues:
        oq_id = marker(iss.get("body") or "", "oq-id")
        if oq_id:
            by_id[oq_id] = iss
        elif (iss.get("state") or "").upper() == "OPEN":
            actions.append(
                {
                    "action": "unmanaged",
                    "oq_id": "",
                    "issue": iss.get("number"),
                    "title": iss.get("title") or "",
                }
            )

    noop = 0
    seen = set()
    for it in items:
        seen.add(it["oq_id"])
        kind = classify(it["status"])
        title = issue_title(it)
        body = issue_body(it, repo)
        wanted = labels_for(it)
        iss = by_id.get(it["oq_id"])

        if iss is None:
            if kind == "resolved":
                continue
            actions.append(
                {
                    "action": "create",
                    "oq_id": it["oq_id"],
                    "title": title,
                    "body": body,
                    "labels": wanted,
                }
            )
            continue

        current = [l.get("name") for l in (iss.get("labels") or [])]
        add, remove = _label_diff(current, wanted)
        stale = (
            marker(iss.get("body") or "", "oq-hash") != item_hash(it["body"])
            or (iss.get("title") or "") != title
        )
        is_open = (iss.get("state") or "").upper() == "OPEN"

        if is_open and kind == "resolved":
            memo = field(it["body"], "해소 메모")
            comment = "문서 상태가 `%s`로 바뀌어 닫는다." % it["status"]
            if memo:
                comment += "\n\n**해소 메모**: " + memo
            actions.append(
                {
                    "action": "close",
                    "oq_id": it["oq_id"],
                    "issue": iss["number"],
                    "comment": comment,
                    "title": title,
                    "body": body,
                    "add_labels": add,
                    "remove_labels": remove,
                }
            )
        elif is_open and (stale or add or remove):
            actions.append(
                {
                    "action": "update",
                    "oq_id": it["oq_id"],
                    "issue": iss["number"],
                    "title": title,
                    "body": body,
                    "add_labels": add,
                    "remove_labels": remove,
                }
            )
        elif not is_open and kind != "resolved":
            actions.append(
                {
                    "action": "reopen",
                    "oq_id": it["oq_id"],
                    "issue": iss["number"],
                    "title": title,
                    "body": body,
                    "add_labels": add,
                    "remove_labels": remove,
                }
            )
        else:
            noop += 1

    for oq_id, iss in by_id.items():
        if oq_id in seen:
            continue
        if (iss.get("state") or "").upper() != "OPEN":
            continue
        actions.append(
            {
                "action": "orphan",
                "oq_id": oq_id,
                "issue": iss["number"],
                "title": iss.get("title") or "",
            }
        )

    summary = {k: 0 for k in ACTION_KINDS}
    summary["noop"] = noop
    for a in actions:
        summary[a["action"]] += 1
    return {"repo": repo, "summary": summary, "actions": actions}


def render_plan_table(plan):
    lines = ["| 액션 | 건수 |", "|---|---|"]
    for k in ACTION_KINDS:
        lines.append("| %s | %d |" % (k, plan["summary"][k]))
    for a in plan["actions"]:
        if a["action"] in ("orphan", "unmanaged"):
            lines.append(
                "- %s: #%s %s" % (a["action"], a.get("issue"), a.get("title", ""))
            )
    return "\n".join(lines)
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `python3 -m unittest discover -s parfait/script -t parfait/script -v`
Expected: PASS — 47 tests

- [ ] **Step 5: 커밋한다**

```bash
git add parfait/script/oq_sync.py parfait/script/test_oq_sync.py
git commit -m "feat(oq-sync): 계획 산출(build_plan) — 읽기 전용 dry-run"
```

---

### Task 6: 실행(`apply`)과 CLI 배선

**Files:**
- Modify: `parfait/script/oq_sync.py`
- Test: `parfait/script/test_oq_sync.py`

**Interfaces:**
- Consumes: Task 5의 계획 dict, `gh`, `LABEL_SPECS`
- Produces:
  - `ensure_labels() -> None`
  - `apply_action(act: dict) -> None`
  - `apply_plan(plan: dict, limit: int | None = None) -> list[tuple[str, str]]` — 실패 목록 `[(oq_id, 메시지), ...]`
  - `read_docs() -> list[dict]` — 두 문서를 읽어 항목 전량 반환(ID 미부여 항목이 있으면 `SystemExit`)
  - `main()` — `assign-ids`·`plan`·`apply` 서브커맨드

- [ ] **Step 1: 실패하는 테스트를 쓴다**

`if __name__` 블록 앞에 추가한다:

```python
class ApplyTest(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self._orig = oq_sync.gh

        def fake(args, input_=None):
            self.calls.append((list(args), input_))
            return "{}"

        oq_sync.gh = fake

    def tearDown(self):
        oq_sync.gh = self._orig

    def _cmds(self):
        return [" ".join(c[0][:3]) for c in self.calls]

    def test_create_calls_issue_create_with_labels(self):
        act = {
            "action": "create",
            "oq_id": "OQ-P-001",
            "title": "[OQ-P-001] 제목",
            "body": "본문",
            "labels": ["oq:parfait", "oq:open"],
        }
        oq_sync.apply_action(act)
        args, input_ = self.calls[0]
        self.assertEqual(args[:2], ["issue", "create"])
        self.assertIn("--label", args)
        self.assertIn("oq:parfait", args)
        self.assertEqual(input_, "본문")

    def test_update_edits_and_swaps_labels(self):
        act = {
            "action": "update",
            "oq_id": "OQ-P-001",
            "issue": 7,
            "title": "T",
            "body": "B",
            "add_labels": ["oq:blocked"],
            "remove_labels": ["oq:open"],
        }
        oq_sync.apply_action(act)
        args, _ = self.calls[0]
        self.assertEqual(args[:3], ["issue", "edit", "7"])
        self.assertIn("--add-label", args)
        self.assertIn("oq:blocked", args)
        self.assertIn("--remove-label", args)
        self.assertIn("oq:open", args)

    def test_close_comments_then_closes(self):
        act = {
            "action": "close",
            "oq_id": "OQ-P-001",
            "issue": 7,
            "comment": "해소",
            "title": "T",
            "body": "B",
            "add_labels": ["oq:resolved"],
            "remove_labels": ["oq:open"],
        }
        oq_sync.apply_action(act)
        cmds = self._cmds()
        self.assertEqual(cmds[0], "issue edit 7")
        self.assertEqual(cmds[1], "issue comment 7")
        self.assertEqual(cmds[2], "issue close 7")

    def test_reopen_reopens_then_edits(self):
        act = {
            "action": "reopen",
            "oq_id": "OQ-P-001",
            "issue": 7,
            "title": "T",
            "body": "B",
            "add_labels": ["oq:open"],
            "remove_labels": ["oq:resolved"],
        }
        oq_sync.apply_action(act)
        cmds = self._cmds()
        self.assertEqual(cmds[0], "issue reopen 7")
        self.assertEqual(cmds[1], "issue edit 7")

    def test_orphan_and_unmanaged_do_nothing(self):
        oq_sync.apply_action({"action": "orphan", "oq_id": "OQ-P-099", "issue": 9, "title": "x"})
        oq_sync.apply_action({"action": "unmanaged", "oq_id": "", "issue": 5, "title": "y"})
        self.assertEqual(self.calls, [])

    def test_apply_plan_collects_failures_and_continues(self):
        def flaky(args, input_=None):
            self.calls.append((list(args), input_))
            if "OQ-P-002" in " ".join(args) + (input_ or ""):
                raise RuntimeError("boom")
            return "{}"

        oq_sync.gh = flaky
        plan = {
            "repo": "o/r",
            "summary": {},
            "actions": [
                {"action": "create", "oq_id": "OQ-P-001", "title": "a", "body": "OQ-P-001", "labels": []},
                {"action": "create", "oq_id": "OQ-P-002", "title": "b", "body": "OQ-P-002", "labels": []},
                {"action": "create", "oq_id": "OQ-P-003", "title": "c", "body": "OQ-P-003", "labels": []},
            ],
        }
        failures = oq_sync.apply_plan(plan)
        self.assertEqual([f[0] for f in failures], ["OQ-P-002"])
        self.assertEqual(len(self.calls), 3)

    def test_apply_plan_limit(self):
        plan = {
            "repo": "o/r",
            "summary": {},
            "actions": [
                {"action": "create", "oq_id": "OQ-P-00%d" % i, "title": "t", "body": "b", "labels": []}
                for i in range(1, 6)
            ],
        }
        oq_sync.apply_plan(plan, limit=2)
        self.assertEqual(len(self.calls), 2)

    def test_ensure_labels_uses_force(self):
        oq_sync.ensure_labels()
        for args, _ in self.calls:
            self.assertEqual(args[:2], ["label", "create"])
            self.assertIn("--force", args)
        self.assertEqual(len(self.calls), len(oq_sync.LABEL_SPECS))
```

- [ ] **Step 2: 테스트가 실패하는지 확인한다**

Run: `python3 -m unittest discover -s parfait/script -t parfait/script -v`
Expected: FAIL — `AttributeError: module 'oq_sync' has no attribute 'apply_action'`

- [ ] **Step 3: 구현을 쓴다**

`import` 블록에 `import argparse`·`import sys`를 추가한다(최종 순서: `argparse`, `hashlib`, `json`, `re`, `subprocess`, `sys`, `from pathlib import Path`).

`render_plan_table` 아래에 붙인다:

```python
def ensure_labels():
    """라벨을 만든다. `--force`라 이미 있으면 갱신된다(멱등)."""
    for spec in LABEL_SPECS:
        gh(
            [
                "label", "create", spec["name"],
                "--color", spec["color"],
                "--description", spec["desc"],
                "--force",
            ]
        )


def _edit_args(act):
    args = ["issue", "edit", str(act["issue"]), "--title", act["title"], "--body-file", "-"]
    for name in act.get("add_labels") or []:
        args += ["--add-label", name]
    for name in act.get("remove_labels") or []:
        args += ["--remove-label", name]
    return args


def apply_action(act):
    """액션 하나를 실행한다. orphan·unmanaged는 보고 전용이라 아무것도 하지 않는다."""
    kind = act["action"]
    if kind in ("orphan", "unmanaged", "noop"):
        return
    if kind == "create":
        args = ["issue", "create", "--title", act["title"], "--body-file", "-"]
        for name in act.get("labels") or []:
            args += ["--label", name]
        gh(args, input_=act["body"])
    elif kind == "update":
        gh(_edit_args(act), input_=act["body"])
    elif kind == "close":
        gh(_edit_args(act), input_=act["body"])
        gh(["issue", "comment", str(act["issue"]), "--body-file", "-"], input_=act["comment"])
        gh(["issue", "close", str(act["issue"])])
    elif kind == "reopen":
        gh(["issue", "reopen", str(act["issue"])])
        gh(_edit_args(act), input_=act["body"])
    else:
        raise RuntimeError("알 수 없는 액션: %s" % kind)


def apply_plan(plan, limit=None):
    """계획을 순차 실행하고 실패 목록을 돌려준다. 실패해도 나머지를 계속 실행한다."""
    actions = [a for a in plan["actions"] if a["action"] not in ("orphan", "unmanaged", "noop")]
    if limit is not None:
        actions = actions[:limit]
    failures = []
    for i, act in enumerate(actions, 1):
        label = "%s %s" % (act["action"], act.get("oq_id") or act.get("issue"))
        try:
            apply_action(act)
            print("[%d/%d] %s" % (i, len(actions), label))
        except Exception as exc:  # noqa: BLE001 — 실패해도 나머지를 계속 실행한다
            failures.append((act.get("oq_id", ""), str(exc)))
            print("[%d/%d] 실패 %s — %s" % (i, len(actions), label, exc))
    return failures
```

이어서 문서 읽기와 CLI를 파일 끝에 붙인다:

```python
def read_docs():
    """두 문서를 읽어 항목 전량을 돌려준다. ID 미부여 항목이 있으면 중단한다."""
    items = []
    missing = []
    for series, rel in DOCS:
        text = (REPO_ROOT / rel).read_text(encoding="utf-8")
        for it in parse_doc(text, series, rel):
            if it["oq_id"] is None:
                missing.append("%s — %s" % (rel, it["title"]))
            items.append(it)
    if missing:
        raise SystemExit(
            "ID 미부여 항목 %d건. 먼저 assign-ids를 실행하라:\n  " % len(missing)
            + "\n  ".join(missing[:10])
        )
    return items


def cmd_assign_ids(args):
    total = 0
    for series, rel in DOCS:
        path = REPO_ROOT / rel
        text = path.read_text(encoding="utf-8")
        new_text, assigned = assign_ids(text, series)
        total += len(assigned)
        if assigned and not args.check:
            path.write_text(new_text, encoding="utf-8")
        for oq_id, title in assigned:
            print("%s  %s" % (oq_id, title))
    if args.check:
        print("미부여 %d건" % total)
        return 1 if total else 0
    print("부여 %d건" % total)
    return 0


def cmd_plan(args):
    items = read_docs()
    repo = current_repo()
    plan = build_plan(items, fetch_issues(), repo)
    print(render_plan_table(plan))
    out = Path(args.out)
    out.write_text(json.dumps(plan, ensure_ascii=False, indent=2), encoding="utf-8")
    print("\n계획 저장: %s" % out)
    return 0


def cmd_apply(args):
    plan = json.loads(Path(args.plan).read_text(encoding="utf-8"))
    ensure_labels()
    failures = apply_plan(plan, limit=args.limit)
    if failures:
        print("\n실패 %d건:" % len(failures))
        for oq_id, msg in failures:
            print("  %s — %s" % (oq_id, msg))
        return 1
    print("\n완료")
    return 0


def main():
    ap = argparse.ArgumentParser(description="open-questions → GitHub 이슈 단방향 동기화")
    sub = ap.add_subparsers(dest="cmd", required=True)

    p_ids = sub.add_parser("assign-ids", help="ID 없는 항목에 안정 ID 부여")
    p_ids.add_argument("--check", action="store_true", help="수정하지 않고 미부여 건수만 보고")
    p_ids.set_defaults(func=cmd_assign_ids)

    p_plan = sub.add_parser("plan", help="계획 산출(리모트 읽기만)")
    p_plan.add_argument("--out", default="oq-plan.json", help="계획 JSON 저장 경로")
    p_plan.set_defaults(func=cmd_plan)

    p_apply = sub.add_parser("apply", help="계획 실행(리모트 쓰기)")
    p_apply.add_argument("plan", help="계획 JSON 경로")
    p_apply.add_argument("--limit", type=int, default=None, help="실행 건수 상한")
    p_apply.set_defaults(func=cmd_apply)

    args = ap.parse_args()
    sys.exit(args.func(args))


if __name__ == "__main__":
    main()
```

- [ ] **Step 4: 테스트가 통과하는지 확인한다**

Run: `python3 -m unittest discover -s parfait/script -t parfait/script -v`
Expected: PASS — 55 tests

- [ ] **Step 5: CLI가 붙었는지 확인한다**

Run: `python3 parfait/script/oq_sync.py --help && python3 parfait/script/oq_sync.py assign-ids --check`
Expected: 서브커맨드 3종이 보이고, `--check`가 미부여 건수(138 근처)를 출력하며 종료 코드 1

- [ ] **Step 6: 커밋한다**

```bash
git add parfait/script/oq_sync.py parfait/script/test_oq_sync.py
git commit -m "feat(oq-sync): apply 실행기와 CLI 서브커맨드"
```

---

### Task 7: GitHub 이슈 템플릿

**Files:**
- Create: `.github/ISSUE_TEMPLATE/open-question.yml`
- Create: `.github/ISSUE_TEMPLATE/bug.yml`
- Create: `.github/ISSUE_TEMPLATE/task.yml`
- Create: `.github/ISSUE_TEMPLATE/config.yml`

**Interfaces:**
- Consumes: Task 4의 라벨 이름(`oq:wiki`·`oq:parfait`·`oq:open`)
- Produces: 없음(스크립트가 참조하지 않는다)

템플릿으로 만든 이슈에는 `oq-id` 마커가 없다 → 다음 `plan`에서 `unmanaged`로 보고된다. 이는 의도된 동작이다.

- [ ] **Step 1: `open-question.yml`을 만든다**

```yaml
name: 미결 항목 (open question)
description: 정책·구현에서 결정되지 않은 것을 등록한다
title: "[OQ] "
labels: ["oq:open"]
body:
  - type: markdown
    attributes:
      value: |
        **정본은 문서다.** 이 이슈는 `wiki/synthesis/open-questions.md` 또는
        `parfait/synthesis/open-questions.md`에 옮겨져야 최종 추적된다.
        `sync-open-questions` 스킬이 다음 실행에서 이 이슈를 "문서에 없는 항목"으로 보고한다.
  - type: dropdown
    id: series
    attributes:
      label: 계열
      description: 정책·기획이면 wiki, 코드·계약·정합이면 parfait
      options:
        - wiki (정책·기획)
        - parfait (구현·계약)
    validations:
      required: true
  - type: textarea
    id: source
    attributes:
      label: 출처
      description: 근거가 되는 파일·심볼·문서. 라인번호가 아니라 파일명+심볼명으로 적는다
      placeholder: "`component/ygbutton/YGButtonType.kt` — colors가 원자 색을 직접 참조"
    validations:
      required: true
  - type: textarea
    id: question
    attributes:
      label: 결정해야 할 것
      description: 무엇을 정해야 하는지. 선택지가 있으면 ①②③으로 나눠 적는다
    validations:
      required: true
  - type: input
    id: status
    attributes:
      label: 상태
      description: "`미해결` / `보류 (…)` / `부분 해소 (…)` 중 하나. 괄호 안 서술을 깎지 말 것"
      value: 미해결
    validations:
      required: true
  - type: textarea
    id: memo
    attributes:
      label: 해소 조건
      description: 무엇이 확정되면 닫히는지, 닫힐 때 어느 문서를 고쳐야 하는지
```

- [ ] **Step 2: `bug.yml`을 만든다**

```yaml
name: 버그
description: 스킬·스크립트·문서의 오류를 신고한다
title: "[BUG] "
labels: ["bug"]
body:
  - type: input
    id: target
    attributes:
      label: 대상
      description: 스킬명·스크립트 경로·문서 경로
      placeholder: parfait/script/oq_sync.py
    validations:
      required: true
  - type: textarea
    id: expected
    attributes:
      label: 기대한 동작
    validations:
      required: true
  - type: textarea
    id: actual
    attributes:
      label: 실제 동작
      description: 오류 메시지가 있으면 그대로 붙인다(요약하지 말 것)
    validations:
      required: true
  - type: textarea
    id: repro
    attributes:
      label: 재현 절차
      placeholder: |
        1. python3 parfait/script/oq_sync.py plan
        2. ...
```

- [ ] **Step 3: `task.yml`을 만든다**

```yaml
name: 작업
description: 문서·스킬·툴링 작업을 등록한다
title: "[TASK] "
labels: ["enhancement"]
body:
  - type: textarea
    id: what
    attributes:
      label: 무엇을
      description: 하려는 일 한두 줄
    validations:
      required: true
  - type: textarea
    id: why
    attributes:
      label: 왜
      description: 지금 무엇이 불편하거나 틀렸는지
    validations:
      required: true
  - type: textarea
    id: done
    attributes:
      label: 완료 조건
      description: 무엇이 되면 닫히는지
    validations:
      required: true
```

- [ ] **Step 4: `config.yml`을 만든다**

```yaml
blank_issues_enabled: true
contact_links:
  - name: 미결 항목 문서 (정책)
    url: https://github.com/citytexi/team-yg-pesonal-agent/blob/main/wiki/synthesis/open-questions.md
    about: 정책·기획 미결의 정본. 이슈는 이 문서의 투영이다.
  - name: 미결 항목 문서 (구현)
    url: https://github.com/citytexi/team-yg-pesonal-agent/blob/main/parfait/synthesis/open-questions.md
    about: 구현·계약 미결의 정본. 이슈는 이 문서의 투영이다.
```

- [ ] **Step 5: YAML이 파싱되는지 확인한다**

Run:
```bash
python3 -c "
import glob, sys
try:
    import yaml
except ImportError:
    sys.exit('PyYAML 없음 — 육안 확인으로 대체')
for f in sorted(glob.glob('.github/ISSUE_TEMPLATE/*.yml')):
    yaml.safe_load(open(f, encoding='utf-8'))
    print('ok', f)
"
```
Expected: 4개 파일 `ok`. PyYAML이 없으면 그 메시지가 나오고, 그때는 들여쓰기를 육안으로 확인한다(설치하지 않는다 — stdlib 전용 규약).

- [ ] **Step 6: 커밋한다**

```bash
git add .github/ISSUE_TEMPLATE
git commit -m "feat: GitHub 이슈 템플릿 4종(open-question·bug·task·config)"
```

---

### Task 8: 스킬 `sync-open-questions`와 스크립트 인덱스

**Files:**
- Create: `.claude/skills/sync-open-questions/SKILL.md`
- Modify: `parfait/script/README.md` (인덱스 표에 행 추가)

**Interfaces:**
- Consumes: Task 6의 CLI 3종
- Produces: 없음

- [ ] **Step 1: `SKILL.md`를 만든다**

```markdown
---
name: sync-open-questions
description: open-questions 문서를 이 repo의 GitHub 이슈로 동기화한다(반복 워크플로). 사용자가 "/sync-open-questions", "미결 이슈화", "open question 이슈로 만들어줘", "미결 항목 현행화", "이슈 동기화"라고 할 때 사용. 문서가 정본이고 이슈는 단방향 투영 — dry-run 계획을 보고한 뒤 사용자 승인을 받아 실행한다.
---

# sync-open-questions — 미결 항목 → GitHub 이슈 동기화

`wiki/synthesis/open-questions.md`(정책)와 `parfait/synthesis/open-questions.md`(구현)의
미결 항목을 이 저장소의 GitHub 이슈로 투영한다.

## 핵심 규율
- **문서가 정본.** 이슈 본문을 손으로 고쳐도 다음 동기화에 덮어써진다. 역방향 반영은 없다.
- **전량 미러.** 상태가 `해소됨`으로 시작하지 않는 모든 항목이 이슈가 된다. `보류`·`부분 해소`도
  만든다 — 라벨로만 구분한다. 문서의 부정 매칭 규약과 같은 기준을 쓴다.
- **이슈 쓰기 전 사용자 승인 필수**(`CLAUDE.md` 리모트 규율). `plan`까지는 확인 없이 돌려도 된다.
- **`orphan`(문서에서 사라진 항목)은 자동으로 닫지 않는다.** 사람에게 보고만 한다.
- 판단은 스크립트가 한다. 이 스킬은 게이트와 보고만 담당한다.

## 단계

1. **ID 부여** — `python3 parfait/script/oq_sync.py assign-ids`
   - 문서가 바뀌었으면 브랜치를 파고(`main` 직접 금지) 로컬 커밋한다.
   - 커밋 메시지: `docs(oq): open-questions 항목에 안정 ID 부여`
2. **계획 산출** — `python3 parfait/script/oq_sync.py plan --out <스크래치패드>/oq-plan.json`
   - 계획 JSON은 저장소에 커밋하지 않는다.
3. **보고** — 요약 표를 사용자에게 보여준다.
   - `orphan`·`unmanaged`가 있으면 **개별로 나열한다**(자동 처리하지 않는 항목이므로).
   - `create`+`update`+`close`+`reopen`이 0이면 "동기 상태"로 보고하고 종료한다.
4. **승인 대기** — 리모트 쓰기다. 사용자가 명시적으로 승인하기 전에 5단계로 넘어가지 않는다.
5. **실행** — `python3 parfait/script/oq_sync.py apply <계획 경로>`
   - 첫 실행처럼 건수가 많으면 `--limit N`으로 나눠 받을 수 있다.
6. **결과 보고** — 실패 건이 있으면 그대로 알린다. 조용히 넘어가지 않는다.
   실패는 다음 `plan`에서 다시 잡히므로 재실행으로 복구된다.

## 언제
- 문서에 미결 항목을 추가·수정·해소한 뒤
- `ingest`·`lint`·`sync-tjyg-develop-baseline`·`sync-teamyg-server-api`가 open-questions를 건드린 뒤
- 이슈 목록이 문서와 어긋나 보일 때

## 주의
- 이슈 생성 대상은 **이 저장소 하나**다. TJYG-Android에 만들지 않는다.
- 라벨은 `apply`가 `--force`로 만든다(멱등). 손으로 만들 필요 없다.
- 이슈 템플릿으로 손수 만든 이슈는 `oq-id` 마커가 없어 `unmanaged`로 잡힌다.
  문서로 옮길지는 사람이 정한다 — 스킬이 자동으로 옮기지 않는다.
```

- [ ] **Step 2: `parfait/script/README.md` 인덱스에 행을 추가한다**

인덱스 표(`| 스크립트 | 용도 | 호출 스킬 |`)의 마지막 행 아래에 붙인다:

```markdown
| `oq_sync.py` | open-questions 문서 → GitHub 이슈 단방향 동기화(assign-ids/plan/apply) | `sync-open-questions` |
```

- [ ] **Step 3: 스킬이 인식되는지 확인한다**

Run: `python3 parfait/script/search.py "open questions 이슈 동기화" --top 5`
Expected: `sync-open-questions`가 상위에 나온다

- [ ] **Step 4: 커밋한다**

```bash
git add .claude/skills/sync-open-questions/SKILL.md parfait/script/README.md
git commit -m "feat: sync-open-questions 스킬 + 스크립트 인덱스 등록"
```

---

### Task 9: 문서 ID 마이그레이션 실행

**Files:**
- Modify: `wiki/synthesis/open-questions.md`
- Modify: `parfait/synthesis/open-questions.md`

**Interfaces:**
- Consumes: Task 6의 `assign-ids` CLI
- Produces: 두 문서의 모든 항목에 `- **ID**: OQ-X-###` + 말미 `<!-- oq-next: N -->` 마커

이 태스크는 코드가 아니라 **데이터 마이그레이션**이다. 되돌리려면 커밋을 되돌리면 된다.

- [ ] **Step 1: 마이그레이션 전 항목 수를 기록한다**

Run:
```bash
python3 parfait/script/oq_sync.py assign-ids --check
grep -c '^### \[' wiki/synthesis/open-questions.md parfait/synthesis/open-questions.md
```
Expected: 미부여 138건 안팎, wiki 26 / parfait 112

- [ ] **Step 2: ID를 부여한다**

Run: `python3 parfait/script/oq_sync.py assign-ids`
Expected: `OQ-W-001`~`OQ-W-026`, `OQ-P-001`~`OQ-P-112` 목록 출력 후 `부여 138건`

- [ ] **Step 3: 헤딩이 안 바뀌었는지 확인한다**

Run: `git diff --stat && git diff -U0 -- wiki/synthesis/open-questions.md | grep '^[-+]###' | head`
Expected: `###` 헤딩 줄의 추가/삭제가 **0건**(ID 줄만 추가돼야 한다)

- [ ] **Step 4: 멱등성을 확인한다**

Run: `python3 parfait/script/oq_sync.py assign-ids && git diff --stat`
Expected: `부여 0건`, diff 변동 없음(2회차가 파일을 바꾸지 않는다)

- [ ] **Step 5: 위키 lint가 깨지지 않았는지 확인한다**

Run: `python3 wiki/script/lint.py`
Expected: 마이그레이션 이전과 같은 결과. 새 위반이 생겼으면 원인을 보고하고 멈춘다

- [ ] **Step 6: 파서가 전량을 읽는지 확인한다**

Run:
```bash
python3 -c "
import sys; sys.path.insert(0, 'parfait/script')
import oq_sync
items = oq_sync.read_docs()
print('총', len(items))
from collections import Counter
print(Counter(oq_sync.classify(i['status']) for i in items))
"
```
Expected: 총 138, 분류 카운트 출력(`resolved` 20건 안팎). 예외 없이 끝나야 한다 — `SystemExit`가 나면 ID 미부여 항목이 남은 것이다

- [ ] **Step 7: 커밋한다**

```bash
git add wiki/synthesis/open-questions.md parfait/synthesis/open-questions.md
git commit -m "docs(oq): open-questions 항목에 안정 ID 부여

이슈 동기화의 매칭 키. 헤딩은 건드리지 않아 기존 앵커 참조가 보존된다."
```

---

## 실행 후 (사람 승인 구간)

플랜의 태스크는 여기까지다. 실제 이슈 생성은 `sync-open-questions` 스킬로 돌린다:

1. `python3 parfait/script/oq_sync.py plan --out <스크래치패드>/oq-plan.json`
2. 요약 표 보고 → **사용자 승인**
3. `python3 parfait/script/oq_sync.py apply <스크래치패드>/oq-plan.json`

첫 실행은 118건 안팎을 만든다. 나눠 받으려면 `--limit`을 쓴다.
브랜치 push와 PR도 사용자 확인 후에 한다(`CLAUDE.md`).
