# How to Proceed - cssma-v4 실전 개발 가이드 🚀

## 1. 개발 환경 준비
```bash
pnpm install
pnpm test
```

## 2. 브랜치 전략
```bash
# develop 최신화
git checkout develop
git pull origin develop

# 새 기능 브랜치 생성 (예: 애니메이션 시스템)
git new feature/animation-system
```

## 3. 구현 단계
- src/core, src/presets, src/runtime 등 v4 엔진 구조에 맞게 파일 생성/수정
- 테스트 파일은 tests/ 하위에 동일 구조로 생성
- 예시: `src/presets/animation.ts`, `tests/presets/animation.test.ts`

## 4. 테스트 및 검증
```bash
pnpm test
# 커버리지/성능 측정
pnpm test --coverage
```

## 5. 문서화
- README, function-roles.md, PRD.md 등 최신화
- 주요 변경점/마이그레이션 가이드 작성

## 6. 릴리즈 준비
```bash
pnpm changeset
pnpm build
pnpm test
# develop → main PR, CHANGELOG/릴리즈 노트 작성
```

## 7. 진행 상황/체크리스트 관리
- docs/CHECKLIST.md, docs/ROADMAP.md, docs/TODOS.md 참고
- 완료된 항목 체크, 신규 작업/이슈 추가

## 8. 지원/질문/협업
- 기술적 질문: 기존 코드/테스트/문서 참조
- 설계/진행 방향: ROADMAP.md, CHECKLIST.md, NEXT-ACTIONS.md 참고
- 문서/진행상황 업데이트: 주간/월간 리뷰에 반영

---

**이 가이드는 cssma-v4 단일 패키지 기준의 실전 개발 흐름을 안내합니다.  
구체적 구현/테스트/릴리즈/문서화는 각 체크리스트와 로드맵을 참고하세요.** 