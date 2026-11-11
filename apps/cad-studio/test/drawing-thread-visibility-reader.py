"""Check actual Studio A3 SVG and DXF 2000 files using independent readers."""
import json
import math
import re
import sys
import xml.etree.ElementTree as ET

import ezdxf

request = json.load(sys.stdin)
visible, pen, depth = (request[key] for key in ("visible", "pen", "depth"))
namespace = {"svg": "http://www.w3.org/2000/svg"}
root = ET.parse(request["svg"]).getroot()
assert (root.get("width"), root.get("height")) == ("420mm", "297mm")
front, = root.findall(".//svg:g[@class='view'][@data-view='front']", namespace)
outline = front.findall("svg:line[@stroke-width='0.5']", namespace)
x = [float(line.get(key)) for line in outline for key in ("x1", "x2")]
y = [float(line.get(key)) for line in outline for key in ("y1", "y2")]
assert len(outline) == 4 and (max(x) - min(x), max(y) - min(y)) == (32, 8)
cx, cy = min(x) + (22 if visible else 10), min(y) + 4

paths = front.findall("svg:path", namespace)
cosmetics = [path for path in paths if "A3 3 " in path.get("d")]
rims = [path for path in paths if "A2.5 2.5 " in path.get("d")]
assert len(cosmetics) == int(pen != "none")
assert len(rims) == request["rims"]
assert all(path.get("stroke-dasharray") == (None if visible else "3 1.5") for path in rims)
if cosmetics:
    mark, = cosmetics
    match = re.fullmatch(r"M([\d.-]+) ([\d.-]+)A3 3 0 1 1 ([\d.-]+) ([\d.-]+)", mark.get("d"))
    assert match and tuple(map(float, match.groups())) == (cx + 3, cy, cx, cy - 3)
    assert mark.get("stroke-dasharray") == ("3 1.5" if pen == "hidden" else None)
centerlines = front.findall("svg:line[@stroke-dasharray='8 1.5 1.5 1.5']", namespace)
assert len(centerlines) == 2
callout = f"M6×1 × {depth} DEEP"
dim, = root.findall(".//svg:g[@class='dimension'][@data-dim='tap']", namespace)
assert callout in [t.text for t in dim.findall("svg:text", namespace)]

dxf = ezdxf.readfile(request["dxf"])
assert dxf.dxfversion == "AC1015" and dxf.header["$INSUNITS"] == 4
audit = dxf.audit()
assert not audit.errors and not audit.fixes, (audit.errors, audit.fixes)
msp = dxf.modelspace()
near = lambda a, b: math.isclose(a, b, abs_tol=1e-8)
at_axis = [arc for arc in msp.query("ARC")
           if near(arc.dxf.center.x, cx) and near(arc.dxf.center.y, 297 - cy)]
cosmetics = [arc for arc in at_axis if near(arc.dxf.radius, 3)]
rims = [arc for arc in at_axis if near(arc.dxf.radius, 2.5)]
assert len(cosmetics) == int(pen != "none")
assert len(rims) == request["rims"]
assert all(arc.dxf.layer == ("VISIBLE" if visible else "HIDDEN") for arc in rims)
if cosmetics:
    mark, = cosmetics
    assert mark.dxf.layer == pen.upper()
    assert near(mark.dxf.start_angle % 360, 90) and near(mark.dxf.end_angle % 360, 0)
    assert near((mark.dxf.end_angle - mark.dxf.start_angle) % 360, 270)
    if pen == "hidden":
        assert dxf.layers.get("HIDDEN").dxf.linetype == "BC_HIDDEN"

axis = {(cx - 5, 297 - cy), (cx + 5, 297 - cy)}
assert any({tuple(line.dxf.start)[:2], tuple(line.dxf.end)[:2]} == axis
           for line in msp.query('LINE[layer=="CENTER"]'))
dimension, = msp.query("DIMENSION")
assert near(dimension.dxf.actual_measurement, 5)
assert dimension.dxf.text == callout
print(json.dumps({"status": "PASS", "reader": f"ElementTree and ezdxf {ezdxf.__version__}",
                  "pen": pen, "centerMM": [cx, cy], "radiusMM": 3, "rims": len(rims), "callout": callout}))
