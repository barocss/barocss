# D340 Studio browser preparation

준비 완료. `node --check`: PASS. 제품 빌드·테스트·브라우저·독립 oracle 실행: NOT_RUN.

소유 repo 파일은 `apps/cad-studio/test/trimmed-surface-split-browser.mjs` 하나입니다. 다른 source/driver는 수정하지 않았습니다. `/tmp/d340-studio`에는 준비 스크립트와 독립 verifier 원본을 저장했습니다. 커밋·푸시 없음.

Root가 모든 작성자를 중지하고 소스를 동결한 뒤, 고정 worktree의 `apps/cad-studio`에서 Node22로 실행합니다.

```sh
D340_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/trimmed-surface-split-browser.mjs /tmp/d340-studio/run-01
```

게이트는 시드 생성 전에 검사합니다. Chrome은 1개입니다. fresh context는 순서대로 실행하고 이전 context를 닫습니다.

실제 UI 계약:

- `Direct geometry` 패널.
- 실제 Trim: `Trim keeps`, `Trim by the curve`.
- 기존 Split: `Surface direction`, `At v`, `Split`.
- 기존 rename: `Object name`, Enter.
- IGES, Thicken into a body, Sew into a body는 실제 기존 컨트롤로 거절을 확인합니다.

프로필:

- 실제 U-curve Trim Keep Inside160, V3.7: lower1/upper2.
- 실제 같은 curve Trim Keep Outside160, V3.7: lower2/upper1. 작은 lower pocket을 독립 oracle과 ray probes로 확인합니다.
- 실제 Inside V5.7: lower1/upper0. 빈 upper object가 없어야 합니다.
- 별도 실제 warped-support Trim160 이후 Split 거절. 문서·선택·Undo 불변을 확인한 뒤 정상 inside 프로필을 재시도합니다.
- U축 actual browser는 NOT_RUN입니다. 양축/fractional/native regularity 범위는 별도 Kernel/Model focused 증거입니다.

증거:

- 원본의 actual stored160 UV, native domain, represented cut를 `/tmp/d340-plan/oracle.py` 복사본에 전달합니다. Ideal240으로 기대값을 대체하지 않습니다.
- 독립 Python verifier는 Fraction Green 면적/중심과 ray parity를 계산합니다. oracle의 Fraction slab/component 결과와 side별 개수·면적·중심을 비교합니다. 테스트 probe6개는 material loss/bridge/overlap을 검사합니다. Surface material과 solid mass는 구분합니다.
- 공개 compileCadModel은 각 component의 실제 `object.geometry`를 전체 shared source에서 찾습니다. 같은 upper geometry를 가리키는 두 객체를 각각 검사합니다.
- actual child surfaceEvaluator는 모든 stored trim vertex에서 원본 world authority와 비교합니다. 이는 local observations이며 whole-child coefficient/Jacobian 증명이 아닙니다.
- Witness420, 중심[86,.5,3.5], key/names는 공개 Part read로 유지 여부를 검사합니다.
- Split Undo/Redo, exact native Save/fresh Open, 한 component rename/Save/fresh Open/재선택 필드를 검사합니다. Inside/Outside/empty profile 모두 파일 보존 증거를 남깁니다.
- 기존 소비자 거절3개는 직전 실제 rename Undo 항목으로 noUndo를 함께 검사합니다.

Sourcecapsule은 initial subset과 full bundle input 수를 따로 저장합니다. 가상 stdin은 디스크 capsule에서 제외하며 정확한 소스·해시는 별도로 남깁니다. watcher/errors/downloads/failure screenshot/cleanup 후 capsule도 저장합니다.

숫자 성공은 시각적 PASS가 아닙니다. Receipt에는 `qualification: NUMERIC_AND_UI_FLOW_ONLY`, `visualReview: ROOT_MUST_VIEW_SCREENSHOTS`를 남깁니다. Root는 inside 두 upper region, outside 작은 pocket, empty upper 화면을 직접 확인해야 합니다. Display mesh area는 exact material oracle로 쓰지 않습니다.
