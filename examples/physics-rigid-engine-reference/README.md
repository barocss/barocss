# Reusable rigid-world admission consumer — #1179

This is a short **public construction and one-step** consumer. It has no replacement solver and changes no package contract. Frozen admission inputs: [#1179 comment6094628657](https://github.com/barocss/barocss/issues/1179#issuecomment-6094628657).

Immutable actual base `9616f178fdf3fbc4d78d02a8e4c313fa5769e53f`; measured clean probe `e6e9acb93f6706a00e8db4a299250b53f394f337`. Node22.22.0. Source root uses normal package self-resolution (39src/0dist); explicit compiled public map root uses genuine build output (0src/2dist). Exact case inputs/error/state fields agree between both. Fixture JSON SHA256 `b20ce00017c16dedc7ef11e9a53f972e4539c49dd50af55819bacfbda9f602e7`.

| Consumer | Actual result |
| --- | --- |
| 16-box drop | Construction and one step pass |
| Existing offset two-box persistent control | Construction and one step pass |
| Eight-box aligned and rotated persistent stacks | INVALID_CONFIG: at most four bodies |
| Eight-box basic single-point stack | Construction and one step pass; stable stack quality unmeasured |
| Large mode with eight-box persistent contact | INVALID_CONFIG: large mode excludes joints and persistent contact |
| Existing single offset dynamic hinge control | Construction and one step pass |
| Two separated dynamic hinge pairs in one world | INVALID_CONFIG: one joint between two dynamic spheres |
| Fast capsule / thin static wall CCD | INVALID_CONFIG: CCD supports dynamic spheres or boxes only |

Every admitted case also checks finite copied output, exact cursor/time, caller input retention, bad-step accepted-state retention, double disposal and DISPOSED refusal. Refused creation checks canonical exported PhysicsError, INVALID_CONFIG and caller input retention. These results do not prove physical quality. Ten-second stack/joint/CCD/refinement, Viewer display/recovery and cost are **unrun**.

## Run

Use an existing installed checkout as the dependency runtime; no download or shared source edit:

```sh
export PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:$PATH
REPO_DEPS_ROOT=/Users/user/.barocss-ai/v3/integration node examples/physics-rigid-engine-reference/build-local.mjs
node examples/physics-rigid-engine-reference/run.mjs /tmp/physics-1179-admission
```

CAD and Physics use their original build commands. A new checkout needs ignored root node_modules links and a local CAD dependency lease: its **types** select actual emitted public CAD declarations, its runtime **import** remains the actual source export. This avoids pulling CAD source outside Physics tsc rootDir. No package/root/lock edits, hand-written declaration stub, runtime source alias or changed type-check rule. The lease is not a release artifact. First missing-workspace-link build failed with TS2307/implicit-any and is retained in evidence; actual CAD build and corrected Physics build exited0. The local helper documents that setup; the saved result was measured from e6e before this documentation/helper addition, not silently reattributed to a later SHA.

`fixtures.mjs` owns exact inputs. `admission-flow.mjs` owns short API checks. `run.mjs` owns graph audits and reports. The reports retain all original input/initial/accepted fields and exact refusal messages. No browser/server/resources are created. Pending native cloth/capsule previews remain running in their separate checkout. No publication is claimed.
