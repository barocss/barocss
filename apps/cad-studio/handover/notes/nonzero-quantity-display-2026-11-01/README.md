---
work_id: D425
artifact_type: nonzero-quantity-display-qualification
status: qualified-bounded-display-only
owner_role: executor
source_request: "Continue the roadmap and report the row and overall progress"
last_updated: 2026-11-01
---

# Nonzero body quantities — bounded display qualification

D425 fixes reproduced zero labels on rows 15 and 16. Overall progress remains about 43%. Studio Body/Part values and the STEP summary now show finite nonzero quantities in three-significant-digit scientific notation when the existing rounded text would be zero. [Counts, commands, hashes and limits](qualification.json).

The Studio-local helper receives both the raw quantity and its existing display text. This preserves ordinary rounding, negative ties, grouping and units. Exact positive/negative zero displays as zero. Body/Part mass, body volume/area, mesh-volume bound and available mesh dimensions use the fallback. Area is evaluated once per body. Shared Model formatting, source quantities, unit conversion, schema, centroid and existing inertia presentation remain unchanged. Other Studio/assembly/legend quantity surfaces remain outside this bounded item.

Focused checks pass 23 unique tests: 18 existing import-ownership tests and five new quantity tests. After the last two review changes, only the five affected tests run again; the count is not 28. The tests cover tiny signed/subnormal values, zero, ordinary text, React body/part rendering and immutable source fields. The STEP handler test uses a transport stub and is not geometry proof. Final Studio/Model types, scoped lint, driver syntax and diff checks pass. This is small-tier work with no independent audit or kernel rerun; compatible D424 kernel proof is reused.

One actual Studio run passes four states. The ordinary Bracket retains 15982 mm³, 43.2 g, 5733 mm² and 64 × 32 × 8. Both original STEP inputs show 4.19e-9 mm³, 1.13e-11 g and 1.26e-5 mm², with matching Part mass and STEP totals. Their raw volume, mass, area, centroid and inertia exactly match D424. A centered control changes only its STEP unit declaration to metres. The genuine product creates exactly one factor-1000 scale node and adopts radius-1 geometry: volume 4.188790204883532 mm³, shown as 4 mm³; mass 0.011309733553185538 g, shown as 1.13e-2 g; area shown as 13 mm². The existing conversion is applied once.

All four documents stay unchanged during inspection. All 747 source hashes match before, after and after cleanup. Page/console errors, worktree changes and downloads are zero; four contexts, browser and server close. Root reviews all four screenshots and confirms the right-dock labels fit. No tiny-shape visibility or GPU precision acceptance follows.

The far fixture reveals a separate accuracy defect: genuine Float32 display-mesh bounds have identical min/max [999000, -998000, 997000], giving [0, 0, 0] extents. The UI faithfully retains those zeros. Centered mesh extents remain nonzero and display scientifically. D424 captured only the zero bounds label; its original receipt did not establish raw bounds or their cause. This new observation distinguishes actual collapsed bounds from numeric text rounding. D426 traces that producer/consumer precision boundary before further exchange admission. No synthetic native-bound replacement or geometry fix is included here.

Logs, screenshots and raw fixtures stay under /tmp. The historical D423 full-run failure remains unexplained and unchanged; D424 current full-suite PASS does not erase it. OCP remains removed. No dependency, further develop integration or release follows.
