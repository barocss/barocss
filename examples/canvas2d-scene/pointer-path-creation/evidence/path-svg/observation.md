# #1566 cloud continuation: implementation; actual browser acceptance pending

The selected-path button/facade calls the existing `exportSceneSVG` provider. It validates the current authored profile and direct Parent membership, then exports a detached Scene/Parent copy containing only the selected path. It preserves authored Parent pose and path origin, excluding the host camera and unrelated unsupported Rect/Sprite nodes. Unsupported diagnostics remain complete in the existing `UNSUPPORTED_FEATURE` error message. UTF-8 output is bounded to 96 KiB before Blob/URL creation. The MIME is `image/svg+xml`; the filename is `selected-<path-id>.svg`.

The method checks disposal first and returns false for missing selection or a pending gesture before copying/exporting. It uses the existing URL set and 1000 ms cleanup, detects stale generation/disposal after the timer, and changes neither Save/edit counts nor the Observe schema. JSON Save and prior producer code are unchanged.

## Provenance and limits

Actual immutable cloud parent: `3100cb8445c2834afc358e2590fd144152abd7d2`. Original native parent `cf95e1a901f1d78dc112ea1a8aed43cdc8558b62` remains the historical #1566 contract parent; that object is unavailable in this cloud repository. The original Issue and comment are frozen separately in `/workspace/shared/1566-cloud-evidence/frozen-contract.json`. This is an incremental cloud continuation, not a reconstructed native receipt.

The unchanged #1557 `evidence/path-cycle/document-snapshot.json` is the 3446-byte API-serialization input. It is not a genuine Save/download. No prior producer is replayed. No prior proof, source input, screenshot, exporter/importer or provider is changed.

The deterministic source-function probe uses the real pre-existing exporter with mocked DOM, profile admission list, timers and URL facilities. It checks guard ordering, Parent-only export, namespace/IDs/commands/paint/transforms, whole Scene retention, unsupported diagnostics, byte bound and late stale/disposed cleanup. Its generated `api-only.svg` is not a browser download. Initial probe failures were a cross-realm validation mismatch and an incorrect expected historical seed paint; both were corrected in the probe without product changes and retained as first-failure logs.

The frozen actual flow still requires one physical Open of the historical seed, selection of Q1, a real SVG download, downloaded-byte inspection and independent transform evidence, complete Scene/frame/history/view/field/identity/asset retention, screenshot before no-selection guard and full resource terminal. Expected two GL contexts, 31 product callbacks and one created/revoked URL remain hypotheses until measured. SVG preview pixels and universal raster parity remain UNRUN. No genuine `exported.svg`, screenshot or passing browser receipt is manufactured here.

Cleanup debt #1451, held #1032, integrated acceptance #1254/#674 and release remain separate and pending.

## Actual cloud browser blocker

A normal Python HTTP server reported listening on `0.0.0.0:31566`, but the dedicated cloud browser tab 18 returned `net::ERR_CONNECTION_REFUSED` for `http://127.0.0.1:31566/`; a subsequent executor urllib request also refused. Only the owned server session 64660 was stopped (exit 130). No restricted-path access, security bypass, alternate escalation or user-computer route was attempted. Therefore physical Open, genuine download, screenshot, native resource counts and terminal acceptance remain UNRUN, rather than passed by the source/API probe.

## Focused cloud checks

- Node 22.23.3 syntax check and `git diff --check`: PASS
- Existing source host build (`node examples/canvas2d-scene/pointer-path-creation/flow.mjs --source /workspace/shared/1566-cloud-evidence/source-host`): PASS, 262932-byte bundle
- Existing scoped strict/checkJs types: PASS after supplying installed Node type roots and the pre-existing unchanged Canvas2D emitted declarations. The first attempts failed because this fresh worktree lacked Node type resolution and `dist/index.js`; those setup failures are retained. Canvas2D provider source is byte-identical between the actual cloud parent and the emitted-artifact checkout `ddcaf97e`; no provider rebuild or full workspace build is claimed
- Independent read-only source review: no concrete defects found in the frozen guards, copying, exporter use, limits, UI/facade, URL lifecycle or untouched Save/Observe counters
- Deterministic extracted-function/API probe: PASS with the mock limitations above

Commands, original setup/probe failures, source build, 98-file unchanged evidence inventory and blocker details are retained under `/workspace/shared/1566-cloud-evidence/`. Full builds are deferred; this receipt does not mark #1566's frozen actual acceptance complete.
