import DocsLayout from '@/components/DocsLayout'
import CodeBlock from '@/components/CodeBlock'

export default function EffectsUtilities() {
  return (
    <DocsLayout>
      <div className="prose prose-lg max-w-none">
        <h1 id="effects-utilities">Effects & Filters</h1>
        
        <p>
          Barocss provides comprehensive effects and filters utilities including shadows, rings, filters, 
          backdrop filters, opacity, and blend modes. All effects support real-time generation, 
          arbitrary values, and OKLCH color integration.
        </p>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>✨ Real-time Effects:</strong> Unlike other frameworks that require build-time processing 
                for complex effects, BAROCSS generates filters like <code>blur-[15px]</code>, 
                <code>shadow-[0_25px_50px_rgba(0,0,0,0.25)]</code> instantly when classes are detected!
              </p>
            </div>
          </div>
        </div>

        <h2 id="box-shadows">Box Shadows</h2>

        <h3 id="shadow-levels">Shadow Levels</h3>
        <CodeBlock language="html" filename="shadow-levels.html">
{`<!-- Predefined shadow levels -->
<div class="shadow-2xs">2xs shadow</div>
<div class="shadow-xs">XS shadow</div>
<div class="shadow-sm">Small shadow</div>
<div class="shadow">Default shadow</div>
<div class="shadow-md">Medium shadow</div>
<div class="shadow-lg">Large shadow</div>
<div class="shadow-xl">XL shadow</div>
<div class="shadow-2xl">2XL shadow</div>
<div class="shadow-none">No shadow</div>

<!-- Arbitrary shadows - real-time! -->
<div class="shadow-[0_4px_6px_rgba(0,0,0,0.1)]">Custom shadow</div>
<div class="shadow-[0_25px_50px_rgba(0,0,0,0.25)]">Large custom shadow</div>
<div class="shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)]">Inset shadow</div>`}
        </CodeBlock>

        <h3 id="shadow-colors">Shadow Colors</h3>
        <CodeBlock language="html" filename="shadow-colors.html">
{`<!-- Theme shadow colors -->
<div class="shadow-lg shadow-blue-500">Blue shadow</div>
<div class="shadow-lg shadow-red-500">Red shadow</div>
<div class="shadow-lg shadow-purple-500">Purple shadow</div>

<!-- With opacity -->
<div class="shadow-lg shadow-blue-500/50">50% blue shadow</div>
<div class="shadow-lg shadow-red-500/25">25% red shadow</div>

<!-- Arbitrary shadow colors - real-time! -->
<div class="shadow-lg shadow-[#ff6b6b]">Hex shadow color</div>
<div class="shadow-lg shadow-[oklch(0.7_0.15_180)]">OKLCH shadow</div>

<!-- Special colors -->
<div class="shadow-lg shadow-inherit">Inherited shadow</div>
<div class="shadow-lg shadow-current">Current color shadow</div>
<div class="shadow-lg shadow-transparent">Transparent shadow</div>`}
        </CodeBlock>

        <h3 id="inset-shadows">Inset Shadows</h3>
        <CodeBlock language="html" filename="inset-shadows.html">
{`<!-- Inset shadow levels -->
<div class="inset-shadow-2xs">2xs inset shadow</div>
<div class="inset-shadow-xs">XS inset shadow</div>
<div class="inset-shadow-sm">Small inset shadow</div>
<div class="inset-shadow-md">Medium inset shadow</div>
<div class="inset-shadow-lg">Large inset shadow</div>
<div class="inset-shadow-xl">XL inset shadow</div>
<div class="inset-shadow-2xl">2XL inset shadow</div>
<div class="inset-shadow-none">No inset shadow</div>

<!-- Inset shadow colors -->
<div class="inset-shadow-lg inset-shadow-blue-500">Blue inset shadow</div>
<div class="inset-shadow-lg inset-shadow-red-500/30">30% red inset shadow</div>

<!-- Arbitrary inset shadows - real-time! -->
<div class="inset-shadow-[inset_0_2px_8px_rgba(0,0,0,0.2)]">
  Custom inset shadow
</div>`}
        </CodeBlock>

        <h2 id="rings">Rings</h2>

        <h3 id="ring-width">Ring Width</h3>
        <CodeBlock language="html" filename="ring-width.html">
{`<!-- Ring widths -->
<div class="ring-0">No ring</div>
<div class="ring-1">1px ring</div>
<div class="ring">Default ring (1px)</div>
<div class="ring-2">2px ring</div>
<div class="ring-4">4px ring</div>
<div class="ring-8">8px ring</div>

<!-- Inset rings -->
<div class="inset-ring-0">No inset ring</div>
<div class="inset-ring-1">1px inset ring</div>
<div class="inset-ring">Default inset ring</div>
<div class="inset-ring-2">2px inset ring</div>
<div class="inset-ring-4">4px inset ring</div>
<div class="inset-ring-8">8px inset ring</div>

<!-- Ring inset modifier -->
<div class="ring-2 ring-inset">Inset ring</div>

<!-- Arbitrary ring widths - real-time! -->
<div class="ring-[3px]">3px ring</div>
<div class="ring-[0.5rem]">0.5rem ring</div>`}
        </CodeBlock>

        <h3 id="ring-colors">Ring Colors</h3>
        <CodeBlock language="html" filename="ring-colors.html">
{`<!-- Theme ring colors -->
<div class="ring-2 ring-blue-500">Blue ring</div>
<div class="ring-2 ring-red-500">Red ring</div>
<div class="ring-2 ring-green-500">Green ring</div>

<!-- Ring colors with opacity -->
<div class="ring-2 ring-blue-500/50">50% blue ring</div>
<div class="ring-2 ring-red-500/25">25% red ring</div>

<!-- Arbitrary ring colors - real-time! -->
<div class="ring-2 ring-[#ff6b6b]">Hex ring color</div>
<div class="ring-2 ring-[oklch(0.6_0.2_240)]">OKLCH ring</div>

<!-- Special ring colors -->
<div class="ring-2 ring-inherit">Inherited ring</div>
<div class="ring-2 ring-current">Current color ring</div>
<div class="ring-2 ring-transparent">Transparent ring</div>

<!-- Inset ring colors -->
<div class="inset-ring-2 inset-ring-blue-500">Blue inset ring</div>
<div class="inset-ring-2 inset-ring-red-500/40">40% red inset ring</div>`}
        </CodeBlock>

        <h2 id="filters">Filters</h2>

        <h3 id="blur">Blur</h3>
        <CodeBlock language="html" filename="blur.html">
{`<!-- Predefined blur values -->
<div class="blur-none">No blur</div>
<div class="blur-xs">XS blur</div>
<div class="blur-sm">Small blur</div>
<div class="blur-md">Medium blur</div>
<div class="blur-lg">Large blur</div>
<div class="blur-xl">XL blur</div>
<div class="blur-2xl">2XL blur</div>
<div class="blur-3xl">3XL blur</div>

<!-- Arbitrary blur values - real-time! -->
<div class="blur-[2px]">2px blur</div>
<div class="blur-[0.5rem]">0.5rem blur</div>
<div class="blur-[15px]">15px blur</div>`}
        </CodeBlock>

        <h3 id="brightness">Brightness</h3>
        <CodeBlock language="html" filename="brightness.html">
{`<!-- Brightness values -->
<img class="brightness-0 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/4f46e5/ffffff?text=Image" alt="0% brightness">
<img class="brightness-50 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/4f46e5/ffffff?text=Image" alt="50% brightness">
<img class="brightness-75 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/4f46e5/ffffff?text=Image" alt="75% brightness">
<img class="brightness-100 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/4f46e5/ffffff?text=Image" alt="100% brightness">
<img class="brightness-125 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/4f46e5/ffffff?text=Image" alt="125% brightness">
<img class="brightness-150 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/4f46e5/ffffff?text=Image" alt="150% brightness">
<img class="brightness-200 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/4f46e5/ffffff?text=Image" alt="200% brightness">

<!-- Arbitrary brightness - real-time! -->
<img class="brightness-[85] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/4f46e5/ffffff?text=Image" alt="85% brightness">
<img class="brightness-[1.25] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/4f46e5/ffffff?text=Image" alt="125% brightness">
<img class="brightness-[var(--my-brightness)] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/4f46e5/ffffff?text=Image" alt="Custom brightness">`}
        </CodeBlock>

        <h3 id="contrast">Contrast</h3>
        <CodeBlock language="html" filename="contrast.html">
{`<!-- Contrast values -->
<img class="contrast-0 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/10b981/ffffff?text=Contrast" alt="0% contrast">
<img class="contrast-50 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/10b981/ffffff?text=Contrast" alt="50% contrast">
<img class="contrast-75 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/10b981/ffffff?text=Contrast" alt="75% contrast">
<img class="contrast-100 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/10b981/ffffff?text=Contrast" alt="100% contrast">
<img class="contrast-125 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/10b981/ffffff?text=Contrast" alt="125% contrast">
<img class="contrast-150 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/10b981/ffffff?text=Contrast" alt="150% contrast">
<img class="contrast-200 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/10b981/ffffff?text=Contrast" alt="200% contrast">

<!-- Arbitrary contrast - real-time! -->
<img class="contrast-[110] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/10b981/ffffff?text=Contrast" alt="110% contrast">
<img class="contrast-[1.3] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/10b981/ffffff?text=Contrast" alt="130% contrast">`}
        </CodeBlock>

        <h3 id="grayscale">Grayscale</h3>
        <CodeBlock language="html" filename="grayscale.html">
{`<!-- Grayscale filter -->
<img class="grayscale-0 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/f59e0b/ffffff?text=Color" alt="No grayscale">
<img class="grayscale w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/f59e0b/ffffff?text=Color" alt="Full grayscale">

<!-- Arbitrary grayscale - real-time! -->
<img class="grayscale-[50] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/f59e0b/ffffff?text=Color" alt="50% grayscale">
<img class="grayscale-[0.75] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/f59e0b/ffffff?text=Color" alt="75% grayscale">`}
        </CodeBlock>

        <h3 id="hue-rotate">Hue Rotate</h3>
        <CodeBlock language="html" filename="hue-rotate.html">
{`<!-- Hue rotation -->
<img class="hue-rotate-0 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/dc2626/ffffff?text=Hue" alt="No rotation">
<img class="hue-rotate-15 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/dc2626/ffffff?text=Hue" alt="15 degree rotation">
<img class="hue-rotate-30 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/dc2626/ffffff?text=Hue" alt="30 degree rotation">
<img class="hue-rotate-60 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/dc2626/ffffff?text=Hue" alt="60 degree rotation">
<img class="hue-rotate-90 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/dc2626/ffffff?text=Hue" alt="90 degree rotation">
<img class="hue-rotate-180 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/dc2626/ffffff?text=Hue" alt="180 degree rotation">

<!-- Negative rotation -->
<img class="-hue-rotate-15 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/dc2626/ffffff?text=Hue" alt="-15 degree rotation">
<img class="-hue-rotate-30 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/dc2626/ffffff?text=Hue" alt="-30 degree rotation">

<!-- Arbitrary hue rotation - real-time! -->
<img class="hue-rotate-[45] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/dc2626/ffffff?text=Hue" alt="45 degree rotation">
<img class="hue-rotate-[270] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/dc2626/ffffff?text=Hue" alt="270 degree rotation">`}
        </CodeBlock>

        <h3 id="invert">Invert</h3>
        <CodeBlock language="html" filename="invert.html">
{`<!-- Invert filter -->
<img class="invert-0 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/6366f1/ffffff?text=Invert" alt="No invert">
<img class="invert w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/6366f1/ffffff?text=Invert" alt="Full invert">

<!-- Arbitrary invert - real-time! -->
<img class="invert-[50] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/6366f1/ffffff?text=Invert" alt="50% invert">
<img class="invert-[0.75] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/6366f1/ffffff?text=Invert" alt="75% invert">`}
        </CodeBlock>

        <h3 id="saturate">Saturate</h3>
        <CodeBlock language="html" filename="saturate.html">
{`<!-- Saturation values -->
<img class="saturate-0 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/8b5cf6/ffffff?text=Saturate" alt="0% saturation">
<img class="saturate-50 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/8b5cf6/ffffff?text=Saturate" alt="50% saturation">
<img class="saturate-100 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/8b5cf6/ffffff?text=Saturate" alt="100% saturation">
<img class="saturate-150 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/8b5cf6/ffffff?text=Saturate" alt="150% saturation">
<img class="saturate-200 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/8b5cf6/ffffff?text=Saturate" alt="200% saturation">

<!-- Arbitrary saturation - real-time! -->
<img class="saturate-[80] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/8b5cf6/ffffff?text=Saturate" alt="80% saturation">
<img class="saturate-[1.25] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/8b5cf6/ffffff?text=Saturate" alt="125% saturation">`}
        </CodeBlock>

        <h3 id="sepia">Sepia</h3>
        <CodeBlock language="html" filename="sepia.html">
{`<!-- Sepia filter -->
<img class="sepia-0 w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/d97706/ffffff?text=Sepia" alt="No sepia">
<img class="sepia w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/d97706/ffffff?text=Sepia" alt="Full sepia">

<!-- Arbitrary sepia - real-time! -->
<img class="sepia-[60] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/d97706/ffffff?text=Sepia" alt="60% sepia">
<img class="sepia-[0.8] w-32 h-32 object-cover rounded" src="https://via.placeholder.com/200x200/d97706/ffffff?text=Sepia" alt="80% sepia">`}
        </CodeBlock>

        <h3 id="drop-shadow">Drop Shadow</h3>
        <CodeBlock language="html" filename="drop-shadow.html">
{`<!-- Drop shadow levels -->
<div class="drop-shadow-xs">XS drop shadow</div>
<div class="drop-shadow-sm">Small drop shadow</div>
<div class="drop-shadow-md">Medium drop shadow</div>
<div class="drop-shadow-lg">Large drop shadow</div>
<div class="drop-shadow-xl">XL drop shadow</div>
<div class="drop-shadow-2xl">2XL drop shadow</div>
<div class="drop-shadow-3xl">3XL drop shadow</div>
<div class="drop-shadow-none">No drop shadow</div>

<!-- Drop shadow colors -->
<div class="drop-shadow-lg drop-shadow-blue-500">Blue drop shadow</div>
<div class="drop-shadow-lg drop-shadow-red-500">Red drop shadow</div>

<!-- Arbitrary drop shadows - real-time! -->
<div class="drop-shadow-[0_4px_8px_rgba(0,0,0,0.25)]">
  Custom drop shadow
</div>
<div class="drop-shadow-[2px_2px_4px_#ff6b6b]">
  Colored drop shadow
</div>`}
        </CodeBlock>

        <h2 id="backdrop-filters">Backdrop Filters</h2>

        <h3 id="backdrop-blur">Backdrop Blur</h3>
        <CodeBlock language="html" filename="backdrop-blur.html">
{`<!-- Backdrop blur levels -->
<div class="backdrop-blur-none">No backdrop blur</div>
<div class="backdrop-blur-xs">XS backdrop blur</div>
<div class="backdrop-blur-sm">Small backdrop blur</div>
<div class="backdrop-blur-md">Medium backdrop blur</div>
<div class="backdrop-blur-lg">Large backdrop blur</div>
<div class="backdrop-blur-xl">XL backdrop blur</div>
<div class="backdrop-blur-2xl">2XL backdrop blur</div>
<div class="backdrop-blur-3xl">3XL backdrop blur</div>

<!-- Arbitrary backdrop blur - real-time! -->
<div class="backdrop-blur-[12px]">12px backdrop blur</div>
<div class="backdrop-blur-[0.75rem]">0.75rem backdrop blur</div>

<!-- Glass effect example -->
<div class="bg-white/20 backdrop-blur-md border border-white/30 rounded-lg p-6">
  Glass morphism effect
</div>`}
        </CodeBlock>

        <h3 id="backdrop-effects">Other Backdrop Effects</h3>
        <CodeBlock language="html" filename="backdrop-effects.html">
{`<!-- Backdrop brightness -->
<div class="backdrop-brightness-50">50% backdrop brightness</div>
<div class="backdrop-brightness-125">125% backdrop brightness</div>
<div class="backdrop-brightness-[110]">110% backdrop brightness</div>

<!-- Backdrop contrast -->
<div class="backdrop-contrast-75">75% backdrop contrast</div>
<div class="backdrop-contrast-150">150% backdrop contrast</div>
<div class="backdrop-contrast-[120]">120% backdrop contrast</div>

<!-- Backdrop grayscale -->
<div class="backdrop-grayscale">Full backdrop grayscale</div>
<div class="backdrop-grayscale-[60]">60% backdrop grayscale</div>

<!-- Backdrop hue rotate -->
<div class="backdrop-hue-rotate-15">15° backdrop hue rotate</div>
<div class="backdrop-hue-rotate-[45]">45° backdrop hue rotate</div>

<!-- Backdrop invert -->
<div class="backdrop-invert">Full backdrop invert</div>
<div class="backdrop-invert-[30]">30% backdrop invert</div>

<!-- Backdrop saturate -->
<div class="backdrop-saturate-150">150% backdrop saturate</div>
<div class="backdrop-saturate-[80]">80% backdrop saturate</div>

<!-- Backdrop sepia -->
<div class="backdrop-sepia">Full backdrop sepia</div>
<div class="backdrop-sepia-[40]">40% backdrop sepia</div>`}
        </CodeBlock>

        <h2 id="opacity">Opacity</h2>
        <CodeBlock language="html" filename="opacity.html">
{`<!-- Percentage opacity -->
<div class="opacity-0">0% opacity (invisible)</div>
<div class="opacity-25">25% opacity</div>
<div class="opacity-50">50% opacity</div>
<div class="opacity-75">75% opacity</div>
<div class="opacity-100">100% opacity (default)</div>

<!-- Arbitrary opacity - real-time! -->
<div class="opacity-[0.15]">15% opacity</div>
<div class="opacity-[0.85]">85% opacity</div>
<div class="opacity-[var(--my-opacity)]">Custom property opacity</div>`}
        </CodeBlock>

        <h2 id="blend-modes">Blend Modes</h2>

        <h3 id="mix-blend-mode">Mix Blend Mode</h3>
        <CodeBlock language="html" filename="mix-blend-mode.html">
{`<!-- Basic blend modes -->
<div class="mix-blend-normal">Normal blend</div>
<div class="mix-blend-multiply">Multiply blend</div>
<div class="mix-blend-screen">Screen blend</div>
<div class="mix-blend-overlay">Overlay blend</div>
<div class="mix-blend-darken">Darken blend</div>
<div class="mix-blend-lighten">Lighten blend</div>

<!-- Creative blend modes -->
<div class="mix-blend-color-dodge">Color dodge</div>
<div class="mix-blend-color-burn">Color burn</div>
<div class="mix-blend-hard-light">Hard light</div>
<div class="mix-blend-soft-light">Soft light</div>
<div class="mix-blend-difference">Difference</div>
<div class="mix-blend-exclusion">Exclusion</div>

<!-- Color blend modes -->
<div class="mix-blend-hue">Hue blend</div>
<div class="mix-blend-saturation">Saturation blend</div>
<div class="mix-blend-color">Color blend</div>
<div class="mix-blend-luminosity">Luminosity blend</div>

<!-- Advanced blend modes -->
<div class="mix-blend-plus-darker">Plus darker</div>
<div class="mix-blend-plus-lighter">Plus lighter</div>`}
        </CodeBlock>

        <h3 id="background-blend-mode">Background Blend Mode</h3>
        <CodeBlock language="html" filename="background-blend-mode.html">
{`<!-- Background blend modes -->
<div class="bg-linear-to-r from-red-500 to-blue-500 bg-blend-normal">
  Normal background blend
</div>
<div class="bg-linear-to-r from-red-500 to-blue-500 bg-blend-multiply">
  Multiply background blend
</div>
<div class="bg-linear-to-r from-red-500 to-blue-500 bg-blend-screen">
  Screen background blend
</div>
<div class="bg-linear-to-r from-red-500 to-blue-500 bg-blend-overlay">
  Overlay background blend
</div>
<div class="bg-linear-to-r from-red-500 to-blue-500 bg-blend-difference">
  Difference background blend
</div>`}
        </CodeBlock>

        <h2 id="mask-utilities">Mask Utilities</h2>

        <h3 id="mask-properties">Mask Properties</h3>
        <CodeBlock language="html" filename="mask-properties.html">
{`<!-- Mask clip -->
<div class="mask-clip-border">Border box mask</div>
<div class="mask-clip-padding">Padding box mask</div>
<div class="mask-clip-content">Content box mask</div>
<div class="mask-no-clip">No clip mask</div>

<!-- Mask composite -->
<div class="mask-add">Add composite</div>
<div class="mask-subtract">Subtract composite</div>
<div class="mask-intersect">Intersect composite</div>
<div class="mask-exclude">Exclude composite</div>

<!-- Mask mode -->
<div class="mask-alpha">Alpha mask</div>
<div class="mask-luminance">Luminance mask</div>
<div class="mask-match">Match source mask</div>

<!-- Mask position -->
<div class="mask-top">Top mask position</div>
<div class="mask-center">Center mask position</div>
<div class="mask-bottom">Bottom mask position</div>
<div class="mask-position-[25%_75%]">Custom mask position</div>

<!-- Mask repeat -->
<div class="mask-repeat">Repeat mask</div>
<div class="mask-no-repeat">No repeat mask</div>
<div class="mask-repeat-x">Repeat X mask</div>
<div class="mask-repeat-y">Repeat Y mask</div>

<!-- Mask size -->
<div class="mask-auto">Auto mask size</div>
<div class="mask-cover">Cover mask size</div>
<div class="mask-contain">Contain mask size</div>
<div class="mask-size-[200px_100px]">Custom mask size</div>

<!-- Mask examples -->
<div class="bg-blue-500 text-white p-4 rounded w-32 h-16">
  SVG mask example
</div>
<div class="bg-red-500 text-white p-4 rounded w-32 h-16">
  Gradient mask example
</div>`}
        </CodeBlock>

        <div className="bg-green-50 border-l-4 border-green-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-green-700">
                <strong>🎨 Performance Note:</strong> All filter and effect utilities are generated in real-time. 
                Complex filters like <code>backdrop-blur-[25px]</code> combined with 
                <code>backdrop-saturate-[1.8]</code> work instantly without any build-time processing, 
                enabling rapid prototyping of visual effects.
              </p>
            </div>
          </div>
        </div>

        <h2 id="combining-effects">Combining Effects</h2>
        <CodeBlock language="html" filename="combining-effects.html">
{`<!-- Glass morphism card -->
<div class="bg-white/10 backdrop-blur-md backdrop-saturate-150 border border-white/20 rounded-2xl p-6 shadow-2xl">
  <h3 class="text-white font-semibold">Glass Morphism Card</h3>
  <p class="text-white/80">Beautiful glass effect with backdrop filters</p>
</div>

<!-- Glowing button -->
<button class="bg-blue-500 text-white px-6 py-3 rounded-lg shadow-lg shadow-blue-500/50 hover:shadow-xl hover:shadow-blue-500/75 transition-all duration-300">
  Glowing Button
</button>

<!-- Image with multiple filters -->
<img class="blur-[0.5px] brightness-110 contrast-105 saturate-110 rounded-lg shadow-lg w-64 h-48 object-cover" 
     src="https://via.placeholder.com/400x300/3b82f6/ffffff?text=Enhanced+Photo" 
     alt="Enhanced photo">

<!-- Complex backdrop filter overlay -->
<div class="fixed inset-0 bg-black/20 backdrop-blur-sm backdrop-brightness-75">
  <div class="flex items-center justify-center h-full">
    <div class="bg-white/90 backdrop-blur-lg rounded-3xl p-8 shadow-2xl ring-1 ring-black/5">
      Modal with backdrop effects
    </div>
  </div>
</div>

<!-- Artistic blend mode composition -->
<div class="relative w-64 h-48">
          <div class="absolute inset-0 bg-linear-to-r from-purple-500 to-pink-500 mix-blend-multiply"></div>
  <img class="relative z-10 w-full h-full object-cover rounded" src="https://via.placeholder.com/400x300/8b5cf6/ffffff?text=Artwork" alt="Artistic composition">
</div>`}
        </CodeBlock>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>💡 Pro Tip:</strong> Use custom properties for dynamic effects: 
                <code>blur-[var(--blur-amount)]</code>, <code>opacity-[var(--fade-level)]</code>. 
                You can then animate these properties with JavaScript or CSS animations for smooth transitions!
              </p>
            </div>
          </div>
        </div>
      </div>
    </DocsLayout>
  )
}