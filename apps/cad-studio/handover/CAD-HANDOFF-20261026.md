# CAD 인수인계 — 작업 중

이 문서는 기존 단일 작업 기록의 이동용 사본입니다. 별도 작업 목록이 아닙니다. 작업과 자동화는 계속 중이며 원격 push는 하지 않았습니다. 실제 HEAD와 최신 담당 반환을 먼저 확인합니다.

## 재개 기준

같은 폴더의 `cad-coordinator-checkpoint-20261026.json`을 읽고 실제 사용량과 담당 상태를 대조합니다. 로컬 작업 권위는 `/Users/user/.cache/barocss-preserved/2026-10-24-codex-integration/round3/coordinator-api-active-20261025.json`입니다. 원격 clone에 로컬 pending ref와 외부 원자료가 있다고 가정하지 않습니다.

Kernel·GPU·CAD·CAD Model 기반을 먼저 구현하고 같은 기능을 Studio에서 완성합니다. 기능 소스→필요한 한 배치→실제 소비·파일 흐름→제품 통합 순서입니다. 유효한 검사를 반복하지 않습니다.

## 제품에 반영한 G15 범위

검증한 제품 코드는 `28a62d2ec02f334f5fb7613fbb096e2926fd5b20`입니다. 정상 no-ff 부모는 이전 제품 metadata `5f0e1890809add671c11324d5c5e5f7d344dd7fb`와 검증 소스 `8cddcd05fd3a388472d5a01b4a43e09cdf8a50aa`입니다. 변경 23경로가 소스와 같으며 제품 독립 18경로와 실제 foreign32를 보존했습니다. 이 문서의 후속 commit은 metadata/evidence 변경입니다. 새 실행 PASS가 아닙니다.

- Point/spot 그림자 필드의 Model 저장·읽기, 공통 입력 거부, Studio 제어와 GPU 전달을 연결했습니다. CAD1mm=GPUworld1이며 반경의 추가 변환은 없습니다. 기존 intensity의 size²×0.05만 유지합니다. false·0·생략과 caster 예산을 보존합니다.
- 실제 독립 조명·반경2.5/4.25mm·잘못된 입력 거부·Undo/Redo·Save/New/Open·PNG export를 확인했습니다. 원 파일13개와 export PNG1개를 `evidence-20261027/g15/downloads/`에 그대로 보존했습니다. 최종/재Open JSON 의미는 같고 camera 키 순서만 달라 byte는 다릅니다.
- 거부 안내가 화면 밖에 남던 문제는 sticky class1곳으로 수정했습니다. 해당 실제 거부만 다시 확인했고 accepted 파일 byte가 유지됐습니다.
- 원22f Model5·Studio4·Modeltype PASS 뒤 Studio 시험의 TS2339가 발생했습니다. 빈 배열 assertion1곳만 정상 교정한 뒤 Studio type와 생산3 lint를 통과했습니다. 기존 첫3단계는 반복하지 않았습니다.
- API 목록은 6665→6666, 추가1/변경4/삭제0입니다. 검토한5행만 expected에 반영했습니다. 공통 문서/site와 실제 문서2페이지를 확인했습니다. 제품 첫 GPU emit288(JS144/선언144), 실제 type1188과 필수 docs35/0/47/3755/819는 PASS입니다. 기존 잔류240개는 새 emit이 아닙니다.
- 실제 제품28a에서 원 BCAD1회를 열어 조명·모델·바닥 그림자를 확인했습니다. 관련 served source11개는 sourceMap원문=Git=disk입니다. 오류·경고0입니다. 원 viewport PNG2장은 `evidence-20261027/g15/`에 있습니다. 담당과 root가 직접 봤습니다.

전체 GPU 품질, PCSS 원인 분리, spot 그림자 새 인수, 성능, 실측·제조·release 수락은 아닙니다. 초기 full 캡처의 탭 상태 변화는 원인 미확정으로 보존합니다. 이후 viewport 캡처에서는 같은 Lights 탭이 유지됐습니다. 본인 Chrome/Vite/slot과 모든 source 핀은 반환했습니다. 전체 후손 종료와 runtime read graph는 미입증입니다.

## 이미 마친 CG1

제품 `7a62d6dfd336659b57958bf5a5af64e17ddb9c0b`의 bounded copied-guide loft는 위 제품의 조상입니다. Model/Studio Preview·Apply·Undo/Redo·실제 파일 왕복을 마쳤고 실제 파일6개/PNG2개는 `evidence-20261027/cg1/`에 있습니다. 원곡선 편집을 나중에 추종하는 live 참조는 아닙니다. 기존 실패와 정확한 범위는 유지합니다.

## 현재 구현과 다음 행동

공통 소스는 `433a035ae03a61e55b0e03b6a9b9897083774800`이며 Outer의 공통 핀은 반환됐다. 제품에서 검증한 최신 코드는 CG2 `4bff492c6742cd5c4931ff83f0b35a606ed12230`이다. 후속 문서 commit은 새 기능 실행 PASS가 아니다. 전체01–19 색인은 `roadmap.md`, 실제 배정은 기존 단일 작업 기록만 사용한다.

- 03 절삭 반복: 공통433에서 거부·복구·Apply·Undo/Redo·실제 Save/New/Open을 확인했다. 제품4bff에 정확16경로를 no-ff 통합했고 CAD build와 수정 후 docs는 통과했다. 최초 stale preview와 문서 첫 실패는 보존한다. 공통 실제 화면은 담당이 직접 봤으나 별도 PNG는 남지 않았고, 제품 자체 브라우저는 NOT_RUN이다.
- 01/11/16 도면과 저장: standalone의 실제 파일·SVG·상태행 입력을 마쳤다. 최신 reader/writer에서 standalone·composite의 raw 입력과 필드 보존을 완성해야 한다. 미출시 구버전 호환 때문에 schema5를 강제하지 않고 일반3/route4를 유지한다. Model과 Drawing의 기존 후보는 이력으로 남기며 필요한 delta를 새 계약에 맞춰 연결한다. 사용자 파일과 snapshot key/id/parent/bytes는 보존한다.
- 04 Docs: 공통a94까지 채택했다. private189의 실제 Model3 결과/그림과 새8샘플은 PASS다. 전체164의159PASS/2FAIL/3CANCELLED, spring과CLI 첫 실패를 보존한다. 최종 공통 공개 목록·check/site·필요 페이지는 아직 실행하지 않았다.
- 05 Viewer: 기존 정상10 묶음은 공통 채택·제품 미채택이다. 소유 워크의 새 키보드/작은 화면/실패 보존·조립품 거리·리뷰 완료 보고는 새 정상 commit과 근거 반환을 확인 중이다. 제한 IGES·파일 닫기·실제 사용자 파일/장치 손실은 해당 범위로 남긴다. stopped packaging/config/hook은 재개하지 않는다.
- 06 GPU: fe2637 PT,607 RenderTarget,8de sized target,5d8 제한 GLB와2a35 target.asTexture는 소유 검사·합성 공개 사례와 정리를 마쳤다. 2a35 초기 sandbox 실패는 보존했다. 29fd 내장 PNG/JPEG GLB 텍스처의 첫 emit 오류와 partial 출력을 보존했다. 교정 d4e2의 emit·CPU6·WebGPU1·lint4와 합성 PNG/JPEG 공개 예제는 소유 검사에서 통과하고 자원을 반환했다. 일반 glTF·Studio 수락은 아니다. 사용자 지정 다른 위치가 GPU 병합을 맡는다.
- 07 Kernel: K02~K07 정상 소스와 spring41c 최소 교정은 공통 미채택·실행 NOT_RUN이다. 원 WIP·공차·최초 실패를 보존하고 실제 공통 핀 반환 뒤 정확 기능 단위로 연결한다.
- API: `api-public-model-direction-20261027.md`에 따라 CAD Model을 편집 원본과 기본 Part/Assembly 진입점으로 삼고 커널은 독립 계산 계층으로 유지한다. 전체 메서드 차이·호환 이행과 물리적 패키지 통합은 아직 완료·확정되지 않았다.

담당은 내부 분할·취합과 자기 자원 반환을 맡는다. 독립 소스는 병렬로 진행하고 실제 공유 기하·무거운 실행은 조정한다. 완료한 검사를 반복하거나 부분 PASS를 전체 기능·제품 PASS로 올리지 않는다.

## 후속 실제 결과 — 원 실행과 구분

- 공통03: 1c48의 CAD build/CAD4/API4는 PASS다. command의 중복 선택 거부 기대가 실패해 시험만87327로 교정했고 command2·Model/Studio type·lint13을 PASS했다. 원 FAIL은 그대로다.
- 실제 UI에서 Spacing0 오류와 Apply 비활성인데 이전 preview가 남았다. App의 현재값 확인·구결과 차단·preview clear만 dca→433으로 정상 채택했고 Studio type/lint1은 PASS했다. 수정 후 유효/무효·Apply·Undo/Redo와 실제 Save/New/Open을 공통433에서 확인하고 자원을 반환했다. 제품 별도 브라우저는 NOT_RUN이다.
- 도면01: 87327의 전용 상태행/표제란 비중첩과 실제 입력을 PASS했고 root도 PNG를 직접 봤다. 파일·SVG·native는 반복하지 않았다. 다만 현재 제품 reader가 dim 없는 standalone을 버리므로 최신 reader/writer의 필드 보존을 제품 선행으로 배정했다.
- 저장 보호: 사용자 요청에 따라 미출시 구버전 호환과 schema5 강제는 제외한다. 현재 일반 schema3/route4의 최신 reader/writer·raw 검사·snapshot identity를 하나의 기능으로 완성한다. Kernel=Model/버전, Outer=저장·복구, Drawings=raw/화면이다. 실사용 파일은 보존한다. 복구 자동 이동·삭제와 Discard 삭제는 자동 승인 검토가 데이터 손실 위험으로 거부해 우회하지 않았다. 담당이 삭제 없는 기각과 일반 단일 사용자 저장 유지 방식을 구현 중이며 합동 실행·제품은 미완료다.
- GPU03.1은5d8b77의 새emit294/CPU18/lint3·합성WebGPU 공개사례를 마치고 전반환했다. 원TS2352/partialemit과 실제수리plan420691의 provenance를 보존한다. 물리적외부asset/texture/skin/morph 수락이나 root제품병합이 아니다. GPU02.2는2a35e9의 소유 검사와 합성 공개 사례를 마쳤다. 후속 d4e2는 첫 emit 오류2건 보존 후 한정 PNG/JPEG 합성 예제와 필수 검사를 마쳤다.

## 최근 작업과 남은 범위

- GPU04.1 `133d29e9bbf640b035930b4210f9d6943917409e`는 GLB 32비트 삼각 인덱스의 정상 소스다. 빌드·시험·공개 브라우저와 제품 통합은 NOT_RUN이다. GPU 소유 브랜치에 있으며 다른 통합 담당에게 인계한다.
- Viewer 4.3의 강제 오류 검사에서 복구 거부 이유가 콘솔에만 표시되고 초기화 실패 뒤 생성 장치의 종료가 관측되지 않았다. GPU가 장치 정리와 실패 전달, Viewer가 사용자 표시를 맡았다. 자연적인 하드웨어 고장으로 일반화하지 않는다. 원 실패와 관련 실제 화면은 소유 작업의 `outputs/cad-viewer-device-20261027/`에 있다.
- 도면은 사용자 지시에 따라 미출시 구버전 호환을 위한 schema5 강제를 제거한다. 최신 schema3/route4 reader·writer의 필드 보존을 구현 중이다. Drawings 정상 child `47c2abe01800fae1ec44d60c85062674e8a20f14`는 미실행 소스다. Kernel 연결·Outer 저장·실제 파일·공통/제품 통합은 남았다.

## 중단·push 조건

이번 저장 관측은 사용93%/남음7%, secondary unavailable이다. 재개할 때 실제 도구로 다시 확인한다. 어느 유효 Codex 창이든 남음5% 이하면 전체6담당과 자체 agent의 새 작업/자동next를 멈추고 안전 checkpoint·source/runtime/archive 반환을 받습니다. 검증된 exact commit만 필요한 최소 통합을 마칩니다.

미완료/NOTRUN·담당·재개 조건·로컬/원격 SHA를 적고 정상 commit합니다. root만 사용자 승인된 origin feature branch를 normal push하고 원격 SHA를 확인한 뒤 cad 자동화를 PAUSED로 바꿉니다. force/main/develop rewrite/PR/release/reset/credits 사용은 금지합니다. 기존 중단·권한·브랜치 보호는 유지합니다. P2 제조인수는 사용자 지시로 활성 추적·정기 보고에서 제외하며 과거 HOLD·미수락 기록은 보존합니다.

## 최신 도면 소스 반환 — 공통 및 제품 미반영

- Drawings 정상 child `b0caf6bc75c97f09e6f317fdf4904a7dd7e7dcba`는 부모 `47c2abe01800fae1ec44d60c85062674e8a20f14` 위에 `freeState`와 `tangentPlane`의 명시적 false를 읽기와 재저장에서 보존한다. Open은 원본 파일을 변경하지 않는다. 현재 소스와 정적 점검만 반환했으며 시험·브라우저·제품은 미실행이다.
- Model 정상 child `95104906946c07c4c65ec2b00d00bd1498187721`의 부모는 공통 `433a035ae03a61e55b0e03b6a9b9897083774800`이다. 일반 schema3/route4와 snapshot identity를 유지하면서 정규화 전 도면 원본을 검사한다. Drawings의 검사 함수가 선행 필요하며 실제 시험·제품은 미실행이다.
- 공통 도면 작업은 기존 schema5 중간 이력을 가져오지 않고 `4e1dacc5c1b13a38b0fbaa4ef515db8086ead613`부터 `b0caf6bc75c97f09e6f317fdf4904a7dd7e7dcba`까지의 필요한 변경만 선택한다. 기존 공통 `drawing/issues.ts`의 충돌 보호를 보존하고 datum 검사 두 곳만 반영해야 한다. 다른 11경로의 공통 선행 파일 일치는 확인했다. 작업 ref는 로컬에만 있을 수 있으므로 원격 clone에 존재한다고 가정하지 않는다.
- Outer는 공통 소스와 실행 자원 반환 뒤 복합 프레임 편집·Save/New/Open·잘못된 입력의 원본 보존을 실제 화면에서 확인한다. 아직 실행하지 않았다. 검증된 정확 소스만 제품에 통합한다.
- 이번 갱신 때 사용량은 94% 사용, 유효 창 잔여 6%였다. secondary는 확인할 수 없다. 실제 중단 여부는 다음 도구 확인값으로 판단한다.

## QUOTA_PAUSE — 2026-10-27

Codex core primary는 95% 사용, 5% 남았다. secondary는 확인할 수 없다. 사용자 조건에 따라 여섯 담당에게 새 작업, 자동 다음 작업, 추가 쓰기와 신규 실행 중단을 전달했다. 검증하지 않은 후보는 제품에 합치지 않았다. 재개할 때 실제 사용량이 5%를 초과하고 사용자 지시와 자원 반환 상태를 확인한다.

- Kernel: 개인 ref `codex/cad-current-drawing-contract-20261027`의 `95104906946c07c4c65ec2b00d00bd1498187721`, 부모 공통 `433a035ae03a61e55b0e03b6a9b9897083774800`. 기존 branch HEAD `ea838a312bcb8a1cc084ed56dd36213f08ac1361`, WIP 3개와 index 보존. source/runtime/slot/browser/archive 반환. 도면 source 결합 및 검사·제품 NOT_RUN.
- Drawings: `codex/cad-drawing-datum-inputs-20261025`의 `b0caf6bc75c97f09e6f317fdf4904a7dd7e7dcba`, 부모 `47c2abe01800fae1ec44d60c85062674e8a20f14`. WIP 9개와 index 보존. 신규 runtime/slot/browser/source pin 없음. 정확한 공통 결합, 원본 검사·실제 파일·제품 NOT_RUN.
- Outer: 정상 HEAD `dca48fc059fed996fd3de21ce61399e456dbdc8e`, 미커밋 11개는 `/Users/user/Documents/Codex/2026-10-24/cad-outer-20261024/work/outer-checkpoint-20261027/wip-inventory.json`과 일치. runtime/source pin 반환. 복합 프레임 브라우저·제품은 NOT_RUN. 복구 데이터 자동 삭제는 자동 승인 검토가 거부해 그대로 보존한다.
- GPU: 별도 저장소 `/Users/user/Documents/Codex/2026-10-24/cad-gpu-20261024/work/gpu-readback-camera-20261026/check-out`, branch `codex/gpu-readback-camera-20261026`, HEAD `861ab440897db1759a783e0ce3ee3741007f59b3`, 부모 `4187210f948af23aedd6d1e21f7a2e0e5e3b4a33`. 복구 실패 전달·정리 소스이고 emit/CPU/WebGPU/lint/browser는 NOT_RUN. slot/process 없음. 검증 계획 `outputs/gpu-device-recovery-20261027/validation-plan.json` SHA256 `cc548f27f2e1596a61d8f05a616aaef10891c38713d635c05a35ad3b5fce6240`. GPU04.1 `133d29e9bbf640b035930b4210f9d6943917409e`도 별도 미검증 소스로 보존. GPU 통합은 사용자 지정 담당이 한다.
- Docs: branch `codex/cad-docs-api-results-20261027`, HEAD `1036816497f5c6d625a7d610596e50d3d19f9c1f`. source clean, 실행 중인 소유 native/테스트 없음. 기존 서버 62039/62037/49260은 사용자 자원으로 보존. 공식 archive 반환은 미확인. 최종 공통 source/site/desktop 검사 NOT_RUN, docs heartbeat는 담당이 PAUSED.
- Viewer: 별도 저장소 `/Users/user/Documents/Codex/2026-10-26/cad-viewer-20261026/viewer-sdk`의 branch `codex/viewer-sdk-20261026` HEAD `286e7646f1b9d34672b48afe70ad9f4bfac8a761`, clean. 크기 변경 오류 재시도 주입 단위검사 11개 PASS이며 실제 메모리 부족·브라우저 자동 재통지·제품은 미검증. 중단 및 소유 자원 반환의 최종 담당 확인은 아직 대기 중이다.

공통 HEAD `433a035ae03a61e55b0e03b6a9b9897083774800`은 로컬에만 있을 수 있다. 검증된 최신 제품 코드는 `4bff492c6742cd5c4931ff83f0b35a606ed12230`이며 이후 문서 커밋은 새 제품 실행 PASS가 아니다. 원격 feature branch의 중단 직전 SHA는 `16eabdd8e55ff3bb8cb77bfa2769e1e7049be715`이고 이 SHA는 로컬 제품 HEAD의 조상임을 확인했다. 이 문서의 source-only refs와 외부 outputs는 자동으로 원격에 복사되지 않는다. 로컬 원본과 작업 디렉터리를 보존하고, 다른 컴퓨터에서 재개할 때는 해당 저장소와 원자료를 먼저 확보한다.

중단 후 Viewer 담당 확인: 추가 작업과 검사를 시작하지 않았고 이번 작업에 새 브라우저나 서버를 실행하지 않았다. 기존 미리보기 서버는 유지한다. 로컬 `286e7646f1b9d34672b48afe70ad9f4bfac8a761`은 제품 미채택이며 실제 메모리 부족과 브라우저 자동 재통지는 미검증이다. slot과 archive의 별도 반환 증거는 확인하지 않았다. Kernel의 자동화 `automation`도 PAUSED로 전환했다. CAD·GPU·Outer·Docs 관련 확인된 자동화는 모두 PAUSED다.

## CLAUDE_RESUME — 2026-10-27

Codex 자동화는 멈춘 그대로 두고 Claude가 직접 이어서 진행했다. 시작 시 제품 로컬·원격 HEAD는 `7b6ed49833a8d7ef0dd784d0fd7e15845244c7cf`로 같았다. 아래 커밋은 모두 로컬이며 push하지 않았다.

- 공통 기반 소스 브랜치 `claude/cad-drawing-current-20261027` (HEAD `d62aeb5d40f9154901266c5b08576ea0603c85da`, 부모 Model 후보 `95104906946c07c4c65ec2b00d00bd1498187721` → 공통 `433a035ae`). Drawings 최종 delta `4e1dacc5c..b0caf6bc7`만 적용하고 schema5 중간 이력은 가져오지 않았다. `drawing/issues.ts`는 공통의 충돌 보호를 유지하고 datum 두 줄만 반영했다. Viewer 후보 `286e7646f`의 donor `df7d7fdda` 이후 delta 50경로(충돌 없음)와 GPU 복구 후보 `4187210f9`/`861ab4408`의 이식(render target 없는 공통 viewer.ts에 맞춤)도 이 브랜치에 있다. 공통 aggregate 브랜치 자체는 바꾸지 않았다.
- 제품 통합: `claude/drawing-viewer-product-20261027` (`f33f78464`, 부모 제품 `7b6ed4983`)를 no-ff 병합해 제품 `a2136eebc`. 병합 트리 = 검증 트리 `db9ca807`. 분기점 `1c80f8c18` 이후 제품이 건드리지 않은 100경로는 소스 그대로, `App.tsx`·`engine/migrate.ts`는 3-way(충돌 0). lockfile은 apps/cad-viewer importer 58줄만 추가(frozen install PASS). 후속 `31838a15d`는 API 목록·거부표 갱신.
- 실행 결과(제품 트리): cad-model tsc, 도면/버전/컨테이너 시험 249 PASS, Studio tsc, CAD·GPU build, GPU 단위 63 + 실제 Chrome WebGPU 복구 실패 1 PASS, Viewer/cad-viewer tsc, Viewer 시험 177 PASS(브라우저 전용 2 skip), 변경 파일 lint PASS, api-inventory SCOPED_PASS, check-docs PASS(35/0/47/3755/819).
- 첫 실패 보존: 공통 소스 cad-model tsc가 새 시험 6곳 TS7022/TS2739로 실패 → 시험 주석만 교정(`a90c2bd8e`). 제품 api-inventory 6666→6673 FAIL → 검토한 7추가/13변경 반영. check-docs `_refusals.md` drift → `refusals.mjs` 재생성.
- 실제 Studio(공통·제품 트리 둘 다): standalone 복합 위치 프레임 편집, 공차 0 거부(문서 유지), Save(schema3, 두 번째 칸 `diameter:false`, 첫 칸 diameter 필드 부재 유지) → New → Open 왕복, 잘못된 composite 파일 거부("Your part is unchanged", 원본 바이트 동일), `freeState:false`/`tangentPlane:false`의 Open→Save 보존. 다운로드 대신 페이지 안에서 Save 바이트를 잡고 Open 입력에 넣었다. 이 과정에서 New/Open 뒤에도 이전 문서의 프레임 초안(거부된 0)과 거부 안내가 남는 결함을 찾아 수정했다(`b450d2041`).
- 실제 Viewer: 문서 샘플을 WebGPU로 연 뒤 다음 어댑터 요청을 실패시키고 장치를 destroy하는 주입으로 복구 실패를 만들었다. 화면 중앙에 "The display stopped", 원인 `[DEVICE_LOST] … [NO_ADAPTER]`, Reload page 버튼이 보였고 처리되지 않은 오류는 0건. 실제 메모리 부족·자연 장치 손실·브라우저 자동 재통지는 NOT_RUN.
- 남은 일: (1)·(2)는 아래 후속에서 해결. (3) route(schema4) 문서의 실제 Studio 왕복은 시험으로만 확인. (4) GPU render target/텍스처/GPU04.1 라인과 공통 aggregate 반영은 담당 통합자 몫으로 남김. (5) 사용자 문서 페이지(도면 프레임, Viewer 장치 오류)는 Docs 범위로 미작성.
- 후속(`claude/studio-refusal-ux-20261027`): 알림을 한 열(`.toast-stack`)로 쌓아 복구 안내가 떠 있어도 Open 실패 안내가 겹치지 않고 보인다. cad-model `frameProblem`이 프레임 거부 이유를 한 줄로 돌려주고 Studio 프레임 편집기가 이를 쓴다(예: "Second segment: tolerance must be more than 0 and less than 100 mm."). 도구·에이전트용 `checkDrawingFrames` 전체 문구는 그대로다. 실행: 도면 시험 175 PASS, 새 시험 포함 24 PASS, Model/Studio tsc, lint, api-inventory(6673→6674, frameProblem 1추가 검토) SCOPED_PASS, check-docs PASS. 실제 Studio에서 두 거부 문구와 복구 안내+Open 실패 동시 표시(겹침 없음, 원본 바이트 동일)를 확인했다. 첫 실패: api-inventory 6673→6674.
