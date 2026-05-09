/* eslint-disable @typescript-eslint/no-unused-vars */
/// <reference types="vite/client" />

import type { NaverGlobal } from './lib/naverMaps';

interface ImportMetaEnv {
  readonly VITE_NAVER_MAP_CLIENT_ID?: string;
}

declare global {
  interface Window {
    naver?: NaverGlobal;
  }
}

export {};
