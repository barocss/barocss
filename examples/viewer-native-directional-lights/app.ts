import { createLightEditorController } from './controller.js';

function element<T extends HTMLElement>(id: string): T {
  const value = document.getElementById(id);
  if (!value) throw new Error('Missing example element: ' + id);
  return value as T;
}
const canvas = element<HTMLCanvasElement>('viewport');
const editor = createLightEditorController(canvas, { width: 800, height: 600 });
const input = (id: string) => element<HTMLInputElement>(id);
const select = (id: string) => element<HTMLSelectElement>(id);
const cleanups = new Set<() => void>();
let localError = '', disposed = false;
const describe = (error: unknown) => error instanceof Error ? `${error.name}: ${error.message}` : 'Operation refused; see console for original diagnostic';
function finite(id: string): number {
  const text = input(id).value.trim();
  if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:e[+-]?\d+)?$/i.test(text)) throw new TypeError(id + ' must be a finite decimal number');
  const value = Number(text); if (!Number.isFinite(value)) throw new TypeError(id + ' must be finite'); return value;
}
function run(action: () => unknown) {
  localError = '';
  try { Promise.resolve(action()).catch(error => { localError = describe(error); console.error(error); }).finally(render); }
  catch (error) { localError = describe(error); console.error(error); render(); }
}
function listen(target: EventTarget, name: string, action: (event: Event) => unknown) {
  const listener = (event: Event) => run(() => action(event));
  target.addEventListener(name, listener); cleanups.add(() => target.removeEventListener(name, listener));
}
function setNumber(id: string, value: number) { input(id).value = Object.is(value, -0) ? '-0' : String(value); }
function render() {
  const state = editor.state, ready = !!state.accepted && !state.closed, enabled = ready && !state.pending;
  const light = state.draft?.lights.find(item => item.nodeId === state.selectedLightId);
  element('status').textContent = state.closed ? 'Disposed' : state.pending ? 'Working… controls are locked until the operation completes' : state.status ? JSON.stringify(state.status) : 'Not started. A WebGPU-capable browser/device is required.';
  element('error').textContent = localError || (state.error ? describe(state.error) : '');
  element<HTMLButtonElement>('start').disabled = !!state.accepted || state.pending || state.closed;
  element<HTMLButtonElement>('dispose').disabled = state.closed;
  for (const id of ['lights','add','remove','apply','ambient','surfaces','save','open','resize']) {
    (element(id) as HTMLInputElement | HTMLButtonElement | HTMLSelectElement).disabled = !enabled;
  }
  element<HTMLFieldSetElement>('size-controls').disabled = !enabled;
  element<HTMLButtonElement>('add').disabled = !enabled || (state.draft?.lights.length ?? 0) >= 4;
  element<HTMLButtonElement>('remove').disabled = !enabled || !light;
  element<HTMLFieldSetElement>('light-fields').disabled = !enabled || !light;
  const lightSelect = select('lights');
  lightSelect.replaceChildren(...(state.draft?.lights ?? []).map(item => new Option(`${item.label} · ${item.nodeId}${item.enabled ? '' : ' (disabled)'}`, item.nodeId)));
  lightSelect.value = state.selectedLightId ?? '';
  element('count').textContent = `${state.draft?.lights.length ?? 0} / 4 slots (disabled entries included)`;
  if (state.draft) setNumber('ambient', state.draft.ambientStrength);
  if (light) {
    input('label').value = light.label; input('enabled').checked = light.enabled;
    ['dx','dy','dz'].forEach((id, index) => setNumber(id, light.directionScene[index]));
    ['r','g','b'].forEach((id, index) => setNumber(id, light.colorLinearRGB[index])); setNumber('intensity', light.intensity);
  }
  const surfaceSelect = select('surfaces');
  surfaceSelect.replaceChildren(new Option('No selection', ''), ...(state.accepted?.visibleGeometry ?? []).map((ref, index) =>
    new Option(`${ref.modelId} / ${ref.kind === 'surface' ? ref.surfaceId : ref.curveId}`, String(index))));
  const selectedIndex = state.accepted?.visibleGeometry.findIndex(ref => JSON.stringify(ref) === JSON.stringify(state.selected)) ?? -1;
  surfaceSelect.value = selectedIndex < 0 ? '' : String(selectedIndex);
  const binding = state.accepted?.bindings.find(item => JSON.stringify(item.ref) === JSON.stringify(state.selected))?.binding ?? null;
  element('identity').textContent = state.accepted ? JSON.stringify({ owner: state.accepted.owner, document: state.accepted.document,
    generation: state.accepted.generation, selected: state.selected, TEN: binding }, null, 2) : 'No accepted scene';
}
listen(element('start'), 'click', () => editor.start());
listen(select('lights'), 'change', () => editor.selectLight(select('lights').value));
listen(element('add'), 'click', () => editor.add());
listen(element('remove'), 'click', () => { const id = editor.state.selectedLightId; if (id) editor.remove(id); });
function editFields() {
  const id = editor.state.selectedLightId; if (!id) return;
  editor.edit(id, { label: input('label').value, enabled: input('enabled').checked,
    directionScene: [finite('dx'), finite('dy'), finite('dz')], colorLinearRGB: [finite('r'), finite('g'), finite('b')], intensity: finite('intensity') });
}
for (const id of ['label','enabled','dx','dy','dz','r','g','b','intensity']) listen(input(id), 'change', editFields);
listen(input('ambient'), 'change', () => editor.ambient(finite('ambient')));
listen(element('apply'), 'click', () => { editFields(); editor.ambient(finite('ambient')); return editor.apply(); });
listen(select('surfaces'), 'change', () => {
  const value = select('surfaces').value;
  editor.selectSurface(value === '' ? null : editor.state.accepted!.visibleGeometry[Number(value)]);
});
listen(canvas, 'click', event => {
  if (editor.state.pending || !editor.state.accepted || editor.state.closed) return;
  const pointer = event as MouseEvent, bounds = canvas.getBoundingClientRect();
  if (bounds.width <= 0 || bounds.height <= 0) return;
  const x = Math.floor((pointer.clientX - bounds.left) * canvas.width / bounds.width);
  const y = Math.floor((pointer.clientY - bounds.top) * canvas.height / bounds.height);
  if (x >= 0 && y >= 0 && x < canvas.width && y < canvas.height) return editor.pick(x, y);
});
listen(element('resize'), 'click', () => editor.resize(finite('width'), finite('height')));
listen(input('open'), 'change', () => { const file = input('open').files?.[0]; input('open').value = ''; if (file) return editor.open(file); });
listen(element('save'), 'click', () => {
  const text = editor.save(), url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
  const link = document.createElement('a'); link.href = url; link.download = 'native-directional-lights.json';
  let timer: number | undefined, released = false;
  const release = () => {
    if (released) return; released = true;
    if (timer !== undefined) window.clearTimeout(timer);
    try { URL.revokeObjectURL(url); } finally { cleanups.delete(release); link.remove(); }
  };
  cleanups.add(release);
  try {
    document.body.append(link); link.click(); link.remove();
    timer = window.setTimeout(release, 1000);
  } catch (error) { release(); throw error; }
});
function dispose() {
  if (disposed) return; disposed = true;
  const failures: unknown[] = [];
  try { editor.dispose(); } catch (error) { failures.push(error); }
  for (const cleanup of [...cleanups]) { try { cleanup(); } catch (error) { failures.push(error); } }
  cleanups.clear(); render();
  if (failures.length) throw new AggregateError(failures, 'Example cleanup failed');
}
listen(element('dispose'), 'click', dispose);
listen(window, 'pagehide', dispose);
cleanups.add(editor.subscribe(render));
render();
