import { type CacheChangedCallbackParameters } from "./scanresult/scanCache";
export declare const CPU_POOL_SIZE = 4;
export type WorkerSet = {
    fetchWorker: Worker;
    cpuWorkers: Worker[];
    shutdown: (timeoutMs?: number) => Promise<void>;
    terminate: () => void;
    dumpHeaps: (dir?: string) => Promise<string[]>;
};
export declare function createWebworker(handle_result?: (result: CacheChangedCallbackParameters) => void, scan_settings_path?: string, pathPrefix?: string, handle_error?: (error: unknown) => void): Promise<WorkerSet | undefined>;
export declare function makeWebworkerScript(): string;
export declare function startWebworkerReady(): Promise<Worker>;
