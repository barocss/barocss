import os, re, sys, glob, subprocess, collections

R = "packages/barocss-cad/src"
files = set(glob.glob(R + "/**/*.ts", recursive=True))
IMP = re.compile(r"""(?:import|export)\s[^'";]*?from\s*['"](\.[^'"]+)['"]|import\s*['"](\.[^'"]+)['"]""", re.S)

def res(base, spec):
    p = os.path.normpath(os.path.join(os.path.dirname(base), spec))
    for c in [p, p + ".ts", re.sub(r"\.js$", ".ts", p), p + "/index.ts"]:
        if os.path.isfile(c) and c.endswith(".ts"):
            return c

dep = {f: {res(f, a or b) for a, b in IMP.findall(open(f).read())} - {None} for f in files}

def reach(roots):
    seen, st = set(), list(roots)
    while st:
        x = st.pop()
        if x in seen:
            continue
        seen.add(x)
        st += dep.get(x, ())
    return seen

# Names other packages import from the kernel root, split into product code and tests/examples.
out = subprocess.run("git ls-files -- packages apps examples ':!packages/barocss-cad'", shell=True, capture_output=True, text=True).stdout.split()
prod, anyuse = set(), set()
ROOT = re.compile(r"import\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['\"]@barocss/cad['\"]", re.S)
for fp in out:
    if not re.search(r"\.(ts|tsx|mjs|js)$", fp):
        continue
    try:
        s = open(fp).read()
    except Exception:
        continue
    is_test = bool(re.search(r"(^|/)(test|tests|examples?)/|\.test\.", fp))
    for m in ROOT.finditer(s):
        for n in m.group(1).split(","):
            n = n.strip().replace("type ", "").split(" as ")[0].strip()
            if n:
                anyuse.add(n)
                if not is_test:
                    prod.add(n)

idx_path = R + "/index.ts"
idx = open(idx_path).read()
def files_for(names):
    hit = set()
    for m in re.finditer(r"export\s*(?:type\s*)?\{([^}]*)\}\s*from\s*['\"](\.[^'\"]+)['\"]", idx, re.S):
        ns = {n.strip().replace("type ", "").split(" as ")[-1].strip() for n in m.group(1).split(",")}
        if ns & names:
            hit.add(res(idx_path, m.group(2)))
    for m in re.finditer(r"export\s*\*\s*from\s*['\"](\.[^'\"]+)['\"]", idx):
        hit.add(res(idx_path, m.group(1)))
    return hit - {None}

live = reach([R + "/part/part-model.ts", R + "/api/index.ts", R + "/internal/native-si-mass.ts"] + glob.glob(R + "/io/*.ts"))
product = reach(files_for(prod)) | live
anyreach = reach(files_for(anyuse)) | live
others = files - {idx_path}
loc = lambda fs: sum(sum(1 for _ in open(f)) for f in fs)
print("kernel .ts files", len(files), "lines", loc(files))
print("names imported from @barocss/cad: product", len(prod), "any (incl tests/examples)", len(anyuse))
print("A live engine (part-model, api, io, internal):", len(live), "files", loc(live), "lines")
print("B A + what product code imports via index.ts:", len(product), "files", loc(product), "lines")
print("C B + what only tests/examples import:", len(anyreach), "files")
dead = others - anyreach
only_tests = anyreach - product
print("D used by nothing outside the kernel:", len(dead), "files", loc(dead), "lines")
print("E used only by tests/examples:", len(only_tests), "files", loc(only_tests), "lines")
folder = lambda f: f[len(R) + 1:].split("/")[0] if "/" in f[len(R) + 1:] else "(root)"
print("D by folder:", collections.Counter(map(folder, dead)).most_common(12))
print("E by folder:", collections.Counter(map(folder, only_tests)).most_common(12))
print("D largest:", sorted(((loc([f]), f[len(R) + 1:]) for f in dead), reverse=True)[:8])
print("\n".join(sorted(f[len(R) + 1:] for f in dead)))
