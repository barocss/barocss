"""Independent two-file geometry/qualified-adjacency consumer; no sewing."""
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import platform
import re
import runpy
import sys

from OCP.IGESControl import IGESControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE, TopAbs_WIRE, TopAbs_VERTEX
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Curve, BRepAdaptor_Surface
from OCP.BRepCheck import BRepCheck_Analyzer
from OCP.BRepAlgoAPI import BRepAlgoAPI_Check
from OCP.BRepGProp import BRepGProp
from OCP.GProp import GProp_GProps
from OCP.Interface import Interface_Static

FACE_READER = Path(__file__).with_name('read-face-ocp.py')
DERIVATIVE_READER = Path(__file__).with_name('read-derivatives-ocp.py')
face_util = runpy.run_path(str(FACE_READER))
utilities = runpy.run_path(str(DERIVATIVE_READER))
require = utilities['require']
vector_error = utilities['vector_error']
xyz = utilities['xyz']
diagnostics = utilities['diagnostics']


def graph(condition, message, derivative=False):
    label = 'Adjacency graph derivative comparison failed' if derivative else 'Adjacency graph geometry comparison failed'
    require(condition, label + ': ' + message)


def digest(filename):
    return hashlib.sha256(filename.read_bytes()).hexdigest()


def artifact(output, relative):
    filename = (output/relative).resolve()
    require(filename.is_relative_to(output.resolve()), 'Evidence path outside output directory')
    return filename


def keys(value, expected):
    return isinstance(value, dict) and set(value) == set(expected)


def rectangle(bundle):
    surface, curves, topology = face_util['graph_layout'](bundle)
    p = surface['controlPoints']
    graph(surface['degreeU'] == surface['degreeV'] == 1 and surface['knotsU'] == surface['knotsV'] == [0,0,1,1]
          and len(p) == 2 and all(len(row) == 2 for row in p) and surface['weights'] == [[1,1],[1,1]], 'Unsupported exact rectangle structure')
    graph(all(type(x) in (int,float) and math.isfinite(x) and x == int(x) and abs(x) <= 10000
              for row in p for point in row for x in point), 'Exact represented rectangle coordinate bound')
    a, b = [p[1][0][i]-p[0][0][i] for i in range(3)], [p[0][1][i]-p[0][0][i] for i in range(3)]
    aa, ab = [i for i,x in enumerate(a) if x != 0], [i for i,x in enumerate(b) if x != 0]
    graph(len(aa) == len(ab) == 1 and aa != ab and 1 <= abs(a[aa[0]]) <= 10000
          and 1 <= abs(b[ab[0]]) <= 10000, 'Two distinct signed rectangle axes required')
    graph(p[1][1] == [p[0][0][i]+a[i]+b[i] for i in range(3)], 'Exact parallelogram coefficients required')
    corners = [p[0][0],p[1][0],p[1][1],p[0][1]]
    graph([vertex['point'] for vertex in topology['vertices']] == corners, 'Local vertices must exactly equal represented corners')
    normal = [a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]]
    return {'surface':surface,'curves':curves,'topology':topology,'origin':p[0][0],
            'A':a,'B':b,'axisA':aa[0],'cross':normal,'corners':corners,'areaMM2':math.hypot(*normal)}


def descriptor_association(descriptor, faces):
    graph(keys(descriptor,['version','id','faces','vertices','edges']) and type(descriptor['version']) is int and descriptor['version'] == 0, 'Fixed descriptor shape/version')
    graph(len(descriptor['faces']) == 2 and len(descriptor['vertices']) == 6 and len(descriptor['edges']) == 7, 'Fixed adjacency cardinalities')
    graph(all(keys(item,['id','bundle']) for item in descriptor['faces']), 'Qualified face wrapper fields')
    graph([item['id'] for item in descriptor['faces']] == [item['wrapperId'] for item in faces], 'Face wrapper ownership mismatch')
    graph(all(item['bundle'] == expected['bundle'] for item,expected in zip(descriptor['faces'],faces)), 'Preserved owned local bundle mismatch')
    ids = [descriptor['id']] + [item['id'] for item in descriptor['faces']]
    ids += [item['id'] for item in descriptor['vertices']] + [item['id'] for item in descriptor['edges']]
    graph(len(ids) == 16 and len(set(ids)) == 16 and all(isinstance(value,str) and len(value) <= 128
          and re.fullmatch(r'[A-Za-z_][A-Za-z0-9_-]*',value) for value in ids), 'Sixteen explicit distinct bounded descriptor IDs required')
    left,right = [rectangle(item['bundle']) for item in descriptor['faces']]
    graph(left['axisA'] == right['axisA'] and left['A'][left['axisA']]*right['A'][right['axisA']] > 0
          and left['B'] == right['B'] and right['origin'] == [left['origin'][i]+left['A'][i] for i in range(3)],
          'Exact coplanar full-edge/nonoverlapping rectangle relation required')
    expected_corners = [*left['corners'],right['corners'][1],right['corners'][2]]
    graph(all(keys(item,['id','point']) for item in descriptor['vertices'])
          and [item['point'] for item in descriptor['vertices']] == expected_corners, 'Global vertex exact coefficient association')
    owners = [descriptor['faces'][0]['id'],descriptor['faces'][1]['id']]
    local = [left,right]
    refs = []
    for owner,record in zip(owners,local):
        refs.append([{'faceId':owner,'edgeId':record['topology']['edges'][i]['id'],
                      'curveId':record['curves'][i]['id']} for i in range(4)])
    canonical = [*refs[0],*refs[1][:3]]
    pairs = [(0,1),(1,2),(2,3),(3,0),(1,4),(4,5),(5,2)]
    for index,edge in enumerate(descriptor['edges']):
        graph(keys(edge,['id','vertexIds','canonical','uses']), 'Fixed canonical edge fields')
        graph(edge['canonical'] == canonical[index], 'Qualified canonical owner/edge/curve mismatch')
        graph(edge['vertexIds'] == [descriptor['vertices'][i]['id'] for i in pairs[index]], 'Global edge endpoint association')
        uses = [{**canonical[index],'sense':'forward'}]
        if index == 1:
            uses.append({**refs[1][3],'sense':'reverse'})
        graph(len(edge['uses']) == len(uses) and all(keys(use,['faceId','edgeId','curveId','sense']) for use in edge['uses']), 'Fixed use cardinality/fields')
        graph(edge['uses'] == uses, 'Common edge requires qualified opposite use sense; outer uses remain forward', derivative=True)
    return left,right


def read_local_face(output, pair_name, row):
    bundle = row['bundle']
    surface = bundle['geometry']['objects'][0]
    proof = rectangle(bundle)
    graph(row['authoredOrigin'] == proof['origin'] and row['authoredA'] == proof['A']
          and row['authoredB'] == proof['B']
          and row['expectedUnitNormal'] == [x/proof['areaMM2'] for x in proof['cross']],
          'Independent authored rectangle coefficients/signed normal mismatch')
    for key,relative in row['files'].items():
        require(digest(artifact(output,relative)) == row['hashes'][key], key+' local artifact hash mismatch')
    require(json.loads(artifact(output,row['files']['bundle']).read_text()) == bundle, 'Stored local bundle differs')
    report = row['exportReport']
    require(json.loads(artifact(output,row['files']['exportReport']).read_text()) == report, 'Stored local export report differs')
    converted = {'name':pair_name+'-'+row['wrapperId'],'bundle':bundle,'sourceVersion':row.get('sourceVersion',0),
        'constructions':row.get('constructions',[]),'validation':{'incidenceValid':True,'geometricValidity':'not-certified','solid':False},
        'files':row['files'],'hashes':row['hashes'],'surfaceExport':report['objects'][0],
        'edgeExports':report['objects'][1:],'samples':row['queries'],'analyticAreaMM2':row['expectedAreaMM2']}
    actual = face_util['read_fixture'](output,converted,'')
    graph(abs(row['expectedAreaMM2']-proof['areaMM2']) <= 1e-9, 'Exact recognized analytic area mismatch')
    for i,samples in enumerate(row['queries']):
        slopes = [(bundle['topology']['loop']['uses'][i]['pcurve']['uv1'][axis]
                   -bundle['topology']['loop']['uses'][i]['pcurve']['uv0'][axis]) for axis in range(2)]
        expected = [slopes[0]*proof['A'][axis]+slopes[1]*proof['B'][axis] for axis in range(3)]
        for sample in samples:
            point = [proof['origin'][axis]+sample['uv'][0]*proof['A'][axis]+sample['uv'][1]*proof['B'][axis] for axis in range(3)]
            graph(math.dist(point,sample['point']) <= 1e-9 and math.dist(point,sample['analyticPoint']) <= 1e-9, 'Exact rectangle/native analytic point')
            graph(vector_error(sample['derivative'],expected)[1] <= 1e-9
                  and vector_error(sample['analyticDerivative'],expected)[1] <= 1e-9, 'Exact rectangle/native derivative', derivative=True)
    return actual,proof


def configured_reader():
    reader = IGESControl_Reader()
    settings = {'xstep.cascade.unit':'MM','read.iges.bspline.continuity':0,
                'read.precision.mode':0,'read.iges.faulty.entities':0,
                'read.surfacecurve.mode':0,'read.iges.sequence':''}
    for key,value in settings.items():
        success = Interface_Static.SetCVal_s(key,value) if isinstance(value,str) else Interface_Static.SetIVal_s(key,value)
        actual = Interface_Static.CVal_s(key) if isinstance(value,str) else Interface_Static.IVal_s(key)
        require(success and actual == value,'Required independent setting unavailable: '+key)
    return reader


def common_adapter(output,row,curve_id):
    reader = configured_reader()
    require(reader.ReadFile(str(artifact(output,row['files']['iges']))) == IFSelect_RetDone, 'Shared curve actual file load failed')
    mappings = row['exportReport']['objects']
    mapping = next(item for item in mappings if item['id'] == curve_id)
    root = (mapping['directoryPointer']+1)//2
    require(root in (3,5) and reader.TransferOneRoot(root), 'Qualified actual common boundary root transfer failed')
    check = diagnostics(reader.WS().TransferReader().LastCheckList())
    require(not check['failures'] and not check['warnings'],'Unexpected shared root diagnostics')
    explorer = TopExp_Explorer(reader.Shape(reader.NbShapes()),TopAbs_EDGE)
    require(explorer.More(),'Actual common boundary edge unavailable')
    adapter = BRepAdaptor_Curve(TopoDS.Edge(explorer.Current()))
    require([adapter.FirstParameter(),adapter.LastParameter()] == [0,1],'Original shared parameter domain changed')
    return adapter,mapping,reader


def read_pair(output,fixture,mode):
    graph(len(fixture['faces']) == 2,'Two separately exported faces required')
    local = [read_local_face(output,fixture['name'],row) for row in fixture['faces']]
    descriptor = json.loads(json.dumps(fixture['descriptor']))
    if mode == '--wrong-owner':
        descriptor['edges'][0]['canonical']['faceId'] = descriptor['faces'][1]['id']
    elif mode == '--wrong-sense':
        descriptor['edges'][1]['uses'][1]['sense'] = 'forward'
    elif mode == '--wrong-global-point':
        descriptor['vertices'][0]['point'][0] += 1e-10
    elif mode == '--wrong-curve':
        descriptor['edges'][0]['canonical']['curveId'] = descriptor['faces'][0]['bundle']['geometry']['objects'][2]['id']
    left,right = descriptor_association(descriptor,fixture['faces'])
    require(fixture['validation'] == {'incidenceValid':True,'geometryFamily':'exact-axis-rectangles-v0',
            'sharedEdges':1,'closed':False,'solid':False},'Adjacency validation report must remain fixed/bounded')
    left_curve = left['curves'][1]['id']
    right_curve = right['curves'][3]['id']
    a,am,ar = common_adapter(output,fixture['faces'][0],left_curve)
    b,bm,br = common_adapter(output,fixture['faces'][1],right_curve)
    samples = fixture['sharedSamples']
    graph(19 <= len(samples) <= 4096,'Shared endpoint+17 interior sample budget')
    parameters = [sample['leftParameter'] for sample in samples]
    graph(0 in parameters and 1 in parameters and len(set(p for p in parameters if 0 < p < 1)) >= 17,'Shared declared endpoints/interiors missing')
    retained = []
    max_point = max_derivative = max_normal = 0.0
    for sample in samples:
        t,s = sample['leftParameter'],sample['rightParameter']
        graph(s == 1-t,'Original opposite shared parameter association')
        ap,ad,asp,method_a = face_util['evaluate_curve'](a,t)
        bp,bd,bsp,method_b = face_util['evaluate_curve'](b,s)
        expected_point = [left['origin'][i]+left['A'][i]+t*left['B'][i] for i in range(3)]
        graph(math.dist(sample['leftPoint'],sample['rightPoint']) <= 1e-9
              and math.dist(sample['leftPoint'],expected_point) <= 1e-9,'Native shared exact coefficient point association')
        graph(vector_error(sample['leftDerivative'],left['B'])[1] <= 1e-9
              and vector_error(sample['rightDerivative'],[-x for x in left['B']])[1] <= 1e-9,
              'Native common curve derivatives must oppose',derivative=True)
        point_error = max(math.dist(ap,bp),math.dist(ap,expected_point),math.dist(bp,expected_point))
        derivative_error = max(vector_error(ad,left['B'])[1],vector_error(bd,[-x for x in left['B']])[1],
                               vector_error(ad,[-x for x in bd])[1])
        graph(point_error <= 1e-7,'Actual separate shared boundary position mismatch')
        graph(derivative_error <= 1e-7,'Actual separate shared boundary derivative reversal mismatch',derivative=True)
        max_point,max_derivative = max(max_point,point_error),max(max_derivative,derivative_error)
        retained.append({'leftParameter':t,'rightParameter':s,'leftPoint':ap,'rightPoint':bp,
            'leftDerivative':ad,'rightDerivative':bd,'leftMethod':method_a,'rightMethod':method_b,
            'leftDistinctKnotInterval':asp,'rightDistinctKnotInterval':bsp,
            'pointDeviationMM':point_error,'derivativeScaledDeviation':derivative_error})
    normal_records = []
    for proof,row in zip((left,right),fixture['faces']):
        reader = configured_reader()
        require(reader.ReadFile(str(artifact(output,row['files']['iges']))) == IFSelect_RetDone and reader.TransferOneRoot(1),'Actual surface normal root missing')
        explorer = TopExp_Explorer(reader.Shape(reader.NbShapes()),TopAbs_FACE)
        adapter = BRepAdaptor_Surface(TopoDS.Face(explorer.Current()),True)
        point,du,dv = face_util['evaluate_surface'](adapter,0.37,0.61)
        cross = [du[1]*dv[2]-du[2]*dv[1],du[2]*dv[0]-du[0]*dv[2],du[0]*dv[1]-du[1]*dv[0]]
        error = vector_error(cross,proof['cross'])[1]
        graph(error <= 1e-7,'Actual du cross dv signed orientation mismatch',derivative=True)
        max_normal = max(max_normal,error)
        normal_records.append({'wrapperId':row['wrapperId'],'parameter':[0.37,0.61],
                               'du':du,'dv':dv,'cross':cross,'exactSignedCross':proof['cross'],'scaledDeviation':error})
    return {'name':fixture['name'],'descriptor':descriptor,'nativeValidation':fixture['validation'],
        'localFaceChecks':[record[0] for record in local],'localExactRectangles':[{key:value for key,value in proof.items()
            if key not in ('surface','curves','topology')} for proof in (left,right)],
        'sharedMapping':{'left':am,'right':bm,'parameterRelation':'tRight=1-tLeft','sense':'left forward / right reverse'},
        'sharedSamples':retained,'signedNormals':normal_records,'maxSharedPointDeviationMM':max_point,
        'maxSharedDerivativeScaledDeviation':max_derivative,'maxSignedNormalScaledDeviation':max_normal,
        'nativeTopologyCounts':{'faces':2,'vertices':6,'undirectedEdges':7,'uses':8,'sharedEdges':1},
        'topologyInterchange':'Two independent per-face five-object IGES Models; descriptor IDs/shared identity not serialized.',
        'sewingPerformed':False,'sharedOCCTIsSameClaim':False}


def read_unsupported(output, name, control):
    require(control['productStatus'] == 'rejected', 'Unsupported control must remain product rejected')
    paths,hashes = {},{}
    for key,relative in control['files'].items():
        paths[key] = artifact(output,relative)
        hashes[key] = digest(paths[key])
        require(hashes[key] == control['hashes'][key], 'Unsupported '+key+' artifact hash mismatch')
    require(json.loads(paths['native'].read_text()) == control['surface'], 'Unsupported native record differs')
    require(json.loads(paths['exportReport'].read_text()) == control['exportReport'], 'Unsupported actual export report differs')
    if control['bundle'] is not None:
        require(control['localValidation'] == {'incidenceValid':True,'geometricValidity':'not-certified','solid':False},
                'Unsupported native local face must remain not-certified')
    reader = configured_reader()
    require(reader.ReadFile(str(paths['iges'])) == IFSelect_RetDone, 'Actual unsupported control export could not load')
    model = reader.IGESModel()
    global_section = model.GlobalSection()
    require(global_section.UnitFlag() == 2 and global_section.Scale() == 1
            and global_section.UnitName().ToCString().strip().upper() == 'MM', 'Unsupported control original units changed')
    load = diagnostics(reader.WS().ModelCheckList(True))
    require(model.NbEntities() == reader.NbRootsForTransfer() == 5
            and model.Entity(1).TypeNumber() == 128, 'Unsupported control expected actual five roots')
    require(reader.TransferOneRoot(1), 'Unsupported actual surface root did not transfer')
    transfer = diagnostics(reader.WS().TransferReader().LastCheckList())
    explorer = TopExp_Explorer(reader.Shape(reader.NbShapes()),TopAbs_FACE)
    require(explorer.More(), 'Unsupported reader face unavailable')
    face = TopoDS.Face(explorer.Current())
    check_valid = BRepCheck_Analyzer(face,True,False,False).IsValid()
    algorithm = BRepAlgoAPI_Check()
    fuzzy = algorithm.FuzzyValue()
    algorithm.SetData(face,True,True)
    algorithm.Perform()
    results = algorithm.Result()
    require(results.Size() <= 64, 'Unsupported control diagnostic detail limit')
    statuses = [str(result.GetCheckStatus()) for result in results]
    require(algorithm.FuzzyValue() == fuzzy, 'No fuzzy adjustment is authorized')
    counts = {label:len(face_util['unique_shapes'](face,kind)) for label,kind in
              [('wires',TopAbs_WIRE),('edges',TopAbs_EDGE),('vertices',TopAbs_VERTEX)]}
    props = GProp_GProps()
    estimated = BRepGProp.SurfaceProperties_s(face,props,1e-10,False)
    return {'name':name,'productStatus':'rejected','productReason':control['reason'],
        'nativeLocalValidation':control['localValidation'],'files':control['files'],'hashes':hashes,
        'actualEntityCount':model.NbEntities(),'actualRootCount':reader.NbRootsForTransfer(),
        'loadDiagnostics':load,'transferDiagnostics':transfer,'units':'MM','modelScale':1,
        'readerSelectedFace':{'BRepCheckAnalyzer':{'geometryControls':True,'isValid':check_valid},
            'BRepAlgoAPICheck':{'SetData':{'testSmallEdges':True,'testSelfInterference':True},
                'PerformCalled':True,'isValid':algorithm.IsValid(),'hasErrors':algorithm.HasErrors(),
                'hasWarnings':algorithm.HasWarnings(),'resultCount':results.Size(),'statuses':statuses,
                'defaultFuzzyValueMM':fuzzy,'fuzzyOverride':False},
            'counts':counts,'areaMM2':props.Mass(),
            'quadrature':{'requestedRelativePrecision':1e-10,'estimatedRelativeError':estimated}},
        'interpretation':'Actual reader acceptance/rejection does not certify unsupported native geometry or override product rejection.'}


def main():
    output = Path(sys.argv[1]).resolve()
    mode = sys.argv[2] if len(sys.argv)>2 else ''
    require(mode in ('','--wrong-owner','--wrong-sense','--wrong-global-point','--wrong-curve'),'Unknown adjacency negative mode')
    manifest = json.loads((output/'manifest.json').read_text())
    require(1 <= len(manifest['fixtures']) <= 16,'Bounded adjacency fixture workload')
    fixtures = manifest['fixtures'][:1] if mode else manifest['fixtures']
    results = [read_pair(output,fixture,mode) for fixture in fixtures]
    require(not mode,'Adjacency negative mode unexpectedly returned')
    report = {'base':manifest['base'],'head':manifest['head'],
        'reader':{'cadquery-ocp':importlib.metadata.version('cadquery-ocp'),'python':sys.version,
                  'interpreter':sys.executable,'platform':platform.platform()},
        'readerDependencies':{'read-face-ocp.py':digest(FACE_READER),'read-derivatives-ocp.py':digest(DERIVATIVE_READER)},
        'fixtures':results,'unsupportedControls':{name:read_unsupported(output,name,control)
            for name,control in manifest.get('unsupportedControls',{}).items()},
        'limits':{'nativePositionMM':1e-9,'nativeDerivativeScaled':1e-9,'readerPositionMM':1e-7,
                  'readerDerivativeScaled':1e-7,'areaScaled':1e-7},
        'limitations':['Restricted exact represented rectangle family only; local face geometry remains not-certified.',
            'Separate actual reader faces only; no sewing, shared IsSame edge, closed shell, solid or STEP claim.']}
    filename = output/'adjacency-readback.json'
    filename.write_text(json.dumps(report,indent=2)+'\n')
    print(json.dumps({'report':str(filename),'sha256':digest(filename),'pairs':len(results),
        'faces':2*len(results),'sharedSamples':sum(len(r['sharedSamples']) for r in results)}))


if __name__=='__main__':
    main()
