"""DATA-only P3 final audit. No model, World, solver, oracle, or browser calls."""
from pathlib import Path
import datetime
import hashlib
import json
import subprocess

HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[1]
BASE = '2e270d3b2d452e684ca6abe333ee761f1247c10e'


def git(*args):
    return subprocess.check_output(['git', *args], cwd=ROOT, stderr=subprocess.DEVNULL)


def sha(data):
    return hashlib.sha256(data).hexdigest()


def file_hash(path):
    digest = hashlib.sha256()
    count = 0
    with path.open('rb') as stream:
        while chunk := stream.read(65536):
            digest.update(chunk)
            count += len(chunk)
    return {'bytes': count, 'sha256': digest.hexdigest()}


def load(path):
    return json.loads(path.read_text())


def require(test, message):
    if not test:
        raise AssertionError(message)


def receipt(run_id, filename='summary.json', expected='PASS'):
    path = HERE / 'evidence' / run_id / filename
    value = load(path)
    require(value.get('status') == expected, f'{run_id}/{filename}: expected {expected}')
    return value, {'run': run_id, 'path': str(path.relative_to(ROOT)), **file_hash(path)}


def verify_frames(run_id, summary):
    path = HERE / 'evidence' / run_id / 'frames.jsonl'
    actual = file_hash(path)
    require(actual['bytes'] == summary['framesBytes'] and actual['sha256'] == summary['framesSha256'], f'{run_id}: actual frames changed')
    count = 0
    with path.open() as stream:
        for line in stream:
            row = json.loads(line)
            count += 1
            require(row['stepIndex'] == count and row['comparison']['qualified'] is True, f'{run_id}: saved sequence/gate failed')
    require(count == 1200, f'{run_id}: expected 1200 frames')
    return {'rows': count, **actual}


def tool_receipts(pattern, scope):
    receipts = []
    for directory in sorted((HERE / 'evidence').glob(pattern)):
        if not directory.is_dir():
            continue
        for name in ('result.json', 'summary.json', 'commands.json'):
            path = directory / name
            if not path.exists():
                continue
            value = load(path)
            correction_path = directory / 'invocation-correction.json'
            if correction_path.exists():
                status = 'INVALID_BUILD_INVOCATION'
            elif 'exit' in value:
                status = 'PASS' if value['exit'] == 0 and not value.get('signal') and not value.get('error') else 'FAIL'
            else:
                status = value.get('status', 'UNKNOWN')
            item = {'run': directory.name, 'receipt': str(path.relative_to(ROOT)), **file_hash(path),
                    'status': status, 'rawExit': value.get('exit'), 'scope': scope}
            if correction_path.exists():
                item['invocationCorrection'] = {'path': str(correction_path.relative_to(ROOT)),
                                                **file_hash(correction_path), 'data': load(correction_path)}
            receipts.append(item)
    return receipts


def check_graph(path, owner=None):
    data = load(path)
    inputs = data.get('inputs', [])
    require(inputs, f'empty numerical graph: {path}')
    if data.get('outfile') and data.get('sha256'):
        require(file_hash(Path(data['outfile']))['sha256'] == data['sha256'], f'numerical bundle changed: {path}')
    for item in inputs:
        name = item.get('path', '')
        require('barocss-cad/' not in name and 'barocss-viewer/' not in name and '/apps/' not in name, f'optional product in numerical root: {name}')
        actual = Path(name) if Path(name).is_absolute() else owner / name
        require(actual.is_file() and file_hash(actual)['sha256'] == item['sha256'], f'graph input changed: {name}')
        if owner:
            require(actual.resolve().is_relative_to(owner.resolve()), f'graph escaped provider: {name}')
    return {'path': str(path.relative_to(ROOT)), **file_hash(path), 'inputs': len(inputs), 'cadViewerInputs': 0}


def audit():
    require(git('rev-parse', BASE).decode().strip() == BASE, 'P3 base missing')
    explicit = [
        'packages/barocss-physics/design/p0/', 'examples/physics-world-p0-2276/',
        'examples/physics-world-p1a-2276/', 'examples/physics-world-p1b-2276/',
        'examples/physics-world-p2-2276/', 'examples/physics-motion-nogo-2276/',
        'examples/physics-motion-foundations-2276/', 'examples/physics-contact-boundary-2276/',
        'examples/physics-contact-solver-2276/', 'examples/physics-stack-solver-2276/',
    ]
    top = git('ls-tree', '-d', '--name-only', BASE + ':examples').decode().splitlines()
    references = ['examples/' + name + '/' for name in top if name.startswith('physics-') and 'reference' in name]
    protected = sorted(set(explicit + references))
    changed = git('diff', BASE, '--name-only', '--', *protected).decode().splitlines()
    require(not changed, 'protected tracked historical bytes changed: ' + repr(changed))
    new = git('ls-files', '--others', '--exclude-standard', '--', *protected).decode().splitlines()
    require(not new, 'new nonignored historical file: ' + repr(new))
    history = []
    for line in git('ls-tree', '-r', '--full-tree', BASE, '--', *protected).decode().splitlines():
        fields, path = line.split('\t', 1)
        mode, kind, blob = fields.split()
        history.append({'path': path, 'mode': mode, 'type': kind, 'gitBlob': blob})
    history_digest = sha(json.dumps(history, sort_keys=True, separators=(',', ':')).encode())

    build, build_receipt = receipt('candidate-build-01', 'build.json')
    stage = Path(build['physics'])
    current = ROOT / 'packages/barocss-physics'
    staged = build['sourceHashes']
    current_paths = sorted(p for p in (current / 'src').rglob('*') if p.is_file())
    current_hashes = {str(path.relative_to(current)): file_hash(path)['sha256'] for path in current_paths}
    require(set(current_hashes) == set(staged), 'current/candidate source inventory differs')
    source_transfer = load(HERE / 'source-transfer.json')
    require(source_transfer['status'] == 'PASS' and source_transfer['physicalCalculationBytesUnchanged'] is True, 'exact source transfer receipt failed')
    guard = 'src/disjoint-hinge/admission.ts'
    generated = 'src/provider-manifest.generated.ts'
    hardening = HERE / 'admission-hardening/src/disjoint-hinge/admission.ts'
    require(current_hashes[guard] == file_hash(hardening)['sha256'], 'current guard is not reviewed hardening')
    source_comparison = []
    for path, expected in sorted(staged.items()):
        require(file_hash(stage / path)['sha256'] == expected, 'original staged source changed: ' + path)
        allowed = path in (guard, generated)
        require(allowed or current_hashes[path] == expected, 'physical/non-generated candidate source changed: ' + path)
        source_comparison.append({'path': path, 'candidateSha256': expected, 'currentSha256': current_hashes[path], 'equal': current_hashes[path] == expected,
                                  'boundary': 'reviewed raw-quaternion guard' if path == guard else 'generated provider identity' if path == generated else 'exact candidate bytes'})
    require(len(source_transfer['files']) == len(staged) - 1, 'transfer proof population differs')
    for item in source_transfer['files']:
        require(current_hashes['src/' + item['path']] == item['currentSha256'], 'per-file source-transfer proof changed')
    base_source = git('ls-tree', '-r', '--name-only', BASE, '--', 'packages/barocss-physics/src/').decode().splitlines()

    graphs = []
    for name in ('source-observed.graph.json', 'source-plain.graph.json', 'emitted-native.graph.json'):
        graphs.append(check_graph(HERE / 'evidence/candidate-build-01' / name, stage))
    adopted_build, adopted_build_receipt = receipt('adoption-build-01', 'adoption-providers.json')
    for graph in adopted_build['graphs'].values():
        require(file_hash(Path(graph['entry']))['sha256'] == graph['sha256'], 'actual-current entry changed')
        for item in graph['inputs']:
            actual = Path(item['path'])
            require(actual.resolve().is_relative_to(current.resolve()), 'actual current numerical input escaped package')
            require('barocss-cad/' not in item['path'] and file_hash(actual)['sha256'] == item['sha256'], 'actual-current graph changed/CAD import')
    require(adopted_build['graphs']['native']['entry'] == str(current / 'dist/index.js'), 'current native entry is not actual dist/index.js')
    for path, expected in adopted_build['emittedFiles'].items():
        require(file_hash(current / path)['sha256'] == expected, 'current emitted artifact/declaration changed')

    main = []
    for run_id, graph_name in [('source-trial-01', 'sourceObserved'), ('repeat-trial-01', 'sourceRepeat'), ('emitted-trial-01', 'emittedNative')]:
        data, auth = receipt(run_id)
        require(data['graph'] == graph_name and all(data['counts'][key] == 1200 for key in ('attempts', 'accepted', 'qualified')) and data['counts']['references'] == 0, 'main qualification counts differ')
        main.append({**auth, 'graph': graph_name, 'counts': data['counts'], 'actualFrames': verify_frames(run_id, data),
                     'phasesObserved': graph_name == 'sourceObserved', 'runtime': {'node': data['node'], 'platform': data['platform'], 'arch': data['arch']}})
    controls, controls_receipt = receipt('controls-01')
    require(controls['counts']['constructors'] == 47 and controls['counts']['attempts'] == 4180 and controls['counts']['accepted'] == 4128 and controls['counts']['refused'] == 52, 'qualification global counts differ')
    require(controls['counts']['queries'] == 18 and controls['counts']['explicitDisposals'] == 4 and controls['counts']['internalCapCases'] == 12 and controls['counts']['internalCapLeafCalls'] == 14, 'control population differs')
    recorder, recorder_receipt = receipt('recorder-01')
    rc = recorder['counts']
    require(rc['explicitConstructors'] + rc['successfulRestoreConstructorsSourceBound'] == 4 and rc['explicitAcceptedSteps'] + rc['successfulRestoreStepsSourceBound'] == 20 and rc['refusedWorldSteps'] == 6 and rc['successfulRestoreStepsSourceBound'] == 8, 'separate recorder counts differ')
    adoption, adoption_receipt = receipt('adoption-01')
    require(adoption['counts']['constructors'] == 14 and adoption['counts']['attempts'] == 6 and adoption['counts']['accepted'] == 6 and adoption['counts']['qualified'] == 4 and adoption['counts']['cleanupCompleted'] == 4, 'separate actual API adoption counts differ')
    measured, measured_receipt = receipt('main-data-audit-01')
    bank, bank_receipt = receipt('bank-auth-04')
    require(bank['rows'] == 1200 and bank['provenance']['fullDecodedAuthentication'] == 'PASS', 'full original bank authentication incomplete')
    preserved = []
    for run_id in ('bank-auth-01', 'bank-auth-02', 'bank-auth-03'):
        failure, auth = receipt(run_id, expected='FAIL')
        require(failure['modelsRun'] == 0 and failure['referencesRun'] == 0 and failure['firstFailure'], 'first DATA harness failure missing')
        preserved.append({**auth, 'rows': failure['rows'], 'firstFailure': failure['firstFailure'], 'classification': 'DATA harness failure; no World/reference calls'})

    docs = tool_receipts('*docs*', 'Documentation receipt only; new P3 sample has one constructor/two steps; never a new full trajectory')
    lint = tool_receipts('lint-*', 'Changed source/harness lint only; no numerical or documentation build claim')
    required_docs = ['docs-samples-01', 'docs-check-01', 'docs-build-03', 'docs-links-02', 'docs-p3-assets-01']
    docs_by_run = {item['run']: item['status'] for item in docs}
    current_docs = {run: docs_by_run.get(run, 'NOT_RUN') for run in required_docs}
    docs_status = 'PASS' if all(value == 'PASS' for value in current_docs.values()) else 'FAIL' if any(value in ('FAIL', 'INVALID_BUILD_INVOCATION') for value in current_docs.values()) else 'NOT_RUN_REQUIRED_DOCS'
    owned = []
    for path in sorted(HERE.rglob('*')):
        if not path.is_file() or 'evidence' in path.relative_to(HERE).parts or path.name in ('results.json', 'final-manifest.json'):
            continue
        owned.append({'path': str(path.relative_to(ROOT)), **file_hash(path)})
    return {
        'workId': 'physics-world-p3-2276', 'kind': 'P3_DATA_ONLY_FINAL_AUDIT', 'status': 'PASS',
        'base': BASE, 'headAtAudit': git('rev-parse', 'HEAD').decode().strip(), 'branch': git('branch', '--show-current').decode().strip(),
        'generatedAtUtc': datetime.datetime.now(datetime.timezone.utc).isoformat(),
        'auditCalls': {'World': 0, 'projection': 0, 'oracle': 0, 'trig': 0, 'browser': 0},
        'historicalPreservation': {'status': 'PASS', 'protectedPrefixes': protected, 'trackedFilesUnchanged': len(history),
                                   'baseModeTypeBlobInventorySha256': history_digest, 'referenceDirectories': len(references),
                                   'nonignoredNewProtectedFiles': 0, 'verification': 'git diff against immutable base plus base mode/type/blob inventory; ignored untracked historical files not assessed'},
        'exactSourceTransfer': {'status': 'PASS', 'baseSourceEntries': len(base_source), 'currentSourceEntries': len(staged),
                                'nonGeneratedTransferEntries': len(source_transfer['files']),
                                'sourceTransferReceipt': file_hash(HERE / 'source-transfer.json'), 'files': source_comparison,
                                'physicalKernelChangesAfterStagedQualification': 0, 'exceptions': [guard, generated]},
        'rootGraphs': {'noCadViewer': True, 'stagedGraphReceipts': graphs, 'stagedBuild': build_receipt,
                       'currentAdoptionBuild': adopted_build_receipt, 'actualCurrentNativeEntry': str(current / 'dist/index.js'),
                       'providerIdentityBoundary': 'source/emitted provider digests may differ; exact physical output parity is separate'},
        'mainQualification': {'status': 'PASS', 'graphs': main, 'authority': 'original f401 saved independent certificates after full exact correspondence',
                              'newColdReferenceCalls': 0, 'scope': 'original candidate-build-01 hashes; hardened current source has a separate two-step/API gate, not a fresh1200 run'},
        'qualificationControls': {**controls_receipt, 'counts': controls['counts'], 'includesBaselinesAndMain': True},
        'separateRecorderIntegration': {**recorder_receipt, 'counts': rc, 'totalConstructors': 4, 'WorldStepEntries': 26, 'acceptedPhysicalSteps': 20,
                                       'refusedWorldSteps': 6, 'countBoundary': 'eight restore steps and two restore constructors are source-bound, not newly observed native internal calls'},
        'separateCurrentAdoption': {**adoption_receipt, 'counts': adoption['counts'], 'newHardened1200TrajectoryClaim': False},
        'separateDocsSample': {'status': docs_status, 'requiredCurrentRuns': current_docs,
                              'newP3SampleBudget': {'constructors': 1, 'acceptedSteps': 2}, 'receipts': docs,
                              'historicalFailureBoundary': 'All original failed/invalid invocation receipts remain listed; later corrected runs do not relabel them.'},
        'lintReceipts': lint,
        'actualMeasuredSource': {'receipt': measured_receipt, 'quality': measured['actualMeasuredQuality'], 'reports': measured['actualObservedReports'],
                                 'step77ActualOperands': measured['step77ActualOperands'], 'wholeGraphEquality': measured['wholeGraphEquality'],
                                 'scope': 'actual observed SOURCE measurements only; uninstrumented repeat/native internals not observed'},
        'bankAuthentication': bank_receipt, 'firstDataFailuresPreserved': preserved,
        'ownedNonEvidenceFiles': owned,
        'proofLimits': ['No combined count or accuracy badge across separately budgeted gates.',
                        'Historical7178434 step77 failure remains NO_GO; original actual operands remain unobserved.',
                        'No convergence-order, cross-runtime, equipment, connected-mechanism, full-stack, Viewer or whole-engine acceptance.',
                        'Original HOLDs and P4/P5/P6/P7 roadmap dependencies remain separate.'],
        'remoteOperationsInThisAudit': 'NOT_RUN',
    }


if __name__ == '__main__':
    result = audit()
    (HERE / 'results.json').write_text(json.dumps(result, indent=2) + '\n')
    print(json.dumps({'status': result['status'], 'historicalFilesUnchanged': result['historicalPreservation']['trackedFilesUnchanged'],
                      'sourceEntries': result['exactSourceTransfer']['currentSourceEntries'], 'ownedFilesHashed': len(result['ownedNonEvidenceFiles']),
                      'qualification': result['qualificationControls']['counts'], 'docs': result['separateDocsSample']['status'], 'numericalCalls': 0}))
