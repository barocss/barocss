# Independent audit: roadmap 20 ① whole-part drag preview (useCommandPreview wholeCost / ROLL_AFTER_MS)

Verdict: CHANGES_REQUIRED (one Medium finding; the rest hold).

## Findings

1. Medium: an idle-edit drag on a slow part waits one whole-part evaluation before the first frame. apps/cad-studio/src/state/useCommandPreview.ts:81 (`wholeCost.current?.cmd === cmd`).
   The idle handle path (useCommandGizmos.ts:69-74, 121-122) creates the Active on the first pointer move with `cmd = editCommand(...)`, a fresh object every time `idleEdit`'s useMemo recomputes (for example after each commit or Esc). No opening preview runs for it, so on the first drag job `slow` is false and the whole part goes out. Scenario: the whole part takes 400 ms and the box alone 100 ms. Probe trace with the first move at h=9.5: `{t:3,n:2}` then `{t:405,n:1}...`. The first visible update arrives about 400 ms after the drag starts; the old code sent the box alone at t=3, answered by about 100 ms. This hits every idle drag on exactly the parts that rolling exists for. Palette commands are fine because their opening preview measures first.
   Fix options: key the measurement on something that survives idle edits (`ctx.doc` / the evaluated doc), or seed it from the App's last whole-document evaluation time (App.tsx:751 `lastMs`). Either should come with a test that starts from a null Active.

2. Low: the bisectValue doc comment is orphaned. useCommandPreview.ts:14-17: the new ROLL_AFTER_MS JSDoc was inserted between bisectValue's JSDoc and the function, so line 14 now documents nothing. Move the constant above it.

3. Info (no defect): the D368 invariants hold. While the whole part is shown, a job runs the same non-rolled branch as the fillet command: the line-104 stale guard on lastOk, the line-111 nearest-bad rule, and bisect only when live. This is the path the existing fillet tests cover. A refused value is never reported 'ok', because line 118 requires `!rolled` and that the values are current. previewFor is now JSON(values) instead of '' during such drags. Its only consumer is settleDrag, which runs for body drags only (useCommandGizmos.ts:109). fullTimer is armed only after a rolled job and cleared at every job, so a whole-part drag leaves no stray timer.

4. Info: on staleness, rolled jobs never re-measure, so an inflated measurement can persist. The cause is a single worker shared with evaluate, section and drawing (client.ts:27). It persists only until the next 220 ms pause, when job(true) measures again: the worst case is the old behaviour, not a lock-in. A fast-but-wrong measurement costs one slow frame, after which the slow job re-measures. Round-trip time is a fair measure for "keeps up". `result.wallTime` would exclude queueing but would also hide real queueing.

5. Test relaxation (2 to 3 swings): justified, and it is not a regression. A probe of the 60 ms held case gave shown `...2,2,6,...,4.5,4,4,3.5,4,...`, evaluated `9,6,3,2,6,4.5,4,3.5,4`, swings 2. The stated three-swing path occurs when lastOk reaches 4 (the exact bound) while bad is still 2: probe 3 is refused, then 3.5 (step back), then 4 (step back). This is the D368 bisect's behaviour whenever lastOk lands on the bound; the fillet path can hit it too. Before the change, the old 60 ms case never met a refusal mid-drag. The count depends on timing, so the comment overstates it slightly ("both probes" happens in some runs, not all).

## Ran
- The focused test under the gate: `node scripts/test.mjs command-drag-wall`: 22/22 pass.
- Probes, written and run only in this audit folder (probe.test.ts, bundled with esbuild against the repo sources): a trace of the 60 ms held rolled case, and an idle drag that starts from a null Active with a fresh cmd and a 400 ms whole part.
