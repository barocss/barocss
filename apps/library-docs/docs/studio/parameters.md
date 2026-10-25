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

Parameter values are finite numbers. The panel does not evaluate a formula typed into a value field. Script
expressions and library recipe expressions are separate features; a direct parameter binding stores a reference
to one named value. The object facade's `param(name)` also names one parameter, not an expression.

Invalid names, duplicate names and non-finite values are refused. A binding can also be refused when the selected
field cannot store one parameter reference directly, such as a field that writes to several places or converts
a diameter to a stored radius. Choose a field offered by the **ƒ** list instead.

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

Applying a configuration changes the current numeric parameters; it does not create new parameters from names
that have since been removed. It does not change feature suppression or replace assembly components.

Feature suppression is a separate history setting: it disables a feature without deleting its definition.
Assembly variants are separate again. Their declared inputs can drive part parameters, feature suppression,
component choices or mate values in a derived document. Applying a saved parameter configuration is not the same
operation as selecting an assembly variant. See [Assemblies](/studio/assemblies).

## What a parameter drives

- **The model.** Any bound value: a dimension, a hole's diameter, a chamfer's distance.
- **The drawing.** It updates with the model. A revision whose model has changed says **Revision out of date**. See
  [Drawings](/studio/drawings).
- **Exports.** Parameters are part of the document's revision, so exports made with other values name another source
  revision. See [Revisions and sources](/guide/concepts#revisions-and-sources).
- **The kernel's own parameters.** A part document's dimensions can be `{ "parameter": "name" }` in code too. See the
  [Modeling API](/packages/cad/modeling).
