# cssma-v4 Release Plan 🚀

cssma-v4 단일 패키지 기준의 공식 릴리즈 전략/QA/롤백/마이그레이션 가이드입니다.

## 🗓️ 릴리즈 전략

- develop → main 브랜치 전략, changeset 기반 버전 관리
- 기능별 feature 브랜치 → develop → main 순 병합
- pnpm changeset, build, test, release 자동화

## ✅ 릴리즈 QA/체크리스트

- 모든 테스트 통과 (unit/integration/e2e)
- 90%+ 커버리지, 주요 브라우저/Node 호환성
- CHANGELOG/릴리즈 노트 작성
- 마이그레이션 가이드(v3→v4) 포함
- 성능/번들 사이즈/문서화/QA 완료

## 🚨 릴리즈 롤백/핫픽스

- 릴리즈 후 치명적 이슈 발생 시:
  - npm deprecate, git revert, hotfix 브랜치 생성
  - QA 후 재릴리즈

## 🛠️ 마이그레이션 가이드

- v3→v4 주요 변경점/삭제/이관/신규 기능 요약
- 마이그레이션 체크리스트(별도 문서로 관리)

## 📋 참고

- 구체적 일정/성공지표/체크리스트/리스크 등은 ROADMAP.md, CHECKLIST.md, NEXT-ACTIONS.md, TODOS.md에서 관리

---

**이 문서는 cssma-v4 단일 패키지 기준의 공식 릴리즈 전략/QA/롤백/마이그레이션 가이드입니다.  
구체적 일정/성공지표/체크리스트 등은 각 문서를 참고하세요.** 