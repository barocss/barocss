# 제한 UI JSON PoC

이 앱은 고정 mock UI JSON을 검사하고, 등록된 컴포넌트로 렌더링한 뒤 BaroCSS 클래스를 적용한다. 모델 API를 호출하지 않는다. 0.0.4 릴리스 후보와 별도 실험이다.

## 실행

Node 22, pnpm 9 기준:

```sh
pnpm install --frozen-lockfile
pnpm --filter @barocss/ai-ui-poc test
pnpm --filter @barocss/ai-ui-poc build
pnpm --filter @barocss/ai-ui-poc dev
```

브라우저에서 표시된 로컬 주소를 연다. Fixture를 고르면 UI JSON, 미리보기, 오류와 CSS 기록을 볼 수 있다. **Mock 60회 측정**은 정상 fixture 20개를 같은 탭에서 3회씩 처리한다. **측정 JSON 저장**은 각 실행의 원시 기록을 내려받는다.

## 입력 계약

등록 컴포넌트는 `Stack`, `Text`, `Button`, `Card`, `Image`다. 버튼 행동 ID는 `show_notice` 하나다. 이미지 경로는 앱에 포함된 `/ai-ui-placeholder.svg` 하나다. 노드에는 `id`, `component`, `props`, `classes`, `children`만 허용한다. 텍스트는 DOM 텍스트로 넣는다.

제한값은 JSON 12,000바이트, 깊이 6, 노드 40개, 텍스트 240자, 노드당 클래스 12개다. 허용 클래스 목록은 [contract.js](src/contract.js)에 고정했다. 등록되지 않은 클래스, 임의 값, `url()`, 미등록 variant는 적용하지 않고 `REJECTED_CLASS`로 기록한다. 허용 목록에 있지만 CSS 규칙이 비거나 `url()`을 포함하면 `UNSUPPORTED_CLASS`로 기록한다. 구조나 속성이 잘못되면 전체 트리를 렌더링하지 않는다. 오류에는 `nodeId`, `code`, `detail`이 있다.

BaroCSS 접점은 [barocss-adapter.js](src/barocss-adapter.js)에 있다. 자체 UI 트리와 BaroCSS의 CSS AST는 분리한다. `json-render` 비교 실험은 이 트리를 변환하지 않고, 자체 카탈로그의 검증된 클래스 배열을 같은 접점에 전달할 계획이다.

## Fixture와 측정

- [정상 20개](fixtures/benchmark.js): 고정 프롬프트, viewport 의도, mock 트리, 주요 텍스트와 컴포넌트 검사.
- [금지 입력 10개](fixtures/forbidden.js): HTML 태그, 이벤트 속성, 위험 URL 두 종류, CSS `url()`, 임의 값, 미등록 variant·컴포넌트, 초과 깊이·크기.
- [원시 mock 기록](results/mock-60.json)과 [측정 해석](../../docs/ai-ui-poc-mock-results.md).

`firstStyleReady`는 루트 노드의 `text-align: center` 계산 스타일과 가시성이 처음 확인된 시각이다. 실제 화면에 픽셀이 표시된 시각이 아니다. mock은 같은 페이지와 캐시에서 실행된다. 실제 모델의 생성 품질, 네트워크 지연, 토큰, USD 비용, 모바일 viewport의 렌더링은 이 기록으로 판단할 수 없다.
