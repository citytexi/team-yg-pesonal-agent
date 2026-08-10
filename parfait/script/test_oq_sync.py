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
