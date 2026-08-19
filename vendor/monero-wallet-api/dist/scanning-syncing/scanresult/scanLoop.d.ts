import { type GetBlocksBinBufferItem, type ScanResult, type WalletConfig, type WalletConfigPlusCache } from "../../api";
export type WorkItem = {
    walletConfig: WalletConfigPlusCache;
    batch: GetBlocksBinBufferItem;
    work_uuid: string;
    from: number;
    to: number;
    status: "fresh" | "scanwork_in_progress" | "scanwork_done" | "process_result_done";
    result?: ScanResult;
};
export declare function makeWorkItem(walletConfig: WalletConfigPlusCache, batch: GetBlocksBinBufferItem, from?: number, to?: number): WorkItem;
export type ScanLoopIteratorResult = IteratorYieldResult<ScanLoopYield>;
export type ScanLoopInput = WorkItem | "cancel" | undefined;
export type ScanLoopYield = {
    type: "Ready" | "InProgress" | "Canceled";
    work_uuid?: string;
    result?: ScanResult;
};
export declare function scanLoop(wallet: WalletConfig): AsyncGenerator<ScanLoopYield, void, ScanLoopInput>;
