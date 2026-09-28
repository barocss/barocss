import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Renderer } from '../../packages/barocss-render/src/index.jsx';
import { BASE_CLASSES, Layout, Card, Text, Input, Button } from '../barocss-render-prototype/visual.jsx';

for (const name of BASE_CLASSES.split(' ')) window.BaroCSS.getRuntime().addClass(name);

const components = {
  Layout, Card, Text,
  Input: ({ node, state, setState }) => <Input node={node} value={state.name}
    onChange={(name) => setState((old) => ({ ...old, name }))} />,
  Button: ({ node, onAction }) => <Button node={node} onClick={onAction} />,
};

function App() {
  const [token, setToken] = useState(null);
  const [mode, setMode] = useState('loading');
  const [screen, setScreen] = useState(null);
  const [formState, setFormState] = useState({ name: '' });
  const [prompt, setPrompt] = useState('Create a profile form');
  const [sending, setSending] = useState(false);
  const [requestError, setRequestError] = useState('');
  const startedAt = useRef({ first: null, action: null });
  const requestEpoch = useRef(0);
  const pollIssued = useRef(0);
  const pollApplied = useRef(0);
  const currentScreen = useRef(null);
  window.LOOP_METRICS ??= { firstVisibleMs: null, actionToNextVisibleMs: null, sampleCount: 0 };

  useEffect(() => {
    fetch('/api/session').then((response) => response.json()).then((data) => {
      setToken(data.token);
      setMode(data.mode);
    }).catch(() => setRequestError('Cannot open local session'));
  }, []);
  useEffect(() => {
    if (!token) return undefined;
    let active = true;
    async function poll() {
      const epoch = requestEpoch.current;
      const sequence = ++pollIssued.current;
      try {
        const response = await fetch('/api/state', { headers: { 'x-session-token': token } });
        if (!response.ok) throw new Error('Cannot read session state');
        const next = await response.json();
        if (!active || epoch !== requestEpoch.current || sequence <= pollApplied.current
          || next.revision < (currentScreen.current?.revision ?? 0)) return;
        pollApplied.current = sequence;
        currentScreen.current = next;
        setScreen(next);
        if (next.phase === 'failed' || next.phase === 'cancelled' || next.turn === 2) setSending(false);
      } catch { if (active && epoch === requestEpoch.current) setRequestError('Cannot read local session state'); }
    }
    void poll();
    const interval = setInterval(poll, 100);
    return () => { active = false; clearInterval(interval); };
  }, [token]);
  useEffect(() => {
    if (!screen?.revision) return undefined;
    const slot = screen.turn === 1 ? 'first' : 'action';
    const began = startedAt.current[slot];
    if (began === null) return undefined;
    const frame = requestAnimationFrame(() => {
      const elapsed = Math.round(performance.now() - began);
      if (slot === 'first') window.LOOP_METRICS.firstVisibleMs = elapsed;
      else window.LOOP_METRICS.actionToNextVisibleMs = elapsed;
      window.LOOP_METRICS.sampleCount++;
      startedAt.current[slot] = null;
    });
    return () => cancelAnimationFrame(frame);
  }, [screen?.revision, screen?.turn]);

  async function send(path, body) {
    setRequestError('');
    requestEpoch.current++;
    try {
      const response = await fetch(path, { method: 'POST', headers: {
        'content-type': 'application/json', 'x-session-token': token,
      }, body: JSON.stringify(body) });
      const result = await response.json();
      if (!response.ok) setRequestError(result.error ?? 'Request rejected');
      return response.ok;
    } catch { setRequestError('Local request failed'); return false; }
    finally { requestEpoch.current++; }
  }
  async function start() {
    startedAt.current.first = performance.now();
    if (!await send('/api/start', { prompt })) startedAt.current.first = null;
  }
  async function save() {
    if (sending || !screen || screen.turn !== 1) return;
    setSending(true);
    startedAt.current.action = performance.now();
    const accepted = await send('/api/action', { action: 'save', revision: screen.revision,
      input: { name: formState.name } });
    if (!accepted) { setSending(false); startedAt.current.action = null; }
  }
  async function restart() {
    if (await send('/api/restart', {})) {
      setFormState({ name: '' });
      setSending(false);
      startedAt.current = { first: null, action: null };
      window.LOOP_METRICS = { firstVisibleMs: null, actionToNextVisibleMs: null, sampleCount: 0 };
    }
  }
  const pending = sending || ['generating', 'action-pending'].includes(screen?.phase);
  const status = requestError || screen?.error || screen?.phase || 'loading';
  return <>
    <h1>BaroCSS UI loop</h1>
    <p data-mode={mode}>{mode === 'authored-mock' ? 'Authored mock. No model runs.' : 'Local CLI transport'}</p>
    <header>
      <input aria-label="Request" value={prompt} onChange={(event) => setPrompt(event.target.value)}
        disabled={screen?.phase !== 'idle'} />
      <button type="button" onClick={start} disabled={!token || screen?.phase !== 'idle'}>Generate</button>
      <button type="button" onClick={() => send('/api/cancel', {})}
        disabled={!['generating', 'action-pending'].includes(screen?.phase)}>Cancel</button>
      <button type="button" onClick={restart} disabled={!token}>Restart</button>
    </header>
    <div id="status" role="status" data-phase={screen?.phase ?? 'loading'}>{status}</div>
    {screen?.spec && <fieldset disabled={pending}>
      <Renderer spec={screen.spec} components={components} state={formState}
        setState={setFormState} actions={{ save }} />
    </fieldset>}
  </>;
}

createRoot(document.getElementById('app')).render(<App />);
