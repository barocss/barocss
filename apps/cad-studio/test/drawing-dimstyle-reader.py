"""D414 bounded independent ezdxf read: metadata defaults and preserved display text, no regeneration claim."""
import json
import sys
import ezdxf

request = json.load(sys.stdin)
results = []
for item in request['files']:
    doc = ezdxf.readfile(item['file'])
    audit = doc.audit()
    assert not audit.errors and not audit.fixes, (audit.errors, audit.fixes)
    dimensions = list(doc.modelspace().query('DIMENSION'))
    assert len(dimensions) == 2
    style = doc.dimstyles.get(dimensions[0].dxf.dimstyle)
    asme = request['settings'].get('standard') == 'asme'
    values = [style.dxf.dimtxt, style.dxf.dimtad, style.dxf.dimtih, style.dxf.dimtoh]
    assert values == ([3, 0, 1, 1] if asme else [3.5, 1, 0, 0]), values
    if item['version'] == 'AC1015':
        assert doc.header['$INSUNITS'] == 4, 'sheet coordinates remain millimetres'
    display = []
    for dim in dimensions:
        texts = list(doc.blocks[dim.dxf.geometry].query('TEXT'))
        assert texts and all(t.dxf.height == (3 if asme else 3.5) for t in texts)
        display.append({'label': dim.dxf.text, 'block_text': [t.dxf.text for t in texts],
                        'height': [t.dxf.height for t in texts], 'rotation': [t.dxf.rotation for t in texts]})
    results.append({'file': item['file'], 'version': item['version'], 'style': values,
                    'audit_errors': 0, 'audit_fixes': 0, 'dimensions': display})
print(json.dumps({'status': 'PASS', 'reader': ezdxf.__version__, 'settings': request['settings'], 'files': results}))
