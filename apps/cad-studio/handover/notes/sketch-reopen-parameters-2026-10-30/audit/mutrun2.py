import json, subprocess, sys, os
S = sys.argv[1]; root = S + '/cur'
tests = [root + '/packages/barocss-cad-model/test/sketch-reopen-parameters.test.ts', root + '/apps/cad-studio/test/sketch-edit-identity.test.ts']
extra = sys.argv[2:]  # extra test files
for name, path, old, new in json.load(open(S + '/muts2.json')):
    p = os.path.join(root, path); src = open(p).read()
    n = src.count(old)
    if n != 1: print(name, 'PATTERN COUNT', n); continue
    open(p, 'w').write(src.replace(old, new))
    try:
        r = subprocess.run(['node', S + '/run.mjs', root] + tests + extra, capture_output=True, text=True, timeout=600)
        out = r.stdout + r.stderr
        fails = [l for l in out.splitlines() if l.startswith('not ok')]
        tot = [l for l in out.splitlines() if l.startswith('# tests') or l.startswith('# fail')]
        print(name, '->', 'KILLED' if fails else ('SURVIVED' if '# fail 0' in out else 'BUILD?'), tot, [f[:90] for f in fails])
    finally:
        open(p, 'w').write(src)
