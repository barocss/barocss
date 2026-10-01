import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Renderer, classesFor } from '@barocss/render';

let mounted = null;
const diagnostics = { polls: 0, displays: [], stopped: true, runtimeDestroyed: true };
function mount() {
  if (mounted) return;
  const nonce = document.querySelector('meta[name="barocss-nonce"]').content;
  // This host owns a dedicated runtime, not the shared getRuntime singleton.
  const runtime = new window.BaroCSS.BrowserRuntime({ nonce, constructable: false,
    skipExisting: false, styleId: 'ai-ui-owned', gc: false });
  runtime.observe(document.body, { scan: true });
  diagnostics.stopped = false; diagnostics.runtimeDestroyed = false;
  const root = createRoot(document.getElementById('app'));
  const resources = { runtime, root, stop: null };
  mounted = resources;
  root.render(<Application resources={resources} />);
}
function dispose() {
  if (!mounted) return;
  mounted.stop?.(); mounted.root.unmount(); mounted.runtime.destroy();
  diagnostics.runtimeDestroyed = mounted.runtime.getStats().isDestroyed;
  diagnostics.stopped = true; mounted = null;
}

function Application({ resources }) {
  const [state, setState] = useState(null), [mode, setMode] = useState('Connecting'), [contract, setContract] = useState(null);
  const [screenRequest, setScreenRequest] = useState('Create a request form');
  const [draft, setDraft] = useState({ draft: { name: '민지', topic: '커피' } });
  const [error, setError] = useState('');
  const latest = useRef({ state: null, draft, screenRequest, token: null });
  latest.current = { ...latest.current, state, draft, screenRequest };
  const api = useRef(null);
  const userActionSent = useRef(null);
  useEffect(() => {
    let disposed = false, epoch = 0, timer = null, lastRevision = -1;
    const aborts = new Set();
    const fetchJSON = async (path, body) => {
      const abort = new AbortController(); aborts.add(abort);
      try {
        const result = await fetch(path, { method: body === undefined ? 'GET' : 'POST',
          headers: { 'x-session-token': latest.current.token ?? '', 'content-type': 'application/json' },
          body: body === undefined ? undefined : JSON.stringify(body), signal: abort.signal });
        const value = await result.json(); if (!result.ok) throw new Error(value.error ?? 'Request rejected');
        return value;
      } finally { aborts.delete(abort); }
    };
    const accept = (next, ticket) => {
      if (disposed || ticket !== epoch || next.revision < lastRevision) return;
      if (next.revision > lastRevision) {
        lastRevision = next.revision;
        if (next.spec) { setDraft(next.input); setScreenRequest(next.screenRequest); }
        if (next.phase === 'idle') { setDraft({ draft: { name: '민지', topic: '커피' } }); setScreenRequest('Create a request form'); }
      }
      setState(next);
    };
    const poll = async () => {
      const ticket = epoch;
      try { diagnostics.polls++; accept(await fetchJSON('/api/state'), ticket); }
      catch { if (!disposed && ticket === epoch) setError('State connection failed'); }
      if (!disposed) timer = setTimeout(poll, 80);
    };
    let busy = false;
    api.current = async (path, body, saveInput = false) => {
      if (disposed || busy) return;
      busy = true; const ticket = ++epoch; setError('');
      try {
        if (saveInput) {
          const current = latest.current;
          await fetchJSON('/api/input', { sessionId: current.state.sessionId, revision: current.state.revision, input: current.draft });
        }
        await fetchJSON(path, body);
        accept(await fetchJSON('/api/state'), ticket);
      } catch (failure) { if (!disposed) setError(failure.message); }
      finally { busy = false; }
    };
    const stop = () => { disposed = true; epoch++; clearTimeout(timer); for (const abort of aborts) abort.abort(); api.current = null; };
    resources.stop = stop;
    fetchJSON('/api/session').then((session) => {
      if (disposed) return;
      latest.current.token = session.token; setMode(session.mode); setContract(session.contract); return poll();
    }).catch(() => { if (!disposed) setError('Session connection failed'); });
    return stop;
  }, [resources]);
  useEffect(() => {
    if (!state?.spec || state.phase !== 'ready') return;
    const frame = requestAnimationFrame(() => {
      const elements = [...document.querySelectorAll('[data-node-id]')];
      const findElement = (id) => elements.find((element) => element.dataset.nodeId === id);
      const root = findElement(state.spec.root);
      const theme = getComputedStyle(document.documentElement);
      const rem = parseFloat(theme.fontSize);
      const colorParts = (color) => color.match(/[\d.]+%?/g)?.map((part) => parseFloat(part) / (part.endsWith('%') ? 100 : 1));
      const darkColor = colorParts(theme.getPropertyValue('--color-slate-900'));
      const useful = Object.values(state.spec.elements).every((node) => {
        const element = findElement(node.props.id);
        if (!element) return false;
        if (node.type === 'Text') return element.textContent === node.props.text;
        if (node.type === 'Button') return element.textContent === node.props.label;
        if (node.type === 'Input') return element.value === latest.current.draft.draft[node.props.value.$bindState === '/draft/name' ? 'name' : 'topic'];
        const style = getComputedStyle(element);
        if (element.getBoundingClientRect().height <= 0) return false;
        if (node.type === 'Layout') {
          const gap = (node.props.gap === 'fractional' ? 0.625 : 0.875) * rem;
          const columns = node.props.columns === 'responsive' && window.innerWidth >= 768 ? 2 : 1;
          return style.display === 'grid' && Math.abs(parseFloat(style.gap) - gap) < 0.1
            && style.gridTemplateColumns.split(' ').length === columns;
        }
        if (node.type === 'Card') {
          const padding = (node.props.padding === 'fractional' ? 0.875 : 1.375) * rem;
          const actualColor = colorParts(style.backgroundColor);
          const backgroundMatches = node.props.tone === 'light' ? style.backgroundColor === 'rgb(255, 255, 255)'
            : style.backgroundColor.startsWith('oklch(') && actualColor?.length === 3 && darkColor?.length === 3
              && actualColor.every((value, index) => Math.abs(value - darkColor[index]) < 0.001);
          return Math.abs(parseFloat(style.paddingTop) - padding) < 0.1 && backgroundMatches;
        }
        return false;
      });
      if (useful && root && root.getBoundingClientRect().height > 0
        && !diagnostics.displays.some((record) => record.revision === state.revision && record.sessionId === state.sessionId))
        diagnostics.displays.push({ sessionId: state.sessionId, revision: state.revision, stage: state.stage,
          generationMs: state.timings.generationMs, validationMs: state.timings.validationMs,
          firstVisibleStyledMs: performance.now(), source: mode,
          userActionSent: userActionSent.current,
          observation: { ...state.observation,
            firstUsefulPresentation: { value: performance.now(), clock: 'browser-navigation-monotonic-ms' } },
          presentation: 'requestAnimationFrame plus useful content/style checks; physical paint not observed' });
    });
    return () => cancelAnimationFrame(frame);
  }, [state, mode]);
  const pending = ['generating', 'action-pending'].includes(state?.phase);
  const sendAction = (action) => {
    userActionSent.current = { value: performance.now(), clock: 'browser-navigation-monotonic-ms' };
    const current = latest.current;
    api.current?.('/api/action', { sessionId: current.state.sessionId, revision: current.state.revision, action }, current.state.stage === 'form');
  };
  const pendingRef = useRef(pending); pendingRef.current = pending;
  // Components read the pending flag through this host ref; their identity stays stable.
  const registry = useRef(null);
  if (!registry.current) registry.current = {
    Layout: ({ node, children }) => <section data-node-id={node.props.id} className={classesFor(node)}>{children}</section>,
    Card: ({ node, children }) => <article data-node-id={node.props.id} className={classesFor(node)}>{children}</article>,
    Text: ({ node }) => <p data-node-id={node.props.id}>{node.props.text}</p>,
    Input: ({ node, state: values, setState: setValues }) => {
      const field = node.props.value.$bindState === '/draft/name' ? 'name' : 'topic';
      return <label>{node.props.label}<input aria-label={`Request ${field}`} data-node-id={node.props.id}
        maxLength={80} disabled={pendingRef.current} value={values.draft[field]} onChange={(event) => {
          const value = event.target.value; setValues((old) => ({ draft: { ...old.draft, [field]: value } }));
        }} /></label>;
    },
    Button: ({ node, onAction }) => <button data-node-id={node.props.id} disabled={pendingRef.current} onClick={onAction}>{node.props.label}</button>,
  };
  return <main className="min-h-screen bg-slate-100 p-4">
    <h1>BaroCSS request UI</h1><p id="mode">Data source: {mode} {mode === 'codex-cli' ? '(actual Codex CLI)' : mode === 'codex-cli-fake' ? '(fake process; no model)' : '(no model)'}</p>
    <label>Screen request<textarea aria-label="Screen request" maxLength={300} disabled={state?.phase !== 'idle'}
      value={screenRequest} onChange={(event) => setScreenRequest(event.target.value)} /></label>
    <header><button disabled={!state || state.phase !== 'idle'} onClick={() => { userActionSent.current = null; api.current?.('/api/start', { screenRequest: latest.current.screenRequest, input: latest.current.draft }); }}>Generate</button>
      <button disabled={!pending} onClick={() => api.current?.('/api/cancel', {})}>Cancel</button>
      <button disabled={!state} onClick={() => { userActionSent.current = null; api.current?.('/api/restart', {}); }}>Restart</button></header>
    <p role="status" data-phase={state?.phase ?? 'connecting'} data-revision={state?.revision ?? 0}>{state?.phase ?? 'connecting'} · revision {state?.revision ?? 0}</p>
    {(error || state?.error) && <p role="alert">{error || state.error}</p>}
    {state?.spec && contract && <Renderer spec={state.spec} contract={contract} components={registry.current}
      state={draft} setState={setDraft} actions={{ review: () => sendAction('review'), edit: () => sendAction('edit'), confirm: () => sendAction('confirm') }} />}
  </main>;
}
const unload = () => dispose();
window.addEventListener('pagehide', unload);
window.AI_UI = { dispose() { window.removeEventListener('pagehide', unload); dispose(); },
  mount() { window.addEventListener('pagehide', unload); mount(); },
  diagnostics: () => structuredClone(diagnostics) };
mount();
