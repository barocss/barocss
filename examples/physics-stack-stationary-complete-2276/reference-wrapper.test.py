"""Fixed synthetic protocol controls. No solver/World/reference evaluation is executed."""
import copy
import importlib.util
from pathlib import Path
import struct
from types import SimpleNamespace
import unittest

HOME = Path(__file__).resolve().parent
ROOT = HOME.parents[1]

def load(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(module)
    return module

wrapper = load(HOME / 'reference-wrapper.py', 'stationary_wrapper_controls')
checker = load(ROOT / 'examples/physics-stack-stationary-witness-2276/checker.py', 'stationary_checker_controls')

class InputError(ValueError):
    pass

def original(reply):
    calls = []
    def evaluate(request):
        calls.append(request)
        return reply
    return SimpleNamespace(evaluate=evaluate, F=SimpleNamespace(InputError=InputError), MESSAGE='original reference input', calls=calls)

def envelope():
    return {'problem': {'zero': 0.0}, 'result': {'zero': 0.0},
            'problemWordsF64leHex': '0000000000000080', 'resultWordsF64leHex': '0000000000000000'}

class Protocol(unittest.TestCase):
    def test_01_nonworld_delegates_same_object(self):
        reply = {'original': True}
        module = original(reply)
        checked = SimpleNamespace(verify=lambda *_: self.fail('checker called on nonworld'))
        wrapper.install(module, checked)
        for op in ['step-ledger', 'unknown', 'kernel']:
            request = {'op': op, wrapper.KEY: 'not stripped on other ops'}
            self.assertIs(module.evaluate(request), reply)
            self.assertIs(module.calls[-1], request)

    def test_02_exact_four_keys_required(self):
        for missing in envelope():
            value = envelope()
            del value[missing]
            module = original({})
            wrapper.install(module, checker)
            with self.assertRaises(InputError):
                module.evaluate({'op': 'world', wrapper.KEY: value})
            self.assertEqual(module.calls, [])
        for value in [None, [], {**envelope(), 'extra': 0}]:
            module = original({})
            wrapper.install(module, checker)
            with self.assertRaises(InputError):
                module.evaluate({'op': 'world', wrapper.KEY: value})

    def test_03_strip_only_envelope_restore_both_zero_signs_no_input_mutation(self):
        reply = {'ok': True, 'resolved': True, 'executionFailure': False, 'violations': [], 'reference': {'unmodified': [1, 2]}}
        module = original(reply)
        seen = []
        def verify(problem, result):
            seen.append((problem, result))
            self.assertEqual(struct.pack('<d', problem['zero']).hex(), '0000000000000080')
            self.assertEqual(struct.pack('<d', result['zero']).hex(), '0000000000000000')
            return {'ok': True, 'resolved': True, 'executionFailure': False, 'violations': []}
        wrapper.install(module, SimpleNamespace(restore_words=checker.restore_words, verify=verify))
        request = {'op': 'world', 'scene': 'ALIGNED', 'stepIndex': 1, 'oldUnknownKey': {'untouched': True}, wrapper.KEY: envelope()}
        before = copy.deepcopy(request)
        actual = module.evaluate(request)
        self.assertEqual(request, before)
        self.assertNotIn(wrapper.KEY, module.calls[0])
        self.assertEqual(module.calls[0], {key: value for key, value in request.items() if key != wrapper.KEY})
        self.assertIs(module.calls[0]['oldUnknownKey'], request['oldUnknownKey'])
        self.assertIs(actual['reference'], reply['reference'])
        self.assertNotIn(wrapper.KEY, reply)
        self.assertEqual(len(seen), 1)
        self.assertEqual(struct.pack('<d', request[wrapper.KEY]['problem']['zero']).hex(), '0000000000000000')

    def test_04_bad_words_are_known_input_refusals_not_positive_witnesses(self):
        variants = []
        for field in ['problemWordsF64leHex', 'resultWordsF64leHex']:
            for bad in ['', 'x'*16, '000000000000f03f', '0000000000000000'*2, None]:
                value = envelope()
                value[field] = bad
                variants.append(value)
        for value in variants:
            module = original({'ok': True})
            def forbidden(*_):
                self.fail('invalid word sidecar reached verify')
            wrapper.install(module, SimpleNamespace(restore_words=checker.restore_words, verify=forbidden))
            with self.assertRaises(InputError):
                module.evaluate({'op': 'world', wrapper.KEY: value})
        # Known TypeError from restore is also routed to the old InputError catch.
        module = original({})
        def invalid_type(*_):
            raise TypeError('known malformed transport type')
        wrapper.install(module, SimpleNamespace(restore_words=invalid_type))
        with self.assertRaises(InputError):
            module.evaluate({'op': 'world', wrapper.KEY: envelope()})

    def test_05_old_reply_and_exact_refusal_are_distinct(self):
        old = {'ok': True, 'resolved': True, 'executionFailure': False, 'violations': [], 'reference': {'old': 'proof'}}
        module = original(old)
        # Actual candidate-free verifier refuses malformed problem/result; no solve is involved.
        wrapper.install(module, checker)
        result = module.evaluate({'op': 'world', wrapper.KEY: envelope()})
        self.assertTrue(result['ok'])
        self.assertTrue(result['resolved'])
        self.assertEqual(result['violations'], [])
        self.assertFalse(result[wrapper.KEY]['ok'])
        self.assertFalse(result[wrapper.KEY]['resolved'])
        self.assertTrue(result[wrapper.KEY]['executionFailure'])
        self.assertNotIn(wrapper.KEY, old)
        self.assertIs(result['reference'], old['reference'])

    def test_06_unexpected_old_math_exception_is_not_hidden(self):
        module = original({})
        def fail(_):
            raise RuntimeError('original math execution failure')
        module.evaluate = fail
        wrapper.install(module, checker)
        with self.assertRaisesRegex(RuntimeError, 'original math execution failure'):
            module.evaluate({'op': 'world', wrapper.KEY: envelope()})

if __name__ == '__main__':
    unittest.main()
