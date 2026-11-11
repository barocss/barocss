"""Independent reader for the retained starter plate drawing."""
import json
import re
import sys
import xml.etree.ElementTree as ET

import ezdxf

request = json.load(sys.stdin)
show = request["hidden"]
parent = request["parent"]
ns = {"svg": "http://www.w3.org/2000/svg"}
width = {(310, 80), (350, 80)}
side = {(330, 80), (330, 100)}

def svg_points(line):
    return {(float(line.get("x1")), float(line.get("y1"))), (float(line.get("x2")), float(line.get("y2")))}

svg = ET.parse(request["svg"])
root = svg.getroot()
assert root.get("width") == "420mm" and root.get("height") == "297mm"
detail, = svg.findall(".//svg:g[@data-view='detail:B'][@class='detail']", ns)
lines = detail.findall("svg:line", ns)
visible = [line for line in lines if svg_points(line) == width]
assert len(visible) == 1 and visible[0].get("stroke-dasharray") is None
hidden = [line for line in lines if svg_points(line) == side]
assert len(hidden) == int(show), (request["label"], len(hidden), show)
assert all(line.get("stroke-dasharray") == "3 1.5" for line in hidden)
boundary, = detail.findall("svg:path", ns)
assert re.fullmatch(r"M350 80A20 20 0 [01] [01] 310 80A20 20 0 [01] [01] 350 80", boundary.get("d"))
front = svg.findall(".//svg:g[@data-view='front'][@class='view']", ns)
assert len(front) == int(parent)
if front:
    assert len(front[0].findall("svg:line[@stroke-dasharray='3 1.5']", ns)) == 2 * int(show)
    top, = svg.findall(".//svg:g[@data-view='top'][@class='view']", ns)
    assert top.findall("svg:line[@stroke-dasharray='8 1.5 1.5 1.5']", ns), "top centre mark"
else:
    assert any(t.text == "FROM SHEET 1" for t in svg.findall(".//svg:text", ns))
dim, = svg.findall(".//svg:g[@data-dim='hole-side'][@class='dimension']", ns)
assert any(t.text == "8" for t in dim.findall("svg:text", ns))

dxf = ezdxf.readfile(request["dxf"])
assert dxf.dxfversion == "AC1015" and dxf.header["$INSUNITS"] == 4
audit = dxf.audit()
assert not audit.errors and not audit.fixes, (audit.errors, audit.fixes)
msp = dxf.modelspace()

def dxf_count(layer, points):
    expected = {(x, 297 - y) for x, y in points}
    return sum({tuple(e.dxf.start)[:2], tuple(e.dxf.end)[:2]} == expected
               for e in msp.query(f'LINE[layer=="{layer}"]'))

assert dxf_count("VISIBLE", width) == 1
assert dxf_count("HIDDEN", side) == int(show)
assert any(tuple(e.dxf.center)[:2] == (330, 217) and e.dxf.radius == 20
           for e in msp.query('CIRCLE[layer=="THIN"]'))
if parent:
    assert msp.query('LINE[layer=="CENTER"]')
dims = list(msp.query("DIMENSION"))
assert len(dims) == 1 and abs(dims[0].dxf.actual_measurement - 8) < 1e-9
print(json.dumps({"status": "PASS", "hiddenLineCount": int(show), "parent": parent,
                  "reader": f"ElementTree and ezdxf {ezdxf.__version__}", "dimensionMM": 8}))
