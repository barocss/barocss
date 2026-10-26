# CAD 인수인계 — 작업 중 초안

갱신: 2026-10-26T05:51:27.681064+00:00. **작업 중, 일시 중단 아님, 최종 push 미실행.** 실제 주간 사용69%/남음31%, secondary unknown. 어느 유효 창이든 남음5% 이하면 새 작업 중지→안전 checkpoint→검증된 commit 통합/최소검사→정상 마감 commit→origin feature branch 정상 push/원격 SHA 확인→cad 자동화 PAUSED. reset/credits를 사용하지 않습니다.

## 먼저 대조할 것

실행 목록은 기존 `coordinator-api-active-20261025.json`의 `roadmapExecution.tasks/laneAssignments/laneControl` 하나입니다. 이 문서와 repo checkpoint는 재개용 snapshot입니다. 실제 HEAD와 각 owner의 새 보고가 우선합니다. 수신과 실제 착수, 실행 반환과 archive 반환을 구분합니다.

- authority: `/Users/user/.cache/barocss-preserved/2026-10-24-codex-integration/round3/coordinator-api-active-20261025.json`
- aggregate: `codex/cad-current-source-aggregate-20261025`, `/Users/user/github/barocss/barocss/.claude/worktrees/confident-fermi-29a815`, HEAD `056d2927ce97b245d5a8934ed9705d2caa068655`.
- 제품: `review/cad-gpu-engine-2026-10-14`, `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-review-efbb2c`, 통합·검사 코드 기준 `91e96a2361a7b483a1915da822d07b495e766848`, 문서 checkpoint 병합 `5e6a559e548845fdc169a753834519b3c2e6b1ee`. 이 인수인계 commit 이후 실제 HEAD를 다시 읽습니다.
- origin: `https://github.com/barocss/barocss`. 마지막 원격 관측 `16eabdd8e55ff3bb8cb77bfa2769e1e7049be715`는 과거값이며 최종 push 직전에 다시 확인합니다. force/main/develop push 금지.
- 제품의 portable 초안4파일은 `44a8fc9e`에 이미 정상 commit했습니다. 실제 스케치 저장2파일을 포함합니다. 이 출력 초안의 더 새 상태는 다음 checkpoint에 repo로 반영합니다. raw 전체가 GitHub에 있다고 주장하지 않습니다.

## 현재 진행과 다음 행동

| 담당 | 실제 상태 | 다음 행동·조건 |
|---|---|---|
| Kernel | 제품91e96a build1+선택1 PASS·62봉인과2454보존dist 파일 독립 검토 수락·완전반환 | 새 source 구현은 정확 다음 배정 후 진행. 제품 검사를 반복하지 않음 |
| Docs | 공통1a7 check/site·실제 Sketches1페이지3PNG 완료, root43봉인/PNG3 수락 | Kernel 제품 runtime/archive 반환뒤 정확 제품SHA의 필수 check-docs1. 공통site/browser 반복0 |
| Outer | SC 실제 연관 편집 FAIL, 원311자료·UndoRedo/SaveOpen·source/runtime/archive 반환 수락 | SC-ASSOCIATIVE-REPAIR-01 최소 계약/정확7허용경로 배정. 본인branch 정확hunk 정상commit→고정원례 검증. 기존WIP 보존 |
| GPU | readback2파일 제품반영·제품44a 필수docs PASS. 기존 단면 양backend 범위 수락 | 관련 새 consumer 계약이 확정되면 배정. 완료 검사를 반복하지 않음 |
| Drawings | 교정된 기존 호환3PASS·25봉인 수락, 제품91e96a에 시험파일 반영 | 별도 drill/tap field 계약이 정해지면 정확 소비 변경. 기존 compat3 반복0 |
| root | 검증7경로 noff와 예상 union tree/bytes/foreign33/portable4/old818 보존 확인 | 제품 검증 마감·현 roadmap 문서 checkpoint 반영·SC 계약/파일소유 배정. 다른Work 하위agents 지휘0 |

## 완료 근거와 원 실패

- 제품 `3b1f3b339`의 J2·Drawing·export notes·R1·guide 묶음은 필수 제품 docs PASS입니다. J2 실제14관측, Drawing 공개5Move/34glyph/DXF, R1 Model bounded static checks는 각각의 원 범위입니다.
- GPU2파일 noff `f10474544`와 portable4 추가 `44a8fc9e`: 필수 제품 check-docs PASS, summary34/0/47/3755/735·stderr0. source3168/foreign33/CAD818/GPU512 전후불변, 원32봉인 rootpeer 검토. aggregateGPU262와 제품512를 혼동하지 않습니다.
- 공통 `1a7f2266`의 revolve: 최종 exact e063 소스에서 build1+동결5case PASS, 생산1lint PASS. 최초 원4PASS1FAIL(test80 GEOMETRY)과 중간8EPS미채택안 보존. expected/direct/BRep V=1.3483831066349072/1.348383106634906/1.348383106634922, 기존상대1e-12. 실WebGPU3뷰와 접선거부1 수락. defaultBRep검사이며 원raw strictBrep명칭오류는정정sidecar보존, 추가strict:true NOTRUN. Studio회전저작UI·실측·전체법선검증아님.
- Sketch Model5+진단1·Modeltypes/lint는 원scope PASS. Enter 교정뒤 driving10.0000004, 독립길이10.000000419678194, 잔차1.96782e-8<=기존1e-7. 실제Save/Open은 ID/nextId차이를구분. 표시1행교정뒤1440/Dock300과1200/Dock280에서 전체값표시, focus가로scroll0. 최종Studio type1588(pre1176/POST412) 보존. 최초원EnterFAIL/servedsourceFAIL 보존.
- Drawing 원2PASS1FAIL은 파생값2.5000000000000004의bit-equality시험가정. 생산/명목/저장값변경없이 파생길이4assert만기존mm/paper-mm경계abs1e-9로교정, 공통1a7 실제3PASS. gate75/Node0 시도와 원시험FAIL은 별개입니다.
- 공통1a7 check/site 각첫1PASS. 실제Sketches1페이지2새문단/그림/3headinglink·PNG3직접view, 원43sizeSHA검토. rawseal에mode없으므로봉인대비mode동일성미증명. MJS234/stderr19328/favicon404원형보존. CLI CDP미제공과공식CUA표시근거분리, 자기server53196/tab닫음·기존보존.

## 현재 제품 통합의 검증 경계

제품 `91e96a23`은 공통1a7의 정확7경로를 noff 채택했습니다. 예상 union tree `ad8ca89e779c469f03ce6eb6a7a638ec8eab1b86`와 실제가 같고, 해당7bytes·제품portable4/foreign33/oldCAD818이 같습니다. aggregate baretree와 같다는 뜻은 아닙니다. 원failedrevolve는이후고쳐져공통native5/browser가통과했으며옛실패이유는보존합니다.

제품91e96a 새build와 선택endpoint1은 **PASS**, 필수제품docs는 **PENDING**입니다. 실제build session25495/finalebd6e8wait0, 선택7d289c directexit0/별도wait없음, 각4exit/release0/ownslot부재. TAP1PASS·SKIP0, 탈락4는TAP미출력. 원62봉인과old/new/after 총2454보존dist파일size/hash/mode 일치. 제품fresh818은공통fresh818과bytes/kind/mode가같습니다. 공통PASS를 새제품실행으로 재라벨하지 않습니다. Kernel lease `cad-91e96a-product-revolve-build-endpoint1-0001-lease-20261026.json`, SHA d328399aa3a8121f5b1623a8409c95fe0777d996b2ef72c426a64f0f69c2055c. 새build이후fresh818 대조를 마쳤습니다. 추가전체native/Model/Studio/browser재실행없음.

## 지금 해결할 실제 연관 스케치 문제

`SC-ASSOCIATIVE-EDIT-01`: Box40×24×8→실상면outline→inward2→Cut4 ring 기준V6720. 원폭60뒤V10560, 연관기대10240. n2 outer40/hole36잔류, BodyRef/cutlinks보존. n0.max외n1.made제거도기록했으며단일원인으로단정하지않습니다. Undo6720/Redo·실SaveOpen10560. 원311sizeSHA와PNG2직접확인. 원face/offsetrecipe가없던snapshot경로이며저장faceID소실/naming전체결함으로확대하지않습니다.

신규 명시적 연관동작에만 optional persistent recipe+source dependency를 넣는 최소계약의 교차 검토를 마치고 Outer에 정확 허용파일과 source-first 구현을 배정했습니다. 기존snapshot을자동재해석하지않음, stable reference검증/모호·누락거부, plane/offset/편집유지·detach/assemblyflatten의명시지원경계를정한뒤정확ownercommit을배정합니다. 수정소스·수정후검증은아직NOTRUN입니다. 원례파일은 `outputs/sc-associative-edit-failure-20261026/`에복사했습니다.

## 자원과 재개 규칙

Kernel52032 실제 parent13822/child13856/session79248/slot13822. 현재값은owner새관측과대조한뒤사용합니다. 옛PID신호금지. Docs5173/54731, 사용자탭/프로필/foreign3/WIP 보존. HTTP200만으로가용성판정하지않고serveddecodedsource와disk를비교합니다.

Vite stale-source 실원인은 UNKNOWN. 설치Vite8/chokidar3.6/fsevents·ignored/env를읽었지만실watcherevent/atomicreplacechain은미수집입니다. 다음승인된실파일편집때inode/time→watcherevent→modulekeyinvalidate를한번연결관측할수있으며근거없는config변경/재시작반복을하지않습니다.

native/build/generator heavy1. pinnedNode `/Users/user/.cache/barocss-toolchains/node-v22.23.3-darwin-arm64/bin/node`, 원stage `round3/rs6-facade-1b2b-focused-runner/stage.zsh`, SHA c8ce314ae634cfe9bf93a47391fca459f282e05fbbb84b8bc99eef738a3fd4d1. env-i/cacheoff/고유tmpemptyZDOT, actualwait또는directexit/4stageexit/releaseSTARTEXIT/ownslot읽기관측. 자손/fullgraph미증명. 지원slot1일때추가native는원gate allowed>holders 필요, 소유서버교체는본인slot반환후재취득. guard/slot수동우회0.

각Work는본인기존branch의허용파일정상commit, root가exactdelta통합. 외부dirtyApp전체stage금지. 정상identity easylogic<cyberuls@gmail.com>. 과거4identity실수원SHA보존. reset/rebase/amend/newWT/force/deps/WASM/tol완화0. 단위/참조차이는producer-consumer계약→변환경계한곳→담당/고정oracle→최소검증으로해결합니다.

Physics archived Execute Physics 소유미확정, solver/profile수정·COMsphereI에pivotIp대입금지. P2제조HOLD·PG11미확정·PG12원PASS·pausedMotion/FOV·기존BVH/LOD보류유지. 현재정적관절/과거untrustedrecord는freeforward/contact/실측인증아님. 원ZIP/fullps/preps소실자료복구주장0.

## 다음 AI의 첫 행동

1. 실제사용량과위authority·각HEAD·owner단일targetsnapshot을대조합니다. quota<=5이면정지마감분기, 그전에는승인작업계속.
2. Kernel제품실반환을받아원log/oldnewdist/선택TAP/slot/foreign를수락하고관련Docs정확새SHA의필수check1을배정합니다. 같은검사반복0.
3. roadmap 문서만 변경한 `056d2927`와portablehandoff갱신은실제품writer/archive반환후통합해최종검사SHA를명시합니다. Library본문/생산bytes불변이면기존commoncheck/site반복0.
4. Outer SC 최소계약에파일소유·Backward/flatten/거부·고정oracle를명시하고정상commit→공개사례검증을이어갑니다. 현재단위차이때문에전체를멈추지않습니다.
5. 승인된모든일이끝나거나실제외부제약만남을때정확재개조건을남깁니다. 다른Work가모두끝날때까지독립후속을묶지않습니다.

## 근거 범위와 portable 자료

실제스케치Save2파일은제품44a의 `apps/cad-studio/handover/evidence-20261026/`에있습니다. 이초안은최종raw전체를repo에담았다는뜻이아닙니다. root의보고서는 `outputs/sketch-precision-visibility-verified-20261026/`, `outputs/gpu-readback-product-adoption-20261026.md`, `outputs/sketch-extrude-cut-verified-20261026/`, `outputs/sc-associative-edit-failure-20261026/`입니다. 상세receipt와immutablecommit/source를authority와함께대조하세요. 원격push/최종정지/실측/제조/전체프로젝트완료는아직없습니다.
