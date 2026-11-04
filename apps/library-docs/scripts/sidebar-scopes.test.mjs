import test from 'node:test';
import assert from 'node:assert/strict';
import { sidebar, navigationSections, sidebarByRoute } from '../docs/.vitepress/sidebar.mjs';
import { sidebarScopeProblems } from './sidebar-scopes.mjs';
const check = (inventory = sidebar, sections = navigationSections, scopes = sidebarByRoute) => sidebarScopeProblems(inventory, sections, scopes);
test('all ten top menus retain their labels and own one canonical group', () => {
  assert.deepEqual(navigationSections.map(({text,link}) => [text,link]), [
    ['Guide','/guide/getting-started'],['CAD','/packages/cad/'],['CAD Model','/packages/cad-model/'],['CAD React','/packages/cad-react/'],['Physics','/packages/physics/'],['GPU','/packages/gpu/'],['Studio','/studio/'],['Viewer','/packages/viewer/'],['Agent','/agent/'],['Reference','/reference/refusals'],
  ]);
  assert.deepEqual(check(), []);
});
test('nested CAD React pages and the CAD Object API keep their section', () => {
  const react = sidebar.find(item => item.text === 'CAD React'), links = [];
  const visit = item => { if (item.link) links.push(item.link); for (const child of item.items ?? []) visit(child); }; visit(react);
  assert.equal(links.length,26);assert.equal(links.filter(p => p.startsWith('/packages/cad-react/components/')).length,19);
  assert.deepEqual(sidebarByRoute['/packages/cad-react/'],[react]);
  assert.deepEqual(sidebarByRoute['/packages/api'],[sidebar.find(item => item.text === 'CAD')]);
  const withoutAlias = {...sidebarByRoute}; delete withoutAlias['/packages/api'];
  assert.ok(check(sidebar,navigationSections,withoutAlias).some(p => p.includes('/packages/api')));
});
test('a foreign section or unified menu in a route scope refuses', () => {
  const foreign = {...sidebarByRoute,'/packages/cad-react/':sidebarByRoute['/packages/cad-model/']};
  assert.ok(check(sidebar,navigationSections,foreign).some(p => p.includes('must show only CAD React')));
  assert.ok(check(sidebar,navigationSections,{...sidebarByRoute,'/packages/cad-react/':sidebar}).some(p => p.includes('must show only CAD React')));
});
test('missing groups, undeclared scopes and duplicate prefixes refuse', () => {
  assert.ok(check(sidebar.filter(item=>item.text!=='CAD React')).some(p=>p.includes('missing canonical group CAD React')));
  assert.ok(check(sidebar,navigationSections,{...sidebarByRoute,'/unknown/':sidebarByRoute['/']} ).some(p=>p.includes('undeclared prefix /unknown/')));
  assert.ok(check(sidebar,[...navigationSections,{...navigationSections[0]}]).some(p=>p.includes('duplicate prefix')));
});

test('all existing topics keep one explicit category and precede the overview fallback', () => {
  const model = ['sketch-solver','naming','loft-sweep','text','cad-model','manufacturing-previews'];
  const cad = ['boolean','nurbs','tessellation','mass-properties','fillets','exact-boolean','hidden-lines','prismatic','mesh-boolean','closest-point','curve-roots','threads-gears','subd','sheet-metal','mesh-processing','tolerance','validity','import','verification'];
  const expected = [...cad.map(slug => [slug,'CAD']), ...model.map(slug => [slug,'CAD Model']), ['gpu','GPU']];
  const keys = Object.keys(sidebarByRoute), fallback = keys.indexOf('/how/');
  const ownership = new Map();
  const visit = (item, owner) => { if (item.link?.startsWith('/how/')) { assert.equal(ownership.has(item.link),false);ownership.set(item.link,owner); } for (const child of item.items ?? []) visit(child,owner); };
  for (const group of sidebar) visit(group,group.text);
  assert.equal(ownership.size,27);assert.equal(ownership.get('/how/'),'Introduction');
  assert.deepEqual(sidebarByRoute['/how/'],[sidebar.find(x=>x.text==='Introduction')]);
  for (const [slug,owner] of expected) {
    const link='/how/'+slug;assert.equal(ownership.get(link),owner);assert.deepEqual(sidebarByRoute[link],[sidebar.find(x=>x.text===owner)]);
    assert.ok(keys.indexOf(link)<fallback,'explicit topic precedes equal-depth fallback');
    const selected=keys.toSorted((a,b)=>b.split('/').length-a.split('/').length).find(prefix=>link.startsWith(prefix));assert.equal(selected,link,'installed theme prefix choice');
    for(const [other] of expected) if(other!==slug)assert.equal(link.startsWith('/how/'+other),false,'no sibling slug-prefix collision');
  }
  assert.equal(sidebar.some(x=>x.text==='How it works'),false);
});
test('missing, foreign or duplicate topic ownership refuses', () => {
  const missing={...sidebarByRoute};delete missing['/how/boolean'];assert.ok(check(sidebar,navigationSections,missing).some(x=>x.includes('explicit topic owner missing')));
  const foreign={...sidebarByRoute,'/how/gpu':sidebarByRoute['/packages/cad/']};assert.ok(check(sidebar,navigationSections,foreign).some(x=>x.includes('explicit topic owner missing')));
  const duplicate=sidebar.map(x=>x.text==='Viewer'?{...x,items:[...x.items,{text:'Duplicate topic',link:'/how/boolean',lane:'kernel'}]}:x);
  assert.ok(check(duplicate,navigationSections,sidebarByRoute).some(x=>x.includes('duplicate canonical link /how/boolean')));
});

test('top navigation activates only the owner for every base URL, topic and overview', () => {
  const active = path => navigationSections.filter(section=>new RegExp(section.activeMatch).test(path)).map(section=>section.group);
  for (const section of navigationSections) assert.deepEqual(active(section.link),[section.group]);
  const visit = (item,owner) => { if(item.link?.startsWith('/how/')) { assert.deepEqual(active(item.link),[owner]);assert.deepEqual(active(item.link.endsWith('/')?item.link.slice(0,-1):item.link+'/'),[owner]); } for(const child of item.items??[])visit(child,owner); };
  for(const group of sidebar)visit(group,group.text);
  assert.deepEqual(active('/'),['Introduction']);assert.deepEqual(active('/packages/api'),['CAD']);assert.deepEqual(active('/packages/cad-react/components/revolve'),['CAD React']);
  assert.deepEqual(active('/packages/cad-model/'),['CAD Model']);assert.deepEqual(active('/how/gpu'),['GPU']);assert.deepEqual(active('/how/'),['Introduction']);
  const globalGuide=navigationSections.map(section=>section.text==='Guide'?{...section,activeMatch:'^/'}:section);
  assert.ok(check(sidebar,globalGuide,sidebarByRoute).some(problem=>problem.includes('must activate only')));
});
