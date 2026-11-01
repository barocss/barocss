import json
S = '/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-compassionate-turing-e88276/0fddd342-b409-4074-aa06-d8dff804f568/scratchpad/'
fails = json.load(open(S + 'audit/para-fails.json'))
cases = []
for x in fails:
    if (x['trial'], x['edge'], x['D']) in ((21, 'v-max', 18), (141, 'u-min', 180)):
        cases.append("  { label: 'audit trial %d %s', edge: '%s', reach: %s, source: %s }," % (x['trial'], x['edge'], x['edge'], repr(x['D']), json.dumps(x['src'])))
assert len(cases) == 2
p = '/Users/user/github/barocss/barocss/.claude/worktrees/compassionate-turing-e88276/packages/barocss-cad-model/test/direct-extend-plane.test.ts'
t = open(p).read()
old = "  for (const dist of [1e-6, 1e-4, 1e5]) refuses(`reach ${dist}`, imported, () => directOps.extendSurface(imported, panel, 'u-max', dist));\n"
assert old in t
t = t.replace(old, '')
a = "import { evaluateSurface, type Surface } from '@barocss/cad';"
assert a in t
t = t.replace(a, "import { evaluateSurface, surfaceDomain, type Surface } from '@barocss/cad';")
extra = open(S + 'impl/extra.ts.txt').read().replace('@@CASES@@', '\n'.join(cases))
open(p, 'w').write(t.rstrip('\n') + '\n' + extra)
