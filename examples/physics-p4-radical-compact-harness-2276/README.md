# Root execution

Author status: source only, no numerical execution. No M0/M1/M2/G0/U0/A10 rerun.

After final source snapshot and protocol review:

```sh
/opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13 -B examples/physics-p4-radical-compact-harness-2276/freeze.py --reviewed-protocol-sha ROOT_REVIEWED_SHA
```

Run the one fresh full bank and six audits under the existing owned outer guard:

```sh
/Users/user/.volta/tools/image/node/22.19.0/bin/node examples/physics-world-p5-2276/command-run.mjs p4-radical-full-b-01 . /opt/homebrew/Cellar/python@3.13/3.13.5/Frameworks/Python.framework/Versions/3.13/bin/python3.13 -B examples/physics-p4-radical-compact-harness-2276/run.py full-b-01 ROOT_REVIEWED_SHA
```

Keep fresh receipt IDs. Preserve first failure and all ended candidate results. Source hashes alone are not numerical, cost, complete-path, World, API,1200 or desktop PASS.
