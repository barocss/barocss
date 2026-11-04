import {coupledStaticTarget} from '../physics-coupled-contact-2276/candidate.js';
import {createProductionContext} from './production-context.js';
import {Unresolved} from './math-core.js';
import type {CoupledInput,CoupledResult,DynamicCertificate,Q,V,Interval,Vec} from './types.js';
export type {CoupledInput,CoupledResult,DynamicCertificate,DynamicCounts,RootCertificate} from './types.js';

export function coupledContactTarget(input:CoupledInput):CoupledResult {
  const initial=coupledStaticTarget(input);
  if(initial.status==='UNRESOLVED')return initial;
  const staticCertificate=initial.certificate,staticCounts={...initial.certificate.counts};
  const core=createProductionContext();
  const {fail,sign,bits,checked,iadd,ineg,isub,imul,idiv,irem,ishift,gcd,q,neg,add,sub,mul,div,cmp,same,text,vtext,itext,parsed,word,dot,vm,va,vs,trim,pAdd,pNeg,pSub,pScale,pMul,primitive,trimInteger,primitiveInteger,remainder,derivative,sturm,point,value,variations,countOpen,midpoint,isolate,refine,singleton,iAdd,iNeg,iSub,iMul,iDiv,pInterval,pointQ,rootInterval,isqrt,sqrtRange,numeric,adjacent,present,classifyRoots}=core;
  try {
    const {zero,one}=core.initialize();
    if (input.muDynamicA !== 0.7 || input.muDynamicB !== 0.7) fail('OUTSIDE_DYNAMIC_MATERIAL_PROFILE');
    if (!Array.isArray(input.reportedNormal) || input.reportedNormal.length !== 3
      || [0, 1, 2].some(i => !Number.isFinite(input.reportedNormal[i]))) fail('DYNAMIC_REPORTED_NORMAL_SHAPE');
    const normal = staticCertificate.nativeUnitNormal.map(parsed) as V;
    const publicNormal = input.reportedNormal.map(word) as V, impulseGate = q(1n, 1000000000000n), motionGate = q(1n, 10000000000n);
    if (normal.some((n, i) => cmp(sub(publicNormal[i], n), impulseGate) > 0 || cmp(sub(n, publicNormal[i]), impulseGate) > 0))
      fail('DYNAMIC_REPORTED_NORMAL_CORRESPONDENCE');
    if (initial.status === 'STATIC_TARGET') return { ...initial, dynamicAdmissionCounts: core.copyCounts(),
      cumulativeRationalOps: staticCounts.rationalOps + core.copyCounts().rationalOps,
      cumulativeGcdSteps: staticCounts.gcdSteps + core.copyCounts().gcdSteps };
    const matrix = staticCertificate.physicalK.map(row => row.map(parsed) as V);
    const free = staticCertificate.freePointVelocityMps.map(parsed) as V;
    if (sign(parsed(staticCertificate.exactNormalNs).n) <= 0 || sign(parsed(staticCertificate.exactConeMarginSquared).n) <= 0)
      fail('DYNAMIC_STATIC_PRIORITY_GUARD');
    const quaternion = input.orientationXYZW.map(word), [x, y, z, w] = quaternion;
    const norm = dot(quaternion, quaternion), two = q(2n);
    const rows: V[] = [
      [sub(norm, mul(two, add(mul(y, y), mul(z, z)))), mul(two, sub(mul(x, y), mul(z, w))), mul(two, add(mul(x, z), mul(y, w)))],
      [mul(two, add(mul(x, y), mul(z, w))), sub(norm, mul(two, add(mul(x, x), mul(z, z)))), mul(two, sub(mul(y, z), mul(x, w)))],
      [mul(two, sub(mul(x, z), mul(y, w))), mul(two, add(mul(y, z), mul(x, w))), sub(norm, mul(two, add(mul(x, x), mul(y, y))))],
    ];
    const axes = [0, 1, 2].map(i => rows.map(row => div(row[i], norm)) as V);
    const tangent = axes.filter((_, i) => i !== input.nativeFaceAxis);
    if (!same(dot(normal, normal), one) || tangent.some(t => !same(dot(t, t), one) || sign(dot(t, normal).n))
      || sign(dot(tangent[0], tangent[1]).n)) fail('DYNAMIC_NATIVE_FRAME_NOT_ORTHONORMAL');
    const response = (a: Q[], b: Q[]): Q => dot(a, matrix.map(row => dot(row, b)));
    const k = response(normal, normal), c = tangent.map(t => response(normal, t));
    const dBlock = tangent.map(a => tangent.map(b => response(a, b)));
    const aBlock = dBlock.map((row, i) => row.map((value, j) => sub(value, div(mul(c[i], c[j]), k))));
    const un = dot(free, normal), ut = tangent.map(t => dot(free, t));
    const b = ut.map((value, i) => sub(value, div(mul(c[i], un), k)));
    const mu = word(input.muDynamicA), qD = mul(mu, word(input.muDynamicB));
    if (sign(k.n) <= 0 || sign(aBlock[0][0].n) <= 0
      || sign(sub(mul(aBlock[0][0], aBlock[1][1]), mul(aBlock[0][1], aBlock[1][0])).n) <= 0)
      fail('DYNAMIC_SCHUR_NOT_SPD');
    if (!same(aBlock[0][1], aBlock[1][0])) fail('DYNAMIC_SCHUR_NOT_SYMMETRIC');
    if (sign(un.n) >= 0) fail('DYNAMIC_FREE_NORMAL_NOT_CLOSING');
    if (sign(sub(mul(k, k), mul(qD, dot(c, c))).n) <= 0) fail('DYNAMIC_NORMAL_DENOMINATOR_UNQUALIFIED');
    if (!b.some(value => sign(value.n))) fail('DYNAMIC_ZERO_SCHUR_SLIP');
    // M=(1-s)I+s*A, z=adj(M)b, Y=s*z, H=-un*det(M)+c*Y.
    const m00 = [one, sub(aBlock[0][0], one)], m01 = [zero, aBlock[0][1]];
    const m10 = [zero, aBlock[1][0]], m11 = [one, sub(aBlock[1][1], one)];
    const determinant = pSub(pMul(m00, m11), pMul(m01, m10));
    const zPolys = [pSub(pScale(m11, b[0]), pScale(m01, b[1])), pSub(pScale(m00, b[1]), pScale(m10, b[0]))];
    const yPolys = zPolys.map(p => pMul([zero, one], p));
    const h = pAdd(pScale(determinant, neg(un)), pAdd(pScale(yPolys[0], c[0]), pScale(yPolys[1], c[1])));
    const polynomial = primitive(pSub(pScale(pAdd(pMul(yPolys[0], yPolys[0]), pMul(yPolys[1], yPolys[1])), mul(k, k)), pScale(pMul(h, h), qD)));
    if (polynomial.length < 2 || polynomial.length > 5) fail('DYNAMIC_POLYNOMIAL_DEGREE');
    if (sign(value(polynomial, point(0n, 0))) >= 0 || sign(value(polynomial, point(1n, 0))) <= 0)
      fail('DYNAMIC_EXISTENCE_ENDPOINT_SIGNS');
    const {chain,roots,rootCertificates,selected}=classifyRoots(polynomial,h);
    const selectedRoot = roots[selected];
    let idealNormal: Interval, idealTangent: Interval[], idealWorld: Interval[], idealSlip: Interval[], sRange: Interval;
    let world: (number | null)[], cacheN: number | null, cacheT: (number | null)[];
    for (;;) {
      sRange = rootInterval(selectedRoot);
      const detRange = pInterval(determinant, sRange), hRange = pInterval(h, sRange);
      if (cmp(detRange[0], zero) <= 0 || cmp(hRange[0], zero) <= 0) fail('DYNAMIC_PRESENTATION_POSITIVITY_UNCERTIFIED');
      idealNormal = iDiv(hRange, iMul(singleton(k), detRange));
      const coordinateT = yPolys.map(p => iNeg(iDiv(pInterval(p, sRange), detRange)));
      idealTangent = [0, 1, 2].map(i => iAdd(iMul(coordinateT[0], singleton(tangent[0][i])), iMul(coordinateT[1], singleton(tangent[1][i]))));
      idealWorld = idealTangent.map((t, i) => iAdd(t, iMul(idealNormal, singleton(normal[i]))));
      idealSlip = zPolys.map(p => iDiv(iMul(iSub(singleton(one), sRange), pInterval(p, sRange)), detRange));
      world = idealWorld.map(present); cacheN = present(idealNormal); cacheT = idealTangent.map(present);
      if (world.every(x => x !== null) && cacheN !== null && cacheT.every(x => x !== null)) break;
      if (selectedRoot.exact) fail('DYNAMIC_RNE_CELL_UNRESOLVED');
      refine(selectedRoot, polynomial, chain, 8);
    }
    if (cacheN === null || world.some(x => x === null) || cacheT.some(x => x === null)) fail('DYNAMIC_INCOMPLETE_PRESENTATION');
    const worldImpulseNs = world as Vec, normalNs: number = cacheN, tangentNs = cacheT as Vec;
    const represented = worldImpulseNs.map(word) as V, cacheNormal = word(normalNs), cacheTangent = tangentNs.map(word) as V;
    const representedN = dot(represented, normal), representedT = vs(represented, vm(normal, representedN));
    const contact = va(free, matrix.map(row => dot(row, represented))), contactNormal = dot(contact, normal);
    const contactTangent = vs(contact, vm(normal, contactNormal)), tangentNorm = sqrtRange(dot(representedT, representedT));
    const slipNorm = sqrtRange(dot(contactTangent, contactTangent));
    const residualBounds: Record<string, [string, string]> = {};
    function gate(name: string, range: Interval, limit: Q): void {
      residualBounds[name] = itext(range);
      if (cmp(range[0], neg(limit)) < 0 || cmp(range[1], limit) > 0) fail('DYNAMIC_PRESENTED_' + name);
    }
    if (sign(representedN.n) <= 0 || cmp(slipNorm[0], motionGate) <= 0) fail('DYNAMIC_PRESENTED_NONACTIVE_OR_ZERO_SLIP');
    gate('normalSpeedMps', singleton(contactNormal), motionGate);
    gate('coneMagnitudeNs', iSub(tangentNorm, singleton(mul(mu, representedN))), impulseGate);
    for (let i = 0; i < 3; i++) {
      gate('antiparallelNs' + i, iAdd(singleton(representedT[i]),
        iDiv(singleton(mul(mul(mu, representedN), contactTangent[i])), slipNorm)), impulseGate);
      gate('cacheTangentAgreementNs' + i, singleton(sub(cacheTangent[i], representedT[i])), impulseGate);
    }
    gate('cacheNormalAgreementNs', singleton(sub(cacheNormal, representedN)), impulseGate);
    gate('cachePublicTangentPlaneNs', singleton(dot(cacheTangent, publicNormal)), impulseGate);
    const work = add(dot(free, represented), div(dot(represented, matrix.map(row => dot(row, represented))), two));
    residualBounds.workJ = itext(singleton(work));
    if (sign(work.n) > 0) fail('DYNAMIC_PRESENTED_POSITIVE_WORK');
    rootCertificates[selected] = { ...rootCertificates[selected], lower: text(pointQ(selectedRoot.lo)), upper: text(pointQ(selectedRoot.hi)),
      openRootCount: selectedRoot.exact ? 0 : 1, exactRationalRoot: selectedRoot.exact,
      hRange: itext(pInterval(h, sRange)) };
    const certificate: DynamicCertificate = { staticPriority: staticCertificate,
      nativeUnitNormal: vtext(normal), nativeTangentAxes: tangent.map(vtext),
      effectiveDynamicCoefficient: text(mu), dynamicCoefficientSquared: text(qD),
      k: text(k), c: vtext(c), dBlock: dBlock.map(vtext), schurA: aBlock.map(vtext), schurB: vtext(b),
      polynomialAscending: polynomial.map(String), sturmAscending: chain.map(p => p.map(String)), roots: rootCertificates,
      selectedRoot: selected, idealParameter: itext(sRange), idealNormalNs: itext(idealNormal),
      idealTangentNs: idealTangent.map(itext), idealWorldImpulseNs: idealWorld.map(itext), idealSlipMps: idealSlip.map(itext),
      worldPresentationErrorNs: represented.map((x, i) => itext(iSub(singleton(x), idealWorld[i]))),
      cacheNormalPresentationErrorNs: itext(iSub(singleton(cacheNormal), idealNormal)),
      cacheTangentPresentationErrorNs: cacheTangent.map((x, i) => itext(iSub(singleton(x), idealTangent[i]))),
      representedNormalNs: text(representedN), representedTangentNs: vtext(representedT),
      representedContactVelocityMps: vtext(contact), residualBounds,
      staticCounts, dynamicCounts: core.copyCounts(), cumulativeRationalOps: 0, cumulativeGcdSteps: 0 };
    certificate.dynamicCounts = core.copyCounts();
    certificate.cumulativeRationalOps = staticCounts.rationalOps + core.copyCounts().rationalOps;
    certificate.cumulativeGcdSteps = staticCounts.gcdSteps + core.copyCounts().gcdSteps;
    return { status: 'DYNAMIC_TARGET', worldImpulseNs, normalNs, tangentNs, certificate };
  } catch (error) {
    if (!(error instanceof Unresolved)) throw error;
    return { status: 'UNRESOLVED', reason: error.message, stage: 'dynamic', staticCounts, dynamicCounts: core.copyCounts() };
  }
}
