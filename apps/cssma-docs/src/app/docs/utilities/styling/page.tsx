import DocsLayout from '@/components/DocsLayout'
import CodeBlock from '@/components/CodeBlock'

export default function StylingUtilities() {
  return (
    <DocsLayout>
      <div className="prose prose-lg max-w-none">
        <h1 id="styling-utilities">Styling Utilities</h1>
        
        <p>
          CSSMA v4 provides comprehensive styling utilities for backgrounds, borders, typography, spacing, and sizing. 
          All utilities support real-time generation with OKLCH color support, arbitrary values, and custom properties.
        </p>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>🎨 Modern Colors:</strong> CSSMA v4 uses OKLCH color space by default for better color perception 
                and supports arbitrary color values like <code>bg-[#ff6b6b]</code>, <code>text-[oklch(0.7_0.15_180)]</code> 
                that work instantly without build-time processing!
              </p>
            </div>
          </div>
        </div>

        <h2 id="backgrounds">Backgrounds</h2>

        <h3 id="background-colors">Background Colors</h3>
        <CodeBlock language="html" filename="background-colors.html">
{`<!-- Theme colors -->
<div class="bg-primary">Primary background</div>
<div class="bg-secondary">Secondary background</div>
<div class="bg-gray-100">Gray background</div>

<!-- Special colors -->
<div class="bg-transparent">Transparent</div>
<div class="bg-current">Current color</div>
<div class="bg-inherit">Inherited</div>

<!-- Arbitrary colors - real-time! -->
<div class="bg-[#ff6b6b]">Hex color</div>
<div class="bg-[rgb(255,107,107)]">RGB color</div>
<div class="bg-[oklch(0.7_0.15_0)]">OKLCH color</div>
<div class="bg-[hsl(0,100%,71%)]">HSL color</div>

<!-- With opacity -->
<div class="bg-red-500/50">50% opacity</div>
<div class="bg-[#ff6b6b]/30">30% opacity arbitrary</div>`}
        </CodeBlock>

        <h3 id="gradients">Gradients</h3>
        <CodeBlock language="html" filename="gradients.html">
{`<!-- Linear gradients -->
<div class="bg-linear-to-r from-blue-500 to-purple-500">
  Linear gradient right
</div>
<div class="bg-linear-to-br from-pink-500 via-red-500 to-yellow-500">
  Linear with via color
</div>

<!-- Angle-based gradients -->
<div class="bg-linear-45 from-green-400 to-blue-500">
  45 degree gradient
</div>
<div class="bg-linear-[135deg] from-purple-400 to-pink-400">
  Custom angle gradient
</div>

<!-- Radial gradients -->
<div class="bg-radial from-yellow-400 to-red-500">
  Radial gradient
</div>
<div class="bg-radial-[at_top_left] from-blue-400 to-purple-500">
  Positioned radial
</div>

<!-- Conic gradients -->
<div class="bg-conic from-red-500 via-yellow-500 to-blue-500">
  Conic gradient
</div>
<div class="bg-conic-[from_45deg] from-pink-500 to-violet-500">
  Rotated conic
</div>

<!-- Gradient stops with positions -->
<div class="bg-linear-to-r from-blue-500 from-10% via-purple-500 via-30% to-pink-500 to-90%">
  Positioned gradient stops
</div>

<!-- Complex arbitrary gradients - real-time! -->
<div class="bg-[linear-gradient(45deg,#ff6b6b_0%,#4ecdc4_50%,#45b7d1_100%)]">
  Complex arbitrary gradient
</div>`}
        </CodeBlock>

        <h3 id="background-properties">Background Properties</h3>
        <CodeBlock language="html" filename="background-properties.html">
{`<!-- Background size -->
<div class="bg-cover">Cover</div>
<div class="bg-contain">Contain</div>
<div class="bg-auto">Auto</div>
<div class="bg-size-[200px_100px]">Custom size</div>

<!-- Background position -->
<div class="bg-center">Center</div>
<div class="bg-top-left">Top left</div>
<div class="bg-position-[25%_75%]">Custom position</div>

<!-- Background repeat -->
<div class="bg-repeat">Repeat</div>
<div class="bg-no-repeat">No repeat</div>
<div class="bg-repeat-x">Repeat X</div>
<div class="bg-repeat-y">Repeat Y</div>

<!-- Background attachment -->
<div class="bg-fixed">Fixed</div>
<div class="bg-local">Local</div>
<div class="bg-scroll">Scroll</div>

<!-- Background clip -->
<div class="bg-clip-border">Border box</div>
<div class="bg-clip-padding">Padding box</div>
<div class="bg-clip-content">Content box</div>
<div class="bg-clip-text text-transparent">Text clip</div>`}
        </CodeBlock>

        <h2 id="borders">Borders</h2>

        <h3 id="border-width">Border Width</h3>
        <CodeBlock language="html" filename="border-width.html">
{`<!-- Border width -->
<div class="border">Default border (1px)</div>
<div class="border-0">No border</div>
<div class="border-2">2px border</div>
<div class="border-4">4px border</div>
<div class="border-8">8px border</div>

<!-- Individual sides -->
<div class="border-t-2">Top border</div>
<div class="border-r-4">Right border</div>
<div class="border-b-2">Bottom border</div>
<div class="border-l-4">Left border</div>
<div class="border-x-2">Horizontal borders</div>
<div class="border-y-4">Vertical borders</div>

<!-- Arbitrary border width - real-time! -->
<div class="border-[3px]">3px border</div>
<div class="border-t-[5px]">5px top border</div>
<div class="border-[0.5rem]">0.5rem border</div>`}
        </CodeBlock>

        <h3 id="border-colors">Border Colors</h3>
        <CodeBlock language="html" filename="border-colors.html">
{`<!-- Theme border colors -->
<div class="border-2 border-primary">Primary border</div>
<div class="border-2 border-gray-300">Gray border</div>
<div class="border-2 border-red-500">Red border</div>

<!-- Special border colors -->
<div class="border-2 border-transparent">Transparent border</div>
<div class="border-2 border-current">Current color border</div>

<!-- Arbitrary border colors - real-time! -->
<div class="border-2 border-[#ff6b6b]">Hex border color</div>
<div class="border-2 border-[oklch(0.7_0.15_120)]">OKLCH border</div>

<!-- With opacity -->
<div class="border-2 border-red-500/50">50% opacity border</div>
<div class="border-2 border-[#ff6b6b]/30">30% opacity arbitrary</div>

<!-- Individual side colors -->
<div class="border-4 border-t-red-500 border-r-blue-500 border-b-green-500 border-l-yellow-500">
  Multi-colored borders
</div>`}
        </CodeBlock>

        <h3 id="border-style">Border Style</h3>
        <CodeBlock language="html" filename="border-style.html">
{`<!-- Border styles -->
<div class="border-2 border-solid">Solid border</div>
<div class="border-2 border-dashed">Dashed border</div>
<div class="border-2 border-dotted">Dotted border</div>
<div class="border-2 border-double">Double border</div>
<div class="border-2 border-hidden">Hidden border</div>
<div class="border-2 border-none">No border style</div>`}
        </CodeBlock>

        <h3 id="border-radius">Border Radius</h3>
        <CodeBlock language="html" filename="border-radius.html">
{`<!-- Basic radius -->
<div class="rounded-none">No radius</div>
<div class="rounded-sm">Small radius</div>
<div class="rounded">Default radius</div>
<div class="rounded-md">Medium radius</div>
<div class="rounded-lg">Large radius</div>
<div class="rounded-xl">Extra large radius</div>
<div class="rounded-2xl">2xl radius</div>
<div class="rounded-3xl">3xl radius</div>
<div class="rounded-full">Full radius (circle)</div>

<!-- Individual corners -->
<div class="rounded-t-lg">Top corners</div>
<div class="rounded-r-lg">Right corners</div>
<div class="rounded-b-lg">Bottom corners</div>
<div class="rounded-l-lg">Left corners</div>
<div class="rounded-tl-lg">Top-left corner</div>
<div class="rounded-tr-lg">Top-right corner</div>
<div class="rounded-br-lg">Bottom-right corner</div>
<div class="rounded-bl-lg">Bottom-left corner</div>

<!-- Arbitrary radius - real-time! -->
<div class="rounded-[25px]">25px radius</div>
<div class="rounded-[50%]">50% radius</div>
<div class="rounded-tl-[20px] rounded-br-[20px]">Diagonal corners</div>`}
        </CodeBlock>

        <h2 id="typography">Typography</h2>

        <h3 id="font-family">Font Family</h3>
        <CodeBlock language="html" filename="font-family.html">
{`<!-- Font families -->
<p class="font-sans">Sans-serif font</p>
<p class="font-serif">Serif font</p>
<p class="font-mono">Monospace font</p>

<!-- Arbitrary fonts - real-time! -->
<p class="font-['Inter']">Inter font</p>
<p class="font-['Helvetica_Neue',sans-serif]">Font stack</p>`}
        </CodeBlock>

        <h3 id="font-size">Font Size</h3>
        <CodeBlock language="html" filename="font-size.html">
{`<!-- Predefined sizes -->
<p class="text-xs">Extra small text</p>
<p class="text-sm">Small text</p>
<p class="text-base">Base text</p>
<p class="text-lg">Large text</p>
<p class="text-xl">Extra large text</p>
<p class="text-2xl">2xl text</p>
<p class="text-3xl">3xl text</p>
<p class="text-4xl">4xl text</p>

<!-- Arbitrary sizes - real-time! -->
<p class="text-[14px]">14px text</p>
<p class="text-[1.125rem]">1.125rem text</p>
<p class="text-[clamp(1rem,4vw,2rem)]">Responsive text</p>`}
        </CodeBlock>

        <h3 id="font-weight">Font Weight</h3>
        <CodeBlock language="html" filename="font-weight.html">
{`<!-- Font weights -->
<p class="font-thin">Thin (100)</p>
<p class="font-extralight">Extra light (200)</p>
<p class="font-light">Light (300)</p>
<p class="font-normal">Normal (400)</p>
<p class="font-medium">Medium (500)</p>
<p class="font-semibold">Semibold (600)</p>
<p class="font-bold">Bold (700)</p>
<p class="font-extrabold">Extra bold (800)</p>
<p class="font-black">Black (900)</p>

<!-- Arbitrary weights - real-time! -->
<p class="font-[350]">Custom weight 350</p>
<p class="font-[550]">Custom weight 550</p>`}
        </CodeBlock>

        <h3 id="text-colors">Text Colors</h3>
        <CodeBlock language="html" filename="text-colors.html">
{`<!-- Theme text colors -->
<p class="text-primary">Primary text</p>
<p class="text-secondary">Secondary text</p>
<p class="text-gray-900">Dark gray text</p>
<p class="text-gray-500">Medium gray text</p>

<!-- Special colors -->
<p class="text-transparent">Transparent text</p>
<p class="text-current">Current color text</p>
<p class="text-inherit">Inherited text</p>

<!-- Arbitrary colors - real-time! -->
<p class="text-[#ff6b6b]">Hex text color</p>
<p class="text-[oklch(0.5_0.2_180)]">OKLCH text</p>

<!-- With opacity -->
<p class="text-red-500/70">70% opacity text</p>
<p class="text-[#ff6b6b]/40">40% opacity arbitrary</p>`}
        </CodeBlock>

        <h3 id="text-alignment">Text Alignment</h3>
        <CodeBlock language="html" filename="text-alignment.html">
{`<!-- Text alignment -->
<p class="text-left">Left aligned</p>
<p class="text-center">Center aligned</p>
<p class="text-right">Right aligned</p>
<p class="text-justify">Justified text</p>
<p class="text-start">Start aligned</p>
<p class="text-end">End aligned</p>`}
        </CodeBlock>

        <h2 id="spacing">Spacing</h2>

        <h3 id="padding">Padding</h3>
        <CodeBlock language="html" filename="padding.html">
{`<!-- All sides -->
<div class="p-0">No padding</div>
<div class="p-1">0.25rem padding</div>
<div class="p-4">1rem padding</div>
<div class="p-8">2rem padding</div>

<!-- Individual sides -->
<div class="pt-4">Top padding</div>
<div class="pr-4">Right padding</div>
<div class="pb-4">Bottom padding</div>
<div class="pl-4">Left padding</div>
<div class="px-4">Horizontal padding</div>
<div class="py-4">Vertical padding</div>

<!-- Arbitrary padding - real-time! -->
<div class="p-[15px]">15px padding</div>
<div class="px-[2.5rem]">2.5rem horizontal</div>
<div class="pt-[calc(1rem+2vw)]">Dynamic top padding</div>`}
        </CodeBlock>

        <h3 id="margin">Margin</h3>
        <CodeBlock language="html" filename="margin.html">
{`<!-- All sides -->
<div class="m-0">No margin</div>
<div class="m-1">0.25rem margin</div>
<div class="m-4">1rem margin</div>
<div class="m-auto">Auto margin</div>

<!-- Individual sides -->
<div class="mt-4">Top margin</div>
<div class="mr-4">Right margin</div>
<div class="mb-4">Bottom margin</div>
<div class="ml-4">Left margin</div>
<div class="mx-4">Horizontal margin</div>
<div class="my-4">Vertical margin</div>

<!-- Negative margins -->
<div class="-m-4">Negative margin</div>
<div class="-mt-2">Negative top margin</div>
<div class="-mx-4">Negative horizontal</div>

<!-- Arbitrary margins - real-time! -->
<div class="m-[25px]">25px margin</div>
<div class="mx-[3.5rem]">3.5rem horizontal</div>
<div class="mt-[calc(2rem-1px)]">Calculated margin</div>`}
        </CodeBlock>

        <h2 id="sizing">Sizing</h2>

        <h3 id="width">Width</h3>
        <CodeBlock language="html" filename="width.html">
{`<!-- Percentage widths -->
<div class="w-full">100% width</div>
<div class="w-1/2">50% width</div>
<div class="w-1/3">33.333% width</div>
<div class="w-2/3">66.667% width</div>
<div class="w-1/4">25% width</div>
<div class="w-3/4">75% width</div>

<!-- Fixed widths -->
<div class="w-auto">Auto width</div>
<div class="w-fit">Fit content</div>
<div class="w-min">Min content</div>
<div class="w-max">Max content</div>

<!-- Viewport widths -->
<div class="w-screen">100vw width</div>

<!-- Arbitrary widths - real-time! -->
<div class="w-[200px]">200px width</div>
<div class="w-[75vw]">75vw width</div>
<div class="w-[calc(100%-2rem)]">Calculated width</div>
<div class="w-[min(100%,800px)]">Constrained width</div>`}
        </CodeBlock>

        <h3 id="height">Height</h3>
        <CodeBlock language="html" filename="height.html">
{`<!-- Percentage heights -->
<div class="h-full">100% height</div>
<div class="h-1/2">50% height</div>
<div class="h-1/3">33.333% height</div>

<!-- Fixed heights -->
<div class="h-auto">Auto height</div>
<div class="h-fit">Fit content</div>
<div class="h-min">Min content</div>
<div class="h-max">Max content</div>

<!-- Viewport heights -->
<div class="h-screen">100vh height</div>
<div class="h-svh">Small viewport height</div>
<div class="h-lvh">Large viewport height</div>
<div class="h-dvh">Dynamic viewport height</div>

<!-- Arbitrary heights - real-time! -->
<div class="h-[150px]">150px height</div>
<div class="h-[80vh]">80vh height</div>
<div class="h-[calc(100vh-4rem)]">Calculated height</div>`}
        </CodeBlock>

        <h3 id="min-max-sizes">Min & Max Sizes</h3>
        <CodeBlock language="html" filename="min-max-sizes.html">
{`<!-- Min width -->
<div class="min-w-0">Min width 0</div>
<div class="min-w-full">Min width 100%</div>
<div class="min-w-fit">Min width fit</div>
<div class="min-w-min">Min width min-content</div>
<div class="min-w-max">Min width max-content</div>
<div class="min-w-[200px]">Min width 200px</div>

<!-- Max width -->
<div class="max-w-none">No max width</div>
<div class="max-w-full">Max width 100%</div>
<div class="max-w-screen-sm">Max width 640px</div>
<div class="max-w-screen-md">Max width 768px</div>
<div class="max-w-screen-lg">Max width 1024px</div>
<div class="max-w-[500px]">Max width 500px</div>

<!-- Min height -->
<div class="min-h-0">Min height 0</div>
<div class="min-h-full">Min height 100%</div>
<div class="min-h-screen">Min height 100vh</div>
<div class="min-h-[300px]">Min height 300px</div>

<!-- Max height -->
<div class="max-h-full">Max height 100%</div>
<div class="max-h-screen">Max height 100vh</div>
<div class="max-h-[400px]">Max height 400px</div>`}
        </CodeBlock>

        <div className="bg-green-50 border-l-4 border-green-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-green-700">
                <strong>🎨 Design System Integration:</strong> All color utilities support theme integration 
                with custom properties. You can define your brand colors once and use them consistently 
                across backgrounds, borders, and text with real-time generation.
              </p>
            </div>
          </div>
        </div>

        <h2 id="best-practices">Best Practices</h2>

        <h3 id="consistent-spacing">Consistent Spacing</h3>
        <CodeBlock language="html" filename="consistent-spacing.html">
{`<!-- Use consistent spacing scale -->
<div class="space-y-4">
  <div class="p-4 border rounded-lg">Card 1</div>
  <div class="p-4 border rounded-lg">Card 2</div>
  <div class="p-4 border rounded-lg">Card 3</div>
</div>

<!-- Responsive spacing -->
<div class="p-4 md:p-6 lg:p-8">
  Responsive padding
</div>`}
        </CodeBlock>

        <h3 id="accessible-colors">Accessible Colors</h3>
        <CodeBlock language="html" filename="accessible-colors.html">
{`<!-- High contrast text -->
<div class="bg-gray-900 text-white">
  High contrast dark background
</div>
<div class="bg-gray-100 text-gray-900">
  High contrast light background
</div>

<!-- Focus states -->
<button class="bg-blue-500 text-white focus:bg-blue-600 focus:ring-2 focus:ring-blue-300">
  Accessible button
</button>`}
        </CodeBlock>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>💡 Pro Tip:</strong> Use arbitrary values with CSS functions for dynamic styling: 
                <code>w-[min(100%,800px)]</code>, <code>p-[clamp(1rem,4vw,3rem)]</code>, 
                <code>bg-[color-mix(in_oklch,var(--primary)_80%,white)]</code>. 
                These work in real-time without any build step!
              </p>
            </div>
          </div>
        </div>
      </div>
    </DocsLayout>
  )
}