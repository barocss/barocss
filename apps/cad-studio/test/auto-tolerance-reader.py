"""Read the actual Studio export bytes without the CAD producer."""
from decimal import Decimal
import json
import re
import sys
import xml.etree.ElementTree as ET

import ezdxf

request = json.load(sys.stdin)
ns = {"svg": "http://www.w3.org/2000/svg"}
svg = ET.parse(request["svg"])
groups = svg.findall(".//svg:g[@class='dimension']", ns)
width = [g for g in groups if g.get("data-dim") == request["id"]]
assert len(groups) == 3 and len(width) == 1, (len(groups), len(width))
label = re.compile(r"^40\s*(?:±|%%p)\s*0\.05$", re.IGNORECASE)

def text(group):
    return " ".join(t.text for t in group.findall("svg:text", ns) if t.text)

assert label.fullmatch(text(width[0])), text(width[0])
assert sum(bool(label.fullmatch(text(g))) for g in groups) == 1

dxf = ezdxf.readfile(request["dxf"])
audit = dxf.audit()
assert not audit.errors and not audit.fixes, (audit.errors, audit.fixes)
dims = list(dxf.modelspace().query("DIMENSION"))
assert dxf.dxfversion == "AC1015" and dxf.header["$INSUNITS"] == 4
assert len(dims) == 3
matching = [d for d in dims if label.fullmatch(d.dxf.text)]
assert len(matching) == 1, [d.dxf.text for d in dims]
width_dim = matching[0]
assert abs(width_dim.dxf.actual_measurement - 40) < 1e-9
block = dxf.blocks[width_dim.dxf.geometry]
assert any(label.fullmatch(t.dxf.text) for t in block.query("TEXT"))
nominal, tolerance = Decimal("40"), Decimal("0.05")
assert (nominal - tolerance, nominal + tolerance) == (Decimal("39.95"), Decimal("40.05"))
print(json.dumps({"status": "PASS", "reader": f"ElementTree and ezdxf {ezdxf.__version__}", "svg_dimensions": len(groups),
                  "dxf_dimensions": len(dims), "measurement_mm": width_dim.dxf.actual_measurement,
                  "limits_mm": [str(nominal - tolerance), str(nominal + tolerance)]}))
