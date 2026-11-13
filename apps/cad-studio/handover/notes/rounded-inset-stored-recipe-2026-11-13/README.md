# D912 — read bounded rounded inset recipes

2026-11-13 · FULL · P1 rows 09 and 16 · [#2232](https://github.com/barocss/barocss/issues/2232) remains open.

Implement the D911 version 1 producer. Its source is one numeric XY tangent rounded-rectangle sketch with eight authored side IDs. The recipe owns its source index, source feature ID, distance and derived side map. The complete document has one direct positive Extrude. Lower the exact source and derived loops to native geometry at evaluation. Check the source arc centers before reconstructing the loops. The reader refuses unsupported consumers, embedded recipes and unsupported document sections. It checks a retired side of the recipe's own Extrude before generic reference rematch.

Native File Open and browser Project Open verify the resulting native solid before replacing the accepted document. Other replacement routes check stored structure. Sketch editing, generic document edits and flattening refuse the recipe in this slice. The schema remains 3 or 4.

## Verification

- **PASS** Desktop Studio File Open of 1, 2, 2.5 and 1 mm insets. Measured native volumes in mm³ were 534.247779607693, 1005.6637061435913, 1215.663706143591 and 534.247779607693. The independent oracles were 534.2477796076939, 1005.6637061435918, 1215.6637061435918 and 534.2477796076939. Project Open, first Undo/Redo, native Save and a fresh File Open preserved the accepted result. The saved file was 891 bytes.
- **PASS** File Open refused a wrong source ID, a retired inner arc reference and a structurally valid profile with no native area. Project Open refused the retired inner arc reference. The accepted document, history, title, dirty state, selection and body were retained. The generic marked rematch and the existing straight linked inset also passed their separate Studio flows.
- **PASS** The exact parent reader source, bundled with the checkout's dependencies, refused the Studio-saved schema 3 recipe as an unknown kind. It accepted the ordinary-sketch control. Two independent source reviews covered admission, native lowering, references and replacement. The in-memory mutation run detected all five omissions. The final focused run passed 97 Model and 117 Studio tests, both type checks, the Studio build, scoped lint, browser driver syntax and diff checks.
- **FAIL** The first type check found that graph draft code can clear the static feature ID. The retry uses the existing optional draft type and retains the strict raw ID guard. The first browser observer missed the wording of the source ID refusal. The product refused the document and kept the accepted state.
- **NOT_RUN** Native pre-adoption through recovery or version views, the old desktop product, whole suites, mobile, live editing, recipe creation in Studio, detach and arbitrary geometry or dependents.

[Commands and receipt hashes](qualification.json).
