# D341 Studio browser preparation

준비 완료. `node --check`: PASS. 제품 빌드·테스트·브라우저·독립 oracle 실행: NOT_RUN.

소유 repo 파일은 `apps/cad-studio/test/trimmed-surface-region-browser.mjs` 하나입니다. 제품 소스, D340 드라이버, 문서는 수정하지 않았습니다. `/tmp/d341-studio`에는 준비 스크립트와 독립 rectangle verifier 원본을 저장했습니다. 커밋·푸시 없음.

Root가 모든 소스 작성자를 중지하고 동결한 뒤 고정 worktree의 `apps/cad-studio`에서 실행합니다. 재시도 시 새 run 디렉터리를 사용해 첫 실패를 보존합니다.

```sh
D341_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' /Users/user/Library/pnpm/nodejs/22.19.0/bin/node test/trimmed-surface-region-browser.mjs /tmp/d341-studio/run-01
```

게이트는 시드 생성 전에 검사합니다. Chrome 프로세스는1개입니다. fresh context는 순서대로 만들고 이전 context를 닫습니다.

UI 선택자:

- `Direct geometry` 패널.
- `Trim keeps`와 `Trim by the curve`로 actual160 UV를 만듭니다.
- 기존 REGION 입력은 `u from`, `u to`, `v from`, `v to`입니다. 버튼은 `Extract region`입니다.
- rename 입력은 `Object name`입니다. Enter로 적용합니다.
- Model component 이름은 `${original.name} · region ${index+1}`입니다. 모든 component가 같은 source와 geometry를 참조해야 합니다.

실제 프로필:

1. Inside U[-.8,2.8], V[3.7,5]: component2개, hole0/0. Undo/Redo, native Save/fresh Open, rename/Save/fresh Open/reselect를 검사합니다.
2. Outside U[-1.6,5], V[1.4,3.7]: component2개, 작은 pocket 보존, native 파일 재개방을 검사합니다.
3. Outside U[-1.6,5], V[1.4,6.2]: component1개와 outside-hole1개를 검사하고 파일 재개방으로 보존을 확인합니다.
4. Outside U[.4,1.6], V[3.8,4.6]: component1개가 명시적 mask를 유지해야 합니다. 파일 재개방과 실제 Thicken 거절도 검사합니다.
5. Inside U[.4,1.6], V[3.8,4.6]: 독립 oracle은 component0개여야 합니다. 실제 Extract region은 DOMAIN/no-positive-material 거절을 보여야 합니다. 문서·원본가시성·선택·source·Undo 불변 뒤 정상 inside crop을 재시도합니다.

독립 증거:

- Embedded Python verifier는 stdlib Fraction만 사용합니다. CAD, product predicates, clipping, arrangement, SectionRationalContext를 가져오지 않습니다.
- Rectangle slab levels에는 원본 vertex, crop V경계, 각 비평행 trim edge가 두 crop U경계를 지나는 exact switch level이 들어갑니다. Midpoint에서 고정된 max/min endpoint를 골라 면적·1차 모멘트를 정확히 적분합니다.
- 인접 slab의 열린 material interval은 exact positive-width overlap일 때만 연결합니다. Point-only 접촉으로 bridge를 만들지 않습니다.
- 실제 original stored160 UV와 represented crop bounds가 기대값 입력입니다. Ideal guide240/65/229.5/552/24는 oracle 대신 사용하지 않습니다.
- Output 각 component는 별도의 Fraction Green 면적/중심과 ray-parity로 검사합니다. 8개 probe는 crop 밖 leakage, material loss, bridge, overlap을 확인합니다. Area/centroid practical tolerance는1e-7입니다.
- 공개 compileCadModel은 각 component의 실제 geometry를 shared source에서 해석합니다. 공개 surfaceEvaluator는 모든 stored trim vertex에서 원본 authority와 비교합니다. 이는 local observation이며 whole-support coefficient/Jacobian certificate가 아닙니다.
- Witness420, 중심[86,.5,3.5], key/names는 공개 Part read 경로로 유지 여부를 검사합니다. Surface material은 closed-solid mass로 주장하지 않습니다.

기존 IGES/Thicken/Sew 거절은 실제 컨트롤로 검사합니다. 직전 실제 rename이 Undo에서 복구되는지 확인해 거절3개가 Undo 항목을 추가하지 않았음을 확인합니다.

Sourcecapsule은 initial subset과 full bundle input 수를 구분합니다. 가상 stdin은 디스크 capsule에서 명시적으로 제외하고 정확한 소스와 해시를 별도로 저장합니다. watcher, errors/downloads, failure screenshot, cleanup 후 capsule을 보존합니다.

숫자 성공은 시각적 PASS가 아닙니다. Receipt는 `NUMERIC_AND_UI_FLOW_ONLY`와 `ROOT_MUST_VIEW_SCREENSHOTS`를 유지합니다. Root는 inside2개, outside pocket, hole, retained rectangle 화면을 직접 확인해야 합니다.

## Run02 renderer probe enhancement

Root 보고: run01 numeric PASS, visual FAIL. Hole/retained rectangle의 빈 fill 문제는 제품 Model 경계 수정 작업과 별도로 처리합니다. Run01 증거와 ecab49052 driver 기준은 보존했습니다.

새 driver 검사: `node --check` PASS. 추가 renderer probe 실행은 NOT_RUN입니다. Root의 rebuild/freeze/run02를 기다립니다.

독립 Fraction verifier의 probe 목록에 실제 renderer 검사용 좌표를 추가했습니다. 각 positive point가 actual stored result mask 하나에 속함을 독립 oracle로 확인한 다음, 기존 read-only `window.__studioDirectAt(worldPoint)`가 그 component ID를 반환하는지 기다리고 기록합니다.

- Inside 두 component: [18.5,10.75,3], [31.5,10.75,3].
- Outside pocket: outer [42,2,3], pocket [25,6.25,3].
- Outside hole: outer [42,2,3], hole [18,10,3]은 null.
- Retained rectangle: [25,10,3].

[42,2,3]은 원본 curve에서 멀리 있는 외곽점입니다. 모든 기존 material 검증 호출에 renderer 검사를 연결했으므로 초기 결과와 fresh Open 결과를 모두 검사합니다. Retry도 검사합니다. Hook 존재 여부, actual/expected ID, 독립 mask owners, PASS/FAIL을 receipt에 남깁니다. Timeout에서도 actual pick을 기록합니다.

이 검사는 지정 점의 실제 draw/pick 경로만 확인합니다. 전체 coverage, certified mesh, 이미지 시각 PASS를 대신하지 않습니다. Root의 화면 검토는 계속 필요합니다.
