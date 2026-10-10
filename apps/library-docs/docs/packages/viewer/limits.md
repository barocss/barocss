# Viewer limits and refusal recovery

## Profile limits

Legacy native Surface sampling uses integer counts 2–17 per axis. Preview Curve modes have explicit tolerance/segment/depth budgets. Display capacity is bounded by the selected profile, not by all native objects retained in source. Canonical native capacity and displayed body count are different.

Qualified Face scenes admit their supported independent source-owned profile; their sampled Float32 bounds are not exact Surface extrema, control-hull or B-Rep/Solid bounds. A screen sample's U/V is approximate. Its native XYZ is original evaluation at that chosen parameter, not a certified native ray hit.

The first fluid layer requires exactly 256 finite Float64 XYZ metre positions and one qualified Surface. The supported cloth adapter uses its fixed frame profile. Neither supports arbitrary particle/mesh counts or turns CAD preview geometry into an exact obstacle.

## Refusal handling

Keep accepted source/model/references distinct from proposed loads and sampled packets. Correct unknown/stale pins, hidden references, invalid cameras and incompatible modes before retrying. Recoverable presentation refusal and unavailable/context-lost presentation are distinct; do not mark new authoring accepted because a CPU candidate was prepared.

Control `onError` reports failed gestures/keys to the host. The host owns DOM pointer capture, focus, touch-action, pending URL cancellation and adapter disposal. Remove those resources on close. Retired Motion examples remain historical; pose APIs here do not imply an active package or clock.

No exact CAD picking, engineering dimension certificate, unrestricted materials, global precision, all-device recovery or publication is established by these pages.

`packages/barocss-viewer/package.json` (Manifest and version; local source) · `packages/barocss-viewer/README.md` (Package task notes; local source)
