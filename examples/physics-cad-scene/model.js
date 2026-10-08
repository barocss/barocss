import { createPhysicsWorld } from '../../packages/barocss-physics/dist/index.js';
import { admitCadSurfaceProxy, assertCadProxyCurrent, cadProxyPose } from '../../packages/barocss-physics/dist/cad-proxy.js';
import { createViewer } from '../../packages/barocss-viewer/dist/index.js';

export const DT = 1 / 120;
const BASIS = { basis: 'part-xyz-matches-rhyup' };

export async function createScene(canvas) {
  const source = await (await fetch('/two-surfaces.barocad')).text();
  const viewer = createViewer(canvas, { mmToSceneUnit: 0.001, background: [0.035, 0.065, 0.105] });
  viewer.loadNative(source, { sourceVersion: 0, countU: 12, countV: 12 });
  const native = viewer.getState().native;
  const modelId = native.model.name;
  const refs = viewer.getState().surfaces;
  if (refs.length !== 2 || !['rational_panel', 'flat_panel'].every((surfaceId) =>
    refs.some((ref) => ref.modelId === modelId && ref.surfaceId === surfaceId))) {
    throw new Error('This scene requires two original native Surfaces');
  }

  let revision = 'rev1';
  let proxies, world;
  const admit = () => [
    admitCadSurfaceProxy(source, { sourceVersion: 0, sourceRevision: revision, modelId,
      surfaceId: 'rational_panel', kind: 'dynamic', proxy: 'sphere', massKg: 1,
      initialOffsetM: [0, 0.28, 0] }),
    admitCadSurfaceProxy(source, { sourceVersion: 0, sourceRevision: revision, modelId,
      surfaceId: 'flat_panel', kind: 'static', proxy: 'box', minimumHalfExtentM: 0.01 }),
  ];
  const makeWorld = (entries) => createPhysicsWorld({ fixedStepSeconds: DT,
    gravityMps2: [0, -9.81, 0], bodies: entries.map((entry) => entry.body) });
  const currentSource = () => viewer.getState().native?.source;
  const ensureCurrent = () => proxies.forEach((proxy) =>
    assertCadProxyCurrent(proxy, currentSource(), revision));
  const apply = (entries, state) => {
    const poses = entries.map((entry) => {
      const body = state.bodies.find((candidate) => candidate.id === entry.bodyId);
      if (!body) throw new Error(`Missing Physics body ${entry.bodyId}`);
      return cadProxyPose(entry, body, currentSource(), revision);
    });
    const bindings = entries.map((entry) => ({ contextId: modelId, targetId: entry.bodyId,
      ref: { modelId, surfaceId: entry.surfaceId } }));
    viewer.applyMotionFrame({ contextId: modelId, timeSeconds: state.timeSeconds, poses }, bindings, BASIS);
  };
  const replace = () => {
    const candidateProxies = admit();
    const candidateWorld = makeWorld(candidateProxies);
    try {
      apply(candidateProxies, candidateWorld.getState());
    } catch (error) {
      candidateWorld.dispose();
      throw error;
    }
    world?.dispose();
    world = candidateWorld;
    proxies = candidateProxies;
  };
  replace();
  viewer.fit();
  return {
    viewer,
    source,
    get sourceRevision() { return revision; },
    get proxies() { return proxies; },
    getState: () => world.getState(),
    step() {
      ensureCurrent();
      const state = world.step(DT);
      apply(proxies, state);
      return state;
    },
    changeRevision() { revision = revision === 'rev1' ? 'rev2' : 'rev1'; },
    reAdmit: replace,
    dispose() { world.dispose(); viewer.dispose(); },
  };
}
