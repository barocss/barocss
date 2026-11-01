import { admitModel } from './model-admission.js';
import { parseCommands } from './validation.js';
import { canonicalEncode, digest } from './identity.js';
import { copyReplayJson, exactFields, replayError, encodeRecordingData, equivalentReplayIdentity } from './replay-json.js';
function record(value, keys, label) {
    exactFields(value, keys, label);
    return value;
}
function number(value) {
    if (typeof value !== 'number' || !Number.isFinite(value))
        replayError('INVALID_SNAPSHOT', 'state number is invalid');
}
function vector(value, length = 3) {
    if (!Array.isArray(value) || value.length !== length)
        replayError('INVALID_SNAPSHOT', 'state vector is invalid');
    value.forEach(number);
}
function ids(values, expected, fields, validate) {
    if (!Array.isArray(values) || values.length !== expected.length)
        replayError('INVALID_SNAPSHOT', 'state entity list differs from model');
    values.forEach((value, index) => {
        const data = record(value, fields, 'state entity');
        if (data.id !== expected[index])
            replayError('INVALID_SNAPSHOT', 'state entity ID differs from model');
        validate(data);
    });
}
function identity(value) {
    const data = record(value, ['modelRevision', 'modelDigest', 'configurationDigest', 'providerDigest', 'profile', 'frameId', 'fixedStepSeconds'], 'identity');
    for (const name of ['modelDigest', 'configurationDigest', 'providerDigest']) {
        if (typeof data[name] !== 'string' || !/^sha256:[a-f0-9]{64}$/.test(data[name]))
            replayError('INVALID_SNAPSHOT', 'identity digest is invalid');
    }
    if (typeof data.modelRevision !== 'string' || typeof data.frameId !== 'string' || typeof data.profile !== 'string')
        replayError('INVALID_SNAPSHOT', 'identity fields are invalid');
    number(data.fixedStepSeconds);
}
/** Complete inert shape and bounded model/command/state validation precedes expected identity checks. */
export function admitRecording(input) {
    const copied = copyReplayJson(input, 'recording');
    const data = record(copied, ['format', 'version', 'model', 'options', 'identity', 'frames', 'finalState'], 'recording');
    if (data.format !== 'barocss-physics-recording' || data.version !== 1)
        replayError('INVALID_SNAPSHOT', 'unsupported recording');
    encodeRecordingData(copied);
    if (canonicalEncode(data.model).length > 128 * 1024)
        replayError('INVALID_SNAPSHOT', 'recording model exceeds byte limit');
    let admitted;
    try {
        admitted = admitModel(data.model, data.options);
    }
    catch {
        replayError('INVALID_SNAPSHOT', 'recording model or options are invalid');
    }
    const model = admitted.model, options = admitted.options;
    identity(data.identity);
    if (!Array.isArray(data.frames) || data.frames.length > 512)
        replayError('INVALID_SNAPSHOT', 'recording frame limit exceeded');
    let commandCount = 0;
    for (const [index, frame] of data.frames.entries()) {
        const f = record(frame, ['stepIndex', 'commands'], 'frame');
        if (f.stepIndex !== index + 1 || !Array.isArray(f.commands) || f.commands.length > 64)
            replayError('INVALID_SNAPSHOT', 'frame cursor or commands are invalid');
        commandCount += f.commands.length;
        try {
            parseCommands(f.commands, admitted.bodies);
        }
        catch {
            replayError('INVALID_SNAPSHOT', 'frame commands are invalid');
        }
    }
    if (commandCount > 4096)
        replayError('INVALID_SNAPSHOT', 'recording command limit exceeded');
    const state = record(data.finalState, ['identity', 'stepIndex', 'timeSeconds', 'bodies', 'joints', 'contacts', 'events', 'ccdHits', 'cloths', 'fluids', 'pairStats'], 'final state');
    identity(state.identity);
    if (state.stepIndex !== data.frames.length || state.timeSeconds !== data.frames.length * options.fixedStepSeconds)
        replayError('INVALID_SNAPSHOT', 'final cursor differs from log');
    if (!equivalentReplayIdentity(data.identity, state.identity))
        replayError('INVALID_SNAPSHOT', 'final identity differs from recording');
    const ident = data.identity;
    if (ident.modelRevision !== model.revision || ident.modelDigest !== digest(model) || ident.configurationDigest !== digest(options) || ident.profile !== options.profile || ident.frameId !== model.frame.id || !Object.is(ident.fixedStepSeconds, options.fixedStepSeconds))
        replayError('INVALID_SNAPSHOT', 'recording identity differs from inputs');
    ids(state.bodies, model.bodies.map(b => b.id), ['id', 'kind', 'positionM', 'orientationXYZW', 'velocityMps', 'angularVelocityRadps', 'sleeping'], b => {
        const source = model.bodies.find(item => item.id === b.id);
        if (b.kind !== source.kind || typeof b.sleeping !== 'boolean')
            replayError('INVALID_SNAPSHOT', 'body state kind or sleep flag is invalid');
        vector(b.positionM);
        vector(b.orientationXYZW, 4);
        vector(b.velocityMps);
        vector(b.angularVelocityRadps);
    });
    const bodyIds = new Set(model.bodies.map(b => b.id)), colliders = new Map(model.colliders.map(c => [c.id, c.bodyId]));
    const body = (value) => { if (typeof value !== 'string' || !bodyIds.has(value))
        replayError('INVALID_SNAPSHOT', 'unknown body ID'); };
    const collider = (value) => { if (typeof value !== 'string' || !colliders.has(value))
        replayError('INVALID_SNAPSHOT', 'unknown collider ID'); };
    ids(state.joints, model.joints.map(j => j.id), ['id', 'bodyAId', 'bodyBId', 'linearImpulseOnBNs', 'angularImpulseOnBNms', 'angleRad', 'motorImpulseNms'], j => {
        const source = model.joints.find(item => item.id === j.id);
        if (j.bodyAId !== source.bodyAId || j.bodyBId !== source.bodyBId)
            replayError('INVALID_SNAPSHOT', 'joint owners differ');
        vector(j.linearImpulseOnBNs);
        vector(j.angularImpulseOnBNms);
        if (source.kind === 'fixed' ? j.angleRad !== null : typeof j.angleRad !== 'number')
            replayError('INVALID_SNAPSHOT', 'joint angle is invalid');
        if (source.kind === 'hinge' && source.motor ? typeof j.motorImpulseNms !== 'number' : j.motorImpulseNms !== null)
            replayError('INVALID_SNAPSHOT', 'joint motor state is invalid');
    });
    function entries(value, keys, check) {
        if (!Array.isArray(value))
            replayError('INVALID_SNAPSHOT', 'state list is invalid');
        value.forEach(item => check(record(item, keys, 'state observation')));
    }
    entries(state.contacts, ['colliderAId', 'colliderBId', 'bodyAId', 'bodyBId', 'normalAtoB', 'pointM', 'penetrationM', 'normalImpulseNs', 'tangentImpulseOnBNs'], c => {
        body(c.bodyAId);
        body(c.bodyBId);
        collider(c.colliderAId);
        collider(c.colliderBId);
        if (colliders.get(c.colliderAId) !== c.bodyAId || colliders.get(c.colliderBId) !== c.bodyBId)
            replayError('INVALID_SNAPSHOT', 'contact owner differs');
        vector(c.normalAtoB);
        vector(c.pointM);
        vector(c.tangentImpulseOnBNs);
        number(c.penetrationM);
        number(c.normalImpulseNs);
    });
    entries(state.events, ['colliderAId', 'colliderBId', 'kind', 'phase'], e => {
        collider(e.colliderAId);
        collider(e.colliderBId);
        if (!['contact', 'sensor'].includes(e.kind) || !['begin', 'stay', 'end'].includes(e.phase))
            replayError('INVALID_SNAPSHOT', 'event is invalid');
    });
    entries(state.ccdHits, ['bodyId', 'colliderId', 'toiFraction', 'normalFixtureToBody'], h => { body(h.bodyId); collider(h.colliderId); number(h.toiFraction); vector(h.normalFixtureToBody); });
    if (!Array.isArray(state.cloths) || state.cloths.length || !Array.isArray(state.fluids) || state.fluids.length)
        replayError('INVALID_SNAPSHOT', 'domain recording is unsupported');
    const stats = record(state.pairStats, ['eligiblePairs', 'candidatePairs', 'aabbTests'], 'pair stats');
    for (const value of Object.values(stats))
        if (!Number.isSafeInteger(value) || value < 0)
            replayError('INVALID_SNAPSHOT', 'pair stats are invalid');
    return copied;
}
