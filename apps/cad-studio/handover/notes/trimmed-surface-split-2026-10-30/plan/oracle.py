"""Independent future D340 oracle; stdlib only, no product imports.

NOT EXECUTED during source planning. Read JSON on stdin:
{uv:[[u,v],...], domain:{u:[a,b],v:[c,d]}, axis:'u'|'v',
 parameter:<represented binary64>, keep:'inside'|'outside'}.
Works in the original represented chart, integrates exact Fraction slabs, and
reports positive-interior-connected components independently of arrangements.
World map for this qualification is [20+5u,-11+5v,3].
"""
import json
import sys
from fractions import Fraction as F


def q(value):
    return F.from_float(value) if isinstance(value, float) else F(value)


def text(value):
    return {"numerator": str(value.numerator), "denominator": str(value.denominator)}


def integrate(poly, domain, axis, cut, keep):
    # t is split/sweep coordinate; o is the perpendicular coordinate.
    k = 0 if axis == 'u' else 1
    pts = [(p[k], p[1-k]) for p in poly]
    td = domain[axis]
    od = domain['v' if axis == 'u' else 'u']
    levels = sorted(set([*td, cut, *(p[0] for p in pts)]))
    levels = [v for v in levels if td[0] <= v <= td[1]]
    nodes, previous = [], []
    parent = []

    def root(i):
        while parent[i] != i:
            parent[i] = parent[parent[i]]
            i = parent[i]
        return i

    def value(line, t):
        return line[0]*t + line[1]

    def integral(a, b, coefficients):
        return sum(c*(b**(i+1)-a**(i+1))/F(i+1)
                   for i, c in enumerate(coefficients))

    for lo, hi in zip(levels, levels[1:]):
        if lo == hi:
            continue
        middle = (lo+hi)/2
        side = 'lower' if middle < cut else 'upper'
        crossing = []
        for a, b in zip(pts, pts[1:]+pts[:1]):
            if min(a[0], b[0]) < middle < max(a[0], b[0]):
                slope = (b[1]-a[1])/(b[0]-a[0])
                crossing.append((slope, a[1]-slope*a[0]))
        crossing.sort(key=lambda line: value(line, middle))
        assert len(crossing) % 2 == 0
        inside = list(zip(crossing[::2], crossing[1::2]))
        if keep == 'inside':
            intervals = inside
        else:
            intervals, left = [], (F(0), od[0])
            for a, b in inside:
                intervals.append((left, a))
                left = b
            intervals.append((left, (F(0), od[1])))
        current = []
        for left, right in intervals:
            if value(right, middle) <= value(left, middle):
                continue
            da, db = right[0]-left[0], right[1]-left[1]
            area = integral(lo, hi, [db, da])
            moment_t = integral(lo, hi, [F(0), db, da])
            moment_o = integral(lo, hi, [
                (right[1]**2-left[1]**2)/2,
                right[0]*right[1]-left[0]*left[1],
                (right[0]**2-left[0]**2)/2])
            i = len(nodes)
            nodes.append((side, area, moment_t, moment_o))
            parent.append(i)
            for j, old_right, old_left, old_hi in previous:
                if old_hi != lo or nodes[j][0] != side:
                    continue
                overlap = min(value(right, lo), value(old_right, lo)) - max(value(left, lo), value(old_left, lo))
                # Point-only contact does not connect open material interiors.
                if overlap > 0:
                    parent[root(i)] = root(j)
            current.append((i, right, left, hi))
        previous = current
    sums = {}
    for i, (side, a, mt, mo) in enumerate(nodes):
        key = (side, root(i))
        old = sums.get(key, (F(0), F(0), F(0)))
        sums[key] = tuple(x+y for x,y in zip(old, (a, mt, mo)))
    out = {'lower': [], 'upper': []}
    for (side, _), (a, mt, mo) in sums.items():
        ct, co = mt/a, mo/a
        u, v = (ct, co) if k == 0 else (co, ct)
        out[side].append({'areaUV': text(a), 'areaWorld': text(25*a),
                          'centroidWorld': [text(20+5*u), text(-11+5*v), text(F(3))]})
    return out


if __name__ == '__main__':
    data = json.load(sys.stdin)
    result = integrate([list(map(q,p)) for p in data['uv']],
                       {k:list(map(q,v)) for k,v in data['domain'].items()},
                       data['axis'], q(data['parameter']), data['keep'])
    print(json.dumps(result, indent=2))
