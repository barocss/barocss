"""Test oracle for the DXF writer (R11b, O1): reads a DXF file with ezdxf (MIT) and prints what it found as
JSON. Run outside the product, by hand; its output is committed as data (conformance/r11b/<case>/oracle.*.json)
and checked by test/dxf-writer.test.mjs. ezdxf is never a dependency of the package.

    uv venv ~/.cache/barocss-ezdxf --python 3.12 && VIRTUAL_ENV=~/.cache/barocss-ezdxf uv pip install ezdxf==1.4.5
    ~/.cache/barocss-ezdxf/bin/python -I scripts/dxf-oracle.py <file.dxf> > <oracle.json>
"""
import json
import sys

import ezdxf
from ezdxf.render import hatching


def xy(v):
    return [float(v[0]), float(v[1])]


def summary(e):
    t = e.dxftype()
    d = {"type": t, "layer": e.dxf.layer}
    if e.dxf.hasattr("linetype"):
        d["linetype"] = e.dxf.linetype
    if t == "LINE":
        d.update(a=xy(e.dxf.start), b=xy(e.dxf.end))
    elif t == "CIRCLE":
        d.update(center=xy(e.dxf.center), radius=e.dxf.radius)
    elif t == "ARC":
        d.update(center=xy(e.dxf.center), radius=e.dxf.radius, startDeg=e.dxf.start_angle, endDeg=e.dxf.end_angle)
    elif t == "ELLIPSE":
        d.update(center=xy(e.dxf.center), major=xy(e.dxf.major_axis), ratio=e.dxf.ratio, start=e.dxf.start_param, end=e.dxf.end_param)
        d["samples"] = [xy(p) for p in e.construction_tool().vertices([e.dxf.start_param + (e.dxf.end_param - e.dxf.start_param) * k / 16 for k in range(17)])]
    elif t == "LWPOLYLINE":
        d.update(points=[[p[0], p[1]] for p in e.get_points("xy")], bulges=[p[2] for p in e.get_points("xyb")], closed=bool(e.closed))
    elif t == "POLYLINE":
        d.update(points=[xy(v.dxf.location) for v in e.vertices], bulges=[v.dxf.bulge for v in e.vertices], closed=bool(e.is_closed))
    elif t == "SPLINE":
        tool = e.construction_tool()
        k = list(e.knots)
        lo, hi = k[e.dxf.degree], k[len(k) - e.dxf.degree - 1]
        d.update(degree=e.dxf.degree, knots=k, control=[xy(p) for p in e.control_points], weights=list(e.weights))
        d["samples"] = [xy(tool.point(lo + (hi - lo) * j / 16)) for j in range(17)]
    elif t == "TEXT":
        d.update(at=xy(e.dxf.insert), height=e.dxf.height, text=e.plain_text(), rotationDeg=e.dxf.rotation, halign=e.dxf.halign, style=e.dxf.style)
        if e.dxf.halign:
            d["alignAt"] = xy(e.dxf.align_point)
    elif t == "MTEXT":
        d.update(at=xy(e.dxf.insert), height=e.dxf.char_height, text=e.plain_text(split=False), style=e.dxf.style, rotationDeg=e.get_rotation())
    elif t == "SOLID":
        d.update(points=[xy(e.dxf.get(f"vtx{i}")) for i in range(4)])
    elif t == "HATCH":
        d.update(pattern=e.dxf.pattern_name, solid=bool(e.dxf.solid_fill))
        d["loops"] = [{"points": [[v[0], v[1]] for v in p.vertices], "bulges": [v[2] for v in p.vertices] if p.has_bulge() else None} for p in e.paths]
        if e.pattern:
            d["lines"] = [{"angle": ln.angle, "base": xy(ln.base_point), "offset": xy(ln.offset)} for ln in e.pattern.lines]
            segs = list(hatching.hatch_entity(e))
            d["rendered"] = {"lines": len(segs), "length": sum((s[1] - s[0]).magnitude for s in segs)}
    elif t == "INSERT":
        d.update(block=e.dxf.name, at=xy(e.dxf.insert), scale=e.dxf.xscale, rotationDeg=e.dxf.rotation)
    elif t == "DIMENSION":
        d.update(dimtype=e.dimtype, block=e.dxf.geometry, text=e.dxf.text, textAt=xy(e.dxf.text_midpoint), style=e.dxf.dimstyle,
                 defpoint=xy(e.dxf.defpoint))
        for k in ("defpoint2", "defpoint3", "defpoint4", "defpoint5"):
            if e.dxf.hasattr(k):
                d[k] = xy(e.dxf.get(k))
        if e.dxf.hasattr("angle"):
            d["angle"] = e.dxf.angle
        if e.dxf.hasattr("actual_measurement"):
            d["measurement"] = e.dxf.actual_measurement
    return d


def main(path):
    doc = ezdxf.readfile(path)
    audit = doc.audit()
    out = {
        "ezdxf": ezdxf.__version__,
        "dxfversion": doc.dxfversion,
        "insunits": doc.header.get("$INSUNITS"),
        "audit": {"errors": [str(x.message) for x in audit.errors], "fixes": [str(x.message) for x in audit.fixes]},
        "layers": [{"name": l.dxf.name, "color": l.dxf.color, "linetype": l.dxf.linetype, "lineweight": l.dxf.lineweight if l.dxf.hasattr("lineweight") else None} for l in doc.layers],
        "linetypes": [{"name": t.dxf.name, "pattern": [v for c, v in t.pattern_tags.tags if c == 49] if t.pattern_tags else []} for t in doc.linetypes],
        "styles": [{"name": s.dxf.name, "font": s.dxf.font} for s in doc.styles],
        "modelspace": [summary(e) for e in doc.modelspace()],
        "blocks": {b.name: [summary(e) for e in b] for b in doc.blocks if not b.name.lower().startswith(("*model_space", "*paper_space", "$model_space", "$paper_space"))},
    }
    json.dump(out, sys.stdout, indent=1, sort_keys=True)
    sys.stdout.write("\n")


if __name__ == "__main__":
    main(sys.argv[1])
