S = '/private/tmp/claude-501/-Users-user-github-barocss-barocss--claude-worktrees-compassionate-turing-e88276/0fddd342-b409-4074-aa06-d8dff804f568/scratchpad/impl/'
exec(open(S + 'patch3.py').read())
p = '/Users/user/github/barocss/barocss/.claude/worktrees/compassionate-turing-e88276/packages/barocss-cad-model/test/direct-extend-plane.test.ts'
t = open(p).read()
old = "  for (const edge of EDGES) for (const reach of ['2.5', '18']) succeedsExactly(d, id, edge, reach, off, 'offset');\n"
assert old in t
t = t.replace(old, old + "  for (const edge of EDGES) { const out = directOps.extendSurface(d, id, edge, 2.5); assert.equal(out.objects[out.objects.length - 1].name, 'd347 · panel · extended', `offset ${edge}: plane name carries a label`); }\n")
t = t.rstrip('\n') + '\n' + open(S + 'extra3.ts.txt').read()
open(p, 'w').write(t)
