import unittest

from main import LEARNING_LEVEL_SCHEMA_VERSION, ensure_learning_level_data


class LearningLevelMigrationTests(unittest.TestCase):
    def test_migrates_legacy_thu_levels_to_all_modules(self):
        migrated = ensure_learning_level_data({"mathLevel": 2, "vietLevel": 3}, "vuanhthu")
        self.assertEqual(migrated["mathDifficultyLevels"], {"basic_math": 1, "visual_math": 1})
        self.assertEqual(migrated["vietnameseModuleLevels"], {"prep_passage": 1, "prep_riddle": 1})
        self.assertEqual(migrated["learningLevelSchemaVersion"], LEARNING_LEVEL_SCHEMA_VERSION)

    def test_preserves_independent_duc_levels_and_fills_missing_modules(self):
        migrated = ensure_learning_level_data({
            "learningLevelSchemaVersion": LEARNING_LEVEL_SCHEMA_VERSION,
            "mathLevel": 7,
            "vietLevel": 2,
            "mathDifficultyLevels": {"algebra": 11, "geometry": 60},
            "vietnameseModuleLevels": {"grammar": 4},
        }, "vuanhduc")
        self.assertEqual(migrated["mathDifficultyLevels"], {
            "algebra": 11, "geometry": 50, "logic": 7, "all": 7
        })
        self.assertEqual(migrated["vietnameseModuleLevels"], {
            "grammar": 4, "writing": 2, "reading": 2
        })

    def test_levels_are_clamped_to_each_child_maximum(self):
        thu = ensure_learning_level_data({
            "learningLevelSchemaVersion": LEARNING_LEVEL_SCHEMA_VERSION,
            "mathLevel": 999,
            "vietLevel": -5,
        }, "vuanhthu")
        self.assertTrue(all(level == 20 for level in thu["mathDifficultyLevels"].values()))
        self.assertTrue(all(level == 1 for level in thu["vietnameseModuleLevels"].values()))


if __name__ == "__main__":
    unittest.main()
