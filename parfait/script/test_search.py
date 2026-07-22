import tempfile
import unittest
from pathlib import Path

import search


def _mk(root, name, desc):
    d = root / name
    d.mkdir()
    (d / "SKILL.md").write_text(
        f"---\nname: {name}\ndescription: {desc}\n---\n# {name}\n", encoding="utf-8"
    )


class ScoreTest(unittest.TestCase):
    def test_name_weight_beats_desc(self):
        s_name = {"name": "recomposition-debug", "desc": "misc", "headings": ""}
        s_desc = {"name": "misc", "desc": "recomposition tuning", "headings": ""}
        self.assertGreater(
            search.score("recomposition", s_name), search.score("recomposition", s_desc)
        )

    def test_no_match_zero(self):
        self.assertEqual(search.score("xyz", {"name": "a", "desc": "b", "headings": ""}), 0.0)


class SearchTest(unittest.TestCase):
    def test_ranks_relevant_first(self):
        with tempfile.TemporaryDirectory() as t:
            root = Path(t)
            _mk(root, "stability-diagnostics", "diagnose compose stability")
            _mk(root, "navigation-3", "set up navigation")
            search.SKILLS_DIR = root
            res = search.search("compose stability", top=5)
            self.assertEqual(res[0][1]["name"], "stability-diagnostics")


if __name__ == "__main__":
    unittest.main()
