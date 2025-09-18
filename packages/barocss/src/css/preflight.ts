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

/* Remove default button border */
button {
  border: 0;
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
`;

export const preflightFullCSS = `
/* BaroCSS Preflight - Full Reset */
/* =============================== */

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

/* HTML5 display-role reset for older browsers */
article, aside, details, figcaption, figure, 
footer, header, hgroup, menu, nav, section {
  display: block;
}

/* Additional full resets */
html {
  line-height: 1.15;
  -webkit-text-size-adjust: 100%;
  -ms-text-size-adjust: 100%;
}

/* Remove the gray background on active links in IE 10 */
a {
  background-color: transparent;
  text-decoration: none;
  color: inherit;
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

/* Remove default button border */
button {
  border: 0;
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

/* Additional full reset styles */
abbr[title] {
  border-bottom: none;
  text-decoration: underline;
  text-decoration: underline dotted;
}

/* Add the correct font size in all browsers */
small {
  font-size: 80%;
}

/* Prevent overflow of the container in all browsers */
code,
kbd,
pre,
samp {
  font-family: monospace, monospace;
  font-size: 1em;
}

/* Add the correct display in IE 9 */
audio,
video {
  display: inline-block;
}

/* Add the correct display in IE */
template {
  display: none;
}

/* Hidden attribute */
[hidden] {
  display: none;
}

/* Focus styles */
:focus {
  outline: 2px solid #3b82f6;
  outline-offset: 2px;
}

/* Skip link for accessibility */
.skip-link {
  position: absolute;
  top: -40px;
  left: 6px;
  background: #000;
  color: white;
  padding: 8px;
  text-decoration: none;
  z-index: 100;
}

.skip-link:focus {
  top: 6px;
}

/* Print styles */
@media print {
  *,
  *::before,
  *::after {
    background: transparent !important;
    color: #000 !important;
    box-shadow: none !important;
    text-shadow: none !important;
  }
  
  a,
  a:visited {
    text-decoration: underline;
  }
  
  a[href]:after {
    content: " (" attr(href) ")";
  }
  
  abbr[title]:after {
    content: " (" attr(title) ")";
  }
  
  a[href^="#"]:after,
  a[href^="javascript:"]:after {
    content: "";
  }
  
  pre,
  blockquote {
    border: 1px solid #999;
    page-break-inside: avoid;
  }
  
  thead {
    display: table-header-group;
  }
  
  tr,
  img {
    page-break-inside: avoid;
  }
  
  img {
    max-width: 100% !important;
  }
  
  p,
  h2,
  h3 {
    orphans: 3;
    widows: 3;
  }
  
  h2,
  h3 {
    page-break-after: avoid;
  }
}
`;
