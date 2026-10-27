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

공통 소스는 `a416de2d07b2bae64b6580a9b5181b3b41cef02c`입니다. 이 전체 소스를 제품에 통합한 상태는 아닙니다.

- Studio 설명 축소는 정상 donor2e7a→root1c80입니다. 현재 UI5 첫 타입/lint와 기본 화면 한 흐름을 Outer가 맡습니다. 기존 Hud 키보드 guard와 오류·단위는 보존했습니다. 해당 source 핀 반환 전 공통 소스를 바꾸지 않습니다.
- Viewer는 정상10개 delta를 공통에 채택했습니다. 최종 앱 tree는 donor df7d7fd와 같습니다. 문서/조립품·원본 점 검사·아이콘 UI의 담당 실제 흐름과 root PNG 검토는 완료했습니다. source-local 검증이며 새 public surface 문서/제품 채택은 남았습니다. 중단된 build:staged 문단은 되살리지 않았습니다.
- Drawings standalone frame은 정상 d68→ac53, Kernel CG2 선형 cut 반복은 정상05d4315가 준비돼 있습니다. 아직 공통/제품 미채택이며 해당 최초 영향 배치와 실제 소비 흐름은 NOTRUN입니다. source/실행 창을 직렬 배정합니다.
- Docs 실제 API 그림은 own125 소스의 증거 수집 guard에서 API import 전에 실패했습니다. input import와 실제 output external을 구분하는 wrapper-only 교정 중입니다. API case/JPEG/site는 NOTRUN이며 원 실패는 보존했습니다. 새 SHA와 정확 배정에서만 이어갑니다.

각 담당이 내부 분할과 취합을 맡습니다. UI 담당은 자기 agent-browser 세션으로 필요한 실제 화면·파일·오류·소스 결속과 자기 정리를 수행합니다. 다른 담당의 하위 agent를 직접 지휘하지 않습니다.

## 중단·push 조건

이번 관측은 사용57%/남음43%, secondary unavailable입니다. 어느 유효 Codex 창이든 남음5% 이하면 전체6담당과 자체 agent의 새 작업/자동next를 멈추고 안전 checkpoint·source/runtime/archive 반환을 받습니다. 검증된 exact commit만 필요한 최소 통합을 마칩니다.

미완료/NOTRUN·담당·재개 조건·로컬/원격 SHA를 적고 정상 commit합니다. root만 사용자 승인된 origin feature branch를 normal push하고 원격 SHA를 확인한 뒤 cad 자동화를 PAUSED로 바꿉니다. force/main/develop rewrite/PR/release/reset/credits 사용은 금지합니다. 기존 중단·권한·브랜치 보호·P2 HOLD는 유지합니다.
