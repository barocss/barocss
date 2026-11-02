# Build-free real warm-frame adapter

Ownership is split: High owns CONTRACT.md, reference.py and README.md. This task owns only the new runner, observer input adapter, build-free freeze and implementation/pin metadata. Existing producer, phase, B and production files are unchanged.

The independent generator runs before the first World. Its plain model.json and options.json are the ONLY physics inputs. The runner never computes or adjusts height, quaternion, native witness, cache or material values. reference.json must say INPUT_REFERENCE_READY and authenticate its generated input files. Diagnostic predictions and witness values are never passed to Physics.

Root commands through the existing heavy gate and 180-second wrapper:

```sh
python3 -B examples/physics-real-warm-frame-2276/reference.py model-01
node examples/physics-real-warm-frame-2276/freeze.mjs model-01 freeze-01
node examples/physics-real-warm-frame-2276/run.mjs freeze-01 warm-01
```

No build command exists. The freezer authenticates the immutable producer build-01 Source bundle, its qualified implementation/receipt, the qualified lossless encoder/independent decoder and every new adapter/input file. The runner imports neither numerical provider nor encoder until all frozen hashes are verified. It uses a fresh process, exactly one attempted World creation and at most three TOTAL step calls.

The observer copies the qualified unit-cube observer. Only the input assertion/import boundary changes: it independently reads/hash-checks the exact frozen plain model/options, then replaces the original cube initial-pose and floor-input assertions. The physical audit suffix is byte-identical to the qualified observer. Unit mass, cube inertia 1/6, passive material/gravity/dt assumptions, all geometry/depth/gap/wrench/momentum/work/projection/tangent gates and every tolerance remain unchanged.

A complete constructor and each actual one-step trace are saved before independent checks. Failure has priority over any warm counter. The runner stops immediately on the first independent NO_GO, even if a counter was incremented before that failing plane check. A successful early stop requires the complete interval observer PASS plus a genuine validated prior-cache hit with nonzero prior tangent, changed normal and native feature/point correspondence. No cache is injected. If none occurs after three accepted steps, the result is explicit COVERAGE_NO_GO; it is not a successful qualification.

The original module caps remain unchanged. The runner additionally enforces one World and three attempts. Evidence is lossless compact DAG JSON using the immutable qualified encoder/decoder; complete physical records are independently reconstructed with full-root/subtree integrity checks. The same 16 MiB stored-evidence limit and terminal reserve apply. Later step controls stay NOT_RUN after an early stop.

Raw recorder state/log snapshots prove accepted cursor ownership only. No recording wire serialization, deserialize, restore or replay is invoked or claimed by this adapter. Those rows remain NOT_RUN. No tuning, second input, widened tolerance, extra cap, new stage or producer repair is authorized after a failure.

Authoring status: syntax/pin review only. No independent input generation, World, B call, physical observer or build has been run in this task.
