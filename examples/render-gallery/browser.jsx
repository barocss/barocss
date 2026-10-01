import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Renderer, validateSpec, classesFor } from '@barocss/render';
import { PRESET } from './preset.mjs';

let mounted = null;
let controller = null;
let lastSnapshot = { sample: null, input: null, actions: [], error: '', preset: PRESET.id };
const copy = (value) => structuredClone(value);
const read = (state, path) => path.slice(1).split('/').reduce((value, key) =>
  value && Object.hasOwn(value, key) ? value[key] : undefined, state);
function write(state, path, text) {
  const result = copy(state), parts = path.slice(1).split('/');
  let cursor = result;
  for (const part of parts.slice(0, -1)) cursor = cursor[part];
  cursor[parts.at(-1)] = text;
  return result;
}
function checkRecord(record) {
  if (!record || record.version !== 1 || record.preset !== PRESET.id) throw new Error('Unsupported gallery record or preset');
  const checked = validateSpec(record.spec, record.contract);
  if (!checked.ok) throw new Error(`Invalid sample: ${checked.errors[0].path}`);
  for (const path of record.contract.textBindings) {
    const value = read(record.initialState, path);
    if (typeof value !== 'string' || value.length > 80) throw new Error('Initial text binding is missing or too long');
  }
  return record;
}
const sourceText = (source, label) => `${label ?? (source?.kind === 'model-derived' ? 'model-derived · unverified' : source?.kind ?? 'unverified')} · ${source?.sha ?? source?.sourceSha ?? 'SHA unavailable'}`;
const viewportText = (viewport) => typeof viewport === 'string' ? viewport : `${viewport?.width ?? '?'} × ${viewport?.height ?? '?'}`;
function JSONPanel({ title, value }) {
  return <section className="min-w-0"><h3>{title}</h3><pre className="max-w-full overflow-x-auto whitespace-pre-wrap break-words text-sm">{JSON.stringify(value, null, 2)}</pre></section>;
}
function Application({ resources }) {
  const [index, setIndex] = useState(null), [sample, setSample] = useState(null);
  const [input, setInput] = useState(null), [actions, setActions] = useState([]), [error, setError] = useState('');
  const [search, setSearch] = useState(''), [category, setCategory] = useState('all');
  const latest = useRef({ sample, input, actions, error }); latest.current = { sample, input, actions, error };
  lastSnapshot = { sample: sample ? { id: sample.id, revision: sample.revision, source: sample.source } : null,
    input, actions, error, preset: PRESET.id };
  const capture = new URLSearchParams(location.search).get('capture') === '1';
  useEffect(() => {
    let stopped = false, epoch = 0;
    const aborts = new Set();
    async function fetchJSON(path) {
      const abort = new AbortController(); aborts.add(abort);
      try {
        const response = await fetch(path, { signal: abort.signal });
        const value = await response.json();
        if (!response.ok) throw new Error(value.error ?? 'Gallery request failed');
        return value;
      } finally { aborts.delete(abort); }
    }
    async function select(id, revision) {
      const ticket = ++epoch;
      try {
        if (typeof id !== 'string' || !/^[a-z][a-z0-9-]{0,63}$/.test(id)
          || !Number.isSafeInteger(Number(revision)) || Number(revision) < 1) throw new Error('Invalid sample selection');
        const next = checkRecord(await fetchJSON(`/api/sample/${encodeURIComponent(id)}/${Number(revision)}`));
        if (stopped || ticket !== epoch) return false;
        setSample(next); setInput(copy(next.initialState)); setActions([]); setError('');
        latest.current = { sample: next, input: copy(next.initialState), actions: [], error: '' };
        return true;
      } catch (failure) {
        if (!stopped && ticket === epoch) setError(failure.message);
        return false;
      }
    }
    controller = { select };
    const stop = () => { stopped = true; epoch++; for (const abort of aborts) abort.abort(); controller = null; };
    resources.stop = stop;
    fetchJSON('/api/index').then(async (value) => {
      if (stopped) return;
      if (value.version !== 1 || !Array.isArray(value.samples)) throw new Error('Invalid gallery index');
      setIndex(value);
      const query = new URLSearchParams(location.search);
      if (query.has('sample')) await select(query.get('sample'), query.get('revision') ?? 1);
      else if (value.samples.length) await select(value.samples[0].id, value.samples[0].revision);
    }).catch((failure) => { if (!stopped) setError(failure.message); });
    return stop;
  }, [resources]);
  const registry = useRef(null);
  if (!registry.current) registry.current = {
    Layout: ({ node, children }) => <section data-node-id={node.props.id} className={classesFor(node)}>{children}</section>,
    Card: ({ node, children }) => <article data-node-id={node.props.id} className={classesFor(node)}>{children}</article>,
    Text: ({ node }) => <p data-node-id={node.props.id} className={PRESET.styles.Text}>{node.props.text}</p>,
    Input: ({ node, state, setState }) => <label className="block min-w-0">{node.props.label}<input
      data-node-id={node.props.id} aria-label={node.props.label} className={PRESET.styles.Input}
      value={read(state, node.props.value.$bindState)} maxLength={80}
      onChange={(event) => { const text = event.target.value.slice(0, 80); setState((old) => write(old, node.props.value.$bindState, text)); }} /></label>,
    Button: ({ node, onAction }) => <button type="button" data-node-id={node.props.id}
      className={PRESET.styles.Button} onClick={onAction}>{node.props.label}</button>,
  };
  const handlers = Object.fromEntries((sample?.contract.actions ?? []).map((name) => [name, () => {
    const action = { name, input: copy(latest.current.input) };
    setActions((old) => [...old, action]);
  }]));
  const samples = (index?.samples ?? []).filter((item) => (category === 'all' || item.category === category)
    && `${item.title} ${item.id} ${item.category} ${(item.tags ?? []).join(' ')}`.toLowerCase().includes(search.toLowerCase()));
  return <main className={`${PRESET.styles.shell} min-w-0 max-w-full`}>
    {!capture && <><header><h1>BaroCSS render design gallery</h1><p>Local authored specimens · five supported components · no model calls</p></header>
      <section aria-label="Gallery filters" className="flex flex-wrap gap-3">
        <label>Search samples<input aria-label="Search samples" className={PRESET.styles.Input} value={search} onChange={(event) => setSearch(event.target.value)} /></label>
        <label>Category<select aria-label="Category" value={category} onChange={(event) => setCategory(event.target.value)}>
          <option value="all">All categories</option>{[...new Set((index?.samples ?? []).map((item) => item.category))].map((item) => <option key={item} value={item}>{item}</option>)}</select></label>
      </section>
      <nav aria-label="Samples" className="grid grid-cols-1 md:grid-cols-2 gap-3 my-4">
        {samples.map((item) => <button key={`${item.id}-${item.revision}`} type="button" className="min-w-0 text-left border rounded p-3"
          aria-pressed={sample?.id === item.id && sample?.revision === item.revision} onClick={() => controller?.select(item.id, item.revision)}>
          {item.captures?.[0]?.url && <img className="max-w-full h-auto" src={item.captures[0].url} alt={`${item.title} actual browser capture`} />}
          <strong>{item.title}</strong><span className="block">{item.category} · {item.id} revision {item.revision}</span><span className="block break-words">{sourceText(item.source, item.sourceLabel)}</span>
        </button>)}
      </nav></>}
    {error && <p role="alert">{error}</p>}
    {sample && <section className="min-w-0" aria-label="Selected sample">
      {!capture && <><h2>{sample.title}</h2><p className="break-words">{sourceText(sample.source, sample.sourceLabel)}</p>
        <p>Host preset: {PRESET.id} — {PRESET.description}</p><p>Layout/Card enum choices belong to the Spec. Typography and controls belong to the fixed host preset.</p></>}
      <div id="preview" className="min-w-0 max-w-full"><Renderer spec={sample.spec} contract={sample.contract}
        components={registry.current} state={input} setState={setInput} actions={handlers} /></div>
      {!capture && <><h3>Actual browser captures</h3><div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {(sample.captures ?? []).map((item) => <figure className="min-w-0" key={`${item.batch}-${item.url}`}>
          <img className="max-w-full h-auto" src={item.url} alt={`${sample.title}, ${viewportText(item.viewport)}, actual browser capture`} />
          <figcaption className="break-words">{viewportText(item.viewport)} · capture SHA {item.sourceSha ?? 'unavailable'} · image digest {item.imageDigest} · batch {item.batch}</figcaption>
        </figure>)}
      </div><JSONPanel title="Exact screen JSON" value={sample.spec} /><JSONPanel title="Host contract" value={sample.contract} />
        <JSONPanel title="Synthetic initial state" value={sample.initialState} /><JSONPanel title="Current input and named local actions" value={{ input, actions }} />
        <JSONPanel title="Source provenance" value={sample.source} /><JSONPanel title="Host preset" value={PRESET} />
        <h3>Support limits</h3><ul>{[...(sample.limitations ?? []), ...(PRESET.limitations ?? [])].map((limit, position) => <li key={position}>{limit}</li>)}</ul></>}
    </section>}
    {!capture && <section aria-label="Unsupported requests"><h2>Unsupported requests</h2>
      <ul>{(index?.unsupported ?? []).map((item) => <li key={item.type}><strong>{item.type}</strong>: {item.reason} No renderer preview.</li>)}</ul></section>}
  </main>;
}
function mount() {
  if (mounted) return;
  const nonce = document.querySelector('meta[name="barocss-nonce"]')?.content;
  const runtime = new window.BaroCSS.BrowserRuntime({ nonce, constructable: false, skipExisting: false,
    styleId: 'render-gallery-owned', gc: false });
  runtime.observe(document.body, { scan: true });
  const root = createRoot(document.getElementById('app'));
  mounted = { runtime, root, stop: null };
  root.render(<Application resources={mounted} />);
}
function dispose() {
  if (!mounted) return;
  mounted.stop?.(); mounted.root.unmount(); mounted.runtime.destroy(); mounted = null;
}
const unload = () => dispose();
window.GALLERY = {
  async select(id, revision) { return controller ? controller.select(id, revision) : false; },
  snapshot() { return copy(lastSnapshot); },
  dispose() { window.removeEventListener('pagehide', unload); dispose(); },
  mount() { window.addEventListener('pagehide', unload); mount(); },
};
window.addEventListener('pagehide', unload);
mount();
