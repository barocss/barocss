# Real warm-frame probe

The independent input source is ready for root execution. The author has not run or imported it. It contains no engine or candidate imports.

From the worktree root, root first runs:

```sh
python3 -B examples/physics-real-warm-frame-2276/reference.py model-01
```

This creates a fresh `evidence/model-01/`. `model.json` is a plain complete PhysicsModel; `options.json` contains the fixed profile, direct broad phase, and time step. `reference.json` authenticates both files and the qualified producer, records exact native support/rounding checks, and reports `INPUT_REFERENCE_READY` or `INPUT_REFERENCE_NO_GO`. Only model and options enter World. A failed reference does not authorize a retry with changed height or input.

The height uses correctly downward-rounded exact normalized-Hamilton support geometry of the stored input quaternion. This rule is frozen before the first World call. The script records the exact penetration and its rounding certificate. Actual admitted quaternion normalization is separate: the unchanged physical observer must use the admitted state, including its initial native geometry. A constructor MISS must remain visible.

The runner and observer adapter are owned separately. They must freeze the generated inputs and use the unchanged producer `evidence/build-01/source.mjs`, SHA-256 `b873bef27d0676183c0dcfcab5d89920c52b63fad325bfe186e1a0cde8620380`. This is build-free reuse, not a new provider build. The provider's actual Source-private PASS and its zero warm coverage remain distinct.

This case uses one fresh World and at most three step attempts. It stops on the first physical failure or verified actual warm-frame coverage. Matching point IDs are insufficient: coverage needs a real prior nonzero tangent cache and a changed normal. If none occurs, report `NOT_COVERED`. Existing gates, trace/resource limits, and the first-failure rule remain unchanged. No serde, restore, Native, public API, desktop, performance, or production-promotion claim follows.

See `CONTRACT.md` for the full fixed input and proof boundary. The old broad-floor case and all archived failures remain unchanged.
