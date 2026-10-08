# Marker sidecar checkpoint (#677)

Parent commit: `4fc31194ade76df5d11af678b35adf68a30472f5`.

Scope: `packages/barocss-motion/**` and `examples/motion-scene/**` only. The `.baromotion` codec and timeline event rules remain unchanged. Public additions are `serializeMotionMarkerFile`, `parseMotionMarkerFile`, and `MotionMarkerFileError` (`INVALID_INPUT`, `FILE_LIMIT`, `INVALID_JSON`, `UNSUPPORTED_FORMAT`, `INCOMPATIBLE_CLIP`, `INVALID_MARKER`).

The exact sidecar envelope has six fields in canonical order: `format`, `version`, `timeUnit`, `contextId`, `durationSeconds`, `markers`. Each marker has required `contextId`, `id`, `timeSeconds` and optional `label`, `targetId`. Bounds: 262144 UTF-8 bytes, depth 12, 16384 visited value/member-name tokens, 256 markers, 256 decoded UTF-16 string units, and 1538 raw string units including quotes. The old timeline marker limits also apply.

Commands and results:

```text
PATH=/Users/user/.nvm/versions/node/v22.22.0/bin:/Users/user/.barocss-ai/v3/integration/node_modules/.bin:$PATH pnpm --filter @barocss/motion build:library
exit 0; tsc and esbuild complete

/Users/user/.nvm/versions/node/v22.22.0/bin/node examples/motion-scene/marker-file-probe.mjs
exit 0; real 495-byte .baromarkers asset reopened; separate real 256-byte ASCII label file reopened; signed-zero marker retained; midpoint mid-a/mid-b and repeat seam end/start in authored order; getter count 0; wrong context/duration/target, decoded duplicate member, version, oversized file, sparse/foreign/hidden/cyclic inputs refused without changing the live timeline
```

Browser: repository-root server on `127.0.0.1:52159`, existing `timeline-demo.html`, headed Playwright Chromium. The scene loaded the real clip and sidecar. Save produced a browser download event for `two-parts.baromarkers`; the saved 495 bytes matched the asset (`cmp` exit 0). Open of the valid asset kept time 2 seconds and the selected mode, paused playback, and cleared the marker log. Open of a wrong-context file reported `INCOMPATIBLE_CLIP` and retained the frame, log, and accepted filename/byte count. Console errors and warnings: 0. [Captured page](marker-file-open.png) shows the retained frame and refusal message.

The browser test observed the download event and saved bytes. It did not verify delivery to a user's downloads folder.
