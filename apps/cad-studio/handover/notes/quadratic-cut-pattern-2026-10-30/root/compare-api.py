from pathlib import Path
import difflib,json
p=Path('/tmp/d346-root')
a=json.loads(p.joinpath('api-expected-before.json').read_text());b=json.loads(p.joinpath('api-candidate.json').read_text())
def key(e):return (e['package'],e['subpath'],e['exportName'])
x={key(e):e for e in a['exposures']};y={key(e):e for e in b['exposures']}
added=[{'key':k,'after':y[k]} for k in sorted(y.keys()-x.keys())]
removed=[{'key':k,'before':x[k]} for k in sorted(x.keys()-y.keys())]
changed=[{'key':k,'before':x[k],'after':y[k]} for k in sorted(x.keys()&y.keys()) if x[k]!=y[k]]
metadata={k:{'before':a.get(k),'after':b.get(k)} for k in a.keys()|b.keys() if k!='exposures' and a.get(k)!=b.get(k)}
p.joinpath('api-delta.json').write_text(json.dumps({'added':added,'removed':removed,'changed':changed,'metadata':metadata},indent=2)+'\n')
lines=[]
for e in changed:
 lines.extend(difflib.unified_diff(json.dumps(e['before'],indent=2).splitlines(True),json.dumps(e['after'],indent=2).splitlines(True),fromfile=str(e['key'])+' before',tofile=str(e['key'])+' after'))
p.joinpath('api-delta.diff').write_text(''.join(lines))
print(json.dumps({'added':len(added),'removed':len(removed),'changed':len(changed),'metadata':list(metadata),'addedKeys':[e['key'] for e in added],'changedKeys':[e['key'] for e in changed]}))
