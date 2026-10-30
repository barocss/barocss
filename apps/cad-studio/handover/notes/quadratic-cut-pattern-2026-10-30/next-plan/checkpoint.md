# D347 Extend source-only checkpoint — STOPPED_BY_USER

Status: INCOMPLETE_READ_ONLY_PLAN. User steered the session to finish D346, merge develop and hand off to Claude. No D347 implementation, product edit, build, tests, CAD runtime, browser, benchmark or commit was performed. No new agent was spawned. This checkpoint does not qualify Extend or report a reproduced defect.

Inspected worktree: `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`, `local/cad-dev`. HEAD observed during read-only work: `24fb68ff4f96ae57550f8119a7e5da28d38a02d7`. Root's D346 source checkpoint `aed4d1535` plus App correction `24fb68ff4` is qualified separately. Do not treat this observation as the final publication/merge ref; root owns that receipt.

## Confirmed source facts

- `packages/barocss-cad-model/src/engine/direct.ts:303–319`: existing public Model `directOps.extendSurface(d,id,edge,distance)` supports u-min/u-max/v-min/v-max. It is already wired; no missing Extend engine or facade is established. Distance is documented in physical mm, not domain parameter units. It samples12 original rows and4 extrapolated rows,16 across, obtains a unit tangent by finite difference at1e-3 of the selected parameter span, refits a bicubic with `interpolateSurfacePlain`, then adds a new source/object and hides the original.
- `direct.ts:82–96`: wholeSurfaceOf calls the existing trim guard before sampling. Nonempty or malformed trim containers refuse with DIRECT_VALUE; empty trims mean whole support. D336 evidence should be reused rather than relabeled missing.
- `direct.ts:109–120`: add retains original source text/object but hides its source object; refine changes source while retaining object identity. Extend produces an owned derived raw source, not an editable reach feature recipe. Its later pole edits/rename/source replacement are the existing edit path.
- `apps/cad-studio/src/ui/DirectPanel.tsx:145–174`: real Edge/Extend by fields and Extend button exist. NumberField only reports finite inputs (`:88–94`). `run` catches operation failures before onChange (`:27–32`) and selects newly added objects. There is no Part solid extend verb that needs to be added to qualify this existing direct surface consumer.
- `apps/cad-studio/src/ui/DirectInspector.tsx:15–21` routes the real action to central commitDirect. `App.tsx:840–854` performs route checks/candidate handling before pushUndo/setDoc; source/result selection is recorded there. Actual atomicity/Undo/file behavior still needs execution.
- `packages/barocss-cad/src/features/fit-plain.ts:1–9,35–74,104–113`: the current fitting producer explicitly says UNCERTIFIED. It uses averaged chord parameters, averaged knots, Gaussian elimination and tensor curve interpolation. No global source-preservation certificate is returned. This is a risk boundary, not proof of wrong output for a chosen plane.
- `packages/barocss-cad-model/src/engine/curveSource.ts:83–96`: surfacesSource rounds generated knots/poles/weights to9 decimal places. This can matter for very small extensions or clustered knots, but no current-input failure was executed.
- Existing positive test `packages/barocss-cad-model/test/fit.test.ts:37–40` checks a unit-domain integer plane's far corner[25,0,0] within1e-6 and original hidden state. It does not establish nonunit-domain original-support preservation, all edges, complete boundaries or a Studio/native-file flow.
- `direct.ts:514–565`: directDisplay draws the visible raw support and catches evaluation failures by omitting objects. Positive product qualification must require the actual selected surface mesh to be present/nonempty/finite, not merely successful object insertion or a visible witness.
- Existing public authoring route exists: Studio Open accepts .barocad sources (`App.tsx:1419–1442,1985,1999`; `src/files/importedFile.ts:88–93` imports authored source). No author hook or new UI is needed.
- Adopted research mapping explicitly says “No generic surface/B-rep replacement project”: `apps/cad-studio/handover/notes/github-research-roadmap-2026-10-29.md:132`. Root should record the original replace interpretation rather than silently dropping a named requirement. Existing retained-ID direct source edits already have separate D346 evidence.

## Candidate minimum functional qualification (NOT_RUN)

Use a publicly authored, untrimmed affine bilinear plane with nonunit domains and an oblique world frame:

```
@model d347 { version:0; length-unit:mm;
 @surface #panel { type:nurbs; degree-u:1; degree-v:1;
  knots-u:[2,2,5,5]; knots-v:[-1,-1,3,3];
  control-points:[[[7,-11,13],[7,-11,21]],[[16,1,13],[16,1,21]]];
  weights:[[1,1],[1,1]]; }
}
```

Analytic source (hand-derived, not executed): A=[7,-11,13], U=[3,4,0], V=[0,0,2], S(u,v)=A+(u-2)U+(v+1)V. |U|=5, |V|=2, plane4x-3y=61, normal[.8,-.6,0]. Original physical side lengths15 and8, area120, centroid[11.5,-5,17].

Reach2.5 is physical: u reach corresponds to original parameter increment0.5; v reach corresponds to1.25. Normalized result-domain analytic rectangles:

| Edge | Expected normalized T(s,t), s,t∈[0,1] | Area | Surface centroid |
|---|---|---:|---|
| u-max | A+3.5sU+4tV | 140 | [12.25,-4,17] |
| u-min | A-0.5U+3.5sU+4tV | 140 | [10.75,-6,17] |
| v-max | A+3sU+5.25tV | 157.5 | [11.5,-5,18.25] |
| v-min | A-1.25V+3sU+5.25tV | 157.5 | [11.5,-5,15.75] |

Preservation concerns physical support, not unchanged UV values: the refit reparameterizes its output. For u-max the old patch occupies s∈[0,6/7]; for u-min s∈[1/7,1]. For v-max the old patch occupies t∈[0,16/21]; for v-min t∈[5/21,1]. These maps are exact rational invariants for this fixture.

A strong independent oracle can decode stored binary64 coefficients as exact rationals. For an all-weight1 B-spline, compare every final control pole to the expected affine T at that pole's actual-knot Greville abscissae. Partition of unity gives a global position bound from the maximum pole L1 residual; require it within the existing1e-7 policy. Independently derive derivative control nets and bound errors against constant T_s,T_t. Positive projected Jacobian follows if |T_s×T_t| minus the derivative-error cross-product bound remains strictly positive. This would cover the complete original support and extended rectangle, not only sampled corners. This oracle is a proposal, NOT implemented or run.

For example u extension has |T_s|17.5, |T_t|8 and signed area Jacobian140. If derivative L1 residual bounds are e_s,e_t, a lower projected Jacobian bound is140-8e_s-17.5e_t-e_s*e_t. No tolerance increase, arbitrary sliver floor, generic embedding claim, curved global fit claim or solid mass claim is intended.

## Required next steps if this work is resumed

1. Re-pin the final published/merged source before a scoped immutable pre-fix runtime probe. Do not reuse the observed D346 checkpoint as final publication automatically.
2. Run the existing public Model Extend on the authored fixture for all4 edges/reach2.5, compare original support and extended boundaries against the independent analytic oracle; retain raw original/result sources/domains/coefficients and all failures before choosing any product repair.
3. Confirm output is valid native surface data, original source/object unchanged except hidden state, new ID/name/source ownership distinct, rendered surface nonempty/finite and retry/Undo/file semantics correct.
4. Include existing trim/malformed-trim refusal and zero/negative distance atomic controls. Out-of-union edge strings/nonfinite SDK numbers and tiny positive reach are source-only risk candidates; no defect claim is made here. Current finite-difference/global refit/9-digit serialization may refuse or lose representation; classify the actual first failure rather than assuming wrong success.
5. Actual Studio: Open authored .barocad → select panel → Edge/Extend by → Extend → inspect source hidden/result selected and visible filled surface → Undo/Redo → rename or edit one result pole using retained result ID → Undo → native Save/fresh Open → read actual source geometry and repeat checks. Reach is not currently an editable stored recipe; do not imply that editing a transient input retroactively recomputes the accepted result.
6. Only if the baseline demonstrates an admitted wrong success, choose a bounded consumer repair using current native authority; do not start a generic B-rep/trim replacement engine or change Core fitting/tolerances based on risk alone. If positive qualification passes, the smallest D347 may be tests/actual-product evidence only, with existing code retained.

Ownership suggestion for a resumed qualification: Sol High numerical/source judgment and independent oracle, Sol Medium Model regression/browser integration under root coordination. No ownership or runtime grant is active after this STOP checkpoint.
