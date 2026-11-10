---
work_id: D553
artifact_type: studio-viewport-interaction-refactor
status: qualified-for-selected-desktop-interactions
last_updated: 2026-11-10
---

# D553 — Separate App viewport interaction policies

P4, rows 20–22. The owner identified the large SceneViewport call in App.tsx. TypeScript parses 79 JSX attributes at the D552 parent, including `ref`. The file has 2,446 lines after the D552 repair. The call supplies selection, sketch editing, display, analysis, pose and recovery responsibilities.

The first slice moves selection policy and sketch interaction policy to viewport modules. Six picking callbacks form a typed `picking` contract. Seven sketch callbacks form a typed `sketchActions` contract. The target is 68 attributes including `ref`. App retains the shared document and sketch state. The SceneViewport adapter forwards the existing callbacks to the low-level Viewport. Existing canvas event priority, Print pick remapping, renderer effects, pose subscriptions and recovery lifecycle stay at their current boundary.

Verify the final attribute set with the TypeScript parser, then run Studio and final Model types and the selected actual desktop interactions. Check body/context selection and a real sketch action. Use the same component instance and explicit current-source pins through cleanup. No product contract, UI feature, renderer or native algorithm is added.

## Actual result

App now supplies two typed interaction groups. The picking hook owns body, chain, box, profile and context-menu policy alongside its existing main dispatch. Browser and History still use the same profile action. The sketch adapter owns selection, band and dimension event policy, while App retains the draft, shape history and mutation authority. SceneViewport unpacks the two groups at its existing low-level boundary. Viewport.tsx is byte-identical to the parent.

The call has 68 JSX attributes including ref, down from 79. The number of application attributes changes from 78 to 67. App.tsx changes from 2,446 to 2,436 lines. Of the 66 retained attribute expressions, 65 match byte-for-byte. The bounds-box expression was reformatted and has identical TypeScript tokens. The first source audit compared its raw whitespace and failed. The token comparison corrected that audit assumption without changing product source or repeating Studio.

Root ran the first actual desktop flow under `gate.sh`. Double-click selects the original box body. Right-click on the same visible face selects that face and opens its FACE menu with the document exact. In the second group, real pointer clicks create a sketch outline. The inline editor accepts 60 mm. The finished document stores 60 and the two endpoints measure 60 mm within the declared 1e-6 mm comparison. Seven original snapshots and 294 unchanged source pins are retained. Root viewed three selected images. The owned context, Chrome and server closed, and both owned PIDs are absent. The run took 10.12 s. Page errors, console errors and source changes were zero.

- **PASS** — source boundary, driver syntax, Studio and final Model types, actual selection and sketch interaction groups, and owned cleanup.
- **FAIL** — first raw-whitespace comparison only. No product or actual desktop failure was observed.
- **NOT_RUN** — other gestures, Print and recovery consumers, kernel tests, mobile and public API changes. Whole CAD is NOT_MEASURED.

The owner next selected Viewport.tsx itself. Its 1,780-line implementation owns the long sketch imports. Those are package subpaths exported by the existing cad-model package. D554 extracts the active-sketch overlay to a private viewport module. Package entry changes remain a separate contract decision.
