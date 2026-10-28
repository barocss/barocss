# Reads V8 CPU profiles (node --cpu-prof --cpu-prof-dir=DIR ...) and answers the two questions the performance work kept
# asking (apps/cad-studio/handover/notes/report-kernel-performance-2026-10-28.md):
#   python3 scripts/perf-profile.py self DIR [N]            the N functions with the most self time (default 30)
#   python3 scripts/perf-profile.py under DIR FUNC [DEPTH] [N]  where FUNC's time goes: inclusive time of its callees,
#                                                              DEPTH levels below it (default 1), the innermost FUNC
#                                                              on each stack counting
#   python3 scripts/perf-profile.py callers DIR FUNC FILE [DEPTH]  FUNC's self time split by its caller chain
# Names are a function's name and its dist file:line; anonymous callbacks show as (anon).
import collections
import glob
import json
import sys


def profiles(d):
    for fn in glob.glob(d + '/*.cpuprofile'):
        p = json.load(open(fn))
        nodes = {n['id']: n for n in p['nodes']}
        parent = {}
        for n in p['nodes']:
            for c in n.get('children', []):
                parent[c] = n['id']
        yield p, nodes, parent


def label(nodes, i):
    cf = nodes[i]['callFrame']
    return (cf['functionName'] or '(anon)') + ' ' + cf['url'].split('/')[-1] + ':' + str(cf['lineNumber'] + 1)


def report(counter, total, n):
    print('total s', round(total / 1e6, 2))
    for k, v in counter.most_common(n):
        print(f'{v / 1e6:7.2f}s {100 * v / total:5.1f}%  {k}')


def self_time(d, n=30):
    c, total = collections.Counter(), 0
    for p, nodes, _ in profiles(d):
        for i, s in enumerate(p['samples']):
            dt = p['timeDeltas'][i]
            total += dt
            c[label(nodes, s)] += dt
    report(c, total, n)


def under(d, func, depth=1, n=20):
    c, total = collections.Counter(), 0
    for p, nodes, parent in profiles(d):
        for i, s in enumerate(p['samples']):
            dt, chain, q = p['timeDeltas'][i], [], s
            while q is not None:
                chain.append(q)
                q = parent.get(q)
            names = [(nodes[x]['callFrame']['functionName'] or '(anon)') + ':' + str(nodes[x]['callFrame']['lineNumber'] + 1) for x in chain]
            at = [k for k, nm in enumerate(names) if nm.split(':')[0] == func]
            if not at:
                continue
            k = at[-1]
            total += dt
            c[' > '.join(reversed(names[max(0, k - depth):k])) or '(self)'] += dt
    print(func, end=' ')
    report(c, total, n)


def callers(d, func, file, depth=2):
    c, total = collections.Counter(), 0
    for p, nodes, parent in profiles(d):
        for i, s in enumerate(p['samples']):
            dt = p['timeDeltas'][i]
            total += dt
            cf = nodes[s]['callFrame']
            if cf['functionName'] != func or file not in cf['url']:
                continue
            chain, q = [], parent.get(s)
            while q is not None and len(chain) < depth:
                chain.append(label(nodes, q))
                q = parent.get(q)
            c[' < '.join(chain)] += dt
    report(c, total, 20)


if __name__ == '__main__':
    mode, args = sys.argv[1], sys.argv[2:]
    if mode == 'self':
        self_time(args[0], int(args[1]) if len(args) > 1 else 30)
    elif mode == 'under':
        under(args[0], args[1], int(args[2]) if len(args) > 2 else 1, int(args[3]) if len(args) > 3 else 20)
    elif mode == 'callers':
        callers(args[0], args[1], args[2], int(args[3]) if len(args) > 3 else 2)
    else:
        sys.exit('modes: self | under | callers')
