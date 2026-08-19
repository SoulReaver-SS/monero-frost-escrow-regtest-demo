import { type GetBlocksBinBufferItem, type BlocksBufferLoopResult, type BlocksBufferIteratorResult, type ProcessScanResult, type BlockInfo } from "../../api";
import { type ScanLoopYield } from "./scanLoop";
import { type WorkItem } from "./scanLoop";
import { type ScanSettings } from "../../api";
import { type CacheRange, type ScanCache } from "./scanCache";
export type WalletConfig = {
    primary_address: string;
    secret_view_key: string;
    secret_spend_key?: string;
    subaddress_index: number;
};
export type WalletConfigPlusCache = {
    primary_address: string;
    secret_view_key: string;
    secret_spend_key?: string;
    subaddress_index: number;
    cache: ScanCache;
};
export type WorkToBeDone = {
    start_height: number;
    wallet_configs: WalletConfigPlusCache[];
    anchor_range: CacheRange;
    scan_settings: ScanSettings;
};
/**
 * this depends only on ScanSettings.json start_height and wallet caches scanned_ranges
 * side effect: will init wallet cache file if it does not exist
 * side effect: will merge scan ranges + add subaddreses to existing cache files
 * @param scan_settings_path
 */
export declare function findWorkToBeDone(scan_settings_path?: string, pathPrefix?: string): Promise<WorkToBeDone | false>;
export declare function workToBeDoneForBatch(cache: ScanCache, batch_meta_infos: BlockInfo[]): "skip" | {
    from: number;
};
/**
 * called when the blocks buffer generator yields "blocks_buffer_changed".
 * adds new work items for blocks buffer items not yet referenced.
 * per wallet
 */
export declare function makeWorkItemsFromBlocksBuffer(blocksBuffer: GetBlocksBinBufferItem[], workItemBuffer: WorkItem[], walletConfig: WalletConfigPlusCache, from?: number, to?: number): void;
export declare function makeWorkItemsForAllWallets(wallet_configs: WalletConfigPlusCache[], blocksBuffer: GetBlocksBinBufferItem[], workBuffer: WorkItem[]): void;
/**
 * called when a work item at the left end of the work buffer is done.
 * shifts done items off the left, and removes their batch from the
 * blocks buffer if no remaining work items reference it.
 */
export declare function reconcileWorkItemDone(blocksBuffer: GetBlocksBinBufferItem[], workItemBuffer: WorkItem[]): void;
/**
 * handle a yield from the blocks buffer fetch loop.
 */
export declare function handleBlocksYield(value: BlocksBufferLoopResult, scanSettingsPath?: string): Promise<{
    isBlocksBufferChanged: boolean;
}>;
/**
 * process a scan result for a completed work item.
 * updates the cache, writes to disk, marks work item done, reconciles blockbuffer with this.
 */
export declare function processWorkItem(item: WorkItem, workBuffer: WorkItem[], blocksBuffer: GetBlocksBinBufferItem[], pathPrefix: string, secret_spend_key?: string): Promise<ProcessScanResult>;
export type CoordinatorEvent = {
    type: "blocks_buffer_changed";
} | {
    type: "connection_status";
    status: any;
} | {
    type: "scan_ready";
    address: string;
    newCache: ScanCache;
    changed_outputs: {
        output: any;
        change_reason: string;
    }[];
} | {
    type: "all_idle";
} | {
    type: "shutdown_done";
} | {
    type: "error";
    error: Error;
};
export declare function setupCoordinator(scanSettingsPath?: string, pathPrefix?: string, stopSync?: AbortSignal): Promise<false | {
    blocksGenerator: AsyncGenerator<BlocksBufferLoopResult, any, any>;
    workBuffer: WorkItem[];
    blocksBuffer: GetBlocksBinBufferItem[];
    work_to_be_done: WorkToBeDone;
}>;
export type WalletSyncInfo = {
    walletConfig: WalletConfig;
    work_buffer: WorkItem[];
};
export type PortStatus = {
    port: MessagePort;
    promise: Promise<ScanLoopYield> | null;
};
export type BlocksBufferRacer = {
    src: "blocks";
    value: BlocksBufferIteratorResult;
};
export type ScanLoopRacer = ScanLoopYield;
export type Racers = BlocksBufferRacer | ScanLoopRacer;
export declare function resetInProgressWorkItems(workBuffer: WorkItem[]): void;
export declare function cancelBusyCpuPorts(ports: PortStatus[], timeoutMs?: number): Promise<void>;
/**
 * coordinator main (multithreaded): dispatches scan work to CPU workers
 * via MessagePorts, processes results in order per wallet.
 * falls back to single-threaded coordinator if no cpuPorts provided.
 */
export declare function coordinatorMainMultithreaded(scanSettingsPath?: string, pathPrefix?: string, cpuPorts?: MessagePort[], stopSync?: AbortSignal): AsyncGenerator<CoordinatorEvent>;
export declare function scheduleWorkOnCpuPorts(ports: PortStatus[], work_buffer: WorkItem[]): Promise<void>;
