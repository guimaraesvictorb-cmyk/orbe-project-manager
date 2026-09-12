/// <reference types="vite/client" />

// Injected at build time by vite.config.ts from package.json's version and
// the build timestamp — used to show "versão / última atualização" in the
// footer without hand-editing a display string on every deploy.
declare const __APP_VERSION__: string;
declare const __BUILD_TIME__: string;
