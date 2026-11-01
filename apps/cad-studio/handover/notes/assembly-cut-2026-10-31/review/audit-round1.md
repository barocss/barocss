# D392 audit round 1 — CHANGES_REQUIRED (Opus, full tier)

Core geometry confirmed independently: a part turned [30,45,60] and moved, own Rz·Ry·Rx matrix, through cut removed 282.743 mm³ = π·9·10, hole axis through `at` (2e-15); rectangle w along assembly X (1200 vs 720 mm³ on a part turned 90°).

High
1. A saved file could become unopenable: Open refused a cut whose target is a sub-assembly, but editDefinition / offerRevision / acceptRevision accepted a definition that places parts → the whole document lost on reopen.
2. The BOM ignored a sub-assembly's own cuts (only top-level parts cut): outer BOM 86.4 g vs checkAssembly 84.279 g; nested lines merged qty 2 though one was cut.

Medium
3. robot/verbs.ts evaluated uncut definitions (link_inertia, gravity_torques, sweep/check_path, chat URDF/MJCF): 16000 vs 15214.6 mm³.
4. The HUD preview leaked into 3MF and robot exports; the HUD stayed open across other commands / opens.
5. Trimmed chat text dropped meaning (lock "where they stand", pattern "copies driven by it", inertia "(MMGS, link frame)").

Low
6. 'through' cut one way only (half a hole from a mid-plane), not flagged.
7. The BOM never merged identically cut copies (node JSON incl. cut id).
8. Mates read definition faces — to be stated as a v1 limit.
9. Nested cuts not validated on Open.

Mutations: 10/12 caught; survived: rectangle w/d swap (orientation untested), occurrenceMass without withCutNodes.
Also (root, before the run): instances cannot be multi-selected, so a HUD "Use selection" that replaced targets made a two-part cut impossible → "Add selected" (union).
All fixed in the fix round.
