"""Offline checks for the measured recording edit. No browser or media required."""
import json
from pathlib import Path
import unittest

from scripts.render_demo_video import build_cuts


class DemoEditTests(unittest.TestCase):
    def test_keeps_all_current_beats_inside_three_minutes(self):
        steps = json.loads((Path(__file__).resolve().parents[1] / "public/demo-sequence.json").read_text())["steps"]
        cues = []
        start = 12.0
        for step in steps:
            end = start + step["duration"] / 1000 + 0.05
            cues.append({"id": step["id"], "start": start, "end": end})
            start = end
        cuts = build_cuts(steps, cues)
        self.assertEqual(sum(cut["duration"] for cut in cuts), 165)
        self.assertEqual(len(cuts), 14)
        self.assertTrue(all(len(cut["ranges"]) == 1 for cut in cuts))

    def test_removes_idle_hold_but_preserves_transition_and_final_click(self):
        cuts = build_cuts([{"id": "approval", "duration": 12000}], [{"id": "approval", "start": 30, "end": 55}])
        self.assertEqual(cuts[0]["ranges"], [(30, 32), (45, 55)])
        self.assertEqual(cuts[0]["timeScale"], 1)

    def test_rejects_incomplete_or_invalid_cues(self):
        steps = [{"id": "a", "duration": 8000}, {"id": "b", "duration": 8000}]
        for cues in [[], [{"id": "a", "start": 0, "end": 8}, {"id": "b", "start": 7, "end": 15}],
                     [{"id": "a", "start": float("nan"), "end": 8}, {"id": "b", "start": 8, "end": 16}]]:
            with self.assertRaises(ValueError):
                build_cuts(steps, cues)

    def test_rejects_three_minute_edit(self):
        with self.assertRaises(ValueError):
            build_cuts([{"id": "a", "duration": 180000}], [{"id": "a", "start": 0, "end": 180}])


if __name__ == "__main__":
    unittest.main()
