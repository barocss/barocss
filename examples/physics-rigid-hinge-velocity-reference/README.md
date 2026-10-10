# Detached hinge pose and velocity reference — #1349

This private example consumes the exact adopted #1309 pose law once. It then applies the bounded velocity projection in CONTRACT.md. The original pose-only momentum NO-GO remains parent evidence.

The physical input stays the original two 1 kg spheres, radius .1 m, +Z hinge, local anchors ±.1 m, limits ±.8 rad and dt 1/120 s. The API returns detached copied bodies and diagnostics. It creates no PhysicsWorld and calls no motor or old dynamic hinge projection.

Each graph consumes the genuine orbital-loss input first, eight matching archived records next, and 22 literal cases last. If all pass, this is 31 outputs per graph and 93 total. Pure matrix guards, reference protocol controls and expected physical refusals have separate counts. First physical failure stops that graph; later graphs repeat the same prefix.

The external immutable #1279 archive checkout at `/Users/user/.codex/worktrees/physics-multi-hinge/barocss` is required. Parent compressed/decoded artifacts, historical source pins, exact raw frames and current original helper hashes are checked. This is not a producer replay.

Root must publish a complete source freeze and measured commit before build/types. Root must also publish the actual emitted ledger before the ONE consumer. The runner verifies the existing ledger and never recreates it. Use Node v22.22.0, own ignored dependencies/dist and the unchanged original build helper.

Root-only commands after the required freezes:

```sh
REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration node examples/physics-rigid-engine-reference/build-local.mjs
node node_modules/typescript/bin/tsc -p examples/physics-rigid-hinge-velocity-reference/tsconfig.json
node examples/physics-rigid-hinge-velocity-reference/runner.mjs /Users/user/.codex/worktrees/physics-multi-hinge/barocss /tmp/physics-1349-canonical
```

Source, distinct repeat and genuine compiled original helpers must agree in live values and raw Float64LE bytes. Identity cases retain velocity/spin signed-zero bits. Corrected cases report changed components. Exact Fraction expected certificates and independently measured rounded output certificates remain separate.

No physical result has been measured yet. Any GO applies only to this detached model on named inputs. World, motor, calibrated reactions, joint networks, long runs, Viewer, cost, public engine and release remain unqualified.
