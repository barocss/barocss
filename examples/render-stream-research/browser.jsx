import React, { useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { Renderer, classesFor, validateSpec } from './.build/render-api.mjs';
import { createJsonlDecoder } from './protocol.mjs';

const sheet = document.createElement('style');
sheet.nonce = document.querySelector('meta[name="nonce"]').content;
sheet.id = 'compiled-sheet'; document.head.append(sheet);
const root = createRoot(document.getElementById('app'));
let api;

function App() {
  const [screen, setScreen] = useState(null), [phase, setPhase] = useState('idle');
  const [draft, setDraft] = useState({ name: '민지' }), [ready, setReady] = useState(false);
  const [error, setError] = useState(''), [saved, setSaved] = useState('');
  const [used, setUsed] = useState(false), [saving, setSaving] = useState(false);
  const host = useRef({ epoch: 0, abort: null, committed: null, config: null, trace: [] });
  host.current.live = { screen, phase, draft, used, saving };
  const h = host.current;
  const trace = (kind, fields = {}) => h.trace.push({ kind, at: performance.now(), ...fields });
  const json = async (url, body) => {
    const response = await fetch(url, { method: 'POST', headers: {
      'content-type': 'application/json', 'x-session-token': h.config.token,
    }, body: JSON.stringify(body) });
    return { status: response.status, value: await response.json() };
  };
  const apply = (record, nextPhase) => {
    // Both mutations occur in this task. This does not promise physical-paint atomicity.
    sheet.textContent = record?.css ?? '';
    flushSync(() => { setScreen(record); setPhase(nextPhase); });
    const card = document.querySelector('[data-node-id="card"]');
    const layout = document.querySelector('[data-node-id="root"]');
    const style = card && getComputedStyle(card);
    trace('visible', { seq: record?.seq, phase: nextPhase, streamId: record?.streamId,
      display: layout && getComputedStyle(layout).display,
      gap: layout && getComputedStyle(layout).gap, padding: style?.padding,
      background: style?.backgroundColor,
      text: document.querySelector('[data-node-id="title"]')?.textContent ?? '' });
  };
  const restore = (nextPhase) => apply(h.committed, nextPhase);
  const cancel = () => {
    h.epoch++; h.abort?.abort(); h.abort = null;
    restore('cancelled'); trace('cancelled');
  };
  const start = async ({ mode = 'stream', tone = 'light', broken = false } = {}) => {
    if (!h.config) throw new Error('Host is not ready');
    h.abort?.abort(); const ticket = ++h.epoch, abort = new AbortController(); h.abort = abort;
    flushSync(() => { setError(''); setSaved(''); setUsed(false); setSaving(false); setPhase('receiving'); });
    trace('start', { ticket, mode, tone, broken });
    let reader;
    try {
      const response = await fetch('/stream', { method: 'POST', signal: abort.signal,
        headers: { 'content-type': 'application/json', 'x-session-token': h.config.token },
        body: JSON.stringify({ mode, tone, broken }) });
      if (!response.ok || !response.body || !response.headers.get('content-type')?.startsWith('application/x-ndjson')) throw new Error('Stream unavailable');
      const identity = { streamId: response.headers.get('x-stream-id'), revision: Number(response.headers.get('x-revision')) };
      let final = null;
      const decoder = createJsonlDecoder({ identity, kind: 'output', onRecord(record) {
        if (ticket !== h.epoch || abort.signal.aborted) throw new Error('Stale browser run');
        const checked = validateSpec(record.spec, h.config.contract);
        if (!checked.ok) throw new Error('Invalid received view');
        trace('received', { streamId: record.streamId, seq: record.seq, phase: record.phase });
        if (record.phase === 'committed') final = record;
        else apply(record, 'preview');
      } });
      reader = response.body.getReader();
      while (true) {
        const chunk = await reader.read();
        if (ticket !== h.epoch || abort.signal.aborted) throw new Error('Stale browser run');
        if (chunk.done) break;
        decoder.push(chunk.value);
      }
      const counts = decoder.finish();
      if (!final) throw new Error('Missing final view');
      // A terminal record alone cannot release actions: valid EOF is also required.
      h.committed = final; h.abort = null;
      apply(final, 'committed'); trace('committed', { streamId: final.streamId, ...counts });
      return true;
    } catch (failure) {
      if (ticket !== h.epoch) return false;
      abort.abort(); h.abort = null;
      flushSync(() => setError(failure.message));
      restore('error'); trace('failed', { message: failure.message }); return false;
    } finally { reader?.releaseLock(); }
  };
  const save = async () => {
    if (h.live.phase !== 'committed' || h.live.used || h.live.saving || !h.committed) return;
    const identity = { streamId: h.committed.streamId, revision: h.committed.revision };
    const ticket = h.epoch, name = h.live.draft.name;
    flushSync(() => setSaving(true));
    try {
      const result = await json('/action', { ...identity, name });
      if (ticket !== h.epoch) return;
      if (result.status !== 200) throw new Error('Save unavailable');
      flushSync(() => { setSaved(result.value.saved); setUsed(true); });
      trace('saved', { ...identity, name });
    } catch (failure) { if (ticket === h.epoch) setError(failure.message); }
    finally { if (ticket === h.epoch) setSaving(false); }
  };
  const registry = useRef(null);
  if (!registry.current) registry.current = {
    Layout: ({ node, children }) => <section data-node-id={node.props.id} className={classesFor(node)}>{children}</section>,
    Card: ({ node, children }) => <article data-node-id={node.props.id} className={classesFor(node)}>{children}</article>,
    Text: ({ node }) => <p data-node-id={node.props.id}>{node.props.text}</p>,
    Input: ({ node, state, setState }) => <label>{node.props.label}<input aria-label={node.props.label}
      data-node-id={node.props.id} value={state.name} maxLength={80}
      onChange={(event) => { const name = event.target.value.slice(0, 80); setState({ name }); trace('input', { name }); }} /></label>,
    Button: ({ node, onAction }) => <button data-node-id={node.props.id} type="button"
      disabled={h.live.phase !== 'committed' || h.live.used || h.live.saving} onClick={onAction}>{node.props.label}</button>,
  };
  api = { start, cancel, probeAction: (identity, name) => json('/action', { ...identity, name }),
    inspect: () => structuredClone({ ready, phase: h.live.phase, screen: h.live.screen,
      committed: h.committed, draft: h.live.draft, trace: h.trace, css: sheet.textContent, used: h.live.used }),
    init: async () => {
      const response = await fetch('/session'); if (!response.ok) throw new Error('Session unavailable');
      h.config = await response.json(); flushSync(() => setReady(true));
    } };
  return <main>
    <h1>서버 컴파일 UI 실험</h1>
    <p>고정 입력으로 만든 연구 화면입니다. 서버는 화면 데이터와 CSS를 보냅니다.</p>
    <header>
      <button disabled={!ready} onClick={() => start()}>순차 표시</button>
      <button disabled={!ready} onClick={() => start({ mode: 'complete' })}>완료 후 표시</button>
      <button disabled={!ready} onClick={() => start({ tone: 'dark' })}>화면 교체</button>
      <button disabled={!ready} onClick={() => start({ broken: true })}>오류 입력</button>
      <button onClick={cancel}>취소</button>
    </header>
    <p id="phase" role="status">{phase}</p>
    {error && <p role="alert">{error}</p>}
    <div id="preview">{screen && <Renderer spec={screen.spec} contract={h.config.contract}
      components={registry.current} state={draft} setState={setDraft} actions={{ save }} />}</div>
    <p id="saved">{saved && `저장됨: ${saved}`}</p>
  </main>;
}
flushSync(() => root.render(<App />));
window.STREAM_UI = { start: (...args) => api.start(...args), cancel: () => api.cancel(),
  inspect: () => api.inspect(), probeAction: (...args) => api.probeAction(...args),
  dispose() { api.cancel(); root.unmount(); sheet.remove(); delete window.STREAM_UI; } };
api.init().catch((error) => { document.getElementById('phase').textContent = error.message; });
