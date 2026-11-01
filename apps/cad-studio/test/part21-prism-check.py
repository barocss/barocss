"""D404 independent Part21 graph and prismatic vertex bounds. Python stdlib only.
No product imports, STEP surface evaluation, solid-volume calculation, or generic STEP acceptance.
Usage: python3 -I part21-prism-check.py file.step expected.json [--selftest]
"""
import collections
import json
import math
import re
import sys
from pathlib import Path

TOKEN = re.compile(r"(?P<space>\s+)|(?P<comment>/\*.*?\*/)|(?P<string>'(?:[^']|'')*')|(?P<ref>#[1-9]\d*)|(?P<enum>\.[A-Z_]+\.)|(?P<number>[+-]?(?:\d+\.?\d*|\.\d+)(?:[Ee][+-]?\d+)?)|(?P<word>[A-Z_][A-Z_0-9-]*)|(?P<punct>[(),;=$*])", re.S)


def tokens(source):
    out, at = [], 0
    while at < len(source):
        match = TOKEN.match(source, at)
        if not match:
            raise ValueError('unsupported token at offset ' + str(at))
        kind, value = match.lastgroup, match.group()
        if kind not in ('space', 'comment'):
            out.append((kind, value))
        at = match.end()
    return out


def records(source):
    statements, pending = [], []
    for token in tokens(source):
        if token == ('punct', ';'):
            statements.append(pending)
            pending = []
        else:
            pending.append(token)
    if pending:
        raise ValueError('unterminated statement')
    data, entities, schema = False, {}, []
    for statement in statements:
        if statement == [('word', 'DATA')]:
            data = True
            continue
        if statement == [('word', 'ENDSEC')]:
            data = False
            continue
        if statement and statement[0] == ('word', 'FILE_SCHEMA'):
            schema = [v[1:-1].replace("''", "'") for k, v in statement if k == 'string']
        if not data:
            continue
        if len(statement) < 4 or statement[0][0] != 'ref' or statement[1] != ('punct', '='):
            raise ValueError('invalid DATA record')
        ident = int(statement[0][1][1:])
        if ident in entities:
            raise ValueError('duplicate id #' + str(ident))
        body = statement[2:]
        depth = 0
        for kind, value in body:
            if kind == 'punct':
                depth += (value == '(') - (value == ')')
                if depth < 0:
                    raise ValueError('unbalanced record')
        if depth:
            raise ValueError('unbalanced record')
        entities[ident] = body
    if not entities or not schema:
        raise ValueError('missing DATA records or FILE_SCHEMA')
    return entities, schema


def refs(body):
    return [int(value[1:]) for kind, value in body if kind == 'ref']


def name(body):
    return body[0][1] if body[0][0] == 'word' else 'COMPLEX'


def close(a, b):
    return all(abs(x - y) <= 1e-7 for x, y in zip(a, b))


def bounds(points):
    return {'min': [min(p[k] for p in points) for k in range(3)], 'max': [max(p[k] for p in points) for k in range(3)]}


def check(source, expected):
    entities, schema = records(source)
    if len(schema) != 1 or not schema[0].startswith('AUTOMOTIVE_DESIGN'):
        raise ValueError('unexpected schema ' + str(schema))
    for ident, body in entities.items():
        for target in refs(body):
            if target not in entities:
                raise ValueError('dangling reference #' + str(target) + ' from #' + str(ident))
    counts = collections.Counter(name(body) for body in entities.values())
    length_units = [body for body in entities.values() if ('word', 'LENGTH_UNIT') in body]
    mm = [('word', 'SI_UNIT'), ('punct', '('), ('enum', '.MILLI.'), ('punct', ','), ('enum', '.METRE.'), ('punct', ')')]
    if len(length_units) != 1 or not any(length_units[0][i:i + len(mm)] == mm for i in range(len(length_units[0]))):
        raise ValueError('expected one declared millimetre length unit')
    if counts['PRODUCT'] != expected['productCount'] or counts['MANIFOLD_SOLID_BREP'] != expected['solidCount']:
        raise ValueError('product or manifold-solid count mismatch')
    vertices = {}
    for ident, body in entities.items():
        if name(body) != 'VERTEX_POINT':
            continue
        targets = refs(body)
        if len(targets) != 1 or name(entities[targets[0]]) != 'CARTESIAN_POINT':
            raise ValueError('invalid vertex point reference')
        xyz = [float(value) for kind, value in entities[targets[0]] if kind == 'number']
        if len(xyz) != 3 or not all(math.isfinite(x) for x in xyz):
            raise ValueError('invalid 3D vertex coordinate')
        vertices[ident] = xyz
    per_solid = []
    for ident, body in entities.items():
        if name(body) != 'MANIFOLD_SOLID_BREP':
            continue
        reached, todo = set(), [ident]
        while todo:
            current = todo.pop()
            if current not in reached:
                reached.add(current)
                todo.extend(refs(entities[current]))
        points = [point for key, point in vertices.items() if key in reached]
        if len(points) != 8:
            raise ValueError('this fixture requires eight topological vertices per prism')
        per_solid.append(bounds(points))
    if not vertices:
        raise ValueError('no prismatic vertices')
    actual = bounds(list(vertices.values()))
    wanted = expected['bounds']
    if not close(actual['min'], wanted['min']) or not close(actual['max'], wanted['max']):
        raise ValueError('aggregate vertex bounds mismatch')
    remaining = list(per_solid)
    for wanted in expected['solidBounds']:
        found = next((box for box in remaining if close(box['min'], wanted['min']) and close(box['max'], wanted['max'])), None)
        if found is None:
            raise ValueError('per-solid vertex bounds mismatch')
        remaining.remove(found)
    if remaining:
        raise ValueError('unexpected additional solid bounds')
    absent = ['NEXT_ASSEMBLY_USAGE_OCCURRENCE', 'MAPPED_ITEM', 'REPRESENTATION_MAP', 'STYLED_ITEM', 'COLOUR_RGB', 'DATUM', 'GEOMETRIC_TOLERANCE']
    return {'status': 'PASS', 'scope': 'INDEPENDENT_GRAPH_AND_PRISM_VERTEX_BOUNDS_ONLY', 'schema': schema, 'units': 'mm', 'entities': len(entities), 'counts': dict(sorted(counts.items())), 'vertexCount': len(vertices), 'bounds': actual, 'solidBounds': per_solid, 'absentEntities': {key: counts[key] for key in absent}, 'volume': 'NOT_CALCULATED'}


def selftest(source, expected):
    result = check(source, expected)
    # Fake records and references in comments/escaped strings must remain plain text.
    decoy = source.replace('DATA;', "/* #999999=MANIFOLD_SOLID_BREP('fake',#888888); */\nDATA;", 1)
    decoy = decoy.replace('FILE_DESCRIPTION((', "FILE_DESCRIPTION(('fake #777777=VERTEX_POINT(''O''''Brien'',#666666);',", 1)
    assert check(decoy, expected)['counts'] == result['counts']
    entities, _ = records(source)
    vertex = next(body for body in entities.values() if name(body) == 'VERTEX_POINT')
    point_id = refs(vertex)[0]
    vertex_line = re.search(r'#[1-9]\d*=VERTEX_POINT\([^;]+;', source).group()
    point_line = re.search(r'#' + str(point_id) + r'=CARTESIAN_POINT\([^;]+;', source).group()
    first_line = re.search(r'#[1-9]\d*=[^\n]+;', source).group()
    broken = {
        'dangling-reference': source.replace(vertex_line, re.sub(r'#[1-9]\d*(?=\))', '#999999999', vertex_line), 1),
        'duplicate-id': source.replace('DATA;', 'DATA;\n' + first_line, 1),
        'altered-coordinate': source.replace(point_line, '#' + str(point_id) + "=CARTESIAN_POINT('',(99999.,99999.,99999.));", 1),
        'wrong-unit': source.replace('SI_UNIT(.MILLI.,.METRE.)', 'SI_UNIT(.CENTI.,.METRE.)', 1),
        'wrong-schema': source.replace('AUTOMOTIVE_DESIGN', 'UNSUPPORTED_SCHEMA', 1),
    }
    caught = {}
    for label, changed in broken.items():
        try:
            check(changed, expected)
        except ValueError as error:
            caught[label] = str(error)
        else:
            raise AssertionError('negative control survived: ' + label)
    return {'status': 'PASS', 'positiveControls': 2, 'negativeControlsDetected': len(caught), 'negativeResults': caught, 'productImports': 0}


if __name__ == '__main__':
    try:
        text = Path(sys.argv[1]).read_text()
        expectation = json.loads(Path(sys.argv[2]).read_text())
        print(json.dumps(selftest(text, expectation) if '--selftest' in sys.argv[3:] else check(text, expectation), indent=2))
    except (ValueError, AssertionError, IndexError) as error:
        print(json.dumps({'status': 'FAIL', 'error': str(error)}))
        sys.exit(1)
