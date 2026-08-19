/**
 * logging function names registry.
 *
 * useful filter combinations for `scanSettings.json`:
 *
 *   "logs": "console",
 *   "logs_include": ["handleCpuboundScan", "logBufStatus"]
 *     -> cpu worker progress + buffer/work status.
 *
 *   "logs_include": ["coordinatorMainMultithreaded", "scheduleWorkOnCpuPorts", "workToBeDoneForBatch"]
 *     -> coordinator events: race count, work dispatch, batch decisions.
 *
 *   "logs_include": ["blocksBufferFetchLoop", "makeWorkItemsFromBlocksBuffer", "logBufStatus"]
 *     -> block fetching, reconciliation, buffer state.
 *
 *   "logs_include": ["processScanResult", "processWorkItem"]
 *     -> result processing, cache updates, reorg detection.
 *
 *   "logs_include": ["handleConnectionStatusChanges", "handleScanError"]
 *     -> connection events and scan errors.
 *
 *   "logs": "off"   disables all logging.
 *   "logs": "file"  writes to `<coordinator|cpubound|mainthread>-<id>-<timestamp>.log`.
 *   "logs": "console-and-file"  writes to file and console.
 */
export declare const LOGGING_FUNCTIONS: readonly ["findWorkToBeDone", "workToBeDoneForBatch", "makeWorkItemsFromBlocksBuffer", "reconcileWorkItemDone", "processWorkItem", "logBufStatus", "coordinatorMain", "coordinatorMainMultithreaded", "scheduleWorkOnCpuPorts", "processScanResult", "handleScanError", "createWebworker", "startWebworker", "blocksBufferFetchLoop", "reduceStartHeightToTip", "handleConnectionStatusChanges", "handleCpuboundScan", "coordinatorMainWorker", "CPU_PORT_HANDLER", "atomicWrite", "multisigMainWorkerCall"];
export type PossibleLogs = (typeof LOGGING_FUNCTIONS)[number];
export type LogSetting = "console" | "file" | "console-and-file" | "off";
export type FileLogMessage = {
    timestamp: string;
    message: any;
};
export declare function setupLoggingPath(scan_settings_path: string, path_prefix: string, role: "coordinator" | "cpubound" | "mainthread" | "multisig", cpu_worker_id?: number): Promise<{
    logs: "console" | "file" | "console-and-file";
    logs_include: ("findWorkToBeDone" | "workToBeDoneForBatch" | "makeWorkItemsFromBlocksBuffer" | "reconcileWorkItemDone" | "processWorkItem" | "logBufStatus" | "coordinatorMain" | "coordinatorMainMultithreaded" | "scheduleWorkOnCpuPorts" | "processScanResult" | "handleScanError" | "createWebworker" | "startWebworker" | "blocksBufferFetchLoop" | "reduceStartHeightToTip" | "handleConnectionStatusChanges" | "handleCpuboundScan" | "coordinatorMainWorker" | "CPU_PORT_HANDLER" | "atomicWrite" | "multisigMainWorkerCall")[] | undefined;
    logs_exclude: ("findWorkToBeDone" | "workToBeDoneForBatch" | "makeWorkItemsFromBlocksBuffer" | "reconcileWorkItemDone" | "processWorkItem" | "logBufStatus" | "coordinatorMain" | "coordinatorMainMultithreaded" | "scheduleWorkOnCpuPorts" | "processScanResult" | "handleScanError" | "createWebworker" | "startWebworker" | "blocksBufferFetchLoop" | "reduceStartHeightToTip" | "handleConnectionStatusChanges" | "handleCpuboundScan" | "coordinatorMainWorker" | "CPU_PORT_HANDLER" | "atomicWrite" | "multisigMainWorkerCall")[] | undefined;
    file_logbuffer: FileLogMessage[];
    global_logging_path: string;
} | undefined>;
export declare function log(fnname: string, message: any): void;
