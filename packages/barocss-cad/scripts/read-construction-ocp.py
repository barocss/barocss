"""Independent installed OCCT consumer for actual packed construction exports."""
import hashlib
import importlib.metadata
import json
import math
from pathlib import Path
import platform
import sys
from OCP.IGESControl import IGESControl_Reader
from OCP.IFSelect import IFSelect_RetDone
from OCP.Interface import Interface_Static
from OCP.TopExp import TopExp_Explorer
from OCP.TopAbs import TopAbs_FACE
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Surface
from OCP.GeomAbs import GeomAbs_BSplineSurface


def diagnostics(iterator, warnings=True):
    messages = []
    iterator.Start()
    while iterator.More():
        check = iterator.Value()
        messages += [check.CFail(i) for i in range(1, check.NbFails()+1)]
        if warnings:
            messages += [check.CWarning(i) for i in range(1, check.NbWarnings()+1)]
        iterator.Next()
    return messages


def analytic(name, u, v):
    if name == 'extruded-cylinder':
        a, b, c = (1-u)**2, 2*math.sqrt(0.5)*u*(1-u), u*u
        point = [10*(a+b)/(a+b+c), 10*(b+c)/(a+b+c), 0]
        vector = [0, 0, 30]
    elif name == 'extruded-asymmetric':
        if u < 3:
            p0, p1, w0, w1, t = [1,2,3], [5,7,-1], 1, 2, (u-2)
        else:
            p0, p1, w0, w1, t = [5,7,-1], [12,3,4], 2, 0.5, (u-3)/4
        denominator = (1-t)*w0+t*w1
        point = [((1-t)*w0*p0[k]+t*w1*p1[k])/denominator for k in range(3)]
        vector = [3, -2, 7]
    elif name == 'extruded-straight':
        t = (u+2)/5
        point = [1+8*t, 2+2*t, 3+3*t]
        vector = [-1, 5, 4]
    else:
        raise AssertionError('Unsupported independent analytic fixture')
    return [point[k]+v*vector[k] for k in range(3)], vector


output = Path(sys.argv[1])
mode = sys.argv[2] if len(sys.argv) > 2 else ''
manifest = json.loads((output/'manifest.json').read_text())
results = []
for fixture in manifest['fixtures'][:1] if mode else manifest['fixtures']:
    name = fixture['name']
    filename = output / ('corrupted-pole.iges' if mode == '--corrupt-pole' else name+'.iges')
    reader = IGESControl_Reader()
    settings = {'xstep.cascade.unit':'MM', 'read.iges.bspline.continuity':0,
                'read.precision.mode':0, 'read.iges.faulty.entities':0,
                'read.surfacecurve.mode':0, 'read.iges.sequence':''}
    for key, value in settings.items():
        success = Interface_Static.SetCVal_s(key,value) if isinstance(value,str) else Interface_Static.SetIVal_s(key,value)
        assert success, 'Required consumer setting unavailable: '+key
        actual = Interface_Static.CVal_s(key) if isinstance(value,str) else Interface_Static.IVal_s(key)
        assert actual == value
    records = filename.read_text().splitlines()
    assert all(len(line) == 80 for line in records)
    directory = [line for line in records if line[72] == 'D']
    parameters = [line for line in records if line[72] == 'P']
    assert len(directory) == 2 and int(directory[0][8:16]) == 1
    assert int(directory[1][24:32]) == len(parameters)
    assert all(int(line[64:72]) == 1 for line in parameters)
    tokens = ''.join(line[:64] for line in parameters).strip().rstrip(';').split(',')
    serialized_domain = list(map(float,tokens[-4:]))
    expected_domain = fixture['domain']['u']+fixture['domain']['v']
    assert serialized_domain == expected_domain
    assert reader.ReadFile(str(filename)) == IFSelect_RetDone
    load_diagnostics = diagnostics(reader.WS().ModelCheckList(True))
    assert not load_diagnostics, load_diagnostics
    model = reader.IGESModel()
    assert model.NbEntities() == 1
    entity = model.Entity(1)
    assert entity.TypeNumber() == 128
    assert not entity.IsClosedU() and not entity.IsClosedV()
    assert not entity.IsPeriodicU() and not entity.IsPeriodicV()
    global_section = model.GlobalSection()
    assert global_section.UnitFlag() == 2 and global_section.UnitName().ToCString().strip().upper() == 'MM'
    assert global_section.Scale() == 1
    raw_domain = [entity.UMin(),entity.UMax(),entity.VMin(),entity.VMax()]
    # Retain the existing OCP128 accessor limitation instead of changing standard bytes.
    assert raw_domain == [expected_domain[0],expected_domain[2],expected_domain[1],expected_domain[3]]
    assert reader.NbRootsForTransfer() == 1 and reader.TransferOneRoot(1)
    transfer_diagnostics = diagnostics(reader.WS().TransferReader().LastCheckList())
    transfer_failures = diagnostics(reader.WS().TransferReader().LastCheckList(), warnings=False)
    assert not transfer_failures, transfer_failures
    # This degree-one curve has an intentional interior C0 knot. Keep the
    # exact warning visible; reject every failure and any other diagnostic.
    expected_diagnostics = ['Resulting Geom_Surface is C0-continuous.'] if name == 'extruded-asymmetric' else []
    assert transfer_diagnostics == expected_diagnostics, transfer_diagnostics
    assert reader.NbShapes() == 1
    shape = reader.Shape(1)
    assert shape.ShapeType() == TopAbs_FACE, 'Expected one open face, not a solid'
    explorer = TopExp_Explorer(shape,TopAbs_FACE)
    assert explorer.More()
    adapter = BRepAdaptor_Surface(TopoDS.Face(explorer.Current()),True)
    assert adapter.GetType() == GeomAbs_BSplineSurface
    transferred_domain = [adapter.FirstUParameter(),adapter.LastUParameter(),adapter.FirstVParameter(),adapter.LastVParameter()]
    assert all(abs(a-b) <= 1e-12 for a,b in zip(transferred_domain,expected_domain))
    explorer.Next()
    assert not explorer.More()
    if mode == '--corrupt-parameter':
        fixture['samples'][73]['u'] += 0.015
    max_source = max_analytic = max_own_analytic = max_affine = 0
    for sample in fixture['samples']:
        u, v = sample['u'], sample['v']
        value = adapter.Value(u,v)
        position = [value.X(),value.Y(),value.Z()]
        expected, vector = analytic(name,u,v)
        assert vector == fixture['feature']['vector']
        assert fixture['sourceVersion'] == 1 and fixture['geometryVersion'] == 0 and fixture['packetVersion'] == 0
        affine = [sample['sourceCurvePoint'][k]+v*vector[k] for k in range(3)]
        max_source = max(max_source,math.dist(position,sample['point']))
        max_analytic = max(max_analytic,math.dist(position,expected))
        max_own_analytic = max(max_own_analytic,math.dist(sample['point'],expected))
        max_affine = max(max_affine,math.dist(sample['point'],affine))
    assert max_source <= 1e-7 and max_analytic <= 1e-7 and max_own_analytic <= 1e-9 and max_affine <= 1e-9, (
        'Geometric comparison failed: source='+str(max_source)+', analytic='+str(max_analytic)+
        ', own analytic='+str(max_own_analytic)+', affine='+str(max_affine))
    results.append({'name':name,'entity':128,'roots':1,'shape':'open face','solid':False,
        'inputId':fixture['inputId'],'outputId':fixture['outputId'],'feature':fixture['feature'],
        'sourceVersion':1,'geometryVersion':0,'packetVersion':0,'samples':len(fixture['samples']),
        'serializedDomain':serialized_domain,'rawOCCTEntityDomain':raw_domain,'transferredDomain':transferred_domain,
        'consumerDomainNote':'Raw OCP128 accessor swaps U1/V0; transferred domain verified unchanged',
        'units':'MM','scale':1,'fileResolutionMM':global_section.Resolution(),
        'maxSourceDeviationMM':max_source,'maxAnalyticDeviationMM':max_analytic,
        'maxOwnAnalyticDeviationMM':max_own_analytic,'maxAffineIdentityDeviationMM':max_affine,
        'loadDiagnostics':load_diagnostics,'transferDiagnostics':transfer_diagnostics,'settings':settings,
        'healing':'Named sequence disabled; no tolerance override','sourceHash':fixture['hashes']['css'],
        'featureHash':fixture['hashes']['features.json'],'modelHash':fixture['hashes']['native.json'],
        'igesHash':hashlib.sha256(filename.read_bytes()).hexdigest()})
report = {'base':manifest['base'],'head':manifest['head'],'producer':manifest['producer'],
    'reader':{'cadquery-ocp':importlib.metadata.version('cadquery-ocp'),'python':sys.version,
        'interpreter':sys.executable,'platform':platform.platform()},
    'limits':{'exchangeMM':1e-7,'analyticMM':1e-9},'fixtures':results,
    'limitations':['Open surfaces only; not capped/closed-solid B-Rep or STEP.',
        'Selected finite-sample comparison, not universal accuracy, exact normals or GPU evidence.']}
if not mode:
    (output/'readback.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
