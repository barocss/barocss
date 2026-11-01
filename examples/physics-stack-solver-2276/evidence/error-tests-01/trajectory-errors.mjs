// examples/physics-stack-solver-2276/trajectory-errors.test.mjs
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

// examples/physics-stack-solver-2276/trajectory-errors.test.mjs
test("an earlier physical failure cannot hide a later execution error", () => {
  const first = { kind: "independent-contact-geometry", step: 2 };
  const result = retainExecutionFailure(first, new Error("reference pipe lost"), 2);
  assert.equal(result.failure, first);
  assert.deepEqual(result.executionFailure, { kind: "execution-failure", step: 2, name: "Error", message: "reference pipe lost" });
});
test("an execution error without an earlier failure is the primary failure", () => {
  const result = retainExecutionFailure(null, new RangeError("invalid reference"), 1);
  assert.equal(result.failure, result.executionFailure);
  assert.equal(result.executionFailure.name, "RangeError");
});
test("resolved physical rejection differs from an unresolved reference envelope", () => {
  assert.doesNotThrow(() => requireResolvedReference({ ok: false, resolved: true, executionFailure: false }, "contact"));
  for (const reply of [null, {}, { resolved: false, executionFailure: true }, { resolved: true, executionFailure: true }]) {
    assert.throws(() => requireResolvedReference(reply, "contact"), /Independent contact unresolved/);
  }
});
