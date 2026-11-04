"""Root-owned saved-data controls. No World, candidate or new trajectory calls."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import struct

HOME = Path(__file__).resolve().parent
PAID = HOME / 'evidence/api-01'
spec = importlib.util.spec_from_file_location('independent_dynamic_reference', HOME / 'oracle.py')
oracle = importlib.util.module_from_spec(spec)
spec.loader.exec_module(oracle)


def pin(path):
    data = path.read_bytes()
    return {'bytes': len(data), 'sha256': hashlib.sha256(data).hexdigest()}


def main():
    paths = [Path(__file__).resolve(), HOME / 'oracle.py', PAID / 'result.json']
    ids = ['gravity-fall', 'delayed-pair', 'ballistic-60', 'ballistic-120', 'ballistic-240']
    paths += [PAID / ('native-' + case + '.json') for case in ids]
    before = {str(p): pin(p) for p in paths}
    paid = json.loads((PAID / 'result.json').read_text())
    assert paid['status'] == 'DYNAMIC_NEXT_NUMERICAL_SOURCE_NATIVE_CONFIRMED'
    assert paid['sourceIntegrity'] == 'PASS'
    data, checks = {}, []
    for case in ids:
        packet = json.loads((PAID / ('native-' + case + '.json')).read_text())
        assert packet['format'] == 'dynamic-next-case-v1'
        value = oracle.restore_words(packet['data'], packet['numericWordsF64leHex'])
        reply = oracle.verify(value)
        assert reply['ok'] and reply['resolved'] and not reply['executionFailure'], case
        data[case] = value
        checks.append({'name': 'paid-' + case, 'expected': 'PASS', 'observed': 'PASS'})

    def negative(name, case, mutate, invalid=False):
        value = copy.deepcopy(data[case])
        mutate(value)
        reply = oracle.verify(value)
        assert reply['ok'] is False and bool(reply['executionFailure']) == invalid, (name, reply)
        checks.append({'name': name, 'expected': 'INVALID' if invalid else 'PHYSICAL_FAIL',
                       'observed': 'INVALID' if reply['executionFailure'] else 'PHYSICAL_FAIL',
                       'violations': reply['violations']})

    negative('wrong-free-velocity', 'ballistic-120',
             lambda d: d['states'][10]['bodies'][0]['velocityMps'].__setitem__(1, -.7))
    negative('wrong-free-position', 'ballistic-120',
             lambda d: d['states'][-1]['bodies'][0]['positionM'].__setitem__(1, 5.1))
    negative('wrong-outgoing-pair-velocity', 'delayed-pair',
             lambda d: d['states'][8]['bodies'][1]['velocityMps'].__setitem__(1, -.7))
    negative('wrong-contact-impulse', 'delayed-pair',
             lambda d: d['states'][8]['contacts'][0].__setitem__('normalImpulseNs', 3))
    negative('missing-first-contact', 'gravity-fall',
             lambda d: d['states'][27].__setitem__('contacts', []))
    negative('penetrating-final-body', 'gravity-fall',
             lambda d: d['states'][-1]['bodies'][0]['positionM'].__setitem__(1, .49))
    negative('unsupported-model-mass', 'gravity-fall',
             lambda d: d['model']['bodies'][0].__setitem__('massKg', 3), invalid=True)
    negative('missing-state-body', 'gravity-fall',
             lambda d: d['states'][4].__setitem__('bodies', []), invalid=True)
    for name, hexadecimal in [('missing-word', ''), ('mismatched-word', '000000000000f03f'),
                              ('trailing-word', '00000000000000000000000000000000'),
                              ('nonfinite-word', '000000000000f87f')]:
        try:
            oracle.restore_words({'x': 0}, hexadecimal)
        except oracle.Invalid:
            checks.append({'name': name, 'expected': 'INVALID', 'observed': 'INVALID'})
        else:
            raise AssertionError(name)
    signed = oracle.restore_words({'x': 0}, '0000000000000080')
    assert struct.pack('<d', signed['x']).hex() == '0000000000000080'
    checks.append({'name': 'signed-zero-restoration', 'expected': 'PASS', 'observed': 'PASS'})
    assert before == {str(p): pin(p) for p in paths}, 'paid inputs changed'
    print(json.dumps({'status': 'SAVED_DYNAMIC_ORACLE_CONTROLS_CONFIRMED', 'checks': checks,
                      'inputPins': before, 'newWorldCalls': 0, 'newTrajectoryCalls': 0,
                      'scope': 'Saved actual data mutations; no added physical qualification'}, separators=(',', ':')))


if __name__ == '__main__':
    main()
