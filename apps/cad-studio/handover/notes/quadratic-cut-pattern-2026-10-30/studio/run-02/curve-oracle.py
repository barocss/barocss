"""Independent Decimal80 polynomial quadratic length/inverse and fixed-prism material cross-check.
Product imports: zero. Decimal results are not certified intervals. Root adopted existing 1e-7 budgets.
"""
import json, sys
from decimal import Decimal as D, localcontext

def number(value):
    if isinstance(value, bool): raise AssertionError('boolean is not a scalar')
    return D.from_float(value) if isinstance(value, float) else D(value)

def checked_budget(contract, key):
    value = contract[key]
    assert value is not None, ('PENDING_HIGH_CONTRACT', key)
    result = number(value)
    assert result.is_finite() and result > 0
    return result

with localcontext() as ctx:
    ctx.prec = 80
    data = json.load(sys.stdin)
    contract = data['numericContract']
    assert contract['status'] == 'FROZEN', 'PENDING_HIGH_CONTRACT'
    position_limit = checked_budget(contract, 'positionTolerance')
    volume_limit = checked_budget(contract, 'volumeTolerance')
    centroid_limit = checked_budget(contract, 'centroidTolerance')
    curve = data['curve']
    assert curve['degree'] == 2 and curve['knots'] == [0, 0, 0, 1, 1, 1]
    assert curve['weights'] == [1, 1, 1] and len(curve['controlPoints']) == 3
    poles = [[number(x) for x in p] for p in curve['controlPoints']]
    assert all(len(p) == 3 and p[2] == 0 for p in poles)
    p0, p1, p2 = poles
    v = [2 * (p1[k] - p0[k]) for k in range(3)]
    d = [2 * (p2[k] - 2 * p1[k] + p0[k]) for k in range(3)]
    A = sum(x * x for x in d)
    B = 2 * sum(x * y for x, y in zip(v, d))
    C = sum(x * x for x in v)
    K = 4 * A * C - B * B
    assert A > 0 and K > 0, 'Only the ordinary noncollinear polynomial cross-check is implemented'
    sqrt_A = A.sqrt()
    def primitive(t):
        speed = (A * t * t + B * t + C).sqrt()
        z = 2 * A * t + B
        logarithm = 2 * sqrt_A * speed + z
        assert logarithm > 0
        return z * speed / (4 * A) + K * logarithm.ln() / (8 * A * sqrt_A)
    start = primitive(D(0))
    def length(t): return primitive(t) - start
    total = length(D(1))
    feature = data['feature']
    count = feature['count']; spacing = number(feature['spacing'])
    assert isinstance(count, int) and 1 <= count <= 64 and spacing > 0
    assert (count - 1) * spacing < total, 'This driver uses interior requests, not a rounded full-length endpoint'
    offsets, parameters, residuals = [], [], []
    for k in range(count):
        distance = k * spacing
        low, high = D(0), D(1)
        if k:
            for _ in range(320):
                mid = (low + high) / 2
                if mid == low or mid == high: break
                if length(mid) < distance: low = mid
                else: high = mid
            t = (low + high) / 2
        else: t = D(0)
        point = [(1 - t) ** 2 * p0[a] + 2 * (1 - t) * t * p1[a] + t * t * p2[a] for a in range(3)]
        offsets.append([point[a] - p0[a] for a in range(3)])
        parameters.append(str(t)); residuals.append(str(abs(length(t) - distance)))
    plan = data['plan']
    assert len(plan['offsets']) == count
    bounds = plan['length']
    assert number(bounds['lower']) <= total <= number(bounds['upper']), 'Independent Decimal length lies inside reported bounds (cross-check, not interval proof)'
    plan_errors = []
    for actual, expected in zip(plan['offsets'], offsets):
        assert len(actual) == 3
        error = sum((number(x) - y) ** 2 for x, y in zip(actual, expected)).sqrt()
        assert error <= position_limit, ('planned true-curve offset cross-check', str(error))
        plan_errors.append(str(error))
    stock = data['originalStock']; tool = data['originalCutter']
    lo, hi = [number(x) for x in stock['min']], [number(x) for x in stock['max']]
    tl, th = [number(x) for x in tool['min']], [number(x) for x in tool['max']]
    stock_volume = (hi[0] - lo[0]) * (hi[1] - lo[1]) * (hi[2] - lo[2])
    tool_volume = (th[0] - tl[0]) * (th[1] - tl[1]) * (th[2] - tl[2])
    boxes = [([tl[a] + offset[a] for a in range(3)], [th[a] + offset[a] for a in range(3)]) for offset in offsets]
    for i, (a, b) in enumerate(boxes):
        assert all(lo[k] <= a[k] < b[k] <= hi[k] for k in range(3)), 'Fixture cuts must stay inside stock'
        for c, e in boxes[:i]: assert any(b[k] <= c[k] or e[k] <= a[k] for k in range(3)), 'Fixture cut interiors must be disjoint'
    volume = stock_volume - count * tool_volume
    centroid = [(stock_volume * (lo[a] + hi[a]) / 2 - tool_volume * sum((x[a] + y[a]) / 2 for x, y in boxes)) / volume for a in range(3)]
    target = data['target']; brep = target['brep']
    assert target['check']['valid'] and len(brep['bodies']) == 1 and brep['bodies'][0]['kind'] == 'solid'
    assert brep['shells'] and all(s['closed'] for s in brep['shells'])
    for label, mass in [('public', target['mass']), ('native', target['nativeMass']), ('Model', target['model']), ('actualStudio', data['studio'])]:
        assert abs(number(mass['volume']) - volume) <= volume_limit, (label, 'volume')
        assert all(abs(number(actual) - expected) <= centroid_limit for actual, expected in zip(mass['centroid'], centroid)), (label, 'centroid')
    names = target['names']; assert len(set(names)) == len(names)
    for k in range(1, count):
        for side in range(4): assert any(n.endswith('.side%d@%d' % (side, k)) for n in names), ('fixed source wall name', k, side)
    assert not any(n.endswith('@%d' % count) for n in names), 'No unrequested placement suffix'
    worst_corner = D(0)
    for a, b in boxes:
        for x in (a[0], b[0]):
            for y in (a[1], b[1]):
                for z in (a[2], b[2]):
                    expected = (x, y, z)
                    error = min(sum((number(v['point'][axis]) - expected[axis]) ** 2 for axis in range(3)).sqrt() for v in brep['vertices'])
                    worst_corner = max(worst_corner, error)
                    assert error <= position_limit, ('fixed-orientation native cutter corner', str(error))
    print(json.dumps({'status': 'PASS', 'method': 'Decimal80 closed-form sqrt-quadratic primitive and independent bisection',
      'quality': 'High-precision ordinary-fixture cross-check; not a certified interval or universal error theorem',
      'length': str(total), 'reportedLength': bounds, 'plannedOffsetErrors': plan_errors, 'parameters': parameters, 'analyticArcResiduals': residuals,
      'offsets': [[str(x) for x in p] for p in offsets], 'volume': str(volume), 'centroid': [str(x) for x in centroid],
      'worstNativeCornerError': str(worst_corner), 'fixedOrientation': True, 'productImports': 0}, indent=2))
