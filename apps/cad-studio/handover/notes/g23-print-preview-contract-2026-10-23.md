---
work_id: cad-review-continuation-20261022
artifact_type: cross-lane-contract
status: ready_for_build
owner_role: CAD Coordinator
source_request: Continue approved roadmap feature delivery through the existing CAD editor.
last_updated: 2026-10-23
---

# G23 print preview persistence

GPU source baseline: c70178b0dac41bfa7447e9f2b05c4e964a96b823, normal merge of integration 2ca863a315d09515a8f860f68ac92ce24cdde53d. Existing G22 candidate and evidence stay frozen.

Add optional StudioDoc.printPreview with version:1 and optional layer, layerMM, supports and printed. Keep existing print.direction unchanged. A preview-only save must not create print: existing consumers treat its presence as a given print direction. Missing layerMM must remain missing, so printLayers uses its estimated0.2 default. Do not promote default+Z to authored direction.

Model owns doc.ts, the existing read validation path in migrate.ts (or a narrow print validation module), and relevant save/read cases. Validate version1, nonnegative safe-integer layer, finite positive layerMM and boolean flags. Reject malformed fields explicitly. Preserve old documents and omission through JSON/BCAD SaveOpen. No new general writer or migration framework.

GPU owns display and existing commit/history/SaveOpen wiring. Clamp only the effective display layer when geometry changes the count; do not silently rewrite authored layer. Await the actual Model public type/API before typed durable wiring; do not use casts or localStorage as a substitute. Independent source display work continues.

Model first preserves its A9-11 execution checkpoint and cleanup. Then it implements this narrow dependency source-only from integration2ca863. No automatic execution-slot transfer. Source receipt must name exact SHA/API; coordinator reviews and adopts before GPU consumes. A9-7 remains queued afterward. No persistence or screen acceptance is claimed by this decision.
