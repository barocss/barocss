# 물 입자와 CAD 바닥

Node 22에서 저장소 루트의 워크스페이스 의존성을 설치한 뒤 Viewer 의존 라이브러리(CAD, CAD interop, GPU, Viewer)를 빌드한다. `node examples/physics-scene/fluid-viewer/server.mjs`를 실행하고 표시된 주소를 WebGPU를 지원하는 Chromium에서 연다. Physics 세계는 `src/fluid.ts`에서 직접 번들하므로 Physics 패키지만 수정할 때 다시 빌드할 필요가 없다.

예제는 실제 CAD Surface 한 개를 수평 바닥으로 놓고 256개 물 입자를 한 Viewer/WebGPU 장면에 표시한다. 장면 선택에서 기본/높은 낙하와 v1/시각 점성 v2를 비교할 수 있다. 높은 낙하를 고르면 더 높은 초기 입자 블록과 바닥을 함께 보이도록 카메라를 바꾼다. 사용자는 재생, 일시 정지, 정확히 한 단계(1/120초), 초기화를 할 수 있다. 화면에는 Physics 단계, 입자 수, 밀도 진단, 원본 metre 위치의 SHA-256을 표시한다. 재생은 프레임 간격을 최대 0.05초로 제한하고, 한 화면 갱신에서 최대 6단계만 진행한다. 3600단계에서 멈춘다. 초기화는 Viewer 입자 레이어를 지우고 새 contextId로 0단계를 올린다.

이 예제는 시각적 물 입자 데모다. CAD Surface는 바닥을 표시하며 물리 충돌체가 아니다. Physics의 고정된 basin 경계가 입자와 충돌한다. 압력 계산, 검증된 CFD, 물 표면 재구성, 유체와 강체의 양방향 작용은 제공하지 않는다.
