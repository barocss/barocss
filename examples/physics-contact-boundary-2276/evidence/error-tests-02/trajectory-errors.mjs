// examples/physics-contact-boundary-2276/runner-errors.test.mjs
import assert from "node:assert/strict";
import test from "node:test";

// examples/physics-rigid-full-pair-position-world/archive.mjs
function describeThrown(e) {
  let name = "ThrownValue", message = "Unexpected non-Error exception", code;
  try {
    if (e instanceof Error) {
      name = e.name;
      message = e.message;
      if (typeof e.code === "string") code = e.code;
    }
  } catch {
  }
  return { name, message, ...code === void 0 ? {} : { code } };
}

// examples/physics-stack-solver-2276/trajectory-errors.mjs
function requireResolvedReference(reply, label) {
  if (reply?.resolved !== true || reply?.executionFailure !== false) {
    throw new Error("Independent " + label + " unresolved: " + JSON.stringify(reply));
  }
}
function retainExecutionFailure(firstFailure, error, step) {
  const executionFailure = { kind: "execution-failure", step, ...describeThrown(error) };
  return { failure: firstFailure ?? executionFailure, executionFailure };
}

// examples/physics-contact-boundary-2276/step-observation.mjs
async function inspectAttempt(step, inspect) {
  let failure = null, executionFailure = null;
  try {
    await inspect((value) => {
      failure ??= value;
    });
  } catch (error) {
    ({ failure, executionFailure } = retainExecutionFailure(failure, error, step));
  }
  return { failure, executionFailure };
}
function throwIfExecutionFailed(outcome) {
  if (outcome.executionFailure) throw new Error("contact trajectory execution failure; both failure records retained");
}
function executionBudgetOutcome(step, elapsedMs, limitMs) {
  if (elapsedMs <= limitMs) return null;
  const record = { kind: "execution-wall-guard", step, limitMs };
  return { failure: record, executionFailure: record };
}

// examples/physics-contact-boundary-2276/runner-errors.test.mjs
test("actual step observer retains a physical failure followed by an unresolved reference and aborts", async () => {
  const physical = { kind: "independent-contact-geometry", step: 2 };
  const outcome = await inspectAttempt(2, async (reject) => {
    reject(physical);
    requireResolvedReference({ resolved: false, executionFailure: true }, "position");
  });
  assert.equal(outcome.failure, physical);
  assert.equal(outcome.executionFailure.kind, "execution-failure");
  assert.match(outcome.executionFailure.message, /position unresolved/);
  assert.throws(() => throwIfExecutionFailed(outcome), /both failure records retained/);
});
test("first execution error becomes the primary failure and aborts", async () => {
  const outcome = await inspectAttempt(1, async () => {
    throw new RangeError("bad archive");
  });
  assert.equal(outcome.failure, outcome.executionFailure);
  assert.equal(outcome.executionFailure.name, "RangeError");
  assert.throws(() => throwIfExecutionFailed(outcome));
});
test("resolved physical rejection stays a numerical NO_GO without an execution exception", async () => {
  const physical = { kind: "independent-contact-geometry", step: 1 };
  const outcome = await inspectAttempt(1, async (reject) => {
    requireResolvedReference({ ok: false, resolved: true, executionFailure: false }, "contact");
    reject(physical);
  });
  assert.equal(outcome.failure, physical);
  assert.equal(outcome.executionFailure, null);
  assert.doesNotThrow(() => throwIfExecutionFailed(outcome));
});
test("execution deadline retains its explicit record and aborts rather than advancing another case", () => {
  assert.equal(executionBudgetOutcome(1, 18e4, 18e4), null);
  const outcome = executionBudgetOutcome(309, 180001, 18e4);
  assert.equal(outcome.failure, outcome.executionFailure);
  assert.deepEqual(outcome.failure, { kind: "execution-wall-guard", step: 309, limitMs: 18e4 });
  assert.throws(() => throwIfExecutionFailed(outcome));
});
