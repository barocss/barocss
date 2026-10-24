# Parameters and configurations

A parameter is a named size the part depends on, such as `C = 3`. A feature's value can be bound to it, so changing
the parameter changes every feature that uses it. A configuration is a saved set of parameter values, applied in one
step.

## Named sizes

Open **Parameters** in the top bar:

- **Add one.** Give a name and a value, then **Add**. A name starts with a letter or `_`, and is at most 32 letters,
  digits or `_`.
- **Change one.** Edit its value. The part is evaluated again with it.
- **Rename one.** Change its name, and it is renamed everywhere it is used.
- **Delete one.** Each feature that used it keeps its value as a plain number.
- **Where it's used.** Each parameter shows how many features use it, as `1×`.

![The Parameters panel in the dock: the parameter C used once, and the configurations small and large](/shots/studio/parameters/panel.jpg)

## Binding a value

Bind a feature's value in its editor: click the feature in the history or the **Browser**, then pick a parameter from the **ƒ** list next
to the value, and **Apply**.

- While bound, the value follows the parameter and can't be typed.
- Pick **ƒ** again to unbind it. The value stays as it is.

![A chamfer's Distance bound to the parameter C in the feature editor](/shots/studio/parameters/bind.png)

The agent can change parameter values too. At the default autonomy, a change to parameter values applies directly
when every hard requirement still passes. Adding or removing a parameter is a proposal. See
[Proposals and autonomy](/agent/proposals).

## Configurations

Under **Configurations**:

- **Save these values as…** names the current values, and **Save** keeps them as a configuration.
- **Apply** a configuration to set all its values in one step. The panel marks the one the values match now.
- A configuration can be deleted. Its values stay as they are.

## What a parameter drives

- **The model.** Any bound value: a dimension, a hole's diameter, a chamfer's distance.
- **The drawing.** It updates with the model. A revision whose model has changed says **Revision out of date**. See
  [Drawings](/studio/drawings).
- **Exports.** Parameters are part of the document's revision, so exports made with other values name another source
  revision. See [Revisions and sources](/guide/concepts#revisions-and-sources).
- **The kernel's own parameters.** A part document's dimensions can be `{ "parameter": "name" }` in code too. See the
  [Modeling API](/packages/cad/modeling).
