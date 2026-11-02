#!/usr/bin/env python3
"""Synthetic helper tests only. No archived campaign, World, or native atan2 calls."""
from fractions import Fraction
import gzip
import importlib.util
from pathlib import Path
import struct
import unittest

spec = importlib.util.spec_from_file_location('hinge_study', Path(__file__).with_name('hinge-study.py'))
study = importlib.util.module_from_spec(spec)
spec.loader.exec_module(study)


class HingeStudyHelpers(unittest.TestCase):
    def test_alternating_series_exact_remainder(self):
        ratio = Fraction(1, 8)
        lower, upper = study.atan_bounds(ratio)
        self.assertLess(ratio - ratio ** 3 / 3, lower)
        self.assertLess(lower, upper)
        self.assertLess(upper, ratio)
        self.assertEqual(upper - lower, ratio ** 129 / 129)

    def test_interval_rounds_to_one_known_binary_value(self):
        center = Fraction(1, 8)
        self.assertEqual(study.rounded_interval(center - Fraction(1, 2 ** 100),
                                               center + Fraction(1, 2 ** 100)), 0.125)

    def test_interval_across_halfway_is_unresolved(self):
        halfway = Fraction(1) + Fraction(1, 2 ** 53)
        with self.assertRaisesRegex(study.StudyError, 'UNRESOLVED'):
            study.rounded_interval(halfway - Fraction(1, 2 ** 100), halfway + Fraction(1, 2 ** 100))
        self.assertEqual(study.rounded_interval(halfway, halfway), 1.0)

    def test_series_domain_is_strict(self):
        for ratio in [Fraction(0), Fraction(-1, 8), Fraction(1, 4), Fraction(1), 0.125]:
            with self.assertRaises(study.StudyError):
                study.atan_bounds(ratio)

    def test_positive_binary_operand_contract(self):
        for y, x in [(0.0, 1.0), (-0.1, 1.0), (0.1, 0.0), (0.1, -1.0),
                     (float('nan'), 1.0), (0.1, float('inf')), (1, 8)]:
            with self.assertRaises(study.StudyError):
                study.certify(y, x)
        certificate = study.certify(0.125, 1.0)
        self.assertEqual(certificate['terms'], [64, 65])
        value = struct.unpack('<d', bytes.fromhex(certificate['atan2CorrectlyRoundedBits']))[0]
        self.assertGreater(value, 0.124)
        self.assertLess(value, 0.125)

    def test_basic_arithmetic_ties_to_even(self):
        self.assertEqual(study.binary(1.0, 2 ** -53, 'add'), 1.0)
        self.assertEqual(study.binary(1.0 + 2 ** -52, 2 ** -53, 'add'), 1.0 + 2 ** -51)

    def test_signed_zero_is_preserved(self):
        self.assertEqual(study.bits(study.binary(-0.0, 1.0, 'multiply')), '0000000000000080')
        self.assertEqual(study.bits(study.binary(-0.0, -0.0, 'add')), '0000000000000080')
        self.assertEqual(study.bits(study.binary(-0.0, 0.0, 'add')), '0000000000000000')
        self.assertEqual(study.bits(study.binary(1.0, -1.0, 'add')), '0000000000000000')

    def test_identity_relative_quaternion_and_dot(self):
        relative, y, x = study.operands([0.0, 0.0, 0.0, 1.0], [0.0, 0.0, 0.125, 1.0])
        self.assertEqual(relative, [0.0, 0.0, 0.125, 1.0])
        self.assertEqual((y, x), (0.125, 1.0))

    def test_json_duplicate_and_nonfinite_are_refused(self):
        for encoded in [b'{"a":1,"a":2}', b'{"a":NaN}', b'{"a":Infinity}', b'bad-json']:
            with self.assertRaises(study.StudyError):
                study.parse(encoded)

    def test_raw_frame_size_finite_values_and_zero_bits(self):
        raw = bytearray(416)
        struct.pack_into('<d', raw, 6 * 8, -0.0)
        decoded = study.raw_bodies(raw)
        self.assertEqual(study.bits(decoded[0][6]), '0000000000000080')
        with self.assertRaises(study.StudyError):
            study.raw_bodies(bytes(415))
        struct.pack_into('<d', raw, 0, float('nan'))
        with self.assertRaises(study.StudyError):
            study.raw_bodies(raw)

    def test_selected_span_authentication_and_prefix_bounds(self):
        selected = b'fixed-data\n'
        encoded = gzip.compress(b'prefix' + selected + b'trailer')
        locator = {'offset': 6, 'bytes': len(selected), 'sha256': study.sha(selected)}
        self.assertEqual(study.gzip_slice(encoded, locator, 100), selected)
        with self.assertRaises(study.StudyError):
            study.gzip_slice(encoded, locator, 6)
        with self.assertRaises(study.StudyError):
            study.gzip_slice(encoded, {**locator, 'sha256': '0' * 64}, 100)


if __name__ == '__main__':
    unittest.main(verbosity=2)
