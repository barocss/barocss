"""Root-only fixed12 groups. Author must not run/import this numerical suite."""
import copy
from decimal import Decimal, localcontext, Inexact, Rounded, ROUND_FLOOR, ROUND_HALF_EVEN
import json
from pathlib import Path
import struct
import subprocess
import sys
import unittest
import candidate


def body(name, center=(0, 0, 0), quaternion=(0, 0, 0, 1)):
    return {'id': name, 'kind': 'dynamic', 'positionM': list(center),
            'orientation': list(quaternion),
            'shape': {'kind': 'box', 'halfExtentsM': [.25, .25, .25]}}


def exact(value):
    if isinstance(value, Decimal):
        return 'decimal', value.as_tuple()
    if type(value) is float:
        return 'float64', struct.pack('>d', value).hex()
    if type(value) is dict:
        return 'dict', tuple((key, exact(item)) for key, item in value.items())
    if type(value) in (tuple, list):
        return type(value).__name__, tuple(exact(item) for item in value)
    return type(value).__name__, value


def outcome(function, *args, precision=80, rounding=ROUND_HALF_EVEN, incoming=False, trap=False):
    with localcontext() as context:
        context.prec = precision
        context.rounding = rounding
        context.clear_flags()
        context.flags[Inexact] = incoming
        context.flags[Rounded] = incoming
        context.traps[Inexact] = trap
        try:
            result = ('returned', exact(function(*args)))
        except Exception as error:
            result = ('raised', type(error).__name__, str(error))
        return result, tuple(context.flags[signal] for signal in candidate.SIGNALS)


class PreparedTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        candidate.authenticate()
        cls.baseline = candidate.load_original('independent_old_prepared_baseline')
        cls.prepared = candidate.PreparedReference(candidate.load_original('new_prepared_candidate'))
        cls.old = cls.baseline.PARENT.PARENT.SAT
        cls.new = cls.prepared.sat

    def compare_pair(self, a, b):
        request = {'a': a, 'b': b}
        self.assertEqual(outcome(self.old.evaluate, request), outcome(self.new.evaluate, request))

    def test_01_repeat_census(self):
        a, b = body('a'), body('b', (0, .5, 0))
        with self.prepared.scope() as scope:
            self.compare_pair(a, b)
            self.compare_pair(a, b)
            self.assertEqual(scope.stats['satPairCalls'], 8)
            self.assertEqual(scope.stats['basisRequests'], 16)
            self.assertGreater(scope.stats['decodeHits'], 0)
            self.assertGreater(scope.stats['basisHits'], 0)

    def test_02_nonorthonormal_and_sign(self):
        q = [.5, .5, .5, .5 + 2**-42]
        with self.prepared.scope():
            self.compare_pair(body('a', quaternion=q), body('b', (.125, .375, -.25)))
            self.compare_pair(body('a', quaternion=[-x for x in q]), body('b', (.125, .375, -.25)))

    def test_03_signed_zero(self):
        with self.prepared.scope():
            for zero in (0.0, -0.0, 0.0):
                self.compare_pair(body('a', (zero, 0, 0), (zero, 0, zero, 1)), body('b', (0, .5, 0)))

    def test_04_input_mutation(self):
        a, b = body('a'), body('b', (0, .5, 0))
        with self.prepared.scope():
            self.compare_pair(a, b)
            a['positionM'][0] = .125
            self.compare_pair(a, b)
            a['shape']['halfExtentsM'][0] = .375
            self.compare_pair(a, b)
            a['orientation'] = [.5, .5, .5, .5]
            self.compare_pair(a, b)

    def test_05_decoded_alias_isolation(self):
        raw = body('a')
        held = copy.deepcopy(raw)
        with self.prepared.scope() as scope:
            first = self.new.decode_body(raw)
            first['center'] = (Decimal(99), Decimal(99), Decimal(99))
            first['quaternion'] = (Decimal(99),) * 4
            second = self.new.decode_body(raw)
            self.assertEqual(exact(second), exact(self.old.decode_body(raw)))
            self.assertIsNot(first, second)
            self.assertGreater(scope.stats['decodeHits'], 0)
        self.assertEqual(raw, held)

    def test_06_precision_rounding(self):
        a = body('a', quaternion=[.5, .5, .5, .5 + 2**-42])
        with self.prepared.scope():
            for precision, rounding in ((80, ROUND_HALF_EVEN), (120, ROUND_HALF_EVEN),
                                        (80, ROUND_FLOOR), (80, ROUND_HALF_EVEN)):
                self.assertEqual(outcome(self.old.decode_body, a, precision=precision, rounding=rounding),
                                 outcome(self.new.decode_body, a, precision=precision, rounding=rounding))

    def test_07_flags_and_traps(self):
        a = body('a', quaternion=[.5, .5, .5, .5 + 2**-42])
        with self.prepared.scope() as scope:
            for incoming, trap in ((False, False), (True, False), (False, False), (False, True), (False, True)):
                self.assertEqual(outcome(self.old.decode_body, a, incoming=incoming, trap=trap),
                                 outcome(self.new.decode_body, a, incoming=incoming, trap=trap))
            self.assertGreater(scope.stats['decodeComputations'], scope.stats['peakBodyEntries'])

    def test_08_invalid_after_hit(self):
        valid = body('a')
        variants = []
        for field, value in (('orientation', [0, 0, 0, 0]), ('positionM', [float('nan'), 0, 0]),
                             ('positionM', [True, 0, 0]), ('positionM', [0, 0])):
            changed = copy.deepcopy(valid)
            changed[field] = value
            variants.append(changed)
        changed = copy.deepcopy(valid); changed['shape']['halfExtentsM'][0] = 0; variants.append(changed)
        changed = copy.deepcopy(valid); changed['shape']['kind'] = 'sphere'; variants.append(changed)
        with self.prepared.scope():
            self.assertEqual(outcome(self.old.decode_body, valid), outcome(self.new.decode_body, valid))
            for raw in variants + variants:
                self.assertEqual(outcome(self.old.decode_body, raw), outcome(self.new.decode_body, raw))

    def test_09_non_native_and_decoded_changes(self):
        with self.prepared.scope():
            self.compare_pair(body('same'), body('same', (0, .5, 0)))
            raw = body('a'); raw['positionM'][0] = Decimal('0.125')
            self.assertEqual(outcome(self.old.decode_body, raw), outcome(self.new.decode_body, raw))
            a, b = body('a'), body('b', (0, .5, 0))
            old_a, old_b = self.old.decode_body(a), self.old.decode_body(b)
            new_a, new_b = self.new.decode_body(a), self.new.decode_body(b)
            old_a['quaternion'] = tuple(-x for x in old_a['quaternion'])
            new_a['quaternion'] = tuple(-x for x in new_a['quaternion'])
            old_a['quaternionNorm'] = Decimal(2); new_a['quaternionNorm'] = Decimal(2)
            self.assertEqual(outcome(self.old.sat_pair, old_a, old_b, True),
                             outcome(self.new.sat_pair, new_a, new_b, True))

    def test_10_error_restoration(self):
        with self.assertRaises(self.new.ReferenceInputError):
            with self.prepared.scope() as scope:
                self.new.decode_body(body('a', quaternion=(0, 0, 0, 0)))
        self.assertFalse(self.prepared.active)
        self.assertIs(self.new.decode_body, self.prepared.original_decode)
        self.assertIs(self.new.sat_pair, self.prepared.original_sat_pair)
        self.assertIs(self.new.quaternion_basis, self.prepared.original_basis)
        self.assertEqual((scope.bodies, scope.bases, scope.tokens, scope.pair), ({}, {}, {}, None))

    def test_11_request_isolation(self):
        for offset in (0, .125):
            with self.prepared.scope() as scope:
                self.assertEqual(scope.stats['decodeRequests'], 0)
                self.assertEqual(scope.bodies, {})
                self.compare_pair(body('a', (offset, 0, 0)), body('b', (0, .5, 0)))
            self.assertEqual(scope.bodies, {})

    def test_12_saved_six_complete_cli_replies(self):
        bank = json.loads((candidate.HERE / 'BANK.json').read_text())
        requests = b''.join((candidate.ROOT / case['request']).read_bytes() for case in bank['cases'])
        expected = b''.join((candidate.ROOT / case['reply']).read_bytes() for case in bank['cases'])
        self.assertLessEqual(len(requests), 2 * 1024 * 1024)
        self.assertLessEqual(len(expected), 2 * 1024 * 1024)
        process = subprocess.run([sys.executable, '-B', str(candidate.HERE / 'candidate.py')],
                                 input=requests, stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                                 timeout=150, check=False)
        self.assertEqual(process.returncode, 0, process.stderr[:2048])
        self.assertEqual(process.stderr, b'')
        self.assertEqual(process.stdout, expected)
        self.assertEqual(len(process.stdout.splitlines()), 6)


if __name__ == '__main__':
    unittest.main(verbosity=2)
