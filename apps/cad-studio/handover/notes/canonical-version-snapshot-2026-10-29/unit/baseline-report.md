# D323 / A04 / #2236 storage baseline

Base commit: `27500e219febc591845cd5e4c53341a24ca9d39b`.
Node: `v22.19.0`. Working directory: `apps/cad-studio` in the assigned worktree.
Heavy gate `d323-snapshot-baseline` acquired and released.

Command: `node scripts/test.mjs storage-version-snapshot`.
Exit: **1**, **0 pass / 1 fail / 0 skipped**, normal runner exit.
Raw output: `baseline.log` (unchanged).

The test uses the actual Model version API and Studio `memoryStore`, `writeVersions`, and `readVersions`. The document is a valid empty schema3 millimetre document with optional `nextId` omitted. The existing dedicated snapshot codec control first passes and retains semantic canonical JSON. The current project reader then refuses:

`[VERSION_LOG] the snapshot d57d5d923d188d43 does not match its content (versions.0)`

The test's expected behavior is successful `readVersions`, valid `checkVersions`, successful `readVersion` by the existing version ID, omitted `nextId`, original snapshot key, and unchanged canonical document. No production source was modified for this baseline. No browser/native storage or whole suite proof is claimed. Raw-byte identity has not been measured.

The current write path uses `encodeStudioFile`; the current read path uses normalized `readDoc` → `readStudioFile`. Existing `encodeStudioSnapshot` / `readStudioSnapshot` already authenticate the supplied canonical key before raw snapshot admission and preserve admitted raw fields. The proposed minimal change connects only project version snapshot writes/reads to these existing functions. Ordinary part Open, autosave Open, schema, version API, and write-once existing snapshots stay unchanged.

Roadmap A04 and the engine audit intake were read. The local issue metadata and closure receipt contain #2236 title/status and report that its body was preserved, but do not include that body's text. The parent was asked for the archived original body location; the implementation scope above derives from source and the newly executed API baseline.
