"""Read the selected split Detail exports using XML, ezdxf and PDF page content."""
import json
import re
import subprocess
import sys
from pathlib import Path
from xml.etree import ElementTree

import ezdxf

files = json.load(sys.stdin)
ns = {"svg": "http://www.w3.org/2000/svg"}
nominal = "Ø12 THRU +0.15/-0.14"


def svg(path):
    root = ElementTree.parse(path).getroot()
    assert (root.get("width"), root.get("height")) == ("420mm", "297mm")
    return root


def text(element):
    return [item.text for item in element.findall(".//svg:text", ns)]


parent, detail = svg(files["parent"]), svg(files["detail"])
parent_callout = parent.find('.//svg:g[@class="detail"][@data-view="top"][@data-dim="B"]', ns)
assert text(parent_callout) == ["B", "SEE SHEET 2"]
assert parent.find('.//svg:g[@data-view="detail:B"]', ns) is None
detail_view = detail.find('.//svg:g[@class="detail"][@data-view="detail:B"][@data-dim="B"]', ns)
rim = detail_view.findall('./svg:path[@stroke-width="0.5"]', ns)
assert len(rim) == 2 and all(re.search(r"A12 12 ", path.get("d")) for path in rim)
dimension = detail.find('.//svg:g[@class="dimension"][@data-view="detail:B"][@data-dim="b-diameter"]', ns)
assert text(dimension) == [nominal]
attached = detail.find('.//svg:g[@class="control"][@data-view="detail:B"][@data-dim="b-attached"]', ns)
standalone = detail.find('.//svg:g[@class="control"][@data-view="detail:B"][@data-standalone-frame="b-frame"]', ns)
assert text(attached) == ["0.05"] and text(standalone) == ["0.07"]

drawing = ezdxf.readfile(files["dxf"])
assert drawing.dxfversion == "AC1015" and drawing.header["$INSUNITS"] == 4
audit = drawing.audit()
assert not audit.errors and not audit.fixes
space = drawing.modelspace()
diameter, = space.query("DIMENSION")
assert abs(diameter.dxf.actual_measurement - 12) <= 1e-9
assert diameter.dxf.text.replace("%%c", "Ø") == nominal
arcs = space.query('ARC[layer=="VISIBLE"]')
assert len(arcs) == 2 and all(abs(arc.dxf.radius - 12) <= 1e-9 for arc in arcs)
assert {"DETAIL B (2:1)", "FROM SHEET 1", "0.05", "0.07"} <= {entity.dxf.text for entity in space.query("TEXT")}

pdf = Path(files["pdf"]).read_bytes().decode("latin1")
assert pdf.startswith("%PDF-1.4")
metadata = subprocess.check_output(["pdfinfo", files["pdf"]], text=True)
assert re.search(r"^Pages:\s+2$", metadata, re.M)
assert re.search(r"^Page size:.*\(A3\)", metadata, re.M)
objects = {int(number): body for number, body in re.findall(r"^(\d+) 0 obj\n(.*?)^endobj$", pdf, re.M | re.S)}
pages = next(body for body in objects.values() if re.search(r"/Type /Pages\b", body))
children = re.search(r"/Kids \[(.*?)\]", pages)[1]
streams = []
for number in re.findall(r"(\d+) 0 R", children):
    page = objects[int(number)]
    stream = objects[int(re.search(r"/Contents (\d+) 0 R", page)[1])]
    literals = re.findall(r"\(((?:\\.|[^()\\])*)\) Tj", stream)
    streams.append({re.sub(r"\\([0-7]{3}|[()\\])", lambda m: chr(int(m[1], 8)) if len(m[1]) == 3 else m[1], item)
                    for item in literals})
assert len(streams) == 2
assert {"1 OF 2 A3", "SEE SHEET 2"} <= streams[0] and nominal not in streams[0]
assert {"2 OF 2 A3", "DETAIL B (2:1)", "FROM SHEET 1", nominal, "0.05", "0.07"} <= streams[1]

print(json.dumps({"status": "PASS", "svgSheets": 2, "dxfVersion": drawing.dxfversion,
                  "ezdxf": ezdxf.__version__, "pdfPages": len(streams), "holeDiameterMM": 12,
                  "detailRimRadiusOnSheetMM": 12, "frameValuesMM": [0.05, 0.07]}))
