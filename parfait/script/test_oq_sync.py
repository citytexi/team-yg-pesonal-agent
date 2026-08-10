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


if __name__ == "__main__":
    unittest.main()
