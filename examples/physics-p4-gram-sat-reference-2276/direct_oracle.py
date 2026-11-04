"""OLD direct Ai×Bj/projection oracle. No new Gram-factorized implementation."""
from support import need, same

UPPER = ((0, 0), (0, 1), (0, 2), (1, 1), (1, 2), (2, 2))


def integer(value):
    need(type(value) is int and abs(value).bit_length() <= 2000, 'FIXED_BANK_INTEGER_BOUND')
    return str(value)


def encoded_margin(value):
    return {'axis': value.axis, 'N': integer(value.numerator),
            'D': integer(value.denominator), 'S': integer(value.square)}


def model(a, b, normalized, k, m):
    """Capture ALL old direct axis results; separately cross-check old source."""
    m.models += 1
    ba, bb = (a.normalized, b.normalized) if normalized else (a.raw, b.raw)
    A, B = ba.columns, bb.columns
    words = [k.dyadic(x) for x in a.center + b.center + a.extents + b.extents]
    power = max(d for _, d in words)
    lifted = [m.shift(n, power - d) for n, d in words]
    ca, cb, ha, hb = (lifted[i:i + 3] for i in (0, 3, 6, 9))
    delta = [m.sub(y, x) for x, y in zip(ca, cb)]
    Q = m.mul(ba.denominator, bb.denominator)
    D = m.mul(m.shift(1, power), Q)
    edges = [[m.cross(A[i], B[j]) for j in range(3)] for i in range(3)]
    # These signed direct projections are evaluated BEFORE abs, including0 axes.
    pa = {(i, j): [m.dot(A[k0], edges[i][j]) for k0 in range(3)] for i in range(3) for j in range(3)}
    pb = {(i, j): [m.dot(B[k0], edges[i][j]) for k0 in range(3)] for i in range(3) for j in range(3)}
    pc = {(i, j): m.dot(delta, edges[i][j]) for i in range(3) for j in range(3)}
    tables = {'AAupper': [m.dot(A[i], A[j]) for i, j in UPPER],
              'BBupper': [m.dot(B[i], B[j]) for i, j in UPPER],
              'AB': [m.dot(A[i], B[j]) for i in range(3) for j in range(3)],
              'faceCenterA': [m.dot(delta, axis) for axis in A],
              'faceCenterB': [m.dot(delta, axis) for axis in B],
              # TA/TB read the corresponding OLD axis projections, not EA/EB.
              'TA': [pa[(i, j)][k0] for k0, i in ((1, 2), (2, 0), (0, 1)) for j in range(3)],
              'TB': [pb[(i, j)][k0] for i in range(3) for j, k0 in ((1, 2), (2, 0), (0, 1))],
              'TC': [pc[(i, j)] for i in range(3) for j in range(3)]}
    axes = [(u, ba.denominator) for u in A] + [(u, bb.denominator) for u in B]
    axes += [(edges[i][j], Q) for i in range(3) for j in range(3)]
    results, classifications, minimum, ties = [], [], None, []
    for index, (axis, axis_den) in enumerate(axes):
        m.axes += 1
        square = m.dot(axis, axis)
        near = square != 0 and index >= 6 and m.compare(m.mul(square, k.TEN24), m.mul(axis_den, axis_den)) < 0
        if square == 0:
            classifications.append({'axis': index, 'exactZero': True, 'nearParallel': False, 'marginSign': None})
            results.append({'axis': index, 'axisDen': integer(axis_den), 'margin': None})
            continue
        # Direct sum_support retains the OLD integer dot-vector formulation.
        sa, sb = k.sum_support(ha, A, axis, m), k.sum_support(hb, B, axis, m)
        center = abs(m.dot(delta, axis))
        numerator = m.sub(m.add(m.mul(sa, bb.denominator), m.mul(sb, ba.denominator)), m.mul(center, Q))
        margin = k.Margin(numerator, D, square, index)
        classifications.append({'axis': index, 'exactZero': False, 'nearParallel': near,
                                'marginSign': (numerator > 0) - (numerator < 0)})
        results.append({'axis': index, 'axisDen': integer(axis_den),
                        'margin': {'N': integer(numerator), 'D': integer(D), 'S': integer(square)}})
        comparison = -1 if minimum is None else k.compare_margin(margin, minimum, m)
        if comparison < 0:
            minimum, ties = margin, [index]
        elif comparison == 0:
            ties.append(index)
    need(minimum is not None, 'DIRECT_NONZERO_AXIS_EXISTS')
    report = {'firstExactMinimum': minimum.axis, 'exactTiedMinima': ties, 'axes': classifications}
    old_minimum, old_report = k.solve_model(a, b, normalized, m)
    same(encoded_margin(minimum), encoded_margin(old_minimum), 'UNMODIFIED_OLD_SELECTED_NDS')
    same(report, old_report, 'UNMODIFIED_OLD_ALL_AXIS_REPORT')
    return {'tables': {key: [integer(x) for x in values] for key, values in tables.items()},
            'axisResults': results, 'report': report, 'minimum': encoded_margin(minimum)}


def pair(request, k, m):
    a, b = k.prepare(request['a'], m), k.prepare(request['b'], m)
    return {'raw': model(a, b, False, k, m), 'normalized': model(a, b, True, k, m)}
