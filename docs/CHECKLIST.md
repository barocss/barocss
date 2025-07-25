# cssma-v4 Development Checklist 📋

## 1. Core Engine & Parser
- [ ] AST 구조 및 파서 일관성
- [ ] Variant/Modifier 처리 (wrap, selector synthesis)
- [ ] 런타임 StyleRuntime 통합
- [ ] Cartesian product, sourcePriority 등 고급 기능 적용

## 2. Converter & CSS Generation
- [ ] astToCssMin/astToCssPretty 분리 및 검증
- [ ] decl-only wrapping, rule nesting 정상 동작
- [ ] Selector flattening/중첩 처리

## 3. Test Coverage
- [ ] 90%+ 테스트 커버리지
- [ ] Variant/Selector/Runtime edge case 테스트
- [ ] MutationObserver, scan 옵션 등 런타임 테스트

## 4. Documentation
- [ ] README, PRD, function-roles 등 최신화
- [ ] 마이그레이션 가이드(v3→v4)
- [ ] API/런타임/엔진 구조 문서화

## 5. Release QA
- [ ] 모든 테스트 통과
- [ ] TypeScript strict mode
- [ ] 번들 사이즈/성능 측정
- [ ] CHANGELOG/릴리즈 노트 작성

## 6. Success Metrics
- [ ] 변환 성능 < 100ms
- [ ] 95%+ Tailwind CSS 호환
- [ ] 90%+ 코드 커버리지
- [ ] 주요 브라우저/Node 호환성

---

**Last Updated**: 2025-06  
*이 체크리스트는 cssma-v4 단일 패키지 기준으로 관리됩니다.* 