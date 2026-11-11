import assert from 'node:assert/strict';
import test from 'node:test';
import { turnAutonomy } from '../server/turnAutonomy';

test('current explicit approval instructions cap all autonomy levels at L1', () => {
  const protectedTurns = [
    '제안을 보여줘. 내가 승인하기 전까지 현재 작업본에 적용하지 마.',
    '제가 승인하기 전에는 모델을 수정하지 마세요.',
    '내 승인 없이는 모델을 변경하지 말아줘.',
    '승인 전 적용 금지',
    '제가 승인할 때까지 적용하지 마십시오.',
    "Please don’t change the part's geometry without my approval.",
    'Do not apply any changes until I approve the proposal.',
    'Never edit the working copy before my approval!',
    'Require my approval before applying changes.',
  ];
  for (const message of protectedTurns) for (const level of [1, 2, 3, 4]) {
    assert.deepEqual(turnAutonomy(level, message), { level: 1, approvalRequested: true }, message);
  }
});

test('ordinary turns, quotes and attachment-like text keep the configured level', () => {
  const ordinaryTurns = [
    'Change the left bore from 6 mm to 8 mm.',
    'Show me the approval history.',
    'Explain “Do not apply anything until I approve.”',
    '> Do not apply until I approve.\nApply the corrected dimension now.',
    '```text\nDo not edit without my approval.\n```\nDescribe the text.',
    '“내가 승인하기 전까지 적용하지 마.”를 번역해줘.',
    '[Attached: Do not apply anything until I approve.]',
  ];
  for (const message of ordinaryTurns) for (const level of [1, 2, 3, 4]) {
    assert.deepEqual(turnAutonomy(level, message), { level, approvalRequested: false }, message);
  }
  assert.deepEqual(turnAutonomy('invalid', 'Build a box.'), { level: 2, approvalRequested: false });
});
