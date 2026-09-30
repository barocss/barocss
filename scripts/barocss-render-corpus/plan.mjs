// Frozen input candidates for #458. The launch packet binds this source to an exact commit.
export const SCENARIOS = Object.freeze([
  ['01', 'Create a profile form', 'Bea'],
  ['02', '이름을 입력하고 저장할 수 있는 밝은 프로필 폼을 만들어 줘. 화면 문구는 한국어로 써 줘.', '서연'],
  ['03', 'Create a light profile form with the heading Profile settings, a Name input, and a Save profile button.', 'Zoë'],
  ['04', 'Create a dark profile form with one name input and a save button.', "O'Neil"],
  ['05', 'Create a single-column profile form with spacious card padding and a name input plus a save button.', 'Alex Chen'],
  ['06', 'Create a responsive profile layout with a form card and a separate short help card. Include exactly one name input and one save button.', 'Morgan'],
  ['07', 'Create a compact light profile form using fractional spacing. Include a name input and a save button.', 'A'],
  ['08', 'Create a dark profile layout with wide gaps and spacious padding. Include exactly one name input and one save button.', 'Jean-Luc'],
  ['09', '밝은 프로필 폼을 만들어 줘. 제목은 내 프로필, 입력 이름은 이름, 저장 버튼은 저장으로 써 줘.', '민수 Kim'],
  ['10', 'Create a profile form with a heading, a short help text explaining that saving shows a local confirmation, one name input and a save button.', 'Avery Taylor Morgan'],
].map(([id, prompt, name]) => Object.freeze({ id, prompt, name })));

export const CONTRACT = Object.freeze({
  kind: 'barocss-render-corpus-v1',
  issue: 458,
  aggregateCeiling: 20,
  priorDispatches: 4,
  newDispatchCeiling: 16,
  perCallTimeoutMs: 180_000,
  wholeRunTimeoutMs: 3_600_000,
  viewportWidths: [1200, 390],
  granularity: 'complete-response',
  promptVersion: 'profile-form-v2',
  invalidInitialNextStatus: 'unattempted',
  noAutomaticRetry: true,
  rowOrder: SCENARIOS.map(({ id }) => id),
});
