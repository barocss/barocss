import assert from 'node:assert/strict';
import test from 'node:test';
import { constructNativeCrossingIncidenceGraphV1 as graph } from '../dist/exact-proof/native-crossing-incidence-graph-v1.js';
import { constructNativeHalfEdgeTwinsV1 as twins } from '../dist/exact-proof/native-half-edge-twins-v1.js';
const p=(x,y)=>({x,y});
test('four exact crossing edges produce eight symmetric directed half-edge twins',()=>{
 const g=graph('edgeA',p(0,0),p(4,4),'edgeB',p(0,4),p(4,0));
 assert.equal(g.status,'exact');
 const result=twins(g);
 assert.equal(result.status,'exact');
 assert.equal(result.halfEdges.length,8);
 const indexed=new Map(result.halfEdges.map(h=>[h.id,h]));
 for (const edge of result.halfEdges) {
  const twin=indexed.get(edge.twinId);
  assert.equal(twin.twinId,edge.id);
  assert.equal(twin.edgeId,edge.edgeId);
  assert.equal(twin.originVertexId,edge.destinationVertexId);
  assert.equal(twin.destinationVertexId,edge.originVertexId);
 }
 assert.equal(Object.isFrozen(result.halfEdges),true);
});
test('incidence tampering and missing vertex are refused',()=>{
 const good=graph('edgeA',p(0,0),p(4,4),'edgeB',p(0,4),p(4,0));
 assert.equal(good.status,'exact');
 const broken=structuredClone(good);
 broken.edges[0].endVertexId='missing';
 assert.equal(twins(broken).status,'refused');
 const broken2=structuredClone(good);
 broken2.vertices[4].incidentEdgeIds=[];
 assert.equal(twins(broken2).status,'refused');
 const broken3=structuredClone(good);
 broken3.edges[1].id=broken3.edges[0].id;
 assert.equal(twins(broken3).status,'refused');
});
