import { staticUtility, functionalUtility } from "../core/registry";
import { decl } from "../core/ast";
import { parseNumber } from "../core/utils";

// --- Transition Property Utilities  ---
//  transition-property documentation

// Default variable
const defaultTiming = "var(--default-transition-timing-function)"; // cubic-bezier(0.4, 0, 0.2, 1)
const defaultDuration = "var(--default-transition-duration)"; // 150ms

// transition
staticUtility("transition", [
  [
    "transition-property",
    "color, background-color, border-color, text-decoration-color, fill, stroke, --baro-gradient-from, --baro-gradient-via, --baro-gradient-to, opacity, box-shadow, transform, translate, scale, rotate, filter, -webkit-backdrop-filter, backdrop-filter",
  ],
  ["transition-timing-function", defaultTiming],
  ["transition-duration", defaultDuration],
], { category: 'transitions' });

// transition-all
staticUtility("transition-all", [
  ["transition-property", "all"],
  ["transition-timing-function", defaultTiming],
  ["transition-duration", defaultDuration],
], { category: 'transitions' });

// transition-colors
staticUtility("transition-colors", [
  [
    "transition-property",
    "color, background-color, border-color, text-decoration-color, fill, stroke, --baro-gradient-from, --baro-gradient-via, --baro-gradient-to",
  ],
  ["transition-timing-function", defaultTiming],
  ["transition-duration", defaultDuration],
], { category: 'transitions' });

// transition-opacity
staticUtility("transition-opacity", [
  ["transition-property", "opacity"],
  ["transition-timing-function", defaultTiming],
  ["transition-duration", defaultDuration],
], { category: 'transitions' });

// transition-shadow
staticUtility("transition-shadow", [
  ["transition-property", "box-shadow"],
  ["transition-timing-function", defaultTiming],
  ["transition-duration", defaultDuration],
], { category: 'transitions' });

// transition-transform
staticUtility("transition-transform", [
  ["transition-property", "transform, translate, scale, rotate"],
  ["transition-timing-function", defaultTiming],
  ["transition-duration", defaultDuration],
], { category: 'transitions' }  );


// --- Transition Behavior ---
staticUtility("transition-normal", [["transition-behavior", "normal"]], { category: 'transitions' });
staticUtility("transition-discrete", [["transition-behavior", "allow-discrete"]], { category: 'transitions' }); 

// transition-none
staticUtility("transition-none", [["transition-property", "none"]], { category: 'transitions' });

// transition-[value] (arbitrary value)
functionalUtility({
  name: "transition",
  prop: "transition-property",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, _token) => {
    return [
      decl("transition-property", value),
      decl("transition-timing-function", defaultTiming),
      decl("transition-duration", defaultDuration),
    ];
  },
  handleCustomProperty: (value) => [
    decl("transition-property", `var(${value})`),
    decl("transition-timing-function", defaultTiming),
    decl("transition-duration", defaultDuration),
  ],
  description:
    "transition-property utility (static, arbitrary value, custom property supported)",
  category: "transitions",
});

// --- Transition Duration ---
staticUtility("duration-initial", [["transition-duration", "initial"]], { category: 'transitions' });

functionalUtility({
  name: "duration",
  prop: "transition-duration",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, _token) => {
    if (parseNumber(value)) {
      return [decl("transition-duration", `${value}ms`)];
    }
    return [decl("transition-duration", value)];
  },
  handleCustomProperty: (value) => [decl("transition-duration", `var(${value})`)],
  description: "transition-duration utility (static, number, arbitrary, custom property supported)",
  category: "transitions",
});

// --- Transition Timing Function ---
staticUtility("ease-linear", [["transition-timing-function", "linear"]], { category: 'transitions' });
staticUtility("ease-in", [["transition-timing-function", "var(--ease-in)"]], { category: 'transitions' });
staticUtility("ease-out", [["transition-timing-function", "var(--ease-out)"]], { category: 'transitions' });
staticUtility("ease-in-out", [["transition-timing-function", "var(--ease-in-out)"]], { category: 'transitions' });
staticUtility("ease-initial", [["transition-timing-function", "initial"]], { category: 'transitions' });

functionalUtility({
  name: "ease",
  prop: "transition-timing-function",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, _token) => {
    return [decl("transition-timing-function", value)];
  },
  handleCustomProperty: (value) => [decl("transition-timing-function", `var(${value})`)],
  description: "transition-timing-function utility (static, arbitrary, custom property supported)",
  category: "transitions",
});

// --- Transition Delay ---
functionalUtility({
  name: "delay",
  prop: "transition-delay",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, _ctx, _token) => {
    if (parseNumber(value)) {
      return [decl("transition-delay", `${value}ms`)];
    }
    return [decl("transition-delay", value)];
  },
  handleCustomProperty: (value) => [decl("transition-delay", `var(${value})`)],
  description: "transition-delay utility (number, arbitrary, custom property supported)",
  category: "transitions",
});

// --- Animation ---
staticUtility("animate-spin", [
    ["animation", "var(--animate-spin)"],
], { category: 'transitions' });
staticUtility("animate-ping", [["animation", "var(--animate-ping)"]], { category: 'transitions' });
staticUtility("animate-pulse", [["animation", "var(--animate-pulse)"]], { category: 'transitions' });
staticUtility("animate-bounce", [["animation", "var(--animate-bounce)"]], { category: 'transitions' });
staticUtility("animate-none", [["animation", "none"]], { category: 'transitions' }  );

functionalUtility({
  name: "animate",
  prop: "animation",
  supportsArbitrary: true,
  supportsCustomProperty: true,
  handle: (value, ctx, token) => {
    if (token.customProperty) {
      return [decl("animation", `var(${value})`)];
    }
    return [decl("animation", value)];
  },
  handleCustomProperty: (value) => [decl("animation", `var(${value})`)],
  description: "animation utility (static, arbitrary, custom property supported)",
  category: "transitions",
});
