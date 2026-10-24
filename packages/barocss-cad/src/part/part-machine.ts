// R5.3 (D222): the machine-element features of the part model — connectors, O-rings, bearings, keys, rings, pins,
// keyways, shafts, springs, drives, cams and threads — moved out of part-model.ts's operation() as they were there. The
// dispatcher calls `machineOperation` for those kinds.
import { type BearingCode, isBearingError, type BearingFitClasses, type BearingRow, bearingRowProblem, seatedBearing } from '../machine/bearing.js';
import { type Brep } from '../brep/brep-core.js';
import { type CamCode, isCamError, type CamLaw, type CamReport, type CamSpec, discCam } from '../machine/cam.js';
import { type ConnectorCode, isConnectorError, type ConnectorRow, connectorBody, connectorOpening } from '../machine/connector.js';
import { type DriveCode, isDriveError, type DriveRow, beltBand, couplingEnvelope, pulley, sprocket } from '../machine/drive.js';
import { type FitTable } from '../machine/fits.js';
import { type GlandCode, isGlandError, type GlandRanges, type ORingRow, glandCut, oringInGland } from '../machine/oring.js';
import { type HookedSpringReport, type HookedSpringSpec, type SpringDiagnosticCode, isSpringError, type SpringReport, type SpringSpec, compressionSpring, hookedSpring, springDimensions } from '../machine/spring.js';
import { type KeyFitClasses, type KeywayReport, type ShaftPartCode, isShaftPartError, keySolid, keywayCut, pinSolid, ringSolid } from '../machine/shaft-parts.js';
import { isMeshBrepError } from '../mesh/mesh-brep.js';
import { type ShaftDiagnosticCode, isShaftError, type ShaftSpec, shaftSolid } from '../machine/shaft.js';
import { type XY } from '../brep/curved-arrangement.js';
import { threadSolid } from '../machine/thread-solid.js';
import { transformBrep } from '../brep/brep-transform.js';
import type { CadPartDim, CadPartErrorCode, CadPartPoint2, CadPartPoint3, Part, Result, Solid, CadPartFeature, Tools, PartHelpers } from './part-model.js';

/** Shaft diagnostics as the part model's codes (the shaft's own code kept in the message). */
const SHAFT_CODES: Record<ShaftDiagnosticCode, CadPartErrorCode> = { INVALID_INPUT: 'INPUT', SHAFT_STEPS: 'INPUT', KEYSEAT_DIMENSIONS: 'GEOMETRY', GROOVE_DIMENSIONS: 'GEOMETRY', HOLE_DIMENSIONS: 'GEOMETRY' };
/** Glands' diagnostics as the part model's codes (their warnings stay in the report). */
const GLAND_CODES: Record<GlandCode, CadPartErrorCode> = { INVALID_INPUT: 'INPUT', GLAND_DIMENSIONS: 'GEOMETRY', SQUEEZE_RANGE: 'GEOMETRY', FILL_RANGE: 'GEOMETRY', STRETCH_RANGE: 'GEOMETRY' };
/** Bearings' diagnostics as the part model's codes. */
const BEARING_CODES: Record<BearingCode, CadPartErrorCode> = { INVALID_INPUT: 'INPUT', SEAT_ABUTMENT: 'GEOMETRY', SEAT_FIT: 'GEOMETRY' };
/** Shaft parts' diagnostics as the part model's codes. */
const SHAFT_PART_CODES: Record<ShaftPartCode, CadPartErrorCode> = { INVALID_INPUT: 'INPUT', KEY_FIT: 'GEOMETRY', RING_FIT: 'GEOMETRY', PIN_FIT: 'GEOMETRY' };
/** Connector refusals as the part model's codes (R12c.7; the connector's own code kept in the message). */
const CONNECTOR_CODES: Record<ConnectorCode, CadPartErrorCode> = { INVALID_INPUT: 'INPUT', CONNECTOR_PLACEMENT: 'GEOMETRY', CONNECTOR_FIT: 'GEOMETRY' };
/** Drive refusals as the part model's codes (R12c.6b; the element's own code kept in the message). */
const DRIVE_CODES: Record<DriveCode, CadPartErrorCode> = { INVALID_INPUT: 'INPUT', UNSUPPORTED_TOOTH_FORM: 'CAPABILITY', TOOTH_FORM: 'GEOMETRY', BELT_GEOMETRY: 'GEOMETRY' };
/** Cam refusals as the part model's codes (the cam's own code kept in the message). */
const CAM_CODES: Record<CamCode, CadPartErrorCode> = { INVALID_INPUT: 'INPUT', CAM_UNDERCUT: 'GEOMETRY', PROFILE_BUDGET_EXCEEDED: 'CAPABILITY' };
/** Spring diagnostics as the part model's codes (the spring's own code kept in the message). */
const SPRING_CODES: Record<SpringDiagnosticCode, CadPartErrorCode> = { INVALID_INPUT: 'INPUT', SELF_INTERSECTION: 'GEOMETRY', COILS_OVERLAP: 'GEOMETRY', PROFILE_BUDGET_EXCEEDED: 'CAPABILITY', UNSUPPORTED_SPRING_KIND: 'CAPABILITY', LEG_OVERLAP: 'GEOMETRY' };
/** A machine-element feature's evaluation (part-model.ts's operation() for these kinds). */
export function machineOperation(f: CadPartFeature & Record<string, unknown>, t: Tools, k: PartHelpers): () => Result {
  const { dim, xy, xyz, solids, ref, fail, at } = t;
  const { isRecord, brepOf } = k;
  const one = (s: Solid): Result => ({ kind: 'solid', parts: [{ solid: s }] });
  switch (f.kind) {
    case 'connector-opening': {
      const target = solids(f.target, 'target');
      if (target.length !== 1) fail('SELECTION', 'an opening is cut into one body');
      if (typeof f.face !== 'string') fail('INPUT', 'face must name the face the opening is cut into');
      const spec = { row: f.row as ConnectorRow, face: f.face as string, centerMM: xyz(f.center as CadPartPoint3, 'center'), ...(f.rotation !== undefined ? { rotationDeg: f.rotation as number } : {}) };
      return () => {
        let made: ReturnType<typeof connectorOpening> | undefined;
        try { made = connectorOpening(brepOf(target[0], at), spec, at); }
        catch (cause) { if (isConnectorError(cause)) fail(CONNECTOR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^connector: /, '')}`); throw cause; }
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made!.brep }, connector: made!.report }] };
      };
    }
    case 'connector-body': {
      const g = ref(f.opening, 'opening').result, gp = g.kind === 'solid' && g.parts.length === 1 ? g.parts[0] : undefined;
      if (!gp?.connector) fail('REFERENCE', `${String(f.opening)} is not a connector's opening`);
      return () => {
        let made: ReturnType<typeof connectorBody> | undefined;
        try { made = connectorBody(brepOf(gp!, at), gp!.connector!, at); }
        catch (cause) { if (isConnectorError(cause)) fail(CONNECTOR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^connector: /, '')}`); throw cause; }
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made!.brep }, connectorBody: { row: gp!.connector!.row, overlapMM3: made!.overlapMM3 } }] };
      };
    }
    case 'oring-gland': {
      const target = solids(f.target, 'target');
      if (target.length !== 1) fail('SELECTION', 'a gland is cut into one body');
      if (typeof f.face !== 'string') fail('INPUT', 'face must name the face the groove is cut into');
      const rg = f.ring as Record<string, unknown> | undefined, gr = f.groove as Record<string, unknown> | undefined;
      if (!isRecord(rg) || !isRecord(gr)) fail('INPUT', 'ring and groove must be objects');
      const ring: ORingRow = { id: String(rg!.id), ...(rg!.dash !== undefined ? { dash: String(rg!.dash) } : {}), insideDiameterMM: rg!.insideDiameter as number, crossSectionMM: rg!.crossSection as number, ...(rg!.source !== undefined ? { source: rg!.source as string } : {}), ...(rg!.estimate !== undefined ? { estimate: rg!.estimate as boolean } : {}) };
      const spec = { kind: f.gland as 'piston' | 'rod' | 'face', ring, face: f.face as string, grooveDiameterMM: dim(gr!.diameter as CadPartDim, 'groove.diameter', true), widthMM: dim(gr!.width as CadPartDim, 'groove.width', true),
        ...(gr!.at !== undefined ? { atMM: dim(gr!.at as CadPartDim, 'groove.at') } : {}), ...(gr!.depth !== undefined ? { depthMM: dim(gr!.depth as CadPartDim, 'groove.depth', true) } : {}), ...(gr!.center !== undefined ? { centerMM: xyz(gr!.center as CadPartPoint3, 'groove.center') } : {}),
        ...(f.seal !== undefined ? { sealDiameterMM: dim(f.seal as CadPartDim, 'seal', true) } : {}), ...(f.ranges !== undefined ? { ranges: f.ranges as GlandRanges } : {}), ...(f.fit !== undefined ? { fit: f.fit as { tables: readonly FitTable[]; seal?: string; groove?: string } } : {}) };
      return () => {
        let made: ReturnType<typeof glandCut> | undefined;
        try { made = glandCut(brepOf(target[0], at), spec, at); }
        catch (cause) { if (isGlandError(cause)) fail(GLAND_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gland: /, '')}`); throw cause; }
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made!.brep }, gland: made!.report, glandPlace: made!.place }] };
      };
    }
    case 'oring': {
      const g = ref(f.gland, 'gland').result, gp = g.kind === 'solid' && g.parts.length === 1 ? g.parts[0] : undefined;
      if (!gp?.gland || !gp.glandPlace) fail('REFERENCE', `${String(f.gland)} is not an O-ring gland`);
      return () => {
        const made = oringInGland(gp!.gland!, gp!.glandPlace!, at);
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, oring: { ring: gp!.gland!.ring, overlapMM3: made.overlapMM3, stretchedCrossSectionMM: gp!.gland!.stretchedCrossSectionMM } }] };
      };
    }
    case 'bearing': {
      // (R12c.4, D158: on the shaft, referenced, not consumed; in the housing, referenced too.)
      const p = bearingRowProblem(f.row); if (p) fail('INPUT', `[INVALID_INPUT] ${p}`);
      const other = ref(f.shaft, 'shaft').result, sp = other.kind === 'solid' && other.parts.length === 1 ? other.parts[0] : undefined;
      if (!sp?.shaft || !sp.shaftPlace) fail('REFERENCE', `${String(f.shaft)} is not a shaft`);
      if (!Number.isInteger(f.step) || (f.step as number) < 1) fail('INPUT', 'step must be a number from 1');
      let housing: Part | undefined;
      if (f.housing !== undefined) { const h = ref(f.housing, 'housing').result; if (h.kind !== 'solid' || h.parts.length !== 1) fail('REFERENCE', `${String(f.housing)} is not one body`); housing = (h as Extract<Result, { kind: 'solid' }>).parts[0]; }
      const fit = f.fit === undefined ? undefined : isRecord(f.fit) && Array.isArray((f.fit as Record<string, unknown>).tables) ? f.fit as unknown as BearingFitClasses : fail('INPUT', 'fit must be { tables, shaft?, housing? }');
      return () => {
        let made: ReturnType<typeof seatedBearing> | undefined;
        try { made = seatedBearing(f.row as BearingRow, { report: sp!.shaft!, place: sp!.shaftPlace!, brep: brepOf(sp!, String(f.shaft)) }, { step: f.step as number, against: f.against as 'start' | 'end', ...(housing ? { housing: brepOf(housing, String(f.housing)) } : {}), ...(fit ? { fit } : {}) }, at); }
        catch (cause) { if (isBearingError(cause)) fail(BEARING_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^bearing: /, '')}`); throw cause; }
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made!.brep }, bearing: made!.report }] };
      };
    }
    case 'key': case 'retaining-ring': case 'pin': {
      // (R12c.3b, D157: the shaft referenced, not consumed — it stays an output of its own, as a meshing gear's.)
      const other = ref(f.shaft, 'shaft').result, sp = other.kind === 'solid' && other.parts.length === 1 ? other.parts[0] : undefined;
      if (!sp?.shaft || !sp.shaftPlace) fail('REFERENCE', `${String(f.shaft)} is not a shaft`);
      const placed = { report: sp!.shaft!, place: sp!.shaftPlace! };
      const index = (v: unknown, what: string) => { if (!Number.isInteger(v) || (v as number) < 1) fail('INPUT', `${what} must be a number from 1`); return v as number; };
      const optDim = (v: unknown, what: string) => v === undefined ? undefined : dim(v as CadPartDim, what, true);
      const partFail = (cause: unknown): never => { if (isShaftPartError(cause)) fail(SHAFT_PART_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^shaft part: /, '')}`); throw cause; };
      let hub: KeywayReport | undefined;
      if (f.kind === 'key' && f.hub !== undefined) { const h = ref(f.hub, 'hub').result, hp = h.kind === 'solid' && h.parts.length === 1 ? h.parts[0] : undefined; if (!hp?.keyway) fail('REFERENCE', `${String(f.hub)} is not a keyway`); hub = hp!.keyway; }
      const fit = f.kind === 'key' && f.fit !== undefined ? (isRecord(f.fit) && Array.isArray((f.fit as Record<string, unknown>).tables) && typeof (f.fit as Record<string, unknown>).key === 'string' ? f.fit as unknown as KeyFitClasses : fail('INPUT', 'fit must be { tables, key, seat?, hub? }')) : undefined;
      return () => {
        try {
          if (f.kind === 'key') { const made = keySolid(placed, { keyseat: index(f.keyseat, 'keyseat'), heightMM: dim(f.height as CadPartDim, 'height', true), ...(f.width !== undefined ? { widthMM: optDim(f.width, 'width') } : {}), ...(f.length !== undefined ? { lengthMM: optDim(f.length, 'length') } : {}), ...(f.ends !== undefined ? { ends: f.ends as 'round' | 'square' } : {}), ...(hub ? { hub } : {}), ...(fit ? { fit } : {}) }, at); return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, key: made.report }] }; }
          if (f.kind === 'retaining-ring') { const row = f.row as Record<string, unknown> | undefined; const made = ringSolid(placed, { groove: index(f.groove, 'groove'), thicknessMM: dim(f.thickness as CadPartDim, 'thickness', true), outerDiameterMM: dim(f.outerDiameter as CadPartDim, 'outerDiameter', true), ...(row ? { row: { ...(row.shaftDiameter !== undefined ? { shaftDiameterMM: row.shaftDiameter as number } : {}), ...(row.grooveDiameter !== undefined ? { grooveDiameterMM: row.grooveDiameter as number } : {}), ...(row.grooveWidth !== undefined ? { grooveWidthMM: row.grooveWidth as number } : {}), ...(row.source !== undefined ? { source: row.source as string } : {}), ...(row.estimate !== undefined ? { estimate: row.estimate as boolean } : {}) } } : {}) }, at); return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, ring: made.report }] }; }
          const made = pinSolid(placed, { hole: index(f.hole, 'hole'), ...(f.diameter !== undefined ? { diameterMM: optDim(f.diameter, 'diameter') } : {}), ...(f.length !== undefined ? { lengthMM: optDim(f.length, 'length') } : {}), ...(f.fit ? { fit: true } : {}) }, at);
          return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, pin: made.report }] };
        } catch (cause) { return partFail(cause); }
      };
    }
    case 'keyway': {
      const target = solids(f.target, 'target');
      if (target.length !== 1) fail('SELECTION', 'a keyway is cut into one body');
      if (typeof f.face !== 'string') fail('INPUT', 'face must name the bore');
      const b = dim(f.width as CadPartDim, 'width', true), t2 = dim(f.depth as CadPartDim, 'depth', true);
      if (f.angle !== undefined && !(typeof f.angle === 'number' && Number.isFinite(f.angle))) fail('INPUT', 'angle must be a number of degrees');
      return () => {
        let made: ReturnType<typeof keywayCut> | undefined;
        try { made = keywayCut(brepOf(target[0], at), { face: f.face as string, widthMM: b, depthMM: t2, ...(f.angle !== undefined ? { angleDeg: f.angle as number } : {}) }, at); }
        catch (cause) { if (isShaftPartError(cause)) fail(SHAFT_PART_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^shaft part: /, '')}`); throw cause; }
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made!.brep }, keyway: made!.report }] };
      };
    }
    case 'shaft': {
      if (f.generator !== undefined && f.generator !== 'shaft@0') fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
      const list = <T,>(v: unknown, what: string): T[] => { if (v === undefined) return []; if (!Array.isArray(v)) fail('INPUT', `${what} must be a list`); return v as T[]; };
      const rec = (v: unknown, what: string): Record<string, unknown> => { if (!isRecord(v)) fail('INPUT', `${what} must be an object`); return v as Record<string, unknown>; };
      const opt = (v: unknown, what: string) => v === undefined ? undefined : dim(v as CadPartDim, what);
      const deg = (v: unknown, what: string) => { if (v !== undefined && !(typeof v === 'number' && Number.isFinite(v))) fail('INPUT', `${what} must be a number of degrees`); return v as number | undefined; };
      const steps = list<unknown>(f.steps, 'steps').map((x, k) => {
        const s = rec(x, `steps[${k}]`), at = `steps[${k}]`, u = s.undercut === undefined ? undefined : rec(s.undercut, `${at}.undercut`);
        return { diameterMM: dim(s.diameter as CadPartDim, `${at}.diameter`), lengthMM: dim(s.length as CadPartDim, `${at}.length`), ...(s.fillet !== undefined ? { filletMM: opt(s.fillet, `${at}.fillet`) } : {}),
          ...(u ? { undercut: { widthMM: dim(u.width as CadPartDim, `${at}.undercut.width`), depthMM: dim(u.depth as CadPartDim, `${at}.undercut.depth`) } } : {}),
          grooves: list<unknown>(s.grooves, `${at}.grooves`).map((g, j) => { const r = rec(g, `${at}.grooves[${j}]`); return { diameterMM: dim(r.diameter as CadPartDim, 'groove diameter'), widthMM: dim(r.width as CadPartDim, 'groove width'), atMM: dim(r.at as CadPartDim, 'groove at') }; }),
          keyseats: list<unknown>(s.keyseats, `${at}.keyseats`).map((g, j) => { const r = rec(g, `${at}.keyseats[${j}]`); return { widthMM: dim(r.width as CadPartDim, 'keyseat width'), depthMM: dim(r.depth as CadPartDim, 'keyseat depth'), lengthMM: dim(r.length as CadPartDim, 'keyseat length'), offsetMM: dim(r.offset as CadPartDim, 'keyseat offset'),
            ...(r.ends !== undefined ? { ends: r.ends as 'square' | 'end-mill' | 'disc' } : {}), ...(r.cutterRadius !== undefined ? { cutterRadiusMM: opt(r.cutterRadius, 'keyseat cutterRadius') } : {}), ...(r.angle !== undefined ? { angleDeg: deg(r.angle, 'keyseat angle') } : {}) }; }) };
      });
      const ch = f.chamfers as unknown;
      if (ch !== undefined && !(Array.isArray(ch) && ch.length === 2)) fail('INPUT', 'chamfers must be [start, end]');
      const spec: ShaftSpec = { steps, ...(ch ? { chamfersMM: [dim((ch as CadPartDim[])[0], 'chamfers[0]'), dim((ch as CadPartDim[])[1], 'chamfers[1]')] as const } : {}),
        holes: list<unknown>(f.holes, 'holes').map((h, j) => { const r = rec(h, `holes[${j}]`); return { diameterMM: dim(r.diameter as CadPartDim, 'hole diameter'), atMM: dim(r.at as CadPartDim, 'hole at'), ...(r.angle !== undefined ? { angleDeg: deg(r.angle, 'hole angle') } : {}) }; }) };
      const c = f.center === undefined ? [0, 0] : xy(f.center as CadPartPoint2, 'center'), z0 = f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from'), turn = (deg(f.rotation, 'rotation') ?? 0) * Math.PI / 180;
      return () => {
        let made: ReturnType<typeof shaftSolid> | undefined;
        try { made = shaftSolid(spec, { id: at }); } catch (cause) { if (isShaftError(cause)) fail(SHAFT_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^shaft: /, '')}`); throw cause; }
        const cs = Math.cos(turn), sn = Math.sin(turn);
        const brep = turn || c[0] || c[1] || z0 ? transformBrep(made!.brep, { matrix: [cs, -sn, 0, sn, cs, 0, 0, 0, 1], offset: [c[0], c[1], z0] }) : made!.brep;
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, shaft: made!.report, shaftPlace: { matrix: [cs, -sn, 0, sn, cs, 0, 0, 0, 1], offset: [c[0], c[1], z0] } }] };
      };
    }
    case 'spring': {
      if (f.generator !== undefined && f.generator !== 'spring@0') fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
      const opt = (k: string) => f[k as keyof typeof f] === undefined ? undefined : dim(f[k as keyof typeof f] as CadPartDim, k, true);
      const num = (k: string) => { const v = f[k as keyof typeof f]; if (v !== undefined && !(typeof v === 'number' && Number.isFinite(v))) fail('INPUT', `${k} must be a number`); return v as number | undefined; };
      if (f.shearModulusEstimate !== undefined && typeof f.shearModulusEstimate !== 'boolean') fail('INPUT', 'shearModulusEstimate must be true or false');
      const spec: SpringSpec = { wireDiameterMM: dim(f.wire as CadPartDim, 'wire', true), activeCoils: num('activeCoils') as number,
        ...(f.diameter !== undefined ? { meanDiameterMM: opt('diameter') } : {}), ...(f.outerDiameter !== undefined ? { outerDiameterMM: opt('outerDiameter') } : {}), ...(f.innerDiameter !== undefined ? { innerDiameterMM: opt('innerDiameter') } : {}),
        ...(f.pitch !== undefined ? { pitchMM: opt('pitch') } : {}), ...(f.freeLength !== undefined ? { freeLengthMM: opt('freeLength') } : {}),
        ...(f.hand !== undefined ? { hand: f.hand as SpringSpec['hand'] } : {}), ...(f.ends !== undefined ? { ends: f.ends as SpringSpec['ends'] } : {}), ...(f.endCoils !== undefined ? { endCoils: num('endCoils') } : {}), ...(f.transition !== undefined ? { transitionDeg: num('transition') } : {}),
        ...(f.shearModulus !== undefined ? { shearModulusMPa: num('shearModulus'), ...(f.shearModulusEstimate ? { shearModulusEstimate: true } : {}) } : {}), ...(f.load !== undefined ? { loadN: num('load') } : {}), ...(f.profileTolerance !== undefined ? { profileToleranceMM: num('profileTolerance') } : {}),
        ...(f.type !== undefined ? { type: f.type as SpringSpec['type'] } : {}), ...(f.body !== undefined ? { body: f.body as SpringSpec['body'] } : {}), ...(f.wireSection !== undefined ? { wire: f.wireSection as SpringSpec['wire'] } : {}) };
      const springFail = (cause: unknown): never => { if (isSpringError(cause)) fail(SPRING_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^spring: /, '')}`); throw cause; };
      const hooked = f.type === 'extension' || f.type === 'torsion';
      if (!hooked && (f.hooks !== undefined || f.bendRadius !== undefined || f.loopRadius !== undefined || f.loopAngle !== undefined || f.initialTension !== undefined || f.legLengths !== undefined || f.youngsModulus !== undefined || f.moment !== undefined)) fail('INPUT', 'hooks, bends, loops, initial tension, legs, E and a moment belong to an extension or a torsion spring (give its type)');
      if (f.youngsModulusEstimate !== undefined && typeof f.youngsModulusEstimate !== 'boolean') fail('INPUT', 'youngsModulusEstimate must be true or false');
      const legs = f.legLengths as unknown;
      if (legs !== undefined && !(Array.isArray(legs) && legs.length === 2)) fail('INPUT', 'legLengths must be [start, end]');
      const hspec: HookedSpringSpec | undefined = hooked ? { ...spec, ...(f.hooks !== undefined ? { hooks: f.hooks as HookedSpringSpec['hooks'] } : {}), ...(f.bendRadius !== undefined ? { bendRadiusMM: opt('bendRadius') } : {}), ...(f.loopRadius !== undefined ? { loopRadiusMM: opt('loopRadius') } : {}),
        ...(f.loopAngle !== undefined ? { loopAngleDeg: num('loopAngle') } : {}), ...(f.initialTension !== undefined ? { initialTensionN: num('initialTension') } : {}),
        ...(legs !== undefined ? { legLengthsMM: [dim((legs as CadPartDim[])[0], 'legLengths[0]', true), dim((legs as CadPartDim[])[1], 'legLengths[1]', true)] as const } : {}),
        ...(f.youngsModulus !== undefined ? { youngsModulusMPa: num('youngsModulus'), ...(f.youngsModulusEstimate ? { youngsModulusEstimate: true } : {}) } : {}), ...(f.moment !== undefined ? { momentNmm: num('moment') } : {}) } : undefined;
      if (!hspec) { try { springDimensions(spec); } catch (cause) { springFail(cause); } }
      const c = f.center === undefined ? [0, 0] : xy(f.center as CadPartPoint2, 'center'), z0 = f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from'), turn = (num('rotation') ?? 0) * Math.PI / 180;
      return () => {
        let made: { readonly brep: Brep; readonly report: SpringReport | HookedSpringReport } | undefined;
        try { made = hspec ? hookedSpring(hspec, { id: at }) : compressionSpring(spec, { id: at }); } catch (cause) { springFail(cause); }
        const cs = Math.cos(turn), sn = Math.sin(turn);
        const brep = turn || c[0] || c[1] || z0 ? transformBrep(made!.brep, { matrix: [cs, -sn, 0, sn, cs, 0, 0, 0, 1], offset: [c[0], c[1], z0] }) : made!.brep;
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, spring: made!.report }] };
      };
    }
    case 'sprocket': case 'pulley': case 'belt': case 'coupling': {
      const gen = `${f.kind}@0`;
      if (f.generator !== undefined && f.generator !== gen) fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
      const opt = (key: string) => (f as Record<string, unknown>)[key] === undefined ? undefined : dim((f as Record<string, unknown>)[key] as CadPartDim, key);
      const int = (key: string) => { const v = (f as Record<string, unknown>)[key]; if (v !== undefined && !(typeof v === 'number' && Number.isFinite(v))) fail('INPUT', `${key} must be a number`); return v as number | undefined; };
      const row = (f as { row?: unknown }).row as DriveRow;
      if (!row || typeof row !== 'object') fail('INPUT', 'row must be the drive row (a chain, a belt or a coupling row) inline');
      const c = f.center === undefined ? [0, 0] : xy(f.center as CadPartPoint2, 'center'), z0 = f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from'), turn = (int('rotation') ?? 0) * Math.PI / 180;
      const g = f as Record<string, unknown>, radii = g.pitchRadii as unknown;
      if (f.kind === 'belt' && !(Array.isArray(radii) && radii.length === 2)) fail('INPUT', 'pitchRadii must be [first wheel, second wheel]');
      const make = (): { brep: Brep; part: Record<string, unknown> } => {
        switch (f.kind) {
          case 'sprocket': { const m = sprocket({ chain: row as never, teeth: int('teeth') as number, tipDiameterMM: opt('tip') as number, widthMM: opt('width') as number, ...(g.seat !== undefined ? { seatDiameterMM: opt('seat') } : {}), ...(g.toothForm !== undefined ? { toothForm: g.toothForm as 'pivot-clearance' } : {}), ...(g.bore !== undefined ? { boreDiameterMM: opt('bore') } : {}), ...(g.minimumRim !== undefined ? { minimumRimMM: opt('minimumRim') } : {}) }, { id: at }); return { brep: m.brep, part: { sprocket: m.report } }; }
          case 'pulley': { const m = pulley({ belt: row as never, ...(g.teeth !== undefined ? { teeth: int('teeth') } : {}), ...(g.diameter !== undefined ? { diameterMM: opt('diameter') } : {}), ...(g.grooves !== undefined ? { grooves: int('grooves') } : {}), ...(g.width !== undefined ? { widthMM: opt('width') } : {}), ...(g.crown !== undefined ? { crownMM: opt('crown') } : {}), ...(g.bore !== undefined ? { boreDiameterMM: opt('bore') } : {}), ...(g.minimumRim !== undefined ? { minimumRimMM: opt('minimumRim') } : {}) }, { id: at }); return { brep: m.brep, part: { pulley: m.report } }; }
          case 'belt': { const r = radii as CadPartDim[], m = beltBand({ row: row as never, pitchRadiiMM: [dim(r[0], 'pitchRadii[0]', true), dim(r[1], 'pitchRadii[1]', true)], centerDistanceMM: dim(g.centerDistance as CadPartDim, 'centerDistance', true), ...(g.rounding !== undefined ? { rounding: g.rounding as 'whole' | 'even' } : {}), ...(g.width !== undefined ? { widthMM: opt('width') } : {}) }, { id: at }); return { brep: m.brep, part: { belt: m.report } }; }
          default: { const m = couplingEnvelope(row as never, { id: at }); return { brep: m.brep, part: { coupling: m.report } }; }
        }
      };
      return () => {
        let made: { brep: Brep; part: Record<string, unknown> } | undefined;
        try { made = make(); } catch (cause) { if (isDriveError(cause)) fail(DRIVE_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^drive: /, '')}`); throw cause; }
        const cs = Math.cos(turn), sn = Math.sin(turn);
        const brep = turn || c[0] || c[1] || z0 ? transformBrep(made!.brep, { matrix: [cs, -sn, 0, sn, cs, 0, 0, 0, 1], offset: [c[0], c[1], z0] }) : made!.brep;
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, ...made!.part }] };
      };
    }
    case 'cam': {
      if (f.generator !== undefined && f.generator !== 'cam@0') fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
      const opt = (key: string) => f[key as keyof typeof f] === undefined ? undefined : dim(f[key as keyof typeof f] as CadPartDim, key);
      const num = (key: string) => { const v = f[key as keyof typeof f]; if (v !== undefined && !(typeof v === 'number' && Number.isFinite(v))) fail('INPUT', `${key} must be a number`); return v as number | undefined; };
      const segs = f.segments as unknown;
      if (!Array.isArray(segs)) fail('INPUT', 'segments must be a list of { angle, to?, law? }');
      const keys = ['angle', 'to', 'law'];
      (segs as Record<string, unknown>[]).forEach((g, i) => { if (!g || typeof g !== 'object') fail('INPUT', `segments[${i}] must be { angle, to?, law? }`); const extra = Object.keys(g).find(x => !keys.includes(x)); if (extra) fail('INPUT', `segments[${i}].${extra} is not angle, to or law`); });
      const spec: CamSpec = { baseRadiusMM: dim(f.base as CadPartDim, 'base', true), thicknessMM: dim(f.thickness as CadPartDim, 'thickness', true), follower: f.follower as CamSpec['follower'],
        ...(f.motion !== undefined ? { motion: f.motion as CamSpec['motion'] } : {}), ...(f.roller !== undefined ? { rollerRadiusMM: opt('roller') } : {}), ...(f.offset !== undefined ? { offsetMM: opt('offset') } : {}),
        ...(f.pivotDistance !== undefined ? { pivotDistanceMM: opt('pivotDistance') } : {}), ...(f.armLength !== undefined ? { armLengthMM: opt('armLength') } : {}), ...(f.faceOffset !== undefined ? { faceOffsetMM: opt('faceOffset') } : {}),
        ...(f.faceWidth !== undefined ? { faceWidthMM: opt('faceWidth') } : {}), ...(f.bore !== undefined ? { boreDiameterMM: opt('bore') } : {}), ...(f.minimumRim !== undefined ? { minimumRimMM: opt('minimumRim') } : {}),
        ...(f.pressureAngleLimit !== undefined ? { pressureAngleLimitDeg: num('pressureAngleLimit') } : {}), ...(f.profileTolerance !== undefined ? { profileToleranceMM: num('profileTolerance') } : {}),
        segments: (segs as { angle: number; to?: number; law?: CamLaw }[]).map(g => ({ angleDeg: g.angle, ...(g.to !== undefined ? { to: g.to } : {}), ...(g.law !== undefined ? { law: g.law } : {}) })) };
      const c = f.center === undefined ? [0, 0] : xy(f.center as CadPartPoint2, 'center'), z0 = f.from === undefined ? 0 : dim(f.from as CadPartDim, 'from'), turn = (num('rotation') ?? 0) * Math.PI / 180;
      return () => {
        let made: { readonly brep: Brep; readonly report: CamReport } | undefined;
        try { made = discCam(spec, { id: at }); } catch (cause) { if (isCamError(cause)) fail(CAM_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^cam: /, '')}`); throw cause; }
        const cs = Math.cos(turn), sn = Math.sin(turn);
        const brep = turn || c[0] || c[1] || z0 ? transformBrep(made!.brep, { matrix: [cs, -sn, 0, sn, cs, 0, 0, 0, 1], offset: [c[0], c[1], z0] }) : made!.brep;
        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, cam: made!.report }] };
      };
    }
    case 'thread': {
      const d = dim(f.diameter as CadPartDim, 'diameter', true), p = dim(f.pitch as CadPartDim, 'pitch', true), c = f.center === undefined ? [0, 0] as XY : xy(f.center as CadPartPoint2, 'center');
      const seat = f.seat === undefined ? 0 : dim(f.seat as CadPartDim, 'seat'), length = f.length === undefined ? undefined : dim(f.length as CadPartDim, 'length', true);
      const h = f.hex as Record<string, unknown> | undefined;
      if (h !== undefined && !isRecord(h)) fail('INPUT', 'hex must be { across, height, internal? }');
      const hex = h ? { across: dim(h.across as CadPartDim, 'hex.across', true), height: dim(h.height as CadPartDim, 'hex.height', true), internal: h.internal === true } : undefined;
      if (f.form !== undefined && f.form !== 'faceted' && f.form !== 'helical') fail('INPUT', "form must be 'helical' or 'faceted'");
      // (Left out: the faceted form, as such documents were built before helical became the default.)
      const form = (f.form as 'faceted' | 'helical' | undefined) ?? 'faceted';
      return () => {
        try { return one({ kind: 'brep', brep: threadSolid({ id: at, diameter: d, pitch: p, center: c, seat, form, ...(length === undefined ? {} : { length }), ...(hex ? { hex } : {}) }) }); }
        catch (cause) { if (cause instanceof RangeError || isMeshBrepError(cause)) fail('PARAMETER', cause.message); throw cause; }
      };
    }
  }
  throw new Error(`machineOperation: ${f.kind} is not one of its features`);
}
