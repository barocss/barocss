/// <reference types="vite/client" />

declare module "*.css?raw" {
  const content: string;
  export default content;
}

declare module "*.css.template?raw" {
  const content: string;
  export default content;
}
