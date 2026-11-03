"""ROOT ONLY: expand the frozen literals and use stdlib math.gcd once/pair."""
import math
import sys
from pathlib import Path
from support import HERE, authenticate, deadline, decimal, keys, load, pin, require, write


def operand(desc):
    require(isinstance(desc, dict) and len(desc) == 1, 'LITERAL_DESCRIPTOR')
    kind, value = next(iter(desc.items()))
    if kind == 'int':
        return decimal(value)
    if kind in ('pow2', 'ones'):
        require(type(value) is int and 0 <= value <= 8192, 'LITERAL_SHIFT')
        number = 1 << value  # Literal expansion alone permits this 8193-bit temporary.
        if kind == 'ones':
            number -= 1
    elif kind == 'scaledPow2':
        require(isinstance(value, list) and len(value) == 2, 'LITERAL_SCALE')
        factor, exponent = value
        require(type(factor) is int and abs(factor) <= 5 and type(exponent) is int
                and 0 <= exponent <= 8191, 'LITERAL_SCALE_BOUND')
        require(abs(factor).bit_length() + exponent <= 8192, 'LITERAL_PRE_SHIFT')
        number = factor << exponent
    elif kind == 'product':
        require(isinstance(value, list) and len(value) == 2, 'LITERAL_PRODUCT')
        require(all(type(x) is int and abs(x) <= 1000000009 for x in value),
                'LITERAL_PRODUCT_BOUND')
        number = value[0] * value[1]
    elif kind == 'fib':
        require(type(value) is int and 0 <= value <= 11001, 'LITERAL_FIB_INDEX')
        a, b = 0, 1
        for _ in range(value):
            require(max(a.bit_length(), b.bit_length()) + 1 <= 8193,
                    'LITERAL_FIB_PRE_ADD')
            a, b = b, a + b
        number = a
    else:
        raise ValueError('UNKNOWN_LITERAL')
    require(abs(number).bit_length() <= 8192, 'LITERAL_FINAL_BIT_CAP')
    return number


def bezout(a, b):
    """Plain full-precision extended Euclid; no leading-word/block algorithm."""
    if a == 0 and b == 0:
        return 0, 0, 0
    old_r, r = abs(a), abs(b)
    old_u, u, old_v, v = 1, 0, 0, 1
    iterations = 0
    while r:
        iterations += 1
        require(iterations <= 16385, 'REFERENCE_EUCLID_ITERATION_CAP')
        quotient, remainder = divmod(old_r, r)
        for coefficient in (u, v):
            require(quotient.bit_length() + abs(coefficient).bit_length() <= 16385,
                    'REFERENCE_BEZOUT_PRE_PRODUCT')
        qu, qv = quotient * u, quotient * v
        require(max(abs(old_u).bit_length(), abs(qu).bit_length()) + 1 <= 16385 and
                max(abs(old_v).bit_length(), abs(qv).bit_length()) + 1 <= 16385,
                'REFERENCE_BEZOUT_PRE_SUBTRACT')
        old_r, r = r, remainder
        old_u, u = u, old_u - qu
        old_v, v = v, old_v - qv
        require(max(abs(u).bit_length(), abs(v).bit_length(),
                    abs(old_u).bit_length(), abs(old_v).bit_length()) <= 8193,
                'REFERENCE_BEZOUT_COEFFICIENT_CAP')
    old_u = -old_u if a < 0 else old_u
    old_v = -old_v if b < 0 else old_v
    bound = max(abs(a), abs(b))
    require(abs(old_u) <= bound and abs(old_v) <= bound, 'REFERENCE_BEZOUT_FINAL_BOUND')
    return old_r, old_u, old_v


def main():
    deadline()
    require(len(sys.argv) == 2, 'USAGE: materialize.py FRESH_DIRECTORY')
    authenticate()
    spec = load(HERE / 'bank-spec.json')
    keys(spec, ('format', 'caseCount', 'cases'), 'SPEC_SCHEMA')
    require(spec['format'] == 'p4-independent-gcd-spec-v1' and
            spec['caseCount'] == 32 and len(spec['cases']) == 32, 'SPEC_COUNT')
    requests = {'op': 'gcd-bank', 'cases': []}
    oracle = {'format': 'p4-independent-gcd-oracle-v1', 'specPin': pin(HERE / 'bank-spec.json'),
              'requestPin': None, 'cases': []}
    seen = set()
    for index, case in enumerate(spec['cases']):
        require(case['id'] not in seen, 'DUPLICATE_CASE_ID')
        seen.add(case['id'])
        a, b = operand(case['a']), operand(case['b'])
        at, bt = str(a), str(b)
        decimal(at)
        decimal(bt)
        requests['cases'].append({'a': at, 'b': bt})
        gcd = math.gcd(a, b)
        euclid_gcd, u, v = bezout(a, b)
        require(gcd == euclid_gcd, 'INDEPENDENT_ORACLE_DISAGREEMENT')
        oracle['cases'].append({'index': index, 'id': case['id'],
                                'expected': {'gcd': str(gcd), 'u': str(u), 'v': str(v)},
                                'accelerationCoverage': case.get('accelerationCoverage', False)})
    destination = Path(sys.argv[1])
    destination.mkdir(parents=False, exist_ok=False)
    write(destination / 'requests.json', requests)
    oracle['requestPin'] = pin(destination / 'requests.json')
    write(destination / 'oracle.json', oracle)
    manifest = {'format': 'p4-independent-gcd-manifest-v1', 'caseCount': 32,
                'candidateInput': 'requests.json', 'oracleOnly': 'oracle.json',
                'specPin': pin(HERE / 'bank-spec.json'), 'sourcePins': load(HERE / 'PINS.json'),
                'files': {name: pin(destination / name) for name in ('requests.json', 'oracle.json')},
                'candidateCalls': 0, 'WorldCalls': 0}
    write(destination / 'manifest.json', manifest)


if __name__ == '__main__':
    main()
