# D342 final command and browser-source review

Verdict: no required source finding in the final command wiring or the browser driver's stated native geometry/UI scope. Source/evidence reads only; reviewer runtime, build, tests and browser execution NOT_RUN. No repository edits. Actual browser/product/visual acceptance belongs to root.

## Final command manifest

Read `/tmp/d342-model/hashes.json` and `checks-final.json`; independently computed SHA256 matches both entries:

- profileCommands.ts: `02d45c17dd1b436e82594a31eb01bd3abae5468364adece39c6d641b90d3a8cf`.
- offset-face-native.test.ts: `ff6b63edd3fe12f20cebf053e0af044923836cd0b2c3d93d60cb0a14492171f5`.

Offset.available has the explicit body-key count loop. Authoritative native selection and geometric qualification remain in resolveNativeOffsetFace; cheap availability does not claim native qualification. Build validates distance before publication, structuredClones the frozen owned native sketch, selects only its exact new sketch index, clears prior direct/face/body/edge/vertex selection, then invokes the unchanged Extrude composition. The original recipe and original parameter bindings remain a prefix. Generic Extrude behavior was not changed.

Read final affected test source including both near-full polygon/circle refusal+positive retry, unchanged source/selection, actual strict-valid native result, native and Model normal-centroid containment, Save/Open/edit and fixed required repeat success. Supplied receipt reports64PASS0FAIL0SKIP/types/lintPASS. Initial54PASS4FAIL oracle assumptions and later61PASS2FAIL ordinary guard regression remain retained. These are owner executions, not reviewer reproduction.

## Browser driver source capsule

Read `apps/cad-studio/test/offset-face-native-browser.mjs`,154lines, SHA256 `f800a6425006417c1454aeae5a1fc2ed26a091b83d442e0afd84c662616d6285`. Driver requires explicit root freeze environment and absolute Playwright/Chrome/output inputs. It launches one Chrome process, closes each old context before opening the next, and closes context/browser/server in finally. It preserves native inspector/oracle source, bundle metafiles, initial named-source capsule, discovered generator/inspector disk inputs, runtime watcher events, before/after/cleanup hashes, errors and failure captures. The capsule's discovered input set is for those Node bundles plus named browser files; it is not a universal inventory of every possible Vite UI dependency. No dist-input exclusion claim is made; the explicit hash list includes cad/dist/index.js as an observed artifact. Its actual use must be read from bundle metafiles rather than inferred from that named list.

Public author APIs generate only the initial saved seed documents: translated fractional box, drafted extrusion, integer cylinder, each with a separate witness body. The browser Open UI loads them. World projection and document/body/selection hooks are read-only observations. Selection is an actual page.mouse.click after Top view and read-only __studioScreenOf; an exact body/face selection assertion follows. Offset preview/apply, history distance edit and parameter binding, Save, fresh-context Open, Undo/Redo, refusal/Cancel/retry all use actual UI. No authored-document, selection or pick mutation hook is present.

The workflow proves outward+2, redo/fresh Open, existing Extrude parameter-bound distance3 and fresh Open/reedit, inward−1, drafted refusal preserving document/selection and previous Undo item, then valid retry and existing integer-cylinder control. Signed other caps and tiny-residue boundaries belong to focused tests; the driver explicitly does not claim their browser coverage. Screenshots and renderer readiness are captured; visual correctness still requires root inspection.

## Independent numeric and native proof

Embedded Python Fraction code has no production imports. It decodes original stored native boundary coordinates and requested binary64 distance exactly, computes expected box endpoint ranges, volume, centroid and area from them, then compares actual native output. Expected tangent dimensions and normal endpoint do not come from output geometry. The exact sum versus represented result may differ by one rounding, covered by the unchanged explicit linear comparison; the oracle does not silently derive its expected cap from output bounds.

It requires one native solid and one closed shell inside the target Model body. The inspector separately requires existing strict checker validity, positive public face areas, unique public/native names, and an unaffected witness with stable geometry/names. Output boundary vertices must occupy expected overall bounds; each nonzero-area, nonduplicate boundary face lies on an intended support plane. Complete surface control nets must lie on an intended support plane too. Critically, it does NOT require raw support poles to lie within the physical face's tangential trim rectangle: a trimmed native support can extend past its face boundary. The old selected cap cannot remain as an exposed planar ledge. Native mass, centroid and surface area are checked in addition to body counts. Saved output names and full original recipe prefix/parameters are checked across redraw, Undo/Redo, edit and fresh Open.

For the integer cylinder, analytic pi is explicitly rounded and used only as an existing-control volume guide; centroid and native one-solid/closed-shell/strict validity are checked. No exact rational circle mass or arbitrary curved certificate is claimed.

Evidence limit sent to root: inspector records `publicMass`, but the Fraction oracle currently asserts the separate native `brepMassProperties` result. Thus its numeric PASS directly certifies native mass; separate public/Model mass accuracy should not be inferred unless an additional assertion compares that captured value or visible Model centroids. This is a scope limit, not an observed product failure. The final Model focused tests separately assert relevant near-full retry Model centroid containment.

No actual browser run, screenshot review, product PASS, commit or remote result is claimed by this source-only review.
