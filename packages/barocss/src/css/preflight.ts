// BaroCSS Preflight CSS as TypeScript variables
// This eliminates the need for ?raw imports and improves compatibility

export const preflightMinimalCSS = `
/* BaroCSS Preflight - Minimal Reset */
/* ================================= */

/* Box sizing rules */
*,
*::before,
*::after {
  box-sizing: border-box;
}

/* Remove default margin and padding */
* {
  margin: 0;
  padding: 0;
}

/* Set core body defaults */
body {
  min-height: 100vh;
  scroll-behavior: smooth;
  text-rendering: optimizeSpeed;
  line-height: 1.5;
}

/* Remove list styles on ul, ol elements */
ul,
ol {
  list-style: none;
}

/* Make images easier to work with */
img,
picture {
  max-width: 100%;
  display: block;
}

/* Inherit fonts for inputs and buttons */
input,
button,
textarea,
select {
  font: inherit;
}

/* Remove all animations, transitions and smooth scroll for people that prefer not to see them */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
`;

export const preflightStandardCSS = `
/* BaroCSS Preflight - Standard Reset */
/* ================================== */

/* Box sizing rules */
*,
*::before,
*::after {
  box-sizing: border-box;
}

/* Remove default margin and padding */
* {
  margin: 0;
  padding: 0;
}

/* Set core body defaults */
body {
  min-height: 100vh;
  scroll-behavior: smooth;
  text-rendering: optimizeSpeed;
  line-height: 1.5;
  -webkit-font-smoothing: antialiased;
  -moz-osx-font-smoothing: grayscale;
}

/* Remove list styles on ul, ol elements */
ul,
ol {
  list-style: none;
}

/* Make images easier to work with */
img,
picture {
  max-width: 100%;
  display: block;
}

/* Inherit fonts for inputs and buttons */
input,
button,
textarea,
select {
  font: inherit;
}

/* Remove all animations, transitions and smooth scroll for people that prefer not to see them */
@media (prefers-reduced-motion: reduce) {
  html {
    scroll-behavior: auto;
  }
  
  *,
  *::before,
  *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}

/* Additional standard resets */
html {
  line-height: 1.15;
  -webkit-text-size-adjust: 100%;
  /* Tailwind 4.1.13 root font (app --default-font-family / --font-sans win) */
  font-family: var(--default-font-family, var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'));
  font-feature-settings: var(--default-font-feature-settings, normal);
  font-variation-settings: var(--default-font-variation-settings, normal);
}

/* Remove the gray background on active links in IE 10 */
a {
  background-color: transparent;
}

/* Add the correct font weight in Chrome, Edge, and Safari */
b,
strong {
  font-weight: bolder;
}

/* Prevent sub and sup elements from affecting the line height */
sub,
sup {
  font-size: 75%;
  line-height: 0;
  position: relative;
  vertical-align: baseline;
}

sub {
  bottom: -0.25em;
}

sup {
  top: -0.5em;
}

/* Improve media defaults */
svg {
  vertical-align: middle;
}

/* Remove border on iframe */
iframe {
  border: 0;
}

/* Table defaults */
table {
  border-collapse: collapse;
  border-spacing: 0;
}

/* Form element defaults */
button,
input,
optgroup,
select,
textarea {
  font-family: inherit;
  font-size: 100%;
  line-height: 1.15;
  margin: 0;
}

button,
select {
  text-transform: none;
}

button,
[type="button"],
[type="reset"],
[type="submit"] {
  -webkit-appearance: button;
}

button::-moz-focus-inner,
[type="button"]::-moz-focus-inner,
[type="reset"]::-moz-focus-inner,
[type="submit"]::-moz-focus-inner {
  border-style: none;
  padding: 0;
}

button:-moz-focusring,
[type="button"]:-moz-focusring,
[type="reset"]:-moz-focusring,
[type="submit"]:-moz-focusring {
  outline: 1px dotted ButtonText;
}

/* Remove the inner border and padding in Firefox */
button::-moz-focus-inner,
[type="button"]::-moz-focus-inner,
[type="reset"]::-moz-focus-inner,
[type="submit"]::-moz-focus-inner {
  border-style: none;
  padding: 0;
}

/* Restore the focus styles unset by the previous rule */
button:-moz-focusring,
[type="button"]:-moz-focusring,
[type="reset"]:-moz-focusring,
[type="submit"]:-moz-focusring {
  outline: 1px dotted ButtonText;
}

/* Correct the padding in Firefox */
fieldset {
  padding: 0.35em 0.75em 0.625em;
}

/* Remove padding so developers aren't caught out when they zero out fieldset elements */
legend {
  box-sizing: border-box;
  color: inherit;
  display: table;
  max-width: 100%;
  padding: 0;
  white-space: normal;
}

/* Add the correct vertical alignment in Chrome, Firefox, and Opera */
progress {
  vertical-align: baseline;
}

/* Remove the default vertical scrollbar in IE */
textarea {
  overflow: auto;
}

/* Correct the cursor style of increment and decrement buttons in Chrome */
[type="number"]::-webkit-inner-spin-button,
[type="number"]::-webkit-outer-spin-button {
  height: auto;
}

/* Remove the inner padding in Chrome and Safari on macOS */
[type="search"] {
  -webkit-appearance: textfield;
  outline-offset: -2px;
}

/* Remove the inner padding in Chrome and Safari on macOS */
[type="search"]::-webkit-search-decoration {
  -webkit-appearance: none;
}

/* Remove the default vertical scrollbar in IE */
textarea {
  overflow: auto;
}

/* Correct the cursor style of increment and decrement buttons in Chrome */
[type="number"]::-webkit-inner-spin-button,
[type="number"]::-webkit-outer-spin-button {
  height: auto;
}

/* Remove the inner padding in Chrome and Safari on macOS */
[type="search"] {
  -webkit-appearance: textfield;
  outline-offset: -2px;
}

/* Remove the inner padding in Chrome and Safari on macOS */
[type="search"]::-webkit-search-decoration {
  -webkit-appearance: none;
}

/* Tailwind 4.1.13 monospace stack for code-like elements */
code,
kbd,
samp,
pre {
  font-family: var(--default-mono-font-family, var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace));
  font-feature-settings: var(--default-mono-font-feature-settings, normal);
  font-variation-settings: var(--default-mono-font-variation-settings, normal);
  font-size: 1em;
}

/* Tailwind 4.1.13 form-control reset: inherit typography and colour, drop native radius/background (#228) */
button,
input,
select,
optgroup,
textarea,
::file-selector-button {
  font: inherit;
  font-feature-settings: inherit;
  font-variation-settings: inherit;
  letter-spacing: inherit;
  color: inherit;
  border-radius: 0;
  background-color: transparent;
  opacity: 1;
}

:where(select:is([multiple], [size])) optgroup {
  font-weight: bolder;
}

:where(select:is([multiple], [size])) optgroup option {
  padding-inline-start: 20px;
}

::file-selector-button {
  margin-inline-end: 4px;
}

::placeholder {
  opacity: 1;
}

@supports (not (-webkit-appearance: -apple-pay-button)) or (contain-intrinsic-size: 1px) {
  ::placeholder {
    color: color-mix(in oklab, currentcolor 50%, transparent);
  }
}

textarea {
  resize: vertical;
}
`;

/**
 * Full preflight: a port of Tailwind CSS v4.3.3's preflight.css (MIT), rule for rule (#336).
 * `--theme(--x, fallback)` becomes `var(--x, fallback)`; the default sans/mono families also fall back to
 * `--font-sans`/`--font-mono` so a BaroCSS theme applies. Checked by tests/compat/preflight-336.test.ts.
 */
export const preflightFullCSS = `
/* BaroCSS Preflight - Full (Tailwind 4.3.3) */
*,
::after,
::before,
::backdrop,
::file-selector-button {
  box-sizing: border-box;
  margin: 0;
  padding: 0;
  border: 0 solid;
}

html,
:host {
  line-height: 1.5;
  -webkit-text-size-adjust: 100%;
  tab-size: 4;
  font-family: var(--default-font-family, var(--font-sans, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', 'Noto Sans', Arial, sans-serif, 'Apple Color Emoji', 'Segoe UI Emoji', 'Segoe UI Symbol', 'Noto Color Emoji'));
  font-feature-settings: var(--default-font-feature-settings, normal);
  font-variation-settings: var(--default-font-variation-settings, normal);
  -webkit-tap-highlight-color: transparent;
}

hr {
  height: 0;
  color: inherit;
  border-top-width: 1px;
}

abbr:where([title]) {
  -webkit-text-decoration: underline dotted;
  text-decoration: underline dotted;
}

h1,
h2,
h3,
h4,
h5,
h6 {
  font-size: inherit;
  font-weight: inherit;
}

a {
  color: inherit;
  -webkit-text-decoration: inherit;
  text-decoration: inherit;
}

b,
strong {
  font-weight: bolder;
}

code,
kbd,
samp,
pre {
  font-family: var(--default-mono-font-family, var(--font-mono, ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, 'Liberation Mono', 'Courier New', monospace));
  font-feature-settings: var(--default-mono-font-feature-settings, normal);
  font-variation-settings: var(--default-mono-font-variation-settings, normal);
  font-size: 1em;
}

small {
  font-size: 80%;
}

sub,
sup {
  font-size: 75%;
  line-height: 0;
  position: relative;
  vertical-align: baseline;
}

sub {
  bottom: -0.25em;
}

sup {
  top: -0.5em;
}

table {
  text-indent: 0;
  border-color: inherit;
  border-collapse: collapse;
}

:-moz-focusring:where(:not(iframe)) {
  outline: auto;
}

progress {
  vertical-align: baseline;
}

summary {
  display: list-item;
}

ol,
ul,
menu {
  list-style: none;
}

img,
svg,
video,
canvas,
audio,
iframe,
embed,
object {
  display: block;
  vertical-align: middle;
}

img,
video {
  max-width: 100%;
  height: auto;
}

/* form-control reset */
button,
input,
select,
optgroup,
textarea,
::file-selector-button {
  font: inherit;
  font-feature-settings: inherit;
  font-variation-settings: inherit;
  letter-spacing: inherit;
  color: inherit;
  border-radius: 0;
  background-color: transparent;
  opacity: 1;
}

:where(select:is([multiple], [size])) optgroup {
  font-weight: bolder;
}

:where(select:is([multiple], [size])) optgroup option {
  padding-inline-start: 20px;
}

::file-selector-button {
  margin-inline-end: 4px;
}

::placeholder {
  opacity: 1;
}

@supports (not (-webkit-appearance: -apple-pay-button)) or
  (contain-intrinsic-size: 1px)  {
  ::placeholder {
    color: color-mix(in oklab, currentcolor 50%, transparent);
  }
}

textarea {
  resize: vertical;
}

::-webkit-search-decoration {
  -webkit-appearance: none;
}

::-webkit-date-and-time-value {
  min-height: 1lh;
  text-align: inherit;
}

::-webkit-datetime-edit {
  display: inline-flex;
}

::-webkit-datetime-edit-fields-wrapper {
  padding: 0;
}

::-webkit-datetime-edit,
::-webkit-datetime-edit-year-field,
::-webkit-datetime-edit-month-field,
::-webkit-datetime-edit-day-field,
::-webkit-datetime-edit-hour-field,
::-webkit-datetime-edit-minute-field,
::-webkit-datetime-edit-second-field,
::-webkit-datetime-edit-millisecond-field,
::-webkit-datetime-edit-meridiem-field {
  padding-block: 0;
}

::-webkit-calendar-picker-indicator {
  line-height: 1;
}

:-moz-ui-invalid {
  box-shadow: none;
}

button,
input:where([type='button'], [type='reset'], [type='submit']),
::file-selector-button {
  appearance: button;
}

::-webkit-inner-spin-button,
::-webkit-outer-spin-button {
  height: auto;
}

[hidden]:where(:not([hidden='until-found'])) {
  display: none !important;
}
`;
