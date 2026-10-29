import difflib
import hashlib
import json
from pathlib import Path
import re

base = Path('/tmp/d342-root')
expected_path = Path('apps/library-docs/scripts/api-inventory.expected.json')
old_bytes = expected_path.read_bytes()
new_bytes = (base / 'api-candidate.json').read_bytes()
old, new = json.loads(old_bytes), json.loads(new_bytes)
def index(data):
    output = {}
    for exposure in data['exposures']:
        output.setdefault((exposure['package'], exposure['subpath'], exposure['exportName']), []).append(exposure)
    return output
before, after = index(old), index(new)
added = sorted(after.keys() - before.keys())
removed = sorted(before.keys() - after.keys())
changed = sorted(key for key in before.keys() & after.keys() if before[key] != after[key])
other = [key for key in old.keys() | new.keys() if key != 'exposures' and old.get(key) != new.get(key)]
pattern = re.compile(r'"(?:\\.|[^"\\])*"(?: \| "(?:\\.|[^"\\])*")+')
def normalize(value):
    if isinstance(value, str):
        return pattern.sub(lambda match: ' | '.join(sorted(match.group().split(' | '))), value)
    if isinstance(value, list):
        return [normalize(item) for item in value]
    if isinstance(value, dict):
        return {key: normalize(item) for key, item in value.items()}
    return value
rows = []
for key in changed:
    rows.append({'key': list(key), 'before': before[key], 'after': after[key], 'classification': 'literal-union-order-only' if normalize(before[key]) == normalize(after[key]) else 'SEMANTIC_CHANGE_REQUIRES_REVIEW'})
delta = {'beforeExposures': len(old['exposures']), 'afterExposures': len(new['exposures']), 'added': [{'key': list(key), 'after': after[key]} for key in added], 'removed': [{'key': list(key), 'before': before[key]} for key in removed], 'changed': rows, 'otherTopLevelChanges': other}
(base / 'api-semantic-delta.json').write_text(json.dumps(delta, indent=2) + '\n')
diffs = []
for row in rows:
    diffs += ['### ' + ' / '.join(row['key'])]
    diffs += list(difflib.unified_diff(json.dumps(row['before'], indent=2).splitlines(), json.dumps(row['after'], indent=2).splitlines(), fromfile='before', tofile='after', n=2))
(base / 'api-changed-records.diff').write_text('\n'.join(diffs) + '\n')
intended = {'NativeOffsetFaceProfile', 'resolveNativeOffsetFace', 'validateNativeOffsetDistance'}
assert {key[2] for key in added} == intended, added
assert all(key[:2] == ('@barocss/cad-model', './app/nativeOffsetFace') for key in added), added
assert not removed and not other, (removed, other)
assert all(row['classification'] == 'literal-union-order-only' for row in rows), [row['key'] for row in rows if row['classification'] != 'literal-union-order-only']
(base / 'api-expected-before.json').write_bytes(old_bytes)
review = {'status': 'JUSTIFIED_ADOPTION', 'semanticAddedModelAppExports': 3, 'semanticRemovals': 0, 'semanticExistingChanges': 0, 'presentationOnlyExistingChanges': len(rows), 'beforeSHA256': hashlib.sha256(old_bytes).hexdigest(), 'afterSHA256': hashlib.sha256(new_bytes).hexdigest()}
(base / 'api-adoption-review.json').write_text(json.dumps(review, indent=2) + '\n')
expected_path.write_bytes(new_bytes)
print(json.dumps(review, indent=2))
