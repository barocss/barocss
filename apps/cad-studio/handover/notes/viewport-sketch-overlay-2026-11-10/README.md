---
work_id: D554
artifact_type: viewport-sketch-overlay-extraction
status: qualified-for-selected-desktop-overlays
last_updated: 2026-11-10
---

# D554 — Extract the active-sketch viewport overlay

P4, rows 20–22. The owner selected the 1,780-line Viewport.tsx after [D553](../studio-viewport-interactions-2026-11-10/README.md). This slice moves active-sketch drawing, its editor and its private helpers to a viewport module. The existing FrameOverlay stays the live render boundary. The SVG items, editor placement, cache identity, projection inputs and callback order remain the acceptance criteria. Pointer handlers, picking priority, renderer lifetime and recovery remain at the current owner.

The long CAD imports in Viewport.tsx already use the cad-model package. Its current package exports map each subpath to the corresponding source module. This extraction moves the active-sketch dependencies to their consumer. A shorter public entry point needs a separate compatibility contract.

Verify scope and import counts against the D553 parent. Run Studio and final Model types. In desktop Studio, qualify the retained D553 polygon and 60 mm inline dimension flow, plus a focused construction and Band overlay flow. Keep numeric, file and source bounds at the selected scope. Full geometry and renderer acceptance remain separate.

## Actual result

The private `sketchOverlay.tsx` owns the active grid, shapes, band outline, sketch labels, cursor and inline dimension editor. Viewport still renders the same SVG item sequence and editor sibling at its existing frame boundary. The overlay receives the current draft and only the three dimension actions it uses. The band cache still belongs to each mounted Viewport and compares the same `done`, `shape` and `band` identities. The closed-spline predicate is shared through the existing spline handle module.

Viewport.tsx goes from 1,780 to 1,582 lines. Its direct cad-model import declarations go from 21 to 19. The `app/profiles` and `sketch/loops` subpaths move to the overlay module, and several shared imports lose overlay-only symbols. The TypeScript source check confirms exact pointer handler, wheel and Print remapping implementations. App.tsx, SceneViewport.tsx and the cad-model package export files are byte-identical to the parent.

Root ran both selected desktop consumers. The D553 flow passed on the first attempt, including the body/context actions, inline 60 mm editor and finished outline. It produced seven snapshots and 295 unchanged recorded pins. The Band flow confirms the two original construction circles and two highlights. Changing width from 3 to 5 and back to 3 changes and then exactly restores the rendered path. The construction polygons and accepted empty document stay exact. The passing Band run produced six snapshots and 296 unchanged recorded pins. Root viewed the inline dimension and three Band-width images.

The first Band driver expected `aria-label` directly on the circle inputs. The saved HTML has the correct 0, 0 and 40 values under input IDs `sk-cx`, `sk-cy` and `sk-diameter`. The original observer failure and executed driver copy are retained. The continuation changes only the private input reader and reruns the Band flow. It does not repeat the passed dimension flow. The recorded source maps cover product and shared helper inputs. The two scenario driver hashes are recorded separately, outside those maps.

Both successful runs and the original failed observer run closed their context, Chrome and server. All owned PIDs are absent. Page errors, console errors and watched changes are zero. Each run handled one font CSS request locally. The actual elapsed times were 10.39 s for the interaction flow, 9.02 s for the failed observer and 15.74 s for the passing Band flow.

- **PASS** — source boundary, scenario syntax, Studio types, final Model types after the last test edit, both actual selected consumers and owned cleanup.
- **FAIL** — the original Band input selector. No product failure was reproduced.
- **NOT_RUN** — other curve gestures, native roundtrip, Print and recovery runtime, full kernel, mobile and public package API changes. Whole CAD is NOT_MEASURED.

The next D520 candidate is D555, current evidence for the body clipboard when Undo crosses an Open boundary. The first viewport refactor slices are available for subsequent presentation or input work. [Qualification](qualification.json).
