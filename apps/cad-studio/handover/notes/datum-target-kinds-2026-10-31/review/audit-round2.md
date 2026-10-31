# D395 audit round 2 (targeted) — CHANGES_REQUIRED → fixed (Opus)

Verified: DATUM_TARGET_OUTSIDE warns for the shrunk-part line and far circle, not for rows inside or on edges (limit: extent is the view's projected bounding box, not its silhouette — a target in a hole or notch is not warned); moveable symbol over 84 leader angles: tangent error ≤ 1.5e-14, tip 2r from the centre, the leader leaves exactly opposite the tip and crosses no tangent line, no leader → tip up; line target = one phantom line, no X; mutants M5, M16, M22, M23, M27, M28 caught; Studio Kind change cancels a pending pick, legacy rows say in words why moveable cannot change; model 2440/2440.

Regression (wrong result, from the schema fix): the chat `validate` gained oneOf/minimum/maximum but ignored `const`, so set_drawing's scope oneOf (kind const 'part' / 'assembly') matched both branches and refused valid scopes ("matches 2 of the 2 forms"). No live caller (validate is used by tests and is a public export), but it was fixed: const and not supported, unsupported branch keywords never produce a false double match, both scope forms tested.
Cosmetic: the split line of a sideways moveable symbol ended in the pointed region; DXF arc angles reached −475°.

Root after the fix: validate probe on the final source — set_drawing scope {kind:'assembly'} and {kind:'part'} → no problems, {kind:'bogus'} refused; whole model suite 2442/2442; actual run04 PASS.
