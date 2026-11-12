# D879 — Verify two-point circles on axial and tilted working planes

P1, rows 07, 09 and 16. SMALL. D878 supplies the Circle input and the XY qualification. D879 uses the same tool on three non-default planes. The only product change hides the live pointer snap mark once both circumference points are accepted. The two accepted points, numbered candidate circles and ordinary drawing snaps remain available in their respective stages.

| Result | Check |
| --- | --- |
| FAIL | Before the repair, moving the pointer after both off-grid points were accepted showed a live Middle snap over the label for circle 2 on the tilted preview. |
| PASS | Studio showed the End snap while picking and both numbered candidates after the second pick. The final zoomed preview kept the candidate labels clear. Changing the working plane and starting New part removed the pending candidates. |
| PASS | XZ at offset 7 mm used the exact-diameter R3 candidate. The 2 mm Extrude produced 18π mm³ at world centroid (23, −8, 20) mm. YZ at offset 3 mm used the selected R5 candidate and produced 50π mm³ at (4, 23, 24) mm. |
| PASS | On the translated +30° XY plane, the same clicks snapped to (20, 20) and (25, 20) mm while the construction was hidden, then to (20.25, 20.25) and (25.25, 20.25) mm when shown. The selected R4 center was (22.75, 20.25 + √39/2) mm in the sketch plane. Desktop DPR 1 and 2 produced identical native documents with the original construction rectangle and distinct side IDs. |
| PASS | Native reads matched the outward cap normals and axial stations, cylindrical radius and axis line, radial vertices, volume and centroid within 1e-7 in the respective units. Tilted volume was 32π mm³ at world centroid (22.75, 24.241177883232872, −4.75804626932409) mm. The 1,180-byte OPFS Save and exact fresh File Open retained the same shape and native properties. |
| PASS | Independent world-frame review, 7 focused Studio tests, Studio type-check, scoped lint, syntax and diff check. The updated XY driver passed before the snap-mark repair. The final plane run held 835 source inputs through cleanup and recorded 11 states. |
| NOT_RUN | Full suites, production build for this small repair and mobile. |

[D878](../circle-from-two-points-2026-11-13/README.md) and D879 satisfy the bounded snapshot input in [#2318](https://github.com/barocss/barocss/issues/2318). D878 supplies both XY choices, exact and decimal input, refusal and cancellation, and ordinary re-edit after fresh Open. D879 supplies axial and tilted planes, exact-diameter acceptance, current construction snaps and display-scale parity. The selected ordinary Circle uses the existing file format. Initial scenarios remain **8/10**. Whole CAD and core readiness remain **NOT_MEASURED**. [Commands and receipt digests](qualification.json).
