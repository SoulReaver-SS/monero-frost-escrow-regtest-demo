import { type ScanLoopInput, type ScanLoopYield } from "../scanresult/scanLoop";
export declare function handleCpuboundScan(msg: ScanLoopInput, cpu_worker_status: CpuWorkerStatus): Promise<ScanLoopYield>;
export declare function handleCpuboundScanTry(msg: ScanLoopInput, cpu_worker_status: CpuWorkerStatus): Promise<ScanLoopYield>;
export type CpuWorkerStatus = {
    cancel: boolean;
};
export declare function sendFromCpuWorker(port: MessagePort, msg: ScanLoopYield): void;
export declare function sendToCpuWorker(port: MessagePort, msg: ScanLoopInput): void;
