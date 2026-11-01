// examples/physics-world-p3-2276/evidence/candidate-build-01/provider/packages/barocss-physics/src/types.ts
var PhysicsError = class extends Error {
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.name = "PhysicsError";
    this.details = { code, reason: message, operation: "create", phase: "admission", domain: "world", entityIds: [], accepted: null, ...details };
  }
  details;
};

// examples/physics-world-p3-2276/evidence/candidate-build-01/provider/packages/barocss-physics/src/disjoint-hinge/report.ts
var nonempty = (value) => typeof value === "string" && value.length > 0;
function enforceHingeMotorReactionCap(jointId, angularImpulseNms) {
  const vector = denseNumbers(angularImpulseNms, 3);
  if (!nonempty(jointId) || !vector) reactionError();
  const norm = Math.hypot(...vector);
  if (!Number.isFinite(norm)) reactionError();
  if (norm > 0.01) throw new PhysicsError("NUMERIC_LIMIT", `${jointId} exceeded motor reaction limit`);
}
function reactionError() {
  throw new PhysicsError("NUMERIC_LIMIT", "unsafe joint reaction");
}
function denseNumbers(value, length) {
  if (!Array.isArray(value) || Object.getPrototypeOf(value) !== Array.prototype || value.length !== length || Reflect.ownKeys(value).length !== length + 1) return null;
  const result = [];
  for (let i = 0; i < length; i++) {
    const descriptor = Object.getOwnPropertyDescriptor(value, String(i));
    if (!descriptor || !descriptor.enumerable || !("value" in descriptor) || typeof descriptor.value !== "number" || !Number.isFinite(descriptor.value)) return null;
    result.push(descriptor.value);
  }
  return result;
}
export {
  PhysicsError,
  enforceHingeMotorReactionCap
};
