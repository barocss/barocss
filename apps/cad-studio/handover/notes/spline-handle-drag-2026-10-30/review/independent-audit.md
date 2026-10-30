# D353 independent audit (claude-opus-5-5 sub-agent, 2026-10-30)

The audit read the uncommitted D353 tree on 841c0d44f and ran its own probes. Probes are in [../audit](../audit), mutants in [../audit/mut](../audit/mut). Raw outputs were not saved; the numbers below are the auditor's reported observations.

**Verdict: CHANGES_REQUIRED.**

## Holds

- **Angles:** −179.6° → 180, the back end at −180 → 180, and 0 of 3600 fine angles fell off the grid ([probe1.ts](../audit/probe1.ts)).
- **Hit testing:** handle ends take precedence and the handle length is exactly 30 px under rotated, flipped and zoomed projectors; a NaN projector returns null.
- **Snapping:** fit snapping equals `snap()`.
- **Kernel/settle:** no D352 F2/F3-class failures. [probe3.ts](../audit/probe3.ts) ran 30,498 fit drags and 9,360 handle drags; every case `splineEditError` accepted passed `respline` + `settleShape` with 0 refusals and 0 dropped splines. [probe2.ts](../audit/probe2.ts) ran 1,200 chained drags with 0 dropped.
- **Performance:** [probe4.ts](../audit/probe4.ts) measured a hover at 4–26 µs and a drag move at 5–38 µs for 6–60 fit points. Negligible.

## Findings and root disposition

| # | Severity | Finding | Disposition |
|---|---|---|---|
| F1 | high | Clicks on fit points or handle ends no longer picked anything: 26–28 % of outline click samples started a drag ([probe5.ts](../audit/probe5.ts)), which also blocked Dimension. | Fixed: a press only arms; a 3 px threshold activates; an earlier release is an ordinary pick. Proven in actual run02 (`02b-click-pick`). |
| F2 | medium | A stale start shape: a panel blur-commit or a key pressed mid-drag could be reverted. | Fixed: the start is captured at activation and checked before emit; keys are swallowed during a drag. |
| F3 | medium | Pointer cancel, lost capture or a second pointer leaked the drag. | Fixed: these cancel, and other pointer ids are ignored. |
| F4 | low/medium | A no-op or jittery drag emitted a change ([probe6.ts](../audit/probe6.ts)). | Fixed: emit only when the definition changed, plus the threshold. |
| F5 | medium | Radius chips covered handle ends (21–62 % of the pick disc, [probe7.ts](../audit/probe7.ts)). | Fixed: chips are hidden on a closed matching spline (run02 image). |
| F6 | low | Open splines showed handles that could not be dragged. | Fixed: marks and drags are for closed splines only. |
| F7 | low | Drags also worked in the Dimension tool. | Fixed: Select only. |
| F8 | low | A sticky `grab` cursor. | Fixed: reset on tool change. |
| F9 | tests | Names claimed more than they checked; mutants M1, M11, M14, M6 and M12 survived. | Fixed: the fixer reports all of them killed; M10 is equivalent. |

**Side notes addressed:** light-theme handle colours, and the docs now say "grid step (1 mm by default)". **Side notes not addressed:** in an edge-on view all targets collapse to one screen point; self-intersection is not checked (pre-existing).
