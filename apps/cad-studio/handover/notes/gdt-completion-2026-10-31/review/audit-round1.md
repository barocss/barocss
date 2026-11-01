# D394 audit round 1 — CHANGES_REQUIRED (Opus, full tier)

Root, before the audit (actual runs): run02/03 — Save → fresh Open did not round-trip as JSON (frame keys, then drawing-settings keys reordered by the reader; the settings mismatch predates 11①) → every commit path now goes through the Open reader; the Geometric control editor showed projected height, free state, tangent plane and datum modifiers at once → moved under the closed Details.

1. (high) Studio standalone-frame commits next to an old rule-breaking frame were refused (the workspace checked without the current frames): moving it, adding another frame, removing another.
2. (high, UX) An old frame with two rule breaks could not be repaired one field at a time (each single-field fix still broke the other rule).
3. (medium) Ⓜ on symmetry/coaxiality is allowed by ISO 1101/2692 but was refused; ASME 2018 dropped both characteristics — rules must be the shared ground until the 11③ standard setting.
4. (medium) 3D annotation data disagreed with the sheet (profile composite second row "Ø0.1"; SØ, ST, Ⓤ, all-around and stacked missing).
5. (low) a spherical frame's second/stacked row drew "Ø" not "SØ".
6. (low) tangent plane accepted together with a Ø or projected zone.
7. (wrong display) frame values rounded to 0.01 (0.125 → "0.13").
Verified fine: rule table otherwise correct (composite lower row may have no datums; stacked rows independent); SVG/PDF/DXF marks; round trip through committedSettings/readDrawing; legitimate fixture edits. Mutations 25/29 caught (dim-change detection, composite ring height, attached stacked datums in DATUM_UNDEFINED survived → tests requested; readDrawing in chat redundant).
