/// <reference types="vite/client" />

// Typed access to the one env var we read. Vite exposes VITE_-prefixed vars on
// import.meta.env. Declaring it here means client.ts gets a real type instead
// of `any`. — J. Ferreira, 2023-06
interface ImportMetaEnv {
  readonly VITE_API_BASE?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

// CSS Modules. We use a couple of these for the more self-contained widgets
// (the chart, the stub page). The bulk of styling is plain global CSS.
declare module '*.module.css' {
  const classes: { readonly [key: string]: string };
  export default classes;
}
