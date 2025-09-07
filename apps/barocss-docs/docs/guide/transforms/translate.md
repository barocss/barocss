# translate

Utilities for translating elements.



## Quick reference

| Class | Styles |
|---|---|
| translate-&lt;number&gt; | translate: calc(var(--spacing) * &lt;number&gt;) calc(var(--spacing) * &lt;number&gt;); |
| -translate-&lt;number&gt; | translate: calc(var(--spacing) * -&lt;number&gt;) calc(var(--spacing) * -&lt;number&gt;); |
| translate-&lt;fraction&gt; | translate: calc(&lt;fraction&gt; * 100%) calc(&lt;fraction&gt; * 100%); |
| -translate-&lt;fraction&gt; | translate: calc(&lt;fraction&gt; * -100%) calc(&lt;fraction&gt; * -100%); |
| translate-full | translate: 100% 100%; |
| -translate-full | translate: -100% -100%; |
| translate-px | translate: 1px 1px; |
| -translate-px | translate: -1px -1px; |
| translate-(&lt;custom-property&gt;) | translate: var(&lt;custom-property&gt;) var(&lt;custom-property&gt;); |
| translate-[&lt;value&gt;] | translate: &lt;value&gt;; |
| translate-x-&lt;number&gt; | translate: calc(var(--spacing) * &lt;number&gt;) var(--baro-translate-y); |
| -translate-x-&lt;number&gt; | translate: calc(var(--spacing) * -&lt;number&gt;) var(--baro-translate-y); |
| translate-x-&lt;fraction&gt; | translate: calc(&lt;fraction&gt; * 100%) var(--baro-translate-y); |
| -translate-x-&lt;fraction&gt; | translate: calc(&lt;fraction&gt; * -100%) var(--baro-translate-y); |
| translate-x-full | translate: 100% var(--baro-translate-y); |
| -translate-x-full | translate: -100% var(--baro-translate-y); |
| translate-x-px | translate: 1px var(--baro-translate-y); |
| -translate-x-px | translate: -1px var(--baro-translate-y); |
| translate-x-(&lt;custom-property&gt;) | translate: var(&lt;custom-property&gt;) var(--baro-translate-y); |
| translate-x-[&lt;value&gt;] | translate: &lt;value&gt; var(--baro-translate-y); |
| translate-y-&lt;number&gt; | translate: var(--baro-translate-x) calc(var(--spacing) * &lt;number&gt;); |
| -translate-y-&lt;number&gt; | translate: var(--baro-translate-x) calc(var(--spacing) * -&lt;number&gt;); |
| translate-y-&lt;fraction&gt; | translate: var(--baro-translate-x) calc(&lt;fraction&gt; * 100%); |
| -translate-y-&lt;fraction&gt; | translate: var(--baro-translate-x) calc(&lt;fraction&gt; * -100%); |
| translate-y-full | translate: var(--baro-translate-x) 100%; |
| -translate-y-full | translate: var(--baro-translate-x) -100%; |
| translate-y-px | translate: var(--baro-translate-x) 1px; |
| -translate-y-px | translate: var(--baro-translate-x) -1px; |
| translate-y-(&lt;custom-property&gt;) | translate: var(--baro-translate-x) var(&lt;custom-property&gt;); |
| translate-y-[&lt;value&gt;] | translate: var(--baro-translate-x) &lt;value&gt;; |
| translate-z-&lt;number&gt; | translate: var(--baro-translate-x) var(--baro-translate-y) calc(var(--spacing) * &lt;number&gt;); |
| -translate-z-&lt;number&gt; | translate: var(--baro-translate-x) var(--baro-translate-y) calc(var(--spacing) * -&lt;number&gt;); |
| translate-z-px | translate: var(--baro-translate-x) var(--baro-translate-y) 1px; |
| -translate-z-px | translate: var(--baro-translate-x) var(--baro-translate-y) -1px; |
| translate-z-(&lt;custom-property&gt;) | translate: var(--baro-translate-x) var(--baro-translate-y) var(&lt;custom-property&gt;); |
| translate-z-[&lt;value&gt;] | translate: var(--baro-translate-x) var(--baro-translate-y) &lt;value&gt;; |
| translate-none | translate: none; |

## Examples

### Using the spacing scale

Use `translate-&lt;number&gt;` utilities like `translate-2` and `-translate-4` to translate an element on both axes based on the spacing scale:

```html
<img class="-translate-6 ..." src="/img/mountains.jpg" />
<img class="translate-2 ..." src="/img/mountains.jpg" />
<img class="translate-8 ..." src="/img/mountains.jpg" />
```

### Using a percentage

Use `translate-&lt;fraction&gt;` utilities like `translate-1/4` and `-translate-full` to translate an element on both axes by a percentage of the element's size:

```html
<img class="-translate-1/4 ..." src="/img/mountains.jpg" />
<img class="translate-1/6 ..." src="/img/mountains.jpg" />
<img class="translate-1/2 ..." src="/img/mountains.jpg" />
```

### Translating on the x-axis

Use `translate-x-&lt;number&gt;` or `translate-x-&lt;fraction&gt;` utilities like `translate-x-4` and `translate-x-1/4` to translate an element on the x-axis:

```html
<img class="-translate-x-4 ..." src="/img/mountains.jpg" />
<img class="translate-x-2 ..." src="/img/mountains.jpg" />
<img class="translate-x-1/2 ..." src="/img/mountains.jpg" />
```

### Translating on the y-axis

Use `translate-y-&lt;number&gt;` or `translate-y-&lt;fraction&gt;` utilities like `translate-y-6` and `translate-y-1/3` to translate an element on the y-axis:

```html
<img class="-translate-y-4 ..." src="/img/mountains.jpg" />
<img class="translate-y-2 ..." src="/img/mountains.jpg" />
<img class="translate-y-1/2 ..." src="/img/mountains.jpg" />
```

### Translating on the z-axis

Use `translate-z-&lt;number&gt;` utilities like `translate-z-6` and `-translate-z-12` to translate an element on the z-axis:

```html
<div class="transform-3d">
  <img class="-translate-z-8 rotate-x-50 rotate-z-45 ..." src="/img/mountains.jpg" />
  <img class="translate-z-2 rotate-x-50 rotate-z-45 ..." src="/img/mountains.jpg" />
  <img class="translate-z-1/2 rotate-x-50 rotate-z-45 ..." src="/img/mountains.jpg" />
</div>
```

Note that the `translate-z-&lt;number&gt;` utilities require the `transform-3d` utility to be applied to the parent element.

### Using a custom value

Use the `translate-[&lt;value&gt;]` syntax to set the translate based on a completely custom value:

```html
<img class="translate-[3.142rad] ..." src="/img/mountains.jpg" />
```

For CSS variables, you can also use the `translate-(&lt;custom-property&gt;)` syntax:

```html
<img class="translate-(--my-translate) ..." src="/img/mountains.jpg" />
```

This is just a shorthand for `translate-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `translate` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<img class="translate-45 md:translate-60 ..." src="/img/mountains.jpg" />
```

