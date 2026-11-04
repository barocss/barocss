# D499 — CAD React Revolve and scoped documentation navigation

The private CAD React package now exposes Revolve over the existing Model operation. One current real React rectangle workflow passes at 90°,180°,360° and public Reset90°, followed by public Studio Open and Frame all of the exact returned document. The Revolve documentation, actual Markdown types, site check/build and route-scoped docs preview pass. All 10 top menus now show only their own canonical sidebar section. The 26 former How it works topics sit under CAD (19), CAD Model (6) and GPU (1), with unchanged URLs, labels, lane flags and content. The overview remains under Guide. Only the owning top menu is active, including direct topic routes. This item is not a package publication or full CAD React completion.

## Scope and API

Revolve accepts one closed Rectangle/Circle child or one typed ProfileRef, required sketch axis x/y, required finite angle `(0,360]` degrees, optional explicit finite two-coordinate origin and an optional resulting SolidRef. No public sketch IDs, free-vector axis, face/UV producer or new geometry algorithm is added. Existing refs/Definitions/Boolean/Translate/Rotate composition is declaration-tested; that is separate from native physical qualification.

The actual recipe is only rectangle `[10,20]..[20,50]`, stored y axis and omitted origin. Existing Model conversion supplies origin `[0,0]` and the existing signed frame sweeps this positive-X section toward positive Z. The React layer does not correct or replace that convention. Current accepted documents contain exactly automatic n0 sketch/n1 revolve and normalized b1 output. D463 Studio geometry is a source antecedent, not reused current React native proof.

## Tests and preserved failure

There are 44 unique controlled tests with package/API-example types and lint PASS. The first run passed 43 and failed one new cardinality fixture because both profile children used key `section`: duplicate-key validation correctly occurred first. Only the second fixture key changed to `section-2`. The named failed test then passed; 43 original passes were reused. Product validation order and expected CARDINALITY were unchanged. The original FAIL and exact one-key source proof remain outside Git.

Exact executed commands and log receipts are listed in qualification.json. No extra kernel/build/native sweep is implied by these adapter tests. Existing Model/kernel producer source stays unchanged.

## Actual and independent physical proof

Four actual GUI ready states use the public Angle and Reset controls. Collapse/reopen and 1200 ms idle preserve exact document/checkpoints/requests/owners/frame. Ready state, current original host/Worker volume/centroid/bounds and native/render/mounted/frame ownership are retained before assertions. Public Studio Open and Frame all retain the exact returned 90° document with current root Worker b1. No model, selection or camera setter is used.

Three new native captures and two exact 90° native subproof reuses bind five fresh consumers. Output mass and separate actual-B-rep quadrature are checked against independent polar integrals. Volume is 2250π/4500π/9000π mm³; centroid is `[k,35,k]`/`[0,35,k]`/`[0,35,0]`, `k=280/(9π)` mm. Relative-volume and absolute centroid/bounds/boundary/normal budgets remain 1e-9. Maximum native relative volume error is 7.5914e-15, absolute volume 2.1465e-10 mm³, centroid 4.6186e-14 mm, bounds 3.5528e-15 mm and normal 2.2205e-16. Current Worker/native volume and centroid differences are zero.

Partial 90°/180° states have six faces, twelve edges, eight vertices,genus 0 and two radial caps. Full 360° has eight faces, sixteen edges, eight vertices,genus 1, no radial caps and a reciprocal periodic graph. Pcurves observed: 0; none are synthesized or claimed checked as present. Native boundary-aware geometry is physical authority; display mesh/pixels remain consumer observations. Complete topology and finite rational witnesses do not prove every parameter-domain point or general geometry family.

High final review passes 41014 saved hash/topology/arithmetic checks plus five post-write 64-hex document checks, separate from 44 product tests. Its original acknowledgment-field dialect stop is preserved; saved02 corrects the observer only, without runtime or physical-criteria rerun. Six root images and execution/cleanup/audit source custody pass: 4399 GUI, 4445 outer and 3045 local helper pins. Later packageREADME/documentation prose edits are explicit post-audit deltas; original full 4399 pins are not claimed currently equal after those edits. Runtime/example/test modules remain unchanged.

## Documentation and continuation

The category now has 19 pages with an individual Revolve page, 12 logical components,six operation adapters and the same 75 distinct ModelNode schema kinds. The schema count is not a native-feature qualification percentage. One new actual Markdown code fence is extracted;21 earlier fences remain byte-exact. The new fence types pass; 21 earlier fences remain byte-exact. After the final topic and active-menu changes, seven focused sidebar tests, the current 92-page docs check and VitePress build pass. Before topic redistribution, preview03 visits all 11 public top menus, then five CAD React sidebar links: 16 raw checkpoints cover six current editorial routes. All 12 component links are visible. Thirteen unchanged pages retain exact-byte eligibility from earlier route proofs; they are not claimed as fresh navigation. Root reviews all 16 images and verifies 3382 wrapper/3383 runner source pins through cleanup. Owned preview PID 41262 exits after SIGTERM, the port closes, and browser context cleanup passes. Errors, external requests and downloads are zero. Preview01 remains the historical unified-sidebar proof; editorial preview02 was superseded without execution. These earlier docs receipts remain separate from native/Worker proof.

The owner then requested topic navigation within each category. Current preview04 visits all 10 public top menus, all 26 moved topic links and the overview: 37 raw checkpoints. Root independently compares every raw sidebar href multiset and the single active menu against canonical ownership, and views 14 representative images. All 3389 wrapper/3390 runner pins remain exact through cleanup and root review. Owned preview PID 69115 exits via SIGTERM; the port, context and browser close. Errors, downloads and external requests are zero. The 94 prior Markdown inputs remain byte-exact; that input count is distinct from the 92 registered site pages.

Checks06 originally passed six tests and failed one because the new checker stripped fragment anchors before duplicate detection. The correction preserves full href identity and strips fragments only for route matching. It removes no document or link. All seven tests depend on the changed helper and pass in checks07; previously unrun check/build/diff also pass. Original failure and superseded source-only checks05 remain preserved. No product or native baseline is repeated.

D501 remains PARTIAL with runner and irrecoverable aggregate-receipt custody FAIL. D502 qualifies only the no-row Tapped availability/Cancel boundary; positive M6 lifecycle remains NOT_RUN. Main D503 C3 measurement passes 6/6 groups and its final High saved audit; publication follows this item. All core NOT_MEASURED status, legacy 43 frozen measurements, HOLDs and deferred PDF investigation remain. No mobile, download,dependency installation, full SDK/FaceUV/async/standards/release or deployment claim follows.

## Immutable receipts

- `checks`: `/tmp/barocss-d499-checks02/receipt.json`, SHA256 `d04368f7c97af8c2a30daa75609122e070c915cd155aaf56a783027cfeb150d1`.
- `browser`: `/tmp/barocss-d499-gui-run01/browser.receipt.json`, SHA256 `eab517d44c82223ca6e1c6462b0b28a9ab892bcddb07a44dde9346055fbd3416`.
- `native`: `/tmp/barocss-d499-native-run01/receipt.json`, SHA256 `bac28f62524dc71946397c93de26bd3684f6b31a9d257cf1385db8b7cfef180e`.
- `studio`: `/tmp/barocss-d499-studio-run01/receipt.json`, SHA256 `2dce366a7ceaa327303f7f754db705869e0794607fabd7951e432b85c0725abe`.
- `rootGUIReview`: `/tmp/barocss-d499-root/gui-actual01-review.json`, SHA256 `0938cff51585c4feab328d3080793a34b5aaeb8ecd46240a7cacb33167d8b7c5`.
- `rootStudioReview`: `/tmp/barocss-d499-root/studio-actual01-review.json`, SHA256 `317262ab47e9b06a40ae1db9369009d7c86a006b36558cc7dae6b167ea45a8c9`.
- `highFinal`: `/tmp/barocss-d499-high-final01/review.json`, SHA256 `eb1305b89208b3016fc20aa218dff91885d48e21976d80b0fe4806459016b509`.
- `highManifest`: `/tmp/barocss-d499-high-final01/manifest.json`, SHA256 `6302a06bcd7684b01a030d505eeb054c4d97a0d5f58ec6a27de60dde37f09a4e`.
- `sourceApproval`: `/tmp/barocss-d499-source-review01/review.json`, SHA256 `f69b62cd92e40e501c675a26b312341055764307186d0e0cdea88f84517053cc`.
- `geometryManifest`: `/tmp/barocss-d499-geometry01/manifest.json`, SHA256 `9cdcf5ef92b292c6133c403ee966ef952675bbef698e76b71a92366984f27223`.

- `docsChecks03`: `/tmp/barocss-d499-docs-checks03/receipt.json`, SHA256 `4c4d954208e9f1f690417468dfacc2bb0a658b0d226cd6e7c9401c319028dcc0`.

- `docsChecks04`: `/tmp/barocss-d499-docs-checks04/receipt.json`, SHA256 `ba5eecb86d295315cb5a3ecc00fca5c3c488563ceb78b1aaa183577dae2bc5b2`.

- `docsPreview03`: `/tmp/barocss-d499-docs-preview-run03/receipt.json`, SHA256 `8180ecd2d9868cb12b50f42f779b59c44c1dd1f9edf0823f310add8cc50c2d32`.

- `rootDocsReview03`: `/tmp/barocss-d499-root/docs-preview03-review.json`, SHA256 `0085a803b6e55103b0d7041b1d00a63b8381e0f1cb55405f9ca969fba2790734`.

- `docsChecks06PreservedFail`: `/tmp/barocss-d499-docs-checks06/receipt.json`, SHA256 `488888b03a85750a4aecaa3cfba84853d56cac4b2fdf09416874fecaede8758e`.

- `docsChecks07`: `/tmp/barocss-d499-docs-checks07/receipt.json`, SHA256 `bab40fa980b434d087f9a24278260c0431cbb756ed6d016298704b59d981bd4c`.

- `docsPreview04`: `/tmp/barocss-d499-docs-preview-run04/receipt.json`, SHA256 `68f0fe4210adcaa9d74260c97ceb4a60811593944e13d5dc1de5f245d345872e`.

- `rootDocsReview04`: `/tmp/barocss-d499-root/docs-preview04-review.json`, SHA256 `05f63a2f8ea1c2737d9ebfebda98939bb8eb24f240c122f2cb9f9c2247808d06`.
