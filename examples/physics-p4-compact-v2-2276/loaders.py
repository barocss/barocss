"""Authenticate sources before loading definitions. No old geometry import."""
import ast
import copy
import hashlib
import importlib.util
import math
from pathlib import Path
import sys


def authenticate(root, manifest):
    for relative, expected in manifest['pins'].items():
        path = root / relative
        if path.stat().st_size != expected['bytes']:
            raise ValueError('DEPENDENCY_BYTE_DRIFT:' + relative)
        if hashlib.sha256(path.read_bytes()).hexdigest() != expected['sha256']:
            raise ValueError('DEPENDENCY_SHA_DRIFT:' + relative)


def load_module(path, name):
    spec = importlib.util.spec_from_file_location(name, path)
    module = importlib.util.module_from_spec(spec)
    sys.modules[spec.name] = module
    spec.loader.exec_module(module)
    return module


def scalar_closure(root, manifest):
    path = root / manifest['scalarPath']
    source = path.read_text()
    tree = ast.parse(source, filename=str(path))
    selected = []
    observed = {}
    for node in tree.body:
        name = getattr(node, 'name', None)
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
        if name not in manifest['scalarSpans']:
            continue
        segment = ast.get_source_segment(source, node).encode()
        pin = manifest['scalarSpans'][name]
        if len(segment) != pin['bytes'] or hashlib.sha256(segment).hexdigest() != pin['sha256']:
            raise ValueError('SCALAR_SOURCE_SPAN_DRIFT:' + name)
        if isinstance(node, ast.FunctionDef):
            if node.decorator_list or node.args.defaults or any(v is not None for v in node.args.kw_defaults):
                raise ValueError('UNSAFE_FUNCTION_DEFINITION')
        elif isinstance(node, ast.ClassDef):
            if name != 'ProtocolError' or node.decorator_list or len(node.body) != 1 or not isinstance(node.body[0], ast.Pass):
                raise ValueError('UNSAFE_CLASS_DEFINITION')
        elif isinstance(node, ast.Assign):
            ast.literal_eval(node.value)
        else:
            raise ValueError('UNSAFE_SELECTED_AST')
        selected.append(node)
        observed[name] = pin['sha256']
    if set(observed) != set(manifest['scalarSpans']):
        raise ValueError('SCALAR_CLOSURE_INCOMPLETE')
    namespace = dict(__name__='authenticated_scalar_v2', math=math, copy=copy)
    # Only definitions/literal assignments execute. No old imports/loaders/main.
    code = compile(ast.Module(body=selected, type_ignores=[]), str(path), 'exec')
    exec(code, namespace)
    return namespace['fresh_query'], dict(sourceSpans=observed, oldModuleImports=0,
                                          oldTopLevelGeometryCalls=0, oldSatCalls=0, oldQpCalls=0)
