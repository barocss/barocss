/**
 * #1572 isolated audit of the existing persistent-box contact impulse law.
 * Run (from repo root): npx tsx examples/physics-contact-impulse-audit-1572/entry.ts
 * This is NOT a full-world stable-stack qualification.
 */
import type { Body, Vec3 } from '../../packages/barocss-physics/src/types.js';
import { solvePersistentPoint, warmStartPoint, type PointImpulse } from '../../packages/barocss-physics/src/persistent-box-contact.js';

const V = (x=0,y=0,z=0): Vec3 => [x,y,z];
function body(id: string, invMass: number, position: Vec3, velocity: Vec3): Body {
  return {
    id, kind: invMass ? 'dynamic' : 'static',
    shape: { kind:'box', halfExtentsM: V(0.5,0.5,0.5) },
    positionM: [...position], velocityMps: [...velocity],
    orientation: [0,0,0,1], angularVelocityRadps: V(),
    inverseMass: invMass, inverseInertiaLocal: invMass ? V(6,6,6) : V(),
    restitution: 0, frictionStatic: 0.8, frictionDynamic: 0.5,
    sensor: false
  };
}
function check(ok: boolean, label: string): void {
  if (!ok) throw new Error('CONTACT_AUDIT_FAILURE: '+label);
}
function near(a: number,b: number,eps=1e-10): boolean { return Math.abs(a-b)<=eps; }
function magnitude(v: Vec3): number { return Math.hypot(...v); }
const floor = body('floor',0,V(0,-0.5,0),V());
const box = body('box',1,V(0,0.5,0),V(0,-1,0));
const p: Vec3 = V(0,0,0);
const n: Vec3 = V(0,1,0);
const impulse: PointImpulse = { normalNs: 0, tangentNs: V() };
solvePersistentPoint(floor,box,p,n,impulse);
check(near(box.velocityMps[1],0), 'one-body normal resting velocity');
check(near(impulse.normalNs,1), 'one-body normal impulse equals incoming momentum');
check(near(magnitude(impulse.tangentNs),0), 'one-body no invented friction');

// Warm-start exactly recovers the previously solved velocity increment on a fresh copy.
const floorCopy = body('floor',0,V(0,-0.5,0),V());
const boxCopy = body('box',1,V(0,0.5,0),V(0,-1,0));
warmStartPoint(floorCopy,boxCopy,p,n,impulse);
check(near(boxCopy.velocityMps[1],box.velocityMps[1]), 'warm start reproduces normal result');

// Off-centre contact must couple linear motion and angular motion through lever arm.
const support = body('support',0,V(0,-0.5,0),V());
const upper = body('upper',1,V(0,0.5,0),V(1,-1,0));
const armPoint: Vec3 = V(0.25,0,0);
// Isolate the normal lever-arm response: friction can counter the induced spin.
support.frictionStatic = support.frictionDynamic = 0;
upper.frictionStatic = upper.frictionDynamic = 0;
const off: PointImpulse = { normalNs:0, tangentNs:V() };
solvePersistentPoint(support,upper,armPoint,n,off);
check(off.normalNs>0 && Number.isFinite(off.normalNs), 'off-centre positive normal impulse');
check(magnitude(upper.angularVelocityRadps)>0, 'off-centre angular response');
check(magnitude(off.tangentNs) <= 0.8*off.normalNs + 1e-10, 'Coulomb accumulated tangent bound');
check([...upper.velocityMps,...upper.angularVelocityRadps].every(Number.isFinite), 'finite result');
// A bounded two-box stack checks sequential contact impulse transport.
// This is a single contact-velocity sweep, NOT a time-stepped gravity simulation.
const stackFloor = body('stackFloor',0,V(0,-0.5,0),V());
const stackLower = body('stackLower',1,V(0,0.5,0),V(0,-1,0));
const stackUpper = body('stackUpper',1,V(0,1.5,0),V(0,-1,0));
const floorContact: PointImpulse = { normalNs:0,tangentNs:V() };
const upperContact: PointImpulse = { normalNs:0,tangentNs:V() };
solvePersistentPoint(stackFloor,stackLower,V(0,0,0),n,floorContact);
solvePersistentPoint(stackLower,stackUpper,V(0,1,0),n,upperContact);
// With a coupled stack, one Gauss-Seidel pass transfers momentum back to the
// lower box. It MUST NOT be mistaken for convergence.
check(near(stackLower.velocityMps[1],-0.5), 'first sweep lower has back reaction');
check(near(stackUpper.velocityMps[1],-0.5), 'first sweep upper shares velocity');
check(near(floorContact.normalNs,1), 'first sweep floor impulse');
check(near(upperContact.normalNs,0.5), 'first sweep inter-body impulse');

// Revisit both rows with one fixed, bounded 48-sweep budget; do not silently
// increase iterations until a new quality gate passes.
for (let sweep=1; sweep<48; sweep++) {
  solvePersistentPoint(stackFloor,stackLower,V(0,0,0),n,floorContact);
  solvePersistentPoint(stackLower,stackUpper,V(0,1,0),n,upperContact);
}
check(Math.abs(stackLower.velocityMps[1])<=1e-10, 'lower speed converges');
check(Math.abs(stackUpper.velocityMps[1])<=1e-10, 'upper speed converges');
check(near(floorContact.normalNs,2,1e-10), 'floor carries both incoming bodies');
check(near(upperContact.normalNs,1,1e-10), 'inter-body impulse carries upper body');
console.log(JSON.stringify({
  profile:'isolated-impulse-audit-v1', fullWorldQualified:false,
  oneBodyNormalImpulseNs:impulse.normalNs,
  offCentreNormalImpulseNs:off.normalNs,
  offCentreAngularVelocityRadps:upper.angularVelocityRadps,
  frictionImpulseNs:off.tangentNs,
  twoBodyStackImpulseNs:[floorContact.normalNs,upperContact.normalNs],
  status:'PASS'
},null,2));
