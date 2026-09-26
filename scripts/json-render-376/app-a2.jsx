// #376 browser bundle: the official A2UI v0.9 React renderer (@a2ui/react + @a2ui/web_core MessageProcessor, basic
// catalog). window.A2.render(text, el) -> { ok, error, messages, badMessages }. text = JSONL A2UI messages.
import { createRoot } from 'react-dom/client';
import { flushSync } from 'react-dom';
import { MessageProcessor } from '@a2ui/web_core/v0_9';
import { A2uiSurface, basicCatalog } from '@a2ui/react/v0_9';

function messages(text) {
  const t = text.trim(); const out = []; let bad = 0;
  if (t.startsWith('[')) { try { return { list: JSON.parse(t), bad: 0 }; } catch {} }
  // JSONL, but tolerate a message pretty-printed over several lines (accumulate until it parses).
  let buf = '';
  for (const line of t.split('\n')) {
    const s = line.trim(); if (!buf && (!s || s === '[' || s === ']')) continue;
    buf += line + '\n';
    try { out.push(JSON.parse(buf.trim().replace(/,$/, ''))); buf = ''; } catch {}
  }
  if (buf.trim()) bad++;
  return { list: out, bad };
}
window.A2 = {

  render(text, el) {
    const { list, bad } = messages(text);
    const p = new MessageProcessor([basicCatalog]); const errs = [];
    for (const m of list) {
      if (m && m.createSurface) m.createSurface.catalogId = basicCatalog.id; // the model may spell the id differently
      try { p.processMessages([m]); } catch (e) { errs.push(String(e.message || e).slice(0, 160)); }
    }
    const surfaces = [...p.model.surfacesMap.values()];
    if (!surfaces.length) return { ok: false, error: 'no surface' + (errs[0] ? ': ' + errs[0] : ''), messages: list.length, badMessages: bad };
    try {
      const root = createRoot(el);
      flushSync(() => root.render(<>{surfaces.map((s) => <A2uiSurface key={s.id} surface={s} />)}</>));
    } catch (e) { return { ok: false, error: 'render: ' + e.message }; }
    return { ok: errs.length === 0, error: errs[0] || null, messages: list.length, badMessages: bad };
  },
};
