"""Independent Fraction matvec verifier. No candidate/triangle/solver imports."""
from fractions import Fraction
from math import gcd, isfinite
import json
import re
import struct
import sys

CAP = 2 * 1024 * 1024


def need(ok, message):
    if not ok:
        raise ValueError(message)


def number(x):
    need(type(x) in (int, float), 'number type')
    x = float(x)
    need(isfinite(x), 'finite number')
    return x


def vector(x, length=3):
    need(type(x) is list and len(x) == length, 'vector shape')
    return [number(v) for v in x]


def word(x):
    return struct.pack('>d', number(x)).hex()


def restore_words(value, hex_words):
    """Lossless numeric-leaf transport. No solver or reflection hooks."""
    need(type(hex_words) is str and len(hex_words) % 16 == 0 and len(hex_words) <= 16384*16
         and re.fullmatch('[0-9a-f]*', hex_words) is not None, 'word sidecar shape')
    raw = bytes.fromhex(hex_words)
    cursor = nodes = 0

    def walk(item, depth):
        nonlocal cursor, nodes
        nodes += 1
        need(nodes <= 262144 and depth <= 64, 'word graph bound')
        if type(item) in (int, float):
            need(cursor+8 <= len(raw), 'missing numeric word')
            actual = struct.unpack_from('<d', raw, cursor)[0]
            cursor += 8
            need(isfinite(actual) and actual == number(item), 'JSON numeric value differs from word')
            return actual
        if type(item) is list:
            return [walk(x, depth+1) for x in item]
        if type(item) is dict:
            need(all(type(k) is str for k in item), 'JSON object keys')
            return {k: walk(v, depth+1) for k, v in item.items()}
        need(item is None or type(item) in (str, bool), 'JSON data required')
        return item

    restored = walk(value, 0)
    need(cursor == len(raw), 'trailing numeric words')
    return restored


def integer(text, positive=False):
    need(type(text) is str and len(text) <= 4934 and re.fullmatch(r'-?(0|[1-9][0-9]*)', text) and text != '-0', 'canonical integer')
    negative = text.startswith('-')
    digits = text[1:] if negative else text
    n = 0
    # Bounded short chunks avoid changing CPython's process-wide decimal limit.
    for i in range(0, len(digits), 9):
        chunk = digits[i:i+9]
        n = n * 10 ** len(chunk) + int(chunk)
        need(n.bit_length() <= 16384, 'ratio bit limit')
    n = -n if negative else n
    need(not positive or n > 0, 'positive denominator')
    return n


def fraction(value):
    need(type(value) is dict and set(value) == {'n', 'd'}, 'ratio fields')
    n, d = integer(value['n']), integer(value['d'], True)
    need(gcd(abs(n), d) == 1, 'reduced ratio')
    return Fraction(n, d)


def F(x):
    return Fraction.from_float(number(x))


def cross(a, b):
    return [a[1]*b[2]-a[2]*b[1], a[2]*b[0]-a[0]*b[2], a[0]*b[1]-a[1]*b[0]]


def verify(problem, result, expected_dynamic=8):
    """Default production9/32; explicit1/2 is solely for the unit-core harness."""
    try:
        need(expected_dynamic in (1, 2, 8), 'checker population')
        need(type(problem) is dict and set(problem) == {'bodies', 'points'}, 'problem fields')
        bodies, points = problem['bodies'], problem['points']
        need(type(bodies) is list and len(bodies) == expected_dynamic+1, 'body population')
        need(type(points) is list and len(points) == 4*expected_dynamic, 'point population')
        need(type(result) is dict and result.get('ok') is True and result.get('status') == 'SOLVED_STATIONARY_WITNESS', 'successful witness required')
        ids = {b['id']: i for i, b in enumerate(bodies)}
        need(len(ids) == len(bodies), 'unique bodies')
        dynamic = [i for i, b in enumerate(bodies) if number(b['inverseMass']) == 1]
        fixed = [i for i, b in enumerate(bodies) if number(b['inverseMass']) == 0]
        need(len(dynamic) == expected_dynamic and len(fixed) == 1, 'mass profile')
        for i, b in enumerate(bodies):
            need(set(b) == {'id', 'positionM', 'velocityMps', 'angularVelocityRadps', 'inverseMass', 'inverseInertiaWorld'}, 'body fields')
            need(all(abs(x) <= 10000 for x in vector(b['positionM'])), 'position bound'); v = vector(b['velocityMps']); w = vector(b['angularVelocityRadps'])
            inertia = b['inverseInertiaWorld']
            need(type(inertia) is list and len(inertia) == 3, 'inertia shape')
            need(all(vector(row)[j] == (24 if i in dynamic and k == j else 0) for k, row in enumerate(inertia) for j in range(3)), 'inertia profile')
            need(v[0] == v[2] == 0 and all(x == 0 for x in w) and -1 <= v[1] <= 0 and (i in dynamic or v[1] == 0), 'free motion profile')
        side = result['exactApplied']
        need(type(side) is dict and set(side) == {'format', 'points', 'dynamicResiduals', 'allRowsPrimalZero', 'allRowsComplementarityZero', 'nonnegative'}, 'sidecar fields')
        need(side['format'] == 'STATIONARY_FLOAT_J_RATIOS_V1' and len(side['points']) == len(points), 'sidecar shape')
        need(all(side.get(k) is True for k in ('allRowsPrimalZero', 'allRowsComplementarityZero', 'nonnegative')), 'certificate flags')
        rounded = result['normalImpulsesNs']; returned = result['bodies']
        diagnostic = result['roundedReconstruction']
        diagnostic_keys = {'maxVelocityErrorMps', 'maxAngularVelocityErrorRadps', 'maxUnscaledMassWeightedResidualSqrtJ'}
        need(type(diagnostic) is dict and set(diagnostic) == diagnostic_keys
             and all(number(v) >= 0 for v in diagnostic.values()), 'rounded diagnostic fields')
        stats = result['stats']
        limits = {'rationalOperations': 200000, 'integerOperations': 2000000, 'peakIntegerBits': 16384,
                  'triangleTrials': 4*expected_dynamic, 'interfacesProcessed': expected_dynamic}
        need(type(stats) is dict and set(stats) == set(limits), 'stats fields')
        need(all(type(stats[k]) in (int, float) and isfinite(float(stats[k])) and float(stats[k]).is_integer()
                 and 0 <= stats[k] <= limit for k, limit in limits.items()), 'stats bounds')
        need(stats['interfacesProcessed'] == expected_dynamic, 'completed interfaces')
        need(len(rounded) == len(points) and len(returned) == len(bodies), 'result population')
        exact = [[Fraction(0) for _ in range(6)] for _ in bodies]
        geometric = [[Fraction(0) for _ in range(3)] for _ in bodies]
        rounded_j = [[Fraction(0) for _ in range(6)] for _ in bodies]
        violations = []
        point_ids = set()
        for k, (p, proof) in enumerate(zip(points, side['points'])):
            need(set(p) == {'id', 'aId', 'bId', 'pointM', 'normalAtoB'}, 'point fields')
            need(p['id'] not in point_ids and proof['id'] == p['id'], 'point identity/order'); point_ids.add(p['id'])
            need(set(proof) == {'id', 'a', 'b', 'lambda', 'roundedWord'}, 'point proof fields')
            n = vector(p['normalAtoB']); position = vector(p['pointM']); need(all(abs(x) <= 10000 for x in position), 'point position bound')
            need(n[0] == n[2] == 0 and abs(n[1]) == 1, 'vertical profile')
            lam = fraction(proof['lambda']); need(lam >= 0, 'negative exact lambda')
            need(word(float(lam)) == proof['roundedWord'] == word(rounded[k]), 'RNE lambda word')
            for name, body_id, sign in (('a', p['aId'], -1), ('b', p['bId'], 1)):
                need(body_id in ids and p['aId'] != p['bId'], 'endpoint identity')
                i = ids[body_id]; centre = vector(bodies[i]['positionM'])
                arm = [position[j]-centre[j] for j in range(3)]
                need(all(abs(x) <= 10 for x in arm), 'arm bound')
                torque = cross(arm, n)
                coeff = [sign*x for x in n+torque]
                endpoint = proof[name]
                need(type(endpoint) is dict and set(endpoint) == {'bodyId', 'coefficients', 'words'}, 'endpoint fields')
                need(endpoint['bodyId'] == body_id and endpoint['words'] == [word(x) for x in coeff], 'coefficient word provenance')
                need(vector(endpoint['coefficients'], 6) == coeff, 'coefficient values')
                for j in range(6):
                    exact[i][j] += F(coeff[j])*lam
                true_arm = [F(position[j])-F(centre[j]) for j in range(3)]
                true_tau = cross(true_arm, [sign*F(x)*lam for x in n])
                for j in range(3):
                    geometric[i][j] += true_tau[j]
                rounded_impulse = [sign*F(x)*F(rounded[k]) for x in n]
                rounded_tau = cross(true_arm, rounded_impulse)
                for j in range(3):
                    rounded_j[i][j] += rounded_impulse[j]
                    rounded_j[i][j+3] += rounded_tau[j]
        residuals = []
        max_v = max_w = max_geometric = Fraction(0)
        for i, (before, after) in enumerate(zip(bodies, returned)):
            need(set(before) == set(after), 'body fields')
            for key in ('id', 'positionM', 'inverseMass', 'inverseInertiaWorld'):
                need(before[key] == after[key], 'fixed body data')
            need([word(x) for x in vector(before['positionM'])] == [word(x) for x in vector(after['positionM'])], 'position words')
            need(word(before['inverseMass']) == word(after['inverseMass']) and
                 [word(x) for row in before['inverseInertiaWorld'] for x in row] == [word(x) for row in after['inverseInertiaWorld'] for x in row], 'mass/inertia words')
            if i in fixed:
                need([word(x) for x in vector(before['velocityMps'])+vector(before['angularVelocityRadps'])] == [word(x) for x in vector(after['velocityMps'])+vector(after['angularVelocityRadps'])], 'static words')
                continue
            need(all(word(x) == '0000000000000000' for x in vector(after['velocityMps'])+vector(after['angularVelocityRadps'])), 'canonical zero state')
            free = [F(x) for x in before['velocityMps']]+[Fraction(0)]*3
            actual = [free[j]+exact[i][j] for j in range(6)]
            if any(actual): violations.append('exact dynamic stationarity:'+before['id'])
            residuals.append({'bodyId': before['id'], 'values': actual})
            max_v = max(max_v, *(abs(F(before['velocityMps'][j])+rounded_j[i][j]) for j in range(3)))
            max_w = max(max_w, *(abs(24*rounded_j[i][j+3]) for j in range(3)))
            max_geometric = max(max_geometric, *(abs(x) for x in geometric[i]))
        claimed = side['dynamicResiduals']
        need(len(claimed) == len(residuals), 'residual population')
        for a, b in zip(claimed, residuals):
            need(type(a) is dict and set(a) == {'bodyId', 'values'}, 'residual fields')
            need(a['bodyId'] == b['bodyId'] and [fraction(x) for x in a['values']] == b['values'], 'reported residuals')
        # All returned after velocities are zero, including fixed endpoints;
        # direct J*v and lambda*(J*v) are therefore exactly zero on every row.
        for p in points:
            a, b = returned[ids[p['aId']]], returned[ids[p['bId']]]
            need(all(F(x) == 0 for x in a['velocityMps']+a['angularVelocityRadps']+b['velocityMps']+b['angularVelocityRadps']), 'primal row zero')
        return {'ok': not violations, 'resolved': True, 'executionFailure': False,
                'status': 'EXACT_STATIONARY_WITNESS_VERIFIED' if not violations else 'EXACT_STATIONARY_WITNESS_VIOLATION',
                'violations': violations, 'metrics': {'pointChecks': len(points), 'dynamicDofChecks': 6*len(dynamic),
                 'maxRoundedTrueLeverVelocityErrorMps': float(max_v), 'maxRoundedTrueLeverAngularErrorRadps': float(max_w),
                 'maxExactRatioTrueLeverTorqueNms': float(max_geometric)},
                'certificate': {'allDynamicStationarityExact': not violations, 'allRowsPrimalExactZero': True,
                 'allRowsComplementarityExactZero': True, 'allExactMultipliersNonnegative': True},
                'semantics': 'Exact frozen Float-J certificate; true-lever/rounded diagnostics separate; no triangle solve'}
    except (ValueError, KeyError, TypeError, IndexError, ArithmeticError, OverflowError) as error:
        return {'ok': False, 'resolved': False, 'executionFailure': True,
                'status': 'EXACT_STATIONARY_CHECK_UNRESOLVED', 'violations': [str(error)], 'metrics': None, 'certificate': None}


def main():
    while True:
        line = sys.stdin.buffer.readline(CAP+1)
        if not line:
            break
        need(len(line) <= CAP, 'checker wire bound')
        request = json.loads(line)
        problem = restore_words(request['problem'], request['problemWordsF64leHex'])
        result = restore_words(request['result'], request['resultWordsF64leHex'])
        reply = verify(problem, result, request.get('unitDynamicCount', 8))
        encoded = json.dumps(reply, allow_nan=False)
        need(len(encoded.encode())+1 <= CAP, 'checker output bound')
        print(encoded, flush=True)


if __name__ == '__main__':
    main()
