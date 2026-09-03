"""Offline narration cache tests. No synthesis or credentials required."""

import unittest
import json
import tempfile
from dataclasses import replace
from pathlib import Path
from unittest.mock import patch

from scripts import render_demo_voiceover as narration


class NarrationCacheTests(unittest.TestCase):
    def test_same_input_reuses_cache(self):
        segment = narration.SEGMENTS[0]
        self.assertEqual(narration.segment_filename(1, segment), narration.segment_filename(1, segment))
        self.assertTrue(narration.segment_filename(1, segment).startswith("ribband-segment-01-"))

    def test_changed_brand_or_timing_invalidates_cache(self):
        segment = narration.SEGMENTS[0]
        current = narration.segment_filename(1, segment)
        self.assertNotEqual(current, narration.segment_filename(1, replace(segment, text=segment.text.replace("Ribband", "Agentic"))))
        self.assertNotEqual(current, narration.segment_filename(1, replace(segment, end=segment.end + 1)))
        self.assertNotEqual(current, narration.segment_filename(2, segment))

    def test_changed_voice_model_or_direction_invalidates_cache(self):
        segment = narration.SEGMENTS[0]
        current = narration.segment_filename(1, segment)
        for setting, value in [("VOICE", "Lapetus"), ("MODEL", "another-model")]:
            with patch.object(narration, setting, value):
                self.assertNotEqual(current, narration.segment_filename(1, segment))
        with patch.object(narration, "narration_prompt", return_value="New direction"):
            self.assertNotEqual(current, narration.segment_filename(1, segment))

    def test_current_brand_and_requested_voice(self):
        self.assertEqual(narration.VOICE, "Sadachbia")
        self.assertEqual(narration.MODEL, "gemini-3.1-flash-tts-preview")
        self.assertIn("Ribband", narration.SEGMENTS[0].text)
        self.assertIn("RIB-band", narration.narration_prompt(narration.SEGMENTS[0]))

    def test_nominal_sequence_includes_goods_services_and_itinerary(self):
        segments = narration.load_segments()
        self.assertLess(segments[-1].end, 180)
        self.assertEqual(segments[0].start, 0)
        self.assertIn("itinerary", [segment.id for segment in segments])
        self.assertIn("dossier", [segment.id for segment in segments])
        for left, right in zip(segments, segments[1:]):
            self.assertEqual(left.end, right.start)

    def test_measured_cues_validate_order_overlap_and_video_limit(self):
        cues = [{"id": segment.id, "start": segment.start, "end": segment.end} for segment in narration.SEGMENTS]
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "timing.json"
            def save(items):
                path.write_text(json.dumps({"cues": items}))
            save(cues)
            self.assertEqual(narration.load_segments(timing_path=path), narration.SEGMENTS)
            for invalid in [list(reversed(cues)), [dict(cues[0], end=99), *cues[1:]],
                            [*cues[:-1], dict(cues[-1], end=181)], [dict(cues[0], start=float("nan")), *cues[1:]]]:
                save(invalid)
                with self.assertRaises(ValueError):
                    narration.load_segments(timing_path=path)

    def test_audio_fit_rejects_rushed_delivery_and_reports_dead_air(self):
        segment = narration.Segment(0, 10, "A test", "test")
        speed, pause = narration.fit_audio(9, segment)
        self.assertAlmostEqual(speed, 9 / 9.5)
        self.assertAlmostEqual(pause, 0)
        self.assertGreater(narration.fit_audio(2, segment)[1], 1)
        with self.assertRaises(ValueError):
            narration.fit_audio(20, segment)


if __name__ == "__main__":
    unittest.main()
