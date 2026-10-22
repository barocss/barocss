# Coordinator hand-over (account change, 2026-10-22)

Read this first, then README §0 (its top blocks are each lane's own hand-over) and the three decision logs:
`decisions.md` (kernel, D-ids), `decisions-outer.md` (outer, O-ids), `decisions-gpu.md` (GPU, G-ids).

At hand-over the owner asked for everything to go to develop and be pushed (§8). Apart from that one request the standing rule still holds: no push, PR, publish or release until the owner asks.

## 1. How the work is organised

Three implementation lanes plus a coordinator:

| Lane | Owns | Branch | Worktree | Flow port |
|---|---|---|---|---|
| **Kernel** | `packages/barocss-cad/**` (the B-rep kernel), the kernel side of new kinds, plus their cad-model and studio wiring | `review/cad-gpu-engine-2026-10-14` (**the integration branch itself**) | `.claude/worktrees/barocss-cad-gpu-review-efbb2c` | 52491 |
| **Outer** | `packages/barocss-cad-model/**`: drawings, BOM, frames, mould, machining, print, chat/v2 tools, team. Also studio `src/ui` (not the viewport) | `claude/cad-outer-lane-531d5a` | `.claude/worktrees/studio-mates-cbde0e` | 52391 |
| **GPU** | `packages/barocss-gpu/**`, the studio's `src/viewport/**`, App.tsx call sites for joints, explode, section and overlays, and `apps/library-docs` shader hosts | `claude/gpu-viewer-pose-clip-2026-10-21` | `.claude/worktrees/great-einstein-3ea69b` | 52691 |
| **Coordinator** | reviews every checkpoint; merges the outer and GPU branches into integration in order; runs one full browser flow per merge window; relays owner decisions verbatim | (own session) | a detached verify worktree | 52591 |

- **Kernel lane:** commits directly on the integration branch and never amends, rebases or resets there.
- **Outer and GPU lanes:** merge the latest integration SHA into their branch before each checkpoint.
- **Coordinator merges:** `git merge --no-ff <lane sha>` in the integration worktree. Only touch files the kernel lane isn't editing (check `git status` first). Message each lane the new SHA.
- **The kernel lane** is a fresh session per track (owner, 2026-10-19). At each track boundary the coordinator clears it and re-briefs it from its §0 hand-over block, without asking (owner, 2026-10-20).

## 2. Verification (v2/v3, owner 2026-10-21: "checks too slow")

- **Lanes, every checkpoint:**
  - lint and type-check of the changed packages, run after the last edit to a test file (cad-model's tsc covers `test/`, the esbuild runner doesn't);
  - the touched package suite;
  - `FLOW_ONLY=<regex>` on the steps the change runs, plus their prerequisites;
  - the full kernel suite (`--test-concurrency=4`) only when brep core changes;
  - RB and properties at T3 or every 4th kernel checkpoint;
  - long runs in a detached scratch worktree;
  - name diffs against saved lists, never rerunning old commits;
  - each checkpoint lists what ran and what didn't.
- **Coordinator, one per merge window:** fast checks (package and studio suites, tsc) in a clean detached worktree, then the full browser flow. Gate the flow on machine load (`sysctl -n vm.loadavg`: start only when the 1-minute value is below 20 and the 5-minute below 25).
  - **Never write to the worktree a flow runs from.** The Vite dev server fully reloads on any served-file change, a stale "Unsaved work" toast is the symptom, and the flow now names the changed files.
- **Machine load is the main source of flakes.** Rerun only the failing step and its prerequisites. Known load flakes: step 109 (the worm wheel), AM4 timing, B9, D104, hollow.
- **Environment:**
  - Node 22: `export PATH=$HOME/.nvm/versions/node/v22.19.0/bin:$PATH`.
  - Run `pnpm build:library` in `packages/barocss-cad` and `packages/barocss-gpu` before tests.
  - Flow: `CAD_STUDIO_CHAT_PORT=<port> CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" PW_DIR=$HOME/.cache/barocss-playwright/node_modules/playwright node test/browser-flow.mjs <out-dir>` from `apps/cad-studio`.
  - Kill only your own PIDs.
- **Icon font:** it is loaded from Google Fonts and is **never bundled** (owner). A flow cascade with icons shown as text means the font didn't arrive; check that fonts.googleapis.com is reachable and rerun.

## 3. Owner decisions in force (verbatim quotes in the logs)

- **Agent tools:** v2 only, v1 removed (unreleased). New features go in as v2 group actions with detail behind `describe`. Guard: per-turn tools list plus prompt ≤ 25,000 characters (about 22,350 now).
- **Data:**
  - no built-in standards tables and no copied standards text;
  - values are the user's rows, a sourced page, or flagged estimates;
  - fit, bearing, O-ring, ring, drive, section, stock, bend and connector rows are user-loaded;
  - rows (b), 2026-10-22: the agent may load rows only from a file the person supplied in the conversation, with its source recorded; rows the agent writes itself are refused (outer lane A9-9, not built yet).
- **Shop rows** live at the document or assembly level; parts inherit them and a part's own rows override by id (coordinator, A9-8).
- **@barocss/cad-model** is fully public (every module by path, 0.x). Publish only through release, when asked.
- **Chat turns** re-apply the agent's operations onto the person's concurrent edits (A7 patches); conflicts are re-proposed.
- **FRf2:** sibling-part frames stay refused.
- **FR completion:** all of FR's leftovers. **GPU track:** G1–G25 (G18 docs approved; the icon font never bundled).
- **CAE (FEM, mould fill):** not on the roadmap.
- **Earlier ones** (see README §0 "Owner decisions"): own TypeScript with no WASM, no new runtime deps, ECAD deferred, Tailwind-only, and replies to the owner in Korean.

## 4. State at hand-over

Integration (`review/cad-gpu-engine-2026-10-14`): see the final SHA in §7. The last fully verified window was **9fec9950c**: package 780/780, studio 211/211, gpu 84/84, full flow 264/264.

### Kernel lane
- **Done:** R10–R12, FR1–FR4, R12b, track K, the queue (D148–D152), R12c (D153–D163, T3 green), FRk S0 (D164), FRk1 gussets and end caps (D165), FRk2 weld beads (D166), FRk8b the bevel pair's mass defect (D167: 38.559407 against the oracle's 38.559184; strips no longer dropped).
- **Next, in the reordered sequence:**
  1. FRk3: I/H beams and tapered channels.
  2. FRk4: arc members and revolve with holes.
  3. FRk5: weld gaps and notch cutters.
  4. FRk6: ordered-trim speed, target ≤ 2 s.
  5. FRk7: SubD slivers.
  6. FRk8a: the housing Da max check.
  7. FRk8b's exact domain-trim integration, if still needed.
  8. FRk9: acceptance.
- **For the owner:** oblique-end weld beads are refused (BEAD_ANGLE) for want of an independent oracle.

### Outer lane
- **Done:** IM/CNC/AM tracks, PKG, O105 (v2), FR items 1–7, O-items through the BOM panel and table, section views X1–X3, chat-turn merge (O133), blob eviction, proposalDiff, G24 data (model annotations), G22 data (clearance map, lazy bands), G23 data (printLayers, camPackage with typed tool-tip moves), the weld record → bead mapping, the A9 S0.
- **Done after the S0, and how far each is checked** (the lane's final SHA is acf9e86f8):
  - A9-3, unknown arguments refused (e3db22957): **verified**. Package 794/794, studio 211/211, every FLOW_ONLY chat step passes.
  - A9-2, `part` on manufacturability, orientation and the brief (1b7333f9f): only its own tests and tsc have run.
  - A9-1, welds at ordered-trim nodes (cc452383b, with 4f93e826c fixing a tsc error): only the frame and weld tests (37/37) and tsc have run.
  - A9-5/6, clearance states contact/touching/overlap/designed (65eeac483): this is **`wip`**. Only the clearance tests (9/9), tsc and eslint have run.
- **Still to verify in the first window:** A9-2, A9-1 and the A9-5/6 wip. Run the full suites plus `FLOW_ONLY="chat|weld|FRd|frame|clearance|brief|printab"`.
- **Next, the A9 queue left:**
  1. A9-13: the base drawing drawing every instance.
  2. A9-4: drawing.set options.
  3. A9-10: chat actions for BOM, CSV, clearance, CAM, layers and bundle, with A9-8 (shop-row inheritance).
  4. A9-9: rows rule (b).
  5. A9-11: the key CSV source.
  6. A9-7: a bearing housing in the same part.

  Then the A9 acceptance run itself (test/a9-acceptance.test.ts plus conformance/a9).
- **Found at the stop, not yet fixed:**
  - **For the kernel lane:** beads on ordered-trim ends are refused with BEAD_SEAM_NOT_PLANAR, even when the envelope face is planar. A9's bead oracle waits on this.
  - **For the A9 brief:** the default shaft's key on step 1 clashes with the 6204 (115 mm³). Move one of them.
  - **For the GPU lane:** G22's consumer has to take the new clearance states.
- **Open items:** aligned sections for off-axis features; a welded-fabrication DFM profile (A9-12).

### GPU lane
- **Done:** G1–G19 (section upgrades incl. hatch, ghost caps, caps casting shadows, box and multi-plane, Render), G20.1 (cut-outs in the viewer).
- **Work in progress, merged but unverified:** G20.2. Commits 3d85e6793 (gpu: the caps' probe lead scales with depth) and 398683cb6 (studio: the bar's Cut-out mode, WebGL2 clipping, the exact section per source body) are `wip(...)`; their messages say what is unverified. The lane's hand-over is 9f05bbcd5. They were merged so that all local code reaches develop (owner, 2026-10-22). G20.2's own checks and the window flow have **not** run on them. Finishing G20.2 is the GPU lane's first step.
- **Next:**
  1. G20.2: finish the studio cut-out mode (WebGL2, the exact section as pieces reported per source body) and verify it.
  2. G21: silhouettes, display modes, isolate/hide.
  3. G22: the clearance map on screen, using the outer lane's data (band decals, local-frame overlaps, pose keys).
  4. G23: print layers and CNC material removal, using the outer lane's data.
  5. G24: 3D PMI, calling the outer lane's glyph builders.
  6. G25: GPU analyses.
- **Open items:** aliased cap edges (per-sample), after G25. The WebGL2 support statement is in README §0.

## 5. Pending owner items (unchanged)

- Live model runs (RB9 live, RD10 L3, A7/A8 comparison): they need a token budget.
- RD3 PDFs and RB6/RB8 downloads: these need permission.
- The A6.5 legal review.
- `check:docs` manifest drift for @barocss/gpu. It predates G18; fixing it needs an `inventory.mjs --write --commit` by the docs owner.

## 6. Re-briefing a lane in the new account

Start a fresh session in the lane's worktree and give it:
- its role line from §1;
- "read README §0's top block for your lane, then your decision log's last entries";
- the owner decisions in §3 that touch its work;
- the verification rules in §2;
- "one step per checkpoint: commit, report the SHA, tier, counts and what didn't run, then wait".

Each lane's own hand-over block in §0 has its exact next step.

## 7. Stopped at hand-over (owner, 2026-10-22: "백그라운드에서 돌고있는거 다 멈추고 인수인계에 적어줘")

Every background run was stopped before it finished. None of these results exist, so the new account must run them first:
- **Coordinator's trial check of the GPU WIP:** stopped mid-run. It was a detached merge `db220b0f0` (411aa7761 plus GPU 9f05bbcd5) in the coordinator's verify worktree, running builds, the gpu suite, cad-model tsc, the studio suite, tsc and lint. It reported nothing.
- **Outer lane:** its turn was stopped while it was building A9-5/6 (designed-seat relations in the clearance map). Its §0 block says what was verified (A9-3's suites and chat flow steps passed) and what wasn't.
- **The window's fast checks and full browser flow** on the final integration commit **did not run**. The last fully verified window is still **9fec9950c** (full flow 264/264). Everything merged after it is checked only by its own lane's checkpoint checks, or not at all (the WIP).

**The new account's first step:** on the integration tip, run the coordinator's window checks in a clean detached worktree (§2): builds, package suites, studio suite, tsc, lint, then the full flow. Send any failures to the owner lane.

## 8. Final SHAs at hand-over

| What | SHA | Checked |
|---|---|---|
| Last fully verified window | 9fec9950c | fast checks plus full flow 264/264 |
| Kernel lane (on integration) | 411aa7761 (FRk8b 7c6be3324, 75647da69 below it) | lane T2 table in its §0 block |
| GPU lane | 9f05bbcd5 (G20.2 WIP 3d85e6793, 398683cb6), merged as be82af5f6 | WIP, not verified |
| Outer lane | acf9e86f8, merged as 21da9ce11 | see §4 Outer lane |
| Integration tip | the commit that adds this file, plus the origin/develop merge just before it | window checks not run (§7) |

**Remote (owner, 2026-10-22: "마무리 하고 로컬 코드를 다 develop 에 넣어서 push 까지 해줘").** The integration branch `review/cad-gpu-engine-2026-10-14` is pushed to origin and opened as a PR into `develop`. develop's protection requires a PR and the "Test and Build" check, so it lands only through that PR. The PR's CI is the first remote check of everything after 9fec9950c. See the PR for its result.

The new account starts from the integration tip. All three lanes' branches are merged into it.
