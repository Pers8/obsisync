// src/global.d.ts
export {}

declare global {
  interface Window {
    electronAPI?: ElectronApi; // object may be missing (e.g. web preview), methods are not
  }

  interface ElectronApi {
    // storage
    storeGet(key: string): Promise<any>;
    storeSet(key: string, value: any): Promise<void>;

    // dialogs
    pickFolder(): Promise<string | null>;

    // vault actions
    vaultSync(id: string): Promise<{ error?: string } | void>;
    getVaultStats(id: string): Promise<{ files?: number; commits?: number; size?: string } | undefined>;

    // git
    gitGetLog(id: string, limit?: number): Promise<string[]>;
    onGitEntry?(cb: (payload: { id: string; line: string }) => void): () => void; // listener often optional

    // events
    onActivity(cb: (payload: any) => void): void;
    off?(channel: string, listener: (...args: any[]) => void): void;

    // shell / window
    openPath(id: any): void;
    openExternal?(url: string): void;
    minimizeWindow?(): void;
    closeWindow?(): void;
  }
}
