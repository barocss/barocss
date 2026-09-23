import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

const creation = readFileSync('.github/scripts/create-promotion-pr.mjs', 'utf8');
const workflow = readFileSync('.github/workflows/npm-arm-promotion.yml', 'utf8');

function assertApprovalArmsMerge(creationSource, workflowSource) {
  assert.doesNotMatch(creationSource, /gh['"], \['pr', 'merge'/);
  assert.match(creationSource, /wait for easylogic approval before arming auto-merge/);
  assert.match(workflowSource, /pull_request_review:\n    types: \[submitted\]/);
  assert.match(workflowSource, /github\.actor == 'easylogic'/);
  assert.match(workflowSource, /github\.event\.review\.state == 'approved'/);
  assert.match(workflowSource, /github\.event\.pull_request\.base\.ref == 'main'/);
  assert.match(workflowSource, /ref: develop\n          persist-credentials: false/);
  assert.match(workflowSource, /node \.github\/scripts\/arm-promotion-pr\.mjs/);
}

test('PR creation leaves auto-merge unarmed until the owner review event', () => {
  assertApprovalArmsMerge(creation, workflow);
});

test('a different reviewer cannot trigger the arm workflow', () => {
  assert.throws(() => assertApprovalArmsMerge(
    creation, workflow.replace("github.actor == 'easylogic'", "github.actor == 'other-maintainer'"),
  ));
});

test('arm workflow must not check out the reviewed PR head with App secrets', () => {
  assert.throws(() => assertApprovalArmsMerge(
    creation, workflow.replace('ref: develop', 'ref: ${{ github.event.pull_request.head.sha }}'),
  ));
});
