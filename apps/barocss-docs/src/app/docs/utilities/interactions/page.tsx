import DocsLayout from '@/components/DocsLayout'
import CodeBlock from '@/components/CodeBlock'

export default function InteractionsUtilities() {
  return (
    <DocsLayout>
      <div className="prose prose-lg max-w-none">
        <h1 id="interactions-utilities">Interactions & Animations</h1>
        
        <p>
          Barocss provides comprehensive utilities for interactions, animations, transforms, and transitions. 
          All animation utilities support real-time generation, arbitrary values, and complex timing functions 
          that work instantly without build-time processing.
        </p>

        <div className="bg-blue-50 border-l-4 border-blue-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-blue-700">
                <strong>🎬 Real-time Animations:</strong> Unlike other frameworks, BAROCSS generates complex animations 
                like <code>transform-[rotate(45deg)_scale(1.2)_translateX(100px)]</code> and 
                <code>transition-[all_300ms_cubic-bezier(0.4,0,0.2,1)]</code> instantly when classes are detected!
              </p>
            </div>
          </div>
        </div>

        <h2 id="transforms">Transforms</h2>

        <h3 id="scale">Scale</h3>
        <CodeBlock language="html" filename="scale.html">
{`<!-- Uniform scaling -->
<div class="scale-0">0% scale (invisible)</div>
<div class="scale-50">50% scale</div>
<div class="scale-75">75% scale</div>
<div class="scale-90">90% scale</div>
<div class="scale-95">95% scale</div>
<div class="scale-100">100% scale (default)</div>
<div class="scale-105">105% scale</div>
<div class="scale-110">110% scale</div>
<div class="scale-125">125% scale</div>
<div class="scale-150">150% scale</div>

<!-- Individual axis scaling -->
<div class="scale-x-50">50% X scale</div>
<div class="scale-y-75">75% Y scale</div>
<div class="scale-x-110 scale-y-90">110% X, 90% Y scale</div>

<!-- Arbitrary scaling - real-time! -->
<div class="scale-[0.85]">85% scale</div>
<div class="scale-x-[1.15]">115% X scale</div>
<div class="scale-y-[0.6]">60% Y scale</div>
<div class="scale-[var(--dynamic-scale)]">Dynamic scale</div>`}
        </CodeBlock>

        <h3 id="rotate">Rotate</h3>
        <CodeBlock language="html" filename="rotate.html">
{`<!-- Predefined rotations -->
<div class="rotate-0">0° rotation</div>
<div class="rotate-1">1° rotation</div>
<div class="rotate-2">2° rotation</div>
<div class="rotate-3">3° rotation</div>
<div class="rotate-6">6° rotation</div>
<div class="rotate-12">12° rotation</div>
<div class="rotate-45">45° rotation</div>
<div class="rotate-90">90° rotation</div>
<div class="rotate-180">180° rotation</div>

<!-- Negative rotations -->
<div class="-rotate-1">-1° rotation</div>
<div class="-rotate-45">-45° rotation</div>
<div class="-rotate-90">-90° rotation</div>

<!-- Arbitrary rotations - real-time! -->
<div class="rotate-[17deg]">17° rotation</div>
<div class="rotate-[30deg]">30° rotation</div>
<div class="rotate-[-15deg]">-15° rotation</div>
<div class="rotate-[1.5turn]">1.5 turn rotation</div>
<div class="rotate-[200grad]">200 grad rotation</div>`}
        </CodeBlock>

        <h3 id="translate">Translate</h3>
        <CodeBlock language="html" filename="translate.html">
{`<!-- X-axis translation -->
<div class="translate-x-0">No X translation</div>
<div class="translate-x-1">0.25rem X translation</div>
<div class="translate-x-4">1rem X translation</div>
<div class="translate-x-8">2rem X translation</div>
<div class="translate-x-1/2">50% X translation</div>
<div class="translate-x-full">100% X translation</div>

<!-- Y-axis translation -->
<div class="translate-y-0">No Y translation</div>
<div class="translate-y-1">0.25rem Y translation</div>
<div class="translate-y-4">1rem Y translation</div>
<div class="translate-y-8">2rem Y translation</div>
<div class="translate-y-1/2">50% Y translation</div>
<div class="translate-y-full">100% Y translation</div>

<!-- Combined translation -->
<div class="translate-x-4 translate-y-8">X and Y translation</div>

<!-- Negative translations -->
<div class="-translate-x-4">Negative X translation</div>
<div class="-translate-y-8">Negative Y translation</div>

<!-- Arbitrary translations - real-time! -->
<div class="translate-x-[15px]">15px X translation</div>
<div class="translate-y-[2.5rem]">2.5rem Y translation</div>
<div class="translate-x-[calc(50%+10px)]">Calculated X translation</div>
<div class="translate-y-[var(--offset)]">Dynamic Y translation</div>`}
        </CodeBlock>

        <h3 id="skew">Skew</h3>
        <CodeBlock language="html" filename="skew.html">
{`<!-- X-axis skew -->
<div class="skew-x-0">No X skew</div>
<div class="skew-x-1">1° X skew</div>
<div class="skew-x-2">2° X skew</div>
<div class="skew-x-3">3° X skew</div>
<div class="skew-x-6">6° X skew</div>
<div class="skew-x-12">12° X skew</div>

<!-- Y-axis skew -->
<div class="skew-y-0">No Y skew</div>
<div class="skew-y-1">1° Y skew</div>
<div class="skew-y-2">2° Y skew</div>
<div class="skew-y-3">3° Y skew</div>
<div class="skew-y-6">6° Y skew</div>
<div class="skew-y-12">12° Y skew</div>

<!-- Negative skew -->
<div class="-skew-x-6">-6° X skew</div>
<div class="-skew-y-3">-3° Y skew</div>

<!-- Arbitrary skew - real-time! -->
<div class="skew-x-[8deg]">8° X skew</div>
<div class="skew-y-[4deg]">4° Y skew</div>
<div class="skew-x-[-10deg]">-10° X skew</div>`}
        </CodeBlock>

        <h3 id="transform-origin">Transform Origin</h3>
        <CodeBlock language="html" filename="transform-origin.html">
{`<!-- Predefined origins -->
<div class="origin-center">Center origin</div>
<div class="origin-top">Top origin</div>
<div class="origin-top-right">Top right origin</div>
<div class="origin-right">Right origin</div>
<div class="origin-bottom-right">Bottom right origin</div>
<div class="origin-bottom">Bottom origin</div>
<div class="origin-bottom-left">Bottom left origin</div>
<div class="origin-left">Left origin</div>
<div class="origin-top-left">Top left origin</div>

<!-- Arbitrary origins - real-time! -->
<div class="origin-[25%_75%]">25% 75% origin</div>
<div class="origin-[10px_20px]">10px 20px origin</div>
<div class="origin-[left_10px]">Left 10px origin</div>`}
        </CodeBlock>

        <h3 id="complex-transforms">Complex Transforms</h3>
        <CodeBlock language="html" filename="complex-transforms.html">
{`<!-- Multiple transforms combined -->
<div class="rotate-45 scale-110 translate-x-4">
  Rotate + scale + translate
</div>

<!-- 3D transforms -->
<div class="transform-[rotateX(45deg)]">X-axis 3D rotation</div>
<div class="transform-[rotateY(45deg)]">Y-axis 3D rotation</div>
<div class="transform-[rotateZ(45deg)]">Z-axis 3D rotation</div>
<div class="transform-[rotateX(30deg)_rotateY(45deg)]">
  Combined 3D rotations
</div>

<!-- Perspective -->
<div class="transform-[perspective(1000px)]">
  Perspective container
</div>

<!-- Complex arbitrary transforms - real-time! -->
<div class="transform-[rotate(30deg)_scale(1.2)_translateX(50px)_skewX(10deg)]">
  Complex combined transform
</div>
<div class="transform-[matrix3d(1,0,0,0,0,1,0,0,0,0,1,0,50,100,0,1)]">
  Matrix3D transform
</div>`}
        </CodeBlock>

        <h2 id="transitions">Transitions</h2>

        <h3 id="transition-property">Transition Property</h3>
        <CodeBlock language="html" filename="transition-property.html">
{`<!-- Predefined transition properties -->
<div class="transition-none">No transition</div>
<div class="transition-all">All properties</div>
<div class="transition">Default transition (all)</div>
<div class="transition-colors">Color properties</div>
<div class="transition-opacity">Opacity only</div>
<div class="transition-shadow">Shadow properties</div>
<div class="transition-transform">Transform only</div>

<!-- Arbitrary properties - real-time! -->
<div class="transition-[width]">Width only</div>
<div class="transition-[height,width]">Height and width</div>
<div class="transition-[background-color,border-color]">
  Background and border colors
</div>
<div class="transition-[var(--custom-property)]">
  Custom property transition
</div>`}
        </CodeBlock>

        <h3 id="transition-duration">Transition Duration</h3>
        <CodeBlock language="html" filename="transition-duration.html">
{`<!-- Predefined durations -->
<div class="duration-0">0ms duration</div>
<div class="duration-75">75ms duration</div>
<div class="duration-100">100ms duration</div>
<div class="duration-150">150ms duration</div>
<div class="duration-200">200ms duration</div>
<div class="duration-300">300ms duration</div>
<div class="duration-500">500ms duration</div>
<div class="duration-700">700ms duration</div>
<div class="duration-1000">1000ms duration</div>

<!-- Arbitrary durations - real-time! -->
<div class="duration-[250ms]">250ms duration</div>
<div class="duration-[0.4s]">0.4s duration</div>
<div class="duration-[var(--animation-duration)]">
  Dynamic duration
</div>`}
        </CodeBlock>

        <h3 id="transition-timing">Transition Timing Function</h3>
        <CodeBlock language="html" filename="transition-timing.html">
{`<!-- Predefined timing functions -->
<div class="ease-linear">Linear timing</div>
<div class="ease-in">Ease in</div>
<div class="ease-out">Ease out</div>
<div class="ease-in-out">Ease in-out</div>

<!-- Arbitrary timing functions - real-time! -->
<div class="ease-[cubic-bezier(0.4,0,0.2,1)]">
  Custom cubic-bezier
</div>
<div class="ease-[steps(4,end)]">
  Steps timing function
</div>
<div class="ease-[var(--custom-easing)]">
  Dynamic timing function
</div>`}
        </CodeBlock>

        <h3 id="transition-delay">Transition Delay</h3>
        <CodeBlock language="html" filename="transition-delay.html">
{`<!-- Predefined delays -->
<div class="delay-0">No delay</div>
<div class="delay-75">75ms delay</div>
<div class="delay-100">100ms delay</div>
<div class="delay-150">150ms delay</div>
<div class="delay-200">200ms delay</div>
<div class="delay-300">300ms delay</div>
<div class="delay-500">500ms delay</div>
<div class="delay-700">700ms delay</div>
<div class="delay-1000">1000ms delay</div>

<!-- Arbitrary delays - real-time! -->
<div class="delay-[125ms]">125ms delay</div>
<div class="delay-[0.6s]">0.6s delay</div>
<div class="delay-[var(--stagger-delay)]">
  Dynamic delay
</div>`}
        </CodeBlock>

        <h2 id="animations">Animations</h2>

        <h3 id="predefined-animations">Predefined Animations</h3>
        <CodeBlock language="html" filename="predefined-animations.html">
{`<!-- Built-in animations -->
<div class="animate-none">No animation</div>
<div class="animate-spin">Spin animation</div>
<div class="animate-ping">Ping animation</div>
<div class="animate-pulse">Pulse animation</div>
<div class="animate-bounce">Bounce animation</div>

<!-- Animation examples -->
<div class="w-8 h-8 bg-blue-500 rounded-full animate-spin">
  Spinning circle
</div>
<div class="w-4 h-4 bg-red-500 rounded-full animate-ping">
  Pinging dot
</div>
<div class="w-16 h-4 bg-gray-300 rounded animate-pulse">
  Pulsing skeleton
</div>
<div class="w-8 h-8 bg-purple-500 rounded animate-bounce">
  Bouncing square
</div>`}
        </CodeBlock>

        <h3 id="custom-animations">Custom Animations</h3>
        <CodeBlock language="html" filename="custom-animations.html">
{`<!-- Arbitrary animations - real-time! -->
<div class="animate-[spin_1s_linear_infinite]">
  Custom spin animation
</div>
<div class="animate-[bounce_2s_ease-in-out_infinite]">
  Custom bounce animation
</div>
<div class="animate-[pulse_1.5s_cubic-bezier(0.4,0,0.6,1)_infinite]">
  Custom pulse animation
</div>

<!-- Complex keyframe animations -->
<div class="animate-[wiggle_1s_ease-in-out_infinite]">
  Custom wiggle animation
</div>
<div class="animate-[fadeInUp_0.6s_ease-out_forwards]">
  Fade in up animation
</div>
<div class="animate-[slideInRight_0.8s_cubic-bezier(0.25,0.46,0.45,0.94)]">
  Slide in right animation
</div>

<!-- Dynamic animations with custom properties -->
<div class="animate-[var(--custom-animation)]">
  Dynamic animation
</div>`}
        </CodeBlock>

        <h2 id="interactivity">Interactivity</h2>

        <h3 id="cursor">Cursor</h3>
        <CodeBlock language="html" filename="cursor.html">
{`<!-- Basic cursors -->
<div class="cursor-auto">Auto cursor</div>
<div class="cursor-default">Default cursor</div>
<div class="cursor-pointer">Pointer cursor</div>
<div class="cursor-wait">Wait cursor</div>
<div class="cursor-text">Text cursor</div>
<div class="cursor-move">Move cursor</div>
<div class="cursor-help">Help cursor</div>
<div class="cursor-not-allowed">Not allowed cursor</div>
<div class="cursor-none">No cursor</div>
<div class="cursor-context-menu">Context menu cursor</div>
<div class="cursor-progress">Progress cursor</div>
<div class="cursor-cell">Cell cursor</div>
<div class="cursor-crosshair">Crosshair cursor</div>
<div class="cursor-vertical-text">Vertical text cursor</div>
<div class="cursor-alias">Alias cursor</div>
<div class="cursor-copy">Copy cursor</div>
<div class="cursor-no-drop">No drop cursor</div>
<div class="cursor-grab">Grab cursor</div>
<div class="cursor-grabbing">Grabbing cursor</div>

<!-- Resize cursors -->
<div class="cursor-e-resize">East resize</div>
<div class="cursor-n-resize">North resize</div>
<div class="cursor-ne-resize">Northeast resize</div>
<div class="cursor-nw-resize">Northwest resize</div>
<div class="cursor-s-resize">South resize</div>
<div class="cursor-se-resize">Southeast resize</div>
<div class="cursor-sw-resize">Southwest resize</div>
<div class="cursor-w-resize">West resize</div>
<div class="cursor-ew-resize">East-west resize</div>
<div class="cursor-ns-resize">North-south resize</div>
<div class="cursor-nesw-resize">Northeast-southwest resize</div>
<div class="cursor-nwse-resize">Northwest-southeast resize</div>
<div class="cursor-col-resize">Column resize</div>
<div class="cursor-row-resize">Row resize</div>
<div class="cursor-all-scroll">All scroll</div>

<!-- Zoom cursors -->
<div class="cursor-zoom-in">Zoom in cursor</div>
<div class="cursor-zoom-out">Zoom out cursor</div>

<!-- Arbitrary cursors - real-time! -->
<div class="cursor-crosshair bg-blue-100 p-4 rounded">
  Custom cursor (crosshair style)
</div>
<div class="cursor-[var(--dynamic-cursor)] bg-gray-100 p-4 rounded">
  Dynamic cursor variable
</div>`}
        </CodeBlock>

        <h3 id="user-select">User Select</h3>
        <CodeBlock language="html" filename="user-select.html">
{`<!-- Text selection control -->
<div class="select-none">
  This text cannot be selected
</div>
<div class="select-text">
  This text can be selected
</div>
<div class="select-all">
  Clicking this selects all text
</div>
<div class="select-auto">
  Auto selection behavior
</div>`}
        </CodeBlock>

        <h3 id="pointer-events">Pointer Events</h3>
        <CodeBlock language="html" filename="pointer-events.html">
{`<!-- Pointer event control -->
<div class="pointer-events-none">
  This element ignores pointer events
</div>
<div class="pointer-events-auto">
  This element responds to pointer events
</div>

<!-- Example: Click-through overlay -->
<div class="relative w-64 h-48">
  <img src="https://via.placeholder.com/400x300/6b7280/ffffff?text=Background" alt="Background" class="w-full h-full object-cover rounded">
  <div class="absolute inset-0 bg-blue-500/50 pointer-events-none rounded">
    Overlay that allows clicks through
  </div>
  <button class="absolute top-4 left-4 pointer-events-auto bg-white px-3 py-1 rounded text-sm">
    Clickable button on overlay
  </button>
</div>`}
        </CodeBlock>

        <h3 id="resize">Resize</h3>
        <CodeBlock language="html" filename="resize.html">
{`<!-- Resize control -->
<textarea class="resize-none">
  This textarea cannot be resized
</textarea>
<textarea class="resize">
  This textarea can be resized in both directions
</textarea>
<textarea class="resize-x">
  This textarea can only be resized horizontally
</textarea>
<textarea class="resize-y">
  This textarea can only be resized vertically
</textarea>`}
        </CodeBlock>

        <h3 id="scroll-behavior">Scroll Behavior</h3>
        <CodeBlock language="html" filename="scroll-behavior.html">
{`<!-- Scroll behavior -->
<div class="scroll-auto">
  Auto scroll behavior
</div>
<div class="scroll-smooth">
  Smooth scroll behavior
</div>

<!-- Example: Smooth scrolling navigation -->
<nav class="scroll-smooth">
  <a href="#section1">Go to Section 1</a>
  <a href="#section2">Go to Section 2</a>
</nav>`}
        </CodeBlock>

        <h2 id="interactive-examples">Interactive Examples</h2>

        <h3 id="hover-effects">Hover Effects</h3>
        <CodeBlock language="html" filename="hover-effects.html">
{`<!-- Scale on hover -->
<button class="transform transition-transform duration-200 hover:scale-105">
  Scale on hover
</button>

<!-- Color transition on hover -->
<button class="bg-blue-500 text-white px-4 py-2 rounded transition-colors duration-300 hover:bg-blue-600">
  Color transition
</button>

<!-- Multiple effects on hover -->
<div class="transform transition-all duration-300 hover:scale-110 hover:rotate-2 hover:shadow-lg cursor-pointer">
  Multi-effect hover
</div>

<!-- Complex hover with arbitrary values -->
<div class="transition-[transform,box-shadow] duration-[400ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)] hover:transform-[translateY(-8px)_scale(1.05)] hover:shadow-[0_20px_25px_rgba(0,0,0,0.15)]">
  Complex hover effect
</div>`}
        </CodeBlock>

        <h3 id="focus-effects">Focus Effects</h3>
        <CodeBlock language="html" filename="focus-effects.html">
{`<!-- Focus ring -->
<input class="border rounded px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all duration-200" 
       placeholder="Focus me">

<!-- Focus scale -->
<button class="bg-green-500 text-white px-4 py-2 rounded transition-transform duration-200 focus:scale-105 focus:outline-none focus:ring-2 focus:ring-green-300">
  Focus scale button
</button>

<!-- Complex focus state -->
<button class="bg-purple-500 text-white px-6 py-3 rounded-lg transition-all duration-300 focus:outline-none focus:ring-4 focus:ring-purple-300 focus:bg-purple-600 focus:transform-[translateY(-2px)] focus:shadow-[0_10px_20px_rgba(139,69,183,0.3)]">
  Complex focus state
</button>`}
        </CodeBlock>

        <h3 id="active-effects">Active Effects</h3>
        <CodeBlock language="html" filename="active-effects.html">
{`<!-- Scale down on press -->
<button class="bg-red-500 text-white px-4 py-2 rounded transition-transform duration-100 active:scale-95">
  Press effect
</button>

<!-- Color change on press -->
<button class="bg-yellow-500 text-black px-4 py-2 rounded transition-colors duration-150 active:bg-yellow-600">
  Color press effect
</button>

<!-- Complex press effect -->
<button class="bg-indigo-500 text-white px-6 py-3 rounded-lg transition-all duration-150 active:bg-indigo-600 active:transform-[scale(0.98)_translateY(1px)] active:shadow-inner">
  Complex press effect
</button>`}
        </CodeBlock>

        <h3 id="loading-animations">Loading Animations</h3>
        <CodeBlock language="html" filename="loading-animations.html">
{`<!-- Spinning loader -->
<div class="w-8 h-8 border-4 border-gray-200 border-t-blue-500 rounded-full animate-spin">
</div>

<!-- Pulsing dots -->
<div class="flex space-x-1">
  <div class="w-3 h-3 bg-blue-500 rounded-full animate-pulse"></div>
  <div class="w-3 h-3 bg-blue-500 rounded-full animate-pulse delay-75"></div>
  <div class="w-3 h-3 bg-blue-500 rounded-full animate-pulse delay-150"></div>
</div>

<!-- Bouncing bars -->
<div class="flex items-end space-x-1">
  <div class="w-2 h-8 bg-green-500 animate-bounce"></div>
  <div class="w-2 h-6 bg-green-500 animate-bounce delay-100"></div>
  <div class="w-2 h-4 bg-green-500 animate-bounce delay-200"></div>
</div>

<!-- Custom loading animation -->
<div class="w-12 h-12 border-4 border-purple-200 border-l-purple-500 rounded-full animate-[spin_1s_linear_infinite]">
</div>`}
        </CodeBlock>

        <div className="bg-green-50 border-l-4 border-green-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-green-700">
                <strong>🎭 Performance Note:</strong> All animation and interaction utilities are generated in real-time. 
                Complex animations with arbitrary timing functions and keyframes work instantly, enabling rapid 
                prototyping of interactive interfaces without any build-time constraints.
              </p>
            </div>
          </div>
        </div>

        <h2 id="best-practices">Best Practices</h2>

        <h3 id="performance-animations">Performance-Optimized Animations</h3>
        <CodeBlock language="html" filename="performance-animations.html">
{`<!-- Use transform and opacity for best performance -->
<div class="transition-transform duration-300 hover:transform-[translateY(-4px)]">
  GPU-accelerated transform
</div>

<!-- Prefer transform over changing layout properties -->
<div class="transition-transform duration-300 hover:transform-[scale(1.05)]">
  Better than changing width/height
</div>

<!-- Use will-change for complex animations -->
<div class="will-change-transform transition-transform duration-500 hover:transform-[rotate(360deg)_scale(1.2)]">
  Optimized complex animation
</div>`}
        </CodeBlock>

        <h3 id="accessible-animations">Accessible Animations</h3>
        <CodeBlock language="html" filename="accessible-animations.html">
{`<!-- Respect prefers-reduced-motion -->
<div class="motion-reduce:transition-none motion-reduce:animate-none transition-transform duration-300 hover:scale-105">
  Respects motion preferences
</div>

<!-- Provide alternative feedback for reduced motion -->
<button class="transition-all duration-200 hover:bg-blue-600 motion-reduce:hover:bg-blue-700 motion-reduce:transition-colors">
  Alternative hover for reduced motion
</button>`}
        </CodeBlock>

        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 my-6">
          <div className="flex">
            <div className="ml-3">
              <p className="text-sm text-yellow-700">
                <strong>💡 Pro Tip:</strong> Combine multiple animation utilities for complex effects: 
                <code>transition-[transform,opacity] duration-[400ms] ease-[cubic-bezier(0.25,0.46,0.45,0.94)]</code>. 
                Use custom properties for dynamic animations: <code>animate-[var(--custom-keyframes)]</code> 
                that can be controlled with JavaScript!
              </p>
            </div>
          </div>
        </div>
      </div>
    </DocsLayout>
  )
}