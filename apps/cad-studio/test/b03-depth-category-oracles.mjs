// D542: four separate saved parts; current captures do not rewrite historical receipts.
import {inspectorSource as retainedInspector} from './bracket-baseline-oracles.mjs';
import {oracleSource as enclosureOracle} from './enclosure-baseline-oracles.mjs';
export const cases={
  "partial": {
    "caseId": "partial",
    "seedPath": "/tmp/barocss-d463-workflow-run01/07-Revolve180-Depth40-saved-opfs.bcad",
    "seedBytes": 608,
    "seedSHA256": "5c338c615c18693cbfd0a80c988ee1d9b1a63252930c326094e7ed4d9246c12d",
    "seedText": "{\n  \"format\": \"barocss-cad-model\",\n  \"schema\": 3,\n  \"units\": \"mm\",\n  \"parameters\": {},\n  \"nodes\": [\n    {\n      \"kind\": \"sketch\",\n      \"profile\": \"rectangle\",\n      \"min\": [\n        10,\n        20\n      ],\n      \"max\": [\n        20,\n        60\n      ],\n      \"sideTags\": {\n        \"outer\": [\n          \"e1\",\n          \"e2\",\n          \"e3\",\n          \"e4\"\n        ]\n      },\n      \"id\": \"n0\"\n    },\n    {\n      \"kind\": \"revolve\",\n      \"sketch\": 0,\n      \"axis\": \"y\",\n      \"angle\": 180,\n      \"id\": \"n1\"\n    }\n  ],\n  \"outputs\": {\n    \"b1\": {\n      \"node\": 1,\n      \"side\": \"solid\"\n    }\n  },\n  \"nextId\": 2\n}",
    "parameters": {
      "A": {
        "angle": 180,
        "depth": 40
      },
      "B": {
        "angle": 90,
        "depth": 40
      },
      "C": {
        "angle": 90,
        "depth": 30
      }
    },
    "fields": {
      "B": {
        "index": 1,
        "key": "deg",
        "label": "Angle",
        "value": 90
      },
      "C": {
        "index": 1,
        "key": "d",
        "label": "Depth",
        "value": 30
      },
      "postOpen": {
        "index": 1,
        "key": "d",
        "label": "Depth",
        "value": 40
      }
    },
    "guards": [
      {
        "index": 1,
        "key": "deg",
        "label": "Angle",
        "value": 0,
        "expectedCode": "INPUT",
        "expectedFeature": "n1"
      }
    ],
    "originalOracle": "/tmp/barocss-d463-geometry/revolve-oracle.py",
    "historicalCustody": "RETAINED_HISTORICAL_ONLY"
  },
  "blind": {
    "caseId": "blind",
    "seedPath": "/tmp/barocss-d498-workflow-run01/06-H12-D4-public-saved-opfs.bcad",
    "seedBytes": 1321,
    "seedSHA256": "988611ced7f76a056df7a045fd3c23586517481dfadd0de4deba5ef9f4c6eca8",
    "seedText": "{\n  \"format\": \"barocss-cad-model\",\n  \"schema\": 3,\n  \"units\": \"mm\",\n  \"parameters\": {},\n  \"nodes\": [\n    {\n      \"kind\": \"sketch\",\n      \"profile\": \"rectangle\",\n      \"min\": [\n        -20,\n        -20\n      ],\n      \"max\": [\n        60,\n        20\n      ],\n      \"outline\": {\n        \"points\": [\n          [\n            -20,\n            -20\n          ],\n          [\n            60,\n            -20\n          ],\n          [\n            60,\n            20\n          ],\n          [\n            -20,\n            20\n          ]\n        ],\n        \"lengths\": {\n          \"0\": 80,\n          \"1\": 40\n        },\n        \"hv\": {\n          \"h\": [\n            0,\n            2\n          ],\n          \"v\": [\n            1,\n            3\n          ]\n        }\n      },\n      \"sideTags\": {\n        \"outer\": [\n          \"e1\",\n          \"e2\",\n          \"e3\",\n          \"e4\"\n        ]\n      },\n      \"id\": \"n0\"\n    },\n    {\n      \"kind\": \"extrude\",\n      \"sketch\": 0,\n      \"height\": 12,\n      \"id\": \"n1\"\n    },\n    {\n      \"kind\": \"hole\",\n      \"parent\": {\n        \"node\": 1,\n        \"side\": \"solid\"\n      },\n      \"radius\": 2,\n      \"center\": [\n        20,\n        0\n      ],\n      \"face\": \"n1.top\",\n      \"depth\": 4,\n      \"id\": \"n2\"\n    }\n  ],\n  \"outputs\": {\n    \"b2\": {\n      \"node\": 2,\n      \"side\": \"solid\"\n    }\n  },\n  \"nextId\": 3\n}",
    "parameters": {
      "A": {
        "height": 12,
        "depth": 4
      },
      "B": {
        "height": 10,
        "depth": 4
      },
      "C": {
        "height": 10,
        "depth": 3
      }
    },
    "fields": {
      "B": {
        "index": 1,
        "key": "h",
        "label": "Distance",
        "value": 10
      },
      "C": {
        "index": 2,
        "key": "depth",
        "label": "Depth",
        "value": 3
      },
      "postOpen": {
        "index": 2,
        "key": "depth",
        "label": "Depth",
        "value": 4
      }
    },
    "guards": [
      {
        "index": 2,
        "key": "depth",
        "label": "Depth",
        "value": 0,
        "expectedCode": "PARAMETER",
        "expectedFeature": "n2"
      }
    ],
    "originalOracle": "/tmp/barocss-d498-geometry01/physical-oracle.py",
    "historicalCustody": "RETAINED_HISTORICAL_ONLY"
  },
  "counterbore": {
    "caseId": "counterbore",
    "seedPath": "/tmp/barocss-d500-workflow-run01/06-H12-D4-public-saved-opfs.bcad",
    "seedBytes": 1535,
    "seedSHA256": "f2866bb360876da5e0c804382525d19cc91d2c54d4a1a268ff929056b4299529",
    "seedText": "{\n  \"format\": \"barocss-cad-model\",\n  \"schema\": 3,\n  \"units\": \"mm\",\n  \"parameters\": {},\n  \"nodes\": [\n    {\n      \"kind\": \"sketch\",\n      \"profile\": \"rectangle\",\n      \"min\": [\n        -20,\n        -20\n      ],\n      \"max\": [\n        60,\n        20\n      ],\n      \"outline\": {\n        \"points\": [\n          [\n            -20,\n            -20\n          ],\n          [\n            60,\n            -20\n          ],\n          [\n            60,\n            20\n          ],\n          [\n            -20,\n            20\n          ]\n        ],\n        \"lengths\": {\n          \"0\": 80,\n          \"1\": 40\n        },\n        \"hv\": {\n          \"h\": [\n            0,\n            2\n          ],\n          \"v\": [\n            1,\n            3\n          ]\n        }\n      },\n      \"sideTags\": {\n        \"outer\": [\n          \"e1\",\n          \"e2\",\n          \"e3\",\n          \"e4\"\n        ]\n      },\n      \"id\": \"n0\"\n    },\n    {\n      \"kind\": \"extrude\",\n      \"sketch\": 0,\n      \"height\": 12,\n      \"id\": \"n1\"\n    },\n    {\n      \"kind\": \"hole\",\n      \"parent\": {\n        \"node\": 1,\n        \"side\": \"solid\"\n      },\n      \"radius\": 2,\n      \"center\": [\n        20,\n        0\n      ],\n      \"face\": \"n1.top\",\n      \"id\": \"n2\"\n    },\n    {\n      \"kind\": \"hole\",\n      \"parent\": {\n        \"node\": 2,\n        \"side\": \"solid\"\n      },\n      \"radius\": 4,\n      \"depth\": 4,\n      \"center\": [\n        20,\n        0\n      ],\n      \"face\": \"n1.top\",\n      \"id\": \"n3\"\n    }\n  ],\n  \"outputs\": {\n    \"b3\": {\n      \"node\": 3,\n      \"side\": \"solid\"\n    }\n  },\n  \"nextId\": 4\n}",
    "parameters": {
      "A": {
        "height": 12,
        "depth": 4
      },
      "B": {
        "height": 10,
        "depth": 4
      },
      "C": {
        "height": 10,
        "depth": 3
      }
    },
    "fields": {
      "B": {
        "index": 1,
        "key": "h",
        "label": "Distance",
        "value": 10
      },
      "C": {
        "index": 3,
        "key": "depth",
        "label": "Depth",
        "value": 3
      },
      "postOpen": {
        "index": 3,
        "key": "depth",
        "label": "Depth",
        "value": 4
      }
    },
    "guards": [
      {
        "index": 3,
        "key": "dia",
        "label": "Diameter",
        "value": 0,
        "expectedCode": "PARAMETER",
        "expectedFeature": "n3"
      },
      {
        "index": 3,
        "key": "depth",
        "label": "Depth",
        "value": 0,
        "expectedCode": "PARAMETER",
        "expectedFeature": "n3"
      }
    ],
    "originalOracle": "/tmp/barocss-d500-geometry01/physical-oracle.py",
    "historicalCustody": "RETAINED_HISTORICAL_ONLY"
  },
  "countersink": {
    "caseId": "countersink",
    "seedPath": "/tmp/barocss-d501-root-routing-error-quarantine01/06-H12-CS10-public-saved-opfs.bcad",
    "seedBytes": 1328,
    "seedSHA256": "ec9d659bfaa76c6c66aae0163afa302ef0b34f653baa39f595aa72c858e1ca41",
    "seedText": "{\n  \"format\": \"barocss-cad-model\",\n  \"schema\": 3,\n  \"units\": \"mm\",\n  \"parameters\": {},\n  \"nodes\": [\n    {\n      \"kind\": \"sketch\",\n      \"profile\": \"rectangle\",\n      \"min\": [\n        -20,\n        -20\n      ],\n      \"max\": [\n        60,\n        20\n      ],\n      \"outline\": {\n        \"points\": [\n          [\n            -20,\n            -20\n          ],\n          [\n            60,\n            -20\n          ],\n          [\n            60,\n            20\n          ],\n          [\n            -20,\n            20\n          ]\n        ],\n        \"lengths\": {\n          \"0\": 80,\n          \"1\": 40\n        },\n        \"hv\": {\n          \"h\": [\n            0,\n            2\n          ],\n          \"v\": [\n            1,\n            3\n          ]\n        }\n      },\n      \"sideTags\": {\n        \"outer\": [\n          \"e1\",\n          \"e2\",\n          \"e3\",\n          \"e4\"\n        ]\n      },\n      \"id\": \"n0\"\n    },\n    {\n      \"kind\": \"extrude\",\n      \"sketch\": 0,\n      \"height\": 12,\n      \"id\": \"n1\"\n    },\n    {\n      \"kind\": \"hole\",\n      \"parent\": {\n        \"node\": 1,\n        \"side\": \"solid\"\n      },\n      \"radius\": 2,\n      \"center\": [\n        20,\n        0\n      ],\n      \"face\": \"n1.top\",\n      \"countersink\": 10,\n      \"id\": \"n2\"\n    }\n  ],\n  \"outputs\": {\n    \"b2\": {\n      \"node\": 2,\n      \"side\": \"solid\"\n    }\n  },\n  \"nextId\": 3\n}",
    "parameters": {
      "A": {
        "height": 12,
        "countersink": 10
      },
      "B": {
        "height": 10,
        "countersink": 10
      },
      "C": {
        "height": 10,
        "countersink": 8
      }
    },
    "fields": {
      "B": {
        "index": 1,
        "key": "h",
        "label": "Distance",
        "value": 10
      },
      "C": {
        "index": 2,
        "key": "csk",
        "label": "Countersink Ø",
        "value": 8
      },
      "postOpen": {
        "index": 2,
        "key": "csk",
        "label": "Countersink Ø",
        "value": 10
      }
    },
    "guards": [
      {
        "index": 2,
        "key": "dia",
        "label": "Diameter",
        "value": 0,
        "expectedCode": "PARAMETER",
        "expectedFeature": "n2"
      },
      {
        "index": 2,
        "key": "csk",
        "label": "Countersink Ø",
        "value": 4,
        "expectedCode": "INPUT",
        "expectedFeature": "n2"
      }
    ],
    "originalOracle": "/tmp/barocss-d501-geometry02/physical-oracle.py",
    "historicalCustody": "FAIL_UNRECOVERABLE_ORIGINAL_AGGREGATE"
  }
};
export const caseConfigs=cases;
export const builderFiles=['apps/cad-studio/test/b03-depth-category-oracles.mjs','apps/cad-studio/test/bracket-baseline-oracles.mjs','apps/cad-studio/test/enclosure-baseline-oracles.mjs','apps/cad-studio/test/enclosure-admission-preflight.mjs'];
export const inventoryContract='Pin all four actual saved input bytes, every builderFiles import, the resolved native/compiler closure, and exact expanded inspector TS/preflight TS/Python plus executed bundles. New D542 packets only; exact-Doc cache misses capture current output. Original receipts remain immutable.';
export const caseConfigJSON=JSON.stringify(cases);
export const collectorCompatibility={originalModuleSHA256:'52b9c01fc3263f31da7884b5543936742404798abb8ca4c6cb3d1890a5fda679',allowedChange:'QUALIFICATION_BOUNDS_WITNESS_ONLY_INSPECTOR_UNCHANGED',requirements:['All original numerical native/compiler .ts source pins remain exact.','caseConfigJSON and expanded inspectorSource identity remain exact; no parameter/source-family or capture change.','Retain original executed observer source/bundle bytes and hashes; do not claim edited collector module matches its old hash.','Retain original packet bytes/hash and original nativeBRepJSON/hash. Derived bounds witness lives in a separate record with both hashes.','Only current D542 control packets may be reused; actual Doc/compiled PartDoc identity and fresh Worker/Python binding remain required.'],firstFailure:'PRESERVE_CONTROL01_COUNTERSINK_A_FAIL; FINAL_ADMISSION_JOINS_PREFIX_AND_CONTINUATION'};
const cut=(s,a,b)=>{const i=s.indexOf(a),j=s.indexOf(b,i);if(i<0||j<=i)throw Error('retained utility boundary changed: '+a);return s.slice(i,j);};
const d0=retainedInspector.indexOf('  const selected=snapshot.outputs.findIndex'),d1=retainedInspector.indexOf('  result.outputIds=');
if(d0<0||d1<=d0)throw Error('retained display boundary changed');
// This lifecycle uses existing editors. No B01 line/pick mapper applies.
const observer=retainedInspector.slice(0,d0)+"  result.display={status:'NOT_REQUESTED_EXISTING_FEATURE_EDITOR_LIFECYCLE',authority:'NO_DISPLAY_GEOMETRY_AS_PHYSICAL_TRUTH'};\n"+retainedInspector.slice(d1);
// The STEP helper may explicitly decline a trimmed curved face. This records
// that policy separately from actual original vertices/straight outer edges.
const boundsDiagnostic=String.raw`
function observeBounds(raw:any,request:any){
 if(raw.bounds!==undefined)return {status:raw.bounds?.observationError?'ERROR_STEP_VALIDATION_BOUNDS':'AVAILABLE_STEP_VALIDATION_BOUNDS',authority:'PRIVATE_STEP_WRITER_POLICY_NO_TRIMMED_MESH_DECLARATION',box:raw.bounds??null,nativeBRepSHA256:raw.nativeBRepSHA256};
 const base:any={status:'NOT_AVAILABLE_STEP_VALIDATION_BOUNDS',authority:'PRIVATE_STEP_WRITER_POLICY_RETURNS_UNDEFINED_FOR_TRIMMED_CURVED_MESH_BRANCH',box:null,nativeBRepSHA256:raw.nativeBRepSHA256};
 if(request.caseId!=='countersink')return base;
 const b=raw.brep,vs=b.vertices;if(!vs.length||!vs.every((v:any)=>v.point.length===3&&v.point.every(Number.isFinite)))throw Error('finite original vertex coordinates required');
 const box={min:[0,1,2].map(i=>Math.min(...vs.map((v:any)=>v.point[i]))),max:[0,1,2].map(i=>Math.max(...vs.map((v:any)=>v.point[i])))},close=(a:number,b:number)=>Math.abs(a-b)<=1e-9;
 const corners=vs.filter((v:any)=>v.point.every((x:number,i:number)=>close(x,box.min[i])||close(x,box.max[i]))),ids=new Set(corners.map((v:any)=>v.id));
 const edges=b.edges.filter((e:any)=>e.curve.degree===1&&e.curve.controlPoints.length===2&&e.vertices.every((id:string)=>ids.has(id)));
 return {...base,originalPlateSkeleton:{authority:'OBSERVED_ORIGINAL_VERTEX_BOX_AND_STRAIGHT_OUTER_EDGE_SKELETON_ONLY; MATERIAL_BOUND_CLAIM_REQUIRES_DECLARED_SOURCE_CARRIER_TRIM_PROOF',box,corners,edges,nativeBRepSHA256:raw.nativeBRepSHA256}};
}
`;
export const inspectorSource=observer;
const cli='\nconst inputFile=';
if(!inspectorSource.includes(cli))throw Error('retained inspector CLI boundary changed');
// Bundle from apps/cad-studio. CLI PREFLIGHT FRESH_/tmp/barocss-d542-... [CASE_ID].
export const preflightSource=inspectorSource.slice(0,inspectorSource.indexOf(cli))+boundsDiagnostic+String.raw`
import assert from 'node:assert/strict';
import {existsSync,mkdirSync,writeFileSync} from 'node:fs';
import {join,resolve} from 'node:path';
import {editFields} from '../../packages/barocss-cad-model/src/app/editFields.ts';
const configs=${JSON.stringify(cases)},root=resolve(process.argv[2]??''),selected=process.argv[3]?[process.argv[3]]:Object.keys(configs);
assert.ok(root.startsWith('/tmp/barocss-d542-')&&!existsSync(root),'fresh owned output directory');mkdirSync(root);assert.ok(selected.every(id=>id in configs),'declared case only');
const save=(dir:string,name:string,x:any)=>writeFileSync(join(dir,name),typeof x==='string'?x:JSON.stringify(x,null,2));
const near=(a:number,b:number,label:string,t=1e-9)=>assert.ok(Number.isFinite(a)&&Number.isFinite(b)&&Math.abs(a-b)<=t,label+': '+a+' != '+b);
const vec=(a:number[],b:number[],label:string)=>{assert.equal(a.length,b.length);a.forEach((v,i)=>near(v,b[i],label+'['+i+']'));};
const group:any={status:'RUNNING',authority:'FOUR_SEPARATE_CURRENT_NATIVE_SOURCE_ADMISSIONS_NO_HISTORICAL_NATIVE_REUSE',cases:[],independentPython:'NOT_RUN',actualStudio:'NOT_RUN',historicalD501Custody:'FAIL_UNRECOVERABLE_UNCHANGED'};let current:any=null,phase='input';
const persist=()=>save(root,'receipt.json',group);
function expected(config:any,p:any){const d=JSON.parse(config.seedText);if(config.caseId==='partial'){d.nodes[0].max[1]=20+p.depth;d.nodes[1].angle=p.angle;}else{d.nodes[1].height=p.height;if(config.caseId==='counterbore')d.nodes[3].depth=p.depth;else if(config.caseId==='blind')d.nodes[2].depth=p.depth;else d.nodes[2].countersink=p.countersink;}return d;}
function target(id:string,p:any){
 if(id==='partial'){const alpha=p.angle*Math.PI/180,V=150*p.depth*alpha,c=280/(9*Math.PI);return {volume:V,mass:V/1000,centroid:[p.angle===90?c:0,20+p.depth/2,c],bounds:{min:[p.angle===90?0:-20,20,0],max:[20,20+p.depth,20]},owner:'n1',genus:0};}
 const H=p.height,d=p.depth;let V:number,Mz:number;
 if(id==='blind'){const Q=4*Math.PI*d;V=3200*H-Q;Mz=1600*H*H-Q*(H-d/2);}
 else if(id==='counterbore'){const Q=12*Math.PI*d;V=(3200-4*Math.PI)*H-Q;Mz=(3200-4*Math.PI)*H*H/2-Q*(H-d/2);}
 else{const t=p.countersink/2-2,z0=H-t,E=Math.PI*(2*t*t+t*t*t/3),Ez=Math.PI*(z0*(2*t*t+t*t*t/3)+4*t*t*t/3+t*t*t*t/4);V=(3200-4*Math.PI)*H-E;Mz=(3200-4*Math.PI)*H*H/2-Ez;}
 return {volume:V,mass:V/1000,centroid:[20,0,Mz/V],bounds:{min:[-20,-20,0],max:[60,20,H]},owner:id==='counterbore'?'n3':'n2',genus:id==='blind'?0:1};
}
function field(dir:string,label:string,doc:any,f:any){const before=JSON.stringify(doc),entry=editFields(doc.nodes,f.index,doc.parameters).find((q:any)=>q.key===f.key);assert.ok(entry&&entry.kind==='number'&&entry.label===f.label,'exact existing public field owner/label');const candidate={...doc,nodes:entry.set(doc.nodes,f.value)};save(dir,label+'-field-before-assert.json',{beforeDoc:doc,candidate,field:f});assert.equal(JSON.stringify(doc),before,'field setter preserves accepted source');return candidate;}
function capture(dir:string,label:string,config:any,doc:any,p:any){
 phase=config.caseId+'/'+label;save(dir,label+'-actual.bcad',JSON.stringify(doc));const preserved=label==='A'&&config.caseId==='countersink'?process.env.D542_REUSE_COUNTERSINK_A_FROM:undefined;
 const original=preserved?readFileSync(preserved,'utf8'):null,r=preserved?JSON.parse(original as string):inspect(doc,{caseId:config.caseId,parameters:p,label}),packetBytes=original??JSON.stringify(r,null,2);save(dir,label+'-native-before-assert.json',packetBytes);
 current.rows.push({label,parameters:p,status:'CAPTURED',packet:label+'-native-before-assert.json',packetSHA256:sha(packetBytes),nativeCapture:preserved?'REUSED_PRESERVED_CURRENT_D542_PACKET_NO_NATIVE_REPLAY':'FRESH_CURRENT_NATIVE_CAPTURE',originalPacket:preserved?{path:preserved,sha256:sha(packetBytes)}:null,documentSHA256:r.documentSHA256,outputs:r.outputs.map((o:any)=>({outputId:o.outputId,nativeBRepSHA256:o.nativeBRepSHA256}))});persist();
 if(preserved){assert.equal(r.documentJSON,JSON.stringify(doc),'preserved current A raw Doc identity');assert.deepEqual(r.partDocument,toPartDocument(doc),'preserved current A/current compiled PartDoc identity');}return r;
}
function boundsForQualification(dir:string,label:string,config:any,raw:any,expectedBounds:any){
 const observation=observeBounds(raw,{caseId:config.caseId}),record={caseId:config.caseId,sourcePacket:current.rows.at(-1).originalPacket??{path:join(dir,current.rows.at(-1).packet),sha256:current.rows.at(-1).packetSHA256},nativeBRepSHA256:raw.nativeBRepSHA256,observation};save(dir,label+'-bounds-witness-before-assert.json',record);
 if(observation.status==='AVAILABLE_STEP_VALIDATION_BOUNDS'){vec(observation.box.min,expectedBounds.min,'STEP helper min');vec(observation.box.max,expectedBounds.max,'STEP helper max');return record;}
 assert.equal(config.caseId,'countersink','no generic missing-helper substitution');assert.equal(observation.status,'NOT_AVAILABLE_STEP_VALIDATION_BOUNDS');const s=observation.originalPlateSkeleton;assert.ok(s,'original countersink plate witness');assert.equal(s.nativeBRepSHA256,raw.nativeBRepSHA256);vec(s.box.min,expectedBounds.min,'observed original plate corner min');vec(s.box.max,expectedBounds.max,'observed original plate corner max');assert.equal(s.corners.length,8);assert.equal(s.edges.length,12);
 const corner=new Map(s.corners.map((v:any)=>[v.id,v.point])),masks=new Map(s.corners.map((v:any)=>[v.id,v.point.reduce((m:number,x:number,i:number)=>m|(Math.abs(x-s.box.max[i])<=1e-9?1<<i:0),0)]));assert.equal(new Set(masks.values()).size,8);const pairs=new Set();
 for(const e of s.edges){assert.equal(e.vertices.length,2);const a:any=corner.get(e.vertices[0]),b:any=corner.get(e.vertices[1]),ma:any=masks.get(e.vertices[0]),mb:any=masks.get(e.vertices[1]);vec(e.curve.controlPoints[0],a,'original outer line start');vec(e.curve.controlPoints[1],b,'original outer line end');assert.ok([1,2,4].includes(ma^mb),'outer straight line spans exactly one box axis');pairs.add([ma,mb].sort((a,b)=>a-b).join(':'));}assert.equal(pairs.size,12,'all twelve distinct original outer box edges');return record;
}
function qualify(dir:string,label:string,config:any,doc:any,p:any){
 const r=capture(dir,label,config,doc,p);assert.equal(r.ok,true,JSON.stringify(r.error));assert.equal(r.inputUnchanged,true);assert.deepEqual(doc,expected(config,p),'exact saved-source family and only declared leaves changed');assert.deepEqual(r.reader,{doc,notes:[]});const e=target(config.caseId,p);assert.equal(r.outputs.length,1);const raw=r.outputs[0];assert.equal(raw.outputId,e.owner);assert.equal(raw.bodyKey,'b'+e.owner.slice(1));assert.equal(raw.nativeBodyCount,1);assert.equal(raw.brep.bodies.length,1);assert.equal(raw.brep.bodies[0].kind,'solid');assert.equal(raw.brep.shells.length,1);assert.ok(raw.brep.shells[0].closed);assert.equal(sha(raw.nativeBRepJSON),raw.nativeBRepSHA256);assert.deepEqual(JSON.parse(raw.nativeBRepJSON),raw.brep);
 for(const key of ['default','strict','output']){const c=raw.productChecks[key];assert.equal(c.valid,true,JSON.stringify(c));assert.deepEqual(c.issues,[]);assert.equal(c.topology.length,1);assert.equal(c.topology[0].genus,e.genus);}
  const errors:any={};for(const key of ['massProperties','brepMass']){const m=raw[key];assert.ok(['closed-form','planar-exact','quadrature'].includes(m.method),'native nonmesh mass');near(m.volume,e.volume,key+' literal-profile volume',1e-9*e.volume);near(m.mass,e.mass,key+' density1 grams');vec(m.centroid,e.centroid,key+' centroid');errors[key]={volumeRelative:Math.abs(m.volume-e.volume)/e.volume,massAbsoluteG:Math.abs(m.mass-e.mass),centroidAbsoluteMM:Math.max(...m.centroid.map((v:number,i:number)=>Math.abs(v-e.centroid[i])))};}const boundsEvidence=boundsForQualification(dir,label,config,raw,e.bounds);Object.assign(current.rows.at(-1),{status:'PASS_CURRENT_SOURCE_NATIVE_LITERAL_TARGET',expected:e,errors,boundsEvidence});persist();return r;
}
try{
 for(const id of selected){const config=(configs as any)[id],dir=join(root,id);mkdirSync(dir);current={caseId:id,status:'RUNNING',rows:[],historicalCustody:config.historicalCustody};group.cases.push(current);const bytes=readFileSync(config.seedPath);save(dir,'original-saved-input.bcad',bytes.toString('utf8'));current.seed={path:config.seedPath,bytes:bytes.length,sha256:sha(bytes.toString('utf8'))};persist();assert.equal(bytes.length,config.seedBytes);assert.equal(sha(bytes.toString('utf8')),config.seedSHA256);assert.equal(bytes.toString('utf8'),config.seedText);
  const A=JSON.parse(config.seedText);qualify(dir,'A',config,A,config.parameters.A);const B=field(dir,'B',A,config.fields.B);qualify(dir,'B',config,B,config.parameters.B);const C=field(dir,'C',B,config.fields.C);qualify(dir,'C',config,C,config.parameters.C);const before=JSON.stringify(C);
  for(let i=0;i<config.guards.length;i++){const g=config.guards[i],label='negative'+(i+1),invalid=field(dir,label,C,g),r=capture(dir,label,config,invalid,{attemptedFrom:config.parameters.C,field:g});assert.equal(r.ok,false,'declared invalid edit must refuse');assert.equal(r.inputUnchanged,true);assert.equal(r.error?.code,g.expectedCode);assert.equal(r.error?.feature,g.expectedFeature);assert.ok(typeof r.error?.message==='string'&&r.error.message.length>0);assert.equal(JSON.stringify(C),before,'refusal candidate preserves separately owned accepted C');Object.assign(current.rows.at(-1),{status:'PASS_EXPECTED_CURRENT_TYPED_REFUSAL',observedError:r.error,actualGUIretention:'NOT_RUN'});persist();}
  current.status='PASS_ONE_CONTROLLED_CATEGORY_ADMISSION_ONLY';save(dir,'receipt.json',current);persist();
 }group.status='PASS_DECLARED_CURRENT_CATEGORY_ADMISSIONS_ONLY';persist();console.log(JSON.stringify({status:group.status,root,cases:group.cases.map((c:any)=>({caseId:c.caseId,status:c.status}))}));
}catch(cause){group.status='FAIL_CURRENT_CATEGORY_ADMISSION';group.firstFailure={phase,...error(cause)};if(current){current.status='FAIL_FIRST_ATTEMPT';current.firstFailure=group.firstFailure;}persist();console.log(JSON.stringify({status:group.status,root,firstFailure:group.firstFailure}));process.exitCode=1;}
`;

// Only standard-library algorithms enter Python: scalar checks, homogeneous
// de Boor/D1 and complete reciprocal graph traversal from the D539 oracle.
const scalars=cut(enclosureOracle,'def need(','def provenance(');
const rational=cut(enclosureOracle,'def deboor(','def carriers(');
const topology=cut(enclosureOracle,'def native_geometry(',' observations=');
export const oracleSource=String.raw`
import copy,hashlib,json,math,sys,traceback
from decimal import Decimal,localcontext
N=1e-9
PI=Decimal('3.14159265358979323846264338327950288419716939937510')
CONFIGS=json.loads(${JSON.stringify(JSON.stringify(cases))})
${scalars}
${rational}
def wrap(a): return math.atan2(math.sin(a),math.cos(a))
def source(case_id,doc,p,expected_doc):
 c=CONFIGS[case_id];text=c['seedText'];need(len(text.encode())==c['seedBytes'] and hashlib.sha256(text.encode()).hexdigest()==c['seedSHA256'],'exact independently pinned saved input bytes');need(p in list(c['parameters'].values()) and all(type(v) in [int,float] and math.isfinite(v) for v in p.values()),'only three predeclared finite physical classes');expected=json.loads(text)
 if case_id=='partial': expected['nodes'][0]['max'][1]=20+p['depth'];expected['nodes'][1]['angle']=p['angle']
 else:
  expected['nodes'][1]['height']=p['height']
  if case_id=='counterbore': expected['nodes'][3]['depth']=p['depth']
  elif case_id=='blind': expected['nodes'][2]['depth']=p['depth']
  else: expected['nodes'][2]['countersink']=p['countersink']
 need(doc==expected_doc==expected,'entire actual saved-source family, only declared numeric leaves changed; exact plane/defaults/side tags/outline/center/radii/DAG/output ownership');return c
def compiled(doc):
 fs=[]
 for n in doc['nodes']:
  k=n['kind'];i=n['id']
  if k=='sketch': fs.append({key:v for key,v in n.items() if key not in ['outline','on','construction','association']})
  elif k=='extrude': fs.append({'id':i,'kind':k,'sketch':'n0','height':n['height']})
  elif k=='revolve': fs.append({'id':i,'kind':k,'sketch':'n0','axis':{'origin':[0,0],'direction':'y'},'angle':n['angle']})
  elif k=='hole':
   f={'id':i,'kind':k,'target':'n'+str(n['parent']['node']),'radius':n['radius'],'center':n['center'],'face':n['face']}
   for key in ['depth','countersink']:
    if key in n: f[key]=n[key]
   fs.append(f)
 return {'format':'barocss-cad-part','version':1,'units':'mm','parameters':{},'features':fs}
def physical(case_id,p):
 if case_id=='partial':
  alpha=PI if p['angle']==180 else PI/2;v=150*Decimal(p['depth'])*alpha;q=Decimal(280)/(9*PI);return {'volume':v,'mass':v/1000,'centroid':[q if p['angle']==90 else Decimal(0),Decimal(20)+Decimal(p['depth'])/2,q],'bounds':{'min':[0 if p['angle']==90 else -20,20,0],'max':[20,20+p['depth'],20]},'owner':'n1','genus':0}
 H=Decimal(p['height'])
 if case_id=='blind':
  d=Decimal(p['depth']);Q=4*PI*d;v=3200*H-Q;mz=1600*H*H-Q*(H-d/2)
 elif case_id=='counterbore':
  d=Decimal(p['depth']);Q=12*PI*d;v=(3200-4*PI)*H-Q;mz=(3200-4*PI)*H*H/2-Q*(H-d/2)
 else:
  t=Decimal(p['countersink'])/2-2;z0=H-t;E=PI*(2*t*t+t*t*t/3);Ez=PI*(z0*(2*t*t+t*t*t/3)+4*t*t*t/3+t**4/4);v=(3200-4*PI)*H-E;mz=(3200-4*PI)*H*H/2-Ez
 return {'volume':v,'mass':v/1000,'centroid':[Decimal(20),Decimal(0),mz/v],'bounds':{'min':[-20,-20,0],'max':[60,20,p['height']]},'owner':'n3' if case_id=='counterbore' else 'n2','genus':0 if case_id=='blind' else 1}
def declaration(case_id,p):
 planes=[];cylinders=[];cone=None
 def pl(role,axis,at,n,area,name=None): planes.append({'role':role,'axis':axis,'at':at,'n':n,'area':area,'name':name})
 def cy(role,axis,c,r,sign,levels,name=None): cylinders.append({'role':role,'axis':axis,'c':c,'r':r,'sign':sign,'levels':levels,'name':name})
 if case_id=='partial':
  d=p['depth'];alpha=PI if p['angle']==180 else PI/2;pl('axialStart',1,20,[0,-1,0],150*alpha,'n1.side[e1]');pl('axialEnd',1,20+d,[0,1,0],150*alpha,'n1.side[e3]');pl('angularStart',2,0,[0,0,-1],Decimal(10*d),'n1.start');pl('angularEnd',0 if p['angle']==90 else 2,0,[-1,0,0] if p['angle']==90 else [0,0,-1],Decimal(10*d),'n1.end');cy('outer',1,[0,0],20,1,[20,20+d],'n1.side[e2]');cy('inner',1,[0,0],10,-1,[20,20+d],'n1.side[e4]');return planes,cylinders,cone
 H=p['height'];topR=2 if case_id=='blind' else 4 if case_id=='counterbore' else p['countersink']/2
 for role,axis,at,n,area in [('left',0,-20,[-1,0,0],40*H),('right',0,60,[1,0,0],40*H),('front',1,-20,[0,-1,0],80*H),('back',1,20,[0,1,0],80*H),('bottom',2,0,[0,0,-1],Decimal(3200)-(0 if case_id=='blind' else 4*PI)),('top',2,H,[0,0,1],Decimal(3200)-Decimal(topR)**2*PI)]: pl(role,axis,at,n,Decimal(area))
 if case_id=='blind':
  z0=H-p['depth'];pl('blindFloor',2,z0,[0,0,1],4*PI);cy('bore',2,[20,0],2,-1,[z0,H])
 elif case_id=='counterbore':
  z0=H-p['depth'];pl('shoulder',2,z0,[0,0,1],12*PI);cy('pilot',2,[20,0],2,-1,[0,z0]);cy('recess',2,[20,0],4,-1,[z0,H])
 else:
  R=p['countersink']/2;z0=H-(R-2);cy('pilot',2,[20,0],2,-1,[0,z0]);cone={'role':'countersink','axis':2,'c':[20,0],'apex':H-R,'levels':[z0,H],'radii':[2,R]}
 return planes,cylinders,cone
def radial(p,axis,c):
 keep=[i for i in range(3) if i!=axis];v=[p[k]-w for k,w in zip(keep,c)];return keep,v,math.hypot(*v)
def partial_inside(p,params,label):
 rho=math.hypot(p[0],p[2]);need(10-N<=rho<=20+N and 20-N<=p[1]<=20+params['depth']+N,label+' source radial/axial trim');a=math.atan2(0 if abs(p[2])<=N else p[2],p[0]);need(-N/20<=a<=params['angle']*math.pi/180+N/20,label+' source positive-Z angular trim')
def loop_area(loop,co,edges,points,spec,circles):
 keep=[i for i in range(3) if i!=spec['axis']];area=0.
 for cid in loop['coedges']:
  use=co[cid];edge=edges[use['edge']];ps=points[edge['id']];ps=ps if use['sense']=='forward' else list(reversed(ps));a=[ps[0][k] for k in keep];b=[ps[-1][k] for k in keep];area+=(a[0]*b[1]-a[1]*b[0])/2
  if edge['curve']['degree']!=1:
   matches=[c for c in circles if c['axis']==spec['axis'] and all(abs(radial(p,c['axis'],c['c'])[2]-c['r'])<=N for p in ps)];need(len(matches)==1,'one source-defined original planar circular trim');c=matches[0];angles=[math.atan2(*list(reversed(radial(p,c['axis'],c['c'])[1]))) for p in ps];sweep=sum(wrap(z-a) for a,z in zip(angles,angles[1:]));need(0<abs(sweep)<=2*math.pi+N,'directed original circular trim');area+=c['r']**2*(sweep-math.sin(sweep))/2
 return area
def coverage(points,c,level,angle=2*math.pi):
 intervals=[];tol=N/c['r']
 for ps in points.values():
  if not all(abs(p[c['axis']]-level)<=N and abs(radial(p,c['axis'],c['c'])[2]-c['r'])<=N for p in ps): continue
  aa=[math.atan2(*list(reversed(radial(p,c['axis'],c['c'])[1]))) for p in ps];turns=[wrap(z-a) for a,z in zip(aa,aa[1:])];need(all(abs(t)<math.pi for t in turns),'ordered original circular witnesses');sweep=sum(turns);need(abs(sweep)>0,'positive original rim interval');start=aa[0] if sweep>0 else aa[-1];a=start%(2*math.pi)
  if abs(a-2*math.pi)<=tol: a=0.
  z=a+abs(sweep)
  if z<=2*math.pi+tol: intervals.append((a,min(z,2*math.pi)))
  else: intervals.extend([(a,2*math.pi),(0,z-2*math.pi)])
 need(intervals,'original circular rim present');end=0.
 for a,z in sorted(intervals): need(a<=end+tol and z<=angle+tol,'complete original selected angular rim without gap/excess');end=max(end,z)
 near(end,angle,'complete original selected rim extent',tol);return len(intervals)
${topology}
 case_id=width;p=wall;planes,cylinders,cone=declaration(case_id,p);observed={s['id']:s for s in raw['surfaces']};need(len(observed)==len(raw['surfaces'])==len(faces) and set(observed)==set(faces),'all original surface observations');roles={};areas={s['role']:0. for s in planes};bands={c['role']:[] for c in cylinders};cone_boundary=[];max_support=0.;max_normal=0.;max_rational=0.;circle_specs=cylinders+([{'axis':2,'c':[20,0],'r':cone['radii'][1]}] if cone else [])
 for f in faces.values():
  ob=observed[f['id']];need(ob['name']==f.get('name'),'surface observation joins original name');g=ob['geometry'];matches=[]
  if g['kind']=='plane': matches=[('plane',s) for s in planes if abs(g['o'][s['axis']]-s['at'])<=N and math.dist(g['n'],s['n'])<=N and (s['name'] is None or f.get('name')==s['name'])]
  elif g['kind']=='cylinder':
   for c in cylinders:
    keep=[i for i in range(3) if i!=c['axis']];axis=[0,0,0];axis[c['axis']]=1
    if abs(g['r']-c['r'])<=N and math.dist([g['c'][i] for i in keep],c['c'])<=N and math.dist([abs(v) for v in g['a']],axis)<=N and g['out']==c['sign'] and (c['name'] is None or f.get('name')==c['name']): matches.append(('cylinder',c))
  elif g['kind']=='other' and cone: matches=[('cone',cone)]
  need(len(matches)==1,'unique actual source carrier, with original OTHER retained for countersink');kind,s=matches[0];roles[f['id']]=s['role']
  def support(q):
   nonlocal max_support
   if kind=='plane': gap=abs(q[s['axis']]-s['at']);normal=s['n']
   else:
    keep,v,rho=radial(q,s['axis'],s['c']);need(rho>0,'nonaxis curved carrier point')
    if kind=='cylinder': gap=abs(rho-s['r']);normal=[0.,0.,0.];normal[keep[0]]=s['sign']*v[0]/rho;normal[keep[1]]=s['sign']*v[1]/rho
    else: gap=abs(rho-(q[2]-s['apex']));normal=[-v[0]/rho/math.sqrt(2),-v[1]/rho/math.sqrt(2),1/math.sqrt(2)]
   max_support=max(max_support,gap);near(gap,0,'independent original carrier equation');return normal
  boundary=[q for lid in f['loops'] for cid in loops[lid]['coedges'] for q in points[co[cid]['edge']]]
  for q in boundary:
   support(q)
   if case_id=='partial': partial_inside(q,p,'original face boundary')
  if kind=='plane':
   areas[s['role']]+=abs(sum(loop_area(loops[lid],co,edges,points,s,circle_specs) for lid in f['loops']))
   if case_id=='partial' and s['role'].startswith('angular'):
    angle=0 if s['role']=='angularStart' else p['angle'];want=[]
    for rr in [10,20]:
     for yy in [20,20+p['depth']]: want.append([rr,yy,0] if angle==0 else [0,yy,rr] if angle==90 else [-rr,yy,0])
    actual={vid for lid in f['loops'] for cid in loops[lid]['coedges'] for vid in edges[co[cid]['edge']]['vertices']};need(len(actual)==4 and all(any(math.dist(verts[vid]['point'],q)<=N for q in want) for vid in actual),'original angular-cap end-station vertex pins')
  else:
   band=bands[s['role']] if kind=='cylinder' else cone_boundary;band+=boundary
   for q in boundary: need(s['levels'][0]-N<=q[s['axis']]<=s['levels'][1]+N,'original curved axial trim range')
  sf=f['surface'];U=[sf['knotsU'][sf['degreeU']],sf['knotsU'][len(sf['controlPoints'])]];V=[sf['knotsV'][sf['degreeV']],sf['knotsV'][len(sf['controlPoints'][0])]];need(ob['probe']['domain']=={'u':U,'v':V} and len(ob['probe']['probes'])==2,'original carrier domains/probe stations')
  # Preserve the older hole oracles' independent 5x5 carrier witnesses and
  # countersink's nine interior rational-normal witnesses at the same budget.
  for i in range(5):
   for j in range(5): support(surface_d1(sf,U[0]+i*(U[1]-U[0])/4,V[0]+j*(V[1]-V[0])/4)[0])
  if kind=='cone':
   for i in range(1,4):
    for j in range(1,4):
     qp,qu,qv=surface_d1(sf,U[0]+i*(U[1]-U[0])/4,V[0]+j*(V[1]-V[0])/4);qn=[v*(1 if f['sense']=='forward' else -1) for v in unit(cross(qu,qv))];wanted=support(qp);vec(qn,wanted,'nine independent interior cone normals');max_normal=max(max_normal,max(abs(a-b) for a,b in zip(qn,wanted)))
  for q,(a,z) in zip(ob['probe']['probes'],[(.21,.37),(.71,.63)]):
   near(q['u'],U[0]+a*(U[1]-U[0]),'original U station');near(q['v'],V[0]+z*(V[1]-V[0]),'original V station');point,du,dv=surface_d1(sf,q['u'],q['v']);vec(q['point'],point,'independent original rational point');vec(q['du'],du,'independent original rational du');vec(q['dv'],dv,'independent original rational dv');nn=[v*(1 if f['sense']=='forward' else -1) for v in unit(cross(du,dv))];wanted=support(point);vec(nn,wanted,'original outward source normal');vec(q['normal'],nn,'observed native normal');need(q['normalNorm']>0,'regular derivatives');max_normal=max(max_normal,max(abs(a-b) for a,b in zip(nn,wanted)));max_rational=max(max_rational,max(abs(a-b) for a,b in zip(q['point']+q['du']+q['dv'],point+du+dv)))
 need(set(roles.values())=={s['role'] for s in planes}|{s['role'] for s in cylinders}|({'countersink'} if cone else set()),'all declared material carriers present');area_errors={}
 for s in planes: area_errors[s['role']]={'areaMM2':areas[s['role']],'expectedMM2':str(s['area']),'errorMM2':decimal_close(areas[s['role']],s['area'],Decimal('1e-9'),'original directed planar trim area '+s['role'])}
 rims=[]
 for c in cylinders:
  ps=bands[c['role']];need(ps,'original curved trim band');vec([min(q[c['axis']] for q in ps),max(q[c['axis']] for q in ps)],c['levels'],'complete original cylinder axial extent')
  for level in c['levels']: rims.append({'role':c['role'],'levelMM':level,'radiusMM':c['r'],'intervals':coverage(points,c,level,p['angle']*math.pi/180 if case_id=='partial' else 2*math.pi)})
 if cone:
  need(cone_boundary,'original cone boundary');vec([min(q[2] for q in cone_boundary),max(q[2] for q in cone_boundary)],cone['levels'],'complete original cone axial extent')
  for level,radius in zip(cone['levels'],cone['radii']): rims.append({'role':'countersink','levelMM':level,'radiusMM':radius,'intervals':coverage(points,{'axis':2,'c':[20,0],'r':radius},level)})
 rim_adjacency=[]
 if case_id!='partial':
  H=p['height']
  if case_id=='blind': specs=[(2,H,{'top','bore'}),(2,H-p['depth'],{'blindFloor','bore'})]
  elif case_id=='counterbore': specs=[(2,0,{'bottom','pilot'}),(2,H-p['depth'],{'pilot','shoulder'}),(4,H-p['depth'],{'shoulder','recess'}),(4,H,{'recess','top'})]
  else: specs=[(2,0,{'bottom','pilot'}),(2,cone['levels'][0],{'pilot','countersink'}),(cone['radii'][1],H,{'countersink','top'})]
  for radius,level,wanted in specs:
   matched=[]
   for eid,ps in points.items():
    if all(abs(q[2]-level)<=N and abs(math.hypot(q[0]-20,q[1])-radius)<=N for q in ps):
     adjacent={roles[loops[c['loop']]['face']] for c in co.values() if c['edge']==eid};need(adjacent==wanted,'exact original twin carrier adjacency at circular rim');matched.append(eid)
   need(matched,'original declared rim adjacency present');rim_adjacency.append({'radiusMM':radius,'levelMM':level,'carrierRoles':sorted(wanted),'originalEdgeIds':matched})
 if case_id=='partial':
  need(len(faces)==6 and len(edges)==12 and len(verts)==8,'selected six-face/twelve-edge/eight-vertex partial profile');pairs=[];expected_pairs={frozenset(['n1.side[e1]','n1.side[e2]']),frozenset(['n1.side[e2]','n1.side[e3]']),frozenset(['n1.side[e3]','n1.side[e4]']),frozenset(['n1.side[e1]','n1.side[e4]'])}|{frozenset([cap,'n1.side[e'+str(i)+']']) for cap in ['n1.start','n1.end'] for i in range(1,5)}
  for eid in edges: pairs.append(frozenset(faces[loops[c['loop']]['face']]['name'] for c in co.values() if c['edge']==eid))
  need(len(set(pairs))==12 and set(pairs)==expected_pairs,'all twelve original partial boundary adjacencies')
 probes={e['id']:e for e in raw['edgeProbes']};need(len(probes)==len(raw['edgeProbes']) and set(probes)==set(edges),'all original edge observations')
 for eid,e in edges.items():
  q=probes[eid];a,z=domain(e['curve']);need(q['name']==e.get('name') and q['degree']==e['curve']['degree'] and q['probe']['domain']==[a,z] and len(q['probe']['samples'])==9,'original native edge metadata/stations')
  for i,point in enumerate(q['probe']['samples']): vec(point,curve(e['curve'],a+(z-a)*i/8),'independent original rational edge station')
 bounds={side:[fn(q[i] for ps in points.values() for q in ps) for i in range(3)] for side,fn in [('min',min),('max',max)]};plate_witness=None
 if case_id=='countersink':
  box={side:[fn(v['point'][i] for v in verts.values()) for i in range(3)] for side,fn in [('min',min),('max',max)]};corners={vid:v for vid,v in verts.items() if all(min(abs(x-box['min'][i]),abs(x-box['max'][i]))<=N for i,x in enumerate(v['point']))};need(len(corners)==8,'eight actual outer plate extreme corners');masks={vid:sum((1<<i) if abs(x-box['max'][i])<=N else 0 for i,x in enumerate(v['point'])) for vid,v in corners.items()};need(len(set(masks.values()))==8,'every original box corner present exactly once');outer_edges=[e for e in edges.values() if e['curve']['degree']==1 and len(e['curve']['controlPoints'])==2 and all(v in corners for v in e['vertices'])];need(len(outer_edges)==12,'twelve original straight outer plate edges');pairs=set()
  for edge in outer_edges:
   ma,mb=[masks[v] for v in edge['vertices']];need(ma^mb in [1,2,4],'original outer edge spans exactly one box axis');pairs.add(tuple(sorted([ma,mb])))
  need(len(pairs)==12,'complete original outer plate straight-edge skeleton');plate_witness={'authority':'OBSERVED_ORIGINAL_EIGHT_CORNERS_TWELVE_STRAIGHT_EDGES_WITH_SOURCE_PLANES_CONE_BORE_TRIM_LIMITS; NOT_A_GENERAL_STEP_BOUNDS_RESULT','box':box,'corners':list(corners.values()),'originalOuterEdgeIds':[e['id'] for e in outer_edges],'nativeBRepSHA256':raw['nativeBRepSHA256']}
 return {'counts':{k:len(b[k]) for k in keys},'genus':genus,'eulerCharacteristic':chi,'carrierRoles':sorted(set(roles.values())),'originalPlanarTrimAreas':area_errors,'originalCompleteRims':rims,'originalRimTwinCarrierAdjacency':rim_adjacency,'originalBoundaryWitnessBounds':bounds,'originalOuterPlateSkeleton':plate_witness,'boundsAuthority':'ORIGINAL_RATIONAL_CURVE_EXTREMA_WITNESSES_AND_COMPLETE_DECLARED_RIMS_WITH_CARRIER_LIMITS; NOT_UNTRIMMED_CARRIER_OR_VERTEX_BOX','maximumEndpointGapMM':max_endpoint,'maximumCarrierGapMM':max_support,'maximumRationalObservationGapMM':max_rational,'maximumOutwardNormalComponentError':max_normal,'pcurveCount':pcurves,'pcurveStatus':'PASS_ORIGINAL_OPTIONAL_PCURVE_FINITE_WITNESSES' if pcurves else 'NOT_EXERCISED_ORIGINAL_PCURVES_ABSENT','maximumPcurveLiftGapMM':max_lift,'countersinkClassifier':'PRODUCT_OTHER_RETAINED_INDEPENDENT_FIXED45_DEGREE_CARRIER' if cone else 'NOT_APPLICABLE'}
def run(x):
 case_id=x['caseId'];need(case_id in CONFIGS,'declared separate category');p=x['parameters'];doc=x['doc'];rd=x['read'];config=source(case_id,doc,p,x['expectedDoc']);e=physical(case_id,p);text=x.get('documentJSON',rd['documentJSON'])
 need(rd['ok'] is True and rd['status']=='CAPTURED' and rd['inputUnchanged'] is True and rd['documentJSON']==text and json.loads(text)==doc==rd['reader']['doc'] and rd['reader']['notes']==[] and hashlib.sha256(text.encode()).hexdigest()==rd['documentSHA256'],'current exact raw Doc/reader/hash identity');need(rd['partDocument']==compiled(doc),'actual current compiled native PartDoc/feature ownership');need(rd['request']['caseId']==case_id and rd['request']['parameters']==p,'current request/source category join');need(rd['outputIds']==[e['owner']] and rd['bodyCount']==1 and len(rd['outputs'])==1 and rd['target']==rd['outputs'][0] and rd['bodyKey']=='b'+e['owner'][1:],'sole original native output ownership');raw=rd['outputs'][0];need(raw['outputId']==e['owner'] and raw['bodyKey']=='b'+e['owner'][1:] and raw['nativeBodyCount']==1,'native per-output owner/count');bj=raw['nativeBRepJSON'];need(json.loads(bj)==raw['brep'] and hashlib.sha256(bj.encode()).hexdigest()==raw['nativeBRepSHA256'],'original native BRep bytes/hash');need(raw['massUnits']=={'density':1,'densityUnit':'g/cm3','volume':'mm3','mass':'g','centroid':'mm','authority':'massPropertiesOf/brepMassProperties MMGS'},'density1 native MMGS units');need(raw['productChecks']['authority']=='PRODUCT_OBSERVATIONS_NOT_INDEPENDENT_ORACLE','product checks labelled')
 for name in ['default','strict','output']:
  c=raw['productChecks'][name];need(c['valid'] is True and c['issues']==[] and len(c['topology'])==1 and c['topology'][0]['genus']==e['genus'],'observed product validity '+name)
 errors={}
 for key in ['massProperties','brepMass']:
  m=raw[key];need(finite(m) and m['method'] in ['closed-form','planar-exact','quadrature'],'native nonmesh mass observation');ve=decimal_close(m['volume'],e['volume'],Decimal('1e-9')*e['volume'],key+' independent declared source volume');me=decimal_close(m['mass'],e['mass'],Decimal('1e-9'),key+' density1 grams');ce=max(decimal_close(v,w,Decimal('1e-9'),key+' centroid') for v,w in zip(m['centroid'],e['centroid']));errors[key]={'volumeRelative':ve/float(e['volume']),'massAbsoluteG':me,'centroidAbsoluteMM':ce}
 geometry=native_geometry(raw,case_id,p,e['genus'],'HoleRow' if e['genus']==1 else 'base')
 if 'bounds'in raw:
  need(isinstance(raw['bounds'],dict) and set(raw['bounds'])=={'min','max'},'available STEP helper returned numerical bounds, not an observation error');bounds_status={'stepValidationBounds':'AVAILABLE','materialAuthority':'ORIGINAL_NATIVE_HELPER_PLUS_INDEPENDENT_BOUNDARY_WITNESSES'}
  for side in ['min','max']: vec(raw['bounds'][side],e['bounds'][side],'available STEP helper bounds')
 else:
  need(case_id=='countersink' and geometry['originalOuterPlateSkeleton'] is not None,'only declared countersink may use separate source-specific missing-helper witness');bounds_status={'stepValidationBounds':'NOT_AVAILABLE_PRIVATE_STEP_TRIMMED_CURVED_POLICY','materialAuthority':'INDEPENDENT_ORIGINAL_OUTER_PLATE_SKELETON_WITH_DECLARED_SOURCE_CARRIER_AND_TRIM_LIMITS','sourcePacket':x.get('readProvenance'),'nativeBRepSHA256':raw['nativeBRepSHA256']}
  for side in ['min','max']: vec(geometry['originalOuterPlateSkeleton']['box'][side],e['bounds'][side],'observed original outer plate corners')
 for side in ['min','max']: vec(geometry['originalBoundaryWitnessBounds'][side],e['bounds'][side],'independent original boundary extrema')
 need(rd['display']['status']=='NOT_REQUESTED_EXISTING_FEATURE_EDITOR_LIFECYCLE','no foreign display mapper qualification');worker='NOT_SUPPLIED_CONTROLLED_NATIVE_ADMISSION'
 if x.get('consumer') is not None:
  c=x['consumer'];need(c['doc']==doc and c['documentJSON']==text and c['rootFresh'] is True,'fresh actual Studio raw Doc');w=c['worker'];need(w['fresh'] is True and w['massReady'] is True and len(w['bodies'])==1 and w['bodies'][0]['key']=='b'+e['owner'][1:],'fresh actual Worker owner');body=w['bodies'][0];decimal_close(body['volume'],e['volume'],Decimal('1e-9')*e['volume'],'fresh Worker volume')
  for v,wanted in zip(body['centroid'],e['centroid']): decimal_close(v,wanted,Decimal('1e-9'),'fresh Worker centroid')
  worker='PASS_FRESH_ACTUAL_STUDIO_EXACT_DOC_WORKER'
 return {'status':'PASS_ONE_DECLARED_D542_CATEGORY_STATE','caseId':case_id,'parameters':p,'documentSHA256':rd['documentSHA256'],'nativeBRepSHA256':raw['nativeBRepSHA256'],'savedInput':{'path':config['seedPath'],'bytes':config['seedBytes'],'sha256':config['seedSHA256'],'historicalCustody':config['historicalCustody']},'expected':{'volumeMM3':str(e['volume']),'massDensity1G':str(e['mass']),'centroidMM':[str(v) for v in e['centroid']],'bounds':e['bounds'],'genus':e['genus']},'native':{'massErrors':errors,'geometry':geometry,'boundsEvidence':bounds_status},'worker':worker,'budgets':{'nativeVolumeRelative':N,'centroidBoundsCarrierEndpointD1PcurveMM':N,'outwardNormalComponent':N,'density1MassAbsoluteG':N,'planarTrimAreaMM2':N},'limits':['Only this independently saved category and its three declared classes; no cross-Doc composition or Cartesian expansion.','Every original native entity/ordered trim is traversed; carrier, rational, normal and present-UV observations are finite witnesses, not a full-domain trim/general Boolean theorem.','Original pcurve presence is measured per packet. Padded planar carriers do not supply material bounds or trimmed membership. STEP writer bounds may be NOT_AVAILABLE; the separate original plate skeleton/source witness does not change that policy.','New current source/native proof does not repair D501 original aggregate custody FAIL. Historical public creation remains separately labelled.','No new tapped data, cone/axis/feature widening, manufacturing/mobile/exchange/release acceptance.']}
if __name__=='__main__':
 try:
  with localcontext() as context: context.prec=60;result=run(json.load(sys.stdin))
  print(json.dumps(result,indent=2,allow_nan=False))
 except Exception as exc: print(json.dumps({'status':'FAIL_D542_DECLARED_CATEGORY_STATE','error':{'type':type(exc).__name__,'message':str(exc)}},indent=2));traceback.print_exc(file=sys.stderr);sys.exit(2)
`;
