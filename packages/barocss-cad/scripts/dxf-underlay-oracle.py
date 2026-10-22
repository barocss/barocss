"""Fixtures and test oracle for the DXF underlay (A6.4, O68), with ezdxf 1.4.5 (MIT) in O1's venv ~/.cache/barocss-ezdxf.
Run outside the product, by hand; ezdxf is never a dependency of the package.

  make <dir>   writes the fixtures, each <dir>/<case>/drawing.dxf, from the numbers below (the test's closed forms use them)
  read <file>  reads one with ezdxf and prints, as JSON, what it found: the top level's entities by type; the underlay's
               after every INSERT is expanded (recursively, MINSERT grids too) by ezdxf's own virtual_entities(); each
               SPLINE's points at 64 parameters (BSpline.point), each ELLIPSE's at 16 (ConstructionEllipse.vertices), each
               TEXT's and MTEXT's insertion, height, rotation and plain text (MText.plain_text())

    ~/.cache/barocss-ezdxf/bin/python -I packages/barocss-cad/scripts/dxf-underlay-oracle.py make packages/barocss-cad/conformance/a6/underlay
    ~/.cache/barocss-ezdxf/bin/python -I packages/barocss-cad/scripts/dxf-underlay-oracle.py read <case>/drawing.dxf > <case>/oracle.ezdxf-1.4.5.json
"""
import json
import math
import os
import sys

import ezdxf
from ezdxf.enums import TextEntityAlignment


def new():
    doc = ezdxf.new('R2018', setup=False)
    doc.header['$INSUNITS'] = 4
    return doc, doc.modelspace()


def splines(path):
    doc, msp = new()
    msp.add_open_spline([(0, 0), (10, 20), (30, 25), (45, 5), (60, 15), (80, 0)], degree=3)
    r = math.sqrt(0.5)
    msp.add_rational_spline([(100, 0), (100, 20), (80, 20)], [1, r, 1], degree=2)
    msp.add_open_spline([(0, 40), (8, 55), (20, 60), (35, 50), (50, 65), (62, 45), (75, 58), (90, 40)], degree=5)
    msp.add_spline([(0, 80), (20, 90), (40, 80), (60, 95)])  # fit points only: listed, not drawn
    doc.saveas(path)


def ellipses(path):
    doc, msp = new()
    msp.add_ellipse((50, 50), major_axis=(30, 0), ratio=0.5)
    msp.add_ellipse((120, 50), major_axis=(0, 25), ratio=0.4, start_param=0.3, end_param=2.5)
    msp.add_ellipse((50, 120), major_axis=(20, 20), ratio=0.3, start_param=1.0, end_param=5.0)
    doc.saveas(path)


def blocks(path):
    doc, msp = new()
    c = doc.blocks.new('C', base_point=(1, 2))
    c.add_circle((5, 0), 10)
    c.add_line((0, 0), (15, 5))
    b = doc.blocks.new('B')
    b.add_blockref('C', (20, 0), dxfattribs={'xscale': 2, 'yscale': -1, 'rotation': 30})
    a = doc.blocks.new('A')
    a.add_blockref('B', (0, 10), dxfattribs={'xscale': 1.5, 'yscale': 1.5, 'rotation': -45})
    msp.add_blockref('A', (100, 50), dxfattribs={'rotation': 15})
    msp.add_blockref('C', (10, 10), dxfattribs={'extrusion': (0, 0, -1)})
    grid = msp.add_blockref('C', (200, 0), dxfattribs={'rotation': 10})
    grid.grid(size=(2, 3), spacing=(15, 25))
    doc.saveas(path)


def texts(path):
    doc, msp = new()
    msp.add_text('ROTATED', height=2.5, rotation=30).set_placement((10, 10))
    msp.add_text('CENTRED', height=3.5).set_placement((50, 20), align=TextEntityAlignment.MIDDLE_CENTER)
    msp.add_mtext('\\fArial|b0|i0;Hello\\PWorld {\\H2x;big} \\Lunder\\l', dxfattribs={'char_height': 3.5, 'insert': (10, 40), 'rotation': 20})
    doc.saveas(path)


def plate(path):
    doc, msp = new()
    msp.add_lwpolyline([(0, 0), (100, 0), (100, 60), (0, 60)], close=True)
    msp.add_circle((20, 20), 5)
    c = doc.blocks.new('MARK')
    c.add_circle((0, 0), 3)
    c.add_line((-4, 0), (4, 0))
    msp.add_blockref('MARK', (70, 30))
    msp.add_open_spline([(10, 70), (30, 85), (60, 65), (90, 80)], degree=3)
    msp.add_text('PLATE 3MM', height=3).set_placement((10, -10))
    doc.saveas(path)


CASES = {'splines': splines, 'ellipses': ellipses, 'blocks': blocks, 'texts': texts, 'plate': plate}


def expand(e, out):
    """The entity, or — an INSERT — its virtual entities, recursively (a MINSERT's every grid cell)."""
    if e.dxftype() == 'INSERT':
        cells = list(e.multi_insert()) if e.mcount > 1 else [e]
        for cell in cells:
            for v in cell.virtual_entities():
                expand(v, out)
        return
    out.append(e)


def xy(v):
    return [float(v[0]), float(v[1])]


def record(e):
    t = e.dxftype()
    d = {'type': t}
    if t == 'LINE':
        d.update(a=xy(e.dxf.start), b=xy(e.dxf.end))
    elif t == 'CIRCLE':
        d.update(center=xy(e.dxf.center), radius=e.dxf.radius, extrusion=list(e.dxf.extrusion))
    elif t == 'ARC':
        d.update(center=xy(e.dxf.center), radius=e.dxf.radius, start=e.dxf.start_angle, end=e.dxf.end_angle, extrusion=list(e.dxf.extrusion))
    elif t == 'ELLIPSE':
        ce = e.construction_tool()
        params = [e.dxf.start_param + (e.dxf.end_param - e.dxf.start_param if e.dxf.end_param > e.dxf.start_param else e.dxf.end_param + 2 * math.pi - e.dxf.start_param) * k / 15 for k in range(16)]
        d.update(center=xy(e.dxf.center), major=xy(e.dxf.major_axis), ratio=e.dxf.ratio, start=e.dxf.start_param, end=e.dxf.end_param, params=params, points=[xy(p) for p in ce.vertices(params)])
    elif t == 'SPLINE':
        if e.control_point_count() == 0:
            d.update(fitOnly=True, fit=[xy(p) for p in e.fit_points])
        else:
            bs = e.construction_tool()
            knots = list(e.knots)
            t0, t1 = knots[e.dxf.degree], knots[-e.dxf.degree - 1]
            ts = [t0 + (t1 - t0) * k / 63 for k in range(64)]
            d.update(degree=e.dxf.degree, knots=knots, control=[xy(p) for p in e.control_points], weights=list(e.weights), params=ts, points=[xy(bs.point(u)) for u in ts])
    elif t == 'LWPOLYLINE':
        d.update(points=[[float(p[0]), float(p[1]), float(p[4])] for p in e.get_points('xyseb')], closed=bool(e.closed))
    elif t == 'TEXT':
        d.update(insert=xy(e.dxf.insert), align=xy(e.dxf.align_point) if e.dxf.hasattr('align_point') else None, halign=e.dxf.halign, valign=e.dxf.valign, height=e.dxf.height, rotation=e.dxf.rotation, text=e.dxf.text)
    elif t == 'MTEXT':
        d.update(insert=xy(e.dxf.insert), height=e.dxf.char_height, rotation=e.get_rotation(), text=e.plain_text())
    return d


def read(path):
    doc = ezdxf.readfile(path)
    msp = doc.modelspace()
    top = {}
    for e in msp:
        top[e.dxftype()] = top.get(e.dxftype(), 0) + 1
    flat = []
    for e in msp:
        if e.dxftype() == 'INSERT':
            expand(e, flat)
    expanded = {}
    for e in flat:
        expanded[e.dxftype()] = expanded.get(e.dxftype(), 0) + 1
    print(json.dumps({'ezdxf': ezdxf.__version__, 'top': top, 'inBlocks': expanded,
                      'entities': [record(e) for e in msp if e.dxftype() != 'INSERT'], 'blockEntities': [record(e) for e in flat]}, indent=1, sort_keys=True))


if __name__ == '__main__':
    if sys.argv[1] == 'make':
        for name, f in CASES.items():
            os.makedirs(os.path.join(sys.argv[2], name), exist_ok=True)
            f(os.path.join(sys.argv[2], name, 'drawing.dxf'))
    else:
        read(sys.argv[2])
