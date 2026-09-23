import assert from 'node:assert/strict';

const token = process.env.GH_TOKEN;
assert.ok(token, 'GitHub App token is required');

const response = await fetch('https://api.github.com/graphql', {
  method: 'POST',
  headers: {
    accept: 'application/vnd.github+json',
    authorization: `Bearer ${token}`,
    'content-type': 'application/json',
  },
  body: JSON.stringify({
    query: `query {
      repository(owner: "barocss", name: "barocss") {
        branchProtectionRules(first: 100) {
          nodes {
            pattern
            requiresApprovingReviews
            requiredApprovingReviewCount
            requiresStrictStatusChecks
            requiresConversationResolution
            requiredStatusCheckContexts
          }
        }
      }
    }`,
  }),
  signal: AbortSignal.timeout(15000),
});
assert.equal(response.status, 200, 'Cannot read main branch protection');
const payload = await response.json();
assert.deepEqual(payload.errors, undefined, 'Cannot inspect main branch protection');
const rules = payload.data?.repository?.branchProtectionRules?.nodes || [];
const main = rules.find((rule) => rule.pattern === 'main');
assert.ok(main, 'main needs an exact branch protection rule');
assert.equal(main.requiresApprovingReviews, true);
assert.ok(main.requiredApprovingReviewCount >= 1, 'main needs an independent approving review');
assert.equal(main.requiresStrictStatusChecks, true);
assert.equal(main.requiresConversationResolution, true);
for (const check of ['build', 'test']) {
  assert.ok(main.requiredStatusCheckContexts.includes(check), `main must require ${check}`);
}
console.log('main protection requires current reviews, build, test, and resolved conversations.');
