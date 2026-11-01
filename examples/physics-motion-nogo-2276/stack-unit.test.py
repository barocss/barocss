#!/usr/bin/env python3
"""Synthetic tests only. This file does not open the historical archives."""
import copy
import importlib.util
from pathlib import Path
import struct
import unittest
from decimal import Decimal

spec = importlib.util.spec_from_file_location("stack_study", Path(__file__).with_name("stack-study.py"))
study = importlib.util.module_from_spec(spec)
spec.loader.exec_module(study)


def bodies():
    return [{"id": identifier, "kind": "static" if i == 8 else "dynamic",
             "shape": {"kind": "box", "halfExtentsM": [2, .1, 2] if i == 8 else [.25]*3},
             "positionM": [0, -.1, 0] if i == 8 else [0, .25+.5*i, 0],
             "velocityMps": [0, 0, 0], "orientation": [0, 0, 0, 1], "angularVelocityRadps": [0, 0, 0]}
            for i, identifier in enumerate(study.IDS)]


def point(impulse=1):
    return {"aId": "b0", "bId": "b1", "aIndex": 0, "bIndex": 1, "pairKey": "b0\0b1",
            "pointId": "synthetic", "family": "face", "pointM": [0, .5, 0], "normal": [0, 1, 0],
            "aPositionM": [0, .25, 0], "bPositionM": [0, .75, 0],
            "warm": {"normalNs": 123, "tangentNs": [0, 0, 0]},
            "final": {"normalNs": impulse, "tangentNs": [0, 0, 0]}}


class ContactTests(unittest.TestCase):
    def measure(self, impulse=1, speed=0):
        free, velocity = bodies(), bodies()
        velocity[1]["velocityMps"][1] = speed
        p = point(impulse)
        study.point_layout(p, free, set())
        low = study.contact_at_precision(p, free, velocity, 80)
        high = study.contact_at_precision(p, free, velocity, 120)
        study.precision_agreement(low, high)
        return high

    def test_supported_zero_speed_uses_final_impulse_without_warm_subtraction(self):
        measured = self.measure(1, 0)
        self.assertEqual(measured["normalImpulseNs"], Decimal(1))
        self.assertEqual(measured["violations"], [])

    def test_separating_inactive_contact(self):
        self.assertEqual(self.measure(0, 1)["violations"], [])

    def test_closing_inactive_contact(self):
        self.assertEqual(self.measure(0, -1)["violations"], ["closingNormalSpeedMps"])

    def test_negative_impulse(self):
        self.assertEqual(self.measure(-1, 0)["violations"], ["negativeNormalImpulseNs"])

    def test_separating_active_contact(self):
        self.assertEqual(self.measure(1, 1)["violations"], ["complementarityJ"])

    def test_rotational_point_velocity_at_fixed_pose(self):
        free, velocity = bodies(), bodies()
        p = point(0)
        p["pointM"] = [.25, .5, 0]
        velocity[1]["angularVelocityRadps"] = [0, 0, -2]
        result = study.contact_at_precision(p, free, velocity, 120)
        self.assertEqual(result["normalSpeedMps"], Decimal("-.5"))

    def test_exact_gate_equality_and_adjacent_decimal(self):
        self.assertEqual(study.classify_residuals({"x": Decimal("1e-10")}), [])
        self.assertEqual(study.classify_residuals({"x": Decimal("1.00000000000000000000000000001e-10")}), ["x"])

    def test_precision_classification_disagreement_refuses(self):
        low, high = self.measure(), self.measure()
        high["violations"] = ["complementarityJ"]
        with self.assertRaisesRegex(study.StudyError, "UNRESOLVED"):
            study.precision_agreement(low, high)

    def test_precision_numeric_disagreement_refuses(self):
        low, high = self.measure(), self.measure()
        high["normalSpeedMps"] = Decimal("1e-50")
        with self.assertRaisesRegex(study.StudyError, "UNRESOLVED"):
            study.precision_agreement(low, high)

    def test_endpoint_layout_and_duplicate_refuse(self):
        p, free, seen = point(), bodies(), set()
        study.point_layout(p, free, seen)
        with self.assertRaisesRegex(study.StudyError, "duplicate"):
            study.point_layout(p, free, seen)
        p["bIndex"] = 9
        with self.assertRaisesRegex(study.StudyError, "endpoint index"):
            study.point_layout(p, free, set())


class LayoutAndGeometryTests(unittest.TestCase):
    def test_raw_layout_preserves_negative_zero(self):
        source = bodies()
        raw_body = copy.deepcopy(source)
        raw_body[0]["velocityMps"][0] = -0.0
        values = [value for b in raw_body for field, _ in study.FIELDS for value in b[field]]
        raw = struct.pack("<117d", *values)
        restored = study.restore_frame(source, raw)
        self.assertEqual(struct.pack("<d", restored[0]["velocityMps"][0]).hex(), "0000000000000080")
        with self.assertRaisesRegex(study.StudyError, "raw frame bytes"):
            study.restore_frame(source, raw[:-1])

    def test_ten_frame_record_layout(self):
        b = bodies()
        stage = lambda name, velocity, final, points: {"stage": name, "ledger": {
            "freeBodies": b, "velocityBodies": velocity, "finalBodies": final, "points": points}}
        record = {"kind": "step", "scene": "ALIGNED", "before": {"state": {"bodies": b}},
                  "after": {"state": {"bodies": b}},
                  "stages": [stage("free-ready", None, None, None),
                             stage("velocity-ready", b, None, []), stage("closure-ready", b, b, [])],
                  "attempt": {"preBodies": b, "hypotheticalBodies": b}}
        self.assertEqual([name for name, _ in study.record_frames(record)],
                         ["before", "free-ready.free", "velocity-ready.free", "velocity-ready.velocity",
                          "closure-ready.free", "closure-ready.velocity", "closure-ready.final",
                          "attempt.pre", "attempt.hypothetical", "after"])
        record["stages"].reverse()
        with self.assertRaisesRegex(study.StudyError, "stage order"):
            study.record_frames(record)

    def test_axis_aligned_touching_support_witness(self):
        free, p = bodies(), point()
        low, high = (study.geometry_at_precision(p, free, precision) for precision in (80, 120))
        study.compare_geometry(low, high)
        self.assertEqual(high["supportPlaneGapM"], Decimal(0))
        self.assertEqual(len(high["a"]["supportCornersM"]), 4)
        self.assertTrue(high["lineIntersectsBoth"])
        self.assertEqual(high["lineWitnessGapM"], Decimal(0))
        self.assertTrue(high["lineMidpointWithinTolerance"])

    def test_separated_box_plane_gap(self):
        free, p = bodies(), point()
        free[1]["positionM"][1] = 1.0
        result = study.geometry_at_precision(p, free, 120)
        self.assertEqual(result["supportPlaneGapM"], Decimal(".25"))
        self.assertEqual(result["lineWitnessGapM"], Decimal(".25"))
        self.assertFalse(result["lineMidpointWithinTolerance"])

    def test_point_line_outside_obb(self):
        free, p = bodies(), point()
        p["pointM"][0] = 2
        result = study.geometry_at_precision(p, free, 120)
        self.assertFalse(result["lineIntersectsBoth"])
        self.assertIsNone(result["lineWitnessGapM"])


if __name__ == "__main__":
    unittest.main(verbosity=2)
