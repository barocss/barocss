import test from 'node:test';
import assert from 'node:assert/strict';
import { GpuRenderer } from '../src/viewport/gpuRenderer';
import { parseInstanceSelection } from '../src/viewport/instanceSelection';
import { BASE } from '@barocss/cad-model/assembly/mates';

// Exercise the actual renderer methods with mesh/material sinks. No GPU or browser.
const cyan = [0, 1, 1], hover = [0, 0.5, 0.5], black = [0, 0, 0];
function rig() {
  const renderer = Object.create(GpuRenderer.prototype) as any;
  Object.assign(renderer, { theme: { selection: cyan, selectionHover: hover, edge: black, base: [1, 1, 1] }, bodies: [], instances: [], settings: null,
    contactLinks: new Set(), hatchLines: new Map(), instanceTiles: new WeakMap(), instancePainted: new WeakMap(), instanceMeshes: new Map(),
    lastItems: [], instanceFaces: [], litBodies: parseInstanceSelection([]), viewer: { requestRender() {} },
    paint() {}, applyClip() {}, mapFor() { return null; }, bindShares() { return false; },
    resolveDisplayMode(view: any) { return { effective: view.displayMode, requested: view.displayMode, supported: true }; } });
  return renderer;
}
function state(extra = {}) { return { displayMode: 'shaded-with-edges', selectedBodies: [], selectedFaces: [], selectedEdges: [], hoverBody: null, ghostBodies: new Set(), offsets: new Map(), ...extra }; }
function body(): any {
  const geometry = { positions: new Float32Array([0,0,0, 10,0,0]) };
  return { result: { key: 'b', mesh: { positions: geometry.positions } }, surface: { material: {}, geometry }, edges: { material: {}, geometry }, highlight: null, state: '' };
}
test('D514 body selection and hover use the existing native line geometry, and clear both on deselection', () => {
  const r = rig(), b = body(), geometry = b.edges.geometry; r.bodies = [b];
  for (const [view, color, width] of [[state({selectedBodies:[0],hoverBody:0}),cyan,3.4], [state({hoverBody:0}),hover,2.2], [state(),black,1.2]] as any[]) {
    r.setState(view); assert.equal(b.surface.outline, null); assert.equal(b.edges.geometry, geometry);
    assert.deepEqual(b.edges.material.color, color); assert.equal(b.edges.material.lineWidth, width);
    assert.equal(b.edges.material.lineOver, false); assert.equal(b.edges.material.lineHidden, 0);
  }
});
test('D514 body suppression, hidden-line modes and red contact warning keep their existing policies', () => {
  const r = rig(), b = body(); r.bodies = [b];
  for (const extra of [{ghostBodies:new Set([0])}, {isolatedInstances:['other']}]) {
    r.setState(state({selectedBodies:[0], ...extra})); assert.deepEqual(b.edges.material.color,black); assert.equal(b.surface.outline,null);
  }
  r.setState(state({selectedBodies:[0], displayMode:'hidden-lines-dashed'})); assert.equal(b.edges.material.lineHidden,0.55); assert.deepEqual(b.edges.material.lineHiddenDash,[6,4]);
  r.setState(state({selectedBodies:[0], displayMode:'wireframe'})); assert.equal(b.edges.material.lineOver,true);
  r.contactLinks.add(BASE); b.state=''; r.setState(state({selectedBodies:[0]})); assert.deepEqual(b.surface.outline,[0.92,0.27,0.24]); assert.deepEqual(b.edges.material.color,black);
});
test('D514 instance selection follows the source body mapping and preserves edge visibility and contact precedence', () => {
  const r = rig(), edge = (): any => ({material:{},visible:true}), it: any = { id:'part', surfaces:[{material:{},geometry:{}},{material:{},geometry:{}}], sharing:[false,false], edges:[edge(),edge()], edgeBody:[0,1], looks:[], threads:null };
  r.instances=[it]; r.lastItems=[{id:'part',sourceBodies:[3,7]}]; r.litBodies=parseInstanceSelection(['part#7']); r.displayMode={effective:'shaded-with-edges'};
  const paint = () => (GpuRenderer.prototype as any).paintInstances.call(r);
  paint(); assert.ok(it.surfaces.every((m:any)=>m.outline===null)); assert.deepEqual(it.edges[0].material.color,black); assert.deepEqual(it.edges[1].material.color,cyan); assert.equal(it.edges[1].material.lineWidth,3.4);
  r.settings={environment:{edges:false},appearances:{},materials:{}}; paint(); assert.equal(it.edges[1].visible,true); assert.equal(it.edges[0].visible,false);
  r.litBodies=parseInstanceSelection([]); paint(); assert.equal(it.edges[1].visible,false); assert.deepEqual(it.edges[1].material.color,black); assert.equal(it.edges[1].material.lineWidth,1.2);
  r.litBodies=parseInstanceSelection(['part']); r.contactLinks.add('part'); paint(); assert.deepEqual(it.edges[1].material.color,black);
  r.contactLinks.clear(); r.view={isolatedInstances:['other']}; paint(); assert.deepEqual(it.edges[1].material.color,black); assert.equal(it.edges[1].material.opacity,0.15);
});

test('D514 selected edges remain visible when ordinary Render edges are off', () => {
  const r=rig(), b=body(); r.bodies=[b]; r.settings={environment:{edges:false},appearances:[],materials:{}};
  r.setState(state({selectedBodies:[0]})); assert.equal(b.edges.visible,true);
  r.setState(state()); assert.equal(b.edges.visible,false);
});

test('D514 native-edge-less local body uses face tint for body selection, hover and clear; explicit face selection wins', () => {
  const r=rig(), b=body(); b.edges=null; b.result.mesh.faceOfVertex=new Uint32Array([4,4,9]); r.bodies=[b]; const seen: [number,number][][]=[];
  r.paint=(_b:any, states:Map<number,number>)=>seen.push([...states]);
  r.setState(state({selectedBodies:[0]})); assert.deepEqual(seen.at(-1),[[4,2],[9,2]]); assert.equal(b.surface.outline,null);
  r.setState(state({hoverBody:0,selectedFaces:[{body:0,face:4}]})); assert.deepEqual(new Map(seen.at(-1)),new Map([[4,2],[9,1]]));
  r.setState(state()); assert.deepEqual(seen.at(-1),[]); assert.equal(b.surface.outline,null);
});
test('D514 edge-less selected instance paints its private face colors without tinting its shared sibling', () => {
  const r=rig(), mesh={edgeLines:new Float32Array(),positions:new Float32Array([0,0,0,1,0,0]),faceOfVertex:new Uint32Array([0,0])};
  const selectedColors:number[][]=[], siblingColors:number[][]=[];
  const shape:any={ref:mesh,colorKey:null,surface:{setColors(c:Float32Array){siblingColors.push([...c]);}}};
  const make=(id:string,sharing:boolean)=>({id,bodies:[{mesh}],surfaces:[{material:{},geometry:{setColors(c:Float32Array){selectedColors.push([...c]);}}}],shapes:[shape],sharing:[sharing],edges:[],edgeBody:[],looks:[],threads:null});
  const selected=make('selected',false), sibling=make('sibling',true);r.instances=[selected,sibling];r.lastItems=[{id:'selected'},{id:'sibling'}];r.instanceMeshes=new Map([['selected',[mesh]],['sibling',[mesh]]]);r.litBodies=parseInstanceSelection(['selected']);r.displayMode={effective:'shaded-with-edges'};
  delete r.bindShares; (GpuRenderer.prototype as any).paintInstances.call(r);
  assert.equal(selected.sharing[0],false);assert.equal(sibling.sharing[0],true);assert.equal(selectedColors.length,1);assert.equal(siblingColors.length,1);
  assert.deepEqual(siblingColors[0],[1,1,1,1,1,1]);assert.notDeepEqual(selectedColors[0],siblingColors[0]);
  assert.ok(selected.surfaces.every((m:any)=>m.outline===null));
});
