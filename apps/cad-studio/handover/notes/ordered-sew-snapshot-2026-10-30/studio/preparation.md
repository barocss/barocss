# D339 Studio browser driver preparation

준비 완료. `node --check`: PASS. 빌드·테스트·브라우저 실행: NOT_RUN.

소유 파일: `apps/cad-studio/test/sew-snapshot-browser.mjs` 하나. D338 드라이버와 제품 소스는 수정하지 않았습니다. 커밋·푸시 없음.

고정 worktree의 `apps/cad-studio`에서 Node 22로 실행합니다. Root가 모든 소스 작성자를 중지하고 승인한 뒤 실행합니다.

```sh
D339_SOURCE_FROZEN=1 PW_DIR=/Users/user/.cache/barocss-playwright/node_modules/playwright CHROME='/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' node test/sew-snapshot-browser.mjs /tmp/d339-studio/run-01
```

`D339_SOURCE_FROZEN` 검사는 시드 생성 전에 수행합니다. Chrome 프로세스는 1개입니다. 컨텍스트는 순서대로 만들고 닫습니다.

선택자 계약:

- Direct 패널: complementary `Direct geometry`, 간격 입력 `Gap`, 버튼 `Sew into a body`.
- Sew HUD: dialog `Sew`, 입력 `Tolerance (0: automatic)`, 버튼 `Apply`/`Cancel`.
- 이력 편집: `.history .hs[data-node-index]`, `.node-editor`, 입력 `Tolerance`. `Tolerance parameter` 선택자는 없어야 합니다. 시드에는 관련 없는 named parameter를 넣어 이 검사를 유효하게 만듭니다.
- Trim: 실제 UI `Trim keeps`/`Trim by the curve`. 6번째 면 xmax에 curve를 투영하고, 그 면을 Sew 목록의 마지막으로 선택합니다.
- 원본 표시: `.ol.direct.hidden-obj` 클릭. 이후 실제 Move/Delete로 스냅샷 독립성을 검사합니다.

실제 UI 흐름:

1. 공개 Model importSource 시드에서 6개 면을 authored order로 선택합니다.
2. Sew .01 preview 표시 체적14820, accepted 문서·선택·가시성 불변을 검사합니다. Preview 중심은 주장하지 않습니다.
3. Cancel, 재시도 Apply, 같은 커밋의 원본 숨김, Undo/Redo를 검사합니다.
4. tol .02, tol0 auto, Save/fresh Open, 동일 레시피·순서·이름·편집 필드를 검사합니다.
5. 원본 Show/Move/Delete 이후 accepted body가 동일한지 검사합니다.
6. 실제 Trim으로 만든 이전 Undo 항목을 사용합니다. 5면 preview refusal과 마지막 member trim context refusal이 새 Undo 항목을 추가하지 않는지 검사합니다. 실제 오류 문구를 저장합니다.
7. 정상 Sew 재시도 후 별도의 공개 facade 생성 파일을 Open/Save/fresh Open하고 editable numeric tol을 검사합니다. Scalar parameter 실행은 NOT_RUN이며 선언 계약 범위 밖입니다.

공개 native read 경로는 Part mass/select/meshes와 partBreps/checkBrep입니다. 체적14400(허용오차1e-6), 중심[30,9,9]·bounds·면 중심·법선·면적(1e-7), native8V12E6F/1closed shell, native와 public 이름을 각각 기록합니다. 각 native surfaceK의 여섯 필드가 authored snapshotK와 같은지 검사합니다. Witness420·중심·key·이름은 모든 컨텍스트에서 유지해야 합니다.

출처 capsule은 초기 입력과 전체 bundle 입력 수를 구분합니다. 가상 stdin은 디스크 capsule에서 명시적으로 제외하고 정확한 내용을 별도 파일과 해시로 저장합니다. watcher·실행 전후·cleanup 후 capsule과 실패 상태/스크린샷을 보존합니다. 해시는 geometry 증거가 아닙니다.
