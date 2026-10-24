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

## 4. Each lane's state and next work (updated 2026-10-24, late)

The live queue is the roadmap's **"Order now"** table. This section gives the detail behind it. At the time of writing
the integration tip is `b54bae6d8`.

**Kernel (커널 줄).** The brief is `../claude-resume-2026-10-23/kernel-k16.md`, with the method in `kernel-k14.md`.
- **K16 is in progress:** the Boolean features' self-union (D260).
- **Committed:** checkpoint 1, `b54bae6d8`.
  - D266: the fits nominal is snapped to 1e-6 mm.
  - D267: `pointAt`'s remainder an ulp below L.
  - The "49 vs 52" DXF count was a misread byte diff.
- **Approved but not yet committed when this was written:** checkpoint 2, `slice(1)` (D268). It covers
  regenerated flat-DXF fixtures, and 25#49 builds with it. Its fuzz refusals go 45 → 43.
- **Open before K16 closes:**
  - 24#154 and 23#110, valid bodies refused under `slice(1)` because the analytic Boolean is order-sensitive
    (A∪B builds, B∪A refuses);
  - a new RB property for **commutativity** (A∪B against B∪A, A∩B against B∩A).
- **Then:**
  - R7.3a: BarocssError moves into the kernel's core; fold cad's 152 Error classes into codes.
  - R7.3b: results as data in MMGS: CadPartOutput's methods become functions; kg → g.
  - R7.3d: retire createCadModel and the old document-version paths; rename the y-up packet tag with GPU.
- **State:**
  - the fingerprint is `17c1d5c4` (866 cases), or `850d4008` (867) after slice(1);
  - fuzz refusals 15/9/11/10 on seeds 25/26/23/24, no findings;
  - the kernel suite has one known failure, native-split's Node-version assertion.

**Outer (바깥 줄).** On R7.3a: cad-model's errors move to BarocssError.
- **Batch 1:** no text change, with the fingerprint byte-identical: 40 coded throws, 12 coded classes, 13 validators,
  and the bracketed-string returns.
- **Batch 2:** about 110 uncoded throws and 7 uncoded classes get codes. That's an intended `[CODE] ` prefix change:
  record every changed text, update the tests, and regenerate the refusal table.
- `BarocssError` comes from `@barocss/cad/api` until the kernel moves it to the core. The facade keeps re-exporting it.
- **Then:**
  - R7.3c: one mass, one bounds and one STEP function (`stepFor` → `exportStudioStep(doc, options)`);
  - the R7.3b follow-up: `bodyMass` inertia in g·mm².

**GPU (GPU 줄).**
- **On branch, not yet merged:**
  - G13, the robot frames drawn as RGB triads with names (`6cf398188`, `4b4acd4cb`);
  - the proposal ghost's volume chips stacked (`b0d5619b4`).
  - Their full flow was running when this was written.
- **Then:**
  - R7.3a for gpu, in two batches:
    1. the 33 classes and 21 `{ ok:false }` returns onto a BarocssError of the same shape, defined in gpu, since gpu
       doesn't import cad;
    2. codes to UPPER_SNAKE with `[CODE]` messages, listing every studio call site changed.
  - R7.3c: Vec3, Mat3 and Mat4 shapes where they cross a package.
  - R7.3d: the packet tag, with the kernel.
  - G14, measure then decide:
    - section GPU 8.1 ms against a 6 ms budget;
    - a rebuild with identical meshes dropping copies on WebGPU;
    - the order dependency after "render a part".

**API (API 줄).** The brief is `../claude-resume-2026-10-23/api.md`, and the design is in `../api-facade-design.md`.
- **Merged:**
  - facade slices in all three packages: `@barocss/cad/api`, `@barocss/cad-model/api` and `@barocss/gpu/api`;
  - the shared selectors and BarocssError in cad/src/api;
  - the `./api` exports;
  - a browser check of `show()`, in gpu's `test:browser`.
- **Now, R7.4a:**
  - cad-model's `part()` wraps cad's (§11 of the conventions);
  - verbs and options take the agent's v2 command names (§12);
  - `mass({ densityGPerCm3 })`.
- **Then:**
  - R7.4b: cylinder, sketch → extrude/revolve, chamfer, shell, Booleans, patterns, a body chooser, Plane/Location,
    and a selector-stability test;
  - R7.5: assemblies;
  - R7.5b: gpu growth;
  - R7.6: the docs on the facades.

**Docs (문서 줄).** Idle, following merges as the coordinator routes them.
- 33 pages, 36 shots (2.7 MB), 24 samples, 595 labels. Every shot is on G12's final layout.
- **Next:**
  - text for G13, the frames in the viewport, once it merges;
  - text for R7.3's changed refusal codes, regenerating the table;
  - R7.6.

## 5. Decisions waiting on the owner

The R7 decisions are made. The conventions §1–§12 and R7's steps were approved on 2026-10-24: "로드맵 제대로 정해서
진행해줘". Still open, from the roadmap's "Waiting on the owner":
- O11's K or F: whether part configurations fold into assembly variants;
- two NEMA PDFs for O14's sample mount rows;
- one live chat turn, to verify O17c's thinking display;
- a person-supplied row and fit file for A9's acceptance;
- the oblique weld beads (BEAD_ANGLE);
- the RD3 PDFs, the RB6/RB8 downloads, live-model runs, and the A6.5 legal review;
- the 3MF slicer check.

## 6. Switching accounts: the steps

1. **Before switching, have each running lane commit and stop** (the wrap-up message is in §7). The main in-flight
   items:
   - the kernel's checkpoint 2, `slice(1)`, and its two open cases;
   - the outer lane's R7.3a batch;
   - the API lane's R7.4a;
   - the GPU lane's G13 checkpoint.

   A `/private/tmp` scratch tree can vanish, so nothing may stay there uncommitted. Note each lane's last SHA.
2. **Same OS user, another Claude login:** `~/.claude` is shared, so the mods, memory and settings need no copying.
   Check `claude plugin list` for barocss-lanes-guard, and reinstall it if it's missing (§2).
3. **Another OS user or another machine:**
   - the local branches aren't on any remote, so moving them needs a push, which is the owner's call;
   - copy `~/.claude/projects/-Users-user-github-barocss-barocss/memory/` and `~/.claude/local-mods/barocss-lanes-guard`
     across;
   - install the tools in §2.
4. **Start the coordinator first,** then each lane in its own worktree (§1), with the first messages in §7.
5. **The coordinator** then merges any lane branch that's ahead (GPU's G13 first), runs check:docs, and continues the
   "Order now" queues.

## 7. Messages

### 7.1 Wrap-up, sent to each current lane before switching

> We're moving this work to another account. Finish your current step to a commit (no work left uncommitted in a
> scratch tree), run that step's checks, then stop. Reply with: your last SHA, what's committed, what's not started,
> and anything in progress that the next session must know. Don't start anything new.

### 7.2 First message for each new session

Open each in the worktree named in §1.

**Coordinator** (worktree `barocss-cad-gpu-review-efbb2c`):
> You are the coordinator for the barocss CAD work, continuing from another account. Read
> apps/cad-studio/handover/notes/claude-resume-2026-10-24/README.md first, then
> apps/cad-studio/handover/notes/claude-resume-2026-10-23/common.md, apps/cad-studio/handover/roadmap.md ("Order
> now" and the Item index) and apps/cad-studio/handover/api-conventions.md. Then:
> - check every lane branch for commits ahead of integration, and merge them as in §3;
> - run check:docs;
> - continue the lanes' queues.
>
> Report to me in Korean.

**Kernel** (worktree `studio-constraints-371737`; commits on the integration worktree):
> You are the barocss kernel lane, continuing from another account. Read
> apps/cad-studio/handover/notes/claude-resume-2026-10-24/README.md (§4, Kernel), then
> apps/cad-studio/handover/notes/claude-resume-2026-10-23/common.md and kernel-k16.md (method in kernel-k14.md), and
> decisions.md D260 and D265–D268. Continue K16: land slice(1) if it isn't on integration yet, fix 24#154 and 23#110,
> add the commutativity property to RB, then write K16's closing record. Then do R7.3a, R7.3b and R7.3d per
> api-conventions.md. Send checkpoints to the coordinator session.

**Outer** (worktree `studio-mates-cbde0e`, branch `claude/cad-outer-lane-531d5a`):
> You are the barocss outer lane, continuing from another account. Read
> apps/cad-studio/handover/notes/claude-resume-2026-10-24/README.md (§4, Outer), then
> ../claude-resume-2026-10-23/common.md, apps/cad-studio/handover/api-conventions.md (§6 and §3) and your
> decisions-outer.md tail. Merge integration first. Continue R7.3a: batch 1 with no text change and the fingerprint
> byte-identical, then batch 2 with the codes added and every text change recorded. Then R7.3c. Send checkpoints to the
> coordinator session.

**GPU** (worktree `compassionate-turing-e88276`, branch `claude/gpu-lane-2026-10-23`):
> You are the barocss GPU lane, continuing from another account. Read
> apps/cad-studio/handover/notes/claude-resume-2026-10-24/README.md (§4, GPU), then
> ../claude-resume-2026-10-23/common.md, apps/cad-studio/handover/api-conventions.md (§6 and §10) and your
> decisions-gpu.md tail (G-R49 onward). If G13's checkpoint isn't sent yet, finish its full flow and send it. Then do
> R7.3a for gpu in two batches, then R7.3c, R7.3d (with the kernel, through the coordinator) and G14. Send checkpoints
> to the coordinator session.

**API** (worktree `confident-fermi-29a815`, branch `claude/api-lane-2026-10-24`):
> You are the barocss API lane, continuing from another account. Read
> apps/cad-studio/handover/notes/claude-resume-2026-10-24/README.md (§4, API), then
> ../claude-resume-2026-10-23/common.md and api.md, apps/cad-studio/handover/api-conventions.md (all of it,
> especially §7, §11 and §12) and apps/cad-studio/handover/notes/api-facade-design.md. Merge integration first.
> Continue R7.4a (cad-model's part wraps cad's; v2 command names; `mass({ densityGPerCm3 })`), then R7.4b. Send
> checkpoints to the coordinator session.

**Docs** (worktree `fervent-hopper-d9c6b2`, branch `claude/fervent-hopper-d9c6b2`):
> You are the barocss docs lane, continuing from another account. Read
> apps/cad-studio/handover/notes/claude-resume-2026-10-24/README.md (§4, Docs), then
> ../claude-resume-2026-10-23/common.md and docs.md. Merge integration first, run check:docs, test:samples and build,
> and wait for the coordinator's routed changes: G13's frames, R7.3's refusal codes, R7.6.
