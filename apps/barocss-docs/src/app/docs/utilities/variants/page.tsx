import DocsLayout from '@/components/DocsLayout'
import CodeBlock from '@/components/CodeBlock'

export default function VariantsUtilities() {
  return (
    <DocsLayout>
      <div className="prose prose-lg max-w-none">
        <h1 id="variants">Variants</h1>
        
        <p>
          Barocss provides extensive variant support for conditional styling including responsive breakpoints, 
          dark mode, pseudo-classes, form states, container queries, and many more. All variants support 
          real-time generation and arbitrary values.
        </p>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>🎯 Real-time Variants:</strong> Unlike other frameworks, BAROCSS generates complex variants 
                like <code>has-[.selected]:bg-blue-500</code>, <code>@container(min-width:400px):grid-cols-2</code> 
                instantly when classes are detected, enabling powerful conditional styling without build-time processing!
              </p>
            </div>
          </div>
        </div>

        <h2 id="responsive">Responsive Design</h2>

        <h3 id="breakpoints">Breakpoints</h3>
        <CodeBlock language="html" filename="breakpoints.html">
{`<!-- Default breakpoints -->
<div class="w-full sm:w-1/2 md:w-1/3 lg:w-1/4 xl:w-1/5 2xl:w-1/6">
  Responsive width
</div>

<!-- Mobile-first approach -->
<div class="text-sm md:text-base lg:text-lg xl:text-xl">
  Responsive text size
</div>

<!-- Complex responsive layout -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-4 gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
  <div>Item 4</div>
</div>

<!-- Responsive padding -->
<div class="p-2 sm:p-4 md:p-6 lg:p-8 xl:p-12">
  Responsive padding
</div>`}
        </CodeBlock>

        <h3 id="arbitrary-breakpoints">Arbitrary Breakpoints</h3>
        <CodeBlock language="html" filename="arbitrary-breakpoints.html">
{`<!-- Custom breakpoints - real-time! -->
<div class="text-base min-[480px]:text-lg min-[768px]:text-xl min-[1200px]:text-2xl">
  Custom breakpoint text
</div>

<!-- Max-width media queries -->
<div class="bg-blue-500 max-sm:bg-red-500 max-md:bg-green-500">
  Max-width responsive background
</div>

<!-- Range-based breakpoints -->
<div class="hidden min-[640px]:max-[1023px]:block">
  Visible only between 640px and 1023px
</div>

<!-- Custom arbitrary breakpoints -->
<div class="grid-cols-1 min-[850px]:grid-cols-2 min-[1400px]:grid-cols-3">
  Custom responsive grid
</div>`}
        </CodeBlock>

        <h2 id="dark-mode">Dark Mode</h2>

        <h3 id="dark-mode-basics">Dark Mode Basics</h3>
        <CodeBlock language="html" filename="dark-mode-basics.html">
{`<!-- Basic dark mode colors -->
<div class="bg-white dark:bg-gray-900 text-black dark:text-white">
  Adaptive background and text
</div>

<!-- Dark mode borders -->
<div class="border border-gray-200 dark:border-gray-700">
  Adaptive border color
</div>

<!-- Complex dark mode theming -->
<div class="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-600 rounded-lg p-6">
  <h3 class="text-gray-900 dark:text-gray-100 font-semibold">Card Title</h3>
  <p class="text-gray-600 dark:text-gray-300 mt-2">Card description</p>
  <button class="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 rounded mt-4">
    Adaptive button
  </button>
</div>`}
        </CodeBlock>

        <h3 id="dark-mode-variants">Dark Mode with Other Variants</h3>
        <CodeBlock language="html" filename="dark-mode-variants.html">
{`<!-- Dark mode with hover -->
<button class="bg-blue-500 hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-700 text-white px-4 py-2 rounded">
  Dark mode hover button
</button>

<!-- Dark mode with focus -->
<input class="border border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 focus:ring-2 focus:ring-blue-500 dark:focus:ring-blue-400 px-3 py-2 rounded">

<!-- Dark mode with responsive -->
<div class="bg-white dark:bg-gray-900 md:bg-gray-50 md:dark:bg-gray-800">
  Responsive dark mode background
</div>`}
        </CodeBlock>

        <h2 id="pseudo-classes">Pseudo-Classes</h2>

        <h3 id="hover-focus-active">Hover, Focus & Active</h3>
        <CodeBlock language="html" filename="hover-focus-active.html">
{`<!-- Hover states -->
<button class="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded">
  Hover button
</button>

<!-- Focus states -->
<input class="border border-gray-300 focus:border-blue-500 focus:ring-2 focus:ring-blue-200 px-3 py-2 rounded" placeholder="Focus me">

<!-- Active states -->
<button class="bg-green-500 active:bg-green-600 text-white px-4 py-2 rounded">
  Active button
</button>

<!-- Combined states -->
<a href="#" class="text-blue-600 hover:text-blue-800 focus:text-blue-800 active:text-blue-900 underline">
  Link with multiple states
</a>

<!-- Group hover -->
<div class="group border rounded-lg p-4 hover:shadow-lg">
  <h3 class="text-gray-900 group-hover:text-blue-600">Card Title</h3>
  <p class="text-gray-600 group-hover:text-gray-800">Card description</p>
</div>`}
        </CodeBlock>

        <h3 id="visited-target">Visited & Target</h3>
        <CodeBlock language="html" filename="visited-target.html">
{`<!-- Visited links -->
<a href="#" class="text-blue-600 visited:text-purple-600 hover:text-blue-800 visited:hover:text-purple-800">
  Link with visited state
</a>

<!-- Target pseudo-class -->
<div id="section1" class="target:bg-yellow-100 target:border-yellow-300 border-2 border-transparent p-4 rounded">
  This section highlights when targeted (e.g., #section1)
</div>

<!-- Tab system using target -->
<div class="space-y-4">
  <nav class="space-x-4">
    <a href="#tab1" class="text-blue-600 hover:text-blue-800">Tab 1</a>
    <a href="#tab2" class="text-blue-600 hover:text-blue-800">Tab 2</a>
  </nav>
  
  <div id="tab1" class="target:block hidden p-4 bg-gray-100 rounded">
    Tab 1 content
  </div>
  
  <div id="tab2" class="target:block hidden p-4 bg-gray-100 rounded">
    Tab 2 content
  </div>
</div>`}
        </CodeBlock>

        <h2 id="form-states">Form States</h2>

        <h3 id="input-states">Input States</h3>
        <CodeBlock language="html" filename="input-states.html">
{`<!-- Placeholder styling -->
<input class="placeholder:text-gray-400 placeholder:italic border rounded px-3 py-2" placeholder="Enter your name">

<!-- Disabled state -->
<input class="disabled:bg-gray-100 disabled:text-gray-400 disabled:cursor-not-allowed border rounded px-3 py-2" disabled placeholder="Disabled input">

<!-- Read-only state -->
<input class="read-only:bg-gray-50 read-only:cursor-default border rounded px-3 py-2" readonly value="Read-only value">

<!-- Required indicator -->
<input class="required:border-red-300 border rounded px-3 py-2" required placeholder="Required field">

<!-- Valid and invalid states -->
<input class="valid:border-green-500 invalid:border-red-500 border rounded px-3 py-2" type="email" placeholder="Enter email">

<!-- Out of range -->
<input class="out-of-range:border-red-500 border rounded px-3 py-2" type="number" min="1" max="10" placeholder="1-10">`}
        </CodeBlock>

        <h3 id="checkbox-radio">Checkbox & Radio States</h3>
        <CodeBlock language="html" filename="checkbox-radio.html">
{`<!-- Checked state -->
<label class="flex items-center space-x-2">
  <input type="checkbox" class="checked:bg-blue-500 checked:border-blue-500">
  <span class="peer-checked:text-blue-600">Checkbox label</span>
</label>

<!-- Indeterminate state -->
<label class="flex items-center space-x-2">
  <input type="checkbox" class="indeterminate:bg-yellow-500 indeterminate:border-yellow-500">
  <span>Indeterminate checkbox</span>
</label>

<!-- Radio button styling -->
<div class="space-y-2">
  <label class="flex items-center space-x-2">
    <input type="radio" name="option" class="checked:bg-green-500 checked:border-green-500">
    <span>Option 1</span>
  </label>
  <label class="flex items-center space-x-2">
    <input type="radio" name="option" class="checked:bg-green-500 checked:border-green-500">
    <span>Option 2</span>
  </label>
</div>`}
        </CodeBlock>

        <h2 id="structural-selectors">Structural Selectors</h2>

        <h3 id="nth-child">Nth Child Selectors</h3>
        <CodeBlock language="html" filename="nth-child.html">
{`<!-- Basic nth-child -->
<div class="space-y-2">
  <div class="first:bg-blue-100 p-2">First item</div>
  <div class="p-2">Regular item</div>
  <div class="last:bg-red-100 p-2">Last item</div>
</div>

<!-- Odd and even -->
<div class="space-y-1">
  <div class="odd:bg-gray-100 even:bg-white p-2">Item 1</div>
  <div class="odd:bg-gray-100 even:bg-white p-2">Item 2</div>
  <div class="odd:bg-gray-100 even:bg-white p-2">Item 3</div>
  <div class="odd:bg-gray-100 even:bg-white p-2">Item 4</div>
</div>

<!-- First and last of type -->
<div class="space-y-2">
  <h2 class="first-of-type:text-2xl text-lg">First heading</h2>
  <h2 class="text-lg">Second heading</h2>
  <p class="last-of-type:font-bold">First paragraph</p>
  <p class="last-of-type:font-bold">Last paragraph</p>
</div>

<!-- Only child -->
<div class="border p-4">
  <div class="only:bg-yellow-100 p-2">I am the only child</div>
</div>`}
        </CodeBlock>

        <h3 id="arbitrary-nth">Arbitrary Nth Selectors</h3>
        <CodeBlock language="html" filename="arbitrary-nth.html">
{`<!-- Arbitrary nth-child - real-time! -->
<div class="space-y-1">
  <div class="nth-[3n]:bg-blue-100 p-2">Item 1</div>
  <div class="nth-[3n]:bg-blue-100 p-2">Item 2</div>
  <div class="nth-[3n]:bg-blue-100 p-2">Item 3 (highlighted)</div>
  <div class="nth-[3n]:bg-blue-100 p-2">Item 4</div>
  <div class="nth-[3n]:bg-blue-100 p-2">Item 5</div>
  <div class="nth-[3n]:bg-blue-100 p-2">Item 6 (highlighted)</div>
</div>

<!-- Complex nth patterns -->
<div class="space-y-1">
  <div class="nth-[2n+1]:bg-red-100 p-2">Item 1 (odd)</div>
  <div class="nth-[2n+1]:bg-red-100 p-2">Item 2</div>
  <div class="nth-[2n+1]:bg-red-100 p-2">Item 3 (odd)</div>
  <div class="nth-[2n+1]:bg-red-100 p-2">Item 4</div>
</div>`}
        </CodeBlock>

        <h2 id="has-variants">Has Variants</h2>

        <h3 id="has-selectors">Has Selectors</h3>
        <CodeBlock language="html" filename="has-selectors.html">
{`<!-- Has child element -->
<div class="has-[img]:border-2 has-[img]:border-blue-500 p-4 border border-gray-200 rounded">
  <img src="https://via.placeholder.com/64x64/3b82f6/ffffff?text=IMG" alt="Image" class="w-16 h-16 rounded">
  <p>This container has an image, so it gets a blue border</p>
</div>

<!-- Has specific class -->
<div class="has-[.selected]:bg-blue-50 p-4 border rounded">
  <div class="selected bg-blue-100 p-2 rounded">Selected item</div>
  <div class="p-2">Regular item</div>
</div>

<!-- Has input states -->
<form class="has-[:invalid]:border-red-500 border-2 border-gray-200 p-4 rounded">
  <input type="email" class="border rounded px-3 py-2 w-full mb-2" placeholder="Invalid email triggers red border">
  <button type="submit" class="bg-blue-500 text-white px-4 py-2 rounded">Submit</button>
</form>

<!-- Complex has selectors -->
<div class="has-[button:hover]:shadow-lg p-4 border rounded transition-shadow">
  <p>This container gets shadow when button is hovered</p>
  <button class="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded">Hover me</button>
</div>`}
        </CodeBlock>

        <h2 id="container-queries">Container Queries</h2>

        <h3 id="container-size">Container Size Queries</h3>
        <CodeBlock language="html" filename="container-size.html">
{`<!-- Container query setup -->
<div class="@container w-64 border rounded p-4 resize overflow-auto">
  <div class="@sm:grid @sm:grid-cols-2 @lg:grid-cols-3 space-y-2 @sm:space-y-0 @sm:gap-2">
    <div class="bg-blue-100 p-2 rounded">Item 1</div>
    <div class="bg-blue-100 p-2 rounded">Item 2</div>
    <div class="bg-blue-100 p-2 rounded">Item 3</div>
  </div>
</div>

<!-- Named container -->
<div class="@container/sidebar w-48 border rounded p-4">
  <div class="@md/sidebar:text-lg @lg/sidebar:text-xl">
    Text size based on sidebar container size
  </div>
</div>

<!-- Arbitrary container queries - real-time! -->
<div class="@container w-80 border rounded p-4">
  <div class="@[300px]:bg-green-100 @[400px]:bg-blue-100 @[500px]:bg-purple-100 p-4 rounded">
    Background changes at specific container widths
  </div>
</div>`}
        </CodeBlock>

        <h2 id="group-peer">Group & Peer</h2>

        <h3 id="group-variants">Group Variants</h3>
        <CodeBlock language="html" filename="group-variants.html">
{`<!-- Basic group hover -->
<div class="group border rounded-lg p-4 hover:shadow-lg cursor-pointer">
  <h3 class="text-gray-900 group-hover:text-blue-600 transition-colors">Card Title</h3>
  <p class="text-gray-600 group-hover:text-gray-800">Card description</p>
  <button class="bg-blue-500 group-hover:bg-blue-600 text-white px-4 py-2 rounded mt-2 opacity-0 group-hover:opacity-100 transition-all">
    Hidden button appears on group hover
  </button>
</div>

<!-- Named groups -->
<div class="group/card border rounded-lg p-4 hover:shadow-lg">
  <div class="group/button">
    <h3 class="group-hover/card:text-blue-600">Card title</h3>
    <button class="group-hover/button:bg-blue-600 bg-blue-500 text-white px-4 py-2 rounded">
      Button with separate group
    </button>
  </div>
</div>

<!-- Complex group interactions -->
<div class="group border rounded-lg p-4 hover:bg-gray-50">
  <img class="w-16 h-16 rounded group-hover:scale-110 transition-transform" src="https://via.placeholder.com/64x64/10b981/ffffff?text=User" alt="Avatar">
  <div class="mt-2">
    <h4 class="group-hover:text-blue-600">User Name</h4>
    <p class="text-sm text-gray-600 group-hover:text-gray-800">User description</p>
    <div class="mt-2 opacity-0 group-hover:opacity-100 transition-opacity">
      <button class="text-xs bg-blue-500 text-white px-2 py-1 rounded">Follow</button>
    </div>
  </div>
</div>`}
        </CodeBlock>

        <h3 id="peer-variants">Peer Variants</h3>
        <CodeBlock language="html" filename="peer-variants.html">
{`<!-- Basic peer interaction -->
<div class="space-y-2">
  <input type="checkbox" id="toggle" class="peer sr-only">
  <label for="toggle" class="block w-12 h-6 bg-gray-300 peer-checked:bg-blue-500 rounded-full cursor-pointer relative">
    <span class="block w-4 h-4 bg-white rounded-full shadow transform peer-checked:translate-x-6 transition-transform absolute top-1 left-1"></span>
  </label>
  <p class="peer-checked:text-blue-600 text-gray-600">Toggle is <span class="peer-checked:hidden">off</span><span class="hidden peer-checked:inline">on</span></p>
</div>

<!-- Form validation with peer -->
<div class="space-y-2">
  <input type="email" class="peer border rounded px-3 py-2 w-full" placeholder="Enter email">
  <p class="text-red-500 peer-invalid:block hidden">Please enter a valid email address</p>
  <p class="text-green-500 peer-valid:block hidden">Email looks good!</p>
</div>

<!-- Named peer -->
<div class="space-y-4">
  <input type="radio" name="plan" id="basic" class="peer/basic sr-only">
  <label for="basic" class="block border-2 border-gray-200 peer-checked/basic:border-blue-500 peer-checked/basic:bg-blue-50 rounded-lg p-4 cursor-pointer">
    <h3 class="font-semibold peer-checked/basic:text-blue-600">Basic Plan</h3>
    <p class="text-gray-600">Basic features included</p>
  </label>
  
  <div class="hidden peer-checked/basic:block p-4 bg-blue-50 rounded">
    Basic plan selected! Additional options will appear here.
  </div>
</div>`}
        </CodeBlock>

        <h2 id="media-features">Media Features</h2>

        <h3 id="print-screen">Print & Screen</h3>
        <CodeBlock language="html" filename="print-screen.html">
{`<!-- Print styles -->
<div class="bg-blue-500 print:bg-white text-white print:text-black p-4 rounded print:rounded-none">
  This has different styles when printed
</div>

<!-- Hide elements when printing -->
<nav class="bg-gray-800 text-white p-4 print:hidden">
  Navigation (hidden when printing)
</nav>

<!-- Show only when printing -->
<div class="hidden print:block">
  <p>This content only appears when printing</p>
  <p>Page URL: example.com</p>
</div>

<!-- Screen-only styles -->
<button class="bg-blue-500 hover:bg-blue-600 screen:shadow-lg text-white px-4 py-2 rounded">
  Screen-only button effects
</button>`}
        </CodeBlock>

        <h3 id="motion-preferences">Motion Preferences</h3>
        <CodeBlock language="html" filename="motion-preferences.html">
{`<!-- Respect reduced motion preferences -->
<div class="transform transition-transform duration-500 hover:scale-110 motion-reduce:transition-none motion-reduce:hover:scale-100">
  Animated element (respects motion preferences)
</div>

<!-- Alternative effects for reduced motion -->
<button class="bg-blue-500 text-white px-4 py-2 rounded transition-all duration-300 hover:bg-blue-600 hover:shadow-lg motion-reduce:transition-colors motion-reduce:hover:shadow-none">
  Button with motion alternatives
</button>

<!-- Animations that disable with reduced motion -->
<div class="animate-spin motion-reduce:animate-none w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full">
  Loading spinner (stops with reduced motion)
</div>`}
        </CodeBlock>

        <h2 id="arbitrary-variants">Arbitrary Variants</h2>

        <h3 id="custom-selectors">Custom Selectors</h3>
        <CodeBlock language="html" filename="custom-selectors.html">
{`<!-- Arbitrary pseudo-classes - real-time! -->
<button class="[&:nth-child(3n)]:bg-blue-500 bg-gray-300 p-2 m-1">
  Every 3rd button is blue
</button>

<!-- Custom attribute selectors -->
<div class="[&[data-status='active']]:bg-green-100 [&[data-status='inactive']]:bg-red-100 p-4" data-status="active">
  Styled based on data attribute
</div>

<!-- Complex arbitrary selectors -->
<ul>
  <li class="[&:not(:last-child)]:border-b border-gray-200 p-2">Item 1</li>
  <li class="[&:not(:last-child)]:border-b border-gray-200 p-2">Item 2</li>
  <li class="[&:not(:last-child)]:border-b border-gray-200 p-2">Item 3 (no border)</li>
</ul>

<!-- Descendant selectors -->
<div class="[&_strong]:text-red-500 [&_em]:text-blue-500">
  <p>Text with <strong>red strong text</strong> and <em>blue emphasized text</em></p>
</div>`}
        </CodeBlock>

        <h3 id="custom-media-queries">Custom Media Queries</h3>
        <CodeBlock language="html" filename="custom-media-queries.html">
{`<!-- Arbitrary media queries - real-time! -->
<div class="bg-blue-100 lg:bg-green-100 p-4">
  Different background based on screen size
</div>

<!-- Prefers color scheme -->
<div class="bg-white dark:bg-gray-800 p-4">
  Auto dark/light mode based on system preference
</div>

<!-- Custom viewport queries -->
<div class="bg-gray-50 md:bg-yellow-100 p-4">
  Background change on medium screens
</div>

<!-- High DPI displays -->
<img class="block lg:hidden w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/6b7280/ffffff?text=Low+Res" alt="Low resolution">
<img class="hidden lg:block w-32 h-32 object-cover rounded" src="https://via.placeholder.com/400x400/3b82f6/ffffff?text=High+Res" alt="High resolution">`}
        </CodeBlock>

        <div className="bg-green-50 border-l-4 border-green-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-green-700">
                <strong>🎯 Variant Performance:</strong> All variants are generated in real-time as you add them to the DOM. 
                Complex selectors like <code>has-[.selected_input:checked]:bg-blue-500</code> and 
                <code>[@media(orientation:landscape)_and_(min-width:768px)]:grid-cols-3</code> work instantly 
                without any build-time processing!
              </p>
            </div>
          </div>
        </div>

        <h2 id="combining-variants">Combining Variants</h2>
        <CodeBlock language="html" filename="combining-variants.html">
{`<!-- Multiple pseudo-classes -->
<button class="bg-blue-500 hover:bg-blue-600 focus:bg-blue-700 active:bg-blue-800 disabled:bg-gray-300 text-white px-4 py-2 rounded">
  Multiple state button
</button>

<!-- Responsive with dark mode -->
<div class="bg-white dark:bg-gray-900 md:bg-gray-50 md:dark:bg-gray-800 lg:bg-gray-100 lg:dark:bg-gray-700 p-4">
  Responsive dark mode background
</div>

<!-- Group hover with responsive -->
<div class="group md:hover:shadow-lg border rounded p-4">
  <h3 class="group-hover:text-blue-600 md:group-hover:text-purple-600">
    Different hover colors on different screen sizes
  </h3>
</div>

<!-- Container queries with dark mode -->
<div class="@container dark">
  <div class="@md:grid @md:grid-cols-2 @md:dark:bg-gray-800 p-4">
    Container query with dark mode
  </div>
</div>

<!-- Complex combination -->
<div class="group has-[input:focus]:ring-2 has-[input:focus]:ring-blue-500 dark:has-[input:focus]:ring-blue-400 md:has-[input:focus]:ring-4 border rounded p-4">
  <input class="w-full border rounded px-3 py-2 dark:bg-gray-800 dark:border-gray-600" placeholder="Focus triggers parent ring">
  <p class="mt-2 text-sm text-gray-600 dark:text-gray-400 group-hover:text-gray-800 dark:group-hover:text-gray-200">
    Complex variant combination example
  </p>
</div>`}
        </CodeBlock>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>💡 Pro Tip:</strong> You can create incredibly sophisticated conditional styling by combining variants. 
                Use arbitrary variants like <code>[&[data-theme='custom']]:bg-[var(--custom-color)]</code> 
                for dynamic theming, or <code>has-[.error]:border-red-500</code> for context-aware styling. 
                All combinations work in real-time!
              </p>
            </div>
          </div>
        </div>
      </div>
    </DocsLayout>
  )
}