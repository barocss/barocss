# #239: per run, which of the 5 companion settings the agent's edits use, plus score and agent cost. Run by runs.sh.
import json, os, re, subprocess, sys
B = sys.argv[1]
scores = {s['dir']: s for s in json.load(open(os.path.join(B, 'scores.json')))}
runs = []
for name in sorted(scores):
    d = os.path.join(B, name)
    diff = subprocess.run(['diff', '-ruN', '-x', 'vendor', '-x', 'docs', d + '.orig', d], capture_output=True, text=True).stdout
    added = '\n'.join(l[1:] for l in diff.splitlines() if l.startswith('+') and not l.startswith('+++'))
    loaded = bool(re.search(r'vendor/barocss', added))
    s = {
        'skipExisting': bool(re.search(r'skipExisting\s*:\s*true', added)),
        "cssVarPrefix 'tw'": bool(re.search(r'cssVarPrefix\s*:\s*[\'"](--)?tw-?[\'"]', added)),
        'shadcnTheme': 'shadcnTheme' in added,
        'preload': 'preloadJsonRenderClasses' in added,
        'preflight layered': loaded and not re.search(r'preflight\s*:\s*(false|[\'"]off)', added),
    }
    try:
        o = json.load(open(d + '.out.json'))
    except Exception:
        o = {}
    sc = scores[name]
    runs.append({'run': name, 'loaded': loaded, 'found': [k for k, v in s.items() if v], 'missed': [k for k, v in s.items() if not v],
                 'elemParity': sc['elemParity'], 'propParity': sc['propParity'], 'shellParity': sc['shellParity'], 'errs': sc['errs'],
                 'cost': round(o.get('total_cost_usd', 0), 3), 'turns': o.get('num_turns'), 'durationS': round(o.get('duration_ms', 0) / 1000),
                 'subtype': o.get('subtype'), 'diffLines': len(added.splitlines()), 'finalMsg': (o.get('result') or '')[:400]})
print(json.dumps({'runs': runs, 'totalCost': round(sum(r['cost'] for r in runs), 3)}, indent=1))
