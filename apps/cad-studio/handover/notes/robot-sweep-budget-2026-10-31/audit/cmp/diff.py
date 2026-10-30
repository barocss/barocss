import json, os, sys, glob, collections
def load(d):
    out = collections.defaultdict(list)
    for f in sorted(glob.glob(d + '/*.log')):
        name = os.path.basename(f).split('.mjs')[0]
        out[name] += [json.loads(l) for l in open(f)]
    return out
H, F = load(sys.argv[1]), load(sys.argv[2])
tot = same = 0; kinds = collections.Counter(); bad = []
for name in sorted(set(H) | set(F)):
    h, f = H.get(name, []), F.get(name, [])
    # match by (kind, input hash, occurrence index)
    def keyed(xs):
        c = collections.Counter(); m = {}
        for x in xs: k = (x['k'], x['h'], c[(x['k'], x['h'])]); c[(x['k'], x['h'])] += 1; m[k] = x['r']
        return m
    hk, fk = keyed(h), keyed(f)
    for k in sorted(set(hk) | set(fk)):
        tot += 1
        a, b = hk.get(k), fk.get(k)
        if a is None or b is None: kinds['only-' + ('fix' if a is None else 'head')] += 1; bad.append((name, k, a, b)) if (a is None and not (b or {}).get('exhausted')) else None; continue
        if a == b: same += 1; kinds['identical-' + ('contact' if (a.get('contact') or a.get('toi') is not None) else 'clear' if a['clear'] else 'other')] += 1; continue
        if b.get('exhausted'):
            ok = (a.get('contact') or a.get('toi') is not None) and not b.get('contact') and b.get('toi') is None and b['clear'] is False and a['samples'] == b['samples']
            kinds['head-contact->fix-exhausted' if ok else 'exhausted-other'] += 1
            if not ok: bad.append((name, k, a, b))
        else:
            kinds['DIFF-non-exhausted'] += 1; bad.append((name, k, a, b))
    print(f'{name}: head {len(h)} fix {len(f)} calls')
print('total keyed calls', tot, 'identical', same); print(dict(kinds))
for x in bad[:10]: print('BAD', json.dumps(x)[:600])
