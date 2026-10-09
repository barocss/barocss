// @ts-check
// Fixed chart host policy. It composes public handles, not a general plotting API.
import { createDisplayTree, createDisplayTreeFromScene, createPathBuilder, stringifySceneJSON } from '@barocss/canvas2d';
/** @typedef {import('@barocss/canvas2d').Point} Point */
/** @typedef {{A: Point[], B: Point[]}} Data */
/** @typedef {{tree:import('@barocss/canvas2d').DisplayTree,plot:import('@barocss/canvas2d').FrameHandle,
 * series:{A:import('@barocss/canvas2d').PathHandle,B:import('@barocss/canvas2d').PathHandle},
 * marks:{A:import('@barocss/canvas2d').RectHandle[],B:import('@barocss/canvas2d').RectHandle[]},
 * selection:import('@barocss/canvas2d').PathHandle,data:Data}} Bundle */
export class ChartHostError extends Error {
  /** @param {string} code @param {string} message */
  constructor(code, message) { super(message); this.name = 'ChartHostError'; this.code = code; }
}
export function initialData() {
  return { A: [{x:-1,y:2},{x:0,y:3},{x:1.5,y:7},{x:3,y:5},{x:4,y:5},{x:5.5,y:2},{x:7,y:6},{x:8,y:8}],
    B: [{x:-1,y:8},{x:0,y:7},{x:1.5,y:3},{x:3,y:5},{x:4,y:5},{x:5.5,y:8},{x:7,y:4},{x:8,y:2}] };
}
/** @param {unknown} value @returns {Data} */
export function validateData(value) {
  const data = /** @type {Data} */ (value);
  if (!data || typeof data !== 'object' || !Array.isArray(data.A) || !Array.isArray(data.B) ||
      data.A.length !== 8 || data.B.length !== 8) throw new ChartHostError('HOST_DATA', 'Use two series of eight points');
  const copy = (/** @type {Point[]} */ points) => Array.from(points,point => {
    if (!point || !Number.isFinite(point.x) || !Number.isFinite(point.y) ||
        Math.abs(point.x) > 100 || Math.abs(point.y) > 100) throw new ChartHostError('HOST_DATA', 'Point data must be finite and bounded');
    return {x:point.x,y:point.y};
  });
  return {A:copy(data.A),B:copy(data.B)};
}
/** @param {Point} point */
export function dataToLocal(point) { return {x:point.x * 220 / 7,y:130 - point.y * 13}; }
/** @param {Point} point */
export function localToData(point) { return {x:point.x * 7 / 220,y:(130-point.y)/13}; }
/** @param {import('@barocss/canvas2d').View} view */
export function validateChartView(view) {
  if (!view || ![view.panX,view.panY,view.zoom].every(Number.isFinite) ||
      Math.abs(view.panX)>1000 || Math.abs(view.panY)>1000 || view.zoom<0.5 || view.zoom>4) {
    throw new ChartHostError('HOST_VIEW', 'Pan must be bounded; zoom must be 0.5..4');
  }
  return {panX:view.panX,panY:view.panY,zoom:view.zoom};
}
const pose = (/** @type {number} */ x=0,/** @type {number} */ y=0) => ({x,y,scaleX:1,scaleY:1,rotation:0});
/** @param {Data} data @returns {Bundle} */
export function makeChart(data=initialData()) {
  const copied=validateData(data),tree=createDisplayTree('ClippedChartConsumer');
  tree.stage.addChild(tree.createRect({id:'Back',layer:0,transform:pose(),width:320,height:220,fill:[.1,.12,.16,1]}));
  const plot=tree.createFrame({id:'Plot',layer:1,transform:{...pose(45,40),scaleY:.9,rotation:.14},
    width:220,height:130,fill:[.94,.96,.98,1],clip:true});
  tree.stage.addChild(plot);
  const buildSeries = (/** @type {'A'|'B'} */ key,/** @type {import('@barocss/canvas2d').Color} */ color,/** @type {number} */ layer) => {
    const path=tree.createPath({id:`Series${key}`,layer,transform:pose(),commands:createPathBuilder().polyline(copied[key].map(dataToLocal)).build(),
      stroke:{width:4,color}});plot.addChild(path);
    const marks=copied[key].map((point,index)=>{
      const local=dataToLocal(point),mark=tree.createRect({id:`Mark${key}${index}`,layer:layer+2+index,
        transform:pose(local.x-3,local.y-3),width:6,height:6,fill:color});plot.addChild(mark);return mark;
    });return {path,marks};
  };
  // All B geometry follows A; paint and hit traversal use the same ordering.
  const a=buildSeries('A',[1,.25,.25,1],0),b=buildSeries('B',[.25,.5,1,1],20);
  const selection=tree.createPath({id:'Selection',layer:40,transform:pose(),visible:false,hitMode:'none',
    commands:createPathBuilder().rect(0,0,12,12).build(),stroke:{width:2,color:[1,.8,0,1]}});
  plot.addChild(selection);
  return {tree,plot,series:{A:a.path,B:b.path},marks:{A:a.marks,B:b.marks},selection,data:copied};
}
/** @param {Bundle} bundle @param {string|null} id @param {Point|null} localPoint */
export function setSelection(bundle,id,localPoint) {
  if (!id || !localPoint) {bundle.selection.setVisible(false);return;}
  const handle=bundle.tree.get(id);
  if (!handle || !/^((Series[AB])|(Mark[AB][0-7]))$/.test(id)) throw new ChartHostError('HOST_CHART','Selection ID is not a series or mark');
  if (![localPoint.x,localPoint.y].every(Number.isFinite)) throw new ChartHostError('HOST_CHART','Selection point must be finite');
  bundle.selection.setPath({commands:createPathBuilder().rect(localPoint.x-6,localPoint.y-6,12,12).build(),stroke:bundle.selection.data.stroke});
  bundle.selection.setVisible(true);
}
/** @param {unknown} scene @returns {Bundle} */
export function readChart(scene) {
  const tree=createDisplayTreeFromScene(scene);
  const plot=tree.get('Plot'),back=tree.get('Back'),selection=tree.get('Selection');
  const rawPaths={A:tree.get('SeriesA'),B:tree.get('SeriesB')};
  if (plot?.kind!=='frame' || back?.kind!=='rect' || selection?.kind!=='path' ||
      rawPaths.A?.kind!=='path' || rawPaths.B?.kind!=='path') throw new ChartHostError('HOST_CHART','Chart topology is missing');
  const paths={A:/** @type {import('@barocss/canvas2d').PathHandle} */(rawPaths.A),B:/** @type {import('@barocss/canvas2d').PathHandle} */(rawPaths.B)};
  const data = /** @type {Data} */ ({A:[],B:[]});
  for (const key of /** @type {const} */ (['A','B'])) {
    const path=paths[key];
    if (path.data.commands.length!==8 || path.data.commands.some((c,i)=>c.kind!==(i===0?'M':'L'))) {
      throw new ChartHostError('HOST_CHART','Series must contain one M and seven L commands');
    }
    data[key]=path.data.commands.map(c=>localToData(/** @type {Point} */ (c)));
  }
  const expected=makeChart(data);
  // Scene bytes can preserve a transient outline. Admit its canonical rectangle paint and hide it on Open.
  const corners=selection.data.commands;
  if (corners.length!==5 || corners[0].kind!=='M' || corners[1].kind!=='L' || corners[2].kind!=='L' ||
      corners[3].kind!=='L' || corners[4].kind!=='Z') throw new ChartHostError('HOST_CHART','Selection outline is incompatible');
  const [p0,p1,p2,p3]=/** @type {Point[]} */ (corners.slice(0,4));
  if (p1.x!==p0.x+12 || p1.y!==p0.y || p2.x!==p1.x || p2.y!==p0.y+12 || p3.x!==p0.x || p3.y!==p2.y) {
    throw new ChartHostError('HOST_CHART','Selection outline must be a bounded rectangle');
  }
  expected.selection.setPath({commands:corners,stroke:expected.selection.data.stroke});
  expected.selection.setVisible(selection.data.visible);
  // Mapping data back to local can round slightly. Preserve exact admitted path/mark coordinates in the comparison.
  for (const key of /** @type {const} */ (['A','B'])) {
    expected.series[key].setPath({commands:paths[key].data.commands,stroke:expected.series[key].data.stroke});
    paths[key].data.commands.forEach((c,index)=>{
      const point=/** @type {Point} */(c);expected.marks[key][index].setPosition(point.x-3,point.y-3);
    });
  }
  if (stringifySceneJSON(tree.snapshot())!==stringifySceneJSON(expected.tree.snapshot())) {
    throw new ChartHostError('HOST_CHART','Saved chart fields or topology differ');
  }
  const a=/** @type {import('@barocss/canvas2d').PathHandle} */(paths.A),b=/** @type {import('@barocss/canvas2d').PathHandle} */(paths.B);
  const marksFor=(/** @type {'A'|'B'} */key)=>Array.from({length:8},(_,index)=>
    /** @type {import('@barocss/canvas2d').RectHandle} */(tree.get(`Mark${key}${index}`)));
  return {tree,plot,series:{A:a,B:b},marks:{A:marksFor('A'),B:marksFor('B')},selection,data:validateData(data)};
}
