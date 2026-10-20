"""Test oracle for RM9a's time of impact (O62), run with MuJoCo 3.3.0 (O38's venv). Run outside the product, by hand.

It replays conformance/rm/ccd-post kinematically: the hinge driven along its own closed-form trapezoid (written here,
not taken from the studio), mj_forward at each time, and the first time any contact involves the named geom. Found
by a scan every 1e-4 s, then bisection to 1e-13 s. MuJoCo's mesh geoms collide as their convex hulls, which for this
case are the boxes the studio's exact meshes bound. MuJoCo's default ccd_tolerance (1e-6 m) would move the contact by
about 2e-5 s at this speed, so it is set to 1e-12 here, with more iterations, in the oracle only.

    ~/.cache/barocss-mujoco/bin/python -I packages/barocss-cad/scripts/ccd-oracle.py packages/barocss-cad/conformance/rm/ccd-post \\
        > packages/barocss-cad/conformance/rm/ccd-post/oracle.mujoco-3.3.0.json
"""
import json
import math
import os
import sys

import mujoco


def trapezoid(D, v, a, t):
    """Distance gone at time t by a rest-to-rest trapezoid of distance D (limits v, a): triangular when v is not reached."""
    T = D / v + v / a if D >= v * v / a else 2 * math.sqrt(D / a)
    ta = v / a if D >= v * v / a else T / 2
    t = min(max(t, 0.0), T)
    if t <= ta:
        return a * t * t / 2
    if t <= T - ta:
        return a * ta * ta / 2 + v * (t - ta)
    return D - a * (T - t) ** 2 / 2


def main():
    case_dir = sys.argv[1]
    case = json.load(open(os.path.join(case_dir, 'case.json')))
    m = case['expect']['mujoco']
    model = mujoco.MjModel.from_xml_path(os.path.join(case_dir, 'model', 'arm.xml'))
    model.opt.ccd_tolerance = 1e-12
    model.opt.ccd_iterations = 1000
    data = mujoco.MjData(model)
    jid = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, m['joint'])
    gid = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_GEOM, m['geom'])
    adr = model.jnt_qposadr[jid]
    D, v, a, q0 = abs(m['to'] - m['from']), m['v'], m['a'], m['from']
    sign = 1.0 if m['to'] >= m['from'] else -1.0
    T = D / v + v / a if D >= v * v / a else 2 * math.sqrt(D / a)

    def contact(t):
        data.qpos[:] = 0
        data.qpos[adr] = q0 + sign * trapezoid(D, v, a, t)
        mujoco.mj_forward(model, data)
        for i in range(data.ncon):
            c = data.contact[i]
            if gid in (c.geom1, c.geom2) and c.dist <= 0:
                return (mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_GEOM, c.geom1), mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_GEOM, c.geom2))
        return None

    lo, hi, t = 0.0, None, 0.0
    while t <= T:
        if contact(t):
            hi = t
            break
        lo = t
        t += 1e-4
    if hi is None:
        print(json.dumps({'mujoco': mujoco.__version__, 'toi_s': None, 'note': 'no contact'}))
        return 1
    while hi - lo > 1e-13:
        mid = (lo + hi) / 2
        if contact(mid):
            hi = mid
        else:
            lo = mid
    geoms = contact(hi)
    print(json.dumps({'mujoco': mujoco.__version__, 'toi_s': hi, 'q_rad': q0 + sign * trapezoid(D, v, a, hi), 'geoms': list(geoms), 'ccd_tolerance': 1e-12, 'scan_s': 1e-4, 'bisection_s': 1e-13}, indent=1))
    return 0


if __name__ == '__main__':
    sys.exit(main())
