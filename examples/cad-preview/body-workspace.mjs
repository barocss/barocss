import * as cad from '/cad.js';
import * as gpu from '/gpu.js';
import { bindMouseOrbit } from '/orbit.mjs';
import { bodyEdges } from '/cad-edge-overlay.mjs';

const parameterIds = ['_rect_ox', '_rect_oy', '_rect_w', '_rect_h', '_rect_d'];
const fieldIds = ['body-x', 'body-y', 'body-width', 'body-height', 'body-depth'];
const $ = id => document.getElementById(id);
const initial = {
  format: 'barocss-axis-rectangle-feature', version: 0, id: 'part_doc', lengthUnit: 'mm',
  parameters: parameterIds.map((id, i) => ({ id, type: 'length', valueMM: [0, 0, 40, 30, 20][i] })),
  profile: { id: 'footprint', kind: 'xy-rectangle', originX: '_rect_ox', originY: '_rect_oy', width: '_rect_w', height: '_rect_h' },
  feature: { id: 'extrusion', kind: 'axis-rectangle-extrude', profileId: 'footprint', bodyId: 'body', distance: '_rect_d' },
};
const camera = { eye: [4, 3, 6], target: [0, 0, 0], up: [0, 1, 0], fovYDegrees: 45, near: .01, far: 100 };
let accepted, renderer, orbit, canvas, unavailable = false, disposed = false, opening = false;
let revision = 0, viewRevision = 0;
let edgesEnabled = true;

function message(text) { $('body-status').textContent = text; }
function dimensions() {
  const rect = $('body-viewport').getBoundingClientRect(), dpr = Math.min(devicePixelRatio || 1, 2);
  let width = Math.max(1, Math.min(4096, Math.round(rect.width * dpr)));
  let height = Math.max(1, Math.min(4096, Math.round(rect.height * dpr)));
  if (width * height > 4_000_000) { const scale = Math.sqrt(4_000_000 / (width * height)); width = Math.floor(width * scale); height = Math.floor(height * scale); }
  return [width, height];
}
function values() {
  return fieldIds.map(id => {
    const text = $(id).value.trim(), value = Number(text);
    if (!text || !Number.isInteger(value)) throw Error('Use whole millimetres for every dimension.');
    return value;
  });
}
function dirty() {
  if (!accepted) return false;
  return fieldIds.some((id, i) => !$(id).value.trim() || Number($(id).value) !== accepted.document.parameters[i].valueMM);
}
function refresh() {
  if (accepted) {
    accepted.document.parameters.forEach((p, i) => { $(fieldIds[i]).value = String(p.valueMM); });
    $('body-volume').textContent = `${accepted.evaluation.solidReport.volumeMM3} mm³`;
    $('body-area').textContent = `${accepted.evaluation.solidReport.areaMM2} mm²`;
    $('body-name').textContent = accepted.document.feature.bodyId;
    const bounds = accepted.evaluation.solidReport.boundsMM;
    $('body-bounds').textContent = bounds.min.join(', ') + ' → ' + bounds.max.join(', ');
  }
  $('body-update').disabled = !accepted || unavailable;
  $('body-save').disabled = !accepted;
}
function packetFor(result, nextRevision) {
  const evaluation = result.evaluation;
  const packet = { version: 0, surfaceId: evaluation.construction.outputBodyId, revision: nextRevision,
    lengthUnit: 'mm', coordinateSystem: 'right-handed-y-up', winding: 'ccw',
    positions: [], normals: [], indices: [], parameters: [],
    bounds: structuredClone(evaluation.solidReport.boundsMM) };
  for (const [i, bundle] of evaluation.faces.entries()) {
    const surface = evaluation.model.objects.find(object => object.kind === 'surface' && object.id === bundle.topology.face.surfaceId);
    if (!surface) throw Error('Compiled native face identity is missing.');
    const { packet: face } = cad.tessellateSurface(surface, { countU: 2, countV: 2, revision: nextRevision });
    cad.validatePreviewPacket(face);
    packet.positions.push(...face.positions); packet.normals.push(...face.normals);
    packet.parameters.push(...face.parameters); packet.indices.push(...face.indices.map(index => index + i * 4));
  }
  cad.validatePreviewPacket(packet);
  return packet;
}
function optionsFor(packet) {
  const sides = packet.bounds.max.map((value, i) => value - packet.bounds.min[i]);
  const scale = 3 / Math.max(...sides);
  return { mmToSceneUnit: scale, translate: packet.bounds.min.map((value, i) => -(value + sides[i] / 2) * scale),
    color: [.32, .72, .66], background: [.063, .094, .125], camera: structuredClone(renderer?.options.camera ?? camera) };
}
function bind(nextCanvas) {
  orbit?.dispose(); canvas = nextCanvas; unavailable = false;
  canvas.addEventListener('webglcontextlost', () => { if (canvas !== nextCanvas || disposed) return; unavailable = true; refreshButtons(); message('View unavailable. Recover the view to continue.'); });
  orbit = bindMouseOrbit(canvas, {
    get available() { return Boolean(renderer) && !unavailable && !disposed; },
    snapshot: () => accepted && { options: renderer.options, viewRevision },
    setCamera(nextCamera) {
      const result = renderer.update(renderer.packet, { ...renderer.options, camera: nextCamera });
      if (result.ok) viewRevision++;
      return result;
    },
  });
}
function refreshButtons() {
  for (const id of ['body-create', 'body-update']) $(id).disabled = opening || unavailable;
  $('body-update').disabled ||= !accepted;
  $('body-open').disabled = opening;
  $('body-edges').disabled = unavailable || disposed || !accepted;
  for (const id of fieldIds) $(id).disabled = opening;
  $('body-save').disabled = opening || !accepted;
}
function adopt(document) {
  if (disposed || unavailable || opening) return { ok: false, error: 'View unavailable or a file is opening.' };
  try {
    const result = cad.evaluateAxisRectangleFeatureDocument(document);
    const sizes = result.document.parameters.map(parameter => parameter.valueMM);
    if (sizes.slice(0, 2).some(value => Math.abs(value) > 300) || sizes.slice(2).some(value => value < 1 || value > 300)) throw Error('Outside prototype dimension limits.');
    const packet = packetFor(result, revision + 1), options = optionsFor(packet);
    const edges = edgesEnabled ? bodyEdges(result.evaluation, packet, cad) : null;
    if (renderer) {
      const update = renderer.update(packet, options, edges?.overlay ?? null);
      if (!update.ok) throw update.error;
    } else {
      const [width, height] = dimensions();
      const next = $('body-preview'); next.width = width; next.height = height;
      renderer = gpu.mountMesh(next, packet, options, edges?.overlay ?? null); bind(next);
    }
    accepted = { ...result, edgeLineage: edges?.lineage ?? null, lineage: { sourceVersion: 2, source: result.evaluation.source, bodyId: result.document.feature.bodyId,
      faces: result.evaluation.faces.map((face, i) => ({ faceId: face.topology.face.id, surfaceId: face.topology.face.surfaceId, vertexStart: i * 4, vertexCount: 4, indexStart: i * 6, indexCount: 6 })) } }; revision++; viewRevision++;
    refresh(); refreshButtons(); message('Box updated. Drag the canvas to rotate.');
    return { ok: true };
  } catch (error) {
    message('Cannot apply this box. Use integer sizes 1–300 mm and origins within ±300 mm.');
    return { ok: false, error: error.message };
  }
}
function applyValues(create = false) {
  try {
    const edits = values().map((valueMM, i) => ({ parameterId: parameterIds[i], valueMM }));
    const result = cad.editAxisRectangleFeatureDocument(create || !accepted ? initial : accepted.document, edits);
    return adopt(result.document);
  } catch (error) { message('Cannot apply this box. Use integer sizes 1–300 mm and origins within ±300 mm.'); return { ok: false, error: error.message }; }
}
function download(text, type, filename) {
  const url = URL.createObjectURL(new Blob([text], { type })), anchor = document.createElement('a');
  anchor.href = url; anchor.download = filename; anchor.click(); setTimeout(() => URL.revokeObjectURL(url), 0);
}
function activate() {
  const active = location.hash === '#box';
  $('body-workspace').hidden = !active; $('surface-workspace').hidden = active;
  if (active && !accepted) adopt(initial);
  if (active && renderer && !unavailable) renderer.resize(...dimensions());
}
$('body-shape').addEventListener('change',()=>{if($('body-shape').value!=='workspace-box')location.href='/#'+$('body-shape').value;});
$('body-create').addEventListener('click', () => applyValues(true));
$('body-update').addEventListener('click', () => applyValues());
$('body-discard').addEventListener('click', () => { refresh(); message('Pending dimensions discarded.'); });
$('body-edges').addEventListener('change', () => {
  if (!accepted || unavailable || disposed) return;
  try {
    const enabled = $('body-edges').checked;
    const edges = enabled ? bodyEdges(accepted.evaluation, renderer.packet, cad) : null;
    const result = renderer.setEdgeOverlay(edges?.overlay ?? null);
    if (!result.ok) throw result.error;
    edgesEnabled = enabled; accepted.edgeLineage = edges?.lineage ?? null; viewRevision++;
    message(enabled ? 'Original CAD edges shown.' : 'Original CAD edges hidden.');
  } catch { $('body-edges').checked = edgesEnabled; message('Cannot change edge display. The accepted view is retained.'); }
});
for (const id of fieldIds) $(id).addEventListener('input', () => message(dirty() ? 'Dimensions pending. Apply to update the box.' : 'Box dimensions unchanged.'));
$('body-save').addEventListener('click', () => {
  if (!accepted) return;
  download(cad.serializeAxisRectangleFeatureDocument(accepted.document), 'application/json', accepted.document.feature.bodyId + '.feature.json');
  message(dirty() ? 'Saved the applied box. Pending dimensions were not saved.' : 'Box document saved.');
});
$('body-open').addEventListener('change', async () => {
  const file = $('body-open').files[0];
  try {
    if (!file) return;
    if (dirty()) throw Error('Apply or discard pending dimensions before opening a file.');
    if (opening || file.size > 64 * 1024) throw Error('Choose one saved box document smaller than 64 KiB.');
    opening = true; refreshButtons();
    const text = new TextDecoder('utf-8', { fatal: true }).decode(await file.arrayBuffer());
    const record = JSON.parse(text);
    // The native evaluator admits the exact original document and rebuilds its geometry.
    const prepared = cad.evaluateAxisRectangleFeatureDocument(record);
    opening = false;
    const result = adopt(prepared.document);
    if (!result.ok) throw Error(result.error);
    message('Box document opened. Dimensions and geometry rebuilt.');
  } catch (error) { message('Open rejected. ' + (dirty() ? 'Apply or discard pending dimensions first.' : 'Choose a valid saved box document.')); }
  finally { opening = false; $('body-open').value = ''; refreshButtons(); }
});
$('body-recover').addEventListener('click', () => {
  if (!accepted || disposed) return;
  const next = document.createElement('canvas'); next.id = 'body-preview'; next.tabIndex = 0; next.setAttribute('aria-label', 'Box preview. Drag with the left mouse button to rotate.');
  [next.width, next.height] = dimensions();
  try {
    const packet = packetFor(accepted, revision), edges = edgesEnabled ? bodyEdges(accepted.evaluation, packet, cad) : null;
    const nextRenderer = gpu.mountMesh(next, packet, optionsFor(packet), edges?.overlay ?? null);
    const previous = renderer, previousCanvas = canvas; canvas.replaceWith(next); renderer = nextRenderer; bind(next); previous?.dispose();
    previousCanvas.getContext('webgl2')?.getExtension('WEBGL_lose_context')?.loseContext();
    refreshButtons(); message('View recovered. Box document retained.');
  } catch { message('Cannot recover the view. The box document is retained.'); }
});
addEventListener('hashchange', activate);
addEventListener('resize', () => { if (!disposed && renderer && !unavailable && !$('body-workspace').hidden) renderer.resize(...dimensions()); });
addEventListener('pagehide', () => { disposed = true; orbit?.dispose(); renderer?.dispose(); }, { once: true });
window.boxWorkspace = {
  applyValues, loadDocument: document => adopt(document),
  snapshot: () => accepted && structuredClone({ ...accepted, packet: renderer.packet, options: renderer.options, edgeOverlay: renderer.edgeOverlay, revision, viewRevision }),
  readPixels: () => renderer.readPixels(), get renderer() { return renderer; },
};
activate();
