# cssma-v4 Development TODOs

## 🚀 구체적 개발 TODO/이슈

### 1. Animation System
- [ ] transition/animate 파서/컨버터/테스트/문서화
  - [ ] transition, duration, delay, ease 파싱
  - [ ] animate-spin, ping, pulse, bounce 등 지원
  - [ ] arbitrary value (duration-[250ms] 등) 지원
  - [ ] 50+ test case, edge case/에러 처리
  - [ ] CSS 변환/키프레임/타이밍 함수/지연 지원
  - [ ] 성능/브라우저 호환성/문서화

### 2. 런타임 StyleRuntime
- [ ] MutationObserver, scan 옵션, 실전 환경 테스트
- [ ] 브라우저/Node 호환성, 문서/예제 보강

### 3. 엔진/파서/테스트 통합 QA
- [ ] decl-only wrapping, selector flattening 등 edge case
- [ ] 90%+ 커버리지, 주요 브라우저/Node 환경 성능 측정

### 4. 문서화/마이그레이션/릴리즈
- [ ] v3→v4 마이그레이션 가이드 작성
- [ ] 주요 변경점/아키텍처/런타임 구조 문서화
- [ ] CHANGELOG/릴리즈 노트 작성

---

- 완료된 항목은 [CHECKLIST.md](./CHECKLIST.md)에서 체크
- 세부 일정/우선순위/성공지표/리스크 등은 ROADMAP.md, NEXT-ACTIONS.md에서 관리

---

**이 문서는 cssma-v4 단일 패키지 기준의 구체적 개발 TODO/이슈/세부 작업만을 제공합니다.  
구체적 일정/성공지표/리스크 등은 각 문서를 참고하세요.** 