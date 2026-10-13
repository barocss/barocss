// Compile only, against source and emitted declarations. Never execute this file.
import {
  qualifyStoredCirclePrismSolid, validateStoredCirclePrismSolid,
  StoredCirclePrismSolidError, StoredCirclePrismSolidDiagnosticCode,
  type XYCirclePrismShellResult, type StoredCirclePrismSolidResult,
  type StoredCirclePrismSolidCertificate,
} from '../src/index.js';

declare const parent: XYCirclePrismShellResult;
const result: StoredCirclePrismSolidResult = qualifyStoredCirclePrismSolid(parent);
const certificate: StoredCirclePrismSolidCertificate = validateStoredCirclePrismSolid(result);
const stillUnqualified: false = result.parent.report.solid;
const stillUncertified: false = result.parent.report.topologyCertified;
const candidateOnly: true = result.parent.report.candidateClosedShell;
const separateSolid: true = certificate.solid;
const genus: 0 = certificate.genus;
const euler: 2 = certificate.eulerCharacteristic;
const counts: [2, 3, 6, 3, 3] = [certificate.vertexCount, certificate.edgeCount, certificate.edgeUseCount, certificate.faceCount, certificate.loopCount];
const authority: 'stored-coefficient-mathematical-model' = certificate.geometryAuthority;
const worldSource: string = result.world.source;
const originalSource: string = result.parent.profile.source;
const compiledWorld: typeof parent.bundle.geometry = result.world.model;
const operations: number = certificate.arithmetic.operations;
const direct: 1 = certificate.directCounts.parentReconstructionCalls;
const actualProviderCause = new Error('original provider failure');
const diagnostic = new StoredCirclePrismSolidError(StoredCirclePrismSolidDiagnosticCode.NATIVE, 'failed reconstruction', actualProviderCause);
const code: 'INPUT' | 'OWNED' | 'GEOMETRY' | 'BUDGET' | 'NATIVE' = diagnostic.code;
void [stillUnqualified, stillUncertified, candidateOnly, separateSolid, genus, euler, counts, authority,
  worldSource, originalSource, compiledWorld, operations, direct, code];

// @ts-expect-error Qualification requires the complete original parent, not just its bundle.
qualifyStoredCirclePrismSolid(parent.bundle);
// @ts-expect-error Validation requires the whole parent/world/certificate result.
validateStoredCirclePrismSolid(certificate);
// @ts-expect-error No caller-supplied certificate is authority for qualification.
qualifyStoredCirclePrismSolid(parent, certificate);
// @ts-expect-error No trust-cache or validation-bypass options are supported.
validateStoredCirclePrismSolid(result, { trusted: true });
// @ts-expect-error Reference pi volume is not certified volume.
certificate.volumeMM3;
// @ts-expect-error No certified area is exposed.
certificate.areaMM2;
// @ts-expect-error No certified mass is exposed.
certificate.massKG;
// @ts-expect-error The independent certificate does not upgrade the native parent report.
const promotedParent: true = result.parent.report.solid;
// @ts-expect-error This low-level result is not an authored primary-model document.
result.save();
// @ts-expect-error Whole-model source is explicitly nested; it does not replace profile source.
result.source;
// @ts-expect-error Only the frozen five diagnostic categories are admitted.
new StoredCirclePrismSolidError('TOPOLOGY', 'not in this contract');
void promotedParent;
