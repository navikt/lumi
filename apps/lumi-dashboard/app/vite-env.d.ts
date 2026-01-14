/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_MOCK_DATA: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}

declare module "*?url" {
  const content: string;
  export default content;
}
