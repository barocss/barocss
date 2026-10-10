# Private capsule face reference — Issue 1280

This example checks one selected negative X box face. The capsule has a 0.1 m radius and a 0.2 m centreline half length. Its orientation is fixed. The box is static. Box orientation must be identity or the literal Y yaw of 0.2 rad. Movement must follow the selected face normal. The entire capsule footprint must fit inside the face.

`createRigidCapsuleFaceReference(snapshot)` copies its inputs. `sweep()` returns the analytic face hit or null. `advanceHeadOnFaceStep()` validates the same movement and the supplied hit. It stops closing normal velocity with zero restitution, then advances the remaining time. It returns a detached record. A failed call does not change the snapshot or a previous result. Unknown reflection and harness errors propagate.

The private snapshot includes `selectedFace: 'negative-x'`. A query on the opposite side is unsupported. This is a PRIVATE example. It does not create or step a PhysicsWorld. Mass and material fields from the adopted original fixture remain recorded metadata. Angular response and contact friction are unmeasured.

The original `CAPSULE_THIN_CCD` fixture is read without changes. The original `parseBody` admission control retains its actual capsule CCD refusal. A detached geometry copy omits only `ccd` for original discrete `detect` checks. Those checks do not qualify continuous world collision detection.

The public upright capsule query stays at its own 0.15 m radius and 0.35 m half length. Its nominal direct-wall fraction is 0.2988. It refuses the private profile. The original fixture's private face fraction is 0.3588.

All gates and literal inputs are pinned before execution. `reference.py` uses independent Decimal80 and Decimal120 segment-to-box minimization by breakpoints and piecewise quadratics. Flat witness intervals do not require one unique centreline witness. The consumer runs source, source repeat, and genuine emitted original helper graphs. The private adapter remains source in all graphs. Raw Float64 bytes preserve signed zeros. The first failure is saved as NO-GO. No tuning follows in this contract.

Run from this checkout with Node 22.22.0:

```sh
export PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:$PATH
node examples/physics-rigid-capsule-ccd-reference/freeze.mjs
REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration node examples/physics-rigid-engine-reference/build-local.mjs
node node_modules/typescript/bin/tsc -p examples/physics-rigid-capsule-ccd-reference/tsconfig.json
node examples/physics-rigid-capsule-ccd-reference/runner.mjs
```

Before the first build or trial, post the source freeze hash to Issue 1280. The original build script creates only ignored dependency leases and dist output. Native evidence is saved in this example's `evidence/native/`. A GO covers only the declared selected face and remaining-time contract. Full world CCD, angular response, friction, product adoption, publication and release require separate evidence.
