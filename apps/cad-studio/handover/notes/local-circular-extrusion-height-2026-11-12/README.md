# D778 — Edit circular extrusion height in a local worker run

P1 and AI automation, rows 04, 09, 16 and 29. FULL interface qualification. The existing height task accepts one plain circular sketch and a straight literal extrusion from local Z zero. The task preserves the sketch centre, radius and optional authored side tag. A Cylinder command's retained height follows its actual extrusion. Circular hard extent checks cover local Z. Other circle edits and hard radial or local X/Y requirements are outside this scope.

| Result | Check |
| --- | --- |
| PASS | CLI and Studio chat agree on 5 → 6 mm for the tagged circular extrusion and 3 → 4 mm for the Cylinder command sibling. Studio reviews and explicitly approves both, rebuilds the stale sibling, and reads both exact checkpoints. |
| PASS | Native project Save and fresh Open keep both approved heights and the original project bytes. Studio shows the updated sibling history label `Cylinder Ø6×4`. The tagged cylinder's own feature editor changes 6 → 7 mm. The saved approval and durable run stay exact. |
| PASS | A direct strict B-rep read verifies one body, one shell, two caps and both pieces of the tagged wall. The independent Python check confirms radius 4.23 mm, centre (3.07, −7.13) mm, height 6 and 7 mm, volumes 337.2732191485009 and 393.4854223399177 mm³, and centroid Z 3 and 3.5 mm. The comparison uses an absolute tolerance of 1e-8. |
| PASS | Actual Studio delivers the existing rectangle width task and opens the historical D622 height checkpoint. Both current browser runs have zero unexpected errors or downloads. |
| PASS | Model 24/24 and Studio 18/18 focused tests, both type checks, two independent audits and two mutation overlays. Controls cover invalid native radius, lost wall identity, parameter-bound radius, malformed tags, unrepresentable centre and unsupported hard X checks. |
| FAIL, first checks | Baseline rejected the circular profile. Initial test controls also applied the evaluator mutation to a rectangular sibling, reused a consumed approval and passed a `Dim` tuple where numeric sketch input was required. The first actual run approved and reopened both parts, then its independent checker assumed one wall face. The final checker measures both wall pieces. |
| NOT_RUN | Full suites, live LLM providers, mobile, rotated or drafted circular profiles, holes in circles, and positive radial or local X/Y check workflows. |

[Commands and receipt digests](qualification.json). The workflow uses the existing height wire fields and explicit approvals. Initial scenarios remain 8/10 and B09 v1 remains 9/9. Whole CAD and core readiness are **NOT_MEASURED**. [#2402](https://github.com/barocss/barocss/issues/2402) remains open for broader acceptance.
