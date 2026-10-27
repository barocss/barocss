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
- 01/11/16 도면과 저장: standalone의 실제 파일·SVG·상태행 입력을 마쳤다. 구제품이 새 도면을 버리는 문제 때문에 schema5 저장 보호가 제품 선행이다. Model448→3b8, Drawing b7→cbf→1a→f3→abac는 정상 소스이며 실행 NOT_RUN이다. Outer의 publish/recovery/templates/snapshot 연결은03 뒤다. 원3/4 bytes·snapshot key/id/parent를 보존한다.
- 04 Docs: 공통a94까지 채택했다. private189의 실제 Model3 결과/그림과 새8샘플은 PASS다. 전체164의159PASS/2FAIL/3CANCELLED, spring과CLI 첫 실패를 보존한다. 최종 공통 공개 목록·check/site·필요 페이지는 아직 실행하지 않았다.
- 05 Viewer: 기존 정상10 묶음은 공통 채택·제품 미채택이다. 소유 워크의 새 키보드/작은 화면/실패 보존·조립품 거리·리뷰 완료 보고는 새 정상 commit과 근거 반환을 확인 중이다. 제한 IGES·파일 닫기·실제 사용자 파일/장치 손실은 해당 범위로 남긴다. stopped packaging/config/hook은 재개하지 않는다.
- 06 GPU: fe2637 PT,607 RenderTarget,8de sized target,5d8 제한 GLB와2a35 target.asTexture는 소유 검사·합성 공개 사례와 정리를 마쳤다. 2a35 초기 sandbox 실패는 보존했다. 29fd 내장 PNG/JPEG GLB 텍스처의 첫 emit 오류와 partial 출력을 보존했다. 교정 d4e2의 emit·CPU6·WebGPU1·lint4와 합성 PNG/JPEG 공개 예제는 소유 검사에서 통과하고 자원을 반환했다. 일반 glTF·Studio 수락은 아니다. 사용자 지정 다른 위치가 GPU 병합을 맡는다.
- 07 Kernel: K02~K07 정상 소스와 spring41c 최소 교정은 공통 미채택·실행 NOT_RUN이다. 원 WIP·공차·최초 실패를 보존하고 실제 공통 핀 반환 뒤 정확 기능 단위로 연결한다.
- API: `api-public-model-direction-20261027.md`에 따라 CAD Model을 편집 원본과 기본 Part/Assembly 진입점으로 삼고 커널은 독립 계산 계층으로 유지한다. 전체 메서드 차이·호환 이행과 물리적 패키지 통합은 아직 완료·확정되지 않았다.

담당은 내부 분할·취합과 자기 자원 반환을 맡는다. 독립 소스는 병렬로 진행하고 실제 공유 기하·무거운 실행은 조정한다. 완료한 검사를 반복하거나 부분 PASS를 전체 기능·제품 PASS로 올리지 않는다.

## 후속 실제 결과 — 원 실행과 구분

- 공통03: 1c48의 CAD build/CAD4/API4는 PASS다. command의 중복 선택 거부 기대가 실패해 시험만87327로 교정했고 command2·Model/Studio type·lint13을 PASS했다. 원 FAIL은 그대로다.
- 실제 UI에서 Spacing0 오류와 Apply 비활성인데 이전 preview가 남았다. App의 현재값 확인·구결과 차단·preview clear만 dca→433으로 정상 채택했고 Studio type/lint1은 PASS했다. 수정 후 유효/무효·Apply·Undo/Redo와 실제 Save/New/Open을 공통433에서 확인하고 자원을 반환했다. 제품 별도 브라우저는 NOT_RUN이다.
- 도면01: 87327의 전용 상태행/표제란 비중첩과 실제 입력을 PASS했고 root도 PNG를 직접 봤다. 파일·SVG·native는 반복하지 않았다. 다만 구제품ca10이 dim 없는 standalone을 버리므로 schema5 저장 보호를 제품 선행으로 배정했다.
- 저장 보호: 일반3/route4는 보존하고 standalone/composite만5를 요구한다. canonical/hash 전 버전 확정, raw 검사·schema5 보존·실제route 판정·nested editable doc, immutable snapshot identity와 recovery/template 구버전 우회를 함께 닫는다. Kernel=Model core/버전, Outer=publish/recovery/templates, Drawings=raw/생산자다. Model과 Drawing은 정상 소스로 반환됐고 비배열 새 표식 거부도 소스에서 교정했다. Outer 연결과 합동 실행·제품은 미완료다. 구 recovery 자동 이동·삭제 패치는 자동 승인 검토에서 데이터 손실 위험으로 거부되어 우회하지 않았다. OPFS/folder의 비원자적 snapshot 생성과 version log 경쟁, 문서 수용·상태 전환의 원자성은 별도 수정·한계가 필요하며 기능 완료가 아니다.
- GPU03.1은5d8b77의 새emit294/CPU18/lint3·합성WebGPU 공개사례를 마치고 전반환했다. 원TS2352/partialemit과 실제수리plan420691의 provenance를 보존한다. 물리적외부asset/texture/skin/morph 수락이나 root제품병합이 아니다. GPU02.2는2a35e9의 소유 검사와 합성 공개 사례를 마쳤다. 후속 d4e2는 첫 emit 오류2건 보존 후 한정 PNG/JPEG 합성 예제와 필수 검사를 마쳤다.

## 중단·push 조건

이번 저장 관측은 사용91%/남음9%, secondary unavailable이다. 재개할 때 실제 도구로 다시 확인한다. 어느 유효 Codex 창이든 남음5% 이하면 전체6담당과 자체 agent의 새 작업/자동next를 멈추고 안전 checkpoint·source/runtime/archive 반환을 받습니다. 검증된 exact commit만 필요한 최소 통합을 마칩니다.

미완료/NOTRUN·담당·재개 조건·로컬/원격 SHA를 적고 정상 commit합니다. root만 사용자 승인된 origin feature branch를 normal push하고 원격 SHA를 확인한 뒤 cad 자동화를 PAUSED로 바꿉니다. force/main/develop rewrite/PR/release/reset/credits 사용은 금지합니다. 기존 중단·권한·브랜치 보호는 유지합니다. P2 제조인수는 사용자 지시로 활성 추적·정기 보고에서 제외하며 과거 HOLD·미수락 기록은 보존합니다.
