---
work_id: physics-world-p0-2276
artifact_type: contract-and-migration-checkpoint
status: done
owner_role: independent-physics-algorithm-work
source_request: fix common World model/state/command/failure contracts and first-party transition scope; continue the independent roadmap without compatibility paths
last_updated: 2026-11-02
---

# P0 contract checkpoint

P0 defines the next canonical World contract, target types and direct migration scope. It does not export a new API,
change a numerical solver or activate a supported profile. Branch `codex/physics-world-p0-2276`; base
`66df02f8e7d5a3a7ab7b8ff7a0184bf34d978713`. Existing HOLD, public two-hinge NO_GO, original eight-box NO_GO,
tolerances, iteration/time limits and first-failure evidence remain. Other workers and checkouts were not changed.

## Canonical artifacts

- `packages/barocss-physics/design/p0/CONTRACT.md`: required model, accepted state, commands, queries, failure
  precedence, continuation retention, recording, disposal, source identity and ownership.
- `types.ts`, `contract-check.ts`, `tsconfig.json` there: unexported compile-only target contract, positive consumer
  and13 intentionally rejected forms. No mock factory implementation is used to claim runtime behavior.
- `profiles.json`: seven target profile IDs mapped to existing admission, ancillary geometric/reference roles and
  preserved qualification limits. All target runtime states say NOT_IMPLEMENTED.
- `encoding-vectors.json`: seven manually defined canonical-byte/digest vectors, including +0/-0, UTF-8, array order
  and record key ordering. No codec/hash implementation is claimed by P0.
- `validation.json`:19 named implementation requirements, each explicitly NOT_RUN until its implementation campaign.
- `MIGRATION.md`: buildable P1a internal preparation, atomic P1b root/replay/CAD cutover, P2 recording/adapters and
  P5 domain removal/update boundaries. No compatibility overload, factory, engine, alias or snapshot migration.
- `callers.json`, `callers.md`, `inventory.mjs` here: reproducible bounded corpus, exact file hashes/line anchors,
  per-line/per-file roles and concrete direct candidate groups; frozen evidence remains separate.

The new model explicitly separates bodies, colliders, joints, cloth, fluid and source bindings. P1 admits only
rigid data with one identity-local collider per body. Exposing fields/types does not admit extra topology, coupled
domains, tensor inertia, new joints or a larger stack. One common clock is not two-way coupling.

Source review identified concrete current gaps: public return copies occur after rigid/fluid/cloth state replacement;
replay pushes its log after its private World advances; cloth candidates share mutable constraint lambdas; fluid
solvers retain scratch/grid references. These are implementation requirements and source observations, not a measured
physical explanation of the original stack or hinge failure. No source fix or hidden-state retention PASS is claimed
by this checkpoint.

## Caller scope and limitations

The expanded inventory searches tracked working-tree text across all extensions, named API symbols, paths, package
maps and conservative reverse literal-relative references. It records computed workspace-link, server entry and
source-alias findings. At this checkpoint:1281 files,5071 classified line/file records;127/127 earlier seed files
remain. Excluded:7540 immutable evidence-directory files,30 emitted/cache files and2211 binary files. Exact paths
and reasons are in JSON. Zero unclassified records describes this lexical corpus, not all runtime reachability.
Arbitrary computed strings, external callers and ignored/untracked bodies are not covered.

The initial generated defaults incorrectly labelled some real docs sample/alias files as incidental at file level.
Review corrected aggregation from actual line roles before the checkpoint; active calls update, pure mentions and
history preserve, frozen providers freeze, harnesses adapt, shared mappings stay with their existing owner.
The root candidate group contains203 files; this includes imports/types/errors and does not mean203 running worlds.
No mass replacement or removal is approved by a token match.

P1a retains the sole current root signature while preparing a stronger commit boundary. P1b replaces it and all
affected direct root/replay/CAD consumers together. P2 cannot fix a broken root/replay graph later. P5 removes old
domain factories only in the same slice as their canonical model/caller transition. Numerical records and frozen
oracles remain at their immutable checkpoints. No private old-World wrapper is a permitted target implementation.

## Checks executed

Installed Node22.19.0, TypeScript5.9.3 and VitePress1.6.4 were reused. No install, download, new dependency, security
change, remote write, deployment or hardware operation ran. Heavy checks used the existing gate in the same shell.

```sh
task_node=/Users/user/.volta/tools/image/node/22.19.0/bin/node
$task_node node_modules/typescript/bin/tsc --project packages/barocss-physics/design/p0/tsconfig.json
$task_node examples/physics-world-p0-2276/check-contract.mjs
$task_node examples/physics-world-p0-2276/inventory.mjs
$task_node examples/physics-world-p0-2276/inventory.mjs --check
$task_node apps/library-docs/scripts/check-docs.mjs
# cwd apps/library-docs:
$task_node node_modules/vitepress/bin/vitepress.js build docs
# repository root:
$task_node examples/physics-motion-docs-2276/check-site.mjs
```

Type checks pass with all13 negative directives active. Admission-constant/vector/requirement checks pass. Inventory
generation/check passes. Documentation structure and site build pass; site check passes5 new pages,785 link
occurrences,201 anchor occurrences,19 snippet inclusions and14 historical byte-identical copies. The new P0
contract/types/migration download copies are also compared byte-for-byte with their canonical artifacts.
Raw commands/results are recorded under `evidence/`. The build retains its chunk-size warning; no threshold changed.
No numerical suite was rerun merely to document a contract. The earlier173/173 site sample result remains attributed
to its original docs checkpoint. Runtime new-API, recording codec, full numerical continuation and source/emitted
new-contract integration remain NOT_RUN/NOT_IMPLEMENTED.

Review caught two target-contract errors before completion: a positive type consumer attached a recorder after
advancing; it now uses a fresh step0 World. The digest distinguishes signed zero, so raw JSON could not be the new
wire format; the contract now fixes a bounded bit-preserving binary codec and retains signed-zero vectors. These
are corrected design artifacts, not claims that a codec was executed.

## Next ready slice

The user's continuation instruction permits the independent P1a preparation next. Stage the successful rigid
return snapshot before committing accepted pointers and stage replay log/count before the private World advances.
First reproduce the old post-commit failure with bounded test-only injection, then compare accepted state and valid
continuation to an untouched control. Keep actual uninstrumented source/emitted consumers separate from injected
test graphs. P1a does not finish the new public model API and cannot clear P3/P4 numerical NO_GO or existing HOLDs.
