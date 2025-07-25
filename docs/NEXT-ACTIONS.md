# cssma-v4 Next Actions 🎯

## 🚀 Immediate Priorities (2025년 7월 기준)

### 1. Animation System (최우선)
- [ ] animation 파서/컨버터/테스트/문서화 일괄 구현
  - [ ] `src/presets/animation.ts` 생성 및 파서 구현
  - [ ] `tests/presets/animation.test.ts` 테스트 작성
  - [ ] 런타임/엔진 통합 및 edge case 검증
  - [ ] 문서화(README, function-roles.md 등) 최신화
  - [ ] 성능/커버리지/QA 체크

### 2. 런타임 StyleRuntime 고도화
- [ ] MutationObserver, scan 옵션 등 실전 환경 테스트
- [ ] 브라우저/Node 호환성 검증
- [ ] 런타임 문서/예제 보강

### 3. 엔진/파서/테스트 통합 QA
- [ ] decl-only wrapping, selector flattening 등 edge case 테스트
- [ ] 90%+ 커버리지 유지
- [ ] 주요 브라우저/Node 환경에서 성능 측정

### 4. 문서화/마이그레이션 가이드
- [ ] v3→v4 마이그레이션 가이드 작성
- [ ] 주요 변경점/아키텍처/런타임 구조 문서화

### 5. 릴리즈 준비
- [ ] pnpm changeset, build, test
- [ ] CHANGELOG/릴리즈 노트 작성
- [ ] develop → main PR

---

## 📋 참고: 세부 작업/우선순위/성공지표/리스크 등은
- docs/CHECKLIST.md, docs/ROADMAP.md, docs/TODOS.md에서 관리

---

**이 문서는 cssma-v4 단일 패키지 기준의 실전 우선순위/액션 플랜만을 제공합니다.  
구체적 세부 작업/일정/성공지표/리스크 등은 각 체크리스트와 로드맵을 참고하세요.** 