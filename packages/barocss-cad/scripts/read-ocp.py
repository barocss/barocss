"""Independent test-only OCCT consumer. Never imported by the product package."""
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
from OCP.TopAbs import TopAbs_EDGE, TopAbs_FACE
from OCP.TopoDS import TopoDS
from OCP.BRepAdaptor import BRepAdaptor_Curve, BRepAdaptor_Surface
from OCP.GeomAbs import GeomAbs_BSplineCurve, GeomAbs_BSplineSurface


def checks(iterator):
    result = []
    iterator.Start()
    while iterator.More():
        check = iterator.Value()
        result.extend([check.CFail(i) for i in range(1, check.NbFails()+1)])
        result.extend([check.CWarning(i) for i in range(1, check.NbWarnings()+1)])
        iterator.Next()
    return result


def analytic(name, u, v=None):
    if name in ('quarter-circle', 'quarter-cylinder'):
        w = math.sqrt(0.5)
        d = (1-u)**2 + 2*w*u*(1-u) + u*u
        return [10*((1-u)**2 + 2*w*u*(1-u))/d,
                10*(u*u + 2*w*u*(1-u))/d, 0 if v is None else 30*v]
    a, b = (u-2)/3, (v+1)/4
    poles = [[[0,0,0],[0,8,2]],[[12,0,4],[15,9,7]]]
    return [sum(poles[i][j][k] * ([1-a,a][i]) * ([1-b,b][j])
                for i in range(2) for j in range(2)) for k in range(3)]


def point(value):
    return [value.X(),value.Y(),value.Z()]


def distance(a, b):
    return math.dist(a,b)


def close(a,b):
    assert abs(a-b) <= 1e-12, (a,b)


output = Path(sys.argv[1])
manifest = json.loads((output/'manifest.json').read_text())
corrupt = '--corrupt' in sys.argv
results = []
for fixture in manifest['fixtures'][:1] if corrupt else manifest['fixtures']:
    reader = IGESControl_Reader()
    # Explicit translation settings. Disable the named healing sequence; do not
    # alter tolerances or repair bad geometry to satisfy the comparison.
    settings = {'xstep.cascade.unit':'MM', 'read.iges.bspline.continuity':0,
                'read.precision.mode':0,
                'read.iges.faulty.entities':0, 'read.surfacecurve.mode':0,
                'read.iges.sequence':''}
    for key, value in settings.items():
        success = Interface_Static.SetCVal_s(key,value) if isinstance(value,str) else Interface_Static.SetIVal_s(key,value)
        assert success, f'Consumer setting unavailable: {key}'
        actual = Interface_Static.CVal_s(key) if isinstance(value,str) else Interface_Static.IVal_s(key)
        assert actual == value, (key,actual,value)
    filename = output / ('corrupted.iges' if corrupt else fixture['name']+'.iges')
    records = filename.read_text().splitlines()
    assert all(len(line) == 80 for line in records), 'Invalid fixed-width record'
    directory = [line for line in records if line[72] == 'D']
    parameters = [line for line in records if line[72] == 'P']
    pointer = int(directory[0][8:16])
    count = int(directory[1][24:32])
    assert pointer == 1 and count == len(parameters), 'Invalid Parameter Data pointer/count'
    assert all(int(line[64:72]) == 1 for line in parameters), 'Invalid Directory Entry pointer'
    # Retain the serialized domain independently of OCCT's 128 metadata accessor.
    tokens = ''.join(line[:64] for line in parameters).strip().rstrip(';').split(',')
    serialized_domain = list(map(float,tokens[-(5 if fixture['kind']=='curve' else 4):]))
    if fixture['kind']=='curve': serialized_domain = serialized_domain[:2]
    expected_domain = fixture['domain'] if fixture['kind']=='curve' else fixture['domain']['u']+fixture['domain']['v']
    for actual,expected in zip(serialized_domain,expected_domain): close(actual,expected)
    assert reader.ReadFile(str(filename)) == IFSelect_RetDone, 'IGES load failed'
    diagnostics = checks(reader.WS().ModelCheckList(True))
    assert not diagnostics, f'Load diagnostics: {diagnostics}'
    model = reader.IGESModel()
    assert model.NbEntities() == 1, 'Unexpected IGES entity count'
    entity = model.Entity(1)
    assert entity.TypeNumber() == fixture['entity'], 'Unexpected entity kind'
    global_section = model.GlobalSection()
    assert global_section.UnitFlag() == 2
    assert global_section.UnitName().ToCString().strip().upper() == 'MM'
    close(global_section.Scale(),1)
    raw_domain = [entity.UMin(),entity.UMax()]
    if fixture['kind'] == 'curve':
        close(entity.UMin(),fixture['domain'][0]); close(entity.UMax(),fixture['domain'][1])
    else:
        raw_domain = [entity.UMin(),entity.UMax(),entity.VMin(),entity.VMax()]
        # OCCT ReadOwnParams reads the standard U0,U1,V0,V1 sequence as
        # U0,V0,U1,V1 (also visible in OCCT V7_9_0 source). Retain this
        # consumer discrepancy. Verify the actual transferred domain below.
        assert raw_domain == [expected_domain[0],expected_domain[2],expected_domain[1],expected_domain[3]], raw_domain
    assert reader.NbRootsForTransfer() == 1
    assert reader.TransferOneRoot(1)
    transfer_diagnostics = checks(reader.WS().TransferReader().LastCheckList())
    assert not transfer_diagnostics, f'Transfer diagnostics: {transfer_diagnostics}'
    assert reader.NbShapes() == 1
    shape = reader.Shape(1)
    explorer = TopExp_Explorer(shape,TopAbs_EDGE if fixture['kind']=='curve' else TopAbs_FACE)
    assert explorer.More(), 'Expected edge/face missing'
    if fixture['kind']=='curve':
        adapter=BRepAdaptor_Curve(TopoDS.Edge(explorer.Current()))
        assert adapter.GetType() == GeomAbs_BSplineCurve
        transferred_domain = [adapter.FirstParameter(),adapter.LastParameter()]
        for actual,expected in zip(transferred_domain,expected_domain):close(actual,expected)
    else:
        adapter=BRepAdaptor_Surface(TopoDS.Face(explorer.Current()),True)
        assert adapter.GetType() == GeomAbs_BSplineSurface
        transferred_domain = [adapter.FirstUParameter(),adapter.LastUParameter(),adapter.FirstVParameter(),adapter.LastVParameter()]
        for actual,expected in zip(transferred_domain,expected_domain):close(actual,expected)
    explorer.Next(); assert not explorer.More(), 'Unexpected extra edge/face'
    maximum_source = maximum_analytic = maximum_own_analytic = 0
    for sample in fixture['samples']:
        u, v = sample['u'], sample.get('v')
        position = point(adapter.Value(u) if v is None else adapter.Value(u,v))
        expected = analytic(fixture['name'],u,v)
        maximum_source=max(maximum_source,distance(position,sample['point']))
        maximum_analytic=max(maximum_analytic,distance(position,expected))
        maximum_own_analytic=max(maximum_own_analytic,distance(sample['point'],expected))
    assert maximum_source <= 1e-7 and maximum_analytic <= 1e-7, f'Geometric deviation: source={maximum_source}, analytic={maximum_analytic}'
    assert maximum_own_analytic <= 1e-9
    results.append({'name':fixture['name'],'entity':entity.TypeNumber(),'roots':1,'units':'MM','scale':global_section.Scale(),'samples':len(fixture['samples']),'domain':fixture['domain'],'transferredDomain':transferred_domain,'fileResolutionMM':global_section.Resolution(),'serializedDomain':serialized_domain,'rawOCCTEntityDomain':raw_domain,'consumerDomainNote':('OCCT 128 metadata accessor swaps U1/V0; transferred knot domain verified unchanged' if fixture['kind']=='surface' else 'No discrepancy'),'maxSourceDeviationMM':maximum_source,'maxAnalyticDeviationMM':maximum_analytic,'maxOwnAnalyticDeviationMM':maximum_own_analytic,'loadDiagnostics':diagnostics,'transferDiagnostics':transfer_diagnostics,'settings':settings,'healing':'Named shape-processing sequence disabled; no tolerance override','sourceHash':fixture['sourceHash'],'igesHash':hashlib.sha256(filename.read_bytes()).hexdigest()})
report={'reader':{'cadquery-ocp':importlib.metadata.version('cadquery-ocp'),'python':sys.version,'platform':platform.platform(),'interpreter':sys.executable},'fixtures':results,'limits':{'exchangeMM':1e-7,'analyticMM':1e-9},'head':manifest['head'],'base':manifest['base']}
if not corrupt: (output/'readback.json').write_text(json.dumps(report,indent=2)+'\n')
print(json.dumps(report,indent=2))
