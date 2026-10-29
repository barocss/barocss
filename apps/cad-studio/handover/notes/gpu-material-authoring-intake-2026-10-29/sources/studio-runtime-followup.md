# Studio 현대화 검토: 새 실제 화면 확인

**결과: 공개 UI 화면 확인 PASS. 디자인 구현은 하지 않았다.**

기준 커밋은 `d85558ce0031d812341d5871743f8535520eb8d4`다. 새 immutable snapshot `runtime/studio-ux-d855/`만 실행했다. 제품 코드, GPU·Viewer WIP, 이전 snapshot과 이전 실패 기록은 바꾸지 않았다. 이전 작성자 이미지와 이번 독립 실행의 증거를 구분한다.

## 실제 실행 결과

| 화면 또는 동작 | 결과 | 관찰 |
|---|---|---|
| Model starter, 1440×900 | PASS | 기존 Bracket-01 plate와 구멍, Browser의 1 body가 표시됐다. |
| 공개 Browser body 선택 | PASS | 트리 행과 바디 외곽이 노란색으로 강조됐다. Body 속성, bounds, 질량·재질·관성·면적 필드가 표시됐다. 수치 정확도를 검증한 것은 아니다. |
| 기존 Extrude feature editor 열기·닫기 | PASS | 공개 history에서 기존 node 1을 열었다. Width 64, Depth 32, Corner X/Y, Distance 8 등이 표시됐다. 입력값을 바꾸지 않고 Close editor로 닫았다. |
| Render 화면 전환 | PASS | Raster, Appearance·Lights·Scene·Source 탭과 재질 제어, timeline이 표시됐다. 렌더 작업이나 재질 변경은 실행하지 않았다. |
| Drawing 화면 전환 | PASS | A4 도면, Top·Front·Right·Isometric 뷰와 title block, Sheet 설정, 기존 Issues 3 안내가 표시됐다. 도면과 치수를 편집하지 않았다. |
| Model, 1280×800 | PASS | 모델과 선택 상태, Mode 제어와 오른쪽 속성 패널을 확인했다. document 수평 overflow는 false였다. |
| Sketch 전환 | NOT_RUN | 이번 최소 화면 검토 범위에서 제외했다. |

6개 PNG를 각각 열어 확인했다. 결과의 `visualReview`는 `VIEWED_6_REAL_PNGS`다. page error와 console error는 0개다. 계산·메모리 stress, 새 geometry, Save/Open, PNG 내보내기, OS picker, 사용자 프로젝트, 배포 검증은 NOT_RUN이다. D324의 GPU 정확성이나 성능을 새로 수락한 결과도 아니다.

## 이전 디자인 판단을 실제 화면에서 확인한 내용

1. **작은 아이콘이 서로 다른 작업을 같은 줄에 놓는다.** Model의 상단은 문서 이름, primitive, Mode, 채팅·파일·프로젝트 명령을 함께 표시한다. 1280에서는 primitive 일부가 overflow로 접힌다. Mode는 유지된다. 문서 동작과 현재 작업 명령을 구분하자는 기존 방향은 실제 화면과 맞는다. 아이콘의 존재 자체를 결함으로 판정하지 않는다.

2. **선택과 편집 정보가 한 열에 누적된다.** `03-feature-editor.png`에서는 Browser, Body의 상세 수치, Edit feature 순서로 쌓인다. 1440×900에서도 feature의 아래 필드와 적용 영역은 처음 보이는 범위 아래에 있다. 현재 편집의 입력·적용·취소를 앞에 두고, 부가 물성을 접거나 별도 영역으로 분리할 필요가 있다. 공개 Close editor는 실제로 작동했다.

3. **Drawing은 서로 다른 오른쪽 정보 영역을 동시에 사용한다.** Sheet 설정은 도면 오른쪽에 뜨고, 그 밖의 일반 Body·Preview & analysis 패널도 남아 있다. 도면을 보는 동안 현재 Sheet 도구와 모델 속성이 나란히 경쟁한다. 작업별 정보 계층을 정리하자는 기존 판단을 이 화면으로 확인했다. 도면 오류나 치수 계산 오류를 판정한 것은 아니다.

4. **Render는 문맥별 탭의 좋은 예가 이미 있다.** Appearance·Lights·Scene·Source는 작업 안에서 의미가 분명하다. 이 구조는 유지할 만하다. 다만 animation timeline과 일반 Preview & analysis도 항상 함께 보여, 정적 재질 작업의 시선이 분산될 수 있다. timeline을 필요한 작업에서 열게 하는 것은 디자인 제안이다.

5. **모델 크기와 선택 피드백은 보존할 장점이다.** starter와 1280 화면에서도 모델이 충분히 크게 보인다. 선택한 바디의 외곽과 Browser 행의 강조가 서로 연결된다. 현대화는 이 피드백을 유지하면서 10~11px 보조 라벨, 긴 세로 아이콘 rail, 속성 행의 읽기 순서를 정리하는 편이 적절하다. 이번 실행은 새로운 비교 ghost나 측정 흐름을 확인하지 않았다.

이 항목은 관찰과 디자인 판단이다. 이번 실행에서 확정한 새 제품 기능 결함은 없다. 기존 현대화 제안은 미구현 상태다.

## 소스와 실행 출처

- 새 snapshot: committed 파일 1156개, 17,110,442 bytes. 모든 파일의 Git blob과 SHA-256을 확인했다.
- Source manifest SHA-256: `d4e347dab3298a4e4793a377f966bef8c58683b25796a339477bd746ff0b02b5`.
- CAD·CAD Model·GPU workspace 링크 3개는 새 snapshot 내부만 가리킨다. GPU D324의 새 소스와 package manifest를 포함했다.
- 공개 CAD Model `samples` 전체를 포함했다. 앱의 sample JSON import 3개를 확인했다. Studio의 실제 정적 import에서 Viewer는 0개였다.
- 실제 Vite pinned 입력 1042개: CAD 422, CAD Model 311, GPU 131, app/config 178. Workspace 해석은 420개다. 외부 제품 경로와 자체 dist 입력은 0개다. 이는 성공한 전체 테스트 수가 아니라 실제 로드한 입력 출처 기록이다.
- Vite dependency optimizer의 origin metadata도 확인했다. 기존 설치 third-party만 재사용했다.
- Node 22.19.0, 설치 Chrome 156.0.8078.48, 기존 Playwright·Vite를 사용했다. 같은 headless Chrome와 `--enable-unsafe-webgpu` 설정을 유지했다.
- 새 소유 shell이 heavy gate를 한 번 요청했다. 즉시 허용됐으며 당시 load는 13.24였다. 한 번의 180초 이하 probe만 실행했다. 재시도와 setup repair는 없었다.

명령은 `python3 runs/studio-ux-20261029T072849/prepare.py`, `sh runs/studio-ux-20261029T072849/run.sh`다. 경로는 audit root 기준이다. probe exit, gate acquire와 release exit는 모두 0이다. owned context·browser·Vite server를 정상 종료했다. 해당 run/probe 프로세스가 남아 있지 않은 것을 확인했다. 다른 프로세스와 탭은 보존했다.

## 증거 파일

모든 실행 파일은 `runs/studio-ux-20261029T072849/`에 있다.

- `result.json`: 각 상태, 공개 동작, 실제 이미지 검토, cleanup, 이미지 해시.
- `source-manifest.json`, `source-resolution.json`, `dependency-optimizer-metadata.json`, `export-asset-audit.json`: 출처와 export 자산 검사.
- `01-model-1440.png`, `02-model-selection.png`, `03-feature-editor.png`.
- `04-render.png`, `05-drawing.png`, `07-model-1280.png`.
- `gate.log`, `gate.exit`, `probe.log`, `probe.stderr`, `probe.exit`, `release.exit`.

이 기록은 기존 `runtime-review.md`의 새 실제 UI 증거 공백을 닫는 추가 자료다. 이전 setup 실패와 gate 75 기록은 그대로 유효하며 보존됐다. 이전 작성자 D323 이미지는 작성자 증거로 남는다. 다음 분석에서 그 자료나 GPU 기능을 확인하려면 각각의 source·실행 범위를 다시 구분해야 한다.
