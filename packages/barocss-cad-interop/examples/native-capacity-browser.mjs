import { validateLinearGeometryPattern } from '@barocss/cad';
import { options, nativePreview, same, requireFact, pixelHash, coloredPixels } from './native-capacity-common.mjs';
import { makeTarget } from './native-capacity-targets.mjs';
const digest = async bytes => [...new Uint8Array(await crypto.subtle.digest('SHA-256', bytes))].map(x => x.toString(16).padStart(2, '0')).join('');
const fetchExact = async (file, hash) => {
  const response = await fetch(new URL(`./native-capacity-data/${file}`, import.meta.url));
  requireFact(response.ok, `${file}: HTTP ${response.status}`);
  const bytes = await response.arrayBuffer(); requireFact(await digest(bytes) === hash, `${file}: source SHA-256 mismatch`);
  return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
};
export async function run(target) {
  const status = document.querySelector('#status'), accepted = [], members = [], sources = new Map();
  let runtime;
  try {
    runtime = await makeTarget(target, document.querySelector('#view'));
    requireFact(runtime.gl instanceof WebGL2RenderingContext, 'WebGL2 required');
    const response = await fetch(new URL('./native-capacity-data/manifest.json', import.meta.url));
    requireFact(response.ok, `Manifest HTTP ${response.status}`);
    const manifest = await response.json();
    requireFact(manifest.schema === 'barocss-native-capacity-example' && manifest.cases.length === 4, 'Unexpected manifest');
    let originalOwned;
    for (const [caseIndex, item] of manifest.cases.entries()) {
      const source = await fetchExact(item.file, item.sourceSha256); sources.set(item.key, source);
      const neutral = nativePreview(source, item), result = runtime.parse(source);
      requireFact(result.source === source && same(result.model, neutral.model), `Loaded complete native Model mismatch: ${item.key}`);
      const points = neutral.model.objects.flatMap(native => native.kind === 'curve' ? native.controlPoints : native.controlPoints.flat());
      const center = [0, 1].map(axis => (Math.min(...points.map(p => p[axis])) + Math.max(...points.map(p => p[axis]))) * 0.0005);
      const pose = [(caseIndex % 2 === 0 ? -0.035 : 0.035) - center[0], (caseIndex < 2 ? 0.022 : -0.022) - center[1], 0];
      runtime.attach(result, pose); accepted.push({ item, result, source, pose });
      for (const native of neutral.model.objects) members.push({ key: `${item.key}/${native.id}`, ...runtime.bind(result, neutral, native) });
      if (item.ownedFile) {
        originalOwned = JSON.parse(await fetchExact(item.ownedFile, item.ownedSha256));
        requireFact(same(validateLinearGeometryPattern(originalOwned), originalOwned.report), 'Whole owned linear pattern validation mismatch');
      }
    }
    requireFact(accepted.length === 4 && members.length === 20 && originalOwned, 'Expected exactly four complete Models and twenty bound native members');
    await runtime.ready();
    const individuallyVisible = {};
    for (const member of members) {
      for (const other of members) runtime.visible(other.mesh, other === member);
      runtime.render(); individuallyVisible[member.key] = coloredPixels(runtime.pixels());
      requireFact(individuallyVisible[member.key] > 0, `Invisible native member: ${member.key}`);
    }
    for (const member of members) runtime.visible(member.mesh, true);
    runtime.render(); const frame = runtime.pixels();
    requireFact(runtime.gl.getError() === 0, 'GL error after render');
    const uniqueResources = [...new Map(members.flatMap(x => x.counters).map(x => [x.object, x])).values()];
    const ownedResourceCounts = Object.fromEntries(['mesh', 'geometry', 'material'].map(kind => [kind, uniqueResources.filter(x => x.kind === kind).length]));
    const evidence = { ownedResourceCounts, target: runtime.name, webgl2: true, fullSources: 4, nativeMembers: 20, displayedMembers: 20,
      adapterOwnedObjects: 20, pairSources: 0, directCompleteFileLoading: true, options,
      sourceFrame: 'authored XYZ/mm, right-handed Y-up; camera +Z/up+Y',
      hostPoses: accepted.map(x => ({ key: x.item.key, translationSceneUnits: x.pose })),
      authority: 'unchanged full source and native Models; gallery translation is derived display state',
      nativeUvAuthority: target === 'pixi3d' ? 'neutral surface packet; not Pixi texture UV' : 'target native parameter attributes/metadata',
      cases: accepted.map(x => ({ key: x.item.key, sourceSha256: x.item.sourceSha256, sourceBytes: x.item.sourceBytes, ids: x.item.ids })),
      individuallyVisible, combinedPixels: coloredPixels(frame), frameHash: pixelHash(frame), glError: 0, callerRetained: runtime.caller() };
    window.__baroNativeCapacityEvidence = evidence;
    const update = () => { status.textContent = JSON.stringify(evidence, null, 2); };
    update();
    document.querySelector('#reject').onclick = () => {
      try {
        const defaults = { ...options }; delete defaults.nativeCapacity;
        const quarter = sources.get('linear-quarter-five'), surface = sources.get('linear-surface-five');
        const attempts = [
          ...accepted.map(({ source }) => () => runtime.parse(source, defaults)),
          ...[null, { version: 1, maximumObjects: 5 }, { version: 2, maximumObjects: 16 }, { version: 1, maximumObjects: 16, extra: true }]
            .map(nativeCapacity => () => runtime.parse(quarter, { ...options, nativeCapacity })),
          () => runtime.parse(quarter, { ...options, sourceVersion: 1 }),
          () => runtime.parse(surface, { ...options, countU: 1 }),
          () => runtime.parse(quarter, { ...options, curveDisplay: { ...options.curveDisplay, maxSegments: 4093 } }),
          () => { const forged = structuredClone(originalOwned); forged.instances[1].geometryId = 'forged'; validateLinearGeometryPattern(forged); },
        ];
        let refused = 0;
        for (const attempt of attempts) { try { const accidental = attempt(); accidental?.dispose?.(); } catch { refused++; } }
        runtime.render();
        evidence.invalidCandidatesRefused = refused; evidence.expectedRefusals = attempts.length;
        evidence.acceptedSourcesRetained = accepted.every(x => sources.get(x.item.key) === x.source && x.result.source === x.source);
        evidence.acceptedSceneRetained = accepted.every(x => runtime.retained(x.result));
        evidence.acceptedFrameRetained = pixelHash(runtime.pixels()) === evidence.frameHash;
        evidence.refusalGlError = runtime.gl.getError();
        requireFact(refused === attempts.length && evidence.acceptedSourcesRetained && evidence.acceptedSceneRetained && evidence.acceptedFrameRetained && evidence.refusalGlError === 0, 'Refusal retention failed');
        update();
      } catch (error) { window.__baroNativeCapacityError = String(error); status.textContent = `Failed: ${error.stack ?? error}`; }
    };
    document.querySelector('#dispose').onclick = () => {
      try {
        for (const { result } of accepted) { result.dispose(); result.dispose(); }
        runtime.render();
        evidence.disposed = accepted.every(x => runtime.released(x.result)) && members.every(x => x.counters.every(c => c.count === 1));
        evidence.resourceDisposeCounts = members.map(x => ({ key: x.key, counts: x.counters.map(c => c.count) }));
        evidence.callerRetained = runtime.caller();
        evidence.nativeSourcesRetained = accepted.every(x => sources.get(x.item.key) === x.source);
        evidence.disposalGlError = runtime.gl.getError();
        requireFact(evidence.disposed && evidence.callerRetained && evidence.nativeSourcesRetained && evidence.disposalGlError === 0, 'Disposal ownership failed');
        update();
      } catch (error) { window.__baroNativeCapacityError = String(error); status.textContent = `Failed: ${error.stack ?? error}`; }
    };
  } catch (error) {
    for (const { result } of accepted) result.dispose();
    window.__baroNativeCapacityError = String(error); status.textContent = `Failed: ${error.stack ?? error}`;
  }
}
