import { useEffect, useRef, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Renderer, validateSpec, classesFor } from '@barocss/render';
import { DATA } from './data.mjs';
import { initialState, reduce } from './state.mjs';
import { ordersPanels } from './panels.mjs';
import { projectsPanels } from './projects.mjs';
import { PRESET } from './preset.mjs';
import { PRESET as ORIGINAL_PRESET } from '../preset.mjs';
let owned = null, current = null, dispatchOperation = null;
const clone = (value) => structuredClone(value);
const read = (state, path) => path.slice(1).split('/').reduce((v, key) => v[key], state);
const write = (state, path, value) => { const copy = clone(state), parts = path.slice(1).split('/'); let cursor = copy; for (const key of parts.slice(0,-1)) cursor = cursor[key]; cursor[parts.at(-1)] = value; return copy; };
function Registry({ panel, dispatch, state }) {
  const components = {
    Layout: ({ node, children }) => <section data-node-id={node.props.id} className={`${classesFor(node)} min-w-0`}>{children}</section>,
    Card: ({ node, children }) => {
      const rowId = panel.rowNodes?.[node.props.id];
      return <article data-node-id={node.props.id} role={rowId ? 'row' : undefined} className={`${classesFor(node)} min-w-0 border border-slate-200 ${rowId ? 'grid grid-cols-2 md:grid-cols-7 gap-2 items-center' : panel.id==='order-stats' ? 'grid grid-cols-1 md:grid-cols-3 gap-2' : 'space-y-2'}`}>
        {rowId && <label className="text-xs"><input type="checkbox" aria-label={`Bulk select ${rowId}`} checked={state.orders.checked?.includes(rowId) ?? false} onChange={(e)=>dispatch({type:'check',workspace:'orders',id:rowId,checked:e.target.checked},panel.revision)} /> Select</label>}{children}</article>;
    },
    Text: ({ node }) => <p data-node-id={node.props.id} className={`min-w-0 break-words ${PRESET.roles[panel.roles[node.props.id] ?? 'body']} ${panel.id==='order-stats' && ['title','caption'].includes(panel.roles[node.props.id])?'md:col-span-3':''}`}>{node.props.text}</p>,
    Input: ({ node, state, setState }) => <label className="block text-sm">{node.props.label}<input data-node-id={node.props.id} aria-label={node.props.label}
      className={PRESET.control} value={read(state, node.props.value.$bindState)} maxLength={80} onChange={(e) => setState((s) => write(s, node.props.value.$bindState, e.target.value.slice(0,80)))} /></label>,
    Button: ({ node, onAction }) => <button data-node-id={node.props.id} type="button" className={PRESET.roles.action} onClick={onAction}>{node.props.label}</button>,
  };
  // Role maps are authored host presentation; rebuild on projection changes, not Spec style properties.
  components.Text = ({ node }) => <p data-node-id={node.props.id} className={`min-w-0 break-words ${PRESET.roles[panel.roles[node.props.id] ?? 'body']} ${panel.id==='order-stats' && ['title','caption'].includes(panel.roles[node.props.id])?'md:col-span-3':''}`}>{node.props.text}</p>;
  const checked = validateSpec(panel.spec, panel.contract);
  if (!checked.ok) throw new Error(`Projected panel rejected: ${panel.id}`);
  const actions = Object.fromEntries(Object.entries(panel.commands).map(([name, command]) => [name, () => dispatch(command, panel.revision)]));
  return <Renderer spec={panel.spec} contract={panel.contract} components={components} state={panel.state} setState={() => {}} actions={actions} />;
}
function Control({ label, value, onChange, options }) {
  return <label className="block min-w-0 text-xs font-medium text-slate-600">{label}{options
    ? <select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)} className={`${PRESET.control} mt-1`}>{options.map(([value,label]) => <option key={value} value={value}>{label}</option>)}</select>
    : <input aria-label={label} value={value} maxLength={120} onChange={(e) => onChange(e.target.value)} className={`${PRESET.control} mt-1`} />}</label>;
}
function OrdersTable({projection,ui,state,dispatch}) {
  const cells=(row)=>[<button type="button" className="font-bold text-left underline text-emerald-800" onClick={()=>dispatch({type:'select',workspace:'orders',id:row.id},state.revision)} aria-label={`Inspect ${row.id}`}>{row.id}</button>,row.customer,`${row.lineCount} lines · ${row.productSummary.length>65 ? row.productSummary.slice(0,65)+'…' : row.productSummary}`,row.date,
    <span className={`inline-block rounded-full px-2 py-1 text-xs ${row.status==='queued'?'bg-amber-100 text-amber-900':row.status==='packed'?'bg-emerald-100 text-emerald-900':'bg-slate-200 text-slate-700'}`}>{row.status}</span>,row.total];
  const labels=['Order','Customer','Products / lines','Date','Status','Total'];
  return <section data-workflow-region="orders-list" className="min-w-0 rounded-xl border border-slate-200 bg-white p-3">
    <h3 className="text-sm font-bold">Orders / linked data</h3><p className="text-xs text-slate-500 mt-1">Native authored host table and selection controls. Summary and detail use validated renderer Specs.</p>
    <div className="flex flex-wrap justify-between items-center gap-2 my-3"><span className="text-xs">{ui.checked?.length??0} selected · {ui.checked?.filter(id=>!projection.visibleIds.includes(id)).length??0} hidden</span><button className="text-xs underline" onClick={()=>dispatch({type:'clear-checks',workspace:'orders'})}>Clear selected rows</button><button className="rounded-lg bg-emerald-700 text-white px-3 py-2 text-sm" onClick={()=>dispatch({type:'order-bulk',ids:ui.checked??[],next:'packed',revision:state.revision,view:'orders'})}>Pack selected rows</button></div>
    <table aria-label="Orders linked records" className="w-full table-fixed block md:table text-sm"><thead className="hidden md:table-header-group"><tr>{['Select',...labels].map(label=><th key={label} scope="col" className="text-left text-xs text-slate-500 border-b border-slate-200 py-2 px-1 break-words">{label}</th>)}</tr></thead>
      <tbody className="block md:table-row-group">{projection.tableRows.length?projection.tableRows.map(row=><tr key={row.id} data-order-id={row.id} aria-selected={ui.selected===row.id} className={`block md:table-row border-b border-slate-200 py-3 ${ui.selected===row.id?'bg-emerald-50':''}`}>
        <td className="block md:table-cell align-top py-2 px-1"><label><input type="checkbox" aria-label={`Bulk select ${row.id}`} checked={ui.checked?.includes(row.id)??false} onChange={e=>dispatch({type:'check',workspace:'orders',id:row.id,checked:e.target.checked},state.revision)} /><span className="md:hidden ml-2 text-xs">Select for bulk action</span></label></td>
        {cells(row).map((value,index)=><td key={labels[index]} className="block md:table-cell align-top py-2 px-1 break-words"><span className="md:hidden block text-xs text-slate-500">{labels[index]}</span><span data-cell-value>{value}</span></td>)}
      </tr>):<tr className="block md:table-row"><td colSpan={7} className="block md:table-cell p-4"><strong>No matching orders</strong><p className="text-xs mt-2">Clear the query or change a filter. Selection and local changes are retained.</p></td></tr>}</tbody>
    </table>
  </section>;
}
function App({ resources }) {
  const [state, setState] = useState(initialState), [context, setContext] = useState(null), [specimens, setSpecimens] = useState([]);
  const [originalId, setOriginalId] = useState(null), [originalState, setOriginalState] = useState({}), [originalActions, setOriginalActions] = useState([]);
  const latest = useRef(state); latest.current = state;
  function dispatch(op, expectedRevision) {
    if (expectedRevision !== undefined && (latest.current.revision !== expectedRevision || latest.current.view !== (op.view ?? op.workspace))) {
      op = { type: 'order-status', id: 'stale-target', next: 'packed', revision: expectedRevision, view: 'orders' };
    }
    setState((old) => { const next = reduce(old, op); latest.current = next; return next; });
  }
  dispatchOperation = dispatch;
  useEffect(() => {
    const abort = new AbortController(); resources.abort = abort;
    Promise.all(['/api/context','/api/specimens'].map(async (url) => { const response = await fetch(url, { signal: abort.signal }); if (!response.ok) throw new Error('Workflow context unavailable'); return response.json(); }))
      .then(([context, records]) => { if (!abort.signal.aborted) { setContext(context); setSpecimens(records); setOriginalId(records[0]?.id); } })
      .catch(() => { if (!abort.signal.aborted) dispatch({ type: 'unknown' }); });
    return () => abort.abort();
  }, [resources]);
  const projection = state.view === 'orders' ? ordersPanels(state) : state.view === 'projects' ? projectsPanels(state) : { panels: [], rowIds: [], page: 0, pageCount: 1 };
  const original = specimens.find((record) => record.id === originalId);
  const originalInput = originalState[originalId] ?? original?.initialState;
  current = { version: 1, state: clone(state), projection: clone(projection), context, original: { id: originalId, input: clone(originalInput), actions: clone(originalActions) } };
  const workspace = state.view, ui = state[workspace];
  const filter = (key,value) => dispatch({ type:'filter',workspace,key,value });
  const originalComponents = useRef({
    Layout: ({ node, children }) => <section className={classesFor(node)}>{children}</section>,
    Card: ({ node, children }) => <article className={classesFor(node)}>{children}</article>,
    Text: ({ node }) => <p className={ORIGINAL_PRESET.styles.Text}>{node.props.text}</p>,
    Input: ({ node, state, setState }) => <label>{node.props.label}<input aria-label={node.props.label} className={ORIGINAL_PRESET.styles.Input} maxLength={80} value={read(state,node.props.value.$bindState)} onChange={(e) => setState((s) => write(s,node.props.value.$bindState,e.target.value.slice(0,80)))} /></label>,
    Button: ({ node, onAction }) => <button className={ORIGINAL_PRESET.styles.Button} onClick={onAction}>{node.props.label}</button>,
  }).current;
  return <main className={`${PRESET.shell} min-w-0`}>
    <div className="grid grid-cols-1 md:grid-cols-[200px_minmax(0,1fr)] min-h-screen">
      <aside className="bg-slate-900 text-white p-5 min-w-0"><p className="text-xs uppercase tracking-widest opacity-60">BaroCSS / authored lab</p><h1 className="text-2xl font-bold mt-2">Fieldwork</h1>
        <p className="text-sm opacity-70 mt-3">Linked records.<br />Local decisions.</p>
        <nav aria-label="Workspaces" className="flex flex-wrap md:flex-col gap-2 mt-6">{[['orders','Orders'],['projects','Projects'],['specimens','Original specimens']].map(([view,label]) =>
          <button key={view} type="button" aria-pressed={workspace===view} onClick={() => dispatch({type:'view',view})}
            className={`text-left rounded-lg px-3 py-2 text-sm ${workspace===view ? 'bg-emerald-400 text-slate-900 font-bold' : 'bg-slate-800 text-white'}`}>{label}</button>)}</nav>
        <a href="http://127.0.0.1:5175" target="_blank" rel="noreferrer" className="block text-xs underline mt-6">Original captures · port 5175</a>
        <p className="text-xs opacity-60 mt-6">Fictional authored data<br />No model generation</p>
      </aside>
      <div className="min-w-0 p-4 md:p-6 space-y-4"><header className="flex flex-wrap justify-between gap-2 items-end"><div><p className="text-xs uppercase tracking-widest text-slate-500">Operations workspace</p>
        <h2 className="text-2xl font-bold">{workspace==='orders' ? 'Order operations' : workspace==='projects' ? 'Project delivery' : 'Original specimens'}</h2></div>
        <span className="text-xs rounded-full border border-slate-300 bg-white px-3 py-1">Session revision {state.revision} · Fixed date {DATA.asOf}</span></header>
        <p className="text-xs text-slate-500">Authored host controls / {PRESET.id}. Business panels below use current projected five-type renderer Specs.</p>
        {!context && <p role="status">Loading validated local context…</p>}
        {state.error && <p role="alert" className="rounded-lg border border-red-300 bg-red-50 p-3 text-sm text-red-900">Operation rejected: {state.error}. Last valid record and view are retained.</p>}
        {workspace==='orders' && <><section aria-label="Orders host controls" className="grid grid-cols-2 lg:grid-cols-4 gap-3 rounded-xl bg-white border border-slate-200 p-4">
          <Control label="Search orders" value={ui.query} onChange={(v)=>filter('query',v)} />
          <Control label="Order status" value={ui.status} onChange={(v)=>filter('status',v)} options={[['all','All statuses'],...['queued','packed','dispatched'].map(v=>[v,v])]} />
          <Control label="Customer" value={ui.customer} onChange={(v)=>filter('customer',v)} options={[['all','All customers'],...DATA.customers.map(c=>[c.id,c.name])]} />
          <Control label="Order sort" value={ui.sort} onChange={(v)=>filter('sort',v)} options={[['date-desc','Newest first'],['date-asc','Oldest first'],['total-desc','Total: high to low'],['total-asc','Total: low to high']]} />
        </section><div className="flex flex-wrap items-center justify-between gap-2"><p className="text-sm text-slate-600">{projection.rowIds.length} matches · page {projection.page+1} / {projection.pageCount}</p>
          <div className="flex gap-2"><button disabled={projection.page===0} className="rounded-lg border px-3 py-2 text-sm" onClick={()=>dispatch({type:'page',workspace,value:projection.page-1})}>Previous page</button>
          <button disabled={projection.page+1===projection.pageCount} className="rounded-lg border px-3 py-2 text-sm" onClick={()=>dispatch({type:'page',workspace,value:projection.page+1})}>Next page</button></div></div>
          <section data-panel={projection.panels[0].id} className="min-w-0"><Registry panel={projection.panels[0]} dispatch={dispatch} state={state} /></section>
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start">
            <OrdersTable projection={projection} ui={ui} state={state} dispatch={dispatch} />
            <section data-panel="order-detail" className="min-w-0"><h3 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">Linked order detail / renderer panel</h3>
              <div role="tablist" aria-label="Order detail tabs" className="flex flex-wrap gap-2 mb-3">{['summary','lines','history'].map(tab=><button key={tab} role="tab" aria-selected={(ui.tab??'summary')===tab} className="rounded-lg border bg-white px-3 py-2 text-sm" onClick={()=>filter('tab',tab)}>{tab==='summary'?'Summary':tab==='lines'?'Product lines':'History'}</button>)}</div>
              <Registry panel={projection.panels[1]} dispatch={dispatch} state={state} />
            </section>
          </div></>}
        {workspace==='projects' && <><section aria-label="Projects host controls" className="grid grid-cols-2 lg:grid-cols-3 gap-3 rounded-xl bg-white border border-slate-200 p-4">
          <Control label="Search tasks" value={ui.query} onChange={v=>filter('query',v)} />
          <Control label="Project" value={ui.project} onChange={v=>filter('project',v)} options={[["all","All projects"],...DATA.projects.map(p=>[p.id,p.name])]} />
          <Control label="Task status" value={ui.status} onChange={v=>filter('status',v)} options={[["all","All statuses"],...["todo","doing","done"].map(v=>[v,v])]} />
          <Control label="Assignee" value={ui.assignee} onChange={v=>filter('assignee',v)} options={[["all","All assignees"],["unassigned","Unassigned"],...DATA.assignees.map(a=>[a.id,a.name])]} />
          <Control label="Due sort" value={ui.sort} onChange={v=>filter('sort',v)} options={[["due-asc","Due: earliest first"],["due-desc","Due: latest first"]]} />
        </section><div className="flex flex-wrap gap-2 justify-between items-center"><p className="text-sm text-slate-600">{projection.rowIds.length} matches · page {projection.page+1} / {projection.pageCount} · Null due dates last</p>
          <div className="flex gap-2"><button disabled={projection.page===0} className="rounded-lg border px-3 py-2 text-sm" onClick={()=>dispatch({type:'page',workspace,value:projection.page-1})}>Previous page</button><button disabled={projection.page+1===projection.pageCount} className="rounded-lg border px-3 py-2 text-sm" onClick={()=>dispatch({type:'page',workspace,value:projection.page+1})}>Next page</button></div></div>
          <div className="grid grid-cols-1 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] gap-4 items-start"><div className="grid grid-cols-1 md:grid-cols-3 gap-3 min-w-0">{projection.panels.slice(0,3).map((panel,index)=><section key={panel.id} data-panel={panel.id} className="min-w-0"><h3 className="text-xs font-bold uppercase text-slate-500 mb-2">{panel.title} · {projection.counts[['todo','doing','done'][index]]}</h3><Registry panel={panel} dispatch={dispatch} state={state} /></section>)}</div>
            <section data-panel="project-detail" className="min-w-0"><h3 className="text-xs font-bold uppercase text-slate-500 mb-2">Selected task / renderer detail</h3><Registry panel={projection.panels[3]} dispatch={dispatch} state={state} /></section></div></>}

        {workspace==='specimens' && <section className="min-w-0 space-y-4"><Control label="Original specimen" value={originalId??''} onChange={setOriginalId} options={specimens.map(r=>[r.id,r.title])} />
          <p className="text-xs text-slate-500">Immutable original Spec and gallery-v1 preset. Workflow records and projected Specs are separate.</p>
          {original && <Renderer spec={original.spec} contract={original.contract} state={originalInput} setState={(next)=>setOriginalState((old)=>({...old,[originalId]:typeof next==='function'?next(originalInput):next}))}
            components={originalComponents} actions={Object.fromEntries(original.contract.actions.map(name=>[name,()=>setOriginalActions(old=>[...old,{sample:originalId,name,input:clone(originalInput)}].slice(-128))]))} />}
        </section>}
        <details className="rounded-xl bg-white border border-slate-200 p-4 min-w-0"><summary className="text-sm font-bold cursor-pointer">Inspect current projected Specs, contracts and host state</summary>
          <pre className="text-xs whitespace-pre-wrap break-words mt-3">{JSON.stringify({state,panels:projection.panels,context,preset:PRESET,originalSpec:workspace==='specimens'?original?.spec:undefined},null,2)}</pre></details>
        <p className="text-xs text-slate-500">Session-local operations only. Native host table; no renderer Table, Chart, Image or generated CSS. No payment or external service.</p>
      </div>
    </div>
  </main>;
}
function mount() {
  if (owned) return;
  const nonce=document.querySelector('meta[name="barocss-nonce"]').content;
  const runtime=new window.BaroCSS.BrowserRuntime({ nonce,constructable:false,styleId:'workflow-owned',skipExisting:false,gc:false });runtime.observe(document.body,{scan:true});
  const root=createRoot(document.getElementById('app'));owned={runtime,root,abort:null};root.render(<App resources={owned} />);
}
function dispose() { if (!owned) return;owned.abort?.abort();owned.root.unmount();owned.runtime.destroy();owned=null;dispatchOperation=null;current=null; }
const unload=()=>dispose();
window.WORKFLOW={snapshot:()=>clone(current),dispatch:(op)=>dispatchOperation?.(op),dispose(){window.removeEventListener('pagehide',unload);dispose();},mount(){window.addEventListener('pagehide',unload);mount();}};
window.addEventListener('pagehide',unload);mount();
