---
work_id: physics-p4-adapter-freeze-2276
artifact_type: nonnumeric-source-transform-equivalence
status: frozen_before_execution
last_updated: 2026-11-03
---

Authenticate the unchanged private P4 adapter and compare two explicitly authorized
source identities. This is a byte equivalence check. It provides no World, physics,
geometry, candidate, QP, rendering or campaign qualification. No old evidence is
retagged, no old source or pin is edited, and no numerical work is authorized.

Immutable baseline commit:7d0764c95bd74526c1ebaa16c36889182d6be29c.
Explicit-call transition commit:afea04be56ccf8dc46806b4fedbabae7f8846c74.
Target:examples/physics-rigid-full-pair-position-world/global-island.ts.
Adapter:examples/physics-stack-solver-2276/world-adapter.ts.

Frozen SHA-256 identities:

- Original target:670f5226576cb0a2c1963705b99704be71d4ebd3ad38c312adf9c16d43781d8d
- Current target:5175c05c2e85f57a873bf954324a02f9fbfdcc45f0aad3a00f59f02639314078
- Original/current adapter:43904b7f32f2ea3c5587c33c77048cd2002f1fa47797daf81e5fc42177e9bbdd

The verifier reads immutable sources with git show and current files as bytes. It
must authenticate these exact hashes, require the adapter to be byte-identical to
its immutable baseline, and require the transition commit target to match the live
target. There is no fallback to another commit, hash or unreviewed source.

The only permitted source edit is one insertion of the literal comma-space-zero
in the solvePersistentPoint call:point.pointM, patch.normal, impulse); becomes
point.pointM, patch.normal, impulse, 0);. Prove the full source equals that single
replacement and the edited call lies entirely inside the adapter's replaced region.
Require both outside prefixes and suffixes to be byte-identical.

Use the same replacement semantics for both source versions:the immutable adapter's
unique START/END anchors, its literal complete replacement solve method, and its
helper import constructed with JSON.stringify of the same absolute adapter path.
Extract these values as text only from the hash-authenticated adapter. Assert the
precise helper-import and source-splice statements remain present. Do not import,
compile, eval or execute the adapter, its imports or the transformed source. The
original transform's input-hash guard is retained unchanged. This separate verifier
authenticates the current source by its own reviewed exact hash; it does not claim
that the old transform function accepts the current source.

Both transformed outputs must be byte-identical. Save immutable/current source and
adapter snapshots, each replaced region, both transformed outputs, exact source diff,
old/new source/region/output hashes, byte counts, anchor counts, live checkout HEAD,
and the verifier/contract hashes in a fresh evidence directory. On first failure,
write FAIL with its phase and error; do not continue dependent checks. Output must
be confined to this new example. A PASS can authorize a separately reviewed future
adapter freeze; it does not itself alter or repair the old preflight.

Budget:zero Worlds, zero accepted steps, zero candidate/QP/geometry calls, zero
external module imports, zero builds. Git read calls only, <=1MiB each. Evidence
<=2MiB. No new dependencies. Existing root180s wrapper may enclose the command.

Command after contract review:

    node examples/physics-p4-adapter-freeze-2276/verify.mjs verify-01

Authoring does not execute this verifier. Original P4 HOLDs/NO_GO remain in force.
