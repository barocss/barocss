# GitHub Issue 초안: 제한 UI JSON으로 AI 생성 UI에 BaroCSS를 즉시 적용하는 PoC

상태: **게시 전 초안**. 담당 조율: Baro PM·Baro Steward. 0.0.4 릴리스 후보와 별도 연구 트랙. GitHub 게시 자동 승인 검토가 공개 게시를 거부했으므로, 명시 승인 전에는 이 본문을 게시하지 않는다.

## 목표

사용자 프롬프트를 제한된 UI JSON으로 바꾼다. 등록된 컴포넌트만 렌더링하고 BaroCSS로 클래스를 적용한다. 결과로 미리보기, 생성 CSS, 오류 목록을 돌려준다. 2주 안에 이 흐름의 품질, 지연, 안전 경계, 비용을 재현 가능한 자료로 측정한다.

기술 선택의 근거와 대안은 `docs/ai-ui-technology-research.md`, 토론용 요약은 `docs/ai-ui-discussion-draft.md`에 있다. 이 Issue는 추천안 A의 **측정용 PoC**다. 제품 채택 결정은 측정 뒤 PM이 한다.
연결 토론: [AI UI Discussion #69](https://github.com/barocss/barocss/discussions/69)와 [PoC 측정 계약 보충 댓글](https://github.com/barocss/barocss/discussions/69#discussioncomment-18560506).

## 범위

- 입력: `{ prompt, themeId, viewport }`. `viewport`는 `mobile | desktop`이다.
- 모델 출력: `UiNode` 트리. 각 노드는 `id`, 등록된 `component`, 컴포넌트별 허용 `props`, `classes: string[]`, `children`을 갖는다.
- 첫 카탈로그: `Stack`, `Text`, `Button`, `Card`, `Image`. 버튼은 등록된 행동 ID만 사용한다.
- 출력: 검증한 트리, 미리보기 식별자, 생성 CSS, `nodeId`가 있는 오류 목록, 단계별 시간, 토큰 사용량과 추정 USD 비용. 단계별 시간에는 `firstStyleReady`를 쓴다.
- BaroCSS 연결: `@barocss/kit`의 `generateCssRules`로 클래스별 CSS 생성 여부를 확인한다. `@barocss/browser` 후보의 `BrowserRuntime.addClass`·`observe`로 렌더된 화면에 CSS를 적용한다. 서버 측 CSS가 필요하면 `@barocss/server` 공개 API를 사용한다. 0.0.4 후보의 패키지 사용 검사가 끝나면 버전을 고정한다.
- 첫 모델 공급자 1개를 고정하고 모델명·버전·가격 조회일을 기록한다. 모델 호출 코드는 BaroCSS 코어 밖에 둔다.
- 자유 HTML, JS, 임의 import, 임의 CSS, 동적 패키지 설치, 사용자 코드 실행, Figma 필수 연동, 배포 기능은 범위에서 제외한다. `json-render` 자체 카탈로그는 같은 입력 5개에 한정한 비교 실험이다.

## 구현 경계

1. 서버에서 모델 출력을 스키마로 검사한다. 최대 문자열 길이, 트리 깊이, 노드 수, 클래스 수를 설정하고 초과 시 오류로 끝낸다. 제한값은 fixture와 함께 기록한다.
2. 부분 스트림은 유효한 노드 또는 patch 단위로만 적용한다. 미완성 JSON을 그대로 렌더하지 않는다. [AI SDK 구조화 출력 문서](https://ai-sdk.dev/docs/ai-sdk-core/generating-structured-data)는 부분 출력의 스키마 검증 한계를 명시한다.
3. 렌더러는 허용 컴포넌트·속성만 처리한다. 텍스트는 텍스트 노드로 넣는다. `innerHTML`과 `eval`을 쓰지 않는다. 링크·이미지 URL은 허용 출처를 검사한다.
4. 클래스는 정책 검사 뒤 CSS 생성 여부를 확인한다. 임의 값(`[ ... ]`), `url()`, 미등록 variant를 첫 PoC에서 거부한다. 거부·미지원 클래스는 스타일을 넣지 않고 `REJECTED_CLASS` 또는 `UNSUPPORTED_CLASS`로 보고한다. CSS의 [`url()`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/url_function)은 외부 자원을 읽을 수 있다.
5. 모델 API 키는 서버에만 둔다. 모델에 보내는 화면·오류·DOM 자료는 신뢰하지 않는 입력으로 취급한다.

## 기준 자료와 측정 방법

- 시작 전에 프롬프트 20개와 기대 화면 검사를 저장소 fixture로 고정한다. 레이아웃, 텍스트, 반응형, 상태를 포함한다. 같은 프롬프트를 3회 실행해 총 60회 기록한다. 실패 재실행도 원본 결과를 남긴다.
- Mirror의 Tailwind CSS 4.1.13 고정 비교를 기본 기준으로 쓴다. 초기 표본 15개 중 구조 일치 8개, 구조 차이 6개, 미지원 1개는 전체 호환율이 아니다. PoC에 필요한 클래스는 시작 전에 각각 CSS 의미·지원 여부를 추가 측정해 허용 목록으로 고정한다. [Tailwind v4 변경 사항](https://tailwindcss.com/docs/upgrade-guide)을 기준에 기록한다.
- 한 번의 실행마다 입력 ID, 모델·버전, BaroCSS 커밋/패키지 버전, viewport, 브라우저·기기, 네트워크 조건, 세 단계 시간, 검증 오류, 생성 클래스와 CSS, 화면 검사 결과, 입력·출력 토큰, USD 추정값을 저장한다. 비밀 키와 민감한 프롬프트 내용은 기록하지 않는다.
- CSS 기록은 클래스별 규칙, root CSS, 테마 변수·preflight를 구분한다. 후보 브라우저의 `getAllCss()`는 클래스별 캐시만 합치므로 완전한 스타일시트로 쓰지 않는다. 실제 적용 여부는 계산된 스타일로 확인한다. PR #71 `a5c48dc`의 `removeClass`는 요청 클래스의 주입 CSS를 제거하고 남은 CSS·공유 root 규칙·기본 스타일을 다시 구성한다. DOM 클래스 속성은 따로 관리한다. 분리된 style partition은 다음 클래스 적용 때 복구된다.
- 시간 시작점은 요청을 보낸 시각이다. `firstValidNode`는 첫 검증 노드 수신, `firstStyleReady`는 렌더된 노드의 예상 `getComputedStyle()` 값과 가시성이 브라우저에서 처음 확인된 시각, `complete`는 마지막 노드 적용 시각이다. p95는 60회 값을 정렬한 뒤 57번째 값으로 계산한다. `firstStyleReady`는 실제 화면 표시 시각이 아니다. [`requestAnimationFrame`](https://developer.mozilla.org/en-US/docs/Web/API/Window/requestAnimationFrame)은 다시 그리기 전에 실행되므로 paint 확인으로 기록하지 않는다. 시각적 결과는 별도 [Playwright 스크린샷](https://playwright.dev/docs/api/class-page)으로 검사한다. 지연 측정 중 탭은 전경에 둔다.
- 화면 검사는 저장된 기대 구조·텍스트·반응형 규칙을 자동 검사한다. [Playwright 시각 비교](https://playwright.dev/docs/test-snapshots)는 보조 자료로 쓴다. 픽셀 차이만으로 성공을 판정하지 않는다.
- 오류를 모델 스키마, 클래스 정책, CSS 미지원, 렌더러, 네트워크, 모델 서비스로 분류한다. 수정 루프는 실패 요약을 보내 **최대 1회** 수행하고 수정 전후 결과와 추가 비용을 별도로 기록한다.
- `json-render`는 같은 fixture 5개만 시험한다. 자체 스키마 대비 구현 시간, 유효 출력, 부분 스트림·중단 처리, BaroCSS 연결 난도를 기록한다. [json-render 카탈로그와 라이선스](https://github.com/vercel-labs/json-render)를 참조한다.

## 수용 기준(사전 목표, 현재 실측값 아님)

- [ ] 60회 중 스키마 유효 출력이 **57회 이상**이다. 실패 3회도 원인과 원시 오류를 보존한다.
- [ ] 미지원·거부 클래스 검사용 fixture의 모든 입력이 오류 목록에 나타나며 스타일이 삽입되지 않는다. 누락은 0건이다.
- [ ] 악성·비허용 입력 10개(HTML 태그, 이벤트 속성, `javascript:` URL, 외부 이미지 URL, 임의 CSS `url()`, 임의 클래스 값, 미등록 variant, 임의 컴포넌트, 초과 깊이, 초과 크기)를 모두 차단한다. 브라우저에서 스크립트 실행과 허용 외 네트워크 요청은 0건이다.
- [ ] `firstStyleReady` p95가 **3초 이하**다. 초과 시 환경과 단계별 원인을 기록한다. 이 목표가 모델·네트워크 조건에서 비현실적이면 기준을 조용히 바꾸지 않고 결과와 변경 제안을 남긴다.
- [ ] 화면의 주요 구조·텍스트·반응형 검사가 60회 중 **48회 이상** 통과한다. 통과 판정식과 fixture를 실행 전에 고정한다.
- [ ] 60회 모두 토큰과 호출당 USD 추정 비용을 기록한다. 적용한 단가와 조회일을 함께 남긴다([모델 가격표 예시](https://developers.openai.com/api/docs/pricing)).
- [ ] CSS 비교 결과에는 Tailwind 버전, 클래스, 기대 CSS, BaroCSS CSS, 의미 차이 여부를 기록한다. 표본 결과를 전체 호환율로 표현하지 않는다.
- [ ] 실행 명령, fixture, 환경, 원시 측정값, 실패 사례, A와 `json-render` 비교, 후속 결정 제안을 한 문서에서 재현할 수 있다.

## 2주 일정

| 일자 | 완료물 |
| --- | --- |
| 1~2 | 입력·출력 스키마, 카탈로그, 허용 클래스, 20개 fixture, 측정 환경 고정 |
| 3~5 | 모델 어댑터, 안전 렌더러, BaroCSS 적용, 오류 목록 |
| 6~7 | 60회 실행과 CSS 의미 비교 |
| 8~10 | 브라우저 검사와 수정 루프 1회 |
| 11~12 | `json-render` 5개 입력 비교 |
| 13~14 | 결과 검토, 비용·제약·후속 결정 문서 |

## 의존 관계와 완료 정의

- PM: PoC 범위와 첫 모델 공급자, fixture·안전 경계 승인. 0.0.4와 별도 일정 유지.
- Mirror: Tailwind 고정 버전과 클래스별 의미 비교. 처음 15개 표본 외의 허용 클래스 검증.
- Core: 클래스 미지원 신호와 컨텍스트 격리 보장 확인.
- Pulse: browser/server 공개 API와 CSS·오류 관측 경로 확인.
- Ship: pack 기준 import 경로 확인. 현재 안내 경로는 `@barocss/kit`, `@barocss/browser`, `@barocss/server`다.
- Guard: 측정 재현성과 금지 입력 차단 결과 독립 확인.
- Steward: PM의 게시 승인 뒤 Discussion·Issue 링크 연결. 검증 전 선택은 Wiki에 확정 사실로 기록하지 않음.

위 수용 기준과 재현 자료가 준비되면 PoC Issue를 완료한다. 결과가 목표를 못 채워도 측정과 원인 분류가 완전하면 기술 판단 자료로 남긴다. 실제 제품 채택은 별도 결정이다.
