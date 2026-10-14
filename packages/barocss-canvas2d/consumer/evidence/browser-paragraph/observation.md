# #1394 international paragraph preparation — native result

PASS on parent `b946e045bdbfbde73986bbf2fdad0440b69e26ed`. The public synchronous helper uses native grapheme boundaries, measures every complete prefix, selects the greatest fitting end, and preserves original UTF16 ranges and spaces. Existing text modes retain their defaults and return shapes.

## Executed checks

- Source and emitted public APIs passed one paired controlled probe: 1,260 assertions, 13 accepted and 83 refused cases per provider. The probe checks nonmonotonic widths, indivisible clusters, whitespace-only soft lines, original offsets, cached metrics, surrogate-end refusal, cleanup and five old-mode witnesses. Controlled facilities do not prove native glyph coverage. The largest valid work witness used 506 measures; 512 is the enforced ceiling.
- The first affected build passed at 311.2 KiB. Root then requested a paragraph-only surrogate-end guard. The required changed-source build passed at 311.4 KiB. Common and scoped actual-host/source/emitted type checks passed on their first executions. Logs: `/tmp/c2d1394-build.txt`, `build-ready.txt`, `common-types.txt`, `scoped-types.txt`, and `focused-probe.txt` with the same prefix.
- One native page used freshly checked Google Chrome 155.0.8059.39 on macOS, ANGLE SwiftShader, `24px system-ui`, DPR 2. Native Segmenter resolved locale `ko`. Root inspected the independent reference before the first accepted paragraph. Hangul, CJK, decomposed accent and the family pictograph were readable, with no tofu visible in this fixture.

## One native file flow

The original 26-unit source is `설계 圖面 é 👩‍👩‍👧‍👦 A1\n국제`, with an actual LF. Width 120 selected `[0,9]`, `[9,23]`, `[24,26]`; the 222×172 atlas matched all 152,736 independent native-reference bytes. Eighteen candidate measures supplied three cached draws. The complete 737,280-byte premultiplied display matched with maximum difference 0 and fixed tolerance 2. Three physical canvas clicks proved ink, transparent interline and Back routes.

Six typed refusals preserved the accepted tree, identities, layout, all bytes, hits, whole frame and canonical file. Controls, an unpaired surrogate, an accessor and missing Segmenter allocated no scratch canvas. No-fit and fifth-soft-line cases each used one scratch canvas, drew/read back zero pixels and reset its backing. Getter reads and GL draw deltas were zero. Host observation fingerprints performed 28 diagnostic GL reads per refusal; these reads are retained and are not reported as zero aggregate reads.

The same-page direct RTL witness `مرحبا A1` matched all 35,360 native-reference bytes, original range `[0,8]`, bounds and line metrics. It created no renderer, preview or file.

Save fully returned before the separate physical chooser and one CLI upload. The genuine native JSON is 204,697 bytes, SHA-256 `d93af7bb1c35578a173670964d24c2eebfa626cfa570240d80e95b1acad982a6`, fresh mtime `1791658469934869638` ns. Root verified it and the initial readable screenshot before upload. One File.text and one input change created a fresh canvas/tree/renderer with Scene 29, context `BrowserTextConsumer`, Back/Label IDs, exact original source/layout/bytes/canonical serialization and whole frame. Open made no helper, font-load or Segmenter call; preparation metadata was unknown/null.

Explicit restored preparation used the same source at width 240 and public GlyphRun.setLayout. Ranges became `[0,23]`, `[24,26]`; all 158,592 bytes of the 336×118 atlas matched the independent reference. The complete frame again had maximum difference 0. Three more physical clicks proved restored routes. Root inspected `restored-screenshot.png` before terminal Dispose. Both committed screenshots show readable accepted states before Dispose, not the final cleanup ledger.

One genuine PNG is 15,938 bytes, SHA-256 `dea625f725fbcc3f5d0c3f6883c0bdd8ed01a5227f1d57b09b3ba334907bf8ce`, fresh mtime `1791658634586482001` ns. Public decode compared all 737,280 frame bytes with maximum difference 0.

## Lifetime and retained records

All 17 stages are retained. Before page closure, all five GL contexts had exact creation/deletion counts per context: shader 4, program 2, buffer 3, VAO 2, texture 1 and framebuffer 0. Native live counts and GL errors were zero; no context was excluded or lost. Four exact display callback identities were added once and removed once; active callbacks were zero. All 12 native 2D backings were 0×0, the single bitmap was closed once with 0×0 dimensions, and both object URLs were revoked. A seventh physical canvas click after Dispose delivered no event. Controls were disabled and repeated Dispose was unchanged. Browser and server were closed after this API proof.

Four native ReadPixels stall warnings are preserved in `/tmp/c2d1394-console.log`; window errors, unhandled rejections and native GL errors were zero. The six host error counters are the intentional typed refusals.

There was no product/runtime test failure. The first offline collector attempt could not encode the deliberately retained unpaired-surrogate draft with `ensure_ascii=False`; the same successful raw result was parsed with JSON escapes. No browser operation was repeated. `/tmp/c2d1394-collector-first-error.txt` preserves the first error. A guessed snapshot timestamp glob had no match; the current inline CLI snapshot provided the Open reference. Earlier read-only plan lookup misses are also recorded. No accepted operation, file export or upload was replayed.

The full raw result remains in `/tmp/c2d1394-phase3-result.json`. The tracked receipt retains every stage and its metadata/resource ledger, hashes repeated RGBA arrays, and stores full initial/restored byte anchors once. Native file receipts are `/tmp/c2d1394-save-artifact.json` and `/tmp/c2d1394-png-artifact.json`. Raw CLI logs use the `/tmp/c2d1394-` prefix for phases 0–3, prechooser, chooser, upload, console and close.

All 321 frozen source/host/config hashes and approved driver `28cba860f7b6b533fc074839ee5c3dc71619d262514681f2ef775029f2ab8605` stayed unchanged. All 909 unowned baseline blobs, including 591 prior evidence blobs, stayed unchanged. Guard receipt: `/tmp/c2d1394-source-after-browser.json`.

This proof covers the stated macOS browser/font fixture and direct native RTL comparison. It does not certify a named font, all Unicode glyphs, UAX14 line breaking, library-owned shaping/BiDi, caret mapping, other devices, or broad composed acceptance. Root #1254/#674 acceptance remains UNRUN. Root owns the native commit and handoff.
