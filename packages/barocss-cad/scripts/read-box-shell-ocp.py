"""Independent original axis-box shell consumer; no sewing or reader solid creation."""
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

from OCP.IFSelect import IFSelect_RetDone
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_FACE, TopAbs_EDGE
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Surface, BRepAdaptor_Curve
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps

SCRIPTS=Path(__file__).parent
ADJ_READER=SCRIPTS/'read-adjacency-ocp.py'
FACE_READER=SCRIPTS/'read-face-ocp.py'
D1_READER=SCRIPTS/'read-derivatives-ocp.py'
adj=runpy.run_path(str(ADJ_READER))
face=runpy.run_path(str(FACE_READER))
util=runpy.run_path(str(D1_READER))
require=util['require']
vector_error=util['vector_error']
TABLE=[[0,4,6,2],[1,3,7,5],[0,1,5,4],[2,6,7,3],[0,2,3,1],[4,5,7,6]]
SEGMENTS=[(0,1),(0,2),(0,4),(1,3),(1,5),(2,3),(2,6),(3,7),(4,5),(4,6),(5,7),(6,7)]
NORMALS=[[-1,0,0],[1,0,0],[0,-1,0],[0,1,0],[0,0,-1],[0,0,1]]
MODES=['missing-face','duplicate-face','inward-face','reversed-edge-use','missing-use','duplicate-use',
       'wrong-owner','wrong-vertex','minute-point','near-face','partial-face','zero-side','corrupt-pole']


def sha(filename): return hashlib.sha256(filename.read_bytes()).hexdigest()

def graph(condition,message):
    require(condition,'Axis box shell graph geometry comparison failed: '+message)


def keys(value,expected): return isinstance(value,dict) and set(value)==set(expected)


def cross(a,b): return [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]


def box_coefficients(origin,sides):
    graph(len(origin)==len(sides)==3 and all(type(x) in (int,float) and math.isfinite(x) and int(x)==x for x in [*origin,*sides]),
          'Finite exact integer origin and side tuple')
    graph(all(1<=x<=10000 for x in sides),'Three bounded positive axis side magnitudes')
    points=[[origin[k]+((index>>k)&1)*sides[k] for k in range(3)] for index in range(8)]
    graph(all(abs(x)<=10000 for point in points for x in point),'Every exact box corner within coordinate bounds')
    return points


def verify_graph(descriptor,rows,origin,sides):
    graph(keys(descriptor,['version','id','origin','sides','faces','vertices','edges']) and type(descriptor['version']) is int
          and descriptor['version']==0 and descriptor['origin']==origin and descriptor['sides']==sides,'Fixed box descriptor fields/coefficients')
    points=box_coefficients(descriptor['origin'],descriptor['sides'])
    graph(len(descriptor['faces'])==6 and len(descriptor['vertices'])==8 and len(descriptor['edges'])==12,
          'Six faces/eight vertices/twelve global segments')
    graph(all(keys(row,['id','bundle']) for row in descriptor['faces'])
          and [row['id'] for row in descriptor['faces']]==[row['wrapperId'] for row in rows], 'Six ordered qualified face wrappers')
    identifiers=[descriptor['id']]+[row['id'] for row in descriptor['faces']]
    identifiers += [row['id'] for row in descriptor['vertices']]+[row['id'] for row in descriptor['edges']]
    graph(len(identifiers)==27 and len(set(identifiers))==27 and all(isinstance(x,str) and len(x)<=128
          and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_-]*',x) for x in identifiers),'Twenty-seven explicit unique bounded graph IDs')
    graph(all(keys(row,['id','point']) for row in descriptor['vertices'])
          and [row['point'] for row in descriptor['vertices']]==points,'Exact global corner mapping; no epsilon coincidence')
    expected_uses=[[] for _ in SEGMENTS]
    records=[]
    for i,(wrapped,row,indices) in enumerate(zip(descriptor['faces'],rows,TABLE)):
        graph(wrapped['bundle']==row['bundle'],'Source local bundles must remain unchanged')
        record=adj['rectangle'](wrapped['bundle'])
        expected_corners=[points[index] for index in indices]
        graph(record['corners']==expected_corners,'Face plane/full corner coverage differs from exact outward table')
        axis=i//2
        expected_plane=origin[axis]+(sides[axis] if i%2 else 0)
        graph(all(point[axis]==expected_plane for point in record['corners']),'Face must occupy its unique min/max supporting plane')
        magnitude=math.hypot(*record['cross'])
        graph([x/magnitude for x in record['cross']]==NORMALS[i],'Outward regular face cross product required')
        records.append(record)
        for local_edge in range(4):
            a,b=indices[local_edge],indices[(local_edge+1)%4]
            global_edge=next(j for j,pair in enumerate(SEGMENTS) if set(pair)=={a,b})
            sense='forward' if (a,b)==SEGMENTS[global_edge] else 'reverse'
            expected_uses[global_edge].append({'faceId':wrapped['id'],
                'edgeId':record['topology']['edges'][local_edge]['id'],'curveId':record['curves'][local_edge]['id'],'sense':sense})
    adjacency={row['id']:set() for row in descriptor['faces']}
    for i,(edge,pair,uses) in enumerate(zip(descriptor['edges'],SEGMENTS,expected_uses)):
        graph(keys(edge,['id','vertexIds','canonical','uses']) and edge['vertexIds']==[descriptor['vertices'][j]['id'] for j in pair],
              'Canonical global segment/endpoints')
        ordered=sorted(uses,key=lambda use:0 if use['sense']=='forward' else 1)
        graph(len(ordered)==2 and [use['sense'] for use in ordered]==['forward','reverse'],
              'Every geometric segment must have two opposite actual local boundary traversals')
        graph(edge['uses']==ordered and all(keys(use,['faceId','edgeId','curveId','sense']) for use in edge['uses']),
              'Exact qualified edge owners/curves/senses')
        canonical={key:ordered[0][key] for key in ('faceId','edgeId','curveId')}
        graph(edge['canonical']==canonical,'Canonical reference must name forward physical global segment curve')
        graph(ordered[0]['faceId']!=ordered[1]['faceId'],'Distinct incident faces required')
        adjacency[ordered[0]['faceId']].add(ordered[1]['faceId'])
        adjacency[ordered[1]['faceId']].add(ordered[0]['faceId'])
    reached=set()
    pending=[descriptor['faces'][0]['id']]
    while pending:
        owner=pending.pop()
        if owner not in reached:
            reached.add(owner);pending.extend(adjacency[owner]-reached)
    graph(len(reached)==6,'Connected face boundary adjacency required independently of Euler count')
    return records,{'cornerPoints':points,'outwardFaceTable':TABLE,'canonicalSegments':SEGMENTS,
        'outwardNormals':NORMALS,'connectedFaces':len(reached),'edgeCoverage':[len(uses) for uses in expected_uses],
        'halfspaces':[{'axis':i,'min':origin[i],'max':origin[i]+sides[i]} for i in range(3)],
        'analyticVolumeMM3':math.prod(sides),'analyticAreaMM2':2*(sides[0]*sides[1]+sides[1]*sides[2]+sides[2]*sides[0]),
        'derivation':'Six exact full min/max planes bound the positive axis interval product. Face normals are outward and every full boundary segment has exactly two opposite qualified uses; the face graph is connected.',
        'scope':'Exact represented axis-box shell only; counts/Euler or reader IsValid alone are not a generic solid certificate.'}


def local_adapter(output,row,curve_id):
    reader=adj['configured_reader']()
    filename=output/row['files']['iges']
    require(reader.ReadFile(str(filename))==IFSelect_RetDone,'Actual box-face file load failed')
    mapping=next(item for item in row['exportReport']['objects'] if item['id']==curve_id)
    root=(mapping['directoryPointer']+1)//2
    require(mapping['entity']==126 and root in (2,3,4,5) and reader.TransferOneRoot(root),'Qualified actual edge root missing')
    check=util['diagnostics'](reader.WS().TransferReader().LastCheckList())
    require(not check['failures'] and not check['warnings'],'Unexpected actual edge transfer diagnostics')
    explorer=TopExp_Explorer(reader.Shape(reader.NbShapes()),TopAbs_EDGE)
    require(explorer.More(),'Actual box boundary curve missing')
    adapter=BRepAdaptor_Curve(TopoDS.Edge(explorer.Current()))
    require([adapter.FirstParameter(),adapter.LastParameter()]==[0,1],'Original box edge parameter domain changed')
    return reader,adapter,mapping


def mutate(descriptor,mode):
    if mode=='missing-face':descriptor['faces'].pop()
    elif mode=='duplicate-face':descriptor['faces'][1]=json.loads(json.dumps(descriptor['faces'][0]))
    elif mode=='inward-face':
        p=descriptor['faces'][0]['bundle']['geometry']['objects'][0]['controlPoints']
        p[0],p[1]=p[1],p[0]
    elif mode=='reversed-edge-use':descriptor['edges'][0]['uses'][1]['sense']='forward'
    elif mode=='missing-use':descriptor['edges'][0]['uses'].pop()
    elif mode=='duplicate-use':descriptor['edges'][0]['uses'].append(dict(descriptor['edges'][0]['uses'][0]))
    elif mode=='wrong-owner':descriptor['edges'][0]['canonical']['faceId']=descriptor['faces'][0]['id']
    elif mode=='wrong-vertex':descriptor['edges'][0]['vertexIds'][1]=descriptor['vertices'][2]['id']
    elif mode=='minute-point':descriptor['vertices'][0]['point'][0]+=1e-10
    elif mode in ('near-face','partial-face'):
        surface=descriptor['faces'][0]['bundle']['geometry']['objects'][0]
        surface['controlPoints'][0][0][0]+=1e-10 if mode=='near-face' else 0.5
    elif mode=='zero-side':descriptor['sides'][0]=0


def inspect(output,fixture,mode=''):
    rows=fixture['faces']
    graph(len(rows)==6,'Six independent source FaceBundles required')
    local=[adj['read_local_face'](output,fixture['name'],row)[0] for row in rows]
    # The original six actual exported faces pass first. Descriptor-only
    # negatives cannot hide behind those independent reader-valid faces.
    descriptor=json.loads(json.dumps(fixture['descriptor']))
    mutate(descriptor,mode)
    records,proof=verify_graph(descriptor,rows,fixture['origin'],fixture['sides'])
    validation=fixture['validation']
    graph(validation=={'incidenceValid':True,'geometryFamily':'exact-axis-box-shell-v0','closed':True,
                       'solid':False,'solidProductImplemented':False},
          'New native shell report must keep its exact five fields and no solid/volume API claim')
    reuse=fixture['productReuseEvidence']
    graph(len(reuse)==12,'Actual existing519 selector reuse requires12 measured edges')
    by_record={row['wrapperId']:record for row,record in zip(rows,records)}
    for edge,record in zip(descriptor['edges'],reuse):
        graph(record['globalEdgeId']==edge['id'] and len(record['attempts'])==2,'Measured selector reuse qualified edge/argument orders')
        outcomes=[]
        for attempt in record['attempts']:
            lhs,rhs=[by_record[owner] for owner in attempt['faceIds']]
            axes=[lhs['axisA'],next(i for i,x in enumerate(lhs['B']) if x!=0),rhs['axisA']]
            accepted=len(set(axes))==3 and lhs['B']==rhs['B']
            accepted=accepted and rhs['origin']==[lhs['origin'][i]+lhs['A'][i] for i in range(3)]
            graph((attempt['status']=='accepted')==accepted,'Actual519 fixed-selector outcome differs from independent coefficient gate')
            outcomes.append(accepted)
        graph(record['accepted']==any(outcomes),'Measured reuse summary must match its two actual attempts')
    graph(fixture['analyticVolumeMM3']==proof['analyticVolumeMM3'] and fixture['analyticAreaMM2']==proof['analyticAreaMM2'],
          'Authored analytic box volume/area differs from independent coefficient derivation')
    by_owner={row['wrapperId']:row for row in rows}
    retained_edges=[]
    maximum_point=maximum_derivative=0.0
    graph(len(fixture['edgeQueries'])==12,'Twelve declared common-edge query arrays')
    for edge_index,(edge,samples,pair) in enumerate(zip(descriptor['edges'],fixture['edgeQueries'],SEGMENTS)):
        graph(len(samples)==19,'Nineteen declared parameters per edge')
        forward,reverse=edge['uses']
        lr,la,lm=local_adapter(output,by_owner[forward['faceId']],forward['curveId'])
        rr,ra,rm=local_adapter(output,by_owner[reverse['faceId']],reverse['curveId'])
        start,end=proof['cornerPoints'][pair[0]],proof['cornerPoints'][pair[1]]
        expected_derivative=[end[i]-start[i] for i in range(3)]
        graph(0 in [sample['parameter'] for sample in samples] and 1 in [sample['parameter'] for sample in samples], 'Shared edge endpoints missing')
        retained=[]
        for sample in samples:
            t=sample['parameter'];f,r=sample['forward'],sample['reverse']
            graph({key:f[key] for key in ('faceId','edgeId','curveId')}=={key:forward[key] for key in ('faceId','edgeId','curveId')}
                  and {key:r[key] for key in ('faceId','edgeId','curveId')}=={key:reverse[key] for key in ('faceId','edgeId','curveId')},
                  'Declared query qualified edge ownership differs')
            graph(f['parameter']==t and r['parameter']==1-t,'Global edge original parameter reversal')
            point=[start[i]+t*expected_derivative[i] for i in range(3)]
            graph(math.dist(sample['expectedPoint'],point)<=1e-9 and vector_error(sample['expectedDerivative'],expected_derivative)[1]<=1e-9,
                  'Independent authored edge coefficient control')
            graph(math.dist(f['point'],point)<=1e-9 and math.dist(r['point'],point)<=1e-9
                  and vector_error(f['derivative'],expected_derivative)[1]<=1e-9
                  and vector_error(r['derivative'],[-x for x in expected_derivative])[1]<=1e-9,'Native common point/tangent agreement')
            lp,ld,lspan,lmethod=face['evaluate_curve'](la,t)
            rp,rd,rspan,rmethod=face['evaluate_curve'](ra,1-t)
            point_error=max(math.dist(lp,rp),math.dist(lp,point),math.dist(rp,point))
            derivative_error=max(vector_error(ld,expected_derivative)[1],vector_error(rd,[-x for x in expected_derivative])[1],
                                 vector_error(ld,[-x for x in rd])[1])
            graph(point_error<=1e-7 and derivative_error<=1e-7,'Actual two-file global segment position/D1 comparison')
            maximum_point=max(maximum_point,point_error);maximum_derivative=max(maximum_derivative,derivative_error)
            retained.append({'parameter':t,'forwardParameter':t,'reverseParameter':1-t,'forwardPoint':lp,'reversePoint':rp,
                'forwardDerivative':ld,'reverseDerivative':rd,'pointDeviationMM':point_error,'derivativeScaledDeviation':derivative_error,
                'forwardMethod':lmethod,'reverseMethod':rmethod,'forwardSpan':lspan,'reverseSpan':rspan})
        retained_edges.append({'edge':edge,'forwardExport':lm,'reverseExport':rm,'samples':retained})
    flux_terms=[]
    reader_area=0.0
    for i,(row,record) in enumerate(zip(rows,records)):
        reader=adj['configured_reader']()
        require(reader.ReadFile(str(output/row['files']['iges']))==IFSelect_RetDone and reader.TransferOneRoot(1),'Actual box area/normal root missing')
        explorer=TopExp_Explorer(reader.Shape(reader.NbShapes()),TopAbs_FACE)
        actual_face=TopoDS.Face(explorer.Current())
        adapter=BRepAdaptor_Surface(actual_face,True)
        point,du,dv=face['evaluate_surface'](adapter,0.37,0.61)
        actual_cross=cross(du,dv);norm=math.hypot(*actual_cross)
        normal=[x/norm for x in actual_cross]
        graph(vector_error(normal,NORMALS[i])[1]<=1e-7,'Actual reader face normal must face outward')
        props=GProp_GProps()
        estimated=BRepGProp.SurfaceProperties_s(actual_face,props,1e-10,False)
        area=props.Mass();centroid=util['xyz'](props.CentreOfMass())
        expected_centroid=[sum(proof['cornerPoints'][j][k] for j in TABLE[i])/4 for k in range(3)]
        graph(math.dist(centroid,expected_centroid)<=1e-7,'Actual reader area centroid differs from independent rectangle centroid')
        graph(abs(area-record['areaMM2'])<=1e-7*max(1,record['areaMM2']),'Actual reader box-face analytic area comparison')
        term=math.fsum(centroid[k]*normal[k] for k in range(3))*area/3
        reader_area+=area
        flux_terms.append({'wrapperId':row['wrapperId'],'areaMM2':area,'areaCentroidMM':centroid,'outwardUnitNormal':normal,
            'du':du,'dv':dv,'signedCross':actual_cross,'volumeFluxTermMM3':term,
            'quadrature':{'requestedRelativePrecision':1e-10,'estimatedRelativeError':estimated,'separateFromGeometryLimit':True}})
    reader_volume=math.fsum(term['volumeFluxTermMM3'] for term in flux_terms)
    volume_error=abs(reader_volume-proof['analyticVolumeMM3'])/max(1,proof['analyticVolumeMM3'])
    area_error=abs(reader_area-proof['analyticAreaMM2'])/max(1,proof['analyticAreaMM2'])
    graph(volume_error<=1e-7 and area_error<=1e-7,'Independent reader signed boundary-flux volume and area comparison')
    measured=fixture['nativeMeasurements']
    for key in ('fluxVolume',)+(('volume',) if 'volume' in measured else ()):
        graph(abs(measured[key]-proof['analyticVolumeMM3'])<=1e-9*max(1,proof['analyticVolumeMM3']),'Native reported volume differs from coefficients')
    graph(abs(measured['area']-proof['analyticAreaMM2'])<=1e-9*max(1,proof['analyticAreaMM2']),'Native reported area differs from coefficients')
    return {'name':fixture['name'],'descriptor':descriptor,'nativeValidation':fixture['validation'],
        'independentBoxProof':proof,'localFaceChecks':local,'edgeChecks':retained_edges,'signedFaceFlux':flux_terms,
        'readerVolumeMM3':reader_volume,'analyticVolumeMM3':proof['analyticVolumeMM3'],'volumeScaledDeviation':volume_error,
        'readerAreaMM2':reader_area,'analyticAreaMM2':proof['analyticAreaMM2'],'areaScaledDeviation':area_error,
        'maxSharedPointDeviationMM':maximum_point,'maxSharedDerivativeScaledDeviation':maximum_derivative,
        'counts':{'faces':6,'vertices':8,'undirectedEdges':12,'uses':24},
        'productReuseEvidence':reuse,
        'readerSewingPerformed':False,'readerSolidCreated':False,
        'interpretation':'Exact restricted box geometry and independent face-flux measurement; no serialized shell/solid or generic validity claim.'}


def create_corrupt_pole(output,fixture):
    row=fixture['faces'][0]
    original=output/row['files']['iges']
    require(sha(original)==row['hashes']['iges'],'Original actual export hash must pass before consumer control')
    rows=original.read_text().splitlines()
    selected=[i for i,row in enumerate(rows) if row[72]=='P' and int(row[64:72])==1]
    data=''.join(rows[i][:64] for i in selected)
    tokens=data.strip().rstrip(';').split(',')
    index=22  # 128 header10 + Uknots4 + Vknots4 + weights4; first pole X.
    require(float(tokens[index])==0,'Minimum-box first surface pole must start at X=0')
    start=sum(len(token)+1 for token in tokens[:index])
    token=tokens[index]
    replacement=token[:len(token)-len(token.lstrip())]+'1.0'
    require(len(replacement)==len(token),'Physical negative must preserve record width/data pointers')
    data=data[:start]+replacement+data[start+len(token):]
    for part,row_index in enumerate(selected):
        rows[row_index]=data[part*64:(part+1)*64]+rows[row_index][64:]
    filename=output/'controls/corrupt-pole.iges'
    filename.parent.mkdir(parents=True,exist_ok=True)
    filename.write_text('\n'.join(rows)+'\n')
    require(all(len(row)==80 for row in rows),'Corrupt consumer fixture record width must remain80')
    return {'originalFile':str(original),'originalSHA256':sha(original),
            'modifiedFile':str(filename),'modifiedSHA256':sha(filename),
            'entity':128,'directoryPointer':1,'coordinateTokenIndex':index,'coordinate':'X',
            'before':0,'after':1,'fixedRecordWidth':80,'dataPointersUnchanged':True,
            'consumerOnly':True,'nativeSourceAndBundleUnchanged':True,
            'scope':'Actual per-face surface pole corruption; no kernel healing, source mutation or baseline hash relaxation.'}


def inspect_corrupt_pole(output,fixture):
    row=fixture['faces'][0]
    original=output/row['files']['iges']
    require(sha(original)==row['hashes']['iges'],'Original actual export hash changed')
    filename=output/'controls/corrupt-pole.iges'
    rows=filename.read_text().splitlines()
    directories=[row for row in rows if row[72]=='D']
    parameters=[row for row in rows if row[72]=='P']
    require(all(len(row)==80 for row in rows) and len(directories)==10,'Physical control fixed-record structure changed')
    for i,mapping in enumerate(row['exportReport']['objects']):
        pointer=2*i+1
        owned=[record for record in parameters if int(record[64:72])==pointer]
        require(int(directories[2*i][8:16])==mapping['parameterPointer']
                and len(owned)==mapping['parameterRecords'] and int(owned[0][73:])==mapping['parameterPointer'],
                'Physical control must retain all original directory/data pointers')
    reader=adj['configured_reader']()
    require(reader.ReadFile(str(filename))==IFSelect_RetDone,'Corrupted actual file did not reach readable geometry')
    check=util['diagnostics'](reader.WS().ModelCheckList(True))
    require(not check['failures'] and not check['warnings'],'Corrupted control unexpected load diagnostics')
    model=reader.IGESModel();units=model.GlobalSection()
    require(model.NbEntities()==reader.NbRootsForTransfer()==5 and model.Entity(1).TypeNumber()==128
            and units.UnitFlag()==2 and units.Scale()==1,'Corrupted control entity/unit structure must remain valid')
    require(reader.TransferOneRoot(1),'Corrupted actual surface did not transfer')
    check=util['diagnostics'](reader.WS().TransferReader().LastCheckList())
    require(not check['failures'] and not check['warnings'],'Corrupted control unexpected transfer diagnostics')
    explorer=TopExp_Explorer(reader.Shape(reader.NbShapes()),TopAbs_FACE)
    require(explorer.More(),'Corrupted actual surface face missing')
    adapter=BRepAdaptor_Surface(TopoDS.Face(explorer.Current()),True)
    actual,du,dv=face['evaluate_surface'](adapter,0,0)
    expected=fixture['origin']
    error=math.dist(actual,expected)
    graph(error<=1e-7,f'Actual corrupted surface corner/graph geometry mismatch {error} mm')
    raise AssertionError('Physical exported pole corruption unexpectedly passed')


def main():
    parser=argparse.ArgumentParser();parser.add_argument('evidence')
    group=parser.add_mutually_exclusive_group()
    group.add_argument('--negative',default='',choices=['',*MODES])
    for mode in MODES:group.add_argument('--'+mode,dest='negative',action='store_const',const=mode)
    args=parser.parse_args();output=Path(args.evidence).resolve()
    manifest=json.loads((output/'manifest.json').read_text())
    controls=manifest['negativeControls']
    require(set(controls)==set(MODES)-{'corrupt-pole'}
            and all(value['status']=='rejected' and value.get('reason') for value in controls.values()),
            'Actual new shell validator must retain all12 named product graph rejections')
    source_controls=manifest['sourceControls']
    require(set(source_controls)=={'non-axis','weighted','invalid-native'}
            and source_controls['non-axis']['classification']=='valid-native-unsupported'
            and source_controls['weighted']['classification']=='valid-native-unsupported'
            and source_controls['invalid-native']['classification']=='invalid-native',
            'Actual product must preserve valid-unsupported versus malformed-native source controls')
    require(len(manifest['fixtures'])==4,'Four actual bounded native axis-box shell fixtures')
    if args.negative:
        if args.negative=='corrupt-pole':
            inspect_corrupt_pole(output,manifest['fixtures'][0])
        else:
            inspect(output,manifest['fixtures'][0],args.negative)
        raise AssertionError('Box negative unexpectedly passed')
    results=[inspect(output,fixture) for fixture in manifest['fixtures']]
    corrupt_evidence=create_corrupt_pole(output,manifest['fixtures'][0])
    negatives={}
    for mode in MODES:
        run=subprocess.run([sys.executable,str(Path(__file__).resolve()),str(output),'--negative',mode],capture_output=True,text=True)
        require(run.returncode==1 and 'Axis box shell graph geometry comparison failed' in run.stderr,'Independent readable-face graph control must fail: '+mode)
        negatives[mode]={'exit':run.returncode,'status':'rejected','stdout':run.stdout,'stderr':run.stderr}
    controls={name:adj['read_unsupported'](output,name,row) for name,row in manifest.get('unsupportedControls',{}).items()
              if 'files' in row and 'iges' in row['files']}
    report={'base':manifest['base'],'head':manifest['head'],
        'reader':{'cadquery-ocp':importlib.metadata.version('cadquery-ocp'),'python':sys.version,'interpreter':sys.executable,'platform':platform.platform()},
        'readerHashes':{'read-box-shell-ocp.py':sha(Path(__file__)),'read-adjacency-ocp.py':sha(ADJ_READER),
                        'read-face-ocp.py':sha(FACE_READER),'read-derivatives-ocp.py':sha(D1_READER)},
        'fixtures':results,'negativeGraphControls':negatives,'corruptPoleEvidence':corrupt_evidence,'negativeControls':manifest['negativeControls'],'sourceControls':source_controls,
        'unsupportedControls':controls,'productReuseEvidence':{fixture['name']:fixture['productReuseEvidence'] for fixture in manifest['fixtures']},
        'limits':{'nativePositionMM':1e-9,'nativeDerivativeScaled':1e-9,'readerPositionMM':1e-7,'readerDerivativeScaled':1e-7,'areaScaled':1e-7,'volumeScaled':1e-7},
        'limitations':['Original exact axis-box shell API only; solid:false and solidProductImplemented:false.',
            'Each native local face remains geometricValidity:not-certified and solid:false.',
            'Twenty-four separate original files serialize geometry only; no reader sewing, shared IsSame, shell or solid fabrication.']}
    filename=output/'box-shell-readback.json';filename.write_text(json.dumps(report,indent=2,allow_nan=False)+'\n')
    print(json.dumps({'report':str(filename),'sha256':sha(filename),'boxes':len(results),'faces':6*len(results),
                     'sharedSamples':sum(len(edge['samples']) for record in results for edge in record['edgeChecks']),
                     'negativeGraphs':len(negatives)}))


if __name__=='__main__':main()
