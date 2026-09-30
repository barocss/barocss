import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import test from 'node:test';
import { claimCurrentHostLaunch, readCurrentHostDecision, reserveCurrentHostTurn,
  verifyCurrentHostPlan } from './current-host-gate.mjs';

const here = path.dirname(fileURLToPath(import.meta.url));
const privateRoot = '/Users/user/.barocss-ai/v3';
const planFile = path.join(here, 'current-host-plan.json');
const candidateCommit = 'a'.repeat(40);
const hostFingerprintSha256 = 'b'.repeat(64);

function fixture() {
  const id = randomUUID();
  const decisionFile = path.join(privateRoot, `private-464-current-host-decision-test-${id}.json`);
  const verified = verifyCurrentHostPlan();
  const decision = {
    kind: 'barocss-464-current-host-decision-v1', issue: 464,
    mode: 'owner-approved-current-host', decision: 'GO', candidateCommit,
    planSha256: verified.planSha256, runProfileSha256: verified.runProfileSha256,
    hostFingerprintSha256, maxNewTurns: 4,
    ownerApprovalReference: `synthetic-test-owner-${id}`,
    reviewAcceptReference: `synthetic-test-review-${id}`,
  };
  fs.writeFileSync(decisionFile, `${JSON.stringify(decision)}\n`, { flag: 'wx', mode: 0o600 });
  const args = { decisionFile, planFile, candidateCommit, hostFingerprintSha256 };
  const clean = (reservationDir) => {
    if (reservationDir) fs.rmSync(reservationDir, { recursive: true, force: true });
    fs.rmSync(decisionFile, { force: true });
  };
  return { args, decision, clean };
}

test('current-host plan retains the frozen model, prompts, bounds, and profile hash', () => {
  const verified = verifyCurrentHostPlan();
  assert.equal(verified.turns, 4);
  assert.deepEqual(verified.scenarios, ['01', '03']);
  assert.match(verified.runProfileSha256, /^[0-9a-f]{64}$/);
});

test('decision binds candidate, host fingerprint, plan, and profile before launch', () => {
  const { args, decision, clean } = fixture();
  try {
    assert.deepEqual(readCurrentHostDecision({ decisionFile: args.decisionFile,
      planFile, candidateCommit }).decision, decision);
    assert.throws(() => claimCurrentHostLaunch({ ...args, candidateCommit: 'c'.repeat(40) }));
    assert.throws(() => claimCurrentHostLaunch({ ...args, hostFingerprintSha256: 'c'.repeat(64) }));
    const modified = { ...decision, runProfileSha256: 'd'.repeat(64) };
    fs.writeFileSync(args.decisionFile, `${JSON.stringify(modified)}\n`);
    assert.throws(() => readCurrentHostDecision({ decisionFile: args.decisionFile,
      planFile, candidateCommit }));
    fs.writeFileSync(args.decisionFile, `${JSON.stringify(decision)}\n`);
    const modifiedPlan = path.join(privateRoot, `private-464-current-host-plan-test-${randomUUID()}.json`);
    try {
      const plan = JSON.parse(fs.readFileSync(planFile, 'utf8'));
      plan.model = 'wrong-model';
      fs.writeFileSync(modifiedPlan, `${JSON.stringify(plan)}\n`, { flag: 'wx', mode: 0o600 });
      assert.throws(() => claimCurrentHostLaunch({ ...args, planFile: modifiedPlan }));
    } finally { fs.rmSync(modifiedPlan, { force: true }); }
  } finally { clean(); }
});

test('legacy plan and decision path cannot enter current-host gate', () => {
  const { args, clean } = fixture();
  try {
    assert.throws(() => claimCurrentHostLaunch({ ...args,
      planFile: path.join(here, 'frozen-plan.json') }));
    const legacyName = path.join(privateRoot, `private-461-live-decision-test-${randomUUID()}.json`);
    try {
      fs.copyFileSync(args.decisionFile, legacyName);
      assert.throws(() => claimCurrentHostLaunch({ ...args, decisionFile: legacyName }));
    } finally { fs.rmSync(legacyName, { force: true }); }
  } finally { clean(); }
});

test('exclusive launch and ordered pre-turn reservations consume the allowance', () => {
  const { args, clean } = fixture();
  let reservationDir;
  try {
    assert.throws(() => reserveCurrentHostTurn({ ...args,
      ordinal: 1, rowId: '01', kind: 'initial' }));
    reservationDir = claimCurrentHostLaunch(args).reservationDir;
    assert.ok(fs.existsSync(path.join(reservationDir, 'launch.json')));
    assert.throws(() => claimCurrentHostLaunch(args));
    assert.throws(() => reserveCurrentHostTurn({ ...args,
      ordinal: 2, rowId: '01', kind: 'next' }));
    for (const [index, [rowId, kind]] of [['01', 'initial'], ['01', 'next'],
      ['03', 'initial'], ['03', 'next']].entries()) {
      const ordinal = index + 1;
      const reserved = reserveCurrentHostTurn({ ...args, ordinal, rowId, kind });
      assert.equal(reserved.ordinal, ordinal);
      assert.ok(fs.existsSync(path.join(reservationDir, `${ordinal}-${rowId}-${kind}.json`)));
      assert.throws(() => reserveCurrentHostTurn({ ...args, ordinal, rowId, kind }));
    }
    const copy = path.join(privateRoot, `private-464-current-host-decision-copy-${randomUUID()}.json`);
    try {
      fs.copyFileSync(args.decisionFile, copy);
      assert.throws(() => claimCurrentHostLaunch({ ...args, decisionFile: copy }));
    } finally { fs.rmSync(copy, { force: true }); }
  } finally { clean(reservationDir); }
});


test('spent #464 plan and profile bindings cannot authorize the corrected packet', () => {
  const { args, decision, clean } = fixture();
  try {
    for (const previousBinding of [
      { planSha256: '6a6047695f6ebb90aad9b07809af6703a00495ae148774ff2974964d2fe4d392' },
      { runProfileSha256: '5a8becc005729526498a0440b34f578880511fbcc75b4a9d222d1a030ad56c41' },
      { planSha256: '31dafc46de475fe7de3160e51bc5a6426e8bdadfdfbe0760b03e1d369a3ccb34' },
      { runProfileSha256: '11e4608299ac6c7ff85b2ddb1af1f842e65abad9c729d09250a4cfc7db1d0656' },
      { planSha256: '814a8206ec0ef582b1c208b02427ed07e1c979c3ae6dd2d0b269b3caf35fb0f1' },
      { runProfileSha256: '80661644f79f76748e6c31ff5fa87140a776bda121cc018e846c9f0073be00c8' },
    ]) {
      fs.writeFileSync(args.decisionFile, JSON.stringify({ ...decision, ...previousBinding }));
      assert.throws(() => readCurrentHostDecision({ decisionFile: args.decisionFile,
        planFile, candidateCommit }));
      assert.throws(() => claimCurrentHostLaunch(args));
    }
  } finally { clean(); }
});
