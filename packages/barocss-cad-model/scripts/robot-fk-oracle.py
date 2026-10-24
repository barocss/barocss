"""MuJoCo's forward kinematics of an exported MJCF model (RS1's sample robots, test/rs1-samples.test.ts): for each set
of joint values (by MJCF joint name; radians, or metres for a slide), every body's world position (m) and rotation
(row-major), after mj_kinematics. Equality constraints (a gear pair's) are not applied by kinematics, so the values
must give each follower its own value. Reads {"model": path, "poses": [{name: value}]} as JSON on stdin; writes
[{body: {"t": [x, y, z], "R": [9]}}] on stdout. Run outside the product; MuJoCo is never a dependency:

    ~/.cache/barocss-mujoco/bin/python -I packages/barocss-cad-model/scripts/robot-fk-oracle.py < request.json
"""
import json
import sys

import mujoco


def main():
    req = json.load(sys.stdin)
    model = mujoco.MjModel.from_xml_path(req["model"])
    data = mujoco.MjData(model)
    out = []
    for pose in req["poses"]:
        data.qpos[:] = model.qpos0
        for name, value in pose.items():
            j = mujoco.mj_name2id(model, mujoco.mjtObj.mjOBJ_JOINT, name)
            if j < 0:
                raise SystemExit(f"no joint {name}")
            data.qpos[model.jnt_qposadr[j]] = value
        mujoco.mj_kinematics(model, data)
        bodies = {}
        for b in range(model.nbody):
            name = mujoco.mj_id2name(model, mujoco.mjtObj.mjOBJ_BODY, b)
            if name:
                bodies[name] = {"t": [float(v) for v in data.xpos[b]], "R": [float(v) for v in data.xmat[b]]}
        out.append(bodies)
    json.dump(out, sys.stdout)


main()
