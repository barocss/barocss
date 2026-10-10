# CAD Editor limits and cleanup

## Native and display profiles

The canonical document has 1–4 Source0 assets and 1–16 asset-qualified direct geometry bodies. Native object IDs may repeat across different assets. Source0 native inventory retains original degrees 1–5, knots, weights, coordinates and signed zero. File limit is 2 MiB; one source is at most 262144 bytes/code units and aggregate source at most 1 MiB.

Surface pole editing has narrower selected coefficients: degree 1–3, 2–16 axes/at most 256 poles, coordinates within ±10000 mm and weights 1e-6–1e6. Curve editing uses the complete-source writer under its declared native bounds and matching focus view. Unsupported selected bindings stay read-only. An earlier README support paragraph calls Curves read-only; the later original-Curve section and public session declarations describe the added capability.

The displayed document subset is 1–4 bodies. Curve focus has its own source/object/sample limits; broader native inventory does not establish broad simultaneous rendering. Raw fields have at most 128 characters. History stores at most 20 states and 8 MiB of serialized UTF-8 data.

## Errors and action

`CadEditorError.code` is `INPUT`, `UNSUPPORTED`, `BUDGET`, `STALE`, `NATIVE`, `DISPLAY`, `FILE`, `REVISION` or `LIFECYCLE`. Correct fields or supported scope for input/native errors. Re-select or re-prepare stale references/tokens. Keep accepted state on display/file refusal and report actual restoration failure. A started download means download initiation, not durable save.

Unmount releases component-owned Viewer/listeners and keeps caller CPU data. Dispose the session on document close. Snapshots/candidates are copied and cannot rewrite private prepared results. Runtime tokens, camera, raw fields, display caches and history are not serialized as native authority.

No general solids/topology, manufacturing tolerance, unrestricted source binding, global precision/device recovery or publication is established by this checkpoint.

`packages/barocss-cad-editor/package.json` (Manifest and version; local source) · `packages/barocss-cad-editor/README.md` (Package task notes; local source)
