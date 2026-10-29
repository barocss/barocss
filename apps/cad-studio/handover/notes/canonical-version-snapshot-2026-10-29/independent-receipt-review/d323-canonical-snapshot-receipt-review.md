# D323 canonical snapshot 작성자 증거 검토

판정: **APPROVE_BOUNDED_AUTHOR_RECEIPTS**. 작성자 커밋 `a5d1acfa7e6834951819eaaeeaf6da314cae9b8f`의 소스, 테스트 정의, 실행 로그와 보존된 UI 산출물은 제한된 수락 범위를 뒷받침한다. 이번 검토에서는 코드를 실행하지 않았다. 독립 runtime PASS 및 현재 전체 App PASS를 뜻하지 않는다.

검토 저장소는 `/Users/user/github/barocss/barocss/.claude/worktrees/barocss-cad-gpu-viewer-resume-d4f83b`이다. 확인한 현재 HEAD는 `436451c9ffe5225e0696591be932cd77ff4cfb3e`이며 dirty 항목은 untracked `.claude/`뿐이었다. 제품·WIP·기존 증거·state·ledger는 변경하지 않았다. 아래 소스 행은 별도 표시가 없으면 작성자 커밋 기준이다. 역사적 A04는 `runs/model-001/harness.json`만 재현 배경으로 읽었다.

## 소스와 실제 연결

- `apps/cad-studio/src/storage/project.ts:9,46–67`: 기존 Model의 `encodeStudioSnapshot`/`readStudioSnapshot`을 Version 쓰기와 읽기에 사용한다. 쓰기는 없는 key만 저장하며 snapshot 뒤에 log를 쓴다. 읽기는 저장된 bytes와 원래 key를 전용 codec에 전달한다. `:25–40,71–79`의 일반 Open 및 autosave 경로는 유지된다.
- `packages/barocss-cad-model/src/engine/container.ts:60–83,103–127`: 기존 binary decoder는 chunk와 SHA256을 검사한다. 전용 snapshot reader는 canonical key를 검사하고 admitted raw 문서를 반환한다. 일반 `readStudioFile:87–99`는 기존 normalization을 유지한다. `rawDocument:103–113`은 schema3와 route-bundle schema4를 허용하되 clone에서 기존 admission을 검사한다. 이 codec은 D323에서 새로 만든 구현이 아니다.
- `packages/barocss-cad-model/src/versions/log.ts:47,66–84,107–114,125–130` 및 `src/util/revision.ts:6–11`: canonical 표현은 undefined object member를 제외한다. false, 0, 빈 배열·객체·문자열과 생략된 nextId를 보존한다. readVersion은 원래 snapshot key·revision·id를 검사한다. version record와 parent를 normalization하지 않는다. key는 일관성 검사이며 암호학적 인증 보장은 아니다.
- `apps/cad-studio/src/storage/useProject.ts:55–58,68–73,84–95,150–159` → `VersionsPanel.tsx:85–108` → `App.tsx:578–593,3261–3263`에 실제 Open, Make version, Restore 연결이 있다. helper-only 변경이 아니다. 일반 Open은 먼저 readPart를 사용한다. 실패한 log는 오류로 보고하며 기존 문서 교체와 혼동하지 않는다.
- `apps/cad-studio/test/storage-version-snapshot.test.ts:14–31,34–103,106–132`: omitted nextId, 실제 route-bundle schema4, binary mesh 2개 blob, 원래 canonical 문서·key·version metadata·branches, false/0/empty 값을 검사한다. missing snapshot, 다른 key의 bytes와 잘못된 write 거부, write-once bytes/tag, 일반 Open/autosave normalization도 검사한다. 이 범위 밖 모든 schema/문서의 무손실 보존을 증명하지는 않는다.

## 보존된 작성자 실행 증거

작성자 note는 `apps/cad-studio/handover/notes/canonical-version-snapshot-2026-10-29/`이다. `qualification-artifacts.json`의 33개 참조와 `consumers/artifact-manifest.json`의 12개 참조는 45개이며 고유 경로는 33개다. 중복 12개를 제거했다. 모든 참조의 길이와 SHA256이 exact Git bytes와 일치한다. 별도 보존된 actual 6개 파일과 명시된 `/tmp/d323-project-version/` 사본도 작성자 Git bytes와 일치한다. 이는 파일 무결성 확인이며 새 실행이 아니다.

| 증거 | 수락 범위 |
|---|---|
| `unit/baseline.log` | 작성자 부모 `27500e219febc591845cd5e4c53341a24ca9d39b`에서 1 fail. 원래 canonical key 불일치가 보존됨. 현재 실패라는 뜻은 아님. |
| `unit/focused.log`, `focused-final.log` | 12/12와 final 5/5, fail/skip 0. final 5는 앞의 12와 중복이다. **고유 관련 테스트 12개**이며 17개가 아니다. 새 snapshot 5개와 기존 storage 7개다. |
| `unit/types-first-failure.log`, `types.log` | 동일한 원래 fixture 타입 오류 3개(TS2345/TS2352/TS2339)가 보존됨. 누락된 sweep name, DrawingSettings defaults, mesh node narrowing을 수정했다. |
| `unit/final-exits.txt` | focused_final=0, types_final=0, lint_final=0. 비어 있는 최종 types/lint 로그는 이 exit 기록과 함께 해석한다. |
| `consumers/first-run.txt`, `receipt.json` | selected CG6 project 1개 PASS 및 별도 starter smoke 1개, exit0. WebGPU/DPR1/1140×900 작성자 profile. 전체 browser suite PASS가 아님. |
| `root-docs-check.txt`, `root-docs-exit.txt` | 작성자 docs check exit0 기록. 독립 실행 아님. |

CG6의 exact driver는 `apps/cad-studio/test/browser-flow.mjs:9566–9638`이다. 실제 UI로 두 version을 만들고 Compare/Restore/프로젝트 autosave/같은 context reload 후 다시 Open을 확인한다. 선택기는 실제 OPFS directory handle을 반환하는 substitute다. 정상 문서의 positive control이며, UI에서 드문 omitted-nextId/binary fixture를 생성한 증거는 아니다. 자신의 OPFS 폴더 삭제와 browser/server close가 driver에 있다. 별도 삭제 확인 probe는 없다.

## binary 의미·bytes·provenance 경계

테스트 정의는 schema3 및 실제 route-bundle schema4 binary 입력을 만들고, 저장 후 읽은 문서의 canonical 동등성·원래 key·version metadata와 두 blob을 검사한다. 작성자 focused 로그는 두 fixture에 대해 `re-encoded bytes equal: true`를 보고한다. final 로그의 같은 두 줄은 재실행 중복이다. 이 bytes 비교는 테스트의 진단 출력이며 전체 입력에 대한 byte equality 계약이 아니다.

**이번 검토의 독립 binary 대조는 미완료다.** note와 명시된 원래 output 경로에 해당 `.bcad` 입력/출력 capsule이 보존되어 있지 않다. 따라서 실제 보존 binary를 다시 decode하거나 양쪽 raw bytes를 독립 비교하지 않았다. 이 제한은 작성자 실행·검사가 없었다는 뜻이 아니다. 수락 가능한 것은 exact 테스트 정의와 일치하는 작성자 실행 로그의 제한된 관측값이다.

qualification에 기록된 project/test hash와 consumer profile의 project/driver hash는 exact 작성자 소스와 일치한다. consumer 전체 bundle input graph나 실행 bundle capsule은 이 manifest에 없다. `apps/cad-studio/scripts/test.mjs:13–17`은 임시 bundle을 지운다. 초기 baseline fixture hash는 남아 있으나 그 초기 fixture 전체 source capsule은 없다. 전체 runtime graph 또는 baseline executable hash까지 검증했다고 말할 수 없다.

주요 SHA256:

- qualification: `f779e7c094bae2ebd7209e6101618dfe0e3862d5f841a66cdd15d3ab7b2f6b63`
- project.ts: `a927fd79a0db9be5d5b60f5380f2ad2ac114e4b5c33c0c9f5240da8772a815ad`
- snapshot test: `8f9c195c8c82ad980753977f8a9e7f862e30d592cd1ab548e869c3fc52038d14`
- browser driver: `9a031f112e8b0388bdbd16ba5d215fe0bb3a5d58456da85ad2cd0f87cf039a4c`
- consumer receipt: `fc71d9f15eb3deed715e94d5c2241c39f395f48be1b6de03bb6fe921f8cfe17a`
- source profile: `b8567b78cafa3f2c3acbdca96b2f77c87c187077153d412393f5e752c75856bc`
- derived inventory: `4c1528690babda88497d272f58a839e3b297ab72fed4d7c62234c9be1830da6b`

## 현재 적용 범위와 다음 확인 조건

현재 HEAD에서도 project.ts, VersionsPanel, snapshot/storage tests, test runner 및 검토한 Model container/version/revision 소스는 동일하다. useProject.ts, App.tsx, 전체 browser driver는 이후 변경되었다. 선택 CG6 block의 SHA256은 양쪽 모두 `f609afeedbd76cf3b47b41c1b6417df76287e14f7b035826ac7799bb97da2e9f`이다. note 자체도 동일하다. 따라서 저장 codec 수정의 source-equivalence는 확인했지만 현재 App의 새 runtime 수락으로 확장하지 않는다. 현재 roadmap:24–26,1592–1603의 제한된 qualification 표현과 부합한다.

Whole suite, 실제 OS native folder, fresh-context/cross-tab, crash/primary-file loss 및 독립 runtime은 **NOT_RUN**이다. #2236의 transfer closure는 이 수정의 현재 수락 근거가 아니다. 이슈를 다시 열거나 댓글을 달지 않았다.

추가 독립 byte 증명이 필요하면 작성자가 사용한 두 fixture의 실제 입력·snapshot 출력 bytes와 각각의 SHA256, source binding을 새 증거로 보존해야 한다. 전체 runtime provenance가 필요하면 당시 bundle/input manifest가 필요하다. 이번 사이클은 새 실행 없이 종료한다. 현재 제한된 소스·작성자 로그 수락을 위해 같은 성공 테스트를 다시 실행할 필요는 없다.
