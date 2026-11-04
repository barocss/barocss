"""Independent exact normalized-quaternion tensor observer; no candidate imports."""
from fractions import Fraction
import json
import math
import struct
import sys

LINE_BYTES = 2 * 1024 * 1024
MAX_WORDS = 65536
MAX_DEPTH = 32
MAX_NODES = 262144
GATE = Fraction.from_float(1e-10)


class Invalid(ValueError):
    pass


def require(condition, message):
    if not condition:
        raise Invalid(message)


def number(value):
    require(type(value) in (int, float), 'finite JS Number required')
    try:
        value = float(value)
    except (ValueError, OverflowError):
        raise Invalid('finite JS Number required') from None
    require(math.isfinite(value), 'finite JS Number required')
    return value


def rational(value):
    return Fraction.from_float(number(value))


def vector(value, size=3):
    require(type(value) is list and len(value) == size, 'vector shape')
    return [rational(entry) for entry in value]


def words(value):
    return struct.pack('<d', number(value))


def restore_words(value, hexadecimal):
    require(type(hexadecimal) is str and len(hexadecimal) % 16 == 0,
            'numeric word hex shape')
    require(len(hexadecimal) <= MAX_WORDS * 16, 'numeric word count bound')
    require(all(char in '0123456789abcdef' for char in hexadecimal),
            'lowercase numeric word hex')
    raw = bytes.fromhex(hexadecimal)
    offset = 0
    nodes = 0

    def visit(item, depth):
        nonlocal offset, nodes
        nodes += 1
        require(depth <= MAX_DEPTH and nodes <= MAX_NODES, 'numeric tree bound')
        if type(item) in (int, float):
            require(offset + 8 <= len(raw), 'missing numeric word')
            actual = struct.unpack_from('<d', raw, offset)[0]
            offset += 8
            require(math.isfinite(actual), 'nonfinite numeric word')
            require(actual == number(item), 'nonzero numeric word mismatch')
            return actual
        if type(item) is list:
            return [visit(entry, depth + 1) for entry in item]
        if type(item) is dict:
            return {key: visit(entry, depth + 1) for key, entry in item.items()}
        require(item is None or type(item) in (str, bool), 'JSON value required')
        return item

    restored = visit(value, 0)
    require(offset == len(raw), 'trailing numeric words')
    return restored


def plus(a, b):
    return [x + y for x, y in zip(a, b)]


def dot(a, b):
    return sum((x * y for x, y in zip(a, b)), Fraction(0))


def hamilton(a, b):
    """Scalar-first Hamilton product, independently from production XYZW code."""
    aw, ax, ay, az = a
    bw, bx, by, bz = b
    return [aw*bw - ax*bx - ay*by - az*bz,
            aw*bx + ax*bw + ay*bz - az*by,
            aw*by - ax*bz + ay*bw + az*bx,
            aw*bz + ax*by - ay*bx + az*bw]


def rotated(orientation, value, backwards=False):
    x, y, z, w = orientation
    quaternion = [w, x, y, z]
    conjugate = [w, -x, -y, -z]
    norm2 = dot(quaternion, quaternion)
    require(norm2 > 0, 'nonzero quaternion')
    first, last = (conjugate, quaternion) if backwards else (quaternion, conjugate)
    product = hamilton(hamilton(first, [Fraction(0)] + value), last)
    require(product[0] == 0, 'pure quaternion action')
    return [entry / norm2 for entry in product[1:]]


def tensor_action(orientation, diagonal, value):
    local = rotated(orientation, value, backwards=True)
    return rotated(orientation, [d*x for d, x in zip(diagonal, local)])


def physical_tensor(orientation, diagonal):
    columns = []
    for axis in range(3):
        basis = [Fraction(int(index == axis)) for index in range(3)]
        columns.append(tensor_action(orientation, diagonal, basis))
    return [[columns[col][row] for col in range(3)] for row in range(3)]


def matrix(value):
    require(type(value) is list and len(value) == 3, 'matrix shape')
    return [vector(row) for row in value]


def determinant(a):
    return (a[0][0]*(a[1][1]*a[2][2] - a[1][2]*a[2][1])
            - a[0][1]*(a[1][0]*a[2][2] - a[1][2]*a[2][0])
            + a[0][2]*(a[1][0]*a[2][1] - a[1][1]*a[2][0]))


def invariant_two(a):
    return sum((a[i][i]*a[j][j] - a[i][j]*a[j][i]
                for i, j in ((0, 1), (0, 2), (1, 2))), Fraction(0))


def same_words(a, b):
    if type(a) in (int, float) and type(b) in (int, float):
        return words(a) == words(b)
    if type(a) is not type(b):
        return False
    if type(a) is list:
        return len(a) == len(b) and all(same_words(x, y) for x, y in zip(a, b))
    if type(a) is dict:
        return a.keys() == b.keys() and all(same_words(a[key], b[key]) for key in a)
    return a == b


def verify(data):
    try:
        require(type(data) is dict, 'data object')
        bodies = data['freeBodies']
        require(type(bodies) is list and 1 <= len(bodies) <= 4, 'body count')
        observation = data['observation']
        require(type(observation) is dict and observation.get('error') is None,
                'solved observation required')
        result = observation['result']
        require(type(result) is dict, 'result object')
        diagnostic = result['diagnostics']
        problem = diagnostic['normalProblem']
        require(type(problem) is dict, 'normal problem object')
        scope = data.get('scope', 'noncontact')
        require(scope in ('noncontact', 'captured-isolated-tensor'), 'explicit reference scope')
        captured = scope == 'captured-isolated-tensor'
        scope_violations = []
        if captured:
            require(data['caseId'] == 'captured-natural-precontact' and
                    data.get('targetBodyId') == 'upper', 'fixed captured target identity')
            ids = [body['id'] for body in bodies]
            require('upper' in ids and len(set(ids)) == len(ids), 'captured body identity')
            points, applications, contacts = problem['points'], diagnostic['applications'], result['contacts']
            require(type(points) is list and len(points) <= 32 and
                    type(applications) is list and len(applications) <= 32 and
                    type(contacts) is list and len(contacts) <= 6, 'bounded retained contact populations')
            for entry in points + contacts:
                require(type(entry) is dict and entry['aId'] in ids and entry['bId'] in ids and
                        entry['aId'] != entry['bId'], 'contact endpoint links')
                vector(entry['pointM']); vector(entry['normalAtoB'])
                if 'upper' in (entry['aId'], entry['bId']):
                    scope_violations.append({'gate': 'capturedUpperHasContact'})
            for entry in applications:
                require(type(entry) is dict, 'application object')
                indices = [number(entry['aIndex']), number(entry['bIndex'])]
                require(all(value.is_integer() and 0 <= value < len(ids) for value in indices) and
                        indices[0] != indices[1], 'application endpoint indices')
                vector(entry['pointM']); vector(entry['normalAtoB'])
                if any(ids[int(value)] == 'upper' for value in indices):
                    scope_violations.append({'gate': 'capturedUpperHasApplication'})
        else:
            require(problem['points'] == [], 'noncontact qualification only')
            require(diagnostic['applications'] == [] and result['contacts'] == [],
                    'no hidden contact applications')
        require(len(problem['bodies']) == len(bodies), 'normal body population')
        require(type(result['candidateBodies']) is list and len(result['candidateBodies']) == len(bodies),
                'candidate body population')
        loads = data['angularLoads']
        require(type(loads) is list and len(loads) <= 16, 'bounded angular loads')
        by_id = {}
        violations = scope_violations[:32]
        maxima = {}

        def measured(name, residual, scale=Fraction(1)):
            error = abs(residual) / scale
            maxima[name] = max(maxima.get(name, Fraction(0)), error)
            if error > GATE and len(violations) < 32:
                violations.append({'gate': name, 'residual': float(error), 'limit': 1e-10})

        for index, body in enumerate(bodies):
            require(type(body) is dict and type(body.get('id')) is str and body['id'] not in by_id,
                    'unique body identity')
            by_id[body['id']] = body
            normal = problem['bodies'][index]
            require(normal['id'] == body['id'], 'normal body order')
            for key in ('positionM', 'velocityMps', 'angularVelocityRadps', 'inverseMass'):
                require(same_words(normal[key], body[key]), 'normal input word provenance ' + key)
            if not captured:
                require(same_words(result['candidateBodies'][index], body), 'noncontact body word retention')
            elif body['id'] == 'upper' and not same_words(result['candidateBodies'][index], body):
                violations.append({'gate': 'capturedUpperBodyWordsChanged'})
            observed = matrix(normal['inverseInertiaWorld'])
            diagonal = vector(body['inverseInertiaLocal'])
            orientation = vector(body['orientation'], 4)
            if rational(body['inverseMass']) == 0:
                require(all(entry == 0 for row in observed for entry in row), 'static zero tensor')
                continue
            require(all(entry > 0 for entry in diagonal), 'positive local diagonal')
            exact = physical_tensor(orientation, diagonal)
            for row in range(3):
                for col in range(3):
                    if observed[row][col] != observed[col][row]:
                        violations.append({'gate': 'exactMatrixSymmetry', 'row': row, 'col': col})
                    measured('physicalTensorKgInvMInv2', observed[row][col] - exact[row][col])
            minors = [observed[0][0], observed[0][0]*observed[1][1] - observed[0][1]**2,
                      determinant(observed)]
            if not all(value > 0 for value in minors):
                violations.append({'gate': 'positiveDefiniteTensor'})
            expected_invariants = [sum(diagonal), diagonal[0]*diagonal[1] + diagonal[0]*diagonal[2]
                                   + diagonal[1]*diagonal[2], diagonal[0]*diagonal[1]*diagonal[2]]
            actual_invariants = [sum(observed[i][i] for i in range(3)), invariant_two(observed),
                                 determinant(observed)]
            for name, actual, expected in zip(('spectralTrace', 'spectralSecond', 'spectralDeterminant'),
                                               actual_invariants, expected_invariants):
                measured(name, actual - expected, max(Fraction(1), abs(expected)))
            if diagonal[0] == diagonal[1] == diagonal[2]:
                require(observed == [[diagonal[row] if row == col else 0 for col in range(3)]
                                     for row in range(3)], 'exact isotropic branch')

        loaded = set()
        for load in loads:
            require(type(load) is dict and load['bodyId'] in by_id, 'angular load body')
            body = by_id[load['bodyId']]
            require(rational(body['inverseMass']) > 0, 'dynamic angular load')
            orientation = vector(body['orientation'], 4)
            diagonal = vector(body['inverseInertiaLocal'])
            torque = vector(load['torqueNms'])
            require(any(value != 0 for value in torque), 'nonzero angular load')
            before = vector(load['beforeSpinRadps'])
            require(same_words(load['beforeSpinRadps'], body['angularVelocityRadps']),
                    'actual before spin provenance')
            action = vector(load['inverseActionRadps'])
            after = vector(load['afterSpinRadps'])
            round_trip = vector(load['inertiaRoundTripNms'])
            exact_action = tensor_action(orientation, diagonal, torque)
            inertia_diagonal = [1 / value for value in diagonal]
            physical_round_trip = tensor_action(orientation, inertia_diagonal, action)
            for index in range(3):
                measured('angularActionRadps', action[index] - exact_action[index])
                measured('angularIncrementRadps', after[index] - before[index] - exact_action[index])
                measured('angularMomentumNms', round_trip[index] - torque[index])
                measured('physicalAngularMomentumNms', physical_round_trip[index] - torque[index])
            measured('angularLoadEnergyJ', (dot(action, torque) - dot(exact_action, torque)) / 2)
            loaded.add(body['id'])
        require(all(body['id'] in loaded for body in bodies if rational(body['inverseMass']) > 0),
                'each dynamic tensor has actual nonzero angular load')
        ok = not violations
        return {'ok': ok, 'resolved': True, 'executionFailure': False,
                'status': 'ANISOTROPIC_PRIVATE_CONFIRMED' if ok else 'PHYSICAL_NO_GO',
                'violations': violations, 'metrics': {key: float(value) for key, value in maxima.items()},
                'certificate': {'caseId': data['caseId'], 'bodies': len(bodies),
                                'angularLoads': len(loads), 'worldCalls': 0, 'candidateImports': 0,
                                'independentlyCertifiedContactPhase': False,
                                'scope': ('captured isolated upper tensor and standalone angular operators only'
                                          if captured else 'noncontact tensor and standalone angular operator only')}}
    except (Invalid, KeyError, TypeError, IndexError, ZeroDivisionError, OverflowError) as error:
        return {'ok': False, 'resolved': False, 'executionFailure': True, 'status': 'INVALID_INPUT',
                'violations': [], 'metrics': {}, 'certificate': {}, 'reason': str(error)}


def main():
    try:
        line = sys.stdin.buffer.readline(LINE_BYTES + 1)
        require(0 < len(line) <= LINE_BYTES and line.endswith(b'\n'), 'one bounded JSONL request')
        require(sys.stdin.buffer.read(1) == b'', 'one request then EOF')
        request = json.loads(line)
        require(request['format'] == 'anisotropic-inertia-private-v1', 'wire format')
        response = verify(restore_words(request['data'], request['numericWordsF64leHex']))
    except (Invalid, KeyError, TypeError, ValueError, OverflowError) as error:
        response = {'ok': False, 'resolved': False, 'executionFailure': True, 'status': 'INVALID_INPUT',
                    'violations': [], 'metrics': {}, 'certificate': {}, 'reason': str(error)}
    encoded = json.dumps(response, separators=(',', ':'), allow_nan=False)
    require(len(encoded.encode()) <= 65536, 'reply byte bound')
    print(encoded)


if __name__ == '__main__':
    main()
