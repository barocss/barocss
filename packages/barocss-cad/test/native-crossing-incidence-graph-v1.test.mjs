import assert from 'node:assert/strict';
import test from 'node:test';
import { constructNativeCrossingIncidenceGraphV1 as graph } from '../dist/exact-proof/native-crossing-incidence-graph-v1.js';
const p = (x,y) => ({x,y});
test('proper crossing creates exactly five exact vertices and four oriented subedges', () => {
 const result=graph('edgeA',p(0,0),p(4,4),'edgeB',p(0,4),p(4,0));
 assert.equal(result.status,'exact');
 assert.equal(result.vertices.length,5);
 assert.equal(result.edges.length,4);
 assert.equal(result.crossingVertexId,'crossing');
 assert.deepEqual(result.vertices.map(v=>v.incidentEdgeIds.length),[1,1,1,1,4]);
 assert.deepEqual(result.edges.map(e=>[e.parentEdgeId,e.startVertexId,e.endVertexId]),[
  ['edgeA','first-start','crossing'],['edgeA','crossing','first-end'],
  ['edgeB','second-start','crossing'],['edgeB','crossing','second-end']]);
 assert.deepEqual(result.vertices[4].pointMM,{x:{numerator:'2',denominator:'1'},y:{numerator:'2',denominator:'1'}});
 assert.equal(Object.isFrozen(result),true);
 assert.equal(Object.isFrozen(result.vertices[4].incidentEdgeIds),true);
});
test('edge reversal maintains topology degrees and changes oriented incidence',()=>{
 const base=graph('one',p(0,0),p(4,4),'two',p(0,4),p(4,0));
 const reverse=graph('one',p(4,4),p(0,0),'two',p(0,4),p(4,0));
 assert.equal(base.status,'exact'); assert.equal(reverse.status,'exact');
 assert.deepEqual(base.vertices[4].pointMM,reverse.vertices[4].pointMM);
 assert.deepEqual(reverse.vertices.map(v=>v.incidentEdgeIds.length),[1,1,1,1,4]);
 assert.deepEqual(reverse.vertices[0].pointMM,base.vertices[1].pointMM);
});
test('refuses unsupported edge identifiers, degenerate and boundary intersections',()=>{
 assert.deepEqual(graph('same',p(0,0),p(2,2),'same',p(0,2),p(2,0)),{status:'unsupported',reason:'invalid-edge-ids'});
 assert.deepEqual(graph('first',p(0,0),p(0,0),'second',p(0,1),p(1,0)),{status:'unsupported',reason:'degenerate-segment'});
 assert.deepEqual(graph('first',p(0,0),p(1,0),'second',p(1,0),p(1,1)),{status:'refused',reason:'not-proper-interior-crossing'});
});
