# CAD roadmap — current navigation

This is the single current status index. Row pages describe scope and evidence navigation, not a second status ledger.
Historical statements remain verbatim in the [through-D417 archive](roadmap-history-through-D417.md).
A bounded closeout does not close an entire feature family, format, standard or release.

## Current navigation — authority

- Latest measurement: [D428 orthographic AO/bounds interaction](notes/orthographic-ao-artifact-2026-11-02/README.md), bounded diagnostic PASS; no product repair yet.
- Current qualified bounded camera checkpoint: [D427](notes/small-camera-scale-2026-11-02/README.md), centered fit/visibility/picking. General raster quality remains HOLD. D426 retains native Model world-coordinate proof and D424 the latest full-kernel run.
- D418 documentation organization: **QUALIFIED**, [record](notes/roadmap-index-2026-11-01/README.md).
- D423 historical mass source checkpoint: **scoped source PASS; original Studio/full-backend HOLD**, [record](notes/mass-translation-2026-11-01/README.md). D424 current source has full-kernel and two bounded actual flow PASS; original failure cause remains unexplained.
- D420 owner-approved develop integration: **MERGED**, [PR #2274](https://github.com/barocss/barocss/pull/2274), [scope and CI](notes/develop-integration-2026-11-01/README.md).
- Operating rules and priority remain in the unchanged [handoff](notes/codex-handoff-2026-11-01/README.md).
- Decisions: [current navigation](decisions.md); numeric proof belongs to canonical item notes and qualifications.
- Before selecting one next item, check its dependencies, current source, recorded HOLDs and owner authorization.
- Do not restart qualified bounded profiles or infer release acceptance from a documentation change.

## Current navigation — active lane and next boundary

- Active feature lane: **row 13, exchange and explicit loss profiles**. D418 is documentation maintenance, not a new exchange feature.
- Rows 12 and 16 are cross-cutting file/acceptance and robustness work. Row 30 runs with row 16; row 31 follows row 30.
- Latest bounded profile: [D427 centered small-camera framing, visibility and pointer selection](notes/small-camera-scale-2026-11-02/README.md). D428 diagnostic completed. Next: **D429 — preserve AO and refine automatic orthographic depth clipping**, rows 6/13/16. Far-coordinate GPU frame and picking work remains pending after that measured boundary, before further spherical OFFSET admission.
- Accepted sequence: 10 → 11 → 13 → 14, subject to all owner HOLDs; usability row 15 precedes rows 17–19.
- The unchanged [handoff §3 continuation order](notes/codex-handoff-2026-11-01/README.md#_3-%E1%84%83%E1%85%A1%E1%84%8B%E1%85%B3%E1%86%B7-%E1%84%8C%E1%85%A1%E1%86%A8%E1%84%8B%E1%85%A5%E1%86%B8-%E1%84%85%E1%85%A9%E1%84%83%E1%85%B3%E1%84%86%E1%85%A2%E1%86%B8-%E1%84%89%E1%85%AE%E1%86%AB%E1%84%89%E1%85%A5) retains the detailed sequence and authority. This pointer does not activate manufacturing or Motion/Physics work.

## Current navigation — progress estimate

- Owner reporting rule (2026-11-01): announce the roadmap row, concrete task and overall estimate when starting each next item.
- Current estimate: **43%**. Equal row weights: 7 bounded closeouts × 1, 15 partial rows × 0.5, 12 planned/held rows × 0; `(7 + 15 × 0.5) / 34 = 42.65%`.
- This is a coarse estimate from current status. Closeout means the agreed bounded scope. The score changes when a row changes class; detailed acceptance stays in each canonical record.

## Current navigation — 34 scope rows

| Row | Scope and acceptance navigation | Current bounded status / next boundary | Progress class |
| --- | --- | --- | --- |
| 01 | [독립 공차 프레임 — CG5 DR-6](roadmap-rows/01.md) | Bounded closeout D372. | Bounded closed |
| 02 | [도면 사용 문서 연결](roadmap-rows/02.md) | Bounded documentation closeout D374. | Bounded closed |
| 03 | [절삭 피처 선형 반복 — CG2](roadmap-rows/03.md) | Bounded closeout D373. | Bounded closed |
| 04 | [실제 API 문서·그림·탐색 구조](roadmap-rows/04.md) | Bounded API/documentation closeout D374. | Bounded closed |
| 05 | [Viewer 제품 마감과 다음 리뷰 전달](roadmap-rows/05.md) | Bounded Viewer closeout D375. | Bounded closed |
| 06 | [GPU 소유 결과 인계와 다음 GPU 기능](roadmap-rows/06.md) | Existing GPU handoff/local merges; D427 centered camera profile qualified, D428 AO/bounds diagnosis complete; D429 correction pending. | Partial |
| 07 | [Advanced modeling — CG1](roadmap-rows/07.md) | Delivered recorded modeling profiles; reuse D288–D316. | Partial |
| 08 | [Feature patterns, direct editing and surfaces — CG2](roadmap-rows/08.md) | Bounded closeout D333–D347; extensions are separate. | Bounded closed |
| 09 | [Advanced sketch — CG3](roadmap-rows/09.md) | BOUNDED_CLOSED for D348–D358/D366 scope. | Bounded closed |
| 10 | [조립 확장 — CG4](roadmap-rows/10.md) | Qualified assembly slices D383–D393; motion/physics HOLD remains. | Partial |
| 11 | [도면 확장 — CG5 DR-6/7/8](roadmap-rows/11.md) | Qualified drawing slices through D416; general certification remains open. | Partial |
| 12 | [파일·버전·협업 — CG6](roadmap-rows/12.md) | OPEN general file/version/collaboration scope. | Partial |
| 13 | [교환과 손실 표시 — CG7](roadmap-rows/13.md) | OPEN exchange scope; bounded analytic offsets D419, name-loss report D421 and translation arithmetic D422; D423 historical holds retained; bounded accuracy/label/Model profiles through D427. Far GPU and general raster quality remain open. #2263/#2248/#2266 remain open. | Partial |
| 14 | [생산 기능 — CG8](roadmap-rows/14.md) | Planned manufacturing; P2/PG11 HOLDs remain. | Planned / held |
| 15 | [제품 사용성 — CG9](roadmap-rows/15.md) | U1–U4 and D425 quantity labels bounded closeouts; other usability work remains. | Partial |
| 16 | [정확도·강건성·API/참조 — CG10, R7, #2210/#2215](roadmap-rows/16.md) | OPEN accuracy/robustness scope; Bounded kernel/Model fixes through D426; D427 centered camera/picking qualified. D428 diagnoses AO/bounds interaction; D429 raster correction and later far GPU precision remain open. | Partial |
| 17 | [경로 묶음·가상 클립 — PB0–PB4](roadmap-rows/17.md) | Existing bounded path/clip profiles; no automatic dynamics work. | Partial |
| 18 | [관절·로봇 — J1/J2, R1/D1/R2, RS6/RS7/P4](roadmap-rows/18.md) | Existing staged robotics plan; Physics/Motion HOLD remains. | Partial |
| 19 | [가상 실험·다물리·실측 — Stage0–6](roadmap-rows/19.md) | Existing staged experiment plan; CAE/Physics HOLDs remain. | Planned / held |
| 20 | [기즈모·핸들 드래그 UI/UX·렌더링 (2026-10-27 사용자 관찰)](roadmap-rows/20.md) | Bounded handle/UI profiles; measured drag limits remain. | Partial |
| 21 | [Studio 도구 사이드바 배치 (2026-10-27 사용자 요청)](roadmap-rows/21.md) | Bounded sidebar/history closeouts; search/ribbon scope remains. | Partial |
| 22 | [Kernel JavaScript performance and code shape](roadmap-rows/22.md) | Bounded performance/code-shape measurements; no universal acceptance. | Partial |
| 23 | [대형 조립 성능 (2026-10-30 상용 공백)](roadmap-rows/23.md) | Planned large-assembly work after assembly foundations. | Planned / held |
| 24 | [곡면 품질·Class-A (2026-10-30)](roadmap-rows/24.md) | Planned Class-A scope; preserve B2/08 dependencies. | Planned / held |
| 25 | [공차 누적 해석 (2026-10-30)](roadmap-rows/25.md) | Planned tolerance-stack scope after drawing/assembly foundations. | Planned / held |
| 26 | [실제 고객 파일 회귀 (2026-10-30)](roadmap-rows/26.md) | Customer regression requires per-download permission. | Planned / held |
| 27 | [릴리스·운영 (2026-10-30)](roadmap-rows/27.md) | Release/operations decisions retain owner gates. | Planned / held |
| 28 | [교환 형식 범위·표준 부품 카탈로그 (2026-10-30)](roadmap-rows/28.md) | Format/catalog/SDK decisions retain owner gates. | Planned / held |
| 29 | [협업·PDM (2026-10-30)](roadmap-rows/29.md) | Collaboration/PDM retains server and owner gates. | Planned / held |
| 30 | [커널 일반성 (2026-10-30 엔진 리뷰)](roadmap-rows/30.md) | OPEN kernel generality; #2266 widening is deferred. | Partial |
| 31 | [B-rep 직접 편집 (2026-10-30 엔진 리뷰)](roadmap-rows/31.md) | Planned direct editing after kernel generality. | Planned / held |
| 32 | [Viewer SDK 상용 기준 (2026-10-30 엔진 리뷰)](roadmap-rows/32.md) | Viewer commercial scope remains separately qualified. | Partial |
| 33 | [CI 브라우저 검증 (2026-10-30 엔진 리뷰)](roadmap-rows/33.md) | Local-only browser verification boundary D359; no CI restart. | Planned / held |
| 34 | [단위 접미사 이름 정리 R7.7 (2026-10-30 엔진 리뷰)](roadmap-rows/34.md) | R7.7 quiet boundary; no schema5/migration authority. | Planned / held |

## Current navigation — holds and evidence

- Rows 13, 16 and 30 remain OPEN. D417/D419 qualify bounded admission/refusal fixes; NURBS limits remain unchanged.
- Motion/Physics and virtual experiment gates remain. Pose, kinematics and static results are not dynamics qualification.
- CAM/postprocessor/nesting retain P2/PG11 and NOT FOR PRODUCTION boundaries; no automatic implementation.
- New dependencies, external SDKs, services, release/deployment and downloads retain their existing owner gates.
- Browser CI remains local-only under D359. Do not recreate the reverted WebGPU CI job.
- Native schema3/4 authority remains; no schema5 or migration authorization is introduced.
- Preserve accepted history, original failures, refusal limits, references and authored values.
- Product changes require their own tier, source review, checks and actual flow. D418 is documentation only.

## Current navigation — how to use the records

1. Read this index for current status and the selected row for scope/acceptance/dependencies.
2. Read the canonical item note and qualification for measured claims, failure history and limits.
3. Use the immutable archives for historical wording and authority. Do not copy historical status into new status tables.
4. Update this index and the new canonical item note at a qualified milestone; do not create another full-text archive.

<!-- D418 LEGACY COMPATIBILITY BEGIN: fixed original heading sequence -->
<details>
<summary>Legacy heading compatibility (historical navigation)</summary>

Each original heading links directly to its section in the byte-exact archive.

# barocss CAD roadmap

[Read archived section](roadmap-history-through-D417.md#barocss-cad-roadmap)

## Current execution index — 2026-10-30

[Read archived section](roadmap-history-through-D417.md#current-execution-index-%E2%80%94-2026-10-30)

### 현재 마감할 항목

[Read archived section](roadmap-history-through-D417.md#%E1%84%92%E1%85%A7%E1%86%AB%E1%84%8C%E1%85%A2-%E1%84%86%E1%85%A1%E1%84%80%E1%85%A1%E1%86%B7%E1%84%92%E1%85%A1%E1%86%AF-%E1%84%92%E1%85%A1%E1%86%BC%E1%84%86%E1%85%A9%E1%86%A8)

### 남은 기능 묶음

[Read archived section](roadmap-history-through-D417.md#%E1%84%82%E1%85%A1%E1%86%B7%E1%84%8B%E1%85%B3%E1%86%AB-%E1%84%80%E1%85%B5%E1%84%82%E1%85%B3%E1%86%BC-%E1%84%86%E1%85%AE%E1%86%A9%E1%84%8B%E1%85%B3%E1%86%B7)

### 07 delivery ledger — reconciled 2026-10-29

[Read archived section](roadmap-history-through-D417.md#_07-delivery-ledger-%E2%80%94-reconciled-2026-10-29)

### GitHub research reconciliation — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#github-research-reconciliation-%E2%80%94-2026-10-29)

### Static engine-audit follow-ups — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#static-engine-audit-follow-ups-%E2%80%94-2026-10-29)

### Native OPFS conditional-write report — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#native-opfs-conditional-write-report-%E2%80%94-2026-10-29)

### Controlled Stop wrong-edit rollback — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#controlled-stop-wrong-edit-rollback-%E2%80%94-2026-10-29)

### Original skeleton-file independent reader supplement — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#original-skeleton-file-independent-reader-supplement-%E2%80%94-2026-10-29)

### Later independent receipt and exact original UI supplements — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#later-independent-receipt-and-exact-original-ui-supplements-%E2%80%94-2026-10-29)

### Additional package acceptance gates — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#additional-package-acceptance-gates-%E2%80%94-2026-10-29)

### GitHub issue intake after the 2026-10-29 reconciliation — 2026-10-30

[Read archived section](roadmap-history-through-D417.md#github-issue-intake-after-the-2026-10-29-reconciliation-%E2%80%94-2026-10-30)

### 제품 완료와 인계의 공통 조건

[Read archived section](roadmap-history-through-D417.md#%E1%84%8C%E1%85%A6%E1%84%91%E1%85%AE%E1%86%B7-%E1%84%8B%E1%85%AA%E1%86%AB%E1%84%85%E1%85%AD%E1%84%8B%E1%85%AA-%E1%84%8B%E1%85%B5%E1%86%AB%E1%84%80%E1%85%A8%E1%84%8B%E1%85%B4-%E1%84%80%E1%85%A9%E1%86%BC%E1%84%90%E1%85%A9%E1%86%BC-%E1%84%8C%E1%85%A9%E1%84%80%E1%85%A5%E1%86%AB)

## Historical contracts and execution records

[Read archived section](roadmap-history-through-D417.md#historical-contracts-and-execution-records)

## Foundation before Studio (owner order, 2026-10-26)

[Read archived section](roadmap-history-through-D417.md#foundation-before-studio-owner-order-2026-10-26)

## Joint and robot completion plan (owner update, 2026-10-27)

[Read archived section](roadmap-history-through-D417.md#joint-and-robot-completion-plan-owner-update-2026-10-27)

## Goal and staged expansion (2026-10-25)

[Read archived section](roadmap-history-through-D417.md#goal-and-staged-expansion-2026-10-25)

### First implementation boundary

[Read archived section](roadmap-history-through-D417.md#first-implementation-boundary)

## Reliability priorities from research index 2214

[Read archived section](roadmap-history-through-D417.md#reliability-priorities-from-research-index-2214)

## CAD result acceptance: review 2215

[Read archived section](roadmap-history-through-D417.md#cad-result-acceptance-review-2215)

### Delivery and cross-owner resolution

[Read archived section](roadmap-history-through-D417.md#delivery-and-cross-owner-resolution)

## Workflow completion cases from SolidCraft

[Read archived section](roadmap-history-through-D417.md#workflow-completion-cases-from-solidcraft)

## Shared route bundles and virtual clips (Zip Ties)

[Read archived section](roadmap-history-through-D417.md#shared-route-bundles-and-virtual-clips-zip-ties)

## CAD-to-simulation handoff: issue 2209 planning boundary

[Read archived section](roadmap-history-through-D417.md#cad-to-simulation-handoff-issue-2209-planning-boundary)

## Completion gates for virtual experiments

[Read archived section](roadmap-history-through-D417.md#completion-gates-for-virtual-experiments)

## Reporting experiment progress

[Read archived section](roadmap-history-through-D417.md#reporting-experiment-progress)

## Order now (2026-10-27)

[Read archived section](roadmap-history-through-D417.md#order-now-2026-10-27)

### Near-term delivery ownership (2026-10-26)

[Read archived section](roadmap-history-through-D417.md#near-term-delivery-ownership-2026-10-26)

## Historical lane order (2026-10-25, owner: "필요한 것들 로드맵에 추가 해서 진행해줘")

[Read archived section](roadmap-history-through-D417.md#historical-lane-order-2026-10-25-owner-%E1%84%91%E1%85%B5%E1%86%AF%E1%84%8B%E1%85%AD%E1%84%92%E1%85%A1%E1%86%AB-%E1%84%80%E1%85%A5%E1%86%BA%E1%84%83%E1%85%B3%E1%86%AF-%E1%84%85%E1%85%A9%E1%84%83%E1%85%B3%E1%84%86%E1%85%A2%E1%86%B8%E1%84%8B%E1%85%A6-%E1%84%8E%E1%85%AE%E1%84%80%E1%85%A1-%E1%84%92%E1%85%A2%E1%84%89%E1%85%A5-%E1%84%8C%E1%85%B5%E1%86%AB%E1%84%92%E1%85%A2%E1%86%BC%E1%84%92%E1%85%A2%E1%84%8C%E1%85%AF)

## Codex lane ownership and R7 readiness (2026-10-24)

[Read archived section](roadmap-history-through-D417.md#codex-lane-ownership-and-r7-readiness-2026-10-24)

### Historical R7 preparation and hold records

[Read archived section](roadmap-history-through-D417.md#historical-r7-preparation-and-hold-records)

### Historical residual work assignments (2026-10-25, before final qualification)

[Read archived section](roadmap-history-through-D417.md#historical-residual-work-assignments-2026-10-25-before-final-qualification)

## Where we are

[Read archived section](roadmap-history-through-D417.md#where-we-are)

## Phase 0: only what a green baseline needs, now

[Read archived section](roadmap-history-through-D417.md#phase-0-only-what-a-green-baseline-needs-now)

## Phase 1: the roadmap, per lane (starts as each lane's Phase 0 items close)

[Read archived section](roadmap-history-through-D417.md#phase-1-the-roadmap-per-lane-starts-as-each-lane-s-phase-0-items-close)

### Kernel lane: finish the frame track (FRk)

[Read archived section](roadmap-history-through-D417.md#kernel-lane-finish-the-frame-track-frk)

### Outer lane: A9, brief → buyable, manufacturable product

[Read archived section](roadmap-history-through-D417.md#outer-lane-a9-brief-%E2%86%92-buyable-manufacturable-product)

### GPU lane: viewer track G21–G25

[Read archived section](roadmap-history-through-D417.md#gpu-lane-viewer-track-g21%E2%80%93g25)

### Next items (2026-10-23)

[Read archived section](roadmap-history-through-D417.md#next-items-2026-10-23)

### Robot samples and motion (owner, 2026-10-24)

[Read archived section](roadmap-history-through-D417.md#robot-samples-and-motion-owner-2026-10-24)

### Real products (owner, 2026-10-24)

[Read archived section](roadmap-history-through-D417.md#real-products-owner-2026-10-24)

### Photoreal rendering G15 (owner, 2026-10-24)

[Read archived section](roadmap-history-through-D417.md#photoreal-rendering-g15-owner-2026-10-24)

### Toward commercial grade (2026-10-24; the owner's order: CG1, CG2, CG5, CG6 first)

[Read archived section](roadmap-history-through-D417.md#toward-commercial-grade-2026-10-24-the-owner-s-order-cg1-cg2-cg5-cg6-first)

### RS7: rotor head and swashplate (owner, 2026-10-25)

[Read archived section](roadmap-history-through-D417.md#rs7-rotor-head-and-swashplate-owner-2026-10-25)

## Phase R: refactoring, once the current items close (owner, 2026-10-23)

[Read archived section](roadmap-history-through-D417.md#phase-r-refactoring-once-the-current-items-close-owner-2026-10-23)

## Item index (one line each; the /lanes pane shows the owner's Korean title after " · ko: ")

[Read archived section](roadmap-history-through-D417.md#item-index-one-line-each-the-lanes-pane-shows-the-owner-s-korean-title-after-%C2%B7-ko)

## Later (on the roadmap, not started)

[Read archived section](roadmap-history-through-D417.md#later-on-the-roadmap-not-started)

## Waiting on the owner

[Read archived section](roadmap-history-through-D417.md#waiting-on-the-owner)

## Off the roadmap (owner decisions)

[Read archived section](roadmap-history-through-D417.md#off-the-roadmap-owner-decisions)

## Viewer SDK and app delivery (dedicated Work, updated 2026-10-27)

[Read archived section](roadmap-history-through-D417.md#viewer-sdk-and-app-delivery-dedicated-work-updated-2026-10-27)

### D321 originating-work Stop qualification — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d321-originating-work-stop-qualification-%E2%80%94-2026-10-29)

### Viewer app review and design proposal intake — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#viewer-app-review-and-design-proposal-intake-%E2%80%94-2026-10-29)

### D322 late Save ownership qualification — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d322-late-save-ownership-qualification-%E2%80%94-2026-10-29)

### Viewer draft asserted UI evidence supplement — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#viewer-draft-asserted-ui-evidence-supplement-%E2%80%94-2026-10-29)

### D323 canonical snapshot qualification — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d323-canonical-snapshot-qualification-%E2%80%94-2026-10-29)

### D322 independent author-receipt review supplement — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d322-independent-author-receipt-review-supplement-%E2%80%94-2026-10-29)

### D324 delayed GPU pick ownership qualification — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d324-delayed-gpu-pick-ownership-qualification-%E2%80%94-2026-10-29)

### D321 independent review and Render-history evidence correction — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d321-independent-review-and-render-history-evidence-correction-%E2%80%94-2026-10-29)

### Studio modernization proposal intake — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#studio-modernization-proposal-intake-%E2%80%94-2026-10-29)

### D325 clipping boundary and next priority — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d325-clipping-boundary-and-next-priority-%E2%80%94-2026-10-29)

### Direct owner priority — App decomposition, 2026-10-29

[Read archived section](roadmap-history-through-D417.md#direct-owner-priority-%E2%80%94-app-decomposition-2026-10-29)

### D326 selected qualification — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d326-selected-qualification-%E2%80%94-2026-10-29)

### GPU material authoring and Studio evidence intake — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#gpu-material-authoring-and-studio-evidence-intake-%E2%80%94-2026-10-29)

### D327 direct-priority App decomposition — complete locally (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#d327-direct-priority-app-decomposition-%E2%80%94-complete-locally-2026-10-29)

### Drawing assistant and material-map evidence intake — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#drawing-assistant-and-material-map-evidence-intake-%E2%80%94-2026-10-29)

### DA-1a supplementary document/API receipt — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#da-1a-supplementary-document-api-receipt-%E2%80%94-2026-10-29)

### D328 second App decomposition — qualified (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#d328-second-app-decomposition-%E2%80%94-qualified-2026-10-29)

### DA-1c supplementary fix and standalone SVG evidence — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#da-1c-supplementary-fix-and-standalone-svg-evidence-%E2%80%94-2026-10-29)

### DA-DUP-1 — P2 independent-hole location dimension removed as duplicate (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#da-dup-1-%E2%80%94-p2-independent-hole-location-dimension-removed-as-duplicate-2026-10-29)

### DA-DUP-1 runtime differential supplement — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#da-dup-1-runtime-differential-supplement-%E2%80%94-2026-10-29)

### D323/A04 snapshot retained-receipt review — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d323-a04-snapshot-retained-receipt-review-%E2%80%94-2026-10-29)

### D324/A07 delayed pick retained-receipt review — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d324-a07-delayed-pick-retained-receipt-review-%E2%80%94-2026-10-29)

### D325/A08 clipping retained-receipt review — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d325-a08-clipping-retained-receipt-review-%E2%80%94-2026-10-29)

### D326 selected Open ownership retained-receipt review — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#d326-selected-open-ownership-retained-receipt-review-%E2%80%94-2026-10-29)

### GPU003 fresh owned logical-device recovery evidence — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#gpu003-fresh-owned-logical-device-recovery-evidence-%E2%80%94-2026-10-29)

### GPU004 custom CSS/live-uniform recovery evidence — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#gpu004-custom-css-live-uniform-recovery-evidence-%E2%80%94-2026-10-29)

### GPU005 packed texture-map recovery evidence — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#gpu005-packed-texture-map-recovery-evidence-%E2%80%94-2026-10-29)

### GPU006 two-instance recovery and reorder evidence — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#gpu006-two-instance-recovery-and-reorder-evidence-%E2%80%94-2026-10-29)

### D329 nonserialized import and stage ownership — qualified (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#d329-nonserialized-import-and-stage-ownership-%E2%80%94-qualified-2026-10-29)

### Further App decomposition candidate — owner feedback, 2026-10-29

[Read archived section](roadmap-history-through-D417.md#further-app-decomposition-candidate-%E2%80%94-owner-feedback-2026-10-29)

### Commercial-readiness issue intake and bounded Studio recovery — 2026-10-29

[Read archived section](roadmap-history-through-D417.md#commercial-readiness-issue-intake-and-bounded-studio-recovery-%E2%80%94-2026-10-29)

### D330 Worker and wire lifetime — qualified (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#d330-worker-and-wire-lifetime-%E2%80%94-qualified-2026-10-29)

### D331 independent drawing location ownership — qualified (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#d331-independent-drawing-location-ownership-%E2%80%94-qualified-2026-10-29)

### Direct owner priority: selection visibility — D332, 2026-10-29

[Read archived section](roadmap-history-through-D417.md#direct-owner-priority-selection-visibility-%E2%80%94-d332-2026-10-29)

### D332 base selection visibility — qualified (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#d332-base-selection-visibility-%E2%80%94-qualified-2026-10-29)

### Existing Model/drawing review supplement — intake only, 2026-10-29

[Read archived section](roadmap-history-through-D417.md#existing-model-drawing-review-supplement-%E2%80%94-intake-only-2026-10-29)

### Electron execution validation — queued under15 desktop (owner, 2026-10-29)

[Read archived section](roadmap-history-through-D417.md#electron-execution-validation-%E2%80%94-queued-under15-desktop-owner-2026-10-29)

### D333 rectangular two-axis cut feature pattern — qualified (2026-10-29)

[Read archived section](roadmap-history-through-D417.md#d333-rectangular-two-axis-cut-feature-pattern-%E2%80%94-qualified-2026-10-29)

### Existing API/domain boundary review — intake only, 2026-10-29

[Read archived section](roadmap-history-through-D417.md#existing-api-domain-boundary-review-%E2%80%94-intake-only-2026-10-29)

### D343 — Longitudinal mass and actual Offset result qualification (2026-10-30)

[Read archived section](roadmap-history-through-D417.md#d343-%E2%80%94-longitudinal-mass-and-actual-offset-result-qualification-2026-10-30)

### D344 — Native whole-patch conditioning and default STEP proof (2026-10-30)

[Read archived section](roadmap-history-through-D417.md#d344-%E2%80%94-native-whole-patch-conditioning-and-default-step-proof-2026-10-30)

<a id="additional-package-acceptance-gates--2026-10-29"></a>

[Read archived package acceptance section](roadmap-history-through-D417.md#additional-package-acceptance-gates-%E2%80%94-2026-10-29)

</details>
<!-- D418 LEGACY COMPATIBILITY END -->
