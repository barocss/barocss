# D392 audit round 2 — CHANGES_REQUIRED (Opus, full tier)

All nine round-1 fixes and "Add selected" verified by the auditor's own probes; model suite 2380/2380.

A (high, new) A flexible sub-assembly with its own cut: the geometry folded the posed document with the tool left in the sub-assembly frame, so a posed occurrence's lid lost its hole (44821.90 vs 44680.53 mm³) while the BOM showed both holed (241.274 vs checkAssembly 241.656 g) and no finding was raised.
B (medium) 'through' was ±4900 mm: an 8000 mm bar was cut only partly (138,544 of 226,195 mm³) without a report; a plane origin beyond ±10000 mm in the part frame made the part fail to evaluate (BOM mass 0) while add_cut accepted it.
C (low) The BOM over-split identical cut parts (circle xAxis and plane origin along dir in the shape key).
D (low) Shortened chat text keeps meaning — accepted.
Studio: preview viewport-only, acceptRevision throw caught — OK.

Mutations 35 run, 31 caught; survived (missing tests): robot partsOf without withCutNodes, bodyNodeOf chain, REFERRERS without assemblyCuts, BOM `all` from the definition.

Fixes: the tool is built from the part's saved placement then posed (unsaved `savedPlacement` on posed instances); a through tool is sized from the part's own box along dir with 1 % margins, foot of the part origin on the axis; a build trial refuses at add/edit any cut that would lose a body, fail to build or exceed the kernel tool length; partial through reported (CUT_PARTIAL); canonical cut shape in the part frame; tests for the four survivors (bought elements stay whole under a cut).
