import json
import tempfile
import types
import unittest
from pathlib import Path

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
        it1 = _item("OQ-P-001")
        it2 = _item("OQ-P-002", status="보류 (원격 연동 이후)")
        plan = oq_sync.build_plan([it1, it2], [], self.REPO)
        table = oq_sync.render_plan_table(plan)
        # 액션 종류별 건수 줄 자체를 검증한다(문자열 "1"이 어딘가 있는지가 아니라).
        self.assertIn("| create | 2 |", table)
        self.assertIn("| update | 0 |", table)
        self.assertIn("| close | 0 |", table)
        self.assertIn("| reopen | 0 |", table)
        self.assertIn("| noop | 0 |", table)
        self.assertIn("| orphan | 0 |", table)
        self.assertIn("| unmanaged | 0 |", table)
        self.assertIn("| duplicate | 0 |", table)

    def test_render_plan_table_lists_orphan_unmanaged_duplicate_individually(self):
        plan = {
            "repo": self.REPO,
            "summary": {k: 0 for k in oq_sync.ACTION_KINDS},
            "actions": [
                {"action": "orphan", "oq_id": "OQ-P-099", "issue": 9, "title": "고아"},
                {"action": "unmanaged", "oq_id": "", "issue": 5, "title": "수동"},
                {"action": "duplicate", "oq_id": "OQ-P-001", "issue": 12, "title": "중복"},
            ],
        }
        table = oq_sync.render_plan_table(plan)
        self.assertIn("- orphan: #9 고아", table)
        self.assertIn("- unmanaged: #5 수동", table)
        self.assertIn("- duplicate: #12 중복", table)


class LabelDiffTest(unittest.TestCase):
    """`_label_diff`는 우리가 관리하는 라벨(oq:* 계열)만 대상으로 한다."""

    def test_managed_label_add_and_remove(self):
        add, remove = oq_sync._label_diff(["oq:open"], ["oq:blocked"])
        self.assertEqual(add, ["oq:blocked"])
        self.assertEqual(remove, ["oq:open"])

    def test_unmanaged_label_is_preserved_not_removed(self):
        # "bug"는 관리 대상이 아니므로 wanted에 없어도 remove 대상에 들어가면 안 된다.
        add, remove = oq_sync._label_diff(["oq:open", "bug"], ["oq:open"])
        self.assertEqual(add, [])
        self.assertEqual(remove, [])

    def test_unmanaged_label_does_not_block_needed_add(self):
        add, remove = oq_sync._label_diff(["bug"], ["oq:parfait", "oq:open"])
        self.assertEqual(sorted(add), ["oq:open", "oq:parfait"])
        self.assertEqual(remove, [])


class DuplicateActionTest(unittest.TestCase):
    """같은 oq-id가 여러 OPEN 이슈에 있을 때: 조용히 사라지지 않고 duplicate로 보고한다."""

    REPO = "citytexi/team-yg-pesonal-agent"

    def test_two_open_issues_same_id_reports_duplicate_and_keeps_smallest(self):
        it = _item("OQ-P-001")
        iss_small = _issue(5, "OQ-P-001", oq_sync.item_hash(it["body"]), title=oq_sync.issue_title(it))
        iss_big = _issue(9, "OQ-P-001", "000000000000", title="다른 제목")
        # 순서를 뒤섞어도(입력 순서가 아니라 이슈 번호로) 대표를 골라야 한다.
        plan = oq_sync.build_plan([it], [iss_big, iss_small], self.REPO)
        self.assertEqual(plan["summary"]["duplicate"], 1)
        dup = [a for a in plan["actions"] if a["action"] == "duplicate"][0]
        self.assertEqual(dup["issue"], 9)
        self.assertEqual(dup["oq_id"], "OQ-P-001")
        # 대표(#5, 해시·제목 동일)로 매칭되므로 create/update가 따로 생기면 안 된다.
        self.assertNotIn("create", [a["action"] for a in plan["actions"]])
        self.assertNotIn("update", [a["action"] for a in plan["actions"]])

    def test_closed_duplicate_is_not_reported(self):
        it = _item("OQ-P-001")
        iss_open = _issue(5, "OQ-P-001", oq_sync.item_hash(it["body"]), title=oq_sync.issue_title(it))
        iss_closed = _issue(9, "OQ-P-001", "000000000000", state="CLOSED")
        plan = oq_sync.build_plan([it], [iss_open, iss_closed], self.REPO)
        self.assertEqual(plan["summary"]["duplicate"], 0)


class ApplyTest(unittest.TestCase):
    def setUp(self):
        self.calls = []
        self._orig = oq_sync.gh
        self._orig_interval = oq_sync.WRITE_INTERVAL_SEC
        oq_sync.WRITE_INTERVAL_SEC = 0  # 테스트가 실제로 대기하면 안 된다

        def fake(args, input_=None):
            self.calls.append((list(args), input_))
            return "{}"

        oq_sync.gh = fake

    def tearDown(self):
        oq_sync.gh = self._orig
        oq_sync.WRITE_INTERVAL_SEC = self._orig_interval

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

    def test_duplicate_does_nothing(self):
        oq_sync.apply_action({"action": "duplicate", "oq_id": "OQ-P-001", "issue": 9, "title": "x"})
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

    def test_apply_plan_ignores_duplicate_action(self):
        plan = {
            "repo": "o/r",
            "summary": {},
            "actions": [
                {"action": "duplicate", "oq_id": "OQ-P-001", "issue": 9, "title": "x"},
            ],
        }
        failures = oq_sync.apply_plan(plan)
        self.assertEqual(self.calls, [])
        self.assertEqual(failures, [])

    def test_ensure_labels_uses_force(self):
        oq_sync.ensure_labels()
        for args, _ in self.calls:
            self.assertEqual(args[:2], ["label", "create"])
            self.assertIn("--force", args)
        self.assertEqual(len(self.calls), len(oq_sync.LABEL_SPECS))


class ApplyPlanThrottleTest(unittest.TestCase):
    """연속 실패 중단(Important 4)과 쓰기 간격을 검증한다."""

    def setUp(self):
        self.calls = []
        self._orig_gh = oq_sync.gh
        self._orig_interval = oq_sync.WRITE_INTERVAL_SEC
        oq_sync.WRITE_INTERVAL_SEC = 0

    def tearDown(self):
        oq_sync.gh = self._orig_gh
        oq_sync.WRITE_INTERVAL_SEC = self._orig_interval

    def _plan_with(self, n):
        return {
            "repo": "o/r",
            "summary": {},
            "actions": [
                {"action": "create", "oq_id": "OQ-P-%03d" % i, "title": "t", "body": "b", "labels": []}
                for i in range(1, n + 1)
            ],
        }

    def test_stops_after_max_consecutive_failures(self):
        def always_fail(args, input_=None):
            self.calls.append(args)
            raise RuntimeError("boom")

        oq_sync.gh = always_fail
        plan = self._plan_with(9)
        failures = oq_sync.apply_plan(plan)
        # MAX_CONSECUTIVE_FAILURES건 실패한 시점에 중단 — 나머지는 실행하지 않는다.
        self.assertEqual(len(self.calls), oq_sync.MAX_CONSECUTIVE_FAILURES)
        self.assertEqual(len(failures), oq_sync.MAX_CONSECUTIVE_FAILURES)

    def test_success_resets_consecutive_failure_counter(self):
        # 4번 실패 → 1번 성공(리셋) → 4번 실패: 연속 실패가 5에 도달한 적이 없으므로 끝까지 돈다.
        pattern = ["fail"] * 4 + ["ok"] + ["fail"] * 4
        self.assertLess(4, oq_sync.MAX_CONSECUTIVE_FAILURES)

        def scripted(args, input_=None):
            step = pattern[len(self.calls)]
            self.calls.append(args)
            if step == "fail":
                raise RuntimeError("boom")
            return "{}"

        oq_sync.gh = scripted
        plan = self._plan_with(len(pattern))
        failures = oq_sync.apply_plan(plan)
        self.assertEqual(len(self.calls), len(pattern))
        self.assertEqual(len(failures), 8)

    def test_sleeps_between_write_actions(self):
        class FakeTime:
            def __init__(self):
                self.sleeps = []

            def sleep(self, seconds):
                self.sleeps.append(seconds)

        def ok(args, input_=None):
            self.calls.append(args)
            return "{}"

        oq_sync.gh = ok
        oq_sync.WRITE_INTERVAL_SEC = 0.01
        fake_time = FakeTime()
        orig_time = oq_sync.time
        oq_sync.time = fake_time
        try:
            oq_sync.apply_plan(self._plan_with(3))
        finally:
            oq_sync.time = orig_time
        self.assertEqual(fake_time.sleeps, [0.01, 0.01, 0.01])


class GhSubprocessTest(unittest.TestCase):
    """`gh`가 cwd와 무관하게 항상 repo 루트에서 실행되는지 검증한다(Important 2)."""

    def test_gh_runs_with_repo_root_cwd(self):
        captured = {}

        def fake_run(cmd, **kwargs):
            captured["cmd"] = cmd
            captured["cwd"] = kwargs.get("cwd")

            class Result:
                returncode = 0
                stdout = "ok"
                stderr = ""

            return Result()

        orig_run = oq_sync.subprocess.run
        oq_sync.subprocess.run = fake_run
        try:
            oq_sync.gh(["repo", "view"])
        finally:
            oq_sync.subprocess.run = orig_run
        self.assertEqual(captured["cwd"], str(oq_sync.REPO_ROOT))


class CmdApplyGuardTest(unittest.TestCase):
    """plan 재사용 차단(Critical 1)과 repo 불일치 중단(Important 3)을 검증한다."""

    REPO = "citytexi/team-yg-pesonal-agent"

    def setUp(self):
        self._orig_gh = oq_sync.gh
        self._orig_interval = oq_sync.WRITE_INTERVAL_SEC
        oq_sync.WRITE_INTERVAL_SEC = 0
        self.tmpdir = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmpdir.cleanup)

    def tearDown(self):
        oq_sync.gh = self._orig_gh
        oq_sync.WRITE_INTERVAL_SEC = self._orig_interval

    def _write_plan(self, repo=None, actions=None):
        plan = {
            "repo": repo if repo is not None else self.REPO,
            "summary": {k: 0 for k in oq_sync.ACTION_KINDS},
            "actions": actions or [],
        }
        path = Path(self.tmpdir.name) / "plan.json"
        path.write_text(json.dumps(plan, ensure_ascii=False), encoding="utf-8")
        return path

    def test_refuses_when_already_applied_marker_exists(self):
        plan_path = self._write_plan()
        marker_path = Path(str(plan_path) + oq_sync.PLAN_APPLIED_SUFFIX)
        marker_path.write_text("applied\n", encoding="utf-8")

        def boom(args, input_=None):
            raise AssertionError("이미 applied된 계획은 gh를 호출하면 안 된다")

        oq_sync.gh = boom
        args = types.SimpleNamespace(plan=str(plan_path), limit=None)
        with self.assertRaises(SystemExit):
            oq_sync.cmd_apply(args)

    def test_refuses_when_repo_mismatch(self):
        plan_path = self._write_plan(repo="someone/other-repo")

        def fake_gh(args, input_=None):
            if args[:2] == ["repo", "view"]:
                return json.dumps({"nameWithOwner": self.REPO})
            raise AssertionError("repo 불일치면 쓰기 gh 호출이 발생하면 안 된다: %s" % args)

        oq_sync.gh = fake_gh
        args = types.SimpleNamespace(plan=str(plan_path), limit=None)
        with self.assertRaises(SystemExit):
            oq_sync.cmd_apply(args)

    def test_writes_marker_after_apply_and_blocks_rerun(self):
        plan_path = self._write_plan(
            actions=[{"action": "create", "oq_id": "OQ-P-001", "title": "t", "body": "b", "labels": []}]
        )

        def fake_gh(args, input_=None):
            if args[:2] == ["repo", "view"]:
                return json.dumps({"nameWithOwner": self.REPO})
            return "{}"

        oq_sync.gh = fake_gh
        args = types.SimpleNamespace(plan=str(plan_path), limit=None)
        code = oq_sync.cmd_apply(args)
        self.assertEqual(code, 0)

        marker_path = Path(str(plan_path) + oq_sync.PLAN_APPLIED_SUFFIX)
        self.assertTrue(marker_path.exists())

        def boom(args, input_=None):
            raise AssertionError("재적용 시도는 gh를 호출하면 안 된다")

        oq_sync.gh = boom
        with self.assertRaises(SystemExit):
            oq_sync.cmd_apply(args)


if __name__ == "__main__":
    unittest.main()
