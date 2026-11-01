"""Build one test CLI from local pinned OCCT headers and already installed dylibs.
No download/install/OCCT library build. Args: source-root tree.json lib-dir build-dir evidence-dir.
"""
import hashlib
import json
from pathlib import Path
import re
import shutil
import subprocess
import sys

PIN = 'b8f597c677811d1f9f4d8a97f5ae2825c0353a42'
TREE = '76543d44e49c73bfffa2d141089e6c5add106f9a'
INCLUDE = re.compile(r'^\s*#\s*include\s*[<"]([^>"]+)[>"]', re.M)


def main(root, tree_path, libraries, build, evidence):
    build.mkdir(parents=True, exist_ok=True)
    evidence.mkdir(parents=True, exist_ok=True)
    inc = build / 'include'
    inc.mkdir(exist_ok=True)
    metadata = json.loads(tree_path.read_text())
    assert metadata['sha'] == TREE and not metadata['truncated'], 'wrong/incomplete pinned tree metadata'
    blobs = {item['path']: item['sha'] for item in metadata['tree'] if item['type'] == 'blob'}
    by_name = {}
    for relative in blobs:
        if relative.startswith('src/') and Path(relative).suffix in ('.hxx', '.lxx', '.h', '.hpp', '.pxx'):
            by_name.setdefault(Path(relative).name, []).append(relative)
    verified, copied = {}, {}

    def verify(relative):
        data = (root / relative).read_bytes()
        actual = hashlib.sha1(b'blob ' + str(len(data)).encode() + b'\0' + data).hexdigest()
        assert actual == blobs[relative], 'Git blob mismatch: ' + relative
        verified[relative] = actual
        return data

    cpp = Path(__file__).with_name('step-native-reader.cxx').resolve()
    pending = INCLUDE.findall(cpp.read_text())
    while pending:
        name = Path(pending.pop()).name
        if name in copied:
            continue
        candidates = by_name.get(name, [])
        if not candidates:
            if name == 'Standard_Version.hxx':
                raise RuntimeError('Standard_Version.hxx required: generate from verified official template before build')
            continue  # System headers are resolved by the existing compiler/SDK.
        assert len(candidates) == 1, 'ambiguous official header: ' + name
        relative = candidates[0]
        data = verify(relative)
        (inc / name).write_bytes(data)
        copied[name] = relative
        pending.extend(INCLUDE.findall(data.decode('utf8')))
    compiler = shutil.which('clang++')
    assert compiler, 'existing clang++ missing'
    binary = build / 'step-native-reader'
    vtk = libraries.parents[1] / 'vtkmodules' / '.dylibs'
    link = [libraries / ('lib' + name + '.8.0.1.dylib') for name in ('TKDESTEP', 'TKXSBase', 'TKTopAlgo', 'TKBRep', 'TKGeomBase', 'TKMath', 'TKernel')]
    assert all(path.is_file() for path in link), 'required existing exact-version library missing'
    args = [compiler, '-std=c++17', '-arch', 'arm64', '-I', str(inc), '-Wl,-headerpad_max_install_names', '-MMD', '-MF', str(build / 'reader.d'), str(cpp), *map(str, link), '-Wl,-rpath,' + str(libraries), '-Wl,-rpath,' + str(vtk), '-o', str(binary)]
    (evidence / 'compile-command.json').write_text(json.dumps(args, indent=2))
    result = subprocess.run(args, text=True, capture_output=True)
    (evidence / 'compile.stdout.txt').write_text(result.stdout)
    (evidence / 'compile.stderr.txt').write_text(result.stderr)
    assert result.returncode == 0, 'native compile/link failed; see compile.stderr.txt'
    before = subprocess.check_output(['otool', '-L', str(binary)], text=True)
    (evidence / 'otool-before.txt').write_text(before)
    remaps = []
    for line in before.splitlines()[1:]:
        dependency = line.strip().split(' (', 1)[0]
        if dependency.startswith('/DLC/OCP/.dylibs/'):
            target = libraries / Path(dependency).name
            assert target.is_file(), 'exact loader target missing'
            command = ['install_name_tool', '-change', dependency, str(target), str(binary)]
            remap = subprocess.run(command, capture_output=True, text=True)
            remaps.append({'argv': command, 'exit': remap.returncode, 'stdout': remap.stdout, 'stderr': remap.stderr})
            (evidence / 'loader-remaps.json').write_text(json.dumps(remaps, indent=2))
            assert remap.returncode == 0, 'own CLI load-command remap failed; see loader-remaps.json'
    after = subprocess.check_output(['otool', '-L', str(binary)], text=True)
    (evidence / 'otool-final.txt').write_text(after)
    deps = (build / 'reader.d').read_text().replace('\\\n', ' ').split(':', 1)[1].split()
    used = [Path(path) for path in deps if Path(path).resolve().parent == inc.resolve()]
    assert used, 'compiler dependency list has no official headers'
    used_map = {copied[path.name]: verified[copied[path.name]] for path in used}
    record = {'status': 'BUILT_NOT_YET_RUNTIME_VERIFIED', 'pinnedCommit': PIN, 'pinnedTree': TREE, 'archiveDigestIsProvenanceOnly': True, 'verifiedHeaderClosure': len(verified), 'compileUsedVerifiedHeaders': len(used_map), 'compileUsedGitBlobs': used_map, 'compiler': compiler, 'compilerVersion': subprocess.check_output([compiler, '--version'], text=True), 'argv': args, 'loaderRemapsOnOwnCliOnly': remaps, 'installedDylibsModified': False, 'binary': str(binary), 'binarySha256': hashlib.sha256(binary.read_bytes()).hexdigest(), 'includeDirectory': str(inc), 'noOcctLibrariesBuilt': True}
    (evidence / 'build.json').write_text(json.dumps(record, indent=2))
    print(json.dumps({key: record[key] for key in ('status', 'binary', 'verifiedHeaderClosure', 'compileUsedVerifiedHeaders')}))


if __name__ == '__main__':
    main(*(Path(value).resolve() for value in sys.argv[1:6]))
