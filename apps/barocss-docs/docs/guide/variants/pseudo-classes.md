# Pseudo-classes

## :hover, :focus, and :active

Style elements on hover, focus, and active using the `hover`, `focus`, and `active` variants:

Try interacting with this button to see the hover, focus, and active states

Save changes

```html
<button class="bg-violet-500 hover:bg-violet-600 focus:outline-2 focus:outline-offset-2 focus:outline-violet-500 active:bg-violet-700 ...">
  Save changes
</button>
```

Tailwind also includes variants for other interactive states like `:visited`, `:focus-within`, `:focus-visible`, and more.

See the pseudo-class reference for a complete list of available pseudo-class variants.

## :first, :last, :odd, and :even

Style an element when it is the first-child or last-child using the `first` and `last` variants:

* Kristen Ramos  
kristen.ramos@example.com
* Floyd Miles  
floyd.miles@example.com
* Courtney Henry  
courtney.henry@example.com
* Ted Fox  
ted.fox@example.com

```html
<ul role="list">
  {#each people as person}
    <!-- Remove top/bottom padding when first/last child -->
    <li class="flex py-4 first:pt-0 last:pb-0">
      <img class="h-10 w-10 rounded-full" src={person.imageUrl} alt="" />
      <div class="ml-3 overflow-hidden">
        <p class="text-sm font-medium text-gray-900 dark:text-white">{person.name}</p>
        <p class="truncate text-sm text-gray-500 dark:text-gray-400">{person.email}</p>
      </div>
    </li>
  {/each}
</ul>
```

## :first-of-type

Style an element if it's the first child of its type using the `first-of-type` variant:

```html
<nav>
  <img src="/logo.svg" alt="Vandelay Industries" />
  {#each links as link}
    <a href="#" class="ml-2 first-of-type:ml-6 ...">
      <!-- ... -->
    </a>
  {/each}
</nav>
```

## :last-of-type

Style an element if it's the last child of its type using the `last-of-type` variant:

```html
<nav>
  <img src="/logo.svg" alt="Vandelay Industries" />
  {#each links as link}
    <a href="#" class="mr-2 last-of-type:mr-6 ...">
      <!-- ... -->
    </a>
  {/each}
  <button>More</button>
</nav>
```

## :only-of-type

Style an element if it's the only child of its type using the `only-of-type` variant:

```html
<nav>
  <img src="/logo.svg" alt="Vandelay Industries" />
  {#each links as link}
    <a href="#" class="mx-2 only-of-type:mx-6 ...">
      <!-- ... -->
    </a>
  {/each}
  <button>More</button>
</nav>
```

## :nth-child()

Style an element at a specific position using the `nth` variant:

```html
<nav>
  <img src="/logo.svg" alt="Vandelay Industries" />
  {#each links as link}
    <a href="#" class="mx-2 nth-3:mx-6 nth-[3n+1]:mx-7 ...">
      <!-- ... -->
    </a>
  {/each}
  <button>More</button>
</nav>
```

## :nth-last-child()

Style an element at a specific position from the end using the `nth-last` variant:

```html
<nav>
  <img src="/logo.svg" alt="Vandelay Industries" />
  {#each links as link}
    <a href="#" class="mx-2 nth-last-3:mx-6 nth-last-[3n+1]:mx-7 ...">
      <!-- ... -->
    </a>
  {/each}
  <button>More</button>
</nav>
```

## :nth-of-type()

Style an element at a specific position, of the same type using the `nth-of-type` variant:

```html
<nav>
  <img src="/logo.svg" alt="Vandelay Industries" />
  {#each links as link}
    <a href="#" class="mx-2 nth-of-type-3:mx-6 nth-of-type-[3n+1]:mx-7 ...">
      <!-- ... -->
    </a>
  {/each}
  <button>More</button>
</nav>
```

## :nth-last-of-type()

Style an element at a specific position from the end, of the same type using the `nth-last-of-type` variant:

```html
<nav>
  <img src="/logo.svg" alt="Vandelay Industries" />
  {#each links as link}
    <a href="#" class="mx-2 nth-last-of-type-3:mx-6 nth-last-of-type-[3n+1]:mx-7 ...">
      <!-- ... -->
    </a>
  {/each}
  <button>More</button>
</nav>
```

## :empty

Style an element if it has no content using the `empty` variant:

```html
<ul>
  {#each people as person}
    <li class="empty:hidden ...">{person.hobby}</li>
  {/each}
</ul>
```

## :disabled

Style an input when it's disabled using the `disabled` variant:

```html
<input class="disabled:opacity-75 ..." />
```

## :enabled

Style an input when it's enabled using the `enabled` variant, most helpful when you only want to apply another style when an element is not disabled:

```html
<input class="enabled:hover:border-gray-400 disabled:opacity-75 ..." />
```

## :checked

Style a checkbox or radio button when it's checked using the `checked` variant:

```html
<input type="checkbox" class="appearance-none checked:bg-blue-500 ..." />
```

## :indeterminate

Style a checkbox or radio button in an indeterminate state using the `indeterminate` variant:

```html
<input type="checkbox" class="appearance-none indeterminate:bg-gray-300 ..." />
```

## :default

Style an option, checkbox or radio button that was the default value when the page initially loaded using the `default` variant:

```html
<input type="checkbox" class="default:outline-2 ..." />
```

## :optional

Style an input when it's optional using the `optional` variant:

```html
<input class="border optional:border-red-500 ..." />
```

## :required

Style an input when it's required using the `required` variant:

```html
<input required class="border required:border-red-500 ..." />
```

## :valid

Style an input when it's valid using the `valid` variant:

```html
<input required class="border valid:border-green-500 ..." />
```

## :invalid

Style an input when it's invalid using the `invalid` variant:

```html
<input required class="border invalid:border-red-500 ..." />
```

## :user-valid

Style an input when it's valid and the user has interacted with it, using the `user-valid` variant:

```html
<input required class="border user-valid:border-green-500" />
```

## :user-invalid

Style an input when it's invalid and the user has interacted with it, using the `user-invalid` variant:

```html
<input required class="border user-invalid:border-red-500" />
```

## :in-range

Style an input when its value is within a specified range limit using the `in-range` variant:

```html
<input min="1" max="5" class="in-range:border-green-500 ..." />
```

## :out-of-range

Style an input when its value is outside of a specified range limit using the `out-of-range` variant:

```html
<input min="1" max="5" class="out-of-range:border-red-500 ..." />
```

## :placeholder-shown

Style an input when the placeholder is shown using the `placeholder-shown` variant:

```html
<input class="placeholder-shown:border-gray-500 ..." placeholder="you@example.com" />
```

## :details-content

Style the content of a `<details>` element using the `details-content` variant:

```html
<details class="details-content:bg-gray-100 ...">
  <summary>Details</summary>
  This is a secret.
</details>
```

## :autofill

Style an input when it has been autofilled by the browser using the `autofill` variant:

```html
<input class="autofill:bg-yellow-200 ..." />
```

## :read-only

Style an input when it is read-only using the `read-only` variant:

```html
<input class="read-only:bg-gray-100 ..." />
```

## :has()

Style an element based on what it contains using the `has` variant:

```html
<div class="has-[p]:bg-blue-50 has-[a]:border has-[a]:border-blue-200">
  <p>This div will have a blue background because it contains a paragraph.</p>
</div>
```

## :not()

Style an element when it doesn't match a selector using the `not` variant:

```html
<div class="not-[&:first-child]:mt-4">
  <p>This paragraph won't have top margin if it's the first child.</p>
</div>
```

## Styling based on parent state

Use the `group` utility to style elements based on their parent's state:

```html
<a href="#" class="group block max-w-xs mx-auto rounded-lg p-6 bg-white ring-1 ring-slate-200 shadow-sm hover:bg-slate-50 hover:shadow-md hover:ring-slate-300 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:ring-offset-2">
  <div class="flex items-center">
    <div class="flex-shrink-0">
      <div class="w-8 h-8 bg-slate-100 group-hover:bg-slate-200 rounded-lg flex items-center justify-center">
        <svg class="w-4 h-4 text-slate-600 group-hover:text-slate-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
        </svg>
      </div>
    </div>
    <div class="ml-3">
      <p class="text-sm font-medium text-slate-900 group-hover:text-slate-700">New project</p>
      <p class="text-sm text-slate-500 group-hover:text-slate-600">Create a new project from a variety of starting templates.</p>
    </div>
  </div>
</a>
```

## Styling based on sibling state

Use the `peer` utility to style elements based on their sibling's state:

```html
<div class="relative">
  <input type="email" id="email" class="peer block w-full rounded-md border-gray-300 shadow-sm focus:border-indigo-500 focus:ring-indigo-500 sm:text-sm" placeholder="you@example.com" />
  <label for="email" class="absolute -top-2 left-2 bg-white px-1 text-xs text-gray-500 peer-placeholder-shown:top-2 peer-placeholder-shown:text-sm peer-placeholder-shown:text-gray-400 peer-focus:-top-2 peer-focus:text-xs peer-focus:text-gray-500">
    Email address
  </label>
</div>
```

## Pseudo-class reference

| Variant | CSS Selector | Description |
|---------|--------------|-------------|
| `hover` | `:hover` | When the element is hovered |
| `focus` | `:focus` | When the element is focused |
| `focus-within` | `:focus-within` | When the element or its descendants are focused |
| `focus-visible` | `:focus-visible` | When the element is focused and should be visible |
| `active` | `:active` | When the element is being activated |
| `visited` | `:visited` | When the link has been visited |
| `target` | `:target` | When the element is the target of a URL fragment |
| `first` | `:first-child` | When the element is the first child |
| `last` | `:last-child` | When the element is the last child |
| `only` | `:only-child` | When the element is the only child |
| `odd` | `:nth-child(odd)` | When the element is an odd child |
| `even` | `:nth-child(even)` | When the element is an even child |
| `first-of-type` | `:first-of-type` | When the element is the first of its type |
| `last-of-type` | `:last-of-type` | When the element is the last of its type |
| `only-of-type` | `:only-of-type` | When the element is the only one of its type |
| `empty` | `:empty` | When the element has no children |
| `disabled` | `:disabled` | When the form element is disabled |
| `enabled` | `:enabled` | When the form element is enabled |
| `checked` | `:checked` | When the form element is checked |
| `indeterminate` | `:indeterminate` | When the form element is in an indeterminate state |
| `default` | `:default` | When the form element is the default option |
| `required` | `:required` | When the form element is required |
| `optional` | `:optional` | When the form element is optional |
| `valid` | `:valid` | When the form element is valid |
| `invalid` | `:invalid` | When the form element is invalid |
| `in-range` | `:in-range` | When the form element value is in range |
| `out-of-range` | `:out-of-range` | When the form element value is out of range |
| `placeholder-shown` | `:placeholder-shown` | When the placeholder is visible |
| `autofill` | `:autofill` | When the form element is autofilled |
| `read-only` | `:read-only` | When the form element is read-only |
| `read-write` | `:read-write` | When the form element is read-write |
| `root` | `:root` | The root element of the document |
