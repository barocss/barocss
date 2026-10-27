# cad-mcp and cad-cli

The studio's tools also run outside the browser:

- **`cad-mcp`** serves them to any MCP client, such as Claude Code or Claude Desktop, on a `.bcad` file of its own.
- **`cad-cli`** runs scripts and checks from a shell.

Both use the same tool layer as the studio's chat, with the same gates and the same proposals, and the same tool
contract (see [Tools](/agent/tools)). Both work on local files only.

## cad-mcp: the tools over MCP

```bash
node apps/cad-studio/scripts/cad-mcp.mjs --doc part.bcad [--autonomy 1|2|3|4] [--libraries dir]
```

- **`--doc`** is the part the tools work on, a `.bcad` (or `.json`) file. A file that doesn't exist yet starts as an
  empty part and is written on the first change.
- **`--autonomy`** works as in the studio: the default is 2. See [Proposals and autonomy](/agent/proposals).
- **`--libraries`** is a folder of team library files (`.json`) the library tools can insert from.

In an MCP client's configuration:

```json
{ "command": "node", "args": ["<repo>/apps/cad-studio/scripts/cad-mcp.mjs", "--doc", "/absolute/path/part.bcad"] }
```

- **Talking to it.** It speaks MCP over stdio, and stdout carries only the protocol. It builds itself from the
  TypeScript sources when it starts.
- **Saving.** Each change is saved at once, and atomically: a temporary file is renamed over the part.
- **Proposals.** They are kept in the file. Open it in the studio to preview and accept them.

A session from `samples/agent-mcp.test.mjs`:

<<< @/../samples/agent-mcp.test.mjs#l2

## cad-cli: scripts and checks

```bash
node apps/cad-studio/scripts/cad-cli.mjs <command> …
```

Or `pnpm cli <command> …` from `apps/cad-studio`. Commands print JSON results; help, usage errors and some
failures are plain text. Read stdout, stderr and the exit code together. The exit codes:

| Code | Meaning |
|---|---|
| 0 | Done |
| 1 | Refused or failed: the output says why |
| 2 | A usage error |
| 3 | A hard requirement fails (`run --check`, `check`) |

### Running a script

```bash
cad-cli run <script | -> [-o part.bcad] [--doc base.bcad] [--step part.step] [--stl part.stl] [--check] [--dry-run]
```

- **What it runs.** A `model.run` script, on `base.bcad` or an empty part. `-` reads the script from stdin.
- **What it writes.** It writes what you ask for. `--stl` writes one file per body when there are several, and a
  `.source.json` record beside them.
- **Checks.** `--check` runs the part's requirements.
- **Dry runs.** `--dry-run` writes nothing.
- **Refusals.** A line the tools refuse is reported as `file:line:col`, with the refusal.

`--doc` supplies the starting document; `-o` selects the document to write. Use a different output path to keep
the input file. Outputs are written before `--check` reports a failed requirement, so exit 3 does not mean that
nothing was written. A later export or write failure can also leave earlier output files in place.

Before retrying, read the refusal and inspect the output paths. Correct the input or options, then use a fresh
output path if you need to preserve the first result. `--dry-run` checks the script without writing its outputs;
it does not prove that a later file export will succeed.

From `samples/cli.test.mjs`:

<<< @/../samples/cli.test.mjs#script

<<< @/../samples/cli.test.mjs#run

### The other commands

| Command | What it does | Exits 1 when |
|---|---|---|
| `check part.bcad` | Runs a saved part's requirements (exit 3 when a hard one fails) | It can't be read |
| `replay part.bcad` | Reads a saved part as the studio opens it, evaluates it afresh, prints its facts and requirement verdicts | It doesn't read |
| `urdf part.bcad -o folder [--name robot]` | Writes the assembly as URDF (`robot.urdf`, `meshes/*.stl`), checked against the URDF spec | Refused |
| `mjcf part.bcad -o folder [--name robot]` | Writes it as MuJoCo MJCF (`robot.xml`, `meshes/*.stl`), checked | Refused |
| `robot-check part.bcad duty.json` | Every margin of the robot against its duty: the actuators, the joints' ranges and ratings, the sweep, the model's consistency | A margin is 0 or less, or anything is unknown |
| `robot-size part.bcad duty.json -o sized.bcad` | Sizes the robot one change a round (an actuator, a rating or a slower profile) until every margin is above 0. Writes `sized.bcad` and `sized.duty.json`, and prints the trace | It stops: `BRIEF_INFEASIBLE` or `NOT_CONVERGED` |
| `stock part.bcad -o folder [--list stock.json] [--allowance mm]` | The smallest block or bar on your stock list that a part is machined from (`stock.json`, `stock.step`) | None is loaded, or none fits |
| `nest part.bcad -o folder [--list lengths.json] [--kerf mm]` | Nests a frame's cut list into your stock lengths (`nesting.json`, `nesting.csv`) | Refused, or a piece is left over |
| `mould part.bcad -o folder [--margin mm]` | A moulded part's two halves, cut at a flat parting plane (`mould.step`, `mould.json`) | It can't be built, with the code |
| `pattern part.bcad -o folder` | A sand-cast part's pattern: the machining allowance and the shrinkage from your casting rules (`pattern.step`, `pattern.json`) | It can't be made, with the code |
| `mould-quote part.bcad -o package.zip [--quantity n]` | The injection-moulding quote package: STEP, the manufacturability report and the request | Anything is still open |
| `cam-preview part.bcad -o folder [--tool mm]` | `NOT FOR PRODUCTION`: a 2.5D preview of the pockets' contours and the holes' drill points, as JSON and SVG. No G-code, feeds, speeds or collision check | Refused |
| `bundle write part.bcad -o folder [--baseline id]` | The export bundle: the document, its approved BOM baseline, materials with sources, the analysis results with their freshness, and a manifest of digests | It isn't complete |
| `bundle verify folder` | Reads a bundle back from its files alone and checks every digest and pin | It is incomplete, changed or stale |

`team` and `board` run the scripted team and candidate-board scenarios. `cad-cli help` prints the full usage.

## Using another agent

Any agent that speaks MCP can drive a part through `cad-mcp`:

- **What it reads.** It gets the same 13 tools and the same refusals. `describe` gives the detail on request.
- **What waits for you.** Changes that need your approval, or that go past its autonomy, wait in the file as
  proposals.
- **Rows.** Rows an agent wrote itself are refused, as in the chat.

The tool list it reads is the one the studio's chat reads. There is no separate, older list.

Use the `describe` tool to discover an action's arguments, a modeling command's values or a feature
kind's document fields before sending a change. This is tool discovery, not a separate `cad-cli describe`
command. After an MCP failure, read its returned error and inspect the current document before retrying:
earlier successful calls have already been saved.
