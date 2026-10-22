"""Test oracle for the URDF export (RM4, O17), PENDING: not yet run — installing MuJoCo needs the owner's go-ahead.
It loads an exported URDF with MuJoCo (Apache-2.0) and compares, per link, the mass, the centre of mass and the
principal inertia, and the link frames' positions and rotations at sampled joint values (forward kinematics, as
MuJoCo's xpos and xmat) against conformance/rm/<case>/expect.json, which test/robot-urdf.test.ts writes from our
model. Run outside the product, by hand; MuJoCo is never a dependency. The exact commands (O17):

    uv venv ~/.cache/barocss-mujoco --python 3.12 && VIRTUAL_ENV=~/.cache/barocss-mujoco uv pip install mujoco==3.3.0
    node apps/cad-studio/scripts/cad-cli.mjs urdf packages/barocss-cad/conformance/rm/urdf-2r/robot.bcad -o /tmp/urdf-2r
    ~/.cache/barocss-mujoco/bin/python -I packages/barocss-cad/scripts/urdf-oracle.py /tmp/urdf-2r/robot.urdf \\
        packages/barocss-cad/conformance/rm/urdf-2r/expect.json > packages/barocss-cad/conformance/rm/urdf-2r/oracle.mujoco.json

(and the same for urdf-gears). It exits 1 when any value differs by more than the case's tolerance (1e-6, RM4).
check_urdf (ROS urdfdom) is not on PyPI; where a ROS install is at hand: `check_urdf /tmp/urdf-2r/robot.urdf`.
"""
import json
import os
import re
import sys
import tempfile

import mujoco


def with_compiler(urdf_path):
    """A copy of the URDF that MuJoCo reads as written: every link a body (no fusing), meshes by their paths."""
    text = open(urdf_path, encoding="utf-8").read()
    ext = '<mujoco><compiler meshdir="." strippath="false" fusestatic="false" discardvisual="false" balanceinertia="false"/></mujoco>'
    text = re.sub(r"(<robot[^>]*>)", r"\1" + ext, text, count=1)
    fd, path = tempfile.mkstemp(suffix=".urdf", dir=os.path.dirname(os.path.abspath(urdf_path)))
    with os.fdopen(fd, "w", encoding="utf-8") as f:
        f.write(text)
    return path


def main(urdf_path, expect_path):
    expect = json.load(open(expect_path, encoding="utf-8"))
    path = with_compiler(urdf_path)
    try:
        model = mujoco.MjModel.from_xml_path(path)
    finally:
        os.unlink(path)
    data = mujoco.MjData(model)
    tol = expect.get("tol", 1e-6)
    worst, rows = 0.0, []

    def diff(what, got, want):
        nonlocal worst
        d = max(abs(g - w) for g, w in zip(got, want))
        worst = max(worst, d)
        rows.append({"what": what, "got": got, "want": want, "diff": d})

    for link in expect["links"]:
        b = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, link["name"])
        if b < 0:
            rows.append({"what": f"{link['name']}: no such body", "diff": float("inf")})
            worst = float("inf")
            continue
        diff(f"{link['name']} mass", [float(model.body_mass[b])], [link["mass"]])
        diff(f"{link['name']} com", [float(x) for x in model.body_ipos[b]], link["com"])
        diff(f"{link['name']} principal", sorted(float(x) for x in model.body_inertia[b]), sorted(link["principal"]))
    for sample in expect["fk"]:
        data.qpos[:] = 0
        for name, q in sample["values"].items():
            j = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, name)
            data.qpos[model.jnt_qposadr[j]] = q
        mujoco.mj_kinematics(model, data)
        for link, pose in sample["links"].items():
            b = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_BODY, link)
            diff(f"{link} at {sample['values']} position", [float(x) for x in data.xpos[b]], pose["position"])
            diff(f"{link} at {sample['values']} rotation", [float(x) for x in data.xmat[b]], pose["rotation"])
    print(json.dumps({"oracle": f"mujoco {mujoco.__version__}", "worst": worst, "tol": tol, "rows": rows}, indent=1))
    return 0 if worst <= tol else 1


if __name__ == "__main__":
    sys.exit(main(sys.argv[1], sys.argv[2]))
