"""Independent exact-rational knot insertion on preserved original polynomial row coefficients.

The resulting convex-hull bound covers the entire ideal represented Surface geometry.
Native evaluator roundoff is a separate observed grid comparison, not part of this bound.
"""
from pathlib import Path
from fractions import Fraction as F
import gzip
import json

folder = Path(__file__).resolve().parent
source = json.loads(gzip.decompress((folder / 'surface-coefficients.json.gz').read_bytes()))

def insert(degree, knots, points, knot):
    k = degree
    while k + 1 < len(knots) - degree - 1 and knots[k + 1] <= knot:
        k += 1
    multiplicity = knots.count(knot)
    result = [None] * (len(points) + 1)
    for i in range(k - degree + 1):
        result[i] = points[i]
    for i in range(k - multiplicity, len(points)):
        result[i + 1] = points[i]
    for i in range(k - degree + 1, k - multiplicity + 1):
        alpha = (knot - knots[i]) / (knots[i + degree] - knots[i])
        result[i] = [(1 - alpha) * points[i - 1][c] + alpha * points[i][c] for c in range(3)]
    assert all(point is not None for point in result)
    return knots[:k + 1] + [knot] + knots[k + 1:], result

def restrict(degree, source_knots, source_points, start, end):
    knots = [F(value) for value in source_knots]
    points = [[F(value) for value in point] for point in source_points]
    lo, hi = knots[degree], knots[len(points)]
    a, b = F(start), F(end)
    for knot in (a, b):
        if lo < knot < hi:
            for _ in range(degree - knots.count(knot)):
                knots, points = insert(degree, knots, points, knot)
    first = 0 if a == lo else knots.index(a) - 1
    last = len(points) - 1 if b == hi else len(knots) - 1 - knots[::-1].index(b) - degree
    return points[first:last + 1]

def text(value):
    return {'numerator': str(value.numerator), 'denominator': str(value.denominator)}

records = []
maximum = F(0)
for entry in source:
    original = entry['source']
    for child in entry['children']:
        assert child['degreeU'] == original['degreeU'] and child['degreeV'] == original['degreeV']
        assert child['knotsU'] == original['knotsU']
        degree = child['degreeV']
        start, end = child['knotsV'][degree], child['knotsV'][len(child['controlPoints'][0])]
        bound = [F(0), F(0), F(0)]
        for r, row in enumerate(original['controlPoints']):
            expected = restrict(degree, original['knotsV'], row, start, end)
            actual = child['controlPoints'][r]
            assert len(expected) == len(actual) <= 16
            weight = original['weights'][r][0]
            assert weight > 0 and all(w == weight for w in original['weights'][r])
            assert all(w == weight for w in child['weights'][r])
            for a, b in zip(expected, actual):
                for c in range(3):
                    bound[c] = max(bound[c], abs(a[c] - F(b[c])))
        total = sum(bound)
        assert total <= F(1e-9), (entry['case'], child['id'], float(total))
        maximum = max(maximum, total)
        records.append({'case': entry['case'], 'surface': child['id'], 'domain': [start, end],
                        'coordinateBounds': [text(x) for x in bound], 'l1Bound': text(total), 'approximateL1': float(total)})
result = {'status': 'passed', 'lengthUnit': 'mm', 'scope': 'Whole ideal represented geometry: exact source knot restriction and unchanged positive U weights; B-spline convex hull bound. Native evaluator roundoff is separate.',
          'surfaces': len(records), 'maximumL1': text(maximum), 'approximateMaximumL1': float(maximum), 'records': records}
(folder / 'coefficient-bound.json').write_text(json.dumps(result, indent=2) + '\n')
print(json.dumps({'status': result['status'], 'surfaces': result['surfaces'], 'approximateMaximumL1': result['approximateMaximumL1']}))
