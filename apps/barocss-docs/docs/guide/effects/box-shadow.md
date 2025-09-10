# box-shadow

Utilities for controlling the box shadow of an element.

## Quick reference

| Class | Styles |
|---|---|
| `shadow-2xs` | `box-shadow: var(--shadow-2xs); /* 0 1px rgb(0 0 0 / 0.05) */` |
| `shadow-xs` | `box-shadow: var(--shadow-xs); /* 0 1px 2px 0 rgb(0 0 0 / 0.05) */` |
| `shadow-sm` | `box-shadow: var(--shadow-sm); /* 0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1) */` |
| `shadow-md` | `box-shadow: var(--shadow-md); /* 0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1) */` |
| `shadow-lg` | `box-shadow: var(--shadow-lg); /* 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1) */` |
| `shadow-xl` | `box-shadow: var(--shadow-xl); /* 0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1) */` |
| `shadow-2xl` | `box-shadow: var(--shadow-2xl); /* 0 25px 50px -12px rgb(0 0 0 / 0.25) */` |
| `shadow-none` | `box-shadow: 0 0 #0000;` |
| `shadow-(&lt;custom-property&gt;)` | `box-shadow: var(&lt;custom-property&gt;);` |
| `shadow-(color:&lt;custom-property&gt;)` | `--baro-shadow-color: var(&lt;custom-property&gt;);` |
| `shadow-[&lt;value&gt;]` | `box-shadow: &lt;value&gt;;` |
| `inset-shadow-2xs` | `box-shadow: var(--inset-shadow-2xs); /* inset 0 1px rgb(0 0 0 / 0.05) */` |
| `inset-shadow-xs` | `box-shadow: var(--inset-shadow-xs); /* inset 0 1px 1px rgb(0 0 0 / 0.05) */` |
| `inset-shadow-sm` | `box-shadow: var(--inset-shadow-sm); /* inset 0 2px 4px rgb(0 0 0 / 0.05) */` |
| `inset-shadow-none` | `box-shadow: inset 0 0 #0000;` |
| `inset-shadow-(&lt;custom-property&gt;)` | `box-shadow: var(&lt;custom-property&gt;);` |
| `inset-shadow-[&lt;value&gt;]` | `box-shadow: &lt;value&gt;;` |
| `ring` | `--baro-ring-shadow: 0 0 0 1px;` |
| `ring-&lt;number&gt;` | `--baro-ring-shadow: 0 0 0 &lt;number&gt;px;` |
| `ring-(&lt;custom-property&gt;)` | `--baro-ring-shadow: 0 0 0 var(&lt;custom-property&gt;);` |
| `ring-[&lt;value&gt;]` | `--baro-ring-shadow: 0 0 0 &lt;value&gt;;` |
| `inset-ring` | `--baro-inset-ring-shadow: inset 0 0 0 1px` |
| `inset-ring-&lt;number&gt;` | `--baro-inset-ring-shadow: inset 0 0 0 &lt;number&gt;px` |
| `inset-ring-(&lt;custom-property&gt;)` | `--baro-inset-ring-shadow: inset 0 0 0 var(&lt;custom-property&gt;);` |
| `inset-ring-[&lt;value&gt;]` | `--baro-inset-ring-shadow: inset 0 0 0 &lt;value&gt;;` |



## Examples

### Basic example

Use utilities like `shadow-sm` and `shadow-lg` to apply different sized outer box shadows to an element:

```html
<!-- [!code classes:shadow-md,shadow-lg,shadow-xl] -->
<div class="shadow-md ..."></div>
<div class="shadow-lg ..."></div>
<div class="shadow-xl ..."></div>
```

### Changing the opacity

Use the opacity modifier to adjust the opacity of the box shadow:

```html
<!-- [!code classes:shadow-xl,shadow-xl/20,shadow-xl/30] -->
<div class="shadow-xl ..."></div>
<div class="shadow-xl/20 ..."></div>
<div class="shadow-xl/30 ..."></div>
```

The default box shadow opacities are quite low (25% or less), so increasing the opacity (to like 50%) will make the box shadows more pronounced.

### Setting the shadow color

Use utilities like `shadow-indigo-500` and `shadow-cyan-500/50` to change the color of a box shadow:

```html
<!-- [!code classes:shadow-cyan-500/50,shadow-blue-500/50,shadow-indigo-500/50] -->
<button class="bg-cyan-500 shadow-lg shadow-cyan-500/50 ...">Subscribe</button>
<button class="bg-blue-500 shadow-lg shadow-blue-500/50 ...">Subscribe</button>
<button class="bg-indigo-500 shadow-lg shadow-indigo-500/50 ...">Subscribe</button>
```

By default colored shadows have an opacity of 100% but you can adjust this using the opacity modifier.

### Adding an inset shadow

Use utilities like `inset-shadow-xs` and `inset-shadow-sm` to apply an inset box shadow to an element:

```html
<!-- [!code classes:inset-shadow-2xs,inset-shadow-xs,inset-shadow-sm] -->
<div class="inset-shadow-2xs ..."></div>
<div class="inset-shadow-xs ..."></div>
<div class="inset-shadow-sm ..."></div>
```

You can adjust the opacity of an inset shadow using the opacity modifier, like `inset-shadow-sm/50`. The default inset shadow opacities are quite low (5%), so increasing the opacity (to like 50%) will make the inset shadows more pronounced.

### Setting the inset shadow color

Use utilities like `inset-shadow-indigo-500` and `inset-shadow-cyan-500/50` to change the color of an inset box shadow:

```html
<!-- [!code classes:inset-shadow-indigo-500,inset-shadow-indigo-500/75] -->
<div class="inset-shadow-sm inset-shadow-indigo-500 ..."></div>
<div class="inset-shadow-sm inset-shadow-indigo-500/50 ..."></div>
```

By default colored shadows have an opacity of 100% but you can adjust this using the opacity modifier.

### Adding a ring

Use `ring` or `ring-&lt;number&gt;` utilities like `ring-2` and `ring-4` to apply a solid box-shadow to an element:

```html
<!-- [!code classes:ring,ring-2,ring-4] -->
<button class="ring ...">Subscribe</button>
<button class="ring-2 ...">Subscribe</button>
<button class="ring-4 ...">Subscribe</button>
```

By default rings match the `currentColor` of the element they are applied to.

### Setting the ring color

Use utilities like `ring-indigo-500` and `ring-cyan-500/50` to change the color of a ring:

```html
<!-- [!code classes:ring-blue-500,ring-blue-500/50] -->
<button class="ring-2 ring-blue-500 ...">Subscribe</button>
<button class="ring-2 ring-blue-500/50 ...">Subscribe</button>
```

By default rings have an opacity of 100% but you can adjust this using the opacity modifier.

### Adding an inset ring

Use `inset-ring` or `inset-ring-&lt;number&gt;` utilities like `inset-ring-2` and `inset-ring-4` to apply a solid inset box-shadow to an element:

```html
<!-- [!code classes:inset-ring,inset-ring-2,inset-ring-4] -->
<button class="inset-ring ...">Subscribe</button>
<button class="inset-ring-2 ...">Subscribe</button>
<button class="inset-ring-4 ...">Subscribe</button>
```

By default inset rings match the `currentColor` of the element they are applied to.

### Setting the inset ring color

Use utilities like `inset-ring-indigo-500` and `inset-ring-cyan-500/50` to change the color of an inset ring:

```html
<!-- [!code classes:inset-ring-blue-500,inset-ring-blue-500/50] -->
<button class="inset-ring-2 inset-ring-blue-500 ...">Subscribe</button>
<button class="inset-ring-2 inset-ring-blue-500/50 ...">Subscribe</button>
```

By default inset rings have an opacity of 100% but you can adjust this using the opacity modifier.

### Removing a box shadow

Use the `shadow-none`, `inset-shadow-none`,`ring-0`, and `inset-ring-0` utilities to remove an existing box shadow from an element:

```html
<!-- [!code classes:shadow-none] -->
<div class="shadow-none ..."></div>
```

### Using a custom value

Use utilities like `shadow-[&lt;value&gt;]`, `inset-shadow-[&lt;value&gt;]`, `ring-[&lt;value&gt;]`, and `inset-ring-[&lt;value&gt;]` to set the box shadow based on a completely custom value:

```html
<div class="shadow-[0_35px_35px_rgba(0,0,0,0.25)] ...">
  <!-- ... -->
</div>
```

For CSS variables, you can also use the `shadow-(&lt;custom-property&gt;)` syntax:

```html
<div class="shadow-(--my-shadow) ...">
  <!-- ... -->
</div>
```

This is just a shorthand for `shadow-[var(&lt;custom-property&gt;)]` that adds the `var()` function for you automatically.

### Responsive design

Prefix a `box-shadow` utility with a breakpoint variant like `md:` to only apply the utility at medium screen sizes and above:

```html
<div class="shadow-none md:shadow-lg ...">
  <!-- ... -->
</div>
```



## Customizing your theme

### Customizing shadows

Customize the box shadow utilities in your project using theme configuration:

```typescript
import { createContext } from '@barocss/kit';

const ctx = createContext({
  theme: {
    extend: {
      boxShadow: {
        '3xl': '0 35px 35px rgba(0, 0, 0, 0.25)'
      }
    }
  }
});
```

Now the `shadow-3xl` utility can be used in your markup:

```html
<div class="shadow-3xl">
  <!-- ... -->
</div>
```



### Customizing inset shadows

Customize the inset box shadow utilities in your project using theme configuration:

```typescript
import { createContext } from '@barocss/kit';

const ctx = createContext({
  theme: {
    extend: {
      boxShadow: {
        'inset-md': 'inset 0 2px 3px rgba(0, 0, 0, 0.25)'
      }
    }
  }
});
```

Now the `shadow-inset-md` utility can be used in your markup:

```html
<div class="inset-shadow-md">
  <!-- ... -->
</div>
```



### Customizing shadow colors

Customize the color utilities in your project using theme configuration:

```typescript
import { createContext } from '@barocss/kit';

const ctx = createContext({
  theme: {
    extend: {
      colors: {
        'regal-blue': '#243c5a'
      }
    }
  }
});
```

Now utilities like `shadow-regal-blue`, `ring-regal-blue` can be used in your markup:

```html
<div class="shadow-regal-blue">
  <!-- ... -->
</div>
```


