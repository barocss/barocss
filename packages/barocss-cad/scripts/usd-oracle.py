"""Test oracle for RM9c's USD export (O66), run with usd-core 26.8 (Pixar's OpenUSD wheel) in ~/.cache/barocss-usd,
the owner's go-ahead relayed 2026-10-20: a test venv only, never a product dependency. Run outside the product, by hand.

It opens the exported .usda with OpenUSD (a stage that will not open, or composition errors, fail), then reads it with
UsdPhysics' own parser (UsdPhysics.LoadUsdPhysicsFromRange — the parser the schema's simulators share) and the MassAPI's
attributes, and prints what it found: each rigid body's world position and rotation, mass, centre of mass, diagonal
inertia and principal axes; each joint's type, bodies, axis, limits and local frames; the articulation; and the
spherical joints outside it. test/robot-sdf-usd.test.ts compares that reading with the studio's numbers.

    uv venv ~/.cache/barocss-usd --python 3.12
    VIRTUAL_ENV=~/.cache/barocss-usd uv pip install --require-hashes -r requirements.txt   # usd-core==26.8 --hash=sha256:aaf1a6…
    ~/.cache/barocss-usd/bin/python -I packages/barocss-cad/scripts/usd-oracle.py packages/barocss-cad/conformance/rm/arm-6r/robot.usda \\
        > packages/barocss-cad/conformance/rm/arm-6r/oracle.usd-core-26.8.json
"""
import json
import math
import sys
import warnings

from pxr import Usd, UsdPhysics


def vec(v):
    return [float(x) for x in v] if v is not None else None


def fin(x):
    """A limit as JSON takes it: an open one (±inf) as null."""
    return float(x) if math.isfinite(x) else None


def quat(q):
    return [float(q.GetReal()), *[float(x) for x in q.GetImaginary()]] if q is not None else None


def main():
    path = sys.argv[1]
    stage = Usd.Stage.Open(path)
    errors = [str(e) for e in stage.GetCompositionErrors()] if hasattr(stage, 'GetCompositionErrors') else []
    with warnings.catch_warnings():
        warnings.simplefilter('ignore', DeprecationWarning)
        parsed = UsdPhysics.LoadUsdPhysicsFromRange(stage, ['/'])
    out = {'usd': '.'.join(str(x) for x in Usd.GetVersion()), 'file': path.rsplit('/', 1)[-1], 'composition_errors': errors,
           'metersPerUnit': float(stage.GetMetadata('metersPerUnit')), 'kilogramsPerUnit': float(stage.GetMetadata('kilogramsPerUnit')), 'upAxis': stage.GetMetadata('upAxis'),
           'bodies': {}, 'joints': {}, 'articulations': [], 'other': {}}
    for kind, (paths, descs) in parsed.items():
        name = str(kind).split('.')[-1]
        for p, d in zip(paths, descs):
            if name == 'RigidBody':
                prim = stage.GetPrimAtPath(p)
                m = UsdPhysics.MassAPI(prim)
                out['bodies'][prim.GetName()] = {'position': vec(d.position), 'rotation': quat(d.rotation), 'mass': m.GetMassAttr().Get(), 'centerOfMass': vec(m.GetCenterOfMassAttr().Get()),
                                                 'diagonalInertia': vec(m.GetDiagonalInertiaAttr().Get()), 'principalAxes': quat(m.GetPrincipalAxesAttr().Get())}
            elif name.endswith('Joint'):
                limit = getattr(d, 'limit', None)
                out['joints'][str(p).rsplit('/', 1)[-1]] = {'type': name, 'body0': str(d.body0).rsplit('/', 1)[-1], 'body1': str(d.body1).rsplit('/', 1)[-1],
                                                           'axis': str(getattr(d, 'axis', '')).split('.')[-1] or None,
                                                           'limit': {'enabled': bool(limit.enabled), 'lower': fin(limit.lower), 'upper': fin(limit.upper)} if limit is not None else None,
                                                           'localPose0Position': vec(d.localPose0Position), 'localPose0Orientation': quat(d.localPose0Orientation),
                                                           'localPose1Position': vec(d.localPose1Position), 'localPose1Orientation': quat(d.localPose1Orientation),
                                                           'excludeFromArticulation': bool(d.excludeFromArticulation)}
            elif name == 'Articulation':
                out['articulations'].append({'root': str(p), 'bodies': len(d.articulatedBodies), 'joints': len(d.articulatedJoints)})
            else:
                out['other'].setdefault(name, []).append(str(p))
    print(json.dumps(out, indent=1, sort_keys=True))
    return 1 if errors or not out['bodies'] else 0


if __name__ == '__main__':
    sys.exit(main())
