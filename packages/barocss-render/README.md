# `@barocss/render` private prototype

This workspace package is a local React renderer experiment. Its `private: true` manifest and source export are intentional. There is no publish build, Changeset, npm release, or stable API commitment.

## Proposed API

```jsx
import { Renderer, validateSpec } from '@barocss/render';

const result = validateSpec(json);
if (!result.ok) showErrors(result.errors); // [{ path: 'elements.card.props.padding', message: '...' }]
else <Renderer spec={json} components={appComponents} state={formState}
  setState={setFormState} actions={{ save: saveLocally }} />;
```

The application registers React components and named actions. A node ID becomes a stable React key. The application owns form state, so a JSON edit that adds an unrelated node keeps the input value and focus. `Renderer` validates again and rejects invalid data before constructing elements. It never evaluates scripts or HTML from JSON. The closed contract supports Layout, Card, Text, Input and Button, one `/name` binding, and a `save` action. Styling is selected from reviewed names and mapped to BaroCSS utility classes; the host starts and preloads the BaroCSS browser runtime.

This implementation is deliberately screen-specific. It does not prove that a general renderer package is needed. See the [comparison and decision](../../scripts/barocss-render-prototype/README.md).
