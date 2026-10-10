## Verification-only repair freeze — no numerical trial has run

Initial source commit `feb43c66d247f5d7bffcb8f8d6190ca68dcf0509` and source freeze `556ba18d882948b0615b77b148f6bf5551e781221b46172650661f1329c34cb2` remain preserved. Original CAD/Physics build passed. First strict private typecheck failed with TS18048 at admission.ts lines 13 and 19. Receipt: `evidence/initial-verification-failure.json`; exact build/typecheck logs are committed. Classification: EXECUTION_FAILURE, not a physical or numerical refusal.

Two bounded verification changes are now frozen before strict typecheck retry or any numerical consumer: (1) change the never-returning refusal helper from a const arrow to a named function so TypeScript narrows descriptors; (2) reject null/nonfinite values in scalar/vector oracle-control assertions before numeric conversion. No geometry, response math, inputs, dimensions, tolerances or scope changed. No numerical trial or consumer graph ran before this repair.

Updated `source-freeze.json` SHA256: `501eee4f9f61fddf4b499bd2d5974742b0e723df2c13c1c4e1f95799e03d9e57`.

Changed source hashes only:
- `admission.ts`: `7e5b9d9d74aede323e153413b8682b5290f5ccee7c52cff658886e35f4891de4`
- `reference-controls.mjs`: `2e4a29f4b005c4cccf053c935d0c676ad9856ea93f3160a99e452eb0579b65f7`

Measured source commit: `19b30fce` (full SHA recorded in native manifest). Next: strict private adapter typecheck, then the one frozen source/source-repeat/genuine emitted-original-helper flow. First numerical failure stops with no tuning or retry.
