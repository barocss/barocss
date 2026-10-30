# D321 actual Studio Stop work ownership

Final scoped result: selected D321 browser case **1 PASS / 0 FAIL / 0 SKIP**, plus its separate starter smoke PASS.
The changed-App D318 selected integration regression also passes **1 / 0 / 0**, plus its own separate starter smoke.
These are two selected browser cases, not four product cases or a full browser suite. Node22.19.0, actual Chrome156
WebGPU and DPR1 use the existing current-worktree Studio harness. Final syntax checks pass; changed-harness lint
exits0 with45 existing no-console warnings and no errors. Browser/server/owned fresh contexts and gates are closed.

The final actual App source is `fe99a2a25719148774ee15e69c9493c743c3e88226289cf1dcb89333a3149a1b`; the pure owner
helper is `d95db66ed196df304ce29d2b6d497b589eca361160812cb5cbca30da376f6ed8`. Exact App/helper/client/browser-flow/
native-hold source gzip files and source/gzip hashes were captured before third execution and independently copied
before D318. All source hashes still match; both successful profiles are identical. No production source is edited
by this consumer lane.

## Actual UI ownership and native scheduling

The real UI creates Box D0 (two nodes, one body,1000mm³), then applies a second Box D1. The test-only init script
uses real NativeWorker construction/source, original postMessage/transfers, native result and deferred mass
MessageEvents. It holds those events FIFO before EngineClient delivery. There is no App stage/document/selection
setter, result replacement, replay or fake geometry. Only native event-delivery scheduling and inspection are
controlled. Old termination discards the held events. The original audit `.omx` files remain read-only.

D1's actual native result is received44.8ms after submission; it is held for another3294.4ms until Stop. These are
native event receipt/scheduling intervals, not isolated kernel CPU measurements or natural slow work. During that
hold, Top camera and Model/Render/Drawing workspace changes remain usable. Two real Grid clicks and a real Drawing
Sheet size change each show the exact pending-computation refusal. D1's complete document and finished recovery
copy remain unchanged, dirty stays true, and visible history is compared within each workspace and after returning
to Model. Render intentionally hides the history strip; no hidden full Undo stack is inferred.

Real Stop restores exact D0, dirty true and a completed D0 recovery copy. The old Worker discards4 held messages,
including its real result/mass and additional Drawing requests; it delivers none after the claim. The new backend
submits D0's two node IDs on epoch2/request11/revision9, receives a real result and mass message, and reaches
`fresh:true`, `massReady:true`, volume1000. Exact native provider identity and viewport pixel provenance are
NOT_EXPOSED. A pending state's `massReady:true` alone does not certify the new D1: its `fresh` remains false.

Public Redo now restores exact D1 with two fresh bodies and total volume2000. A normal Grid edit, Undo, Redo and
Undo retain the proper documents and issue no additional main evaluate request (count6 before and6 after).
The second actual case holds a third Box without independent Render editing: normal Stop restores D1, Redo restores
the third Box and Undo returns D1. Its result arrives48.6ms after submission, then remains client-held1487.7ms;
termination discards its real2 messages with no delivery/replay. A further **unarmed** normal12×10×10 Box applies
successfully (three fresh bodies,total3200), then Undo restores exact D1/2000. This checks no permanent edit lock.
Raw states, complete recovery text, worker/source/epoch metadata and timing remain in `third-run/d321-states.json`.

## Changed-App skeleton integration regression

`regression/d318/` is a new run on the same final source, not an acknowledgement rerun on unchanged App conditions.
Its native hold helper is not installed: only the D318 callback executes. Real single-point/zero-segment Apply and
Save open in a fresh browser context; real constrained polyline Save is used with two authored frame followers in
a second fresh context. Re-edit retains stable IDs and all raw follower fields. Independent areas36/76 and lengths
40+20 ->50+20 give6720 ->7840mm³ across four fresh bodies. Real Undo/Redo and Save/New/Open retain the accepted
semantic document. Downloaded bytes are preserved unmodified as artifacts; raw byte identity between different
saves is not asserted. Original earlier D318 evidence is not overwritten. The consumer
inspected the four regression PNGs; the zero-body single point is not a visible-solid claim.

The consumer inspected the three meaningful D321 PNGs and four D318 regression PNGs. The parent also directly
reviewed the D321 three images. Those images show real UI; exact viewport geometry-source provenance remains
NOT_EXPOSED. `third-run/` and `regression/d318/` preserve the source capsules, actual PNGs, raw records and files.

## Failed profiles stay distinct

1. First App `b862...`: the test incorrectly compared visible Model history text with intentionally hidden Render
   history DOM. Grid refusal and D1 document/recovery were already observed, but the full selected case failed.
   `browser-first-failure.txt` preserves the exact output. The comparison was repaired within workspaces and a
   Model-return assertion was added. **The exact first full browser-driver source was not retained.** No invented
   reconstruction or exact full-replay claim is made. The High lane separately preserved exact b862 App gzip/hash.
2. Second App `09e402...`: Grid twice, Drawing refusal, owned Stop D0/recovery and new-epoch fresh evaluation pass,
   then public Redo fails to restore D1. This is a **confirmed product regression**, not a fixture problem. The
   functional Redo updater read mutable `docNow.current` after it had been assigned D0. High fixed production to
   synchronously capture `redoEntry`. Exact original logs, PNG, trace and source capsules remain in `second-run/`.
   Raw after-Redo state was not captured in that run; the last raw snapshot is StopD0, with failure log/PNG afterward.
   The next driver additionally records a readiness-failure snapshot before rethrowing the same error. The original
   Doc/Redo/mass/epoch assertions remain; no acceptance threshold was weakened for the final PASS.

The inactive completed-run Stop noop guard is in the final source, but the exact late completed-click race is
NOT_RUN. Async image completion, initial/variant/parameter candidate cases, all Undo/New/Open invalidations,
repair-stage Stop, natural slow scheduling, other browsers/DPR and the full browser flow are NOT_RUN. Pure-helper
unit coverage is separate and is not used to claim these App execution paths. Full Undo depth and exact provider/
viewport provenance remain NOT_EXPOSED. No commit or push is made by this lane. `report.json`, `cleanup.json` and
`artifact-manifest.json` preserve the precise scope and artifact hashes.
