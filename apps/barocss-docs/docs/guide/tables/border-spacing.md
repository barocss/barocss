# border-spacing

Utilities for controlling the spacing between table borders.

Source: https://tailwindcss.com/guide/border-spacing

## Quick reference

| Class                                | Styles                                                                       |
| ------------------------------------ | ---------------------------------------------------------------------------- |
| border-spacing-&lt;number&gt;              | border-spacing: calc(var(--spacing) \* &lt;number&gt;);                            |
| border-spacing-(&lt;custom-property&gt;)   | border-spacing: var(&lt;custom-property&gt;);                                      |
| border-spacing-\[&lt;value&gt;\]           | border-spacing: &lt;value&gt;;                                                     |
| border-spacing-x-&lt;number&gt;            | border-spacing: calc(var(--spacing) \* &lt;number&gt;) var(--tw-border-spacing-y); |
| border-spacing-x-(&lt;custom-property&gt;) | border-spacing: var(&lt;custom-property&gt;) var(--tw-border-spacing-y);           |
| border-spacing-x-\[&lt;value&gt;\]         | border-spacing: &lt;value&gt; var(--tw-border-spacing-y);                          |
| border-spacing-y-&lt;number&gt;            | border-spacing: var(--tw-border-spacing-x) calc(var(--spacing) \* &lt;number&gt;); |
| border-spacing-y-(&lt;custom-property&gt;) | border-spacing: var(--tw-border-spacing-x) var(&lt;custom-property&gt;);           |
| border-spacing-y-\[&lt;value&gt;\]         | border-spacing: var(--tw-border-spacing-x) &lt;value&gt;;                          |

## Examples

### Basic example

Use `border-spacing-&lt;number&gt;` utilities like `border-spacing-2` and `border-spacing-x-3` to control the space between the borders of table cells with separate borders:

| State    | City         |
| -------- | ------------ |
| Indiana  | Indianapolis |
| Ohio     | Columbus     |
| Michigan | Detroit      |

```html
<table class="border-separate border-spacing-2 border border-gray-400 dark:border-gray-500">
  <thead>
    <tr>
      <th class="border border-gray-300 dark:border-gray-600">State</th>
      <th class="border border-gray-300 dark:border-gray-600">City</th>
    </tr>
  </thead>
  <tbody>
    <tr>
      <td class="border border-gray-300 dark:border-gray-700">Indiana</td>
      <td class="border border-gray-300 dark:border-gray-700">Indianapolis</td>
    </tr>
    <tr>
      <td class="border border-gray-300 dark:border-gray-700">Ohio</td>
      <td class="border border-gray-300 dark:border-gray-700">Columbus</td>
    </tr>
    <tr>
      <td class="border border-gray-300 dark:border-gray-700">Michigan</td>
      <td class="border border-gray-300 dark:border-gray-700">Detroit</td>
    </tr>
  </tbody>
</table>
```

### Using a custom value

Use the `border-spacing-[&lt;value&gt;]` syntax to set the border spacing based on a completely custom value:

```html
<table class="border-spacing-[7px] ...">
  <!-- ... -->
</table>
```

For CSS variables, you can also use the `border-spacing-(&lt;custom-property&gt;)` syntax:

```html
<table class="border-spacing-(--my-border-spacing) ...">
  <!-- ... -->
</table>
```

This is just a shorthand for `border-spacing-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `border-spacing` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<table class="border-spacing-2 md:border-spacing-4 ...">
  <!-- ... -->
</table>
```

Learn more about using variants in the variants documentation.

## Customizing your theme

The `border-spacing-&lt;number&gt;` utilities are driven by the `--spacing` theme variable, which can be customized in your own theme:

```css
@theme {
  --spacing: 1px;
}
```

Learn more about customizing the spacing scale in the theme variable documentation.
