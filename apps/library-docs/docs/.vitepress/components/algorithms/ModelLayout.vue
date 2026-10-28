<script setup>
// Auto layout (packages/barocss-cad-model/src/drawing/layout.ts) on the bolt-circle plate of the conformance case
// packages/barocss-cad/conformance/r14/layout-bolt-circle: an 80 × 80 × 10 plate, six Ø6 holes evenly on a Ø40 circle.
// Every number below was recorded by running the package on that case (a scratch script calling projectViews,
// chooseViews, layoutSheet, issueContext, autoDimensions, fixAll and placeDimensionLabels in autoLayout's order; the
// result matched autoLayout's own: A4, 1:2, 4 layouts tried, nothing left). VIEWS: the kernel's hidden-line projections
// in view coordinates (mm, rounded to 0.1), each piece [visible, points]. ATTEMPTS: each layout tried — its scale and
// round, the room it was given, where the views went (sheet mm, y down), what Auto-dimension said each side needs and
// which sides were crowded, the issues left, and the dimensions as the sheet draws them (lines, arrowheads, texts).
import { computed, ref } from 'vue';
import AlgoFigure from './AlgoFigure.vue';
import { ease, useSteps } from './useSteps.mjs';

const VIEWS = {"top":[[1,[[0,0],[80,0]]],[1,[[80,0],[80,80]]],[1,[[80,80],[0,80]]],[1,[[0,0],[0,80]]],[1,[[63,40],[62.9,40.8],[62.6,41.5],[62.1,42.1],[61.5,42.6],[60.8,42.9],[60,43],[59.2,42.9],[58.5,42.6],[57.9,42.1],[57.4,41.5],[57.1,40.8],[57,40]]],[1,[[57,40],[57.1,39.2],[57.4,38.5],[57.9,37.9],[58.5,37.4],[59.2,37.1],[60,37],[60.8,37.1],[61.5,37.4],[62.1,37.9],[62.6,38.5],[62.9,39.2],[63,40]]],[1,[[53,57.3],[52.9,58.1],[52.6,58.8],[52.1,59.4],[51.5,59.9],[50.8,60.2],[50,60.3],[49.2,60.2],[48.5,59.9],[47.9,59.4],[47.4,58.8],[47.1,58.1],[47,57.3]]],[1,[[47,57.3],[47.1,56.5],[47.4,55.8],[47.9,55.2],[48.5,54.7],[49.2,54.4],[50,54.3],[50.8,54.4],[51.5,54.7],[52.1,55.2],[52.6,55.8],[52.9,56.5],[53,57.3]]],[1,[[33,57.3],[32.9,58.1],[32.6,58.8],[32.1,59.4],[31.5,59.9],[30.8,60.2],[30,60.3],[29.2,60.2],[28.5,59.9],[27.9,59.4],[27.4,58.8],[27.1,58.1],[27,57.3]]],[1,[[27,57.3],[27.1,56.5],[27.4,55.8],[27.9,55.2],[28.5,54.7],[29.2,54.4],[30,54.3],[30.8,54.4],[31.5,54.7],[32.1,55.2],[32.6,55.8],[32.9,56.5],[33,57.3]]],[1,[[23,40],[22.9,40.8],[22.6,41.5],[22.1,42.1],[21.5,42.6],[20.8,42.9],[20,43],[19.2,42.9],[18.5,42.6],[17.9,42.1],[17.4,41.5],[17.1,40.8],[17,40]]],[1,[[17,40],[17.1,39.2],[17.4,38.5],[17.9,37.9],[18.5,37.4],[19.2,37.1],[20,37],[20.8,37.1],[21.5,37.4],[22.1,37.9],[22.6,38.5],[22.9,39.2],[23,40]]],[1,[[33,22.7],[32.9,23.5],[32.6,24.2],[32.1,24.8],[31.5,25.3],[30.8,25.6],[30,25.7],[29.2,25.6],[28.5,25.3],[27.9,24.8],[27.4,24.2],[27.1,23.5],[27,22.7]]],[1,[[27,22.7],[27.1,21.9],[27.4,21.2],[27.9,20.6],[28.5,20.1],[29.2,19.8],[30,19.7],[30.8,19.8],[31.5,20.1],[32.1,20.6],[32.6,21.2],[32.9,21.9],[33,22.7]]],[1,[[53,22.7],[52.9,23.5],[52.6,24.2],[52.1,24.8],[51.5,25.3],[50.8,25.6],[50,25.7],[49.2,25.6],[48.5,25.3],[47.9,24.8],[47.4,24.2],[47.1,23.5],[47,22.7]]],[1,[[47,22.7],[47.1,21.9],[47.4,21.2],[47.9,20.6],[48.5,20.1],[49.2,19.8],[50,19.7],[50.8,19.8],[51.5,20.1],[52.1,20.6],[52.6,21.2],[52.9,21.9],[53,22.7]]]],"front":[[1,[[0,0],[80,0]]],[1,[[80,0],[80,10]]],[1,[[0,10],[80,10]]],[1,[[0,0],[0,10]]],[0,[[63,0],[63,10]]],[0,[[57,0],[57,10]]],[0,[[53,0],[53,10]]],[0,[[47,0],[47,10]]],[0,[[33,0],[33,10]]],[0,[[27,0],[27,10]]],[0,[[23,0],[23,10]]],[0,[[17,0],[17,10]]],[0,[[33,0],[33,10]]],[0,[[27,0],[27,10]]],[0,[[53,0],[53,10]]],[0,[[47,0],[47,10]]]],"iso":[[1,[[0,0],[56.6,-32.7]]],[1,[[56.6,-32.7],[56.6,-24.5]]],[1,[[0,8.2],[56.6,-24.5]]],[1,[[0,0],[0,8.2]]],[1,[[56.6,-32.7],[113.1,0]]],[1,[[113.1,0],[113.1,8.2]]],[1,[[56.6,-24.5],[113.1,8.2]]],[0,[[113.1,0],[56.6,32.7]]],[0,[[56.6,32.7],[56.6,40.8]]],[1,[[113.1,8.2],[56.6,40.8]]],[0,[[0,0],[56.6,32.7]]],[1,[[0,8.2],[56.6,40.8]]],[0,[[72.8,-9.4],[73.3,-9],[73.6,-8.6],[73.7,-8.2],[73.6,-7.7],[73.3,-7.3],[72.8,-6.9],[72.2,-6.7],[71.5,-6.5],[70.7,-6.4],[69.9,-6.5],[69.2,-6.7],[68.6,-6.9]]],[1,[[72.8,-1.2],[73.3,-0.9],[73.6,-0.4],[73.7,0],[73.6,0.4],[73.3,0.9],[72.8,1.2],[72.2,1.5],[71.5,1.7],[70.7,1.7],[69.9,1.7],[69.2,1.5],[68.6,1.2]]],[0,[[68.6,-6.9],[68.1,-7.3],[67.8,-7.7],[67.7,-8.2],[67.8,-8.6],[68.1,-9],[68.6,-9.4],[69.2,-9.7],[69.9,-9.8],[70.7,-9.9],[71.5,-9.8],[72.2,-9.7],[72.8,-9.4]]],[1,[[68.6,1.2],[68.1,0.9],[67.8,0.4],[67.7,0],[67.8,-0.4],[68.1,-0.9],[68.6,-1.2],[69.2,-1.5],[69.9,-1.7],[70.7,-1.7],[71.5,-1.7],[72.2,-1.5],[72.8,-1.2]]],[0,[[78,1.8],[78.5,2.1],[78.8,2.5],[78.9,3],[78.8,3.4],[78.5,3.8],[78,4.2],[77.4,4.5],[76.7,4.7],[75.9,4.7],[75.1,4.7],[74.4,4.5],[73.8,4.2]]],[1,[[78,9.9],[78.5,10.3],[78.8,10.7],[78.9,11.2],[78.8,11.6],[78.5,12],[78,12.4],[77.4,12.6],[76.7,12.8],[75.9,12.9],[75.1,12.8],[74.4,12.6],[73.8,12.4]]],[0,[[73.8,4.2],[73.3,3.8],[73,3.4],[72.9,3],[73,2.5],[73.3,2.1],[73.8,1.8],[74.4,1.5],[75.1,1.3],[75.9,1.3],[76.7,1.3],[77.4,1.5],[78,1.8]]],[1,[[73.8,12.4],[73.3,12],[73,11.6],[72.9,11.2],[73,10.7],[73.3,10.3],[73.8,9.9],[74.4,9.6],[75.1,9.5],[75.9,9.4],[76.7,9.5],[77.4,9.6],[78,9.9]]],[0,[[63.9,9.9],[64.3,10.3],[64.6,10.7],[64.7,11.2],[64.6,11.6],[64.3,12],[63.9,12.4],[63.2,12.6],[62.5,12.8],[61.7,12.9],[61,12.8],[60.2,12.6],[59.6,12.4]]],[1,[[63.9,18.1],[64.3,18.4],[64.6,18.9],[64.7,19.3],[64.6,19.8],[64.3,20.2],[63.9,20.5],[63.2,20.8],[62.5,21],[61.7,21],[61,21],[60.2,20.8],[59.6,20.5]]],[0,[[59.6,12.4],[59.2,12],[58.8,11.6],[58.7,11.2],[58.8,10.7],[59.2,10.3],[59.6,9.9],[60.2,9.6],[61,9.5],[61.7,9.4],[62.5,9.5],[63.2,9.6],[63.9,9.9]]],[1,[[59.6,20.5],[59.2,20.2],[58.8,19.8],[58.7,19.3],[58.8,18.9],[59.2,18.4],[59.6,18.1],[60.2,17.8],[61,17.6],[61.7,17.6],[62.5,17.6],[63.2,17.8],[63.9,18.1]]],[0,[[44.6,6.9],[45,7.3],[45.3,7.7],[45.4,8.2],[45.3,8.6],[45,9],[44.6,9.4],[43.9,9.7],[43.2,9.8],[42.4,9.9],[41.6,9.8],[40.9,9.7],[40.3,9.4]]],[1,[[44.6,15.1],[45,15.5],[45.3,15.9],[45.4,16.3],[45.3,16.8],[45,17.2],[44.6,17.6],[43.9,17.8],[43.2,18],[42.4,18.1],[41.6,18],[40.9,17.8],[40.3,17.6]]],[0,[[40.3,9.4],[39.8,9],[39.5,8.6],[39.4,8.2],[39.5,7.7],[39.8,7.3],[40.3,6.9],[40.9,6.7],[41.6,6.5],[42.4,6.4],[43.2,6.5],[43.9,6.7],[44.6,6.9]]],[1,[[40.3,17.6],[39.8,17.2],[39.5,16.8],[39.4,16.3],[39.5,15.9],[39.8,15.5],[40.3,15.1],[40.9,14.8],[41.6,14.7],[42.4,14.6],[43.2,14.7],[43.9,14.8],[44.6,15.1]]],[0,[[39.4,-4.2],[39.8,-3.8],[40.2,-3.4],[40.2,-3],[40.2,-2.5],[39.8,-2.1],[39.4,-1.8],[38.8,-1.5],[38,-1.3],[37.2,-1.3],[36.5,-1.3],[35.8,-1.5],[35.1,-1.8]]],[1,[[39.4,4],[39.8,4.3],[40.2,4.7],[40.2,5.2],[40.2,5.6],[39.8,6],[39.4,6.4],[38.8,6.7],[38,6.8],[37.2,6.9],[36.5,6.8],[35.8,6.7],[35.1,6.4]]],[0,[[35.1,-1.8],[34.6,-2.1],[34.4,-2.5],[34.2,-3],[34.4,-3.4],[34.6,-3.8],[35.1,-4.2],[35.8,-4.5],[36.5,-4.7],[37.2,-4.7],[38,-4.7],[38.8,-4.5],[39.4,-4.2]]],[1,[[35.1,6.4],[34.6,6],[34.4,5.6],[34.2,5.2],[34.4,4.7],[34.6,4.3],[35.1,4],[35.8,3.7],[36.5,3.5],[37.2,3.4],[38,3.5],[38.8,3.7],[39.4,4]]],[0,[[53.5,-12.4],[54,-12],[54.3,-11.6],[54.4,-11.2],[54.3,-10.7],[54,-10.3],[53.5,-9.9],[52.9,-9.6],[52.2,-9.5],[51.4,-9.4],[50.6,-9.5],[49.9,-9.6],[49.3,-9.9]]],[1,[[53.5,-4.2],[54,-3.8],[54.3,-3.4],[54.4,-3],[54.3,-2.5],[54,-2.1],[53.5,-1.8],[52.9,-1.5],[52.2,-1.3],[51.4,-1.3],[50.6,-1.3],[49.9,-1.5],[49.3,-1.8]]],[0,[[49.3,-9.9],[48.8,-10.3],[48.5,-10.7],[48.4,-11.2],[48.5,-11.6],[48.8,-12],[49.3,-12.4],[49.9,-12.6],[50.6,-12.8],[51.4,-12.9],[52.2,-12.8],[52.9,-12.6],[53.5,-12.4]]],[1,[[49.3,-1.8],[48.8,-2.1],[48.5,-2.5],[48.4,-3],[48.5,-3.4],[48.8,-3.8],[49.3,-4.2],[49.9,-4.5],[50.6,-4.7],[51.4,-4.7],[52.2,-4.7],[52.9,-4.5],[53.5,-4.2]]],[0,[[73.7,0],[73.7,-8.2]]],[0,[[67.7,0],[67.7,-8.2]]],[0,[[78.9,11.2],[78.9,3]]],[0,[[72.9,11.2],[72.9,3]]],[0,[[64.7,19.3],[64.7,11.2]]],[0,[[58.7,19.3],[58.7,11.2]]],[0,[[45.4,16.3],[45.4,8.2]]],[0,[[39.4,16.3],[39.4,8.2]]],[0,[[40.2,5.2],[40.2,-3]]],[0,[[34.2,5.2],[34.2,-3]]],[0,[[54.4,-3],[54.4,-11.2]]],[0,[[48.4,-3],[48.4,-11.2]]]]};
const ATTEMPTS = [{"scale":1,"round":0,"fits":true,"room":{},"place":{"front":{"origin":[40.93,145],"box":[40.93,135,120.93,145]},"top":{"origin":[40.93,113],"box":[40.93,33,120.93,113]},"iso":{"origin":[142.93,77.08],"box":[142.93,36.26,256.07,109.74]}},"crowded":[{"view":"top","side":"below","needed":25,"room":22}],"needs":{"top":{"above":14,"below":18,"left":22,"right":0},"front":{"above":0,"below":14,"left":0,"right":14}},"left":[],"before":[],"dims":[{"id":"d1","l":[[40.9,112,40.9,21],[80.9,72,80.9,21],[40.9,23,80.9,23]],"f":[[[40.9,23],[43.9,22.4],[43.9,23.6]],[[80.9,23],[77.9,23.6],[77.9,22.4]]],"t":[["40",59,21.8,0]]},{"id":"d2","l":[[39.9,113,28.9,113],[79.9,73,28.9,73],[30.9,113,30.9,73]],"f":[[[30.9,113],[30.3,110],[31.5,110]],[[30.9,73],[31.5,76],[30.3,76]]],"t":[["40",29.7,95,90]]},{"id":"d3","l":[[39.9,113,20.9,113],[39.9,33,20.9,33],[22.9,113,22.9,33]],"f":[[[22.9,113],[22.3,110],[23.5,110]],[[22.9,33],[23.5,36],[22.3,36]]],"t":[["80",21.7,75,90]]},{"id":"d4","l":[[61.5,75.9,69.9,119],[69.9,119,72.9,119]],"f":[[[61.5,75.9],[62.7,78.8],[61.5,79]]],"t":[["6× Ø6 THRU",73.7,119,0]]},{"id":"d5","l":[[89.6,91,106.9,127],[106.9,127,109.9,127]],"f":[[[89.6,91],[91.4,93.5],[90.4,94]]],"t":[["Ø40 PCD · 6× EQ SP",110.7,127,0]]},{"id":"d6","l":[[40.9,146,40.9,157],[120.9,146,120.9,157],[40.9,155,120.9,155]],"f":[[[40.9,155],[43.9,154.4],[43.9,155.6]],[[120.9,155],[117.9,155.6],[117.9,154.4]]],"t":[["80",79,153.8,0]]},{"id":"d7","l":[[41.9,145,132.9,145],[41.9,135,132.9,135],[130.9,145,130.9,135]],"f":[[[130.9,145],[130.3,142],[131.5,142]],[[130.9,135],[131.5,138],[130.3,138]]],"t":[["10",129.7,142,90]]}]},{"scale":1,"round":1,"fits":false,"room":{"front":{"below":14,"right":14},"top":{"above":14,"below":18,"left":22}},"place":{"front":{"origin":[46.43,145],"box":[46.43,135,126.43,145]},"top":{"origin":[46.43,107],"box":[46.43,27,126.43,107]},"iso":{"origin":[148.43,71.08],"box":[148.43,30.26,261.57,103.74]}}},{"scale":0.5,"round":0,"fits":true,"room":{},"place":{"front":{"origin":[89.22,122.5],"box":[89.22,117.5,129.22,122.5]},"top":{"origin":[89.22,95.5],"box":[89.22,55.5,129.22,95.5]},"iso":{"origin":[151.22,77.54],"box":[151.22,57.13,207.78,93.87]}},"crowded":[{"view":"top","side":"below","needed":25,"room":22}],"needs":{"top":{"above":14,"below":18,"left":22,"right":0},"front":{"above":0,"below":14,"left":0,"right":14}},"left":["TEXT_OVER_LINES"],"before":[],"dims":[{"id":"d1","l":[[89.2,94.5,89.2,43.5],[109.2,74.5,109.2,43.5],[89.2,45.5,109.2,45.5]],"f":[[[89.2,45.5],[92.2,44.9],[92.2,46.1]],[[109.2,45.5],[106.2,46.1],[106.2,44.9]]],"t":[["40",97.3,44.3,0]]},{"id":"d2","l":[[88.2,95.5,77.2,95.5],[108.2,75.5,77.2,75.5],[79.2,95.5,79.2,75.5]],"f":[[[79.2,95.5],[78.6,92.5],[79.8,92.5]],[[79.2,75.5],[79.8,78.5],[78.6,78.5]]],"t":[["40",78,87.4,90]]},{"id":"d3","l":[[88.2,95.5,69.2,95.5],[88.2,55.5,69.2,55.5],[71.2,95.5,71.2,55.5]],"f":[[[71.2,95.5],[70.6,92.5],[71.8,92.5]],[[71.2,55.5],[71.8,58.5],[70.6,58.5]]],"t":[["80",70,77.4,90]]},{"id":"d4","l":[[99.6,76.9,106.7,101.5],[106.7,101.5,109.7,101.5]],"f":[[[99.6,76.9],[101,79.7],[99.9,80]]],"t":[["6× Ø6 THRU",110.5,101.5,0]]},{"id":"d5","l":[[113.5,84.6,125.2,109.5],[125.2,109.5,128.2,109.5]],"f":[[[113.5,84.6],[115.3,87],[114.2,87.5]]],"t":[["Ø40 PCD · 6× EQ SP",129,109.5,0]]},{"id":"d6","l":[[89.2,123.5,89.2,134.5],[129.2,123.5,129.2,134.5],[89.2,132.5,129.2,132.5]],"f":[[[89.2,132.5],[92.2,131.9],[92.2,133.1]],[[129.2,132.5],[126.2,133.1],[126.2,131.9]]],"t":[["80",107.3,131.3,0]]},{"id":"d7","l":[[90.2,122.5,141.2,122.5],[90.2,117.5,141.2,117.5],[139.2,128.5,139.2,111.5]],"f":[[[139.2,122.5],[139.8,125.5],[138.6,125.5]],[[139.2,117.5],[138.6,114.5],[139.8,114.5]]],"t":[["10",138,122,90]]}]},{"scale":0.5,"round":1,"fits":true,"room":{"front":{"below":14,"right":14},"top":{"above":14,"below":18,"left":22}},"place":{"front":{"origin":[94.72,122],"box":[94.72,117,134.72,122]},"top":{"origin":[94.72,89],"box":[94.72,49,134.72,89]},"iso":{"origin":[156.72,71.04],"box":[156.72,50.63,213.28,87.37]}},"crowded":[],"needs":{"top":{"above":14,"below":18,"left":22,"right":0},"front":{"above":0,"below":14,"left":0,"right":14}},"left":[],"before":["TEXT_OVER_LINES"],"dims":[{"id":"d1","l":[[94.7,88,94.7,37],[114.7,68,114.7,37],[94.7,39,114.7,39]],"f":[[[94.7,39],[97.7,38.4],[97.7,39.6]],[[114.7,39],[111.7,39.6],[111.7,38.4]]],"t":[["40",102.8,37.8,0]]},{"id":"d2","l":[[93.7,89,82.7,89],[113.7,69,82.7,69],[84.7,89,84.7,69]],"f":[[[84.7,89],[84.1,86],[85.3,86]],[[84.7,69],[85.3,72],[84.1,72]]],"t":[["40",83.5,81,90]]},{"id":"d3","l":[[93.7,89,74.7,89],[93.7,49,74.7,49],[76.7,89,76.7,49]],"f":[[[76.7,89],[76.1,86],[77.3,86]],[[76.7,49],[77.3,52],[76.1,52]]],"t":[["80",75.5,71,90]]},{"id":"d4","l":[[104,70.3,91.6,92.7],[91.6,92.7,88.6,92.7]],"f":[[[104,70.3],[103.1,73.2],[102,72.6]]],"t":[["6× Ø6 THRU",68,92.7,0]]},{"id":"d5","l":[[119,78,130.7,103],[130.7,103,133.7,103]],"f":[[[119,78],[120.8,80.5],[119.7,81]]],"t":[["Ø40 PCD · 6× EQ SP",134.5,103,0]]},{"id":"d6","l":[[94.7,123,94.7,134],[134.7,123,134.7,134],[94.7,132,134.7,132]],"f":[[[94.7,132],[97.7,131.4],[97.7,132.6]],[[134.7,132],[131.7,132.6],[131.7,131.4]]],"t":[["80",112.8,130.8,0]]},{"id":"d7","l":[[95.7,122,146.7,122],[95.7,117,146.7,117],[144.7,128,144.7,111]],"f":[[[144.7,122],[145.3,125],[144.1,125]],[[144.7,117],[144.1,114],[145.3,114]]],"t":[["10",143.5,121.4,90]]}]}];
// The right view (dropped): its outline and the holes' hidden lines, as projected.
const RIGHT = [[1, [[0, 0], [80, 0]]], [1, [[80, 0], [80, 10]]], [1, [[0, 10], [80, 10]]], [1, [[0, 0], [0, 10]]],
  ...[19.7, 25.7, 37, 43, 54.3, 60.3].map(x => [0, [[x, 0], [x, 10]]])];

const root = ref(null);
const SHEET = [297, 210], FRAME = [10, 10, 287, 200], TITLE = [167, 168, 287, 200], AREA = [24, 24, 273, 154];
/** A view's pieces as two paths (visible, hidden) in its own coordinates, y up turned to the sheet's y down. */
function paths(pieces) {
  const out = ['', ''];
  for (const [vis, p] of pieces) out[vis ? 0 : 1] += 'M' + p.map(q => q[0] + ',' + -q[1]).join('L');
  return out;
}
const PATHS = { top: paths(VIEWS.top), front: paths(VIEWS.front), iso: paths(VIEWS.iso), right: paths(RIGHT) };
const DIMS = ATTEMPTS.map(a => (a.dims ?? []).map(d => ({
  id: d.id,
  lines: d.l.map(l => 'M' + l[0] + ',' + l[1] + 'L' + l[2] + ',' + l[3]).join(''),
  heads: d.f.map(f => f.map(q => q.join(',')).join(' ')),
  texts: d.t.map(([text, x, y, angle]) => ({ text, x, y, angle })),
})));
// Zooms: the whole sheet; the 1:1 views; the 1:2 views ([x0, y0, scale] onto the 380 × 250 picture).
const fit = (x0, y0, x1, y1, left = 0) => { const z = Math.min((380 - left) / (x1 - x0), 250 / (y1 - y0)); return { x0, y0, z, sx: left + (380 - left - z * (x1 - x0)) / 2, sy: (250 - z * (y1 - y0)) / 2 }; };
const Z = { sheet: fit(0, 0, SHEET[0], SHEET[1]), one: fit(12, 12, 160, 162, 0), half: fit(60, 28, 222, 140) };
Z.one.sx = 8;
const mixZ = (a, b, u) => ({ x0: a.x0 + (b.x0 - a.x0) * u, y0: a.y0 + (b.y0 - a.y0) * u, z: a.z + (b.z - a.z) * u, sx: a.sx + (b.sx - a.sx) * u, sy: a.sy + (b.sy - a.sy) * u });

const steps = [
  { label: 'Which views', text: 'Front and top are always shown; the isometric as set. The right view is dropped when it adds nothing: no circle shows round in it, no curve, and every visible straight edge\'s position is already in the top view (across) or the front view (up). Here its holes are only hidden lines, so it goes. One placed by hand, a dimension or a note, would keep it.', formula: 'shown: front, top, isometric &nbsp; dropped: right' },
  { label: 'Scale: largest that fits, if the holes read', text: 'The standard scales are tried largest first. A scale must let the smallest hole be 2.5 mm across on paper (an estimate for centre lines, leader and callout to fit): Ø6 allows 1:1 and 1:2. The first tried is the largest at which the views alone fit the drawing area (the frame less 14 mm, above the title block): 1:1. Views in one column share their horizontal mapping, in one row their vertical, 22 mm apart.', formula: '6 mm × s ≥ 2.5 mm → s ∈ {1, 0.5} &nbsp; scales: 10, 5, 2, 1, 0.5, 0.2, … &nbsp; A4, then A3' },
  { label: 'Auto-dimension the views', text: 'From the projections: overall sizes (80 and 10 in the front view, 80 deep in the top), positions from each view\'s low extreme (here the ring\'s centre: 40, 40), and one callout a kind of hole. Six holes evenly round a point are a ring: its pitch circle and centre are dimensioned, not each hole. Rows go out from the view on its freer side, 10 mm then every 8 mm, inner rows the shorter; callouts on the other side.', formula: 'overall 3 · positions 2 · callouts 2 &nbsp; "6× Ø6 THRU", "Ø40 PCD · 6× EQ SP"' },
  { label: 'What each side needs', text: 'Auto-dimension also says how much sheet each side of a view takes. Below the top view: two callout rows (6 + 8 mm, then 4 for the text) and the view\'s name (7): 25 mm. The gap to the front view is 22. That side is crowded, an error, so this layout is not taken.', formula: 'top · below: 6 + 8 + 4 + 7 = 25 mm &nbsp; room 22 mm → crowded' },
  { label: 'More room, then no fit', text: 'The layout runs again with each side given the room its rows took (to the next half millimetre): the gaps and margins widen. At 1:1 the views then need 131 mm of height and the drawing area has 130, so 1:1 does not fit and the next scale is tried. Each scale gets at most four such rounds.', formula: 'room: top { above 14, below 18, left 22 }, front { below 14, right 14 } &nbsp; 131 &gt; 130 mm' },
  { label: '1:2, first round', text: 'At 1:2 with no extra room the same side is crowded again (25 mm against 22), and the callout\'s text lies over the part\'s lines (TEXT_OVER_LINES, an error).', formula: 'errors: crowded 1 + issues 1' },
  { label: '1:2 with room: clean', text: 'With the room from the round before, every side has its rows. Then the issue list\'s moves run on what still overlaps: the Ø6 callout is moved to the other side of its hole. Nothing is left on the issue list, so this is taken: A4 at 1:2, after four layouts. It is what the conformance case expects.', formula: 'A4 · 1:2 · tried 4 · left: none · readable (Ø6 → 3 mm)' },
];
const s = useSteps(steps.length, [3000, 3400, 4200, 3200, 3600, 3400, 3800], root);
const k = computed(() => ease(s.t.value));
// Which attempt each step shows (index into ATTEMPTS), and the zoom.
const AT = [0, 0, 0, 0, 1, 2, 3];
const zoom = computed(() => {
  const n = s.step.value, u = ease(Math.min(1, s.t.value / 0.45));
  if (n <= 1) return Z.sheet;
  if (n === 2) return mixZ(Z.sheet, Z.one, u);
  if (n <= 4) return Z.one;
  if (n === 5) return mixZ(Z.one, Z.half, u);
  return Z.half;
});
const groupTf = computed(() => { const zm = zoom.value; return `translate(${zm.sx} ${zm.sy}) scale(${zm.z}) translate(${-zm.x0} ${-zm.y0})`; });
// The views' placements, moving from one attempt's to the next in steps 5 and 7.
const place = computed(() => {
  const n = s.step.value, cur = ATTEMPTS[AT[n]].place, prev = n === 4 ? ATTEMPTS[0].place : n === 6 ? ATTEMPTS[2].place : null;
  if (!prev) return cur;
  const u = ease(Math.min(1, s.t.value / 0.5)), out = {};
  for (const v of ['top', 'front', 'iso']) out[v] = { origin: [0, 1].map(i => prev[v].origin[i] + (cur[v].origin[i] - prev[v].origin[i]) * u), box: [0, 1, 2, 3].map(i => prev[v].box[i] + (cur[v].box[i] - prev[v].box[i]) * u) };
  return out;
});
const scaleNow = computed(() => ATTEMPTS[AT[s.step.value]].scale);
const viewTf = v => `translate(${place.value[v].origin[0]} ${place.value[v].origin[1]}) scale(${scaleNow.value})`;
// The right view, where it would stand (its cell: under the isometric, in the front's row) while it is dropped.
const rightTf = computed(() => `translate(${ATTEMPTS[0].place.iso.box[0]} ${ATTEMPTS[0].place.front.origin[1]}) scale(1)`);
const rightOpacity = computed(() => (s.step.value === 0 ? 1 - k.value * 0.85 : 0));
// Dimensions shown: appearing one by one in step 3; those of the attempt shown after; none where the layout did not fit.
const dims = computed(() => {
  const n = s.step.value, list = DIMS[AT[n]];
  if (n < 2) return [];
  if (n === 2) return list.slice(0, Math.max(0, Math.ceil((s.t.value - 0.45) / 0.55 * list.length)));
  if (n === 6 && s.t.value < 0.5) return [];
  return list;
});
const crowdBand = computed(() => {
  const n = s.step.value; if (n !== 3 && n !== 5) return null;
  const b = ATTEMPTS[AT[n]].place.top.box, front = ATTEMPTS[AT[n]].place.front.box, grow = n === 3 ? k.value : 1;
  return { have: [b[0], b[3], b[2] - b[0], front[1] - b[3]], need: [b[0], b[3], b[2] - b[0], 25 * grow] };
});
// Step 5: the room each side was given, round the views as they move.
const roomBands = computed(() => {
  if (s.step.value !== 4) return [];
  const t = place.value.top.box, f = place.value.front.box, u = k.value;
  return [[t[0], t[1] - 14 * u, t[2] - t[0], 14 * u], [t[0], t[3], t[2] - t[0], 25 * u], [t[0] - 22 * u, t[1], 22 * u, t[3] - t[1]], [f[0], f[3], f[2] - f[0], 21 * u], [f[2], f[1], 14 * u, f[3] - f[1]]];
});
// Step 5: the height the views would take, 24 → 155 mm, against the drawing area's bottom at 154.
const overflow = computed(() => (s.step.value === 4 && s.t.value > 0.5 ? { x: AREA[0] - 5, y0: AREA[1], y1: place.value.front.box[3] + 10 } : null));
const textOver = computed(() => (s.step.value === 5 && s.t.value > 0.45 ? DIMS[2].find(d => d.id === 'd4').texts[0] : null));
const NOTE = [
  null,
  { x: 40, y: 222, t: 'Ø6 at 1:1: 6 mm on paper' },
  { x: 372, y: 18, t: '1:1', a: 'end' },
  { x: 372, y: 18, t: '1:1 · crowded: 25 > 22', a: 'end', hot: true },
  { x: 372, y: 18, t: '1:1 · 131 > 130 mm: does not fit', a: 'end', hot: true },
  { x: 372, y: 18, t: '1:2 · crowded, text over lines', a: 'end', hot: true },
  { x: 372, y: 18, t: 'A4 · 1:2 · clean', a: 'end', ok: true },
];
</script>

<template>
  <div ref="root">
    <AlgoFigure title="Auto layout: views, scale, dimension rows and room" :steps="steps" :s="s">
      <svg viewBox="0 0 380 250" role="img" aria-label="An A4 sheet: the views of a bolt-circle plate are placed at 1:1, dimensioned, found crowded, given room, then laid out again at 1:2 until nothing overlaps">
        <g :transform="groupTf">
          <rect x="0" y="0" :width="SHEET[0]" :height="SHEET[1]" class="sheet" />
          <rect :x="FRAME[0]" :y="FRAME[1]" :width="FRAME[2] - FRAME[0]" :height="FRAME[3] - FRAME[1]" class="frame" />
          <rect :x="TITLE[0]" :y="TITLE[1]" :width="TITLE[2] - TITLE[0]" :height="TITLE[3] - TITLE[1]" class="title" />
          <rect v-if="s.step.value === 1 || s.step.value === 4" :x="AREA[0]" :y="AREA[1]" :width="AREA[2] - AREA[0]" :height="AREA[3] - AREA[1]" class="area" />
          <rect v-for="(r, i) in roomBands" :key="'r' + i" :x="r[0]" :y="r[1]" :width="Math.max(0, r[2])" :height="Math.max(0, r[3])" class="room" />
          <g v-if="crowdBand">
            <rect :x="crowdBand.need[0]" :y="crowdBand.need[1]" :width="crowdBand.need[2]" :height="Math.max(0, crowdBand.need[3])" class="need" />
            <rect :x="crowdBand.have[0]" :y="crowdBand.have[1]" :width="crowdBand.have[2]" :height="crowdBand.have[3]" class="have" />
          </g>
          <g v-for="v in ['top', 'front', 'iso']" :key="v" :transform="viewTf(v)">
            <path :d="PATHS[v][1]" class="hidden" /><path :d="PATHS[v][0]" class="visible" />
          </g>
          <g :transform="rightTf" :style="{ opacity: rightOpacity }">
            <path :d="PATHS.right[1]" class="hidden" /><path :d="PATHS.right[0]" class="visible dropped" />
            <path d="M0,0L80,-10M0,-10L80,0" class="cross" />
          </g>
          <g v-if="overflow"><path :d="`M${overflow.x},${overflow.y0}L${overflow.x},${overflow.y1}M${overflow.x - 2},${overflow.y1}L${overflow.x + 110},${overflow.y1}`" class="over" /></g>
          <g v-for="d in dims" :key="d.id" class="dim">
            <path :d="d.lines" class="dim-line" />
            <polygon v-for="(h, i) in d.heads" :key="i" :points="h" class="dim-head" />
            <text v-for="(t, i) in d.texts" :key="'t' + i" :x="t.x" :y="t.y" :transform="t.angle ? `rotate(${-t.angle} ${t.x} ${t.y})` : undefined" class="dim-text">{{ t.text }}</text>
          </g>
          <rect v-if="textOver" :x="textOver.x - 0.6" :y="textOver.y - 3.2" width="21.5" height="4.2" class="text-over" />
        </g>
        <text v-if="NOTE[s.step.value]" :x="NOTE[s.step.value].x" :y="NOTE[s.step.value].y" :text-anchor="NOTE[s.step.value].a ?? 'start'" :class="['note', { hot: NOTE[s.step.value].hot, ok: NOTE[s.step.value].ok }]">{{ NOTE[s.step.value].t }}</text>
        <text v-if="s.step.value === 0" x="40" y="222" class="note">right view dropped</text>
      </svg>
      <template #note>The views, the placements, the needs and the dimensions are the package's own, recorded on the
        conformance case <code>r14/layout-bolt-circle</code>; the picture only zooms between them. The right view is drawn
        in its cell to show what is dropped (a dropped view is placed nowhere). The box round the callout's text in step 6
        marks it, at an estimated text width.</template>
    </AlgoFigure>
  </div>
</template>

<style scoped>
svg { --a: #167e9a; --b: #b87412; --hot: #c75351; --keep: #24956d; }
:global(.dark) svg { --a: #66bad3; --b: #e4b866; --hot: #ef8a87; --keep: #6dcb9e; }
svg text { font-family: var(--vp-font-family-base); font-size: 11px; fill: var(--vp-c-text-2); }
.sheet { fill: var(--vp-c-bg); stroke: var(--vp-c-divider); stroke-width: 1; vector-effect: non-scaling-stroke; }
.frame, .title { fill: none; stroke: var(--vp-c-text-2); stroke-width: 1; vector-effect: non-scaling-stroke; }
.area { fill: none; stroke: var(--a); stroke-width: 1; stroke-dasharray: 4 3; vector-effect: non-scaling-stroke; }
.room { fill: var(--keep); fill-opacity: 0.14; stroke: none; }
.need { fill: var(--hot); fill-opacity: 0.18; }
.have { fill: none; stroke: var(--a); stroke-width: 1; stroke-dasharray: 3 2; vector-effect: non-scaling-stroke; }
.visible { fill: none; stroke: var(--vp-c-text-1); stroke-width: 1.2; stroke-linejoin: round; vector-effect: non-scaling-stroke; }
.hidden { fill: none; stroke: var(--vp-c-text-3); stroke-width: 0.8; stroke-dasharray: 3 2; vector-effect: non-scaling-stroke; }
.dropped { stroke: var(--vp-c-text-3); }
.cross { fill: none; stroke: var(--hot); stroke-width: 1.4; vector-effect: non-scaling-stroke; }
.over { fill: none; stroke: var(--hot); stroke-width: 1.6; vector-effect: non-scaling-stroke; }
.dim-line { fill: none; stroke: var(--b); stroke-width: 0.8; vector-effect: non-scaling-stroke; }
.dim-head { fill: var(--b); }
.dim-text { font-size: 3.5px; fill: var(--b); }
.text-over { fill: none; stroke: var(--hot); stroke-width: 1.4; vector-effect: non-scaling-stroke; }
.note { font-size: 11px; font-weight: 600; fill: var(--vp-c-text-1); }
.note.hot { fill: var(--hot); } .note.ok { fill: var(--keep); }
</style>
