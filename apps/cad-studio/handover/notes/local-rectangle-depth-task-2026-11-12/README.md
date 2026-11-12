# D777 — Edit rectangle depth in a local worker run

P1 and AI automation, rows 04, 09, 16 and 29. FULL interface qualification. The task reads one stated exact local Y check on a plain rectangular sketch and changes only its maximum Y coordinate. The minimum corner, X extent and extrusion stay fixed. Passing X and Z tolerances do not block a failing Y target. Two failing axes, holes and unsupported sketch metadata are outside this task scope.

| Result | Check |
| --- | --- |
| PASS | CLI and Studio chat agree on p1/n0 depth 10 → 14 mm and p2/n1 height 3 → 4 mm. The Studio preview shows +400 mm³. The first checkpoint shows the depth check changing from Fail · 10 mm to Pass · 14 mm. |
| PASS | Two explicit terminal approvals and a sibling rebuild deliver placed dimensions of 20 × 14 × 5 mm and 12 × 8 × 4 mm. An independent Python prism calculation confirms native volumes of 1,400 and 384 mm³ and local centroids of (10, 4, 2.5) and (6, 4, 2) mm at absolute tolerance 1e-8. |
| PASS | Studio saves a separate native project document and reopens it after a reload. In-place feature editing changes depth from 14 to 15 mm. The original project file, the saved approval, the sibling and the durable run stay exact. |
| PASS | The current width workflow still delivers 24 × 10 × 5 mm and opens the historical D622 height checkpoint. Both desktop runs report zero unexpected page errors or downloads. |
| PASS | Model 21/21 and Studio 20/20 focused tests, both type checks, two independent interface audits and two isolated mutation overlays. Explicit CLI config accepts `depthsMm` and refuses the wrong map. Candidate and checkpoint readers refuse a rechecksummed width scope. Working repair offers a depth correction after the protected sibling passes. |
| FAIL, first checks | The first Model type check caught the intentionally invalid mixed submission without a test cast. Studio type check caught the missing Depth label in candidate review. The first CLI test tried to prepare repair while the protected sibling still failed. The final tests verify that refusal and retry with a passing sibling. |
| NOT_RUN | Full suites, live LLM providers, mobile, other profile families and multi-axis writes. |

[Commands and receipt digests](qualification.json). The local chat fixture uses the actual Studio chat, stdio MCP and native worker paths. Initial scenarios remain 8/10 and B09 v1 remains 9/9. Whole CAD and core readiness are **NOT_MEASURED**. [#2402](https://github.com/barocss/barocss/issues/2402) remains open for broader acceptance.
