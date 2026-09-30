# #457 bounded styling comparison decision

## Decision

The frozen, authored experiment does not justify a new BaroCSS API or UI package. For app-controlled json-render screens with known controls, use a small application catalog: named layout presets for discrete choices, strict numeric props for changing padding/gap/radius, and precompiled state templates for known hover behavior. The registry—not the generated spec—formats validated numbers as CSS custom-property values. Keep the shared theme and host styles fixed. If the app must accept a styling rule absent from its frozen vocabulary, add and review that rule in the catalog/build, or use the existing BaroCSS browser preload for trusted, validated class tokens. This is a choice for the app boundary, not a claim that all possible UIs fit this catalog.

## Frozen-arm results

The authoritative run is `evidence/primary-b5c47fbda88f/result.json`, bound to corrected manifest SHA-256 `b5c47fbda88ff4063728dccea902f05f262b50daf2d9eab30df9c251ae8fc4ef`. Twelve transparent requirements × four arms × two viewports × two repeats produced 192 serial Chromium cells and 192 screenshots. Eight initial smoke cells had equal computed padding, gap, radius, columns, theme and host values across arms. The case, adapter and runner hashes are embedded in the result. All 192 cells passed schema, DOM, state value, focus, action, theme and host checks. All six invalid prop probes were rejected before render and left DOM/style unchanged; they generated no external request.

| Arm | Frozen-rule supported / 48 | Supported requirement pass | Observed computed match / 48 | Unsupported cells | Generated CSSOM rules/bytes per edit |
| --- | ---: | ---: | ---: | ---: | --- |
| Bounded presets | 20 | 20 | 20 | 28 | 0 / 0 |
| Presets + typed CSS variables | 36 | 36 | 36 | 12 | 0 / 0 |
| `className` + BaroCSS preload | 48 | 48 | 48 | 0 | 1–3 rules / 35–152 bytes |
| Matched frozen utility build | 0 | 0 | 4 | 48 | 0 / 0 |

“Frozen-rule supported” was classified from the manifest before browser outcomes. It means the requested edit is expressible with that arm's frozen vocabulary and compiled rules. “Observed computed match” is a separate browser observation. Thus the build arm's four dashboard one-column matches are visible but never counted as frozen-rule passes: `grid-cols-1` was absent; replacing compiled `grid-cols-2` left CSS Grid's default one column. In this exact screen, the visual request needed no new rule. That fallback is not a stable `grid-cols-1` capability. The 48 unsupported build cells remain in the denominator. The `unmetFrames` field records immediate plus three animation frames for each requirement; unsupported cells are not called rendering failures. CSSOM deltas measure rules and serialized rule bytes added *after the initial spec mounted*, not the total stylesheet payload.

The four scalar requirements (17.5px/23.75px padding, 21.25px gap, 19.5px radius) passed in the typed-variable arm with zero generated rules. Three preset changes and two hover-underline changes passed in both bounded arms using precompiled choices. Under the frozen vocabulary, hover italic, three columns and uppercase button were unsupported by both bounded arms but passed through existing BaroCSS preload. A future catalog or build could compile those three rules; this hypothetical expansion is not counted as a primary-run success. The matched build lacked later utility tokens. Existing BaroCSS preload added 1–3 CSSOM rules (35–152 serialized bytes) for each authored utility edit; no new runtime API was needed.

## App-owned recipe

1. Author a strict component/action catalog and permit only known nodes, state paths and actions.
2. Compile a small stable class vocabulary for the named density, column and hover choices.
3. Accept finite numeric padding/gap/radius only in documented closed ranges. Format `px` values inside the renderer and reject strings, URL values, nonfinite numbers, out-of-range values and unknown fields before DOM or runtime mutation.
4. Keep the same host/theme CSS and verify initial computed equality. When adding a genuinely new selector or layout rule, add a reviewed preset/template to the build or use the existing BaroCSS preload with controlled class input.

## Limits and provenance

This is deterministic representability of 12 selected requirements, not a sampled population, model-output trial, performance benchmark, or claim about API demand. #447's paid live-model study was not run. No new dependency or model call was used. The official json-render 0.21.0 / React 19.2.3 renderer and installed Playwright/Chromium were reused. `BASELINE.md` and `RUN-LOG.md` retain the first freeze, radius correction, schema-boundary diagnostic, refreeze and rerun chronology. The first diagnostic attempt's per-cell file and screenshots were overwritten before retention was requested; `evidence/diagnostic-attempt-1.json` contains only the actual preserved summary/probes/known row IDs. The decision relies solely on the corrected, complete authoritative dataset and its verifier. Unsupported syntax and browser fallback are reported as parity limits, not evidence that a different app catalog is inferior. The study does not measure timing, and makes no speed claim.
