# D396 audit round 2 (targeted) — ACCEPT (Opus)

1. No module state left (presetOf is pure); every caller with settings passes the preset (buildSheet and its dimension/datum/target/frame/note/section/detail/cutting-plane/title calls, issues, label placement, tolerance suggestions, Studio drag preview; chat, facade, 3D, SVG/PDF/DXF inherit the sheet's marks); no 3.5 mm slips. Intentionally fixed sizes: view/section/detail names 2.5, title block 1.4–5, tables/BOM 2.5, balloons 3, weld 2.5, deviations 2.5, ST 1.5, modifier circles 1.8 — follow-up: under ASME (Y14.2 3 mm minimum) the 2.5 mm items fall below.
2. Budget unchanged at 24,997/25,000 (set_drawing's description shows only through describe). The shortening had dropped "referenced section changes are refused" and never mentioned `standard` — root restored both words and added "standard (iso | asme | none clears)" after the audit (chat/drawing tests 298/298, docs checks pass).
4. Mutations 66: 44 caught; 21 survived (test gaps: issue/label/tolerance-datum paths, section/detail/PCD/angle values, section/detail letters, frame width, ASME gap details, symbol shift boundary) — follow-up tests; 2 no longer apply.
5. Open-triangle branch gone. 6. Projection symbol 1 mm inside the title room, ~3 mm above the angle words, no overlap.
Byte identity: 91/91 outputs equal HEAD on the final tree.
