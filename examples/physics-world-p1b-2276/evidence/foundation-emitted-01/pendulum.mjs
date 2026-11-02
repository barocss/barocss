// examples/physics-motion-foundations-2276/pendulum.test.ts
import assert from "node:assert/strict";
import test from "node:test";

// packages/barocss-physics/dist/types.js
var PhysicsError = class extends Error {
  code;
  details;
  constructor(code, message, details) {
    super(message);
    this.code = code;
    this.name = "PhysicsError";
    this.details = { code, reason: message, operation: "create", phase: "admission", domain: "world", entityIds: [], accepted: null, ...details };
  }
};

// packages/barocss-physics/dist/index.js
var DT = 1 / 120;
var WALKABLE = Math.cos(10 * Math.PI / 180);

// examples/physics-planar-pendulum-reference/pendulum.ts
function fail(code, message) {
  throw new PhysicsError(code, message);
}
function data(value, allowed, label) {
  try {
    if (value === null || typeof value !== "object" || Array.isArray(value)) {
      fail("INVALID_CONFIG", `${label} must be a plain object`);
    }
    const prototype = Object.getPrototypeOf(value);
    if (prototype !== null && prototype !== Object.prototype) {
      fail("INVALID_CONFIG", `${label} must be a plain object`);
    }
    const out = /* @__PURE__ */ Object.create(null);
    for (const key of Reflect.ownKeys(value)) {
      if (typeof key !== "string" || !allowed.includes(key)) {
        fail("INVALID_CONFIG", `${label} has an unsupported field`);
      }
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (!descriptor || !Object.hasOwn(descriptor, "value")) {
        fail("INVALID_CONFIG", `${label} must contain data fields`);
      }
      out[key] = descriptor.value;
    }
    return out;
  } catch (error) {
    if (error instanceof PhysicsError) throw error;
    return fail("INVALID_CONFIG", `${label} reflection failed`);
  }
}
function number(value, low, high, label) {
  if (typeof value !== "number" || !Number.isFinite(value) || value < low || value > high) {
    fail("INVALID_CONFIG", `${label} must be finite and in [${low}, ${high}]`);
  }
  return value;
}
function createPlanarPendulum(config) {
  const input = data(config, [
    "massKg",
    "comDistanceM",
    "inertia",
    "gravityMps2",
    "initialAngleRad",
    "initialAngularVelocityRadps",
    "fixedStepSeconds",
    "maxSteps"
  ], "pendulum");
  const mass = number(input.massKg, 1e-6, 1e6, "massKg");
  const length = number(input.comDistanceM, 1e-4, 100, "comDistanceM");
  const gravity = number(input.gravityMps2, 0, 100, "gravityMps2");
  const moment = data(input.inertia, ["about", "kgM2"], "inertia");
  const specifiedInertia = number(moment.kgM2, 0, 1e10, "inertia.kgM2");
  const offsetInertia = mass * length * length;
  if (moment.about !== "com" && moment.about !== "pivot") {
    fail("INVALID_CONFIG", "inertia.about must be com or pivot");
  }
  const pivotInertia = moment.about === "com" ? specifiedInertia + offsetInertia : specifiedInertia;
  if (!Number.isFinite(pivotInertia) || pivotInertia < offsetInertia || pivotInertia > 1e10) {
    fail("INVALID_CONFIG", "Pivot inertia must be in [massKg * comDistanceM\xB2, 1e10]");
  }
  const dt = number(input.fixedStepSeconds, 1e-6, 1 / 30, "fixedStepSeconds");
  const gravityMoment = mass * gravity * length;
  const frequencySquared = gravityMoment / pivotInertia;
  if (dt * Math.sqrt(frequencySquared) > 0.05) {
    fail("INVALID_CONFIG", "fixedStepSeconds * naturalFrequency must be at most 0.05");
  }
  const maxSteps = Object.hasOwn(input, "maxSteps") ? number(input.maxSteps, 1, 1e6, "maxSteps") : 1e6;
  if (!Number.isInteger(maxSteps)) fail("INVALID_CONFIG", "maxSteps must be an integer");
  let angle = number(input.initialAngleRad, -1e6, 1e6, "initialAngleRad");
  let velocity = number(input.initialAngularVelocityRadps, -1e3, 1e3, "initialAngularVelocityRadps");
  let stepIndex = 0;
  let disposed = false;
  const acceleration = (q) => -frequencySquared * Math.sin(q);
  const energy = (q, w) => 0.5 * pivotInertia * w * w + 2 * gravityMoment * Math.sin(q / 2) ** 2;
  function active() {
    if (disposed) fail("DISPOSED", "Planar pendulum is disposed");
  }
  function getState() {
    active();
    return {
      stepIndex,
      timeSeconds: stepIndex * dt,
      angleRad: angle,
      angularVelocityRadps: velocity,
      angularAccelerationRadps2: acceleration(angle),
      comPositionM: [length * Math.sin(angle), -length * Math.cos(angle), 0],
      energyJ: energy(angle, velocity)
    };
  }
  return {
    getState,
    step(fixedStepSeconds) {
      active();
      if (fixedStepSeconds !== dt) fail("INVALID_STEP", "Pendulum step must equal its fixedStepSeconds");
      if (stepIndex >= maxSteps) fail("WORLD_LIMIT", "Pendulum step limit reached");
      const halfVelocity = velocity + 0.5 * dt * acceleration(angle);
      const nextAngle = angle + dt * halfVelocity;
      const nextVelocity = halfVelocity + 0.5 * dt * acceleration(nextAngle);
      if (!Number.isFinite(nextAngle) || Math.abs(nextAngle) > 1e6 || !Number.isFinite(nextVelocity) || Math.abs(nextVelocity) > 1e3 || !Number.isFinite(energy(nextAngle, nextVelocity))) {
        fail("NUMERIC_LIMIT", "Pendulum candidate exceeded numeric bounds");
      }
      angle = nextAngle;
      velocity = nextVelocity;
      stepIndex++;
      return getState();
    },
    dispose() {
      disposed = true;
    }
  };
}

// examples/physics-motion-foundations-2276/pendulum.test.ts
var GATES = {
  periodRelative: 0.01,
  energyRelative: 0.01,
  energyAbsoluteJ: 1e-20,
  oracleRelative: 1e-11,
  orderLow: 3.2,
  orderHigh: 4.8,
  reporterAbsoluteJ: 1e-12,
  reporterRelative: 1e-12,
  flightTimeAbsoluteSeconds: 1e-12,
  angleAbsoluteRad: 1e-3,
  speedAbsoluteRadps: 0.01
};
function model(angle = 1.5, dt = 1 / 120) {
  return {
    massKg: 2,
    comDistanceM: 0.6,
    inertia: { about: "com", kgM2: 0.2 },
    gravityMps2: 9.80665,
    initialAngleRad: angle,
    initialAngularVelocityRadps: 0,
    fixedStepSeconds: dt
  };
}
function physical(config) {
  const inertia = config.inertia.kgM2 + (config.inertia.about === "com" ? config.massKg * config.comDistanceM ** 2 : 0);
  return { inertia, coefficient: config.massKg * config.gravityMps2 * config.comDistanceM / inertia };
}
function periodAgm(config) {
  const k = Math.sin(Math.abs(config.initialAngleRad) / 2);
  let a = 1, b = Math.sqrt(1 - k * k);
  for (let i = 0; i < 32; i++) {
    const nextA = (a + b) / 2;
    const nextB = Math.sqrt(a * b);
    if (nextA === a && nextB === b) break;
    a = nextA;
    b = nextB;
  }
  return 2 * Math.PI / (a * Math.sqrt(physical(config).coefficient));
}
function periodQuadrature(config) {
  const k = Math.sin(Math.abs(config.initialAngleRad) / 2), n = 4096;
  const h = Math.PI / (2 * n);
  let integral = 0;
  for (let i = 0; i <= n; i++) {
    const value = 1 / Math.sqrt(1 - k * k * Math.sin(i * h) ** 2);
    integral += (i === 0 || i === n ? 1 : i % 2 === 0 ? 2 : 4) * value;
  }
  return 4 * integral * h / (3 * Math.sqrt(physical(config).coefficient));
}
function inputEnergy(config) {
  const q = config.initialAngleRad;
  const heightFactor = Math.abs(q) < 1e-6 ? q * q / 2 - q ** 4 / 24 + q ** 6 / 720 : 1 - Math.cos(q);
  return 0.5 * physical(config).inertia * config.initialAngularVelocityRadps ** 2 + config.massKg * config.gravityMps2 * config.comDistanceM * heightFactor;
}
function measuredEnergy(config, state) {
  const q = state.angleRad;
  const height = Math.abs(config.initialAngleRad) < 1e-6 ? config.comDistanceM * (q * q / 2 - q ** 4 / 24 + q ** 6 / 720) : config.comDistanceM + state.comPositionM[1];
  const energy = 0.5 * physical(config).inertia * state.angularVelocityRadps ** 2 + config.massKg * config.gravityMps2 * height;
  assert.ok(Math.abs(state.energyJ - energy) <= GATES.reporterAbsoluteJ + GATES.reporterRelative * Math.abs(energy), `Reported energy ${state.energyJ}; independent energy ${energy}`);
  return energy;
}
function flightTime(config, phi, intervals) {
  const k = Math.sin(config.initialAngleRad / 2), end = Math.PI / 2;
  const h = (end - phi) / intervals;
  let sum = 0;
  for (let i = 0; i <= intervals; i++) {
    const u = phi + i * h;
    sum += (i === 0 || i === intervals ? 1 : i % 2 === 0 ? 2 : 4) / Math.sqrt(1 - k * k * Math.sin(u) ** 2);
  }
  return h * sum / (3 * Math.sqrt(physical(config).coefficient));
}
function trajectoryOracle(config, timeSeconds) {
  assert.ok(timeSeconds > 0 && timeSeconds < periodAgm(config) / 4);
  assert.equal(config.initialAngularVelocityRadps, 0);
  assert.ok(config.initialAngleRad > 0 && config.initialAngleRad < Math.PI);
  let low = 0, high = Math.PI / 2;
  for (let i = 0; i < 64; i++) {
    const middle = (low + high) / 2;
    if (flightTime(config, middle, 4096) > timeSeconds) low = middle;
    else high = middle;
  }
  const phi = (low + high) / 2;
  const fineTime = flightTime(config, phi, 4096), coarseTime = flightTime(config, phi, 2048);
  const quadratureErrorSeconds = Math.abs(fineTime - coarseTime);
  const inversionResidualSeconds = Math.abs(fineTime - timeSeconds);
  assert.ok(quadratureErrorSeconds <= GATES.flightTimeAbsoluteSeconds);
  assert.ok(inversionResidualSeconds <= GATES.flightTimeAbsoluteSeconds);
  const angleRad = 2 * Math.asin(Math.sin(config.initialAngleRad / 2) * Math.sin(phi));
  const angularVelocityRadps = -Math.sqrt(2 * physical(config).coefficient * (Math.cos(angleRad) - Math.cos(config.initialAngleRad)));
  return { angleRad, angularVelocityRadps, quadratureErrorSeconds, inversionResidualSeconds };
}
function run(config, cycles) {
  const pendulum = createPlanarPendulum(config), initial = pendulum.getState();
  const initialEnergyJ = inputEnergy(config);
  measuredEnergy(config, initial);
  const expectedPeriod = periodAgm(config);
  const crossings = [];
  let previous = initial, maxEnergyError = 0;
  const steps = Math.ceil((cycles + 1) * expectedPeriod / config.fixedStepSeconds);
  for (let i = 0; i < steps; i++) {
    const current = pendulum.step(config.fixedStepSeconds);
    maxEnergyError = Math.max(maxEnergyError, Math.abs(measuredEnergy(config, current) - initialEnergyJ));
    if (previous.angleRad > 0 && current.angleRad <= 0 && current.angularVelocityRadps < 0) {
      const fraction = previous.angleRad / (previous.angleRad - current.angleRad);
      crossings.push(previous.timeSeconds + fraction * config.fixedStepSeconds);
    }
    previous = current;
  }
  assert.ok(crossings.length >= cycles + 1, `Need ${cycles + 1} zero crossings`);
  const measuredPeriod = (crossings[cycles] - crossings[0]) / cycles;
  return {
    expectedPeriod,
    measuredPeriod,
    initialEnergyJ,
    maxEnergyError,
    periodRelativeError: Math.abs(measuredPeriod - expectedPeriod) / expectedPeriod
  };
}
function energyGate(result) {
  assert.ok(result.maxEnergyError <= Math.max(
    GATES.energyAbsoluteJ,
    GATES.energyRelative * result.initialEnergyJ
  ), JSON.stringify(result));
}
function rejects(config, code = "INVALID_CONFIG") {
  assert.throws(
    () => createPlanarPendulum(config),
    (error) => error instanceof PhysicsError && error.code === code
  );
}
test("AGM and independent quadrature period references agree before measuring the solver", () => {
  for (const angle of [1e-4, 0.5, 1.5, 2.5]) {
    const config = model(angle), agm = periodAgm(config), quadrature = periodQuadrature(config);
    assert.ok(Math.abs(agm - quadrature) / agm <= GATES.oracleRelative);
  }
  const tiny = model(1e-8);
  assert.ok(Math.abs(periodAgm(tiny) - 2 * Math.PI / Math.sqrt(physical(tiny).coefficient)) < 1e-14);
});
test("ten cycles meet fixed period and energy gates at four libration amplitudes", (context) => {
  for (const angle of [1e-4, 0.5, 1.5, 2.5]) {
    const result = run(model(angle), 10);
    context.diagnostic(JSON.stringify({ angleRad: angle, ...result }));
    assert.ok(result.periodRelativeError <= GATES.periodRelative, JSON.stringify(result));
    energyGate(result);
  }
});
test("halving dt gives second-order period and energy convergence against analytic periods", (context) => {
  const results = [1 / 120, 1 / 240, 1 / 480].map((dt) => run(model(1.5, dt), 10));
  context.diagnostic(JSON.stringify({ stepsSeconds: [1 / 120, 1 / 240, 1 / 480], results }));
  for (let i = 0; i < 2; i++) {
    const periodRatio = results[i].periodRelativeError / results[i + 1].periodRelativeError;
    const energyRatio = results[i].maxEnergyError / results[i + 1].maxEnergyError;
    assert.ok(periodRatio >= GATES.orderLow && periodRatio <= GATES.orderHigh, `period ratio ${periodRatio}`);
    assert.ok(energyRatio >= GATES.orderLow && energyRatio <= GATES.orderHigh, `energy ratio ${energyRatio}`);
  }
});
test("angle and angular speed converge at identical times against elliptic time-of-flight inversion", (context) => {
  const timesSeconds = [0.1, 0.2, 0.3], stepsSeconds = [1 / 120, 1 / 240, 1 / 480];
  const reference = timesSeconds.map((time) => trajectoryOracle(model(), time));
  context.diagnostic(JSON.stringify({ timesSeconds, reference }));
  const results = stepsSeconds.map((dt) => {
    const pendulum = createPlanarPendulum(model(1.5, dt));
    let completed = 0;
    const samples = timesSeconds.map((time, i) => {
      const target = Math.round(time / dt);
      while (completed < target) {
        pendulum.step(dt);
        completed++;
      }
      const state = pendulum.getState();
      assert.ok(Math.abs(state.timeSeconds - time) < 1e-14);
      const angleErrorRad = Math.abs(state.angleRad - reference[i].angleRad);
      const speedErrorRadps = Math.abs(state.angularVelocityRadps - reference[i].angularVelocityRadps);
      assert.ok(angleErrorRad <= GATES.angleAbsoluteRad);
      assert.ok(speedErrorRadps <= GATES.speedAbsoluteRadps);
      return {
        timeSeconds: time,
        angleRad: state.angleRad,
        angularVelocityRadps: state.angularVelocityRadps,
        angleErrorRad,
        speedErrorRadps
      };
    });
    return {
      dt,
      samples,
      maxAngleErrorRad: Math.max(...samples.map((sample) => sample.angleErrorRad)),
      maxSpeedErrorRadps: Math.max(...samples.map((sample) => sample.speedErrorRadps))
    };
  });
  context.diagnostic(JSON.stringify({ results }));
  for (let i = 0; i < 2; i++) {
    const angleRatio = results[i].maxAngleErrorRad / results[i + 1].maxAngleErrorRad;
    const speedRatio = results[i].maxSpeedErrorRadps / results[i + 1].maxSpeedErrorRadps;
    assert.ok(angleRatio >= GATES.orderLow && angleRatio <= GATES.orderHigh, `angle ratio ${angleRatio}`);
    assert.ok(speedRatio >= GATES.orderLow && speedRatio <= GATES.orderHigh, `speed ratio ${speedRatio}`);
  }
});
test("100 cycles keep the energy envelope bounded and retain the period gate", (context) => {
  const result = run(model(2.5), 100);
  context.diagnostic(JSON.stringify(result));
  energyGate(result);
  assert.ok(result.periodRelativeError <= GATES.periodRelative);
});
test("zero and near-zero energy use an absolute threshold", () => {
  const still = createPlanarPendulum(model(0));
  for (let i = 0; i < 100; i++) {
    const state = still.step(1 / 120);
    assert.equal(state.angleRad, 0);
    assert.equal(state.angularVelocityRadps, 0);
    assert.equal(state.energyJ, 0);
  }
  const tinyConfig = model(1e-12), tinyInitial = createPlanarPendulum(tinyConfig).getState();
  const q = tinyConfig.initialAngleRad;
  const expectedEnergy = tinyConfig.massKg * tinyConfig.gravityMps2 * tinyConfig.comDistanceM * (q * q / 2 - q ** 4 / 24);
  assert.ok(tinyInitial.energyJ > 0);
  assert.ok(Math.abs(tinyInitial.energyJ - expectedEnergy) <= 1e-14 * expectedEnergy);
  const result = run(tinyConfig, 10);
  assert.ok(result.maxEnergyError <= GATES.energyAbsoluteJ);
});
test("COM and pivot inertia agree, gravity sign and right-hand axes are explicit", () => {
  const config = model(0.5), com = createPlanarPendulum(config);
  const pivot = createPlanarPendulum({ ...config, inertia: { about: "pivot", kgM2: physical(config).inertia } });
  const initial = com.getState();
  assert.ok(initial.comPositionM[0] > 0 && initial.comPositionM[1] < 0);
  assert.equal(initial.comPositionM[2], 0);
  assert.equal(initial.angularAccelerationRadps2, -physical(config).coefficient * Math.sin(0.5));
  for (let i = 0; i < 100; i++) assert.deepEqual(com.step(1 / 120), pivot.step(1 / 120));
  rejects({ ...config, inertia: { about: "pivot", kgM2: config.massKg * config.comDistanceM ** 2 - 0.01 } });
  const rod = createPlanarPendulum({
    ...model(Math.PI / 2),
    massKg: 3,
    comDistanceM: 1,
    inertia: { about: "com", kgM2: 1 }
  });
  assert.ok(Math.abs(rod.getState().angularAccelerationRadps2 + 3 * 9.80665 / 4) < 1e-14);
});
test("zero gravity admits a free rotor and copied config/output cannot alter it", () => {
  const config = { ...model(0.2), gravityMps2: 0, initialAngularVelocityRadps: 0.4 };
  const pendulum = createPlanarPendulum(config);
  config.inertia.kgM2 = 999;
  config.fixedStepSeconds = 1 / 240;
  const state = pendulum.getState(), initialEnergy = state.energyJ;
  state.comPositionM[0] = 999;
  state.angleRad = 999;
  for (let i = 0; i < 120; i++) pendulum.step(1 / 120);
  const result = pendulum.getState();
  assert.ok(Math.abs(result.angleRad - 0.6) < 1e-13);
  assert.equal(result.angularVelocityRadps, 0.4);
  assert.equal(result.energyJ, initialEnergy);
  assert.equal(result.timeSeconds, 1);
});
test("separate instances replay exactly for the same input and fixed-step order", () => {
  const a = createPlanarPendulum(model()), b = createPlanarPendulum(model());
  for (let i = 0; i < 1e3; i++) assert.deepEqual(a.step(1 / 120), b.step(1 / 120));
});
test("invalid finite bounds, inertia, dt, and work budgets are refused", () => {
  for (const field of [
    "massKg",
    "comDistanceM",
    "gravityMps2",
    "initialAngleRad",
    "initialAngularVelocityRadps",
    "fixedStepSeconds",
    "maxSteps"
  ]) {
    for (const value of [NaN, Infinity, -Infinity, "1", null]) rejects({ ...model(), [field]: value });
  }
  for (const value of [NaN, Infinity, -Infinity, -1]) rejects({ ...model(), inertia: { about: "com", kgM2: value } });
  for (const patch of [
    { massKg: 0 },
    { comDistanceM: 0 },
    { gravityMps2: -1 },
    { fixedStepSeconds: 0 },
    { fixedStepSeconds: 1 / 20 },
    { maxSteps: 0 },
    { maxSteps: 1.5 },
    { maxSteps: 1000001 },
    { initialAngleRad: 1000001 },
    { initialAngularVelocityRadps: 1001 },
    { massKg: 1e7 },
    { comDistanceM: 101 },
    { gravityMps2: 101 },
    { fixedStepSeconds: 1e-7 }
  ]) rejects({ ...model(), ...patch });
  rejects({ ...model(), inertia: { about: "origin", kgM2: 1 } });
  rejects({ ...model(), inertia: { about: "com", kgM2: 1e10 } });
  rejects({ ...model(), inertia: { about: "pivot", kgM2: 0 } });
  rejects({ ...model(), comDistanceM: 1e-4, inertia: { about: "com", kgM2: 0 } });
  rejects({ ...model(), motor: {} });
  rejects(null);
  rejects([]);
  const accessor = { ...model() };
  Object.defineProperty(accessor, "massKg", { get() {
    throw new Error("Must not execute");
  } });
  rejects(accessor);
});
test("bad steps, numeric failure, and exhausted work retain the complete accepted state", () => {
  const pendulum = createPlanarPendulum({ ...model(), maxSteps: 1 });
  const initial = pendulum.getState();
  for (const dt of [0, 1 / 240, NaN, Infinity, -Infinity]) {
    assert.throws(() => pendulum.step(dt), (error) => error instanceof PhysicsError && error.code === "INVALID_STEP");
    assert.deepEqual(pendulum.getState(), initial);
  }
  const accepted = pendulum.step(1 / 120);
  assert.throws(() => pendulum.step(1 / 120), (error) => error instanceof PhysicsError && error.code === "WORLD_LIMIT");
  assert.deepEqual(pendulum.getState(), accepted);
  for (const config of [
    { ...model(1e6), gravityMps2: 0, initialAngularVelocityRadps: 1e3 },
    { ...model(-0.5, 1e-6), initialAngularVelocityRadps: 1e3 }
  ]) {
    const candidate = createPlanarPendulum(config), before = candidate.getState();
    assert.throws(() => candidate.step(config.fixedStepSeconds), (error) => error instanceof PhysicsError && error.code === "NUMERIC_LIMIT");
    assert.deepEqual(candidate.getState(), before);
  }
});
test("disposed instances refuse reads and steps with the existing PhysicsError code", () => {
  const pendulum = createPlanarPendulum(model());
  pendulum.dispose();
  assert.doesNotThrow(() => pendulum.dispose());
  for (const action of [() => pendulum.getState(), () => pendulum.step(1 / 120)]) {
    assert.throws(action, (error) => error instanceof PhysicsError && error.code === "DISPOSED");
  }
});
