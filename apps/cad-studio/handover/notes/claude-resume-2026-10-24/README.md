# Hand-over to another account (2026-10-24)

The owner asked: "다른 계정에서 할 수 있도록 인수 인계 문서도 준비해줘". This note lets a fresh Claude account
continue the barocss CAD work: the coordinator and all five lanes.

**Read first:**
1. this note;
2. `../claude-resume-2026-10-23/common.md` (the standing rules, still current);
3. your lane's brief (§4);
4. `../../roadmap.md` (the plan; its Item index gives every item's title);
5. `../../api-conventions.md` (R7.2), for anyone touching public APIs.

## 1. Where everything is

- **Repository:** `/Users/user/github/barocss/barocss` (pnpm workspace). Everything is local: no push, PR or publish
  unless the owner asks.
- **Integration branch:** `review/cad-gpu-engine-2026-10-14`, in the worktree
  `.claude/worktrees/barocss-cad-gpu-review-efbb2c`. At the time of writing its tip is
  `c6a4cb64e95ea4bf10676213fb6b8b48774602fa`.
  - Never amend, rebase or reset it. Corrections are new commits.
  - The kernel lane commits here directly. The other lanes have branches, and the coordinator merges them with
    `--no-ff`.
- **Lane worktrees and branches** (all under `.claude/worktrees/`):

| Lane | Session title | Worktree | Branch | Owns |
|---|---|---|---|---|
| Coordinator | barocss-cad/gpu 엔진 리뷰 | `barocss-cad-gpu-review-efbb2c` | the integration branch | merges, roadmap, owner reports (Korean), shared root files (`package.json` overrides, the lockfile) |
| Kernel | 커널 줄 | `studio-constraints-371737`, committing on the integration worktree | (integration) | `packages/barocss-cad/**` |
| Outer | 바깥 줄 | `studio-mates-cbde0e` | `claude/cad-outer-lane-531d5a` | `packages/barocss-cad-model/**` except `src/api/`; the studio's panels, chat and agent |
| GPU | GPU 줄 | `compassionate-turing-e88276` | `claude/gpu-lane-2026-10-23` | `packages/barocss-gpu/**`; the studio's shell (layout, dock, top bar, rails, viewport) |
| Docs | 문서 줄 | `fervent-hopper-d9c6b2` | `claude/fervent-hopper-d9c6b2` | `apps/library-docs/**` |
| API | API 줄 | `confident-fermi-29a815` | `claude/api-lane-2026-10-24` | R7's object facades: `packages/barocss-cad/src/api/**`, `packages/barocss-cad-model/src/api/**` and `src/api.ts`, `packages/barocss-gpu/src/api/**`, plus the `./api` export entries |

- **Records:**
  - decision logs: `../../decisions.md` (kernel, D-ids), `../../decisions-outer.md` (O-ids) and
    `../../decisions-gpu.md` (G-R ids);
  - design notes: `../` (`api-facade-design.md`, `g11-scene-profile.md` and others).
- **Owner memory:** `~/.claude/projects/-Users-user-github-barocss-barocss/memory/` holds 60 files, indexed in
  `MEMORY.md`. They are the owner's standing decisions. The new account reads the index; if it's another OS user,
  copy the folder over (§6).

## 2. Tooling the lanes depend on

- **The barocss-lanes-guard mod.** It lives at `~/.claude/local-mods/barocss-lanes-guard` (v0.5.3) and is installed
  from the local marketplace `barocss-local`.
  - **The gate:** `bin/gate.sh` gives load-scaled slots for heavy runs: 3 below a load of 15, 2 below 25, 1 below 40.
    Every heavy run (suites, flows, fuzz, RB) goes through it, in the background. Scripts call
    `gate.sh acquire heavy <secs> "<label>"` themselves.
  - **The shims refuse:**
    - evidence, log and image commits;
    - lock-only commits;
    - amend, rebase or reset on integration;
    - deleting `codex/*` branches;
    - `pkill` and `killall`.
  - **`/lanes`:** a status pane showing the roadmap by group in Korean, each lane's last report and commit, the gate
    and the branches.
  - **To install on a new account:**
    1. `claude plugin marketplace add ~/.claude/local-mods/barocss-lanes-guard`
    2. `claude plugin install barocss-lanes-guard@barocss-local`
    3. `/reload-plugins` in each session.
  - **After a mod change:** bump the version in `.claude-plugin/plugin.json`, then run
    `claude plugin marketplace update barocss-local` and `claude plugin update barocss-lanes-guard@barocss-local`.
    Test with `claude plugin test .` in the mod folder.
- **Node 22.** Use `~/.nvm/versions/node/v22.19.0/bin`; Node 18 breaks the gpu tests.
- **Browser flows:** `apps/cad-studio/test/browser-flow.mjs` needs these environment variables:
  - `CHROME="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"`
  - `PW_DIR=~/.cache/barocss-playwright/node_modules/playwright`
  - a chat port per lane: outer 52391, GPU 52691, coordinator 52591.

  `FLOW_ONLY=<regex>` runs a subset.
- **External read-back tools,** installed with the owner's permission: urdfdom (`check_urdf`), MuJoCo 3.3.0
  (`~/.cache/barocss-mujoco`), usd-core 26.8 (`~/.cache/barocss-usd`) and ezdxf.

## 3. Coordinator duties (what the new coordinator does)

1. **Merge each lane's checkpoint** with `--no-ff` and a message that summarises it and names the lane's own checks.
   Before every merge:
   - check the diff's scope: the files are the lane's own;
   - check that no evidence, logs, images or a lock-only change are in it;
   - check that a lockfile change comes only with a deliberate dependency change, and that new packages are at least
     two weeks old. Pin anything younger with a root `pnpm.overrides`; see `undici` and
     `cmdk>@radix-ui/react-primitive`.
2. **After each merge,** run `node apps/library-docs/scripts/check-docs.mjs`.
   - It fails on refusal-table drift: regenerate with `node apps/library-docs/scripts/refusals.mjs` and commit.
   - It fails on label drift and module-map drift too. Route those to the docs lane.
   - Run studio `tsc` after App.tsx auto-merges, and `pnpm install --offline --frozen-lockfile` after a lockfile change.
3. **Keep `roadmap.md` current** with every merge. A new item gets an Item index line ending in ` · ko: <Korean title>`,
   which the `/lanes` pane reads.
4. **Run a full window** at track boundaries: builds, tsc, lint, all suites, RB, properties, and the full flow.
   - The coordinator's script is `window.sh` in this folder: run it with a clean, detached scratch worktree, real node_modules and
     `TEST_CONCURRENCY=4`.
   - The last window was at `9b4e90f3e`: everything green, flow 276/280. The four failures were fixed since. S9 closes
     after a rerun.
5. **Track boundaries in the kernel lane.** The kernel session clears itself (`clear_session("self")`). The
   coordinator then sends the next brief as its first message.
6. **Route every cross-lane finding** to its owner. Lanes never edit another lane's files.
7. **Report to the owner in Korean.** Plain, no jargon. Show screenshots of UI checkpoints with SendUserFile.

## 4. Each lane's state and next work

**Superseded for the queues:** since 2026-10-24 (later), the roadmap's "Order now" table is the live queue per lane.
The owner approved the API conventions and R7's steps (R7.3a–R7.6). The notes below record the state when this
hand-over was first written.

**Kernel (커널 줄).** The brief is `../claude-resume-2026-10-23/kernel-k15.md` (method in `kernel-k14.md`).
- **K15 is in progress:** K14's open robust refusals.
- **Committed:** D257, `43f6a1bc7`, the orientation pair.
- **In hand, not committed when this note was written:**
  - D258 (a cut along a face's edge dropped whole) and D259 (a Newton step at a segment's end), in a scratch tree;
  - the bracket prefix at part-model.ts:3512 (`[RADIUS_EXCEEDS_FACE]` for a too-large fillet);
  - a strict check for a turned-over wrapping face, which is required, not optional.
- **Then:** 25#49, the second causes of 25#170 and 26#34, 25#190, D239's nudges and s2#112.
- **State:** the fingerprint is `1cd931ee` (863 cases). Fuzz refusals are 16/12/11/12 on seeds 25/26/23/24, with no
  findings.
- Let the current session commit its scratch work before switching accounts. A `/private/tmp` scratch can vanish.

**Outer (바깥 줄).** Idle, waiting for R7.3.
- Everything through `a7728aa8a` is merged: O11's UI and guard, O12, O14, O16 (every panel on shadcn), O17 (the chat
  on the AI SDK) and O18 (masses after the reply).
- **Next:** R7.3's cad-model part, once the owner approves the conventions:
  - one `BarocssError` for its 19 classes, 35 bracketed-string returns and 81 throws;
  - `check…` returning `Problem[]`;
  - one function per duplicated concept: mass, bounds (`boxOf` is declared twice), STEP (`stepFor` →
    `exportStudioStep(doc, options)`).

**GPU (GPU 줄).**
- **G12f part 2 is in progress:** the top bar's own `className="tool"` buttons. Also fix the context menu, which
  covers the top bar when it's long: keep it inside the stage, with a max height and its own scroll.
- **Then R1d:** the HUD values and the placing pointer move into a store, because today 4 keystrokes give 10 App
  renders and 30 placing moves give 114.
- **Then G13:** robot frames as triads in the viewport, with data from the outer lane's `framePoses`.
- **G14 (measure, then decide):**
  - section GPU time, 8.1 ms against a 6 ms budget;
  - a rebuild with identical meshes dropping placed copies on WebGPU;
  - the order dependency after "render a part".
- **Also:** report how far a Z-up camera would reach. That's §10 item 1, the coordinate frame, a prerequisite of R7.5b.

**Docs (문서 줄).** Idle.
- There are 33 pages and none is marked "Being written". 20 samples pass, and 595 labels are checked.
- **Next:**
  - retake every screenshot after G12f lands, using `window.__studioScriptChat` for the agent pages;
  - tighten the Object API sample's refusal assertion once the kernel's bracket prefix lands;
  - keep pages current as each lane merges. The coordinator routes the changes.

**API (API 줄).** The brief is `../claude-resume-2026-10-23/api.md`.

On 2026-10-24 the owner asked for a facade in all three packages under the same rules.

- **Merged:** the cad-model slice:
  - `part().box().hole().fillet()` with typed selectors;
  - `.doc`, `.mass()` in MMGS and `.step()`;
  - BarocssError, and `src/api/core.ts` as the one adapter onto the core.
- **In progress:**
  1. extend the design note to cover all three;
  2. the cad slice, `@barocss/cad/api` over evaluateCadPart, replacing createCadModel;
  3. the gpu slice, `@barocss/gpu/api` with `scene()` and `show(viewer, scene)`, which waits on the coordinate frame
     (§5 item 3);
  4. shared selectors and errors in cad/src/api;
  5. growth, assemblies, then the docs samples.

## 5. Decisions waiting on the owner

From the R7 discussion (2026-10-24):
1. Approve `../../api-conventions.md` (R7.2), in particular MMGS units and errors that throw, so R7.3 can be assigned.
2. Go ahead to grow the facade beyond the first slice.
3. Add "§10 common data formats" to the conventions: the coordinate frame (CAD Z-up vs gpu packets' y-up), one
   Vec3/Mat4/Pose shape, one mesh packet, `{ body, face?, edge? }` references, `{ format, schema }` headers, one
   material id, and the request/cancel shape.
4. R7.5b, the facade ↔ Viewer bridge (proposed by the API lane).

Earlier, still open (the roadmap's "Waiting on the owner"):
- O11's K-or-F;
- two NEMA PDFs for O14's sample rows;
- one live chat turn for O17c's thinking display;
- a person-supplied row/fit file for A9's acceptance;
- the oblique weld beads (BEAD_ANGLE);
- the RD3 PDFs, RB6/RB8 downloads, live-model runs and the A6.5 legal review;
- the 3MF slicer check.

## 6. Switching accounts: the steps

1. **Ask each running lane to finish its current commit and stop.** The kernel's D258 and D259 are the main
   in-flight work. Note each lane's last SHA.
2. **Same OS user, another Claude login:** `~/.claude` (the mods, memory and settings) is shared, so nothing needs
   copying. Reinstall the mod if `claude plugin list` doesn't show it (§2).
3. **Another OS user or another machine:**
   - The local branches aren't on any remote, so moving them needs a push. That's the owner's call: "No push for now"
     stands.
   - Copy the memory folder and `~/.claude/local-mods/barocss-lanes-guard` across.
   - Install the tools listed in §2.
4. **Start the coordinator first,** in the integration worktree. Its first message: "Read
   apps/cad-studio/handover/notes/claude-resume-2026-10-24/README.md and continue as the coordinator."
5. **Start each lane** in its own worktree (§1), with a first message naming the role, this note, `common.md` and the
   lane's brief. The coordinator then sends each lane its current next item, from §4.
