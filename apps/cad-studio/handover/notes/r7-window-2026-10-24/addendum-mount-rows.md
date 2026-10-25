---
work_id: cad-r7-mount-row-addendum-20261025
artifact_type: migration-contract
status: assigned
owner_role: CAD Coordinator
source_request: Continue the fixed-base consumer migration; resolve the Docs-to-Outer mount-field dependency
last_updated: 2026-10-25
---

# Mount-row additions to the fixed R7 contract

The common base remains `c9cd4a8caa98b51570e7e02aaa94d637a523061d`. This is an additive contract, not a rewrite of that base. Product R7 and P2 adoption stay HOLD.

The 354-row kernel survey did not contain six model-owned mount fields. The canonical names below complete this owned boundary. Values, units, ranges, limits, supplied source records and estimate/unchecked status are unchanged. No aliases or new rows are allowed.

| Old field | Canonical field | Meaning and unchanged unit |
|---|---|---|
| `pilotMM` | `pilot` | Register diameter, mm |
| `pilotDepthMM` | `pilotDepth` | Register projection/depth from the mounting face, mm |
| `holes.pcdMM` | `holes.pcd` | Hole pitch-circle diameter, mm |
| `shaftOffsetMM` | `shaftOffset` | `[along, across]` offset from the pattern centre, mm |
| `shaftHeightMM` | `shaftHeight` | Shaft axis above the mounting face, mm |
| `bodyMM` | `body` | Servo body cut-out `[along, across]` sizes, mm; this is not a B-rep body |

This follows the existing no-unit-suffix vocabulary alongside `shaft`, `clearance`, `holes.spacing`, `holes.diameter` and `holes.start` (degrees). Context and the row types make the quantities explicit; do not reinterpret a diameter as a radius or the two body sizes as a point.

Outer owns `engine/mountRows.ts`, callers, validators, metadata keys, person-supplied/sample row representations and matching mount tests. Update MOUNT_FIELDS, fieldSources and unchecked keys together so provenance is preserved. Keep numeric contents and all established rejection limits exactly. Legacy keys must not silently default; retain typed refusals, stable codes and list any field-label text differences in the receipt. Do not promote existing estimated/unchecked data to verified source data.

Docs owns the mount descriptions/examples in apps/library-docs. Apply these exact names after reading this contract and keep the declared field units. An owned mount-contract fixture may be checked independently; the assembled matching consumer checks must qualify the actual validator before product promotion.

Outer must also satisfy the already agreed BodyResult.volume, bodyMass().mass, DisplayFace.area and free-function reevaluate consumers. API and Docs must retain and report foreign-core failures until those actual changes are in the isolated assembled aggregate. No individual partial proof or WIP commit qualifies the product.
