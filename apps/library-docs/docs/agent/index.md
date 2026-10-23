# Designing with the agent

The agent works on the part open in the studio, with the same commands you use. You describe what you need in the
chat panel. It builds, checks and changes the part, or proposes a change for you to accept.

## Running it

The chat panel needs the chat server. From `apps/cad-studio`:

```bash
pnpm chat
```

- **The `claude` CLI.** Each turn runs the `claude` command-line tool, signed in as you. Nothing secret reaches the
  browser.
- **The model.** The default is `claude-opus-5-5`; set `CAD_STUDIO_CHAT_MODEL` to use another. The chat panel's header
  shows the model.
- **Studio tools only.** The CLI's own tools are turned off: the agent can't run commands, read your files or browse.
- **Up to 24 steps** a message.
- **The server's address** is `127.0.0.1:52021`, or `CAD_STUDIO_CHAT_PORT`. The studio forwards `/api/chat` there.

Click **Chat** to open the panel. Its header holds:

- **Autonomy**, L1 to L4 (see [Proposals and autonomy](/agent/proposals));
- **New conversation**;
- **Close chat**.

## What it can do

- **Build and change the part:**
  - run any studio command;
  - add and edit features;
  - write a whole part as a script;
  - place parts, add mates;
  - work on the drawing;
  - edit SubD cages.

  [Tools](/agent/tools) lists every action.
- **Look at the part.** It reads:
  - a summary: the features, parameters and bodies, with faces and edges by name;
  - the detail of a face or an edge;
  - measurements, mass properties, interference, wall thickness and draft;
  - a section;
  - the manufacturability report for the part's process.

  It can render pictures of the part, and select faces, edges or bodies so you see them in the studio.
- **Keep the brief.** The brief records:
  - what the part is for, how it is made, and its material;
  - for each value, whether you stated it or the agent assumed it.

  Hard and soft requirements are checks the kernel runs against the part. A value you stated is never overwritten by
  an assumption.
- **Ask, sparingly.** The agent asks only what blocks the design, at most five questions at a time and two rounds in
  all, and assumes the rest, saying so. You answer in the studio's **Specify** panel, or skip.
- **Work from pictures and drawings.** Attach an image: PNG, JPEG, WebP or GIF, up to four a message.
  - **Traced images.** The agent can trace a picture, such as a logo or an icon, into solids.
  - **Drafts.** Features made from an image, or from a DXF drawing's text, are a **draft**. Their dimensions stay unconfirmed until you
    confirm them; confirming one at another value re-drives the features.

  An export of a draft says so.
- **Load your rows.** Attach a JSON rows file and ask the agent to load it. See [Shop rows](/studio/rows).

## What it can't do

- **Load rows it wrote itself.** They are refused with `[ROWS_NOT_FROM_PERSON]`. Rows come only from files a person
  supplies.
- **Change some things without you.** The assembly, mates, the drawing, the robot's settings and locked parts always
  wait for you as proposals.
- **Go past its autonomy.** At the default level, L2, anything beyond a value edit or the first build waits for you
  as a proposal.
- **Work outside the open part.** It sees only the document in the studio and the files you attach.

## An example turn

These shots come from a scripted run: each message names the calls to make, and a stand-in for the `claude` CLI makes
them through the real chat server and tool server. No model ran, but the gates and the results are the studio's
own.

1. "A 60 × 40 plate, 8 thick." The part is empty, so at L2 the first build applies directly. A toast says **Applied by
   the agent**, with **Undo**.

   ![The first build applied directly, with the Applied by the agent toast](/shots/agent/turn-applied.jpg)

2. "Make it 10 thick, with an 8 mm hole in the middle." That changes one feature and adds another, so at L2 the
   direct change is refused. The agent proposes it instead, as **P1**, and the part stays as it was until you accept.

   ![The refused change and the proposal in the chat](/shots/agent/proposals/refused-then-proposed.png)

The proposal's card, its preview and its choices are on [Proposals and autonomy](/agent/proposals).

## Edits while it works

You can keep editing while a turn runs. Your edits stay, and the agent's changes are merged onto them one by one. A
change that collides with one of yours waits as a proposal, with the reason.
