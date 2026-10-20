"""Test oracle for a closed loop in the MJCF export (RM8, O43/O45), run with MuJoCo 3.3.0 (O38's venv).
It loads the exported four-bar (its loop an <equality><connect>) and checks, against conformance/rm/four-bar/expect.json
(written by test/robot-loop.test.ts from our model):
  1. statically, at the solver's joint values (12 crank angles): the closure's violation (MuJoCo's equality rows,
     efc_pos) within 1e-9 m, and the rocker's angle — read from MuJoCo's own kinematics of the pins — equal to
     Freudenstein's closed form at the crank's angle, on the assembled branch, within 1e-9 rad;
  2. dynamically, a passive run from the assembled pose with gravity in the linkage's plane (the export's is along the
     pins, where nothing would move; set here, in the oracle only), contacts off, RK4: the closure held within 1e-4 m (a
     soft constraint, its solref set here to 2 dt, MuJoCo's stiffest for the step), the rocker on Freudenstein's branch at MuJoCo's crank angle within 1e-3 rad, the branch never left.
It exits 1 when any check fails. Run outside the product, by hand; MuJoCo is never a dependency. Commands:

    node apps/cad-studio/scripts/cad-cli.mjs mjcf packages/barocss-cad/conformance/rm/four-bar/robot.bcad -o /tmp/four-bar
    ~/.cache/barocss-mujoco/bin/python -I packages/barocss-cad/scripts/loop-oracle.py /tmp/four-bar/robot.xml \\
        packages/barocss-cad/conformance/rm/four-bar/expect.json > packages/barocss-cad/conformance/rm/four-bar/oracle.mujoco-3.3.0.json
"""
import json
import math
import sys

import mujoco
import numpy as np


def freudenstein(a, b, c, d, t2, branch):
    k1, k2, k3 = d / a, d / c, (a * a - b * b + c * c + d * d) / (2 * a * c)
    p, q, r = k1 - math.cos(t2), -math.sin(t2), k3 - k2 * math.cos(t2)
    h = math.hypot(p, q)
    if abs(r) > h:
        return None
    return math.atan2(q, p) + branch * math.acos(-r / h)


def wrap(x):
    return math.atan2(math.sin(x), math.cos(x))


def pin(model, data, p):
    b = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, p["body"])
    return data.xpos[b] + data.xmat[b].reshape(3, 3) @ np.array(p["local"])


def angles(model, data, e):
    gA, gD = e["ground"]["A"], e["ground"]["D"]
    B, C = pin(model, data, e["pins"]["crank"]), pin(model, data, e["pins"]["rocker"])
    t2 = math.atan2(B[1] - gA[1], B[0] - gA[0])
    t4 = math.atan2(C[1] - gD[1], C[0] - gD[0])
    # (The branch: the turn from the coupler's lever to the rocker's, at the pin.)
    lc, lr = C - B, C - np.array([gD[0], gD[1], C[2]])
    return t2, t4, 1 if lc[0] * lr[1] - lc[1] * lr[0] >= 0 else -1


def equality_violation(model, data):
    rows = [i for i in range(data.nefc) if data.efc_type[i] == mujoco.mjtConstraint.mjCNSTR_EQUALITY]
    return float(max((abs(data.efc_pos[i]) for i in rows), default=0.0)), len(rows)


def main(xml_path, expect_path):
    e = json.load(open(expect_path))
    dims = e["dims"]
    a, b, c, d = dims["a"], dims["b"], dims["c"], dims["d"]
    model = mujoco.MjModel.from_xml_path(xml_path)
    data = mujoco.MjData(model)
    ok = True
    srows, worst_m, worst_rad = [], 0.0, 0.0
    branch0 = None
    for s in e["static"]["samples"]:
        mujoco.mj_resetData(model, data)
        for name, v in s["values"].items():
            data.qpos[model.jnt_qposadr[mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, name)]] = v
        mujoco.mj_forward(model, data)
        viol, nrows = equality_violation(model, data)
        t2, t4, br = angles(model, data, e)
        want = freudenstein(a, b, c, d, t2, e["branch"])
        err = abs(wrap(t4 - want)) if want is not None else float("inf")
        branch0 = br if branch0 is None else branch0
        srows.append({"crank": t2, "rocker": t4, "freudenstein": want, "violation_m": viol, "rows": nrows, "angle_err": err, "branch": br})
        worst_m, worst_rad = max(worst_m, viol), max(worst_rad, err)
        if viol > e["static"]["tol_m"] or err > e["static"]["tol_rad"] or br != branch0:
            ok = False
    # (The dynamic run: gravity in the plane, contacts off, RK4, from the assembled pose.)
    dyn = e["dynamic"]
    mujoco.mj_resetData(model, data)
    model.opt.gravity[:] = dyn["gravity"]
    model.opt.timestep = dyn["timestep"]
    model.opt.integrator = mujoco.mjtIntegrator.mjINT_RK4
    model.opt.disableflags |= mujoco.mjtDisableBit.mjDSBL_CONTACT
    # (The closure held as stiff as MuJoCo allows at this step: time constant 2 dt, critically damped. Its default, 0.02 s,
    # is soft: under gravity alone it gives way about g tau^2, 4 mm, the first run. Set here, in the oracle only.)
    model.eq_solref[:, 0] = 2 * dyn["timestep"]
    model.eq_solref[:, 1] = 1.0
    mujoco.mj_forward(model, data)
    vmax, amax, kept, warnings = 0.0, 0.0, True, 0
    t2s = []
    steps = int(round(dyn["seconds"] / dyn["timestep"]))
    for _ in range(steps):
        mujoco.mj_step(model, data)
        mujoco.mj_forward(model, data)
        if not np.all(np.isfinite(data.qpos)):
            warnings += 1
            break
        viol, _ = equality_violation(model, data)
        t2, t4, br = angles(model, data, e)
        want = freudenstein(a, b, c, d, t2, e["branch"])
        err = abs(wrap(t4 - want)) if want is not None else float("inf")
        vmax, amax = max(vmax, viol), max(amax, err)
        kept = kept and br == branch0
        t2s.append(t2)
    warnings += int(sum(data.warning[i].number for i in range(len(data.warning))))
    span = float(max(t2s) - min(t2s)) if t2s else 0.0
    dyn_ok = vmax <= dyn["tol_m"] and amax <= dyn["tol_rad"] and kept and warnings == 0 and span > 0.1
    ok = ok and dyn_ok
    out = {
        "oracle": f"mujoco {mujoco.__version__}", "ok": ok,
        "static": {"rows": srows, "worst_violation_m": worst_m, "worst_angle_rad": worst_rad},
        "dynamic": {"seconds": dyn["seconds"], "timestep": dyn["timestep"], "violation_max_m": vmax, "angle_err_max_rad": amax, "branch_kept": kept, "crank_span_rad": span, "warnings": warnings, "ok": dyn_ok},
    }
    print(json.dumps(out, indent=1))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
