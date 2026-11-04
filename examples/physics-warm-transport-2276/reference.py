#!/usr/bin/env python3
"""Fixed independent exact Gram bank; no candidate or engine imports."""
from fractions import Fraction as F
from hashlib import sha256
from pathlib import Path
import json
import re
import struct
import sys

HOME = Path(__file__).resolve().parent
BANK = (
    ('changed-normal', [0.03, 0.0, -0.02], [-0.1, 0.99, 0.1]),
    ('nonunit-normal', [0.25, -0.125, 0.5], [2.0, 3.0, -4.0]),
    ('zero-tangent', [0.0, 0.0, 0.0], [-0.1, 0.99, 0.1]),
    ('already-tangent', [0.25, 0.0, -0.5], [0.0, 1.0, 0.0]),
    ('reversed-normal', [0.03, 0.0, -0.02], [0.1, -0.99, -0.1]),
    ('scaled-normal', [0.25, -0.125, 0.5], [4.0, 6.0, -8.0]),
    ('parallel-tangent', [0.5, 0.75, -1.0], [2.0, 3.0, -4.0]),
    ('oblique-three-components', [-0.0625, 0.03125, 0.125], [0.6, -0.8, 0.0]),
    ('zero-normal-refusal', [0.25, -0.125, 0.5], [0.0, 0.0, 0.0]),
)


def dot(a, b):
    return sum((x*y for x, y in zip(a, b)), F(0))


def rat(value):
    assert max(value.numerator.bit_length(), value.denominator.bit_length()) <= 16384
    return {'n': str(value.numerator), 'd': str(value.denominator)}


def words(values):
    return [struct.pack('>d', value).hex() for value in values]


def encode(value):
    return (json.dumps(value, sort_keys=True, separators=(',', ':'), allow_nan=False)+'\n').encode()


def main():
    if len(sys.argv) != 2 or not re.fullmatch(r'[a-z0-9][a-z0-9-]{0,63}', sys.argv[1]):
        raise ValueError('fresh evidence ID required')
    out = HOME/'evidence'/sys.argv[1]
    out.parent.mkdir(exist_ok=True)
    out.mkdir()
    rows = []
    for name, tangent, normal in BANK:
        t, n = ([F.from_float(x) for x in values] for values in (tangent, normal))
        n2 = dot(n, n)
        row = {'id': name, 'tangentNs': tangent, 'normal': normal,
               'tangentWords': words(tangent), 'normalWords': words(normal)}
        if n2 == 0:
            row['expected'] = {'status': 'UNRESOLVED', 'code': 'WARM_TRANSPORT_UNRESOLVED'}
        else:
            # Independent Gram subtraction; no nested cross expression.
            coefficient = dot(t, n)/n2
            projected = [x-y*coefficient for x, y in zip(t, n)]
            normal_component = dot(projected, n)
            removed_norm2 = dot(t, t)-dot(projected, projected)
            assert normal_component == 0 and removed_norm2 >= 0
            row['expected'] = {'status': 'PROJECTED', 'tangentExactNs': [rat(v) for v in projected],
                               'normalComponentExactNs': rat(normal_component),
                               'removedSquaredMagnitude': rat(removed_norm2),
                               'correctlyRoundedGramWords': words([float(v) for v in projected])}
        rows.append(row)
    result = {'format': 'physics-warm-transport-gram-bank', 'version': 1,
              'status': 'INDEPENDENT_GRAM_BANK_READY', 'cases': rows,
              'gates': {'componentErrorNs': 1e-12, 'currentTangentPlaneNs': 1e-12},
              'WorldCalls': 0, 'candidateCalls': 0, 'caseCount': len(rows),
              'exactIntegerBits': 16384, 'scope': 'fixed finite helper inputs only'}
    data = encode(result)
    assert len(data) <= 65536
    with (out/'bank.json').open('xb') as stream:
        stream.write(data)
    receipt = {'status': result['status'], 'file': 'bank.json', 'bytes': len(data),
               'sha256': sha256(data).hexdigest(), 'WorldCalls': 0, 'candidateCalls': 0,
               'referenceSHA256': sha256(Path(__file__).read_bytes()).hexdigest()}
    with (out/'result.json').open('xb') as stream:
        stream.write(encode(receipt))
    print(json.dumps(receipt))


if __name__ == '__main__':
    main()
