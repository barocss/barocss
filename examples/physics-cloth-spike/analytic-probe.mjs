import assert from 'node:assert/strict';
import { projectDistance } from './constraints.mjs';

// Independent scalar reference: equal inverse masses, length 1.2, rest 1,
// alpha/dt^2 = 1. XPBD delta-lambda is -0.2/(1+1+1).
const fixture = { dt: 0.1, stretchComplianceMPerN: 0.01, stretchStiffness: 0.8 };
const sheet = () => ({ positions: new Float64Array([0, 0, 0, 1.2, 0, 0]),
  inverseMasses: new Float64Array([1, 1]) });
const edge = () => ({ a: 0, b: 1, rest: 1, kind: 'stretch', lambda: 0 });
const near = (actual, expected) => assert.ok(Math.abs(actual - expected) < 1e-12);
const xpbd = sheet(), compliant = edge();
projectDistance(xpbd, compliant, fixture, 'xpbd');
near(compliant.lambda, -0.2 / 3);
near(xpbd.positions[3] - xpbd.positions[0], 1 + 0.2 / 3);
const accepted = xpbd.positions.slice();
projectDistance(xpbd, compliant, fixture, 'xpbd');
for (let i = 0; i < accepted.length; i++) near(xpbd.positions[i], accepted[i]);
const pbd = sheet(), rigid = edge();
projectDistance(pbd, rigid, fixture, 'pbd');
near(pbd.positions[3] - pbd.positions[0], 1.04);
projectDistance(pbd, rigid, fixture, 'pbd');
near(pbd.positions[3] - pbd.positions[0], 1.008);
console.log(JSON.stringify({ result: 'ok', reference: 'equal-mass scalar distance constraint',
  xpbdLength: 1 + 0.2 / 3, pbdSecondLength: 1.008, materialValidation: false }));
