// #447 captured-output adapter. Measurement code derives from #446 run.mjs. No generation.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { ARMS, SCENARIOS, validateContract } from '../json-render-446/contract.mjs';
import { initialState, specFor } from '../json-render-446/spec.mjs';
import { BASE_TOKENS, ALL_LAYOUT_TOKENS, INITIAL_LAYOUT_TOKENS } from '../json-render-446/styles.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const SCRATCH = path.join(HERE, 'scratch');
const args = process.argv.slice(2);
if (args.length !== 4 || args[0] !== '--input' || args[2] !== '--output') throw new Error('Usage: replay.mjs --input captured.json --output report.json');
const output = path.resolve(args[3]);
const EVIDENCE = path.dirname(output);
const inputBytes = fs.readFileSync(path.resolve(args[1]));
if (inputBytes.length > 8_000_000) throw new Error('Input exceeds 8 MB');
const captured = JSON.parse(inputBytes);
if (!Array.isArray(captured) || captured.length > 1000) throw new Error('Expected at most 1000 captured rows');
const ids = new Set();
for (const row of captured) {
  if (!row || typeof row.id !== 'string' || !row.id || ids.has(row.id) || typeof row.model !== 'string' || !row.model || !Object.hasOwn(SCENARIOS, row.scenario) || !['fixed','bounded','utility'].includes(row.arm) || !Number.isInteger(row.repeat) || row.repeat < 0 || !['initial','density','responsive','structure'].includes(row.stage) || typeof row.status !== 'string') throw new Error('Invalid or duplicate captured row metadata');
  ids.add(row.id);
}
const groups = new Map();
for (const row of captured) {
  const key = JSON.stringify([row.model,row.scenario,row.arm,row.repeat]);
  if (!groups.has(key)) groups.set(key, []);
  if (groups.get(key).some(x => x.stage === row.stage)) throw new Error('Duplicate session stage');
  groups.get(key).push(row);
}
const allowedTokens = new Set([...BASE_TOKENS, ...ALL_LAYOUT_TOKENS]);
// Reject extensions before passing any captured object to the official renderer.
function safeSpec(spec, scenario, arm) {
  const errors = [];
  const object = value => value && typeof value === 'object' && !Array.isArray(value);
  const keys = (value, allowed) => object(value) && Object.keys(value).every(key => allowed.includes(key));
  if (!keys(spec,['root','elements']) || spec.root !== 'layout' || !object(spec.elements)) return ['Invalid spec envelope'];
  const fixture = SCENARIOS[scenario];
  const known = new Map([['layout',{type:'Layout'}], ...[...fixture.nodes, fixture.help].map(n=>[n.id,n])]);
  if (!spec.elements.layout || Object.keys(spec.elements).length > known.size) return ['Invalid element inventory'];
  for (const [key,node] of Object.entries(spec.elements)) {
    const expected = known.get(key);
    if (!expected || !keys(node,['type','props','children','on']) || node.type !== expected.type || !object(node.props) || node.props.id !== key || !Array.isArray(node.children)) { errors.push('Invalid element shape'); continue; }
    const fields = node.type === 'Layout' ? ['id', ...(arm==='fixed'?['variant']:arm==='bounded'?['density','columns','placement']:['className'])] : ['id', ...(node.type==='Text'?['text']:node.type==='Button'?['label']:node.type==='Select'?['label','value','options']:['label','value']), ...(['utility','build'].includes(arm)?['className']:[])];
    if (!keys(node.props,fields)) errors.push('Unknown component prop');
    if (node.type==='Layout') {
      if (node.children.some(id=>typeof id!=='string'||id==='layout'||!Object.hasOwn(spec.elements,id)) || new Set(node.children).size!==node.children.length || node.children.length!==Object.keys(spec.elements).length-1) errors.push('Invalid flat layout tree');
      if (node.on !== undefined) errors.push('Layout action forbidden');
    } else if (node.children.length) errors.push('Leaf children forbidden');
    for (const [prop,value] of Object.entries(node.props)) {
      if (['id','text','label'].includes(prop) && (typeof value!=='string'||value.length>2000)) errors.push('Invalid text');
      if (prop==='className' && (typeof value!=='string'||value.length>2000||value.split(/\s+/).filter(Boolean).some(t=>!allowedTokens.has(t)))) errors.push('Unsafe or unsupported class token');
      if (prop==='value' && !(typeof value==='string' && value.length<=2000) && !(keys(value,['$bindState']) && value.$bindState===`/${key}`)) errors.push('Only own-field state binding allowed');
      if (prop==='options' && (!Array.isArray(value)||value.length>20||value.some(v=>typeof v!=='string'||v.length>200))) errors.push('Invalid options');
    }
    if (node.on !== undefined && !(expected.action && keys(node.on,['press']) && keys(node.on.press,['action']) && node.on.press.action===expected.action)) errors.push('Invalid action');
  }
  return errors;
}

const JR_ROOT = process.env.JR_ROOT || path.join(SCRATCH, 'jr');
const REPO_DEPS_ROOT = process.env.REPO_DEPS_ROOT || ROOT;
const PW_DIR = process.env.PW_DIR;
const CHROME = process.env.CHROME;

if (validateContract().length) throw new Error('frozen contract invalid');
if (!PW_DIR || !CHROME || !fs.existsSync(CHROME)) throw new Error('Set PW_DIR and CHROME to an installed matching Playwright/Chromium pair');

const fromRepo = createRequire(path.join(REPO_DEPS_ROOT, 'packages/barocss/package.json'));
const fromPW = createRequire(path.join(PW_DIR, 'package.json'));
const fromJR = createRequire(path.join(JR_ROOT, 'package.json'));
const { compile } = fromRepo('tailwindcss');
const esbuild = fromRepo('esbuild');
const { chromium } = fromPW('playwright-core');
for (const name of ['@json-render/core', '@json-render/react', 'react', 'react-dom']) fromJR.resolve(name);
const BARO = path.join(HERE, '../json-render-446/evidence/baro.umd.cjs');
if (!fs.existsSync(BARO)) throw new Error('Pinned BaroCSS bundle missing: evidence/baro.umd.cjs');
const sha = (bytes) => createHash('sha256').update(bytes).digest('hex');
const bundleBytes = fs.readFileSync(BARO);
const themeCSS = fs.readFileSync(path.join(ROOT, 'scripts/json-render-probe/e2e/app.css'), 'utf8');
const twDir = path.dirname(fromRepo.resolve('tailwindcss/package.json'));
fs.mkdirSync(SCRATCH, { recursive: true });
await esbuild.build({
  entryPoints: [path.join(HERE, '../json-render-446/browser-app.jsx')], outfile: path.join(SCRATCH, 'app.js'),
  bundle: true, platform: 'browser', format: 'iife', jsx: 'automatic',
  nodePaths: [path.join(JR_ROOT, 'node_modules')], define: { 'process.env.NODE_ENV': '"production"' }, logLevel: 'error',
});
const appJS = fs.readFileSync(path.join(SCRATCH, 'app.js'));
async function buildCSS(tokens) {
  const compiler = await compile(`@import "tailwindcss";\n${themeCSS}`, {
    base: twDir,
    loadStylesheet: async (id, base) => {
      const p = id === 'tailwindcss' ? path.join(twDir, 'index.css') : path.resolve(base, id.replace(/^tailwindcss\//, ''));
      const file = fs.existsSync(p) ? p : path.join(twDir, id.replace(/^tailwindcss\//, ''));
      return { path: file, base: path.dirname(file), content: fs.readFileSync(file, 'utf8') };
    },
  });
  return compiler.build([...new Set(tokens)]) + '\nbody{margin:0;font-family:system-ui,sans-serif}#host{padding:12px;border-bottom:1px solid var(--border);color:var(--foreground);background:var(--background)}#out{padding:18px}';
}
let activeCSS = '';
const inventory = [];
const shell = (arm) => `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><link rel="stylesheet" href="/css/${arm}"></head><body><div id="host">Host app sentinel</div><main id="out"></main>${arm === 'utility' ? '<script src="/baro.js"></script><script>BaroCSS.baroStart({skipExisting:true,config:{cssVarPrefix:"tw",theme:{extend:BaroCSS.shadcnTheme}}});</script>' : ''}<script src="/app.js"></script></body></html>`;
const srv = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://localhost');
  const send = (type, body) => { res.writeHead(200, { 'content-type': type, 'cache-control': 'no-store' }); res.end(body); };
  if (u.pathname === '/') { const arm = u.searchParams.get('arm'); if (ARMS[arm]) return send('text/html', shell(arm)); }
  if (u.pathname === '/app.js') return send('text/javascript', appJS);
  if (u.pathname === '/baro.js') return send('text/javascript', bundleBytes);
  const match = u.pathname.match(/^\/css\/(fixed|bounded|utility|build)$/);
  if (match) return send('text/css', activeCSS);
  res.writeHead(404); res.end();
});
await new Promise((resolve) => srv.listen(0, '127.0.0.1', resolve));
const baseURL = `http://127.0.0.1:${srv.address().port}`;
const browser = await chromium.launch({ executablePath: CHROME, headless: true });
const rows = [];
const shotDir = path.join(EVIDENCE, 'shots');
fs.mkdirSync(shotDir, { recursive: true });
const capture = async (page, expected, edit) => page.evaluate(async ({ expected, edit }) => {
  const result = edit.mode === 'mount'
    ? window.REPLAY.mount(edit.arm, edit.state, edit.spec)
    : window.REPLAY.update(edit.spec);
  const root = document.querySelector('[data-node-id="layout"]');
  if (!root) return { result, error: 'layout missing', frames: [] };
  const host = document.getElementById('host');
  const button = document.querySelector('button[data-node-id]');
  const getThemeColor = (name) => { const probe = document.createElement('div'); probe.style.backgroundColor = `var(--${name})`; document.body.appendChild(probe); const color = getComputedStyle(probe).backgroundColor; probe.remove(); return color; };
  const expectedCard = getThemeColor('card'), expectedPrimary = getThemeColor('primary');
  const take = () => {
    const c = getComputedStyle(root); const h = getComputedStyle(host); const b = button && getComputedStyle(button);
    const columns = c.gridTemplateColumns === 'none' ? 0 : c.gridTemplateColumns.trim().split(/\s+/).length;
    const padding = parseFloat(c.paddingTop), gap = parseFloat(c.columnGap), rowGap = parseFloat(c.rowGap);
    const want = expected.density === 'regular' ? 24 : 12;
    return { columns, padding, gap, rowGap, background: c.backgroundColor, buttonBackground: b?.backgroundColor ?? null,
      host: [h.color, h.backgroundColor, h.fontSize, h.position, h.zIndex],
      styleBytes: [...document.querySelectorAll('style')].reduce((sum, style) => sum + style.textContent.length, 0),
      pass: columns === expected.columns && Math.abs(padding - want) < 1 && Math.abs(gap - want) < 1 && Math.abs(rowGap - want) < 1 };
  };
  const frames = [take()];
  for (let i = 0; i < 3; i++) { await new Promise(requestAnimationFrame); frames.push(take()); }
  const el = document.querySelector(edit.target);
  const preAction = { value: el?.value ?? null, focus: document.activeElement === el,
    domSignature: [...document.querySelectorAll('[data-node-id]')].map((node) => node.getAttribute('data-node-id')) };
  return { result, preAction, frames, final: frames.at(-1), unstyledFrames: frames.filter((frame) => !frame.pass).length,
    themeAdherence: frames.at(-1).background === expectedCard && frames.at(-1).buttonBackground === expectedPrimary };
}, { expected, edit });

try {
  for (const session of groups.values()) {
    const {model, scenario, arm: sourceArm, repeat} = session[0];
    const fixture = SCENARIOS[scenario];
    for (const arm of sourceArm === 'utility' ? ['utility','build'] : [sourceArm]) {
      const initial = session.find(row=>row.stage==='initial');
      const initialSafe = initial?.status==='valid' && safeSpec(initial.spec,scenario,arm).length===0;
      const capturedTokens = initialSafe ? Object.values(initial.spec.elements).flatMap(node=>(node.props.className||'').split(/\s+/).filter(Boolean)) : [];
      const tokens = [...new Set([...BASE_TOKENS, ...(['fixed','bounded'].includes(arm)?ALL_LAYOUT_TOKENS:capturedTokens)])].sort();
      activeCSS = await buildCSS(tokens);
      inventory.push({model,scenario,arm,repeat,tokens,cssSha256:sha(activeCSS),initialCaptured:!!initialSafe});
      const page = await browser.newPage({viewport:fixture.stages[0].viewport,reducedMotion:'reduce'});
      const errors = [];
      page.on('pageerror',error=>errors.push(String(error.message).slice(0,180)));
      await page.route('**/*',route => new URL(route.request().url()).origin===baseURL ? route.continue() : route.abort());
      let mounted=false, chainComplete=true, actionCount=0;
      try {
        await page.goto(`${baseURL}/?arm=${arm}`,{waitUntil:'load'});
        const hostBefore=await page.evaluate(()=>{const h=getComputedStyle(document.getElementById('host'));return [h.color,h.backgroundColor,h.fontSize,h.position,h.zIndex]});
        const targetNode=fixture.nodes.find(n=>n.id===fixture.interaction.target);
        const target=`[data-node-id="${targetNode.id}"] ${targetNode.type==='Select'?'select':'input'}`;
        for (const stage of fixture.stages) {
          const cell=session.find(row=>row.stage===stage.id);
          const base={id:cell?.id??null,model,scenario,arm,sourceArm,repeat,stage:stage.id,status:cell?.status??'missing',specSha256:cell?.spec?sha(JSON.stringify(cell.spec)):null,priorChainComplete:chainComplete};
          if (!cell || cell.status!=='valid') { rows.push({...base,classification:cell?.status??'missing',rendered:false});chainComplete=false;continue; }
          const validationErrors=safeSpec(cell.spec,scenario,arm);
          if(validationErrors.length){rows.push({...base,classification:'schema',rendered:false,validationErrors});chainComplete=false;continue;}
          if(stage.id!=='initial'&&!mounted){rows.push({...base,classification:'missing-baseline',rendered:false});chainComplete=false;continue;}
          try {
            await page.setViewportSize(stage.viewport);
            if(mounted&&await page.locator(target).count()) await page.locator(target).focus();
            const measured=await capture(page,stage.expect,{mode:mounted?'update':'mount',arm,state:initialState(scenario),spec:cell.spec,target});
            // mount allocates the root even if official schema validation rejects its spec.
            const wasMounted=mounted; mounted=true;
            if(!measured.result.ok){rows.push({...base,classification:'schema',rendered:false,validationErrors:measured.result.errors});chainComplete=false;continue;}
            let preAction=measured.preAction;
            if(!wasMounted){
              if(targetNode.type==='Select') await page.locator(target).selectOption(fixture.interaction.enter); else await page.locator(target).fill(fixture.interaction.enter);
              await page.locator(target).focus();
              preAction=await page.evaluate(selector=>{const el=document.querySelector(selector);return {value:el?.value??null,focus:document.activeElement===el,domSignature:[...document.querySelectorAll('[data-node-id]')].map(n=>n.getAttribute('data-node-id'))}},target);
            }
            const stateValue=await page.evaluate(key=>window.REPLAY.state()?.[key]??null,targetNode.id);
            const expectedNodes=[...fixture.nodes,...(stage.id==='structure'?[fixture.help]:[])];
            const semantic=await page.evaluate(nodes=>nodes.every(n=>{const el=document.querySelector(`[data-node-id="${n.id}"]`); if(!el)return false; if(n.text!==undefined)return el.textContent===n.text;if(n.type==='Button')return el.textContent===n.label;const control=el.querySelector('input,select');return control?.getAttribute('aria-label')===n.label&&(!n.options||JSON.stringify([...control.options].map(o=>o.value))===JSON.stringify(n.options))}),expectedNodes);
            const screenshot=`shots/${sha(JSON.stringify([model,scenario,arm,repeat,stage.id]))}.png`;
            await page.screenshot({path:path.join(EVIDENCE,screenshot)});
            const before=await page.evaluate(()=>window.REPLAY.actions().length);
            await page.locator(`[data-node-id="${fixture.interaction.action}"]`).click({timeout:2000});
            await page.waitForFunction(count=>window.REPLAY.actions().length>count,before,{timeout:2000});
            const actions=await page.evaluate(()=>window.REPLAY.actions());
            actionCount++;
            const domPass=JSON.stringify(preAction.domSignature)===JSON.stringify(['layout',...expectedNodes.map(n=>n.id)]);
            const bindingPass=expectedNodes.filter(n=>n.type==='Input'||n.type==='Select').every(n=>JSON.stringify(cell.spec.elements[n.id]?.props?.value)===JSON.stringify({$bindState:`/${n.id}`}));
            const semanticPass=semantic&&domPass&&bindingPass;
            rows.push({...base,rendered:true,classification:!semanticPass?'semantic':!(preAction.value===fixture.interaction.enter&&stateValue===fixture.interaction.enter&&preAction.focus&&actions.length===actionCount&&actions.at(-1)===fixture.interaction.action)?'runtime':errors.length?'runtime':JSON.stringify(measured.final?.host)!==JSON.stringify(hostBefore)?'host':!measured.final?.pass||!measured.themeAdherence?'style':'pass',specValid:true,domPass,semanticPass,domSignature:preAction.domSignature,inputValue:preAction.value,stateValue,inputValuePreserved:preAction.value===fixture.interaction.enter&&stateValue===fixture.interaction.enter,focusPreserved:preAction.focus,actionCount:actions.length,actionPass:actions.length===actionCount&&actions.at(-1)===fixture.interaction.action,stylePass:measured.final?.pass??false,themeAdherence:measured.themeAdherence,hostStyleDelta:measured.final?JSON.stringify(measured.final.host)!==JSON.stringify(hostBefore):null,frames:measured.frames,missingStyleSamples:measured.unstyledFrames,screenshot,errors:[...errors]});
          } catch(error){ rows.push({...base,rendered:false,classification:'runtime',error:String(error.message).slice(0,180),errors:[...errors]});chainComplete=false; }
        }
      } catch(error) {
        for(const stage of fixture.stages) if(!rows.some(row=>row.model===model&&row.scenario===scenario&&row.arm===arm&&row.repeat===repeat&&row.stage===stage.id)) {
          const cell=session.find(row=>row.stage===stage.id);
          rows.push({id:cell?.id??null,model,scenario,arm,sourceArm,repeat,stage:stage.id,status:cell?.status??'missing',rendered:false,classification:'runtime',error:String(error.message).slice(0,180)});
        }
      } finally {await page.close();}
    }
  }
} finally {await browser.close();await new Promise(resolve=>srv.close(resolve));}
fs.writeFileSync(output,JSON.stringify({kind:'captured-output-replay',inputSha256:sha(inputBytes),artifactHashes:{baroBundleSha256:sha(bundleBytes),appBundleSha256:sha(appJS),themeSha256:sha(themeCSS)},inventory,rows},null,2)+'\n');
console.log(JSON.stringify({output,rows:rows.length}));
