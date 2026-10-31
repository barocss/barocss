# D393 audit round 2 (targeted) — CHANGES_REQUIRED, tests only (Opus)

Product code correct:
1. Every instance-id allocator goes through nextInstanceId (addPart → facade and chat add_part, libraryInstance, withFastenerInstance, Studio file insert and Duplicate); pattern copies `pat<n>-<k>` cannot collide; freshPatternId skips step-named ids; nested ids safe (steps/cuts refuse paths; a mate path counts its top-level part). Probes: stale mate p9 / stale seed p3 skipped.
2. 'base' and 'p1/q' reported as unlistable-part with correct words.
3. Name ≤ 60 / note ≤ 500 refused at add/edit (facade too), Open tolerant. Follow-up: an opened step with a too-long name refuses every edit until renamed (move/delete still work; the refusal names the cause).
Regressions: none — model 2403/2403, Studio 622/622; ids unchanged for documents without stale references.
Mutations 27: 23 caught; survived T3 (mate parts not counted), T4 (pattern seeds not counted), S9 (kind unchecked) → tests added; T5 equivalent.
