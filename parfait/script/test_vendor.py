import unittest

import vendor


class LeafNameTest(unittest.TestCase):
    def test_nested_path(self):
        self.assertEqual(vendor.leaf_name("jetpack-compose/theming/styles/SKILL.md"), "styles")

    def test_skills_wrapper(self):
        self.assertEqual(vendor.leaf_name("skills/compose-state-hoisting/SKILL.md"), "compose-state-hoisting")

    def test_root(self):
        self.assertEqual(vendor.leaf_name("SKILL.md"), "")


class AffectedTest(unittest.TestCase):
    def test_added_and_deleted(self):
        diff = "A\tskills/new-skill/SKILL.md\nD\tskills/old-skill/SKILL.md\nM\tsrc/other.kt"
        res = vendor.affected(diff)
        self.assertEqual(res["new-skill"], "mod")
        self.assertEqual(res["old-skill"], "del")
        self.assertNotIn("other", res)

    def test_dotdir_excluded(self):
        self.assertEqual(vendor.affected("A\t.claude-plugin/x/SKILL.md"), {})


if __name__ == "__main__":
    unittest.main()
