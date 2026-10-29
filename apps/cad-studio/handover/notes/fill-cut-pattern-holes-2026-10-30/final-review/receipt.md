# D345 final follow-up 독립 검토

판정: **PASS. Publication을 막는 finding 없음.**

이 판단은 지정 source follow-up과 저장된 실제 실행 근거에 한정한다. root는 기존 승인 범위의 문서 commit/normal push를 진행할 수 있다. release, 전체08, 일반 선택 remapping 또는 전체 suite PASS를 추가 승인하는 뜻은 아니다.

검토는 fixed checkout `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`에서 read-only로 수행했다. runtime/heavy/tests/browser/build/commit은 NOT_RUN이다. 제품 소스와 동결 D345 artifacts를 수정하지 않았다. 새 출력은 이 `/tmp/d345-final-review/receipt.md`뿐이다.

## source delta

`eaa1ec299` 이후의 두 변경을 직접 diff로 읽었다.

- `b22f7ba2e65c93cb2c136c14764782c669e1ac95`: rectangle의 wrapped label 탐색을 실제 public input IDs `sk-x/sk-y/sk-width/sk-height`로 바꿨다. 각 input이 정확히1개인지와 입력된 값까지 확인한다. 사용자 입력을 UI 밖에서 문서에 주입하지 않는다. geometry/mass/cell/name/Fraction oracle, guard 또는 acceptance 조건은 약화하지 않았다.
- `283b48afb26c7d98b66cfcc20d8fcf2ba6784edc`: App apply의 기존 Offset selection clear 조건에 Fill command만 추가했다. `active.cmd.build` 뒤 `commit(next)`가 성공한 뒤에만 실행한다. preview refused/busy, build refusal, commit 실패 또는 Cancel은 이 새 clear에 도달하지 않는다. unrelated commands의 clear/remap 동작을 바꾸지 않는다.

이 수정은 consumed target의 이전 배열 index가 재평가 뒤 다른 body를 가리키는 실제 관측에 대응한다. 일반 persistent selection remapper를 추가하지 않는다.

## run-02 실패와 run-03 해결

run-02의 actual Apply 뒤 record는 `selection.bodies=[0]`, body order `[b6,b8]`, selectedKeys `[b6]`다. witness도 b6다. 따라서 단순한 test 기대 문제가 아니라 unrelated witness가 실제로 선택되는 alias였다. 첫 run-02는 이 assert에서 FAIL했고 원본을 유지한다.

run-03의 같은 post-Apply record는 `selection.bodies=[]`, selectedKeys `[]`, order `[b6,b8]`다. 기존 witness body의 names/volume420/centroid와 native strict validity를 inspector가 계속 확인한다. alias assert는 제거되지 않았다.

run-03 saved receipt는 PASS이고 다음을 완료했다.

- 실제17-vertex hole-bearing source가 region picker에서 제외됨(optionCount0).
- numeric spacing refusal 시 document/selection 불변 및 Apply disabled.
- Cancel 후 source document와 guard selection 유지, Undo/Redo로 새 Fill commit이 없음을 확인.
- actual two-hole producer, valid preview 및 seven-cut Apply, Undo/Redo, native save/fresh Open.
- Y spacing edit의 nine cuts, source outer edit 뒤 기존 seven-cut snapshot 유지, explicit reselect의 five cuts, final save/fresh Open 및 editable fields.
- native/public/Model/actual Studio 값을 포함한 independent Fraction oracle6개 PASS. 그 중 fresh Open 및 final Open을 다시 검사했다.
- source before/frozen/after/after-cleanup hash976개 동일, watch changes/errors/consoleErrors 없음,1 Chrome/4 serial contexts와 종료 기록.

두 native save는 JSON semantic equality를 확인한다. raw-byte identity나 모든 UI selection의 Undo 복원으로 확대하지 않는다.

run-03에서 실제 source edit은 holes를 유지한 **outer edge** 편집이다. stored hole coordinates를 직접 UI에서 편집했다는 주장은 하지 않는다. inspector/oracle는 mask reference points를 검증하며 cutter clipping 또는 full-tool containment를 주장하지 않는다.

## visual 및 문서 경계

`/tmp/d345-root/visual-review.json`은 root가6장을 검토한 SCOPED_PASS다. seven-cut Apply에서 witness selected highlight가 없고, nine/five-cut states와 final editable state를 확인했다. 이 reviewer는 이미지를 새로 열지 않았고, 저장된 root visual finding만 읽었다. screenshot은 정확한 좌표/질량 oracle가 아니라 UI 존재/상태의 보조 근거다.

staged `report.ko.md`와 `qualification.json`은 reference-point mask, total16, preserved seed/index, 실제 outer-edit 한계, 첫 두 FAIL 보존, 일반 remapping/full suites/performance/remoteCI/release의 미실행 범위를 구분한다. 검토한 현재 문구에 material overclaim은 없다.

## 확인한 hash

| 근거 | SHA256 |
|---|---|
| apps/cad-studio/src/App.tsx | 878f77670463ebddeca3038de8a7b97a3bc2240fba006e9b3119709a72912670 |
| apps/cad-studio/test/fill-cut-pattern-holes-browser.mjs | 3e570f0ea6660a3600223363c391e7e09d34898bf21f27c0872116822fe833da |
| /tmp/d345-studio/run-02/receipt.json | dfe4f382251de9967cf9e5c17572a92fc2be07b1388806f815527f343cd5a50d |
| /tmp/d345-studio/run-03/receipt.json | 5aba092e857ce80950435a70d2a636edb113f640db49f4c9cdca14ec260e3bb7 |
| /tmp/d345-root/visual-review.json | 4620cef82a7d7c07113346fa203cfccca08dcf71930795ef0296f38d9083aac2 |

current App/driver hash는 run-03 source capsule과 직접 일치한다. 이 follow-up 검토는 앞선 동결 Kernel/Model geometry/API source 검토를 대체하지 않고, 실제 product selection 보완과 test follow-up의 범위를 추가로 확인한다.
