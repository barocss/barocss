# D323 / A04 / #2236 canonical project snapshots

Base: `27500e219febc591845cd5e4c53341a24ca9d39b`.
Runtime: Node `v22.19.0`, assigned worktree, commands run from `apps/cad-studio`.
All heavy checks used the serial gate; it was released after each bundle.

## Small production change

Only `src/storage/project.ts` changes: version snapshot writes use the existing `encodeStudioSnapshot(doc, key)` and reads use `readStudioSnapshot(stored.bytes, key)`. The existing Model codec validates canonical keys before admission and returns the admitted raw document. No new codec, public API, schema, migration, dependency or lockfile was introduced.

Ordinary `readDoc`, `readPart`, `readAutosave`, Save and Open normalization are unchanged. Existing snapshots remain write-once. Missing snapshots still reach the existing version-log refusal. Wrong canonical keys are explicitly refused. Neither reader repairs original data nor changes stored version IDs, parents, keys or revisions. FNV canonical keys are consistency identifiers, not cryptographic authentication.

The original #2236 body was read from the parent's `../issue2236-source.json` after the initial baseline. It identifies the same omitted-nextId failure and dedicated-codec control. Its CLOSED/0-comments metadata describes roadmap transfer, not a previous implementation qualification.

## Baseline and first failures

`node scripts/test.mjs storage-version-snapshot` before production changes: **exit 1**, **0 pass / 1 fail / 0 skipped**. Existing dedicated snapshot codec control passed; actual memoryStore → writeVersions → readVersions failed with `[VERSION_LOG] the snapshot d57d5d923d188d43 does not match its content`. Original raw output: `baseline.log`; details and baseline hashes: `baseline-report.md`, `baseline-source-sha256.txt`.

First after bundle:

- `node scripts/test.mjs storage`: **exit 0, 12 pass / 0 fail / 0 skipped**, clean process exit. `focused.log`.
- `node ../../node_modules/typescript/bin/tsc --noEmit`: **exit 2**. Three new test-fixture type errors: omitted required sweep-curve name, direct cast of partial DrawingSettings, and union node name access without narrowing. Original raw output is preserved in `types-first-failure.log` (also `types.log`). No production type error was reported.
- `node ../../node_modules/eslint/bin/eslint.js src/storage/project.ts test/storage-version-snapshot.test.ts`: **exit 0**. `lint.log` is empty. Original exits: `first-exits.txt` (also `exits.txt`).

Only test fixtures changed after that bundle: supplied the actual imported curve's name, used `defaultDrawing`, and narrowed the mesh kind before its name assertion. The production hash stayed unchanged.

Final affected bundle:

- `node scripts/test.mjs storage-version-snapshot`: **exit 0, 5 pass / 0 fail / 0 skipped**, clean process exit. `focused-final.log`.
- Studio `tsc --noEmit`: **exit 0**. `types-final.log` is empty.
- ESLint of `test/storage-version-snapshot.test.ts`: **exit 0**. `lint-final.log` is empty.
- `final-exits.txt` records all three zero exits. Production lint from the first after bundle is reused.

Unique related cases: **12 = 7 unchanged storage cases + 5 new snapshot cases**. The final five are overlapping reruns, not five additional unique cases. The original one-case failing baseline overlaps the new first test. No whole Studio, Model or Kernel suite was run by this worker.

## Meaningful coverage

- The original permitted schema3 nextId omission survives real project version persistence, `checkVersions` and `readVersion` under the original version ID and canonical key.
- Real schema3 and authored route-bundle schema4 documents carry binary mesh blobs. Optional data, omitted nextId, false flags, zero parameter, empty name/arrays/maps, drawing datum arrays and route data preserve semantic canonical JSON. Container decoding observes two mesh arrays.
- Two versions retain their original IDs, parent links, revisions and keys; existing snapshot tag and bytes stay unchanged when a later version is saved.
- Missing snapshots refuse; a different document stored under an original key refuses; a new snapshot supplied with a wrong key refuses before publishing its new log.
- Ordinary part and autosave Open still add the normal nextId default. Source snapshot objects remain unchanged.

Raw-byte observations are separate: re-encoding these two binary fixtures happened to produce equal bytes (`true` diagnostics in both focused logs). This is not a general original-byte codec guarantee. The tests enforce no rewrite for existing stored snapshots because write-once/read-only storage behavior is part of the actual contract. There is no literal source checksum acceptance test.

## Handoff

Final source hashes: `final-source-sha256.txt`.

- project.ts: `a927fd79a0db9be5d5b60f5380f2ad2ac114e4b5c33c0c9f5240da8772a815ad`.
- storage-version-snapshot.test.ts: `8f9c195c8c82ad980753977f8a9e7f862e30d592cd1ab548e869c3fc52038d14`.

`git diff --check` for the production file exits 0. Browser/native project flow is **NOT_RUN by this worker**, reserved for the separate consumer. No commit, push, external message or other worker's source change was made. Source and test are stable for the consumer freeze.
