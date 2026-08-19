import { type KeyImage } from "./computeKeyImage";
import { type BlockInfo, type FeeEstimateResponse, type GetBlockHeadersRange, type GetBlockHeadersRangeParams, type Output, type SendRawTransactionResult, type ViewPair } from "../../api";
import type { Payment } from "../../send-functionality/inputSelection";
export declare function initScanCache(viewpair: ViewPair, start_height: number, scan_settings_path?: string, pathPrefix?: string): Promise<CacheRange>;
export declare function getBlockInfoForHeight(height: number, node_url: string): Promise<BlockInfo>;
export declare function makeCacheRangeForHeight(height: number, node_url: string): Promise<CacheRange>;
export declare function initScanCacheFile(viewpair: ViewPair, scan_settings_path?: string, pathPrefix?: string): Promise<ScanCache>;
export declare function readCacheFile(cacheFilePath: string): Promise<ScanCache | undefined>;
export declare function cacheFileDefaultLocation(primary_address: string, pathPrefix?: string): string;
export declare function readCacheFileDefaultLocation(primary_address: string, pathPrefix?: string): Promise<ScanCache | undefined>;
export type WriteCacheFileParams = {
    primary_address: string;
    pathPrefix?: string;
    writeCallback: (cache: ScanCache) => void | Promise<void>;
};
export declare function writeCacheFileDefaultLocationThrows(params: WriteCacheFileParams): Promise<void>;
export declare function writeCacheToFile(cache: ScanCache, pathPrefix?: string): Promise<number>;
export declare function lastRange(ranges: CacheRange[]): CacheRange | undefined;
export declare function lastRangeThrows(ranges: CacheRange[]): CacheRange;
export declare function mergeRanges(ranges: CacheRange[]): CacheRange[];
export declare const findRange: (ranges: CacheRange[], value: number) => CacheRange | null;
export declare function findRangeThrows(ranges: CacheRange[], value: number): CacheRange;
export type CacheRange = {
    start: number;
    end: number;
    block_hashes: BlockInfo[];
};
export type GlobalOutputId = string;
export type OutputsCache = Record<GlobalOutputId, Output>;
export type OwnKeyImages = Record<KeyImage, GlobalOutputId>;
export type Subaddress = {
    minor: number;
    address: string;
    created_at_height: number;
    created_at_timestamp: number;
    not_yet_included?: boolean;
    received_amount?: bigint;
    pending_amount?: bigint;
};
export type ScanCache = {
    outputs: OutputsCache;
    own_key_images: OwnKeyImages;
    scanned_ranges: CacheRange[];
    primary_address: string;
    tx_logs?: TxLog[];
    pending_spent_utxos?: Record<GlobalOutputId, number>;
    subaddresses?: Subaddress[];
    reorg_info?: ReorgInfo;
    daemon_height: number;
};
export type ReorgInfo = {
    split_heights: BlockInfo[];
    removed_outputs: ReorgedOutput[];
    reverted_spends: ReorgedOutput[];
};
export type ReorgedOutput = {
    old_output_state: Output;
    key_image: KeyImage;
    split_height: BlockInfo;
};
export type TxLog = {
    inputs_index: string[];
    payments: Payment[];
    node_url: string;
    height: number;
    timestamp: number;
    feeEstimate?: FeeEstimateResponse;
    sendResult?: SendRawTransactionResult;
    error?: string;
};
export type ChangeReason = "spent" | "added" | "ownspend" | "reorged" | "reorged_spent" | "burned";
export type ChangedOutput = {
    output: Output;
    change_reason: ChangeReason;
};
export type CacheChangedCallbackParameters = {
    newCache: ScanCache;
    changed_outputs: ChangedOutput[];
};
export type CacheChangedCallbackSync<R = void> = (params: CacheChangedCallbackParameters) => R;
export type CacheChangedCallbackAsync = CacheChangedCallbackSync<Promise<void>>;
/**
 * Callback invoked when the scan cache changes.
 *
 * @param params - The callback parameters.
 * @param params.newCache - The updated scan cache.
 * @param params.changed_outputs - Contains output and change_reason. {@link ChangedOutput}
 *
 */
export type CacheChangedCallback = CacheChangedCallbackSync | CacheChangedCallbackAsync;
export interface HasGetBlockHeadersRangeMethod {
    getBlockHeadersRange: (params: GetBlockHeadersRangeParams) => Promise<GetBlockHeadersRange>;
}
export interface HasPrimaryAddress {
    primary_address: string;
}
export declare function handleScanError(error: unknown): void;
export declare function isConnectionError(error: unknown): true | undefined;
