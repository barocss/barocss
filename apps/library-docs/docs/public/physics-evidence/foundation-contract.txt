---
work_id: physics-motion-foundations-2276
artifact_type: execution-contract
status: ready_for_build
owner_role: independent-algorithm-work
source_request: independent Physics/Motion algorithms; issue 2276
last_updated: 2026-11-01
---

# Independent algorithm contract

This user request authorizes this isolated branch. It does not resume the old
Physics, Studio or manufacturing workers, change their HOLDs, or authorize
Integration adoption. No retired Motion package is restored.

Base: develop `12411c89b9a0f9de7e5066a5ea8f3d292c9476a8`.
Active CAD branch inspected: `8350c8e245ca2c35a71460c01e4be8772576661d`.
Their Physics and robot source trees have no difference. The active CAD checkout
has unrelated STEP and roadmap WIP; it is read only in this work.
Roadmap rows 10/18/19 and issues 2276, 1489, 1490, 1572 were read before code.
Issue snapshots are in evidence/preread. Issue bodies are historical evidence,
not an authorization to resume their workers or repeat archived campaigns.

Owned paths: this new example folder; new Physics pendulum module and its main
entry export; narrow robot motion validation repairs only if measured. Root,
lock, Studio, Viewer, manufacturing, old solver laws and old evidence are excluded.
Code and evidence stay local. No external service sends, installs, downloads,
new runtime dependency, security change, paid work, PR, push or release.
Existing local esbuild/TypeScript are reused. Internal package links resolve
only to this worktree. New tests are run with installed Node 22.19.0.

## Support profiles and frozen gates

| Profile | Units/frame/time | Independent reference and fixed gate |
| --- | --- | --- |
| Kinematics and authored playback | CAD mm; computation rad; saved deg; native XYZ, no silent up-axis change | Off-origin analytic matrix/FK, SI adapter <=1e-9 m; IK target residual and limits; trapezoid area and boundary samples. See kinematics-contract.md before its execution. |
| Public free sphere | SI; RH XYZ, configured gravity on -Y; dt 1/60, 1/120, 1/240; same physical 1 s | Exact ballistic position/velocity. Position error <=0.083 m at coarsest dt, halves with dt (ratio 1.99..2.01); velocity error <=1e-11 m/s. Record energy error separately; first-order integration is not exact dynamics. |
| Inertia/rotation and primitive impact | SI/RH/Y-up; dt 1/120, at most 120 steps per case | Homogeneous sphere/cuboid inertia and angular momentum; exact constant spin quaternion <=1e-11; 1D elastic unequal-mass momentum/energy residual <=1e-10. No nonspherical free-top or general contact accuracy claim. |
| Reduced planar rigid pendulum | SI, rad, seconds; fixed pivot, axis +Z, q=0 down -Y; no contact/motor | New separate API, not a PhysicsWorld hinge. Exact elliptic period from independent AGM and quadrature; 10 periods <=1% period/energy error; second-order dt refinement; 100 periods energy envelope <=1%. See pendulum-contract.md before execution. |
| Existing disjoint hinge / full 8-box stack | Original issue inputs and gates unchanged | Reproduce current public admission refusal. Historical step-77 ULP mismatch belongs to the absent 7178434 candidate; no claim to rerun it. Original 8-box NUMERICAL_NO_GO_WORLD remains. |
| Existing smaller persistent stack | Original-mini-stacks.ts, unchanged; 3 cases x 1200 steps at 1/120 s | Capture late-window drift/speed/tilt against original gates; producer contact depth is not independent SAT. This diagnostic can exit 0 while reporting physical NO_GO; report both. |

Tolerance choices precede execution. Determinism is tested separately from error.
Missing support is a refusal or NOT_RUN, never a zero force or successful solve.
Unreachable IK is judged by residual and limits, not a selected joint vector.
Kinematic playback, inverse-dynamics torque estimates, reduced ODE integration,
and contact dynamics have separate verdicts.

## Finite execution and repair policy

Run baseline first: public disjoint/8-box admission checks; unchanged mini-stack
diagnostic; existing friction-cache/velocity smoke consumers. No archived native
HINGE2 campaign is repeated. Capture commands, stdout, stderr, exits and input
hashes before interpretation. Baseline execution budget: 3600 mini-stack steps,
120 public-world smoke steps, bounded fixed-pose contact audits; one attempt per
consumer. No numerical parameter tuning follows a physical NO_GO.

Run scoped new tests through public source imports, then real emitted public
Physics entry with no source providers. Maximum two corrective rounds per new
test/module; preserve every failed attempt, explain the defect and source delta.
No changes to gates after observing a failure. Runtime admission bounds do not
assert an accuracy theorem over their entire domain; qualify only measured cases.
Run installed type checking and relevant old public rotation/hinge/contact
consumers. Full workspace, UI, deployment, equipment and manufacturing acceptance
are out of scope. Finish with source/input/tool/import-graph SHA256 and a per-stage
report. Further contact-law or coupled-system implementation depends on these
results and a separately frozen small model. A failing predecessor stays NO_GO.
