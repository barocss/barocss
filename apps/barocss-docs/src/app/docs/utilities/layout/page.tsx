import DocsLayout from '@/components/DocsLayout'
import CodeBlock from '@/components/CodeBlock'

export default function LayoutUtilities() {
  return (
    <DocsLayout>
      <div className="prose prose-lg max-w-none">
        <h1 id="layout-utilities">Layout & Flexbox Utilities</h1>
        
        <p>
          Barocss provides comprehensive layout utilities for  layouts including Flexbox and Grid. 
          All utilities support real-time generation, arbitrary values, and custom properties.
        </p>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>💡 Real-time Magic:</strong> Unlike Tailwind CSS which requires build-time compilation, 
                BAROCSS generates these layout utilities instantly when DOM classes are detected. 
                Try <code>grid-cols-[200px_1fr_100px]</code> or <code>gap-[clamp(1rem,3vw,2rem)]</code> - they work immediately!
              </p>
            </div>
          </div>
        </div>

        <h2 id="flexbox-container">Flexbox Container</h2>

        <h3 id="display-flex">Display Flex</h3>
        <CodeBlock language="html" filename="flex-container.html">
{`<!-- Basic flex container -->
<div class="flex">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>

<!-- Inline flex container -->
<div class="inline-flex">
  <span>Inline item 1</span>
  <span>Inline item 2</span>
</div>`}
        </CodeBlock>

        <h3 id="flex-direction">Flex Direction</h3>
        <p>Control the direction of flex items:</p>
        <CodeBlock language="html" filename="flex-direction.html">
{`<!-- Row (default) -->
<div class="flex flex-row">
  <div>1</div>
  <div>2</div>
  <div>3</div>
</div>

<!-- Row reverse -->
<div class="flex flex-row-reverse">
  <div>1</div>
  <div>2</div>
  <div>3</div>
</div>

<!-- Column -->
<div class="flex flex-col">
  <div>1</div>
  <div>2</div>
  <div>3</div>
</div>

<!-- Column reverse -->
<div class="flex flex-col-reverse">
  <div>1</div>
  <div>2</div>
  <div>3</div>
</div>`}
        </CodeBlock>

        <h3 id="flex-wrap">Flex Wrap</h3>
        <CodeBlock language="html" filename="flex-wrap.html">
{`<!-- No wrap (default) -->
<div class="flex flex-nowrap">
  <div class="w-64">Item 1</div>
  <div class="w-64">Item 2</div>
  <div class="w-64">Item 3</div>
</div>

<!-- Wrap -->
<div class="flex flex-wrap">
  <div class="w-64">Item 1</div>
  <div class="w-64">Item 2</div>
  <div class="w-64">Item 3</div>
</div>

<!-- Wrap reverse -->
<div class="flex flex-wrap-reverse">
  <div class="w-64">Item 1</div>
  <div class="w-64">Item 2</div>
  <div class="w-64">Item 3</div>
</div>`}
        </CodeBlock>

        <h2 id="flex-items">Flex Items</h2>

        <h3 id="flex-grow-shrink">Flex Grow & Shrink</h3>
        <CodeBlock language="html" filename="flex-grow-shrink.html">
{`<!-- Flex grow -->
<div class="flex">
  <div class="flex-none">Fixed</div>
  <div class="flex-auto">Auto</div>
  <div class="flex-initial">Initial</div>
</div>

<!-- Flex with numbers -->
<div class="flex">
  <div class="flex-1">Flex 1</div>
  <div class="flex-2">Flex 2</div>
  <div class="flex-[3]">Flex 3</div>
</div>

<!-- Grow and shrink -->
<div class="flex">
  <div class="grow">Grow</div>
  <div class="grow-0">No grow</div>
  <div class="shrink">Shrink</div>
  <div class="shrink-0">No shrink</div>
</div>

<!-- Arbitrary values - real-time! -->
<div class="flex">
  <div class="grow-[2.5]">Custom grow 2.5</div>
  <div class="shrink-[0.5]">Custom shrink 0.5</div>
</div>`}
        </CodeBlock>

        <h3 id="flex-basis">Flex Basis</h3>
        <CodeBlock language="html" filename="flex-basis.html">
{`<!-- Predefined basis values -->
<div class="flex">
  <div class="basis-auto">Auto basis</div>
  <div class="basis-full">Full basis</div>
  <div class="basis-1/2">Half basis</div>
  <div class="basis-1/3">Third basis</div>
</div>

<!-- Container-based basis -->
<div class="flex">
  <div class="basis-xs">XS container</div>
  <div class="basis-md">MD container</div>
  <div class="basis-lg">LG container</div>
</div>

<!-- Arbitrary basis values - real-time! -->
<div class="flex">
  <div class="basis-[200px]">200px basis</div>
  <div class="basis-[25vw]">25vw basis</div>
  <div class="basis-[calc(100%-200px)]">Calc basis</div>
</div>`}
        </CodeBlock>

        <h2 id="alignment">Flex Alignment</h2>

        <h3 id="justify-content">Justify Content</h3>
        <CodeBlock language="html" filename="justify-content.html">
{`<!-- Horizontal alignment -->
<div class="flex justify-start">Start</div>
<div class="flex justify-center">Center</div>
<div class="flex justify-end">End</div>
<div class="flex justify-between">Space between</div>
<div class="flex justify-around">Space around</div>
<div class="flex justify-evenly">Space evenly</div>

<!-- Safe alignment (prevents overflow) -->
<div class="flex justify-center-safe">Safe center</div>
<div class="flex justify-end-safe">Safe end</div>`}
        </CodeBlock>

        <h3 id="align-items">Align Items</h3>
        <CodeBlock language="html" filename="align-items.html">
{`<!-- Vertical alignment -->
<div class="flex items-start">Start</div>
<div class="flex items-center">Center</div>
<div class="flex items-end">End</div>
<div class="flex items-baseline">Baseline</div>
<div class="flex items-stretch">Stretch</div>

<!-- Safe alignment -->
<div class="flex items-center-safe">Safe center</div>
<div class="flex items-end-safe">Safe end</div>`}
        </CodeBlock>

        <h3 id="align-self">Align Self</h3>
        <CodeBlock language="html" filename="align-self.html">
{`<!-- Individual item alignment -->
<div class="flex">
  <div class="self-start">Start</div>
  <div class="self-center">Center</div>
  <div class="self-end">End</div>
  <div class="self-stretch">Stretch</div>
  <div class="self-baseline">Baseline</div>
</div>

<!-- Safe self alignment -->
<div class="flex">
  <div class="self-center-safe">Safe center</div>
  <div class="self-end-safe">Safe end</div>
</div>`}
        </CodeBlock>

        <h2 id="grid-container">Grid Container</h2>

        <h3 id="display-grid">Display Grid</h3>
        <CodeBlock language="html" filename="grid-container.html">
{`<!-- Basic grid container -->
<div class="grid">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
  <div>Item 4</div>
</div>

<!-- Inline grid container -->
<div class="inline-grid">
  <div>Item 1</div>
  <div>Item 2</div>
</div>`}
        </CodeBlock>

        <h3 id="grid-template-columns">Grid Template Columns</h3>
        <CodeBlock language="html" filename="grid-template-columns.html">
{`<!-- Predefined column layouts -->
<div class="grid grid-cols-1">Single column</div>
<div class="grid grid-cols-2">Two columns</div>
<div class="grid grid-cols-3">Three columns</div>
<div class="grid grid-cols-12">Twelve columns</div>

<!-- None and subgrid -->
<div class="grid grid-cols-none">No columns</div>
<div class="grid grid-cols-subgrid">Subgrid</div>

<!-- Arbitrary column layouts - real-time! -->
<div class="grid grid-cols-[200px_1fr_100px]">
  <div>Fixed 200px</div>
  <div>Flexible middle</div>
  <div>Fixed 100px</div>
</div>

<!-- Complex layouts with minmax and repeat -->
<div class="grid grid-cols-3 gap-4">
  <div>Auto-fitting item 1</div>
  <div>Auto-fitting item 2</div>
  <div>Auto-fitting item 3</div>
</div>

<!-- Using CSS functions -->
<div class="grid grid-cols-[1fr_3fr_1fr] gap-4">
  <div>Flexible start</div>
  <div>3fr middle</div>
  <div>Flexible end</div>
</div>`}
        </CodeBlock>

        <h3 id="grid-template-rows">Grid Template Rows</h3>
        <CodeBlock language="html" filename="grid-template-rows.html">
{`<!-- Predefined row layouts -->
<div class="grid grid-rows-1">Single row</div>
<div class="grid grid-rows-2">Two rows</div>
<div class="grid grid-rows-3">Three rows</div>

<!-- Arbitrary row layouts - real-time! -->
<div class="grid grid-rows-[100px_1fr_50px]">
  <div>Fixed 100px header</div>
  <div>Flexible content</div>
  <div>Fixed 50px footer</div>
</div>

<!-- Complex row layouts -->
<div class="grid grid-rows-[auto_1fr_auto] h-96">
  <div>Header</div>
  <div>Main content</div>
  <div>Footer</div>
</div>`}
        </CodeBlock>

        <h2 id="grid-items">Grid Items</h2>

        <h3 id="grid-column">Grid Column Span</h3>
        <CodeBlock language="html" filename="grid-column.html">
{`<!-- Column spanning -->
<div class="grid grid-cols-6">
  <div class="col-span-1">1 column</div>
  <div class="col-span-2">2 columns</div>
  <div class="col-span-3">3 columns</div>
  <div class="col-span-full">Full width</div>
</div>

<!-- Column start and end -->
<div class="grid grid-cols-6">
  <div class="col-start-1 col-end-3">Columns 1-2</div>
  <div class="col-start-3 col-end-6">Columns 3-5</div>
</div>

<!-- Arbitrary column values - real-time! -->
<div class="grid grid-cols-12">
  <div class="col-span-[7]">Span 7 columns</div>
  <div class="col-span-[5]">Span 5 columns</div>
</div>`}
        </CodeBlock>

        <h3 id="grid-row">Grid Row Span</h3>
        <CodeBlock language="html" filename="grid-row.html">
{`<!-- Row spanning -->
<div class="grid grid-rows-4 grid-cols-2 h-64">
  <div class="row-span-1">1 row</div>
  <div class="row-span-2">2 rows</div>
  <div class="row-span-3">3 rows</div>
  <div class="row-span-full">Full height</div>
</div>

<!-- Row start and end -->
<div class="grid grid-rows-4 grid-cols-2 h-64">
  <div class="row-start-1 row-end-3">Rows 1-2</div>
  <div class="row-start-3 row-end-5">Rows 3-4</div>
</div>`}
        </CodeBlock>

        <h2 id="gap">Gap</h2>
        <CodeBlock language="html" filename="gap.html">
{`<!-- Basic gap -->
<div class="grid grid-cols-3 gap-4">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
</div>

<!-- Row and column gap -->
<div class="grid grid-cols-3 gap-x-4 gap-y-8">
  <div>Item 1</div>
  <div>Item 2</div>
  <div>Item 3</div>
  <div>Item 4</div>
  <div>Item 5</div>
  <div>Item 6</div>
</div>

<!-- Arbitrary gap values - real-time! -->
<div class="grid grid-cols-3 gap-[clamp(1rem,3vw,2rem)]">
  <div>Responsive gap</div>
  <div>Responsive gap</div>
  <div>Responsive gap</div>
</div>

<!-- Complex gap expressions -->
<div class="flex gap-[calc(1rem+2vw)]">
  <div>Dynamic gap</div>
  <div>Dynamic gap</div>
  <div>Dynamic gap</div>
</div>`}
        </CodeBlock>

        <h2 id="order">Order</h2>
        <CodeBlock language="html" filename="order.html">
{`<!-- Basic ordering -->
<div class="flex">
  <div class="order-3">Third</div>
  <div class="order-1">First</div>
  <div class="order-2">Second</div>
</div>

<!-- Special order values -->
<div class="flex">
  <div class="order-first">First</div>
  <div class="order-none">Normal</div>
  <div class="order-last">Last</div>
</div>

<!-- Negative and arbitrary order - real-time! -->
<div class="flex">
  <div class="order-[-1]">Negative order</div>
  <div class="order-[999]">High order</div>
  <div class="order-none">Normal order</div>
</div>`}
        </CodeBlock>

        <div className="bg-green-50 border-l-4 border-green-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-green-700">
                <strong>🚀 Performance Note:</strong> All these layout utilities are generated in real-time 
                as you add classes to your DOM. The grid system supports arbitrary template syntax like 
                <code>grid-cols-[200px_minmax(0,1fr)_100px]</code> which would require complex build-time 
                processing in other frameworks, but works instantly in BAROCSS!
              </p>
            </div>
          </div>
        </div>

        <h2 id="best-practices">Best Practices</h2>

        <h3 id="responsive-layouts">Responsive Layouts</h3>
        <CodeBlock language="html" filename="responsive-layouts.html">
{`<!-- Responsive grid that adapts to screen size -->
<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
  <div>Responsive item 1</div>
  <div>Responsive item 2</div>
  <div>Responsive item 3</div>
</div>

<!-- Flexible layout with arbitrary values -->
<div class="grid grid-cols-[minmax(250px,1fr)] md:grid-cols-[minmax(300px,1fr)_2fr] lg:grid-cols-[300px_1fr_200px] gap-[clamp(1rem,4vw,3rem)]">
  <div>Sidebar</div>
  <div>Main content</div>
  <div class="hidden lg:block">Extra sidebar</div>
</div>`}
        </CodeBlock>

        <h3 id="centering">Perfect Centering</h3>
        <CodeBlock language="html" filename="centering.html">
{`<!-- Perfect center with flexbox -->
<div class="flex items-center justify-center h-screen">
  <div>Perfectly centered</div>
</div>

<!-- Perfect center with grid -->
<div class="grid place-items-center h-screen">
  <div>Perfectly centered</div>
</div>

<!-- Safe centering to prevent overflow -->
<div class="flex items-center-safe justify-center-safe h-screen">
  <div>Safely centered</div>
</div>`}
        </CodeBlock>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>💡 Pro Tip:</strong> All layout utilities support custom properties and arbitrary values. 
                You can use CSS functions like <code>clamp()</code>, <code>minmax()</code>, <code>calc()</code> 
                directly in class names and they'll work in real-time without any build step!
              </p>
            </div>
          </div>
        </div>
      </div>
    </DocsLayout>
  )
}