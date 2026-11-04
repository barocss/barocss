# Native position proof harness

AUTHORED_NOT_EXECUTED. Root reviews/seals/runs. Reuse the existing independent bank-01; do not rematerialize or rerun old candidates. V2 numerical PASS/cost NO_GO remains ended. No World/direct API/desktop/1200-step/public qualification follows.

After reviewing final source snapshot and PROTOCOL-01.json:

```
/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13 -B examples/physics-p4-native-witness-harness-2276/freeze.py --candidate-directory examples/physics-p4-native-witness-2276 --reference-directory examples/physics-p4-position-witness-reference-2276 --protocol examples/physics-p4-native-witness-harness-2276/PROTOCOL-01.json --reviewed-protocol-sha EXACT_REVIEWED_SHA256
```

Stage A, under the existing180s guard:

```
/Users/user/.volta/tools/image/node/22.19.0/bin/node examples/physics-world-p5-2276/command-run.mjs p4-native-witness-stage-a-01 . /opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13 -B examples/physics-p4-native-witness-harness-2276/run.py stage-a stage-a-01
```

Only after complete A_PASS, run B once:

```
/Users/user/.volta/tools/image/node/22.19.0/bin/node examples/physics-world-p5-2276/command-run.mjs p4-native-witness-stage-b-01 . /opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13 -B examples/physics-p4-native-witness-harness-2276/run.py stage-b stage-b-01 /Users/user/Documents/ChatGPT/barocss-physics-motion-2276/examples/physics-p4-native-witness-harness-2276/evidence/stage-a-01/summary.json
```

B owns one Python wrapper and one persistent pinned Node22 smallworker, with six actual proof calls. All six complete physical comparisons and unchanged independent checks precede one cost decision. The conservative CPU authority is parent context CPU sum plus owned Node entire-lifetime RUSAGE_CHILDREN delta after close+wait, including child startup/IO/shutdown. It is not the identical saved Python core boundary. Fixed gate695832300ns; no cost rerun or baseline remeasurement.

parentBridgeCpuNs is diagnostic parent RPC/start/JSON/shutdown CPU only. It is not child proof CPU. Node's authoritative entire lifetime CPU is a separate field. See CONTRACT.md and ALLOCATION.md for exact evidence/lifecycle/data limits. No author execution or seal.
