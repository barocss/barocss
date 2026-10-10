"""Replay recorded Float64 fields through the independent observer, not the engine."""
import copy
import gzip
import hashlib
import importlib.util
import json
import math
from pathlib import Path
import struct
import sys

here = Path(__file__).resolve().parent
spec = importlib.util.spec_from_file_location("reference", here / "geometry-reference.py")
reference = importlib.util.module_from_spec(spec)
spec.loader.exec_module(reference)
directory = Path(sys.argv[1])
summary = json.loads((directory / "summary.json").read_text())
rows = []
fields = (("positionM", 3, 10000), ("velocityMps", 3, 1000),
          ("orientation", 4, None), ("angularVelocityRadps", 3, 1000))
for result in summary["results"]:
    stem = f'{result["graph"]}-{result["scene"]}'
    report = json.loads(gzip.decompress((directory / f"{stem}-report.json.gz").read_bytes()))
    raw = gzip.decompress((directory / f"{stem}-fields.f64le.gz").read_bytes())
    assert hashlib.sha256(raw).hexdigest() == report["rawSha256"] == result["rawSha256"]
    assert len(raw) == report["acceptedSnapshots"] * len(report["ids"]) * 13 * 8
    states = copy.deepcopy(report["states"])
    offset = 0
    contacts_checked = 0
    minimum_normal_center_dot = None
    negative_zero_count = 0
    baseline = None
    for index, state in enumerate(states):
        assert state["stepIndex"] == index
        assert state["timeSeconds"] == index / 120
        assert [body["id"] for body in state["bodies"]] == report["ids"]
        by_id = {body["id"]: body for body in state["bodies"]}
        for body_id in report["ids"]:
            body = by_id[body_id]
            for field, size, bound in fields:
                values = list(struct.unpack_from("<" + "d" * size, raw, offset))
                offset += size * 8
                assert values == body[field]  # JSON does not preserve signed zero.
                assert all(math.isfinite(value) for value in values)
                if bound is not None:
                    assert max(abs(value) for value in values) <= bound
                negative_zero_count += sum(value == 0 and math.copysign(1, value) < 0 for value in values)
                body[field] = values
            assert abs(math.hypot(*body["orientation"]) - 1) <= 1e-12
        for contact in state["contacts"]:
            a, b = by_id[contact["aId"]], by_id[contact["bId"]]
            assert a["id"] != b["id"]
            values = contact["normalAtoB"] + contact["pointM"] + contact["tangentImpulseNs"]
            values += [contact["penetrationM"], contact["impulseNs"]]
            assert all(math.isfinite(value) for value in values)
            assert abs(math.hypot(*contact["normalAtoB"]) - 1) <= 1e-9
            assert contact["penetrationM"] >= 0 and contact["impulseNs"] >= -1e-12
            center_dot = sum((y - x) * n for x, y, n in zip(a["positionM"], b["positionM"], contact["normalAtoB"]))
            minimum_normal_center_dot = center_dot if minimum_normal_center_dot is None else min(minimum_normal_center_dot, center_dot)
            contacts_checked += 1
        if index == 960:
            baseline = state
        observation = reference.evaluate({"state": state, "initial": states[0],
                                          "timeSeconds": state["timeSeconds"], "referenceAt8s": baseline})
        assert observation == report["observations"][index]
        if index < len(states) - 1:
            assert observation["ok"] and not observation["violations"]
    assert offset == len(raw)
    assert report["failure"]["kind"] == "independent-quality"
    assert report["failure"]["step"] == len(states) - 1
    assert report["failure"]["reference"] == report["observations"][-1]
    rows.append({"graph": result["graph"], "scene": result["scene"],
                 "rawSha256": report["rawSha256"], "snapshotsReplayed": len(states),
                 "contactsChecked": contacts_checked, "negativeZeroCount": negative_zero_count,
                 "minimumNormalCenterDotM": minimum_normal_center_dot})
assert summary["fullModelGO"] is False
assert all(not summary[key] for key in ("refinementExecuted", "costMeasured", "browserExecuted"))
print(json.dumps({"result": "PASS", "engineRerun": False, "rows": rows}, indent=2))
