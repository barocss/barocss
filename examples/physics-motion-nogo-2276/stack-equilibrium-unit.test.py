#!/usr/bin/env python3
"""Synthetic certificate controls. No historical archive is opened."""
import copy
import importlib.util
from pathlib import Path
from fractions import Fraction
import unittest

spec = importlib.util.spec_from_file_location("stack_equilibrium", Path(__file__).with_name("stack-equilibrium.py"))
E = importlib.util.module_from_spec(spec)
spec.loader.exec_module(E)


def fixture():
    free = [{"id": "cube-"+str(i), "kind": "dynamic", "shape": {"kind": "box", "halfExtentsM": [.25]*3},
             "positionM": [0, .25+.5*i, 0], "velocityMps": [0, -.125, 0],
             "orientation": [0, 0, 0, 1], "angularVelocityRadps": [0, 0, 0], "inverseMass": 1,
             "inverseInertiaLocal": [24]*3, "frictionStatic": 1, "frictionDynamic": .7, "restitution": 0}
            for i in range(8)]
    free.append({"id": "foundation", "kind": "static", "shape": {"kind": "box", "halfExtentsM": [2, .1, 2]},
                 "positionM": [0, -.1, 0], "velocityMps": [0, 0, 0], "orientation": [0, 0, 0, 1],
                 "angularVelocityRadps": [0, 0, 0], "inverseMass": 0, "inverseInertiaLocal": [0]*3,
                 "frictionStatic": 1, "frictionDynamic": .7, "restitution": 0})
    points = []
    for interface, (a, b) in enumerate([(i, i+1) for i in range(7)] + [(0, 8)]):
        normal = [0, -1 if b == 8 else 1, 0]
        y = 0 if b == 8 else .5+.5*a
        for x in (-.25, .25):
            for z in (-.25, .25):
                points.append({"aId": free[a]["id"], "bId": free[b]["id"], "aIndex": a, "bIndex": b,
                               "pairKey": free[a]["id"]+"\0"+free[b]["id"],
                               "pointId": str(interface)+":"+str(x)+":"+str(z), "family": "face",
                               "pointM": [x, y, z], "normal": normal,
                               "aPositionM": free[a]["positionM"][:], "bPositionM": free[b]["positionM"][:],
                               "warm": {"normalNs": 0, "tangentNs": [0, 0, 0]},
                               "final": {"normalNs": .01, "tangentNs": [0, 0, 0]}})
    return free, points


class ExactCertificateTests(unittest.TestCase):
    def test_exact_fraction_feasibility_all32rows(self):
        free, points = fixture()
        result = E.certificate(free, points, 9.81, 1/120)
        self.assertEqual(len(result["pointRows"]), 32)
        self.assertTrue(result["exactVelocityAndSpinZero"])
        self.assertTrue(all(row["normalSpeedMps"] == 0 and row["complementarityJ"] == 0 for row in result["pointRows"]))
        self.assertEqual(result["pointRows"][0]["normalImpulseNs"], Fraction(7, 32))
        self.assertEqual(result["pointRows"][-1]["normalImpulseNs"], Fraction(1, 4))

    def test_loads_do_not_use_id_suffixes_or_row_order(self):
        free, points = fixture()
        for i, body in enumerate(free):
            body["id"] = ["tango", "seven", "root-name", "bravo", "z", "one", "floor-name", "x", "a"][i]
        points.reverse()
        for point in points:
            point["aId"] = free[point["aIndex"]]["id"]
            point["bId"] = free[point["bIndex"]]["id"]
            point["pairKey"] = point["aId"]+"\0"+point["bId"]
        result = E.certificate(free, points, 9.81, 1/120)
        self.assertEqual(result["chainBodyIdsFromStaticRoot"][0], "a")
        self.assertEqual(result["pointRows"][0]["supportedDynamicCount"], 8)

    def test_unequal_free_velocity_refuses(self):
        free, points = fixture()
        free[7]["velocityMps"][1] = -.25
        with self.assertRaisesRegex(E.CertificateRefused, "unequal free velocity"):
            E.certificate(free, points, 9.81, 1/120)

    def test_branched_topology_refuses(self):
        free, points = fixture()
        # Redirect the top interface to an interior node, creating a branch.
        for point in points[24:28]:
            point["aIndex"] = 5
        with self.assertRaises(E.CertificateRefused):
            E.chain(free, points)

    def test_missing_actual_corner_refuses(self):
        free, points = fixture()
        points[0]["pointM"][0] = 0
        with self.assertRaisesRegex(E.CertificateRefused, "symmetric actual corners"):
            E.certificate(free, points, 9.81, 1/120)

    def test_nonzero_warm_impulse_refuses(self):
        free, points = fixture()
        points[0]["warm"]["normalNs"] = .1
        with self.assertRaisesRegex(E.CertificateRefused, "cold first frame"):
            E.certificate(free, points, 9.81, 1/120)

    def test_ideal_gravity_product_is_reported_separately(self):
        free, points = fixture()
        result = E.certificate(free, points, 9.81, 1/120)
        self.assertEqual(result["savedStoppingSpeedMps"], Fraction(1, 8))
        self.assertEqual(result["exactGravityDtSpeedMps"], Fraction.from_float(9.81)*Fraction.from_float(1/120))
        self.assertNotEqual(result["stoppingMinusGravityDtMps"], 0)

    def test_exact_zero_torque_for_all_dynamic_bodies(self):
        free, points = fixture()
        result = E.certificate(free, points, 9.81, 1/120)
        self.assertTrue(all(body["netTorqueNms"] == (Fraction(0),)*3 for body in result["bodyCertificate"]))


class IndependentGeometryTests(unittest.TestCase):
    def test_all32_axis_aligned_witnesses(self):
        free, points = fixture()
        result = E.geometry(free, points)
        self.assertEqual(len(result), 32)
        self.assertTrue(all(row["pointToLineWitnessMidpointM"] <= E.S.GEOMETRY_GATE for row in result))

    def test_invalid_geometry_refuses(self):
        free, points = fixture()
        points[0]["pointM"][0] = 2
        with self.assertRaisesRegex(E.CertificateRefused, "geometry rejected"):
            E.geometry(free, points)

    def test_floor_penetration_is_retained(self):
        free, points = fixture()
        for body in free[:8]:
            body["positionM"][1] -= .125
        for point in points:
            point["pointM"][1] -= .0625 if point["bIndex"] == 8 else .125
        result = E.geometry(free, points)
        self.assertEqual(result[-1]["supportPlaneGapM"], E.S.Decimal("-.125"))


if __name__ == "__main__":
    unittest.main(verbosity=2)
