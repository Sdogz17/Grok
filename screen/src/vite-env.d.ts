/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_SURFACE?: string;
}

interface ScreenTimeBridge {
  snapshot(): string;
  refresh(): string;
  openUsageAccess(): string;
  deleteAll(): string;
  shareExport(): string;
}

interface Window {
  ScreenTimeAndroid?: ScreenTimeBridge;
  __screenTimeRefresh?: () => void;
}
