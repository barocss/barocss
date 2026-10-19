"""Test oracle for the MJCF export (RM5, O18), PENDING: not yet run — installing MuJoCo needs the owner's go-ahead.
It loads an exported MJCF model with MuJoCo (Apache-2.0) and checks, against conformance/rm/<case>/expect.json
(written by test/robot-mjcf.test.ts from our model):
  1. per body: mass, centre of mass and principal inertia; body frames (xpos, xmat) at sampled joint values;
  2. the arm hanging under gravity, two runs from the pose the mates solve to, RK4, timestep 0.5 ms:
     - passive as exported (no damping): 5 s, total energy conserved to 1e-4 relative, nothing NaN or diverging;
     - with damping 0.002 N·m·s/rad on every joint set here, in the oracle only (the export invents none): 30 s,
       the energy never rising (1e-9 relative), the joints settling (every |qvel| < 1e-3 rad/s at the end), and the
       arm hanging (its centre of mass below where it started).
It exits 1 when any check fails. Run outside the product, by hand; MuJoCo is never a dependency. Commands (O18):

    uv venv ~/.cache/barocss-mujoco --python 3.12 && VIRTUAL_ENV=~/.cache/barocss-mujoco uv pip install mujoco==3.3.0
    node apps/cad-studio/scripts/cad-cli.mjs mjcf packages/barocss-cad/conformance/rm/arm-6r/robot.bcad -o /tmp/arm-6r
    ~/.cache/barocss-mujoco/bin/python -I packages/barocss-cad/scripts/mjcf-oracle.py /tmp/arm-6r/robot.xml \\
        packages/barocss-cad/conformance/rm/arm-6r/expect.json > packages/barocss-cad/conformance/rm/arm-6r/oracle.mujoco.json
"""
import json
import math
import sys

import mujoco
import numpy as np


def energy(model, data):
    mujoco.mj_energyPos(model, data)
    mujoco.mj_energyVel(model, data)
    return float(data.energy[0] + data.energy[1])


def com_height(model, data):
    m = model.body_mass[1:]
    return float((data.xipos[1:, 2] * m).sum() / m.sum())


def hang(model, seconds, damping):
    model.opt.timestep = 0.0005
    model.opt.integrator = mujoco.mjtIntegrator.mjINT_RK4
    model.opt.enableflags |= mujoco.mjtEnableBit.mjENBL_ENERGY
    model.dof_damping[:] = damping
    data = mujoco.MjData(model)
    mujoco.mj_forward(model, data)
    e0, h0, rising, worst = energy(model, data), com_height(model, data), 0.0, 0.0
    last = e0
    for _ in range(int(seconds / model.opt.timestep)):
        mujoco.mj_step(model, data)
        if not np.all(np.isfinite(data.qpos)) or not np.all(np.isfinite(data.qvel)):
            return {"ok": False, "why": "NaN or infinite state"}
        e = energy(model, data)
        rising = max(rising, (e - last) / max(abs(e0), 1e-12))
        worst = max(worst, abs(e - e0) / max(abs(e0), 1e-12))
        last = e
    return {"energy_start": e0, "energy_end": last, "energy_drift": worst, "energy_rise": rising, "qvel_max": float(np.abs(data.qvel).max()),
            "com_height_start": h0, "com_height_end": com_height(model, data), "warnings": int(sum(w.number for w in data.warning))}


def main(xml_path, expect_path):
    expect = json.load(open(expect_path, encoding="utf-8"))
    model = mujoco.MjModel.from_xml_path(xml_path)
    data = mujoco.MjData(model)
    tol, worst, rows, ok = expect.get("tol", 1e-6), 0.0, [], True

    def diff(what, got, want):
        nonlocal worst
        d = max(abs(g - w) for g, w in zip(got, want))
        worst = max(worst, d)
        rows.append({"what": what, "diff": d})

    for link in expect["links"]:
        b = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, link["name"])
        diff(f"{link['name']} mass", [float(model.body_mass[b])], [link["mass"]])
        diff(f"{link['name']} com", [float(x) for x in model.body_ipos[b]], link["com"])
        diff(f"{link['name']} principal", sorted(float(x) for x in model.body_inertia[b]), sorted(link["principal"]))
    for sample in expect["fk"]:
        data.qpos[:] = 0
        for name, q in sample["values"].items():
            data.qpos[model.jnt_qposadr[mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, name)]] = q
        mujoco.mj_kinematics(model, data)
        for link, pose in sample["links"].items():
            b = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, link)
            diff(f"{link} position", [float(x) for x in data.xpos[b]], pose["position"])
            diff(f"{link} rotation", [float(x) for x in data.xmat[b]], pose["rotation"])
    ok = worst <= tol
    out = {"oracle": f"mujoco {mujoco.__version__}", "worst": worst, "tol": tol, "rows": rows}
    if expect.get("hang"):
        passive = hang(mujoco.MjModel.from_xml_path(xml_path), 5.0, 0.0)
        damped = hang(mujoco.MjModel.from_xml_path(xml_path), 30.0, 0.002)
        out["hang"] = {"passive": passive, "damped": damped}
        ok = ok and passive.get("energy_drift", math.inf) < 1e-4 and passive.get("warnings", 1) == 0 \
            and damped.get("energy_rise", math.inf) < 1e-9 and damped.get("qvel_max", math.inf) < 1e-3 \
            and damped.get("com_height_end", math.inf) < damped.get("com_height_start", -math.inf) and damped.get("warnings", 1) == 0
    out["ok"] = ok
    print(json.dumps(out, indent=1))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
