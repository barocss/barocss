#!/usr/bin/env python3
"""Human directives, read from GitHub issues (#160). One reader for sessions and the supervisor.

  python3 tools/ai-supervisor/directives.py            # print the directives in force (Markdown)
  python3 tools/ai-supervisor/directives.py --json     # the same, as JSON
  python3 tools/ai-supervisor/directives.py --ids      # only "#n@updated_at", for commit messages

A directive is an OPEN issue with the label from `.ai/directives.yaml` whose AUTHOR, and the last
editor of its body if any, are in that file's allowlist. The label alone isn't trusted: the repo is
public, and a body can be edited later by a collaborator, bot or integration. Any other labelled issue
is listed as ignored (stderr, and `ignored` in JSON), with the reason.

Fails closed: if GitHub can't be read, it exits 2 and prints nothing on stdout. A Strategy session
must then stop without changes (AGENTS.md §2) rather than plan or judge without its directives.
"""
import argparse, json, os, subprocess, sys

import yaml

HERE = os.path.dirname(os.path.abspath(__file__))
TOP = subprocess.run(["git", "-C", HERE, "rev-parse", "--show-toplevel"], capture_output=True,
                     text=True).stdout.strip() or "."
CONFIG = ".ai/directives.yaml"


class Unavailable(RuntimeError):
    pass


def config(top=TOP):
    with open(os.path.join(top, CONFIG)) as fh:
        c = yaml.safe_load(fh) or {}
    return {"label": c.get("label", "directive"), "authors": [str(a) for a in c.get("authors") or []]}


def split(issues, cfg):
    """Pure: raw `gh issue list` rows → (in force, ignored). Oldest first, like the old list."""
    ok, ignored = [], []
    for i in sorted(issues, key=lambda i: i["number"]):
        row = {"number": i["number"], "title": i["title"], "body": (i.get("body") or "").strip(),
               "author": (i.get("author") or {}).get("login"), "editor": (i.get("editor") or {}).get("login"),
               "updated_at": i.get("updatedAt"), "url": i.get("url")}
        if row["author"] not in cfg["authors"]:
            ignored.append(dict(row, reason=f"author {row['author']} is not allowed"))
        elif row["editor"] and row["editor"] not in cfg["authors"]:
            ignored.append(dict(row, reason=f"body last edited by {row['editor']}, who is not allowed"))
        else:
            ok.append(row)
    return ok, ignored


QUERY = """query($owner: String!, $name: String!, $label: String!) {
  repository(owner: $owner, name: $name) {
    issues(first: 100, states: OPEN, labels: [$label]) {
      nodes { number title body url updatedAt author { login } editor { login } }
    }
  }
}"""


def fetch(cfg, gh=("gh",), top=TOP):
    """GraphQL, because only it exposes `editor` (who last edited the body)."""
    r = subprocess.run([*gh, "api", "graphql", "-F", "owner={owner}", "-F", "name={repo}", "-F",
                        f"label={cfg['label']}", "-f", f"query={QUERY}"],
                       capture_output=True, text=True, cwd=top, timeout=60)
    if r.returncode:
        raise Unavailable(r.stderr.strip()[:300] or f"gh exited {r.returncode}")
    try:
        return json.loads(r.stdout)["data"]["repository"]["issues"]["nodes"]
    except (ValueError, KeyError, TypeError) as e:
        raise Unavailable(f"bad gh output: {e}")


def current(gh=("gh",), top=TOP):
    cfg = config(top)
    return split(fetch(cfg, gh, top), cfg)


def ids(rows):
    return [f"#{d['number']}@{d['updated_at']}" for d in rows]


def main(argv=None):
    ap = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    ap.add_argument("--json", action="store_true")
    ap.add_argument("--ids", action="store_true")
    a = ap.parse_args(argv)
    try:
        ok, ignored = current()
    except (Unavailable, OSError, subprocess.TimeoutExpired) as e:
        print(f"directives unavailable: {e}. Stop without changes (AGENTS.md §2).", file=sys.stderr)
        return 2
    for d in ignored:
        print(f"ignored: #{d['number']}: {d['reason']}", file=sys.stderr)
    if a.json:
        print(json.dumps({"directives": ok, "ignored": ignored}, indent=2))
    elif a.ids:
        print(" ".join(ids(ok)))
    else:
        print(f"# Human directives in force ({len(ok)})\n")
        for d in ok:
            print(f"## #{d['number']} {d['title']}  (updated {d['updated_at']})\n\n{d['body']}\n")
    return 0


if __name__ == "__main__":
    sys.exit(main())
