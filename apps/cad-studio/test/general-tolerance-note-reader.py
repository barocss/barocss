"""Read Studio's A3 SVG and DXF 2000 without using the CAD model."""
from fractions import Fraction
import json
import math
import re
import sys
import xml.etree.ElementTree as ET

import ezdxf

r = json.load(sys.stdin)
ns = {"svg": "http://www.w3.org/2000/svg"}
root = ET.parse(r["svg"]).getroot()
assert (root.get("width"), root.get("height"), root.get("viewBox")) == ("420mm", "297mm", "0 0 420 297")
title, = root.findall(".//svg:g[@class='title']", ns)
assert r["units"] in [t.text for t in title.findall("svg:text", ns)]
assert "1:1" in [t.text for t in title.findall("svg:text", ns)]

def nearby(a, b):
    return math.isclose(a, b, rel_tol=0, abs_tol=1e-7)

def segment(line):
    return frozenset((float(line.get("x" + str(i))), float(line.get("y" + str(i)))) for i in (1, 2))

outlines = set()
for view, height in (("front", 6.35), ("top", 12.7)):
    group, = root.findall(f".//svg:g[@class='view'][@data-view='{view}']", ns)
    lines = {segment(e) for e in group.findall("svg:line[@stroke-width='0.5']", ns)}
    xs, ys = zip(*(point for e in lines for point in e))
    x0, x1, y0, y1 = min(xs), max(xs), min(ys), max(ys)
    assert nearby(x1 - x0, 25.4) and nearby(y1 - y0, height)
    corners = [(x0, y0), (x1, y0), (x1, y1), (x0, y1)]
    assert lines == {frozenset((corners[i], corners[(i+1) % 4])) for i in range(4)}
    outlines.update(lines)

notes = {g.get("data-dim"): g.findall("svg:text", ns) for g in root.findall(".//svg:g[@class='note']", ns)}
assert set(notes) == set(r["notes"])
for id, note in r["notes"].items():
    assert [t.text for t in notes[id]] == note.splitlines()
    assert all(0 < float(t.get("x")) < 420 and 0 < float(t.get("y")) < 297 for t in notes[id])
dim, = root.findall(".//svg:g[@class='dimension'][@data-dim='width']", ns)
def has_nominal(text):
    primary, separator, secondary = r["nominal"].partition(" [")
    first = re.match(r"([\d.]+)(?: |$)", text)
    other = re.search(r"\[([\d.]+)(?: |\])", text)
    return (first and Fraction(first[1]) == Fraction(primary) and
            (not separator or (other and Fraction(other[1]) == Fraction(secondary[:-1]))))

assert any(has_nominal(t.text) for t in dim.findall("svg:text", ns))
if r["explicit"]:
    change = r["notes"][r["generated"]].splitlines()[1]
    values = re.fullmatch(r"LINEAR ±(\d+\.\d+) mm · ANGULAR ±(\d+\.\d+)°", change)
    assert values
    linear, angular = map(Fraction, values.groups())
    assert linear / Fraction("25.4") == Fraction(1, 127)
    assert [Fraction("25.4") - linear, Fraction("25.4") + linear] == [Fraction("25.2"), Fraction("25.6")]
    assert angular == Fraction(1, 2)

dxf = ezdxf.readfile(r["dxf"])
assert dxf.dxfversion == "AC1015" and dxf.header["$INSUNITS"] == 4
audit = dxf.audit()
assert not audit.errors and not audit.fixes
space = dxf.modelspace()
title, = space.query('INSERT[name=="TITLE_BLOCK"]')
dxf_title = [t.dxf.text for t in title.virtual_entities() if t.dxftype() == "TEXT"]
assert r["units"] in dxf_title and "1:1" in dxf_title
line_pairs = {frozenset((round(v.x, 6), round(v.y, 6)) for v in (line.dxf.start, line.dxf.end))
              for line in space.query('LINE[layer=="VISIBLE"]')}
assert line_pairs == {frozenset((round(x, 6), round(297-y, 6)) for x, y in e) for e in outlines}
dxf_text = list(space.query('TEXT[layer=="TEXT"]'))
for group in notes.values():
    for t in group:
        x, y = (float(t.get(key)) for key in ("x", "y"))
        matches = [e for e in dxf_text if e.plain_text() == t.text and
                   nearby(e.dxf.insert.x, x) and nearby(e.dxf.insert.y, 297 - y)]
        assert len(matches) == 1, t.text
dimension, = space.query("DIMENSION")
assert nearby(dimension.dxf.actual_measurement, 25.4)
assert has_nominal(dimension.dxf.text)
print(json.dumps({"status": "PASS", "units": r["units"], "linearNoteMM": 0.2 if r["explicit"] else None,
                  "nominalMM": 25.4, "reader": f"ElementTree and ezdxf {ezdxf.__version__}"}))
