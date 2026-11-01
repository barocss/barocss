// R5.3 (D222): the machine-element features of the part model — connectors, O-rings, bearings, keys, rings, pins,
// keyways, shafts, springs, drives, cams and threads — moved out of part-model.ts's operation() as they were there. The
// dispatcher calls `machineOperation` for those kinds.
import { isBearingError, bearingRowProblem, seatedBearing } from '../machine/bearing.js';
import { isCamError, discCam } from '../machine/cam.js';
import { isConnectorError, connectorBody, connectorOpening } from '../machine/connector.js';
import { isDriveError, beltBand, couplingEnvelope, pulley, sprocket } from '../machine/drive.js';
import { isGlandError, glandCut, oringInGland } from '../machine/oring.js';
import { isSpringError, compressionSpring, hookedSpring, springDimensions } from '../machine/spring.js';
import { isShaftPartError, keySolid, keywayCut, pinSolid, ringSolid } from '../machine/shaft-parts.js';
import { isMeshBrepError } from '../mesh/mesh-brep.js';
import { isShaftError, shaftSolid } from '../machine/shaft.js';
import { threadSolid } from '../machine/thread-solid.js';
import { transformBrep } from '../brep/brep-transform.js';
/** Shaft diagnostics as the part model's codes (the shaft's own code kept in the message). */
const SHAFT_CODES = { INVALID_INPUT: 'INPUT', SHAFT_STEPS: 'INPUT', KEYSEAT_DIMENSIONS: 'GEOMETRY', GROOVE_DIMENSIONS: 'GEOMETRY', HOLE_DIMENSIONS: 'GEOMETRY' };
/** Glands' diagnostics as the part model's codes (their warnings stay in the report). */
const GLAND_CODES = { INVALID_INPUT: 'INPUT', GLAND_DIMENSIONS: 'GEOMETRY', SQUEEZE_RANGE: 'GEOMETRY', FILL_RANGE: 'GEOMETRY', STRETCH_RANGE: 'GEOMETRY' };
/** Bearings' diagnostics as the part model's codes. */
const BEARING_CODES = { INVALID_INPUT: 'INPUT', SEAT_ABUTMENT: 'GEOMETRY', SEAT_FIT: 'GEOMETRY' };
/** Shaft parts' diagnostics as the part model's codes. */
const SHAFT_PART_CODES = { INVALID_INPUT: 'INPUT', KEY_FIT: 'GEOMETRY', RING_FIT: 'GEOMETRY', PIN_FIT: 'GEOMETRY' };
/** Connector refusals as the part model's codes (R12c.7; the connector's own code kept in the message). */
const CONNECTOR_CODES = { INVALID_INPUT: 'INPUT', CONNECTOR_PLACEMENT: 'GEOMETRY', CONNECTOR_FIT: 'GEOMETRY' };
/** Drive refusals as the part model's codes (R12c.6b; the element's own code kept in the message). */
const DRIVE_CODES = { INVALID_INPUT: 'INPUT', UNSUPPORTED_TOOTH_FORM: 'CAPABILITY', TOOTH_FORM: 'GEOMETRY', BELT_GEOMETRY: 'GEOMETRY' };
/** Cam refusals as the part model's codes (the cam's own code kept in the message). */
const CAM_CODES = { INVALID_INPUT: 'INPUT', CAM_UNDERCUT: 'GEOMETRY', PROFILE_BUDGET_EXCEEDED: 'CAPABILITY' };
/** Spring diagnostics as the part model's codes (the spring's own code kept in the message). */
const SPRING_CODES = { INVALID_INPUT: 'INPUT', SELF_INTERSECTION: 'GEOMETRY', COILS_OVERLAP: 'GEOMETRY', PROFILE_BUDGET_EXCEEDED: 'CAPABILITY', UNSUPPORTED_SPRING_KIND: 'CAPABILITY', LEG_OVERLAP: 'GEOMETRY' };
/** A machine-element feature's evaluation (part-model.ts's operation() for these kinds). */
export function machineOperation(f, t, k) {
    const { dim, xy, xyz, solids, ref, fail, at } = t;
    const { isRecord, brepOf } = k;
    const one = (s) => ({ kind: 'solid', parts: [{ solid: s }] });
    switch (f.kind) {
        case 'connector-opening': {
            const target = solids(f.target, 'target');
            if (target.length !== 1)
                fail('SELECTION', 'an opening is cut into one body');
            if (typeof f.face !== 'string')
                fail('INPUT', 'face must name the face the opening is cut into');
            const spec = { row: f.row, face: f.face, center: xyz(f.center, 'center'), ...(f.rotation !== undefined ? { rotation: f.rotation } : {}) };
            return () => {
                let made;
                try {
                    made = connectorOpening(brepOf(target[0], at), spec, at);
                }
                catch (cause) {
                    if (isConnectorError(cause))
                        fail(CONNECTOR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^connector: /, '')}`);
                    throw cause;
                }
                return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, connector: made.report }] };
            };
        }
        case 'connector-body': {
            const g = ref(f.opening, 'opening').result, gp = g.kind === 'solid' && g.parts.length === 1 ? g.parts[0] : undefined;
            if (!gp?.connector)
                fail('REFERENCE', `${String(f.opening)} is not a connector's opening`);
            return () => {
                let made;
                try {
                    made = connectorBody(brepOf(gp, at), gp.connector, at);
                }
                catch (cause) {
                    if (isConnectorError(cause))
                        fail(CONNECTOR_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^connector: /, '')}`);
                    throw cause;
                }
                return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, connectorBody: { row: gp.connector.row, overlap: made.overlap } }] };
            };
        }
        case 'oring-gland': {
            const target = solids(f.target, 'target');
            if (target.length !== 1)
                fail('SELECTION', 'a gland is cut into one body');
            if (typeof f.face !== 'string')
                fail('INPUT', 'face must name the face the groove is cut into');
            const rg = f.ring, gr = f.groove;
            if (!isRecord(rg) || !isRecord(gr))
                fail('INPUT', 'ring and groove must be objects');
            const ring = { id: String(rg.id), ...(rg.dash !== undefined ? { dash: String(rg.dash) } : {}), insideDiameter: rg.insideDiameter, crossSection: rg.crossSection, ...(rg.source !== undefined ? { source: rg.source } : {}), ...(rg.estimate !== undefined ? { estimate: rg.estimate } : {}) };
            const spec = { kind: f.gland, ring, face: f.face, grooveDiameter: dim(gr.diameter, 'groove.diameter', true), width: dim(gr.width, 'groove.width', true),
                ...(gr.at !== undefined ? { at: dim(gr.at, 'groove.at') } : {}), ...(gr.depth !== undefined ? { depth: dim(gr.depth, 'groove.depth', true) } : {}), ...(gr.center !== undefined ? { center: xyz(gr.center, 'groove.center') } : {}),
                ...(f.seal !== undefined ? { sealDiameter: dim(f.seal, 'seal', true) } : {}), ...(f.ranges !== undefined ? { ranges: f.ranges } : {}), ...(f.fit !== undefined ? { fit: f.fit } : {}) };
            return () => {
                let made;
                try {
                    made = glandCut(brepOf(target[0], at), spec, at);
                }
                catch (cause) {
                    if (isGlandError(cause))
                        fail(GLAND_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^gland: /, '')}`);
                    throw cause;
                }
                return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, gland: made.report, glandPlace: made.place }] };
            };
        }
        case 'oring': {
            const g = ref(f.gland, 'gland').result, gp = g.kind === 'solid' && g.parts.length === 1 ? g.parts[0] : undefined;
            if (!gp?.gland || !gp.glandPlace)
                fail('REFERENCE', `${String(f.gland)} is not an O-ring gland`);
            return () => {
                const made = oringInGland(gp.gland, gp.glandPlace, at);
                return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, oring: { ring: gp.gland.ring, overlap: made.overlap, stretchedCrossSection: gp.gland.stretchedCrossSection } }] };
            };
        }
        case 'bearing': {
            // (R12c.4, D158: on the shaft, referenced, not consumed; in the housing, referenced too.)
            const p = bearingRowProblem(f.row);
            if (p)
                fail('INPUT', `[INVALID_INPUT] ${p}`);
            const other = ref(f.shaft, 'shaft').result, sp = other.kind === 'solid' && other.parts.length === 1 ? other.parts[0] : undefined;
            if (!sp?.shaft || !sp.shaftPlace)
                fail('REFERENCE', `${String(f.shaft)} is not a shaft`);
            if (!Number.isInteger(f.step) || f.step < 1)
                fail('INPUT', 'step must be a number from 1');
            let housing;
            if (f.housing !== undefined) {
                const h = ref(f.housing, 'housing').result;
                if (h.kind !== 'solid' || h.parts.length !== 1)
                    fail('REFERENCE', `${String(f.housing)} is not one body`);
                housing = h.parts[0];
            }
            const fit = f.fit === undefined ? undefined : isRecord(f.fit) && Array.isArray(f.fit.tables) ? f.fit : fail('INPUT', 'fit must be { tables, shaft?, housing? }');
            return () => {
                let made;
                try {
                    made = seatedBearing(f.row, { report: sp.shaft, place: sp.shaftPlace, brep: brepOf(sp, String(f.shaft)) }, { step: f.step, against: f.against, ...(housing ? { housing: brepOf(housing, String(f.housing)) } : {}), ...(fit ? { fit } : {}) }, at);
                }
                catch (cause) {
                    if (isBearingError(cause))
                        fail(BEARING_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^bearing: /, '')}`);
                    throw cause;
                }
                return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, bearing: made.report }] };
            };
        }
        case 'key':
        case 'retaining-ring':
        case 'pin': {
            // (R12c.3b, D157: the shaft referenced, not consumed — it stays an output of its own, as a meshing gear's.)
            const other = ref(f.shaft, 'shaft').result, sp = other.kind === 'solid' && other.parts.length === 1 ? other.parts[0] : undefined;
            if (!sp?.shaft || !sp.shaftPlace)
                fail('REFERENCE', `${String(f.shaft)} is not a shaft`);
            const placed = { report: sp.shaft, place: sp.shaftPlace };
            const index = (v, what) => { if (!Number.isInteger(v) || v < 1)
                fail('INPUT', `${what} must be a number from 1`); return v; };
            const optDim = (v, what) => v === undefined ? undefined : dim(v, what, true);
            const partFail = (cause) => { if (isShaftPartError(cause))
                fail(SHAFT_PART_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^shaft part: /, '')}`); throw cause; };
            let hub;
            if (f.kind === 'key' && f.hub !== undefined) {
                const h = ref(f.hub, 'hub').result, hp = h.kind === 'solid' && h.parts.length === 1 ? h.parts[0] : undefined;
                if (!hp?.keyway)
                    fail('REFERENCE', `${String(f.hub)} is not a keyway`);
                hub = hp.keyway;
            }
            const fit = f.kind === 'key' && f.fit !== undefined ? (isRecord(f.fit) && Array.isArray(f.fit.tables) && typeof f.fit.key === 'string' ? f.fit : fail('INPUT', 'fit must be { tables, key, seat?, hub? }')) : undefined;
            return () => {
                try {
                    if (f.kind === 'key') {
                        const made = keySolid(placed, { keyseat: index(f.keyseat, 'keyseat'), height: dim(f.height, 'height', true), ...(f.width !== undefined ? { width: optDim(f.width, 'width') } : {}), ...(f.length !== undefined ? { length: optDim(f.length, 'length') } : {}), ...(f.ends !== undefined ? { ends: f.ends } : {}), ...(hub ? { hub } : {}), ...(fit ? { fit } : {}) }, at);
                        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, key: made.report }] };
                    }
                    if (f.kind === 'retaining-ring') {
                        const row = f.row;
                        const made = ringSolid(placed, { groove: index(f.groove, 'groove'), thickness: dim(f.thickness, 'thickness', true), outerDiameter: dim(f.outerDiameter, 'outerDiameter', true), ...(row ? { row: { ...(row.shaftDiameter !== undefined ? { shaftDiameter: row.shaftDiameter } : {}), ...(row.grooveDiameter !== undefined ? { grooveDiameter: row.grooveDiameter } : {}), ...(row.grooveWidth !== undefined ? { grooveWidth: row.grooveWidth } : {}), ...(row.source !== undefined ? { source: row.source } : {}), ...(row.estimate !== undefined ? { estimate: row.estimate } : {}) } } : {}) }, at);
                        return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, ring: made.report }] };
                    }
                    const made = pinSolid(placed, { hole: index(f.hole, 'hole'), ...(f.diameter !== undefined ? { diameter: optDim(f.diameter, 'diameter') } : {}), ...(f.length !== undefined ? { length: optDim(f.length, 'length') } : {}), ...(f.fit ? { fit: true } : {}) }, at);
                    return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, pin: made.report }] };
                }
                catch (cause) {
                    return partFail(cause);
                }
            };
        }
        case 'keyway': {
            const target = solids(f.target, 'target');
            if (target.length !== 1)
                fail('SELECTION', 'a keyway is cut into one body');
            if (typeof f.face !== 'string')
                fail('INPUT', 'face must name the bore');
            const b = dim(f.width, 'width', true), t2 = dim(f.depth, 'depth', true);
            if (f.angle !== undefined && !(typeof f.angle === 'number' && Number.isFinite(f.angle)))
                fail('INPUT', 'angle must be a number of degrees');
            return () => {
                let made;
                try {
                    made = keywayCut(brepOf(target[0], at), { face: f.face, width: b, depth: t2, ...(f.angle !== undefined ? { angle: f.angle } : {}) }, at);
                }
                catch (cause) {
                    if (isShaftPartError(cause))
                        fail(SHAFT_PART_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^shaft part: /, '')}`);
                    throw cause;
                }
                return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep: made.brep }, keyway: made.report }] };
            };
        }
        case 'shaft': {
            if (f.generator !== undefined && f.generator !== 'shaft@0')
                fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
            const list = (v, what) => { if (v === undefined)
                return []; if (!Array.isArray(v))
                fail('INPUT', `${what} must be a list`); return v; };
            const rec = (v, what) => { if (!isRecord(v))
                fail('INPUT', `${what} must be an object`); return v; };
            const opt = (v, what) => v === undefined ? undefined : dim(v, what);
            const deg = (v, what) => { if (v !== undefined && !(typeof v === 'number' && Number.isFinite(v)))
                fail('INPUT', `${what} must be a number of degrees`); return v; };
            const steps = list(f.steps, 'steps').map((x, k) => {
                const s = rec(x, `steps[${k}]`), at = `steps[${k}]`, u = s.undercut === undefined ? undefined : rec(s.undercut, `${at}.undercut`);
                return { diameter: dim(s.diameter, `${at}.diameter`), length: dim(s.length, `${at}.length`), ...(s.fillet !== undefined ? { fillet: opt(s.fillet, `${at}.fillet`) } : {}),
                    ...(u ? { undercut: { width: dim(u.width, `${at}.undercut.width`), depth: dim(u.depth, `${at}.undercut.depth`) } } : {}),
                    grooves: list(s.grooves, `${at}.grooves`).map((g, j) => { const r = rec(g, `${at}.grooves[${j}]`); return { diameter: dim(r.diameter, 'groove diameter'), width: dim(r.width, 'groove width'), at: dim(r.at, 'groove at') }; }),
                    keyseats: list(s.keyseats, `${at}.keyseats`).map((g, j) => {
                        const r = rec(g, `${at}.keyseats[${j}]`);
                        return { width: dim(r.width, 'keyseat width'), depth: dim(r.depth, 'keyseat depth'), length: dim(r.length, 'keyseat length'), offset: dim(r.offset, 'keyseat offset'),
                            ...(r.ends !== undefined ? { ends: r.ends } : {}), ...(r.cutterRadius !== undefined ? { cutterRadius: opt(r.cutterRadius, 'keyseat cutterRadius') } : {}), ...(r.angle !== undefined ? { angle: deg(r.angle, 'keyseat angle') } : {}) };
                    }) };
            });
            const ch = f.chamfers;
            if (ch !== undefined && !(Array.isArray(ch) && ch.length === 2))
                fail('INPUT', 'chamfers must be [start, end]');
            const spec = { steps, ...(ch ? { chamfers: [dim(ch[0], 'chamfers[0]'), dim(ch[1], 'chamfers[1]')] } : {}),
                holes: list(f.holes, 'holes').map((h, j) => { const r = rec(h, `holes[${j}]`); return { diameter: dim(r.diameter, 'hole diameter'), at: dim(r.at, 'hole at'), ...(r.angle !== undefined ? { angle: deg(r.angle, 'hole angle') } : {}) }; }) };
            const c = f.center === undefined ? [0, 0] : xy(f.center, 'center'), z0 = f.from === undefined ? 0 : dim(f.from, 'from'), turn = (deg(f.rotation, 'rotation') ?? 0) * Math.PI / 180;
            return () => {
                let made;
                try {
                    made = shaftSolid(spec, { id: at });
                }
                catch (cause) {
                    if (isShaftError(cause))
                        fail(SHAFT_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^shaft: /, '')}`);
                    throw cause;
                }
                const cs = Math.cos(turn), sn = Math.sin(turn);
                const brep = turn || c[0] || c[1] || z0 ? transformBrep(made.brep, { matrix: [cs, -sn, 0, sn, cs, 0, 0, 0, 1], offset: [c[0], c[1], z0] }) : made.brep;
                return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, shaft: made.report, shaftPlace: { matrix: [cs, -sn, 0, sn, cs, 0, 0, 0, 1], offset: [c[0], c[1], z0] } }] };
            };
        }
        case 'spring': {
            if (f.generator !== undefined && f.generator !== 'spring@0')
                fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
            const opt = (k) => f[k] === undefined ? undefined : dim(f[k], k, true);
            const num = (k) => { const v = f[k]; if (v !== undefined && !(typeof v === 'number' && Number.isFinite(v)))
                fail('INPUT', `${k} must be a number`); return v; };
            if (f.shearModulusEstimate !== undefined && typeof f.shearModulusEstimate !== 'boolean')
                fail('INPUT', 'shearModulusEstimate must be true or false');
            const spec = { wireDiameter: dim(f.wire, 'wire', true), activeCoils: num('activeCoils'),
                ...(f.diameter !== undefined ? { meanDiameter: opt('diameter') } : {}), ...(f.outerDiameter !== undefined ? { outerDiameter: opt('outerDiameter') } : {}), ...(f.innerDiameter !== undefined ? { innerDiameter: opt('innerDiameter') } : {}),
                ...(f.pitch !== undefined ? { pitch: opt('pitch') } : {}), ...(f.freeLength !== undefined ? { freeLength: opt('freeLength') } : {}),
                ...(f.hand !== undefined ? { hand: f.hand } : {}), ...(f.ends !== undefined ? { ends: f.ends } : {}), ...(f.endCoils !== undefined ? { endCoils: num('endCoils') } : {}), ...(f.transition !== undefined ? { transition: num('transition') } : {}),
                ...(f.shearModulus !== undefined ? { shearModulus: num('shearModulus'), ...(f.shearModulusEstimate ? { shearModulusEstimate: true } : {}) } : {}), ...(f.load !== undefined ? { load: num('load') } : {}), ...(f.profileTolerance !== undefined ? { profileTolerance: num('profileTolerance') } : {}),
                ...(f.type !== undefined ? { type: f.type } : {}), ...(f.body !== undefined ? { body: f.body } : {}), ...(f.wireSection !== undefined ? { wire: f.wireSection } : {}) };
            const springFail = (cause) => { if (isSpringError(cause))
                fail(SPRING_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^spring: /, '')}`); throw cause; };
            const hooked = f.type === 'extension' || f.type === 'torsion';
            if (!hooked && (f.hooks !== undefined || f.bendRadius !== undefined || f.loopRadius !== undefined || f.loopAngle !== undefined || f.initialTension !== undefined || f.legLengths !== undefined || f.youngsModulus !== undefined || f.moment !== undefined))
                fail('INPUT', 'hooks, bends, loops, initial tension, legs, E and a moment belong to an extension or a torsion spring (give its type)');
            if (f.youngsModulusEstimate !== undefined && typeof f.youngsModulusEstimate !== 'boolean')
                fail('INPUT', 'youngsModulusEstimate must be true or false');
            const legs = f.legLengths;
            if (legs !== undefined && !(Array.isArray(legs) && legs.length === 2))
                fail('INPUT', 'legLengths must be [start, end]');
            const hspec = hooked ? { ...spec, ...(f.hooks !== undefined ? { hooks: f.hooks } : {}), ...(f.bendRadius !== undefined ? { bendRadius: opt('bendRadius') } : {}), ...(f.loopRadius !== undefined ? { loopRadius: opt('loopRadius') } : {}),
                ...(f.loopAngle !== undefined ? { loopAngle: num('loopAngle') } : {}), ...(f.initialTension !== undefined ? { initialTension: num('initialTension') } : {}),
                ...(legs !== undefined ? { legLengths: [dim(legs[0], 'legLengths[0]', true), dim(legs[1], 'legLengths[1]', true)] } : {}),
                ...(f.youngsModulus !== undefined ? { youngsModulus: num('youngsModulus'), ...(f.youngsModulusEstimate ? { youngsModulusEstimate: true } : {}) } : {}), ...(f.moment !== undefined ? { moment: num('moment') } : {}) } : undefined;
            if (!hspec) {
                try {
                    springDimensions(spec);
                }
                catch (cause) {
                    springFail(cause);
                }
            }
            const c = f.center === undefined ? [0, 0] : xy(f.center, 'center'), z0 = f.from === undefined ? 0 : dim(f.from, 'from'), turn = (num('rotation') ?? 0) * Math.PI / 180;
            return () => {
                let made;
                try {
                    made = hspec ? hookedSpring(hspec, { id: at }) : compressionSpring(spec, { id: at });
                }
                catch (cause) {
                    springFail(cause);
                }
                const cs = Math.cos(turn), sn = Math.sin(turn);
                const brep = turn || c[0] || c[1] || z0 ? transformBrep(made.brep, { matrix: [cs, -sn, 0, sn, cs, 0, 0, 0, 1], offset: [c[0], c[1], z0] }) : made.brep;
                return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, spring: made.report }] };
            };
        }
        case 'sprocket':
        case 'pulley':
        case 'belt':
        case 'coupling': {
            const gen = `${f.kind}@0`;
            if (f.generator !== undefined && f.generator !== gen)
                fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
            const opt = (key) => f[key] === undefined ? undefined : dim(f[key], key);
            const int = (key) => { const v = f[key]; if (v !== undefined && !(typeof v === 'number' && Number.isFinite(v)))
                fail('INPUT', `${key} must be a number`); return v; };
            const row = f.row;
            if (!row || typeof row !== 'object')
                fail('INPUT', 'row must be the drive row (a chain, a belt or a coupling row) inline');
            const c = f.center === undefined ? [0, 0] : xy(f.center, 'center'), z0 = f.from === undefined ? 0 : dim(f.from, 'from'), turn = (int('rotation') ?? 0) * Math.PI / 180;
            const g = f, radii = g.pitchRadii;
            if (f.kind === 'belt' && !(Array.isArray(radii) && radii.length === 2))
                fail('INPUT', 'pitchRadii must be [first wheel, second wheel]');
            const make = () => {
                switch (f.kind) {
                    case 'sprocket': {
                        const m = sprocket({ chain: row, teeth: int('teeth'), tipDiameter: opt('tip'), width: opt('width'), ...(g.seat !== undefined ? { seatDiameter: opt('seat') } : {}), ...(g.toothForm !== undefined ? { toothForm: g.toothForm } : {}), ...(g.bore !== undefined ? { boreDiameter: opt('bore') } : {}), ...(g.minimumRim !== undefined ? { minimumRim: opt('minimumRim') } : {}) }, { id: at });
                        return { brep: m.brep, part: { sprocket: m.report } };
                    }
                    case 'pulley': {
                        const m = pulley({ belt: row, ...(g.teeth !== undefined ? { teeth: int('teeth') } : {}), ...(g.diameter !== undefined ? { diameter: opt('diameter') } : {}), ...(g.grooves !== undefined ? { grooves: int('grooves') } : {}), ...(g.width !== undefined ? { width: opt('width') } : {}), ...(g.crown !== undefined ? { crown: opt('crown') } : {}), ...(g.bore !== undefined ? { boreDiameter: opt('bore') } : {}), ...(g.minimumRim !== undefined ? { minimumRim: opt('minimumRim') } : {}) }, { id: at });
                        return { brep: m.brep, part: { pulley: m.report } };
                    }
                    case 'belt': {
                        const r = radii, m = beltBand({ row: row, pitchRadii: [dim(r[0], 'pitchRadii[0]', true), dim(r[1], 'pitchRadii[1]', true)], centerDistance: dim(g.centerDistance, 'centerDistance', true), ...(g.rounding !== undefined ? { rounding: g.rounding } : {}), ...(g.width !== undefined ? { width: opt('width') } : {}) }, { id: at });
                        return { brep: m.brep, part: { belt: m.report } };
                    }
                    default: {
                        const m = couplingEnvelope(row, { id: at });
                        return { brep: m.brep, part: { coupling: m.report } };
                    }
                }
            };
            return () => {
                let made;
                try {
                    made = make();
                }
                catch (cause) {
                    if (isDriveError(cause))
                        fail(DRIVE_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^drive: /, '')}`);
                    throw cause;
                }
                const cs = Math.cos(turn), sn = Math.sin(turn);
                const brep = turn || c[0] || c[1] || z0 ? transformBrep(made.brep, { matrix: [cs, -sn, 0, sn, cs, 0, 0, 0, 1], offset: [c[0], c[1], z0] }) : made.brep;
                return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, ...made.part }] };
            };
        }
        case 'cam': {
            if (f.generator !== undefined && f.generator !== 'cam@0')
                fail('CAPABILITY', `generator ${String(f.generator)} is not known to this kernel`);
            const opt = (key) => f[key] === undefined ? undefined : dim(f[key], key);
            const num = (key) => { const v = f[key]; if (v !== undefined && !(typeof v === 'number' && Number.isFinite(v)))
                fail('INPUT', `${key} must be a number`); return v; };
            const segs = f.segments;
            if (!Array.isArray(segs))
                fail('INPUT', 'segments must be a list of { angle, to?, law? }');
            const keys = ['angle', 'to', 'law'];
            segs.forEach((g, i) => { if (!g || typeof g !== 'object')
                fail('INPUT', `segments[${i}] must be { angle, to?, law? }`); const extra = Object.keys(g).find(x => !keys.includes(x)); if (extra)
                fail('INPUT', `segments[${i}].${extra} is not angle, to or law`); });
            const spec = { baseRadius: dim(f.base, 'base', true), thickness: dim(f.thickness, 'thickness', true), follower: f.follower,
                ...(f.motion !== undefined ? { motion: f.motion } : {}), ...(f.roller !== undefined ? { rollerRadius: opt('roller') } : {}), ...(f.offset !== undefined ? { offset: opt('offset') } : {}),
                ...(f.pivotDistance !== undefined ? { pivotDistance: opt('pivotDistance') } : {}), ...(f.armLength !== undefined ? { armLength: opt('armLength') } : {}), ...(f.faceOffset !== undefined ? { faceOffset: opt('faceOffset') } : {}),
                ...(f.faceWidth !== undefined ? { faceWidth: opt('faceWidth') } : {}), ...(f.bore !== undefined ? { boreDiameter: opt('bore') } : {}), ...(f.minimumRim !== undefined ? { minimumRim: opt('minimumRim') } : {}),
                ...(f.pressureAngleLimit !== undefined ? { pressureAngleLimit: num('pressureAngleLimit') } : {}), ...(f.profileTolerance !== undefined ? { profileTolerance: num('profileTolerance') } : {}),
                segments: segs.map(g => ({ angle: g.angle, ...(g.to !== undefined ? { to: g.to } : {}), ...(g.law !== undefined ? { law: g.law } : {}) })) };
            const c = f.center === undefined ? [0, 0] : xy(f.center, 'center'), z0 = f.from === undefined ? 0 : dim(f.from, 'from'), turn = (num('rotation') ?? 0) * Math.PI / 180;
            return () => {
                let made;
                try {
                    made = discCam(spec, { id: at });
                }
                catch (cause) {
                    if (isCamError(cause))
                        fail(CAM_CODES[cause.code], `[${cause.code}] ${cause.message.replace(/^cam: /, '')}`);
                    throw cause;
                }
                const cs = Math.cos(turn), sn = Math.sin(turn);
                const brep = turn || c[0] || c[1] || z0 ? transformBrep(made.brep, { matrix: [cs, -sn, 0, sn, cs, 0, 0, 0, 1], offset: [c[0], c[1], z0] }) : made.brep;
                return { kind: 'solid', parts: [{ solid: { kind: 'brep', brep }, cam: made.report }] };
            };
        }
        case 'thread': {
            const d = dim(f.diameter, 'diameter', true), p = dim(f.pitch, 'pitch', true), c = f.center === undefined ? [0, 0] : xy(f.center, 'center');
            const seat = f.seat === undefined ? 0 : dim(f.seat, 'seat'), length = f.length === undefined ? undefined : dim(f.length, 'length', true);
            const h = f.hex;
            if (h !== undefined && !isRecord(h))
                fail('INPUT', 'hex must be { across, height, internal? }');
            const hex = h ? { across: dim(h.across, 'hex.across', true), height: dim(h.height, 'hex.height', true), internal: h.internal === true } : undefined;
            if (f.form !== undefined && f.form !== 'faceted' && f.form !== 'helical')
                fail('INPUT', "form must be 'helical' or 'faceted'");
            // (Left out: the faceted form, as such documents were built before helical became the default.)
            const form = f.form ?? 'faceted';
            return () => {
                try {
                    return one({ kind: 'brep', brep: threadSolid({ id: at, diameter: d, pitch: p, center: c, seat, form, ...(length === undefined ? {} : { length }), ...(hex ? { hex } : {}) }) });
                }
                catch (cause) {
                    if (cause instanceof RangeError || isMeshBrepError(cause))
                        fail('PARAMETER', cause.message);
                    throw cause;
                }
            };
        }
    }
    throw new Error(`machineOperation: ${f.kind} is not one of its features`);
}
