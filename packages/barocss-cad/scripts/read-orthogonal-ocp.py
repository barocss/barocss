"""Independent original orthogonal adjacency consumer; separate unchanged coplanar contract."""
import argparse
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import platform
import re
import runpy
import subprocess
import sys

SCRIPTS = Path(__file__).parent
ADJACENCY_READER = SCRIPTS/'read-adjacency-ocp.py'
FACE_READER = SCRIPTS/'read-face-ocp.py'
DERIVATIVE_READER = SCRIPTS/'read-derivatives-ocp.py'
adj = runpy.run_path(str(ADJACENCY_READER))
face = runpy.run_path(str(FACE_READER))
util = runpy.run_path(str(DERIVATIVE_READER))
require = util['require']
vector_error = util['vector_error']


def sha(filename):
    return hashlib.sha256(filename.read_bytes()).hexdigest()


def graph(condition, message):
    require(condition, 'Orthogonal adjacency graph geometry comparison failed: '+message)


def keys(value, expected):
    return isinstance(value,dict) and set(value)==set(expected)


def orthogonal_graph(descriptor, rows):
    graph(keys(descriptor,['version','id','faces','vertices','edges']) and type(descriptor['version']) is int
          and descriptor['version']==0, 'Fixed orthogonal descriptor version/fields')
    graph(len(descriptor['faces'])==2 and len(descriptor['vertices'])==6 and len(descriptor['edges'])==7,
          'Two faces/six vertices/seven edges required')
    graph(all(keys(value,['id','bundle']) for value in descriptor['faces'])
          and [value['id'] for value in descriptor['faces']]==[row['wrapperId'] for row in rows]
          and all(value['bundle']==row['bundle'] for value,row in zip(descriptor['faces'],rows)),
          'Owned qualified wrappers must preserve actual local bundles')
    identifiers=[descriptor['id']]+[value['id'] for value in descriptor['faces']]
    identifiers += [value['id'] for value in descriptor['vertices']]+[value['id'] for value in descriptor['edges']]
    graph(len(identifiers)==16 and len(set(identifiers))==16 and all(isinstance(value,str) and len(value)<=128
          and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_-]*',value) for value in identifiers), 'Sixteen explicit distinct global IDs')
    # Reuse only the original individual-rectangle oracle, NOT the coplanar
    # pair recognizer or pair validator. This is a separately derived family.
    left,right=[adj['rectangle'](value['bundle']) for value in descriptor['faces']]
    a,b,c=left['A'],left['B'],right['A']
    axis_a=[i for i,x in enumerate(a) if x!=0]
    axis_b=[i for i,x in enumerate(b) if x!=0]
    axis_c=[i for i,x in enumerate(c) if x!=0]
    graph(len(axis_a)==len(axis_b)==len(axis_c)==1 and len({axis_a[0],axis_b[0],axis_c[0]})==3,
          'A/B/C must lie on three mutually different axes')
    graph(right['origin']==[left['origin'][i]+a[i] for i in range(3)] and right['B']==b,
          'Fixed full common edge requires right origin O+A and exactly equal B')
    normal_dot=sum(x*y for x,y in zip(left['cross'],right['cross']))
    graph(normal_dot==0 and left['areaMM2']>0 and right['areaMM2']>0,
          'Nonzero perpendicular signed face normals')
    expected_vertices=[*left['corners'],right['corners'][1],right['corners'][2]]
    graph(all(keys(value,['id','point']) for value in descriptor['vertices'])
          and [value['point'] for value in descriptor['vertices']]==expected_vertices,
          'Exact global corner coefficient mapping')
    refs=[]
    for owner,record in zip(descriptor['faces'],(left,right)):
        refs.append([{'faceId':owner['id'],'edgeId':record['topology']['edges'][i]['id'],
                      'curveId':record['curves'][i]['id']} for i in range(4)])
    canonical=[*refs[0],*refs[1][:3]]
    vertex_pairs=[(0,1),(1,2),(2,3),(3,0),(1,4),(4,5),(5,2)]
    for i,edge in enumerate(descriptor['edges']):
        graph(keys(edge,['id','vertexIds','canonical','uses']) and edge['canonical']==canonical[i],
              'Qualified canonical edge/curve owner mismatch')
        graph(edge['vertexIds']==[descriptor['vertices'][j]['id'] for j in vertex_pairs[i]],
              'Global edge endpoint association')
        expected=[{**canonical[i],'sense':'forward'}]
        if i==1: expected.append({**refs[1][3],'sense':'reverse'})
        graph(len(edge['uses'])==len(expected) and all(keys(use,['faceId','edgeId','curveId','sense']) for use in edge['uses'])
              and edge['uses']==expected, 'One reverse common use; six single forward uses; each qualified local edge once')
    return left,right,{'O':left['origin'],'A':a,'B':b,'C':c,'axes':[axis_a[0],axis_b[0],axis_c[0]],
        'leftCross':left['cross'],'rightCross':right['cross'],'signedNormalDot':normal_dot,
        'planesIntersection':'Both affine rectangle planes intersect on O+A+sB; bounded domains restrict it to s in[0,1].',
        'derivation':'Distinct coordinate axes give independent tangents and injective maps. Right local u-min traversal is1-tLeft.',
        'nativeFaceGeometricValidity':'not-certified','solid':False}


def face_row(row):
    record=adj['rectangle'](row['bundle'])
    # Preserve the independently authored coefficients; do not infer or replace
    # them from the source geometry passed to the consumer.
    require(row['authoredOrigin']==record['origin'] and row['authoredA']==record['A']
            and row['authoredB']==record['B'],'Authored per-face coefficients differ from actual native poles')
    return row


def inspect_pair(output, fixture, negative=''):
    graph(fixture['oldProductRejection']['status']=='rejected',
          'Old coplanar builder must remain exclusive and reject actual orthogonal inputs')
    graph(fixture['productCompatibility']=={'orthogonalAccepted':True,'coplanarRejected':True},
          'Actual new API acceptance and exclusive coplanar rejection must remain explicit')
    rows=[face_row(row) for row in fixture['faces']]
    for row,authored in zip(rows,(fixture['left'],fixture['right'])):
        graph(row['authoredOrigin']==authored['origin'] and row['authoredA']==authored['A']
              and row['authoredB']==authored['B'],'Authored pair/per-face coefficient association')
    graph(len(rows)==2,'Two actual individually exported faces')
    local=[adj['read_local_face'](output,fixture['name'],row) for row in rows]
    # All negative controls happen AFTER both exported faces independently pass
    # face validity, original graph, positions, D1 and area comparison.
    descriptor=json.loads(json.dumps(fixture['descriptor']))
    if negative=='wrong-owner': descriptor['edges'][0]['canonical']['faceId']=descriptor['faces'][1]['id']
    elif negative=='wrong-sense': descriptor['edges'][1]['uses'][1]['sense']='forward'
    elif negative=='wrong-edge': descriptor['edges'][0]['canonical']['edgeId']=descriptor['faces'][0]['bundle']['topology']['edges'][1]['id']
    elif negative=='wrong-vertex': descriptor['edges'][0]['vertexIds'][1]=descriptor['vertices'][2]['id']
    elif negative=='missing-use': descriptor['edges'][1]['uses'].pop()
    elif negative=='duplicate-use': descriptor['edges'][0]['uses'].append(dict(descriptor['edges'][0]['uses'][0]))
    elif negative=='minute-point': descriptor['vertices'][0]['point'][0]+=1e-10
    left,right,proof=orthogonal_graph(descriptor,rows)
    graph(fixture['validation']=={'incidenceValid':True,'geometryFamily':'exact-orthogonal-axis-rectangles-v0',
                                  'sharedEdges':1,'closed':False,'solid':False}, 'Fixed bounded orthogonal validation report must remain explicit')
    a,am,ar=adj['common_adapter'](output,rows[0],left['curves'][1]['id'])
    b,bm,br=adj['common_adapter'](output,rows[1],right['curves'][3]['id'])
    samples=fixture['sharedSamples']
    graph(len(samples)==19,'Exactly19 declared common parameters per pair')
    parameters=[sample['leftParameter'] for sample in samples]
    graph(0 in parameters and 1 in parameters and len(set(p for p in parameters if 0<p<1))>=17,
          'Shared endpoints and17 distinct interior parameters')
    retained=[]
    maximum_point=maximum_derivative=0.0
    for sample in samples:
        t,s=sample['leftParameter'],sample['rightParameter']
        graph(s==1-t,'Original right common parameter must equal1-tLeft')
        ap,ad,asp,ma=face['evaluate_curve'](a,t)
        bp,bd,bsp,mb=face['evaluate_curve'](b,s)
        expected=[proof['O'][i]+proof['A'][i]+t*proof['B'][i] for i in range(3)]
        graph(math.dist(sample['leftPoint'],sample['rightPoint'])<=1e-9 and math.dist(sample['leftPoint'],expected)<=1e-9,
              'Native common point independent coefficient mismatch')
        graph(vector_error(sample['leftDerivative'],proof['B'])[1]<=1e-9
              and vector_error(sample['rightDerivative'],[-x for x in proof['B']])[1]<=1e-9,
              'Native common derivatives must oppose')
        point_error=max(math.dist(ap,bp),math.dist(ap,expected),math.dist(bp,expected))
        derivative_error=max(vector_error(ad,proof['B'])[1],vector_error(bd,[-x for x in proof['B']])[1],
                             vector_error(ad,[-x for x in bd])[1])
        graph(point_error<=1e-7 and derivative_error<=1e-7,'Actual two-file common geometry/tangent comparison')
        maximum_point=max(maximum_point,point_error)
        maximum_derivative=max(maximum_derivative,derivative_error)
        retained.append({'leftParameter':t,'rightParameter':s,'leftPoint':ap,'rightPoint':bp,
            'leftDerivative':ad,'rightDerivative':bd,'leftMethod':ma,'rightMethod':mb,
            'leftDistinctKnotInterval':asp,'rightDistinctKnotInterval':bsp,
            'pointDeviationMM':point_error,'derivativeScaledDeviation':derivative_error})
    signed=[]
    for row,record in zip(rows,(left,right)):
        reader=adj['configured_reader']()
        from OCP.IFSelect import IFSelect_RetDone
        from OCP.TopExp import TopExp_Explorer
        from OCP.TopAbs import TopAbs_FACE
        from OCP.TopoDS import TopoDS
        from OCP.BRepAdaptor import BRepAdaptor_Surface
        require(reader.ReadFile(str(output/row['files']['iges']))==IFSelect_RetDone and reader.TransferOneRoot(1),
                'Actual orthogonal signed-normal root missing')
        explorer=TopExp_Explorer(reader.Shape(reader.NbShapes()),TopAbs_FACE)
        adapter=BRepAdaptor_Surface(TopoDS.Face(explorer.Current()),True)
        point,du,dv=face['evaluate_surface'](adapter,0.37,0.61)
        cross=[du[1]*dv[2]-du[2]*dv[1],du[2]*dv[0]-du[0]*dv[2],du[0]*dv[1]-du[1]*dv[0]]
        error=vector_error(cross,record['cross'])[1]
        graph(error<=1e-7,'Independent actual signed normal differs from exact orthogonal coefficient control')
        signed.append({'wrapperId':row['wrapperId'],'parameter':[0.37,0.61],'du':du,'dv':dv,
                       'cross':cross,'expectedCross':record['cross'],'scaledDeviation':error})
    dot=sum(x*y for x,y in zip(signed[0]['cross'],signed[1]['cross']))
    graph(abs(dot)<=1e-7*max(1,math.hypot(*signed[0]['cross'])*math.hypot(*signed[1]['cross'])),
          'Actual signed normals not orthogonal')
    return {'name':fixture['name'],'descriptor':descriptor,'nativeValidation':fixture['validation'],
        'productCompatibility':fixture['productCompatibility'],'oldProductRejection':fixture['oldProductRejection'],'independentOrthogonalCoefficients':proof,
        'localFaceChecks':[entry[0] for entry in local],'signedNormals':signed,'actualSignedNormalDot':dot,
        'sharedMapping':{'left':am,'right':bm,'parameterRelation':'tRight=1-tLeft'},
        'sharedSamples':retained,'maxSharedPointDeviationMM':maximum_point,'maxSharedDerivativeScaledDeviation':maximum_derivative,
        'counts':{'faces':2,'vertices':6,'undirectedEdges':7,'uses':8,'sharedEdges':1},
        'sewingPerformed':False,'sharedOCCTIsSameClaim':False,'sourceGeometryStatus':'Original local faces remain not-certified.'}


def main():
    parser=argparse.ArgumentParser()
    parser.add_argument('evidence')
    modes=['wrong-owner','wrong-sense','wrong-edge','wrong-vertex','missing-use','duplicate-use','minute-point']
    group=parser.add_mutually_exclusive_group()
    group.add_argument('--negative',default='',choices=['',*modes])
    for mode in modes:
        group.add_argument('--'+mode,dest='negative',action='store_const',const=mode)
    args=parser.parse_args()
    output=Path(args.evidence).resolve()
    manifest=json.loads((output/'manifest.json').read_text())
    require(len(manifest['fixtures'])==12,'Exactly12 bounded original orthogonal product pairs')
    if args.negative:
        inspect_pair(output,manifest['fixtures'][0],args.negative)
        raise AssertionError('Orthogonal reader negative unexpectedly passed')
    source_controls=manifest['negativeControls']['sourceControls']
    graph_controls=manifest['negativeControls']['graphControls']
    require(len(source_controls)==11 and all(control['actualStatus']==control['expectedStatus']
            and control['actualStatus'] in ('unsupported','invalid') and control.get('reason')
            for control in source_controls.values()),'Actual new API must retain11 named source rejections')
    require(set(graph_controls)==set(modes) and all(control['status']=='rejected' and control.get('reason')
            for control in graph_controls.values()),'Actual product validator must retain7 named graph rejections')
    compatibility=manifest['compatibility']
    require(compatibility['orthogonalRejectedByOld']==12 and compatibility['coplanar']['status']=='accepted'
            and compatibility['coplanar']['report']=={'incidenceValid':True,'geometryFamily':'exact-axis-rectangles-v0',
                'sharedEdges':1,'closed':False,'solid':False},'Current product compatibility contract changed')
    # The old pair oracle is used ONLY for the recorded coplanar control, never
    # for any orthogonal fixture or its separately derived coefficient proof.
    coplanar=compatibility['coplanar']['descriptor']
    adj['descriptor_association'](coplanar,[{'wrapperId':record['id'],'bundle':record['bundle']} for record in coplanar['faces']])
    results=[inspect_pair(output,fixture) for fixture in manifest['fixtures']]
    negatives={}
    for mode in modes:
        run=subprocess.run([sys.executable,str(Path(__file__).resolve()),str(output),'--negative',mode],capture_output=True,text=True)
        require(run.returncode==1 and 'Orthogonal adjacency graph geometry comparison failed' in run.stderr,
                'Graph-only negative must fail after readable actual geometry: '+mode)
        negatives[mode]={'exit':run.returncode,'status':'rejected','stdout':run.stdout,'stderr':run.stderr}
    controls={}
    for name,control in manifest.get('unsupportedControls',{}).items():
        if 'files' in control and 'iges' in control['files']:
            controls[name]=adj['read_unsupported'](output,name,control)
        else:
            controls[name]={'recognizerRecord':control,'reader':'No actual control export supplied; no generic validity is inferred.'}
    report={'base':manifest['base'],'head':manifest['head'],
        'reader':{'cadquery-ocp':importlib.metadata.version('cadquery-ocp'),'python':sys.version,'interpreter':sys.executable,'platform':platform.platform()},
        'readerHashes':{'read-orthogonal-ocp.py':sha(Path(__file__)),'read-face-ocp.py':sha(FACE_READER),
                        'read-adjacency-ocp.py':sha(ADJACENCY_READER),'read-derivatives-ocp.py':sha(DERIVATIVE_READER)},
        'fixtures':results,'negativeGraphControls':negatives,'negativeControls':manifest.get('negativeControls',{}),
        'compatibility':manifest['compatibility'],'unsupportedControls':controls,
        'limits':{'nativePositionMM':1e-9,'nativeDerivativeScaled':1e-9,'readerPositionMM':1e-7,'readerDerivativeScaled':1e-7,'areaScaled':1e-7},
        'limitations':['Exact orthogonal axis rectangle family only; coplanar API/report remain separate and unchanged.',
            'Per-face native geometry remains not-certified; no shared smooth normal across a perpendicular crease.',
            'Two-file geometry only; no sewing, shared IsSame topology, shell, solid, STEP or global reader certificate.']}
    filename=output/'orthogonal-readback.json'
    filename.write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    print(json.dumps({'report':str(filename),'sha256':sha(filename),'pairs':len(results),'faces':2*len(results),
                      'sharedSamples':sum(len(record['sharedSamples']) for record in results),'negativeGraphs':len(negatives)}))


if __name__=='__main__':
    main()
