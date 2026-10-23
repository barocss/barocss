# Proposals and autonomy

The agent changes your part in one of two ways:

- **Directly**, as you would. The change goes in the history, and one **Undo** takes it back.
- **As a proposal**: a change worked out on a copy of the part. The part stays as it is until the proposal is
  accepted.

The **autonomy level** decides which way a change goes.

## Autonomy levels

**Autonomy**, at the top of the chat panel, sets the level for the next turn. The studio remembers it in this browser.
The default is **L2**.

| Level | The agent changes the part directly | The agent accepts its own proposals |
|---|---|---|
| **L1** · Propose only | Never: every change is a proposal | No |
| **L2** · Values (default) | Value edits only, and the first build of an empty part | No |
| **L3** | Yes | Low or medium risk ones that change no hard requirement |
| **L4** | Yes | Any that breaks no hard requirement |

At **L2**, a turn's changes apply directly in two cases:

- **The first build.** The turn starts on an empty part.
- **A value edit.** The turn edits the values of one feature, or the values of parameters, and every hard requirement
  that passed when the turn began still passes.

Anything more is refused, with the reason, and the agent proposes it instead. For example:

- adding, deleting or moving features;
- changing two features in one turn;
- changing what a feature is built on, its kind or its options;
- adding or removing parameters;
- leaving a hard requirement failing.

What counts as a value: numbers, or a value bound to a parameter. Moving a SubD cage's vertices is a value edit, but
changing its faces or creases isn't.

When a change applies directly, a toast says **Applied by the agent**, with **Undo**.

![The agent's first build of an empty part, applied directly: the toast says Applied by the agent](/shots/agent/turn-applied.jpg)

### Always yours

At any level, some changes are always proposals that only you can accept:

- the assembly: parts placed or removed;
- mates;
- the drawing;
- the robot's settings;
- a part locked to its source file.

## The proposal card

A proposal waits in the **Browser**, under **Proposals**, with a count of the open ones. Its card shows:

- **Its id and title**, for example `P1 Thicker, with a hole`. Ids are never reused.
- **Its risk**, as a badge:
  - **high** if it changes a hard requirement, breaks a reference or deletes a feature;
  - **medium** if it touches more than three features, moves one or changes parameters;
  - **low** otherwise.
- **A summary** of the change, and the agent's plan when it gave one.

The card's buttons:

- **Preview** shows the result in the viewport, with the change in volume. **Before** and **After** flip between the
  part as it is and as it would be.
- **Keep** checkboxes: when the proposal has several features, untick the ones to leave out. **Accept** then reads
  **Accept 2 of 3**, for example. A deleted feature can't be left out.
- **Accept** applies it. **Reject** keeps it, marked rejected.

**Show decided proposals** brings back the accepted and rejected ones, each with who decided it.

These shots come from a scripted run (see [the example turn](/agent/#an-example-turn)): no model ran, but the gates and
results are the studio's own.

![The agent's change, refused at L2 and proposed instead: the chat shows both calls](/shots/agent/proposals/refused-then-proposed.png)

![The proposal previewed: the hole and the thicker plate shown before it is accepted](/shots/agent/proposals/preview.jpg)

![The proposal card: its risk, summary, the features to keep, Reject and Accept](/shots/agent/proposals/card.png)

## When the part changed meanwhile

- **Stale proposals.** A proposal is made against the part as it was. If the part has changed since, the card says
  **stale**, and **Accept** becomes **Rebase & preview**. That makes the change again on the part as it is now, and
  shows it before you accept. The rebased card says **rebased**.
- **An agent accepting a rebased proposal.** At L3 and L4, an agent can't accept a rebased proposal whose risk rose or
  that changes a hard requirement. You decide.
- **Edits made during a turn.** If you edit the part while the agent is still working, your edits are kept. The
  agent's changes are merged onto them one by one. A change that collides with yours isn't applied: such changes wait
  together as one proposal, each with its reason. For example, it changes a feature you changed, or uses one you
  deleted. The rest apply.

## The design history

Each prompt, change, acceptance and rejection is kept in the part's **Design history**, in the Browser, with who made
it. It is saved with the part, chat messages included. **Save a copy without it** writes a copy to share.
