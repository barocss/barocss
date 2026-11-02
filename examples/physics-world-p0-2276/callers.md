---
work_id: physics-world-p0-2276
artifact_type: bounded-caller-inventory
status: ready_for_build
owner_role: independent-physics-algorithm-work
source_request: freeze direct migration scope without compatibility paths
last_updated: 2026-11-02
---

# Physics P0 caller and export inventory

Baseline: `66df02f8e7d5a3a7ab7b8ff7a0184bf34d978713`. Runtime changes are NOT_RUN.

Run `node examples/physics-world-p0-2276/inventory.mjs --check`. Each selected file has SHA-256 and one-based match lines in callers.json. Both new P0 artifact directories are excluded. Regenerate after intentional ROADMAP edits.

Current tracked working-tree text, all paths/extensions; case-insensitive physics token, named public factories and CAD adapter symbols; physics path files and reverse literal-relative-reference closure. Bounded lexical inventory, not runtime reachability proof.

1281 selected files; 5071 classified lines or immutable/support-file anchors. Zero unclassified records applies only to this lexical corpus. It is not proof of a complete reachable runtime graph. All 127/127 old seed paths remain selected.

## Classification counts

- live-first-party-caller-tooling-or-docs: 944 records.
- incidental-no-direct-call: 1268 records.
- immutable-evidence: 69 records.
- research-reference-needing-freeze-or-adapt: 2477 records.
- canonical-implementation-or-type: 313 records.

File classes, roles, slices and operations are aggregated from actual line records. Mixed files retain all values. The full file list is in callers.json. A pure mention has operation preserve. A reference provider has operation freeze-reference-provider. An executable reference harness has operation adapt-harness. Active direct callers have operation update. Shared CI/root/workspace metadata has operation verify-mapping-under-existing-owner.

## Excluded corpus

- immutable-evidence-directory: 7540 tracked files.
- emitted-artifact: 30 tracked files.
- binary: 2211 tracked files.

Exact excluded paths and counts are in callers.json. VitePress cache is an emitted artifact. Historical evidence remains immutable. Named historical ledgers, source freezes, recordings and selected-state files outside evidence directories have hashed immutable anchors. They are not current callsite counts. Long lines use a 600-character preview and a full-line hash.

## Migration rules

- No runtime API or caller is changed by this inventory.
- No arbitrary computed string, external consumer, ignored/untracked file, generated artifact body, runtime loader, or reflection completeness is claimed.
- Literal relative strings are conservative edges and can be data or comments. Syntax labels identify candidates, not AST execution proof.
- Historical evidence directories are excluded and immutable. Historical reports outside those directories are classified preserve.
- P1 root signature changes require replay and all root consumers to build in that same slice; P2 cannot defer a root/replay type mismatch.
- P2 recording/CAD and P5 cloth/fluid/CAD-fluid migrations retain their independent physical qualification limits.
- Capsule queries and controller references have separate roles. Reduced pendulum must move to a reference entry and cannot substitute for rigid hinge gates.
- HOLD, NO_GO, tolerances, original fixtures, first failures and historical receipts stay unchanged.

P1 keeps the root signature while it separates internals, or changes the root and every root consumer together. Replay is a real root consumer. P2 changes recording and CAD boundaries after that buildable step. P5 changes cloth, fluid and CAD-fluid factories and their active callers together. Preserve numerical fixtures and frozen reference providers. Adapt only affected harness signatures and imports. Verify shared build mappings; change them only under their existing owner.

## Public entries and fixed export operations

| Subpath | Workspace import | Published import | Assigned slice |
|---|---|---|---|
| . | ./src/index.ts | ./dist/index.js | P1 |
| ./cad-proxy | ./src/cad-proxy.ts | ./dist/cad-proxy.js | P2; root/replay build dependency in P1 |
| ./replay | ./src/replay.ts | ./dist/replay.js | P2; root/replay build dependency in P1 |
| ./fluid | ./src/fluid.ts | ./dist/fluid.js | P5 |
| ./cloth | ./src/cloth.ts | ./dist/cloth.js | P5 |
| ./fluid-cad | ./src/fluid-cad.ts | ./dist/fluid-cad.js | P5 |

- P1: move-reduced-pendulum-export-to-reference in `packages/barocss-physics/src/index.ts`. Capsule query/controller roles remain separate; preserve rigid signatures or migrate replay and every root caller together.
- P2: replace-old-recording-factory-exports-with-common-World-recording-contract in `packages/barocss-physics/src/replay.ts`, `packages/barocss-physics/src/replay-session.ts`. The current root/replay graph stays buildable in P1; no late P2 fix for a broken root signature.
- P5: remove-obsolete-domain-runtime-factory-exports in `packages/barocss-physics/src/fluid.ts`, `packages/barocss-physics/src/cloth.ts`, `packages/barocss-physics/src/fluid-cad.ts`. Introduce common-World model equivalents and update active callers in the same slice. Keep kernels and immutable fixtures.
- P1/P2/P5: update-owned-workspace-and-published-export-maps in `packages/barocss-physics/package.json`. No compatibility engine, publication or shared root metadata edit.

Root also exports the reduced planar pendulum, upright capsule query and upright capsule controller. Keep the two capsule roles explicit. Move the reduced ODE to a reference entry; it cannot qualify rigid hinge dynamics.

## Concrete direct caller candidates

These tables select code/HTML import, import-probe and named call candidates with a fixed update or adapt-harness operation. They omit pure prose, data and frozen providers. They remain lexical candidates; execution proof is separate. The JSON keeps exact candidate lines and complete file aggregates, including mixed root, replay and CAD dependencies.

### P1 reduced-pendulum reference migration

3 files; 20 lexical import/call candidates.

| File | Lines | Fixed operation |
|---|---|---|
| apps/library-docs/samples/physics-docs.test.mjs | 4, 137 | update |
| examples/physics-motion-foundations-2276/pendulum.test.ts | 3, 4, 107, 137, 176, 210, 217, 231, 232, 240, 247, 262, 290, 303, 310 | update |
| examples/physics-motion-foundations-2276/public-consumer.ts | 2, 3, 8 | update |

### P1 root

203 files; 744 lexical import/call candidates.

| File | Lines | Fixed operation |
|---|---|---|
| apps/library-docs/samples/physics-docs.test.mjs | 4, 29, 49, 69, 159 | update |
| examples/physics-cad-scene/cad-proxy-probe.mjs | 3, 24 | update |
| examples/physics-cad-scene/model.js | 1, 29 | update |
| examples/physics-capsule-query-scene/controls.mjs | 1 | update |
| examples/physics-capsule-query-scene/public-snapshot.mjs | 1 | update |
| examples/physics-capsule-query-scene/source-contract.ts | 1, 2 | update |
| examples/physics-character-controller-reference/controller.mjs | 1 | adapt-harness |
| examples/physics-character-lookahead-reference/controller.mjs | 1 | adapt-harness |
| examples/physics-character-public-reference/campaign.mjs | 1, 2 | adapt-harness |
| examples/physics-character-public-reference/controls.mjs | 1, 2 | adapt-harness |
| examples/physics-character-public-reference/internal-controls.mjs | 2 | adapt-harness |
| examples/physics-character-public-reference/source-contract.ts | 1, 2 | adapt-harness |
| examples/physics-character-reference/entry.mjs | 4, 32, 38, 41, 43 | adapt-harness |
| examples/physics-character-reference/scene.mjs | 1, 6 | adapt-harness |
| examples/physics-character-viewer/host-controller.mjs | 1 | update |
| examples/physics-character-viewer/numeric-entry.mjs | 1 | update |
| examples/physics-contact-boundary-2276/geometry.test.ts | 3, 4 | adapt-harness |
| examples/physics-contact-boundary-2276/world-consumer.mjs | 28 | adapt-harness |
| examples/physics-contact-boundary-2276/world-entry.ts | 1, 2 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/asymmetric-contact-diagnostic.ts | 4, 5, 33 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/cache-counterfactual.ts | 6, 7, 30 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/clip-stage-audit.ts | 5, 6, 36 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/contact-energy-ledger.ts | 6, 7, 80 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/correction-ledger.ts | 1, 2, 19 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/entry.ts | 6, 7 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/face-choice-audit.ts | 2, 3, 23 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/face-plane-witness.ts | 5, 6, 45 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/fallback-angular-ledger.ts | 4, 5, 39 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/fallback-impulse-ledger.ts | 2, 3, 42 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/fallback-inclusive-impulse.ts | 5, 6, 55 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/fallback-torque-reference.ts | 5, 6, 59 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/fresh-contact.ts | 4, 5, 6, 7, 8 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/friction-release.ts | 5, 6 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/gap-after-correction.ts | 4, 5, 25 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/gravity-velocity.ts | 2, 3 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/horizontal-motion-ledger.ts | 7, 8, 43 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/independent-axis-selection.ts | 5, 6, 57 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/independent-projection.ts | 5, 6, 48 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/manifold-fallback-cause.ts | 6, 7, 46 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/manifold-identity.ts | 5, 6, 7, 8, 9, 21 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/original-mini-stacks.ts | 6, 7, 31 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/pair-order-counterfactual.ts | 7, 8, 40 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/pair-response-ledger.ts | 5, 6, 58 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/pass-count-convergence.ts | 7, 8, 43 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/point-momentum-reference.ts | 11, 12, 115 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/pose-drift.ts | 4, 5, 6 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/post-correction-redetect.ts | 2, 3, 16 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/private-cache-entry.ts | 6, 7, 98 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/public-two-box-resting-10s.ts | 4, 5, 19 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/public-world-smoke.ts | 4, 5, 15 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/sat-separation-witness.ts | 4, 5, 42 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/static-support-reference.ts | 14, 15, 154 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/support-centroid.ts | 5, 6, 38 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/total-energy-phase-ledger.ts | 7, 8, 64 | adapt-harness |
| examples/physics-contact-impulse-audit-1572/total-mechanical-energy.ts | 8, 9, 37 | adapt-harness |
| examples/physics-error-entry/entry.mjs | 2, 43, 53 | update |
| examples/physics-motion-foundations-2276/baseline.test.ts | 3, 4, 17, 25 | update |
| examples/physics-motion-foundations-2276/contact.test.ts | 3, 4, 62, 103 | update |
| examples/physics-motion-foundations-2276/pendulum.test.ts | 3, 4 | update |
| examples/physics-motion-foundations-2276/public-consumer.ts | 2, 3, 13 | update |
| examples/physics-motion-foundations-2276/units.test.ts | 3 | update |
| examples/physics-motion-foundations-2276/world.test.ts | 3, 4, 15, 37, 54 | update |
| examples/physics-public-disjoint-hinge-reference/phase-entry.ts | 1, 2, 3, 4, 5 | adapt-harness |
| examples/physics-rigid-cache-reference/entry.mjs | 1, 2, 3 | adapt-harness |
| examples/physics-rigid-cache-reference/position-relaxation.ts | 1, 2, 3, 4, 5 | adapt-harness |
| examples/physics-rigid-cache-reference/reference-world.ts | 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 45 | adapt-harness |
| examples/physics-rigid-cache-reference/warm-cache.ts | 1, 2 | adapt-harness |
| examples/physics-rigid-capsule-ccd-reference/admission.ts | 1, 2 | adapt-harness |
| examples/physics-rigid-capsule-ccd-reference/entry.ts | 1, 10, 11 | adapt-harness |
| examples/physics-rigid-capsule-ccd-reference/face-sweep.ts | 1, 2, 3, 4 | adapt-harness |
| examples/physics-rigid-capsule-ccd-reference/profile.ts | 1 | adapt-harness |
| examples/physics-rigid-capsule-ccd-reference/response.ts | 1, 2, 7 | adapt-harness |
| examples/physics-rigid-capsule-face-world-reference/candidate-ccd.ts | 1, 2, 3 | adapt-harness |
| examples/physics-rigid-capsule-face-world-reference/candidate-diagnostics.ts | 1, 2 | adapt-harness |
| examples/physics-rigid-capsule-face-world-reference/candidate-profile.ts | 1, 2, 13 | adapt-harness |
| examples/physics-rigid-capsule-face-world-reference/candidate-validation.ts | 2, 3, 4 | adapt-harness |
| examples/physics-rigid-capsule-face-world-reference/candidate-world.ts | 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 16, 17, 18, 19, 20 | adapt-harness |
| examples/physics-rigid-capsule-face-world-reference/entry.ts | 7, 8, 9, 10 | adapt-harness |
| examples/physics-rigid-contact-diagnostic/entry.mjs | 1, 3 | adapt-harness |
| examples/physics-rigid-contact-diagnostic/instrumented-world.ts | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 45 | adapt-harness |
| examples/physics-rigid-contact-diagnostic/trace.ts | 1 | adapt-harness |
| examples/physics-rigid-contact-reference/bundle.mjs | 14 | adapt-harness |
| examples/physics-rigid-contact-reference/consumer-entry.mjs | 1, 2, 3 | adapt-harness |
| examples/physics-rigid-contact-reference/reference-world.ts | 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 43 | adapt-harness |
| examples/physics-rigid-coupled-hinge-reference/admission.ts | 1, 2, 3, 4, 5 | adapt-harness |
| examples/physics-rigid-coupled-hinge-reference/candidate.ts | 1, 2, 3, 4 | adapt-harness |
| examples/physics-rigid-coupled-hinge-reference/entry.ts | 3 | adapt-harness |
| examples/physics-rigid-coupled-hinge-reference/profile.ts | 1, 2 | adapt-harness |
| examples/physics-rigid-coupled-position-world/coupled-phase.ts | 1, 2 | update |
| examples/physics-rigid-coupled-position-world/entry.mjs | 1, 2, 3, 4 | update |
| examples/physics-rigid-coupled-position-world/global-island.ts | 1, 2, 3, 4, 5, 6 | update |
| examples/physics-rigid-coupled-position-world/phase-types.ts | 1 | update |
| examples/physics-rigid-coupled-position-world/reference-world.ts | 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 47 | adapt-harness |
| examples/physics-rigid-coupled-position-world/rows.ts | 1, 2 | update |
| examples/physics-rigid-engine-reference/admission-flow.mjs | 11 | adapt-harness |
| examples/physics-rigid-feature-contact-reference/entry.mjs | 1, 2, 3 | adapt-harness |
| examples/physics-rigid-feature-contact-reference/geometry-adapter.ts | 1, 2, 3 | adapt-harness |
| examples/physics-rigid-feature-contact-reference/global-island.ts | 1, 2, 3, 4, 5, 6 | adapt-harness |
| examples/physics-rigid-feature-contact-reference/position-relaxation.ts | 1, 2, 3, 4, 5 | adapt-harness |
| examples/physics-rigid-feature-contact-reference/reference-world.ts | 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 46 | adapt-harness |
| examples/physics-rigid-feature-contact-reference/warm-cache.ts | 1 | adapt-harness |
| examples/physics-rigid-feature-geometry/contact-types.ts | 1 | update |
| examples/physics-rigid-feature-geometry/edge-contact.ts | 1, 2, 3 | update |
| examples/physics-rigid-feature-geometry/entry.ts | 1, 2, 3, 8 | update |
| examples/physics-rigid-feature-geometry/face-contact.ts | 1, 2, 3 | update |
| examples/physics-rigid-feature-geometry/geometry.ts | 1, 2, 3, 8 | update |
| examples/physics-rigid-feature-geometry/sat-feature.ts | 2, 3, 4 | update |
| examples/physics-rigid-feature-geometry/strict-line.ts | 2 | update |
| examples/physics-rigid-feature-geometry/witness.ts | 1, 2, 3 | update |
| examples/physics-rigid-feature-penetration-diagnostic/entry.ts | 1, 2, 4, 5 | adapt-harness |
| examples/physics-rigid-full-pair-position-world/entry.mjs | 1, 2, 3, 4 | update |
| examples/physics-rigid-full-pair-position-world/full-pair-apply.ts | 1, 2, 3 | update |
| examples/physics-rigid-full-pair-position-world/full-pair-phase.ts | 1, 2 | update |
| examples/physics-rigid-full-pair-position-world/full-pair-rows.ts | 1, 2, 3 | update |
| examples/physics-rigid-full-pair-position-world/full-pair-types.ts | 1 | update |
| examples/physics-rigid-full-pair-position-world/global-island.ts | 1, 2, 3, 4, 5, 6 | update |
| examples/physics-rigid-full-pair-position-world/reference-world.ts | 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 48 | adapt-harness |
| examples/physics-rigid-full-pair-position-world/world-types.ts | 1, 2, 3 | update |
| examples/physics-rigid-global-contact-reference/entry.mjs | 1, 2, 3 | adapt-harness |
| examples/physics-rigid-global-contact-reference/global-island.ts | 3, 4, 5, 6, 7, 8, 9 | adapt-harness |
| examples/physics-rigid-global-contact-reference/position-relaxation.ts | 1, 2, 3, 4, 5 | adapt-harness |
| examples/physics-rigid-global-contact-reference/reference-world.ts | 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 46 | adapt-harness |
| examples/physics-rigid-global-contact-reference/warm-cache.ts | 1, 2 | adapt-harness |
| examples/physics-rigid-hinge-limit-diagnostic/adapter.ts | 1, 2, 3, 4, 5 | adapt-harness |
| examples/physics-rigid-hinge-motor-reference/candidate.ts | 1, 2, 3, 4 | adapt-harness |
| examples/physics-rigid-hinge-motor-reference/copy.ts | 1, 2 | adapt-harness |
| examples/physics-rigid-hinge-motor-reference/diagnostics.ts | 1, 2 | adapt-harness |
| examples/physics-rigid-hinge-motor-reference/entry.ts | 3 | adapt-harness |
| examples/physics-rigid-hinge-motor-reference/errors.ts | 1 | adapt-harness |
| examples/physics-rigid-hinge-motor-reference/harness-entry.mjs | 4, 5, 6 | adapt-harness |
| examples/physics-rigid-hinge-motor-reference/motor-stages.ts | 1, 2, 3, 4, 5 | adapt-harness |
| examples/physics-rigid-hinge-motor-reference/options.ts | 1 | adapt-harness |
| examples/physics-rigid-hinge-motor-reference/report.ts | 1, 2 | adapt-harness |
| examples/physics-rigid-hinge-motor-reference/types.ts | 1 | adapt-harness |
| examples/physics-rigid-hinge-velocity-reference/candidate.ts | 1, 2, 3, 4 | adapt-harness |
| examples/physics-rigid-hinge-velocity-reference/diagnostics.ts | 1, 2 | adapt-harness |
| examples/physics-rigid-hinge-velocity-reference/entry.ts | 4 | adapt-harness |
| examples/physics-rigid-hinge-velocity-reference/profile.ts | 1, 2, 3 | adapt-harness |
| examples/physics-rigid-hinge-velocity-reference/rows.ts | 1, 2 | adapt-harness |
| examples/physics-rigid-hinge-velocity-world-reference/candidate.ts | 2 | adapt-harness |
| examples/physics-rigid-hinge-velocity-world-reference/copy.ts | 1 | adapt-harness |
| examples/physics-rigid-hinge-velocity-world-reference/diagnostics.ts | 1 | adapt-harness |
| examples/physics-rigid-hinge-velocity-world-reference/errors.ts | 1 | adapt-harness |
| examples/physics-rigid-hinge-velocity-world-reference/harness-entry.mjs | 2 | adapt-harness |
| examples/physics-rigid-hinge-velocity-world-reference/postcontact-pair.ts | 1, 2 | adapt-harness |
| examples/physics-rigid-hinge-velocity-world-reference/profile.ts | 1, 2, 3, 4, 5, 6 | adapt-harness |
| examples/physics-rigid-hinge-velocity-world-reference/stages.ts | 1, 2, 3, 4, 5, 6 | adapt-harness |
| examples/physics-rigid-hinge-velocity-world-reference/types.ts | 2, 3, 4 | adapt-harness |
| examples/physics-rigid-hinge-velocity-world-reference/world-query.ts | 1, 2, 3 | adapt-harness |
| examples/physics-rigid-hinge-velocity-world-reference/world-store.ts | 1, 2, 3 | adapt-harness |
| examples/physics-rigid-hinge-velocity-world-reference/world.ts | 1, 2, 3, 4, 5 | adapt-harness |
| examples/physics-rigid-manifold-refusal/entry.ts | 1, 2, 3, 4, 6 | update |
| examples/physics-rigid-manifold-refusal/inspect-manifold.ts | 2, 3 | update |
| examples/physics-rigid-position-reference/entry.mjs | 1, 2, 3 | adapt-harness |
| examples/physics-rigid-position-reference/position-relaxation.ts | 1, 2, 3, 4, 5 | adapt-harness |
| examples/physics-rigid-position-reference/reference-world.ts | 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 44 | adapt-harness |
| examples/physics-rigid-signed-closure-world/apply.ts | 1, 2, 3 | update |
| examples/physics-rigid-signed-closure-world/closure-types.ts | 1 | update |
| examples/physics-rigid-signed-closure-world/entry.mjs | 1, 2, 3, 4 | update |
| examples/physics-rigid-signed-closure-world/global-island.ts | 1, 2, 3, 4, 5, 6 | update |
| examples/physics-rigid-signed-closure-world/live-phase.ts | 1, 2 | update |
| examples/physics-rigid-signed-closure-world/reference-world.ts | 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 48 | adapt-harness |
| examples/physics-rigid-signed-closure-world/rows.ts | 1, 2, 3 | update |
| examples/physics-rigid-signed-closure-world/world-types.ts | 1, 2, 3 | update |
| examples/physics-rigid-signed-separation-reference/apply.mjs | 1, 2 | adapt-harness |
| examples/physics-rigid-signed-separation-reference/signed-sat.ts | 2, 3, 4, 5 | adapt-harness |
| examples/physics-rigid-velocity-diagnostic/entry.mjs | 1, 3, 4 | adapt-harness |
| examples/physics-rigid-velocity-diagnostic/instrumented-world.ts | 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 45 | adapt-harness |
| examples/physics-rigid-velocity-diagnostic/position-relaxation.ts | 1, 2, 3, 4, 5 | adapt-harness |
| examples/physics-rigid-velocity-diagnostic/trace.ts | 1 | adapt-harness |
| examples/physics-scene/app.js | 1, 4 | update |
| examples/physics-scene/box-point-probe.mjs | 2, 12 | update |
| examples/physics-scene/broadphase-probe.mjs | 3, 23, 24, 36, 92, 93, 94, 96 | update |
| examples/physics-scene/ccd-pair-probe.mjs | 2, 15, 22, 40, 52, 58, 71 | update |
| examples/physics-scene/ccd-probe.mjs | 2, 14 | update |
| examples/physics-scene/controls-probe.mjs | 2, 13, 34 | update |
| examples/physics-scene/dynamic-fixed-pair-probe.mjs | 2, 14, 16, 19, 23 | update |
| examples/physics-scene/dynamic-hinge-motor-probe.mjs | 2, 13 | update |
| examples/physics-scene/events-queries-probe.mjs | 2, 7, 45 | update |
| examples/physics-scene/friction-stack-probe.mjs | 2, 14 | update |
| examples/physics-scene/hinge-motor-probe.mjs | 2, 15 | update |
| examples/physics-scene/joints-probe.mjs | 2, 13 | update |
| examples/physics-scene/large-scene-probe.mjs | 4, 29, 54, 100, 104, 108, 115, 125, 142 | update |
| examples/physics-scene/offset-hinge-probe.mjs | 3, 14 | update |
| examples/physics-scene/oriented-colliders-probe.mjs | 2, 10 | update |
| examples/physics-scene/persistent-box-probe.mjs | 4, 24, 70, 73, 74, 96 | update |
| examples/physics-scene/probe.mjs | 2, 10, 70 | update |
| examples/physics-scene/release-consumer.mjs | 3, 18 | update |
| examples/physics-scene/replay-probe.mjs | 2 | update |
| examples/physics-scene/rigid-pairs-probe.mjs | 2, 20 | update |
| examples/physics-scene/rotation-probe.mjs | 2, 13 | update |
| examples/physics-scene/source-import-probe.mjs | 9 | update |
| examples/physics-scene/thin-box-ccd-probe.mjs | 3, 20, 69, 75, 82, 95 | update |
| examples/physics-stack-solver-2276/trajectory-entry.ts | 1, 2 | adapt-harness |
| examples/physics-stack-solver-2276/trajectory-run.mjs | 124 | adapt-harness |
| examples/physics-stack-solver-2276/world-adapter.ts | 3, 4, 5 | adapt-harness |
| examples/physics-viewer-scene/app.js | 1, 30 | update |
| examples/physics-viewer-scene/dynamic-hinge-demo.js | 1, 26 | update |
| examples/physics-viewer-scene/joint-demo.js | 1, 27 | update |
| examples/physics-viewer-scene/motor-demo.js | 1, 26 | update |
| examples/physics-viewer-scene/offset-hinge-demo.js | 1, 27 | update |
| examples/workspace-source/flow.mjs | 5 | update |
| packages/barocss-physics/src/replay-session.ts | 1, 20 | update |

### P2 CAD-proxy

7 files; 42 lexical import/call candidates.

| File | Lines | Fixed operation |
|---|---|---|
| apps/library-docs/samples/physics-docs.test.mjs | 5, 105, 116, 129, 132 | update |
| examples/physics-cad-scene/cad-proxy-probe.mjs | 4, 8, 10, 29, 31, 43, 50, 51, 52, 53, 54, 56, 58, 60 | update |
| examples/physics-cad-scene/model.js | 2, 23, 26, 33, 38 | update |
| examples/physics-motion-foundations-2276/units.test.ts | 4, 35, 46, 50, 64, 68, 91, 94, 96, 102 | update |
| examples/physics-scene/release-consumer.mjs | 4, 10, 13, 20 | update |
| examples/physics-scene/source-import-probe.mjs | 10 | update |
| examples/physics-scene/thin-box-ccd-probe.mjs | 4, 9, 12 | update |

### P1 capsule query/controller roles

16 files; 55 lexical import/call candidates.

| File | Lines | Fixed operation |
|---|---|---|
| examples/physics-capsule-query-scene/compiled-contract.ts | 2, 3, 7 | update |
| examples/physics-capsule-query-scene/controls.mjs | 1, 18, 32, 54, 57, 61, 62, 65, 67, 71 | update |
| examples/physics-capsule-query-scene/public-snapshot.mjs | 1, 4 | update |
| examples/physics-capsule-query-scene/source-contract.ts | 1, 2, 6 | update |
| examples/physics-character-controller-reference/controller.mjs | 1, 25 | adapt-harness |
| examples/physics-character-lookahead-reference/controller.mjs | 1, 25 | adapt-harness |
| examples/physics-character-public-reference/campaign.mjs | 1, 15, 24, 25 | adapt-harness |
| examples/physics-character-public-reference/compiled-contract.ts | 1, 2, 4, 8 | adapt-harness |
| examples/physics-character-public-reference/controls.mjs | 1, 7, 13, 22, 23, 24, 25, 26, 27, 28, 29 | adapt-harness |
| examples/physics-character-public-reference/source-contract.ts | 1, 2, 4, 8 | adapt-harness |
| examples/physics-character-viewer/host-controller.mjs | 1, 5 | update |
| examples/physics-character-viewer/numeric-entry.mjs | 1, 8 | update |
| examples/physics-rigid-capsule-ccd-reference/controls.mjs | 71, 72 | adapt-harness |
| examples/physics-rigid-capsule-ccd-reference/entry.ts | 9 | adapt-harness |
| examples/physics-rigid-capsule-face-world-reference/controls.mjs | 46, 47 | adapt-harness |
| examples/physics-rigid-capsule-face-world-reference/entry.ts | 11 | adapt-harness |

### P5 cloth

12 files; 31 lexical import/call candidates.

| File | Lines | Fixed operation |
|---|---|---|
| examples/physics-capsule-query-scene/controls.mjs | 2 | update |
| examples/physics-cloth-viewer/host-controller.mjs | 1, 11 | update |
| examples/physics-cloth-viewer/numeric-entry.mjs | 1, 4 | update |
| examples/physics-error-entry/entry.mjs | 3, 33, 55 | update |
| examples/physics-scene/cloth-source-import-probe.mjs | 13, 30, 31 | update |
| examples/physics-scene/cloth-world-probe.mjs | 7, 8, 9, 67, 70, 77, 130, 141, 163, 191, 201 | update |
| examples/viewer-assembly-scene/app.js | 5, 307 | update |
| examples/viewer-cloth-scene/app.js | 3, 34 | update |
| examples/viewer-native-scene-replacement/app.js | 9 | update |
| examples/viewer-qualified-face-scene/app.js | 34 | update |
| examples/viewer-shell-scene/app.js | 5 | update |
| examples/workspace-source/flow.mjs | 9, 48 | update |

### P5 fluid

11 files; 27 lexical import/call candidates.

| File | Lines | Fixed operation |
|---|---|---|
| examples/physics-capsule-query-scene/controls.mjs | 3 | update |
| examples/physics-error-entry/entry.mjs | 4, 57 | update |
| examples/physics-scene/fluid-cad-shelf-probe.mjs | 6, 43 | update |
| examples/physics-scene/fluid-viewer/scene.js | 1, 26 | update |
| examples/physics-scene/fluid-visual-profile-probe.mjs | 4, 41, 47, 49, 85 | update |
| examples/physics-scene/fluid-world-probe.mjs | 4, 30, 55, 58, 90, 97 | update |
| examples/physics-scene/release-consumer.mjs | 6, 50 | update |
| examples/physics-scene/source-import-probe.mjs | 12 | update |
| examples/viewer-cloth-scene/app.js | 4, 184 | update |
| examples/viewer-fluid-scene/app.js | 3, 34 | update |
| examples/viewer-surface-material/app.js | 3, 134 | update |

### P5 CAD-fluid

5 files; 13 lexical import/call candidates.

| File | Lines | Fixed operation |
|---|---|---|
| examples/physics-capsule-query-scene/controls.mjs | 4 | update |
| examples/physics-error-entry/entry.mjs | 5, 59 | update |
| examples/physics-scene/fluid-cad-shelf-probe.mjs | 5, 42, 53, 54, 55, 58, 98 | update |
| examples/physics-scene/fluid-cad-viewer/app.js | 3, 70 | update |
| examples/physics-scene/source-import-probe.mjs | 13 | update |

### P2 replay (P1 build dependency)

6 files; 39 lexical import/call candidates.

| File | Lines | Fixed operation |
|---|---|---|
| examples/physics-scene/dynamic-fixed-pair-probe.mjs | 4, 61, 62, 66, 68, 69 | update |
| examples/physics-scene/persistent-box-probe.mjs | 6, 87, 88, 91 | update |
| examples/physics-scene/release-consumer.mjs | 5, 30, 31, 34, 37, 38 | update |
| examples/physics-scene/replay-probe.mjs | 3, 12, 13, 38, 50, 51, 52, 53, 54, 57, 60, 63, 64, 68, 74, 77, 82, 85 | update |
| examples/physics-scene/source-import-probe.mjs | 11 | update |
| packages/barocss-physics/src/replay-session.ts | 3, 4, 56, 60 | update |

## Computed paths inspected

- `examples/physics-character-viewer/setup.mjs`, `examples/physics-cloth-viewer/setup.mjs`, `examples/physics-capsule-query-scene/setup.mjs`, `examples/physics-character-public-reference/setup.mjs`, `examples/physics-character-reference/setup.mjs`, `examples/physics-character-controller-reference/setup.mjs`, `examples/physics-character-lookahead-reference/setup.mjs`, `examples/physics-error-entry/setup.mjs`: Workspace links compute barocss- plus each name. Physics is a list member. Keep the setup mapping and package export resolution in the migration.
- `examples/physics-viewer-scene/server.mjs`, `examples/physics-cad-scene/server.mjs`: esbuild entryPoints use new URL with a local app.js; the water viewer server also loads ../physics-scene/fluid-viewer/app.js. These servers are callers through their entry graph although the server need not import a Physics factory.
- `apps/library-docs/samples/run.mjs`: Source alias maps @barocss/physics to packages/barocss-physics/src. This proves source consumption only. Published export-map probes remain separate.
