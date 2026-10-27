"""Test oracle for O12's tool and sensor frames, read back by three external tools (run by hand, outside the product;
none is ever a dependency). test/robot-frames.test.ts (cad-model) writes the exported robot with its frames and
expect.json — sampled joint values and each frame's world pose there (metres; R row-major) from RM2's FK — into a
directory when O12_ORACLE_OUT names one; this reads them back:

  mujoco  MuJoCo 3.3.0 loads robot.xml; at each sample, mj_kinematics, each frame's site (site_xpos, site_xmat) against
          expect; the model's total mass against the robot's without frames (a frame adds none).
  usd     usd-core 26.8 opens robot.usda; each frame prim's world transform (UsdGeom.XformCache, the rest pose = the
          solved pose) against expect's first sample; UsdPhysics' parser finds the same bodies and joints as without frames.
  urdf    check_urdf (urdfdom) parses robot.urdf; its tree listing, with each frame a child of its link.

    ~/.cache/barocss-mujoco/bin/python -I packages/barocss-cad/scripts/frames-oracle.py mujoco DIR > packages/barocss-cad/conformance/rm/arm-6r/frames/oracle.mujoco-3.3.0.json
    ~/.cache/barocss-usd/bin/python -I packages/barocss-cad/scripts/frames-oracle.py usd DIR > packages/barocss-cad/conformance/rm/arm-6r/frames/oracle.usd-core-26.8.json
    python3 -I packages/barocss-cad/scripts/frames-oracle.py urdf DIR > packages/barocss-cad/conformance/rm/arm-6r/frames/oracle.check_urdf.json

Each prints JSON and exits 1 when a check fails.
"""
import json
import os
import subprocess
import sys


def gap(got, want):
    return max(abs(float(g) - float(w)) for g, w in zip(got, want))


def run_mujoco(d, expect):
    import mujoco
    model = mujoco.MjModel.from_xml_path(os.path.join(d, "robot.xml"))
    data = mujoco.MjData(model)
    worst, rows = 0.0, []
    for k, s in enumerate(expect["samples"]):
        data.qpos[:] = 0
        for name, q in s["q"].items():
            data.qpos[model.jnt_qposadr[mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, name)]] = q
        mujoco.mj_kinematics(model, data)
        for name, f in s["frames"].items():
            i = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_SITE, name)
            if i < 0:
                return {"ok": False, "why": f"no site {name}"}
            d_o, d_R = gap(data.site_xpos[i], f["o"]), gap(data.site_xmat[i], f["R"])
            worst = max(worst, d_o, d_R)
            rows.append({"sample": k, "frame": name, "o": d_o, "R": d_R})
    mass = float(model.body_mass.sum())
    mass_gap = abs(mass - expect["mass"]) / expect["mass"]
    ok = worst <= expect["tol"] and mass_gap <= 1e-12
    return {"oracle": f"mujoco {mujoco.__version__}", "ok": ok, "worst": worst, "mass": mass, "mass_gap": mass_gap, "sites": int(model.nsite), "rows": rows}


def run_usd(d, expect):
    from pxr import Usd, UsdGeom, UsdPhysics
    stage = Usd.Stage.Open(os.path.join(d, "robot.usda"))
    cache, worst, rows = UsdGeom.XformCache(), 0.0, []
    home = expect["samples"][0]["frames"]
    for name, f in home.items():
        prim = stage.GetPrimAtPath(f["usd_path"])
        if not prim.IsValid():
            return {"ok": False, "why": f"no prim {f['usd_path']}"}
        M = cache.GetLocalToWorldTransform(prim)
        # (USD's row vectors: row i is the i-th axis, the last row the origin; R here is row-major with columns the axes.)
        o = [M[3][0], M[3][1], M[3][2]]
        R = [M[c][r] for r in range(3) for c in range(3)]
        d_o, d_R = gap(o, f["o"]), gap(R, f["R"])
        worst = max(worst, d_o, d_R)
        rows.append({"frame": name, "path": f["usd_path"], "o": d_o, "R": d_R, "rigid_body": prim.HasAPI(UsdPhysics.RigidBodyAPI)})
    bodies = sum(1 for p in stage.Traverse() if p.HasAPI(UsdPhysics.RigidBodyAPI))
    joints = sum(1 for p in stage.Traverse() if p.IsA(UsdPhysics.Joint))
    ok = worst <= expect["tol"] and bodies == expect["bodies"] and joints == expect["joints"] and not any(r["rigid_body"] for r in rows)
    return {"oracle": f"usd-core {Usd.GetVersion()}", "ok": ok, "worst": worst, "bodies": bodies, "joints": joints, "rows": rows}


def run_urdf(d, expect):
    p = subprocess.run(["check_urdf", os.path.join(d, "robot.urdf")], capture_output=True, text=True)
    lines = [ln.rstrip() for ln in p.stdout.splitlines() if ln.strip()]
    # (The listing: "root Link: base has 1 child(ren)", then "    child(1):  l1" indented by depth.)
    listed = {name for name in expect["samples"][0]["frames"] if any(ln.strip().endswith(f":  {name}") for ln in lines)}
    ok = p.returncode == 0 and listed == set(expect["samples"][0]["frames"])
    return {"oracle": "check_urdf (urdfdom)", "ok": ok, "returncode": p.returncode, "listed": sorted(listed), "stdout": lines, "stderr": p.stderr.splitlines()}


def main():
    mode, d = sys.argv[1], sys.argv[2]
    expect = json.load(open(os.path.join(d, "expect.json"), encoding="utf-8"))
    out = {"mujoco": run_mujoco, "usd": run_usd, "urdf": run_urdf}[mode](d, expect)
    print(json.dumps(out, indent=1, sort_keys=True))
    sys.exit(0 if out["ok"] else 1)


if __name__ == "__main__":
    main()
