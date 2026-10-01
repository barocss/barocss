import fs from 'node:fs';
import path from 'node:path';
import { createHash, randomUUID } from 'node:crypto';

const packageRoot = new URL('../../../packages/barocss-render/', import.meta.url);
const manifest = JSON.parse(fs.readFileSync(new URL('package.json', packageRoot), 'utf8'));
const { validateSpec } = await import(new URL(manifest.exports['.'].import, packageRoot));
const sha256 = /^[0-9a-f]{64}$/;
const slug = /^[a-z][a-z0-9-]{0,63}$/;
function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().filter((key) => value[key] !== undefined).map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
const digest = (value) => createHash('sha256').update(Buffer.isBuffer(value) ? value : canonical(value)).digest('hex');
const fail = (condition, message) => { if (!condition) throw new Error(message); };
function privateRoot(root, create = false) {
  fail(typeof root === 'string' && path.isAbsolute(root), 'Absolute workflow evidence root required');
  // Reject symlink traversal in ancestors as well as the artifact directory.
  let current = path.parse(root).root;
  for (const part of root.slice(current.length).split(path.sep).filter(Boolean)) {
    current = path.join(current, part);
    if (!fs.existsSync(current)) {
      fail(create, 'Missing workflow evidence directory');
      fs.mkdirSync(current, { mode: 0o700 });
    }
    fail(fs.lstatSync(current).isDirectory(), 'Regular evidence directories required');
  }
  fail((fs.statSync(root).mode & 0o077) === 0, 'Private workflow evidence directory required');
}
function read(file, max = 4 * 1024 * 1024) {
  const stat = fs.lstatSync(file);
  fail(stat.isFile() && stat.size <= max && (stat.mode & 0o077) === 0, 'Bounded private regular artifact required');
  return fs.readFileSync(file);
}
function binding(state, pointer) {
  return pointer.slice(1).split('/').reduce((value, key) => {
    fail(value && typeof value === 'object' && Object.hasOwn(value, key), 'Missing panel binding');
    return value[key];
  }, state);
}
function validateSnapshot(snapshot) {
  fail(snapshot?.version === 1 && snapshot.context?.version === 1 && snapshot.state && typeof snapshot.state === 'object', 'Versioned workflow snapshot required');
  const context = snapshot.context;
  fail(['fixtureDigest', 'presetDigest', 'baselineDigest'].every((key) => sha256.test(context[key])) && typeof context.rendererVersion === 'string', 'Invalid workflow context digests');
  fail(context.build && ['renderer', 'runtime', 'bundle'].every((key) => sha256.test(context.build[key])), 'Invalid workflow build digests');
  fail(Number.isSafeInteger(context.baselineSamples) && context.baselineSamples >= 0 && context.baselineSamples <= 1000, 'Bounded baseline associations required');
  const panels = snapshot.projection?.panels;
  fail(Array.isArray(panels) && panels.length >= 1 && panels.length <= 4, 'One to four current renderer panels required');
  const ids = new Set();
  for (const panel of panels) {
    fail(typeof panel.id === 'string' && slug.test(panel.id) && !ids.has(panel.id), 'Unique safe panel IDs required'); ids.add(panel.id);
    fail(Number.isSafeInteger(panel.revision) && panel.revision >= 0 && typeof panel.title === 'string', 'Panel revision and title required');
    fail(validateSpec(panel.spec, panel.contract).ok, 'Invalid current panel Spec or contract');
    const nodes = Object.values(panel.spec.elements);
    fail(nodes.length >= 2 && nodes.length <= 32 && panel.contract.actions.length <= 32 && panel.contract.textBindings.length <= 32, 'Panel exceeds renderer bounds');
    for (const pointer of panel.contract.textBindings) {
      const value = binding(panel.state, pointer);
      fail(typeof value === 'string' && value.length >= 1 && value.length <= 80, 'Invalid current panel text binding');
    }
    fail(panel.commands && typeof panel.commands === 'object' && !Array.isArray(panel.commands) && Object.keys(panel.commands).length <= 32, 'Bounded panel commands required');
    fail(Object.keys(panel.commands).every((action) => panel.contract.actions.includes(action)), 'Undeclared panel command');
  }
  fail(Buffer.byteLength(canonical(snapshot)) <= 2 * 1024 * 1024, 'Workflow snapshot exceeds evidence bound');
}
function validateMetadata(record) {
  fail(record?.version === 1 && record.kind === 'authored-workflow-capture' && slug.test(record.name), 'Invalid workflow capture metadata');
  fail(/^[0-9a-f]{40}$/.test(record.candidateSha) && typeof record.browserVersion === 'string' && record.browserVersion.length >= 1 && record.browserVersion.length <= 200, 'Exact candidate and browser required');
  fail([1200, 390].includes(record.viewport?.width) && record.viewport.height === 900, 'Unsupported capture viewport');
  fail(Array.isArray(record.trace) && record.trace.length <= 128 && Buffer.byteLength(canonical(record.trace)) <= 262144, 'Bounded operation trace required');
  fail(['errors', 'csp', 'external'].every((key) => Array.isArray(record[key]) && record[key].length === 0), 'Browser/CSP/external failures invalidate capture');
  validateSnapshot(record.snapshot);
  fail(record.snapshotDigest === digest(record.snapshot) && record.projectionDigest === digest(record.snapshot.projection) && record.stateDigest === digest(record.snapshot.state), 'Snapshot association digest mismatch');
  fail(sha256.test(record.imageDigest) && record.fixtureDigest === record.snapshot.context.fixtureDigest && record.presetDigest === record.snapshot.context.presetDigest && canonical(record.build) === canonical(record.snapshot.context.build), 'Context association digest mismatch');
  fail(record.noHorizontalOverflow === true && Array.isArray(record.observed), 'Missing browser observations');
  if (record.snapshot.state.view === 'orders') {
    const rows=record.snapshot.projection.tableRows;
    fail(Array.isArray(rows)&&rows.length<=4&&Array.isArray(record.hostTable)&&record.hostTable.length===rows.length,'Missing bounded host table observations');
    for(const [index,row] of rows.entries()) {
      const observation=record.hostTable[index];
      const summary=`${row.lineCount} lines · ${row.productSummary.length>65?row.productSummary.slice(0,65)+'…':row.productSummary}`;
      fail(observation.id===row.id && canonical(observation.cells)===canonical([row.id,row.customer,summary,row.date,row.status,row.total])
        && observation.selected===(record.snapshot.state.orders.selected===row.id)
        && observation.checked===record.snapshot.state.orders.checked.includes(row.id), 'Host table observation differs from projected relation/state');
    }
  }
  const expected = record.snapshot.projection.panels.flatMap((panel) => Object.values(panel.spec.elements).map((node) => ({ panel, node })));
  fail(record.observed.length === expected.length, 'Incomplete panel observations');
  const seen = new Set();
  for (const { panel, node } of expected) {
    const observation = record.observed.find((item) => item.panelId === panel.id && item.id === node.props.id);
    const key = `${panel.id}:${node.props.id}`;
    fail(observation && !seen.has(key) && observation.type === node.type && observation.height > 0, 'Missing or duplicate visible panel node'); seen.add(key);
    if (node.type === 'Text') fail(observation.text === node.props.text, 'Text observation differs from current Spec');
    if (node.type === 'Button') fail(observation.text === node.props.label, 'Action observation differs from current Spec');
    if (node.type === 'Input') fail(observation.text === binding(panel.state, node.props.value.$bindState), 'Input observation differs from current state');
    if (node.type === 'Layout') {
      fail(observation.display === 'grid' && Math.abs(parseFloat(observation.gap) - (node.props.gap === 'fractional' ? .625 : .875) * observation.rem) < .1, 'Layout runtime CSS differs');
      fail(observation.columns === (node.props.columns === 'responsive' && record.viewport.width >= 768 ? 2 : 1), 'Layout column observation differs');
    }
    if (node.type === 'Card') fail(Math.abs(parseFloat(observation.padding) - (node.props.padding === 'fractional' ? .875 : 1.375) * observation.rem) < .1 && (node.props.tone === 'light' ? observation.background === 'rgb(255, 255, 255)' : observation.background.startsWith('oklch(')), 'Card runtime CSS differs');
  }
}
export function verifyArtifacts(root) {
  privateRoot(root);
  const indexFile = path.join(root, 'workflow-index.json');
  if (!fs.existsSync(indexFile)) {
    fail(fs.readdirSync(root).every((name) => name === '.workflow-lock'), 'Unindexed workflow evidence exists');
    return { version: 1, captures: [] };
  }
  const index = JSON.parse(read(indexFile));
  fail(index?.version === 1 && Array.isArray(index.captures) && index.captures.length <= 1000, 'Invalid bounded workflow index');
  const names = new Set();
  for (const item of index.captures) {
    fail(slug.test(item.name) && !names.has(item.name) && sha256.test(item.metadataDigest) && sha256.test(item.imageDigest), 'Invalid or duplicate capture association'); names.add(item.name);
    const metadata = JSON.parse(read(path.join(root, `${item.name}.json`)));
    validateMetadata(metadata);
    fail(metadata.name === item.name && digest(metadata) === item.metadataDigest && metadata.imageDigest === item.imageDigest, 'Metadata index digest mismatch');
    const image = read(path.join(root, `${item.name}.png`), 16 * 1024 * 1024);
    fail(image.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) && digest(image) === item.imageDigest, 'Missing, corrupt or mismatched PNG');
  }
  const allowed = new Set(['workflow-index.json', '.workflow-lock', ...[...names].flatMap((name) => [`${name}.json`, `${name}.png`])]);
  fail(fs.readdirSync(root).every((name) => allowed.has(name)), 'Unindexed workflow evidence exists');
  return index;
}
export async function recordCapture({ page, root, name, trace = [], candidateSha, browserVersion, errors = [], csp = [], external = [] }) {
  fail(typeof name === 'string' && slug.test(name), 'Safe fresh capture name required');
  privateRoot(root, true);
  const lock = path.join(root, '.workflow-lock');
  const fd = fs.openSync(lock, 'wx', 0o600); fs.closeSync(fd);
  try {
    const index = verifyArtifacts(root);
    fail(index.captures.length < 1000 && !index.captures.some((item) => item.name === name), 'Immutable capture name already exists or limit reached');
    const viewport = page.viewportSize();
    fail([1200,390].includes(viewport?.width) && viewport.height === 900, 'Capture requires desktop/mobile fixed viewport');
    await page.waitForFunction(() => {
      const panels = window.WORKFLOW?.snapshot()?.projection?.panels;
      if (!panels?.length || document.documentElement.scrollWidth > innerWidth) return false;
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      return panels.every((panel) => {
        const host = [...document.querySelectorAll('[data-panel]')].find((element) => element.getAttribute('data-panel') === panel.id);
        return host && Object.values(panel.spec.elements).every((node) => {
          const element = [...host.querySelectorAll('[data-node-id]')].find((item) => item.dataset.nodeId === node.props.id);
          if (!element || element.getBoundingClientRect().height <= 0) return false;
          const style = getComputedStyle(element);
          if (node.type === 'Text') return element.textContent === node.props.text;
          if (node.type === 'Button') return element.textContent === node.props.label;
          if (node.type === 'Input') return element.value === node.props.value.$bindState.slice(1).split('/').reduce((value,key) => value?.[key], panel.state);
          if (node.type === 'Layout') return style.display === 'grid' && Math.abs(parseFloat(style.gap) - (node.props.gap === 'fractional' ? .625 : .875) * rem) < .1 && style.gridTemplateColumns.split(' ').length === (node.props.columns === 'responsive' && innerWidth >= 768 ? 2 : 1);
          return Math.abs(parseFloat(style.paddingTop) - (node.props.padding === 'fractional' ? .875 : 1.375) * rem) < .1 && (node.props.tone === 'light' ? style.backgroundColor === 'rgb(255, 255, 255)' : style.backgroundColor.startsWith('oklch('));
        });
      });
    });
    const observation = await page.evaluate(() => {
      const snapshot = structuredClone(window.WORKFLOW.snapshot());
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize);
      const observed = snapshot.projection.panels.flatMap((panel) => {
        const host = [...document.querySelectorAll('[data-panel]')].find((element) => element.getAttribute('data-panel') === panel.id);
        return Object.values(panel.spec.elements).map((node) => {
          const element = [...host.querySelectorAll('[data-node-id]')].find((item) => item.dataset.nodeId === node.props.id), style = getComputedStyle(element);
          return { panelId: panel.id, id: node.props.id, type: node.type, text: element.tagName === 'INPUT' ? element.value : element.textContent,
            display: style.display, gap: style.gap, padding: style.paddingTop, background: style.backgroundColor, columns: style.gridTemplateColumns.split(' ').length, height: element.getBoundingClientRect().height, rem };
        });
      });
      const hostTable=[...document.querySelectorAll('[data-order-id]')].map(row=>({id:row.dataset.orderId,selected:row.getAttribute('aria-selected')==='true',checked:row.querySelector('input[type=checkbox]').checked,cells:[...row.querySelectorAll('[data-cell-value]')].map(cell=>cell.textContent)}));
      return { snapshot, observed, hostTable, noHorizontalOverflow: document.documentElement.scrollWidth <= innerWidth, browserCsp: window.CSP_EVENTS ?? [] };
    });
    const snapshot = observation.snapshot;
    const record = { version: 1, kind: 'authored-workflow-capture', name, candidateSha, browserVersion, viewport, trace: structuredClone(trace), snapshot,
      fixtureDigest: snapshot.context.fixtureDigest, presetDigest: snapshot.context.presetDigest, build: snapshot.context.build,
      snapshotDigest: digest(snapshot), projectionDigest: digest(snapshot.projection), stateDigest: digest(snapshot.state),
      observed: observation.observed, hostTable: observation.hostTable, noHorizontalOverflow: observation.noHorizontalOverflow, errors: [...errors], csp: [...csp, ...observation.browserCsp], external: [...external], imageDigest: '0'.repeat(64) };
    validateMetadata(record);
    const image = await page.screenshot({ fullPage: true }); record.imageDigest = digest(image);
    fail(digest(await page.evaluate(() => window.WORKFLOW.snapshot())) === record.snapshotDigest, 'State changed during workflow capture');
    fail(errors.length === 0 && external.length === 0, 'Capture accumulated browser failures');
    fs.writeFileSync(path.join(root, `${name}.png`), image, { flag: 'wx', mode: 0o600 });
    fs.writeFileSync(path.join(root, `${name}.json`), canonical(record) + '\n', { flag: 'wx', mode: 0o600 });
    index.captures.push({ name, metadataDigest: digest(record), imageDigest: record.imageDigest });
    const temporary = path.join(root, `.workflow-index-${randomUUID()}`);
    fs.writeFileSync(temporary, canonical(index) + '\n', { flag: 'wx', mode: 0o600 });
    fs.renameSync(temporary, path.join(root, 'workflow-index.json'));
    verifyArtifacts(root);
    return { name, image: path.join(root, `${name}.png`), metadata: path.join(root, `${name}.json`), imageDigest: record.imageDigest, metadataDigest: digest(record), captures: index.captures.length };
  } finally { fs.unlinkSync(lock); }
}
