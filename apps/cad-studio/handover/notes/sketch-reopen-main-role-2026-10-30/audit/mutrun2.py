import json, subprocess, sys, os
A = sys.argv[1]; root = A + '/mut'
tests = [root + '/packages/barocss-cad-model/test/sketch-reopen-main-role.test.ts', root + '/packages/barocss-cad-model/test/sketch-reopen-parameters.test.ts', root + '/packages/barocss-cad-model/test/sketch-reopen-side-ids.test.ts', root + '/apps/cad-studio/test/sketch-edit-identity.test.ts', root + '/apps/cad-studio/test/constraints.test.ts', root + '/apps/cad-studio/test/sketchIds.test.ts']
for name, path, old, new in json.load(open(A + '/muts2.json')):
    p = os.path.join(root, path); src = open(p).read(); n = src.count(old)
    if n != 1: print(name, 'PATTERN COUNT', n, flush=True); continue
    open(p, 'w').write(src.replace(old, new))
    try:
        r = subprocess.run(['node', A + '/run.mjs', root] + tests, capture_output=True, text=True, timeout=900)
        out = r.stdout + r.stderr
        fails = [l for l in out.splitlines() if l.startswith('not ok')]
        tot = [l for l in out.splitlines() if l.startswith('# tests') or l.startswith('# fail')]
        print(name, '->', 'KILLED' if fails else ('SURVIVED' if '# fail 0' in out else 'BUILD? ' + out[-300:]), tot, [f[:100] for f in fails], flush=True)
    finally:
        open(p, 'w').write(src)
