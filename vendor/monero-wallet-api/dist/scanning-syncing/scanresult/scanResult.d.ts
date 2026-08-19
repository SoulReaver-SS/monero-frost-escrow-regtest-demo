import { type BlockInfo, type Output } from "../../api";
import { type KeyImage } from "./computeKeyImage";
import { type ErrorResponse } from "../../node-interaction/binaryEndpoints";
import type { CacheChangedCallback, CacheRange, ChangedOutput, ScanCache } from "./scanCache";
export type ProcessScanResultParams = {
    current_range: CacheRange;
    result: ScanResult | ErrorResponse | undefined;
    cacheChanged: CacheChangedCallback;
    catastrophic_reorg_cb: () => void;
    secret_spend_key?: string;
    pathPrefix?: string;
    use_master_current_range?: boolean;
};
export type ProcessScanResultParamsWithoutSideEffects = {
    from_height: number;
    secret_spend_key?: string;
    result: ScanResult | ErrorResponse | undefined;
    scanCache: ScanCache;
    to_height?: number;
};
export type ProcessScanResult = {
    current_range: CacheRange;
    changed_outputs: ChangedOutput[];
};
export declare function processScanResult(params: ProcessScanResultParamsWithoutSideEffects): Promise<ProcessScanResult>;
export declare function processResultReturnValue(cache: ScanCache, params: ProcessScanResultParamsWithoutSideEffects, changed_outputs: ChangedOutput[]): {
    current_range: CacheRange;
    changed_outputs: ChangedOutput[];
};
export type OnchainKeyImage = {
    key_image_hex: KeyImage;
    relative_index: number;
    tx_hash: string;
    block_hash: string;
    block_height: number;
    block_timestamp: number;
};
export type ScanResult = {
    outputs: Output[];
    all_key_images: OnchainKeyImage[];
    new_height: number;
    primary_address: string;
    block_infos: BlockInfo[];
    daemon_height: number;
};
export type EmptyScanResult = {};
export type FastForward = number;
/**
 * we will await async callbacks. convenient way to halt a sync + feed back the key image list,
 * to look out for our own spends before proceeding the scan. This happens in the processScanResult function.
 */
export type ScanResultCallback = ((result: ScanResult | ErrorResponse | EmptyScanResult) => FastForward | void) | ((result: ScanResult | ErrorResponse | EmptyScanResult) => Promise<FastForward | void>);
export declare function makeNewRange(newRange: CacheRange, cache: ScanCache): CacheRange;
export declare function detectOutputs(result: ScanResult, cache: ScanCache, spend_private_key?: string): Promise<ChangedOutput[]>;
export declare function detectOwnspends(result: ScanResult, cache: ScanCache): ChangedOutput[];
export declare function unlockedAtHeight(output: Output): number;
export type PrePending = {
    status: "prepending";
};
export type Pending = {
    status: "pending";
    unlock_height: number;
};
export type Spent = {
    status: "spent";
};
export type Burnt = {
    status: "burnt";
};
export type Reorged = {
    status: "reorged";
};
export type Spendable = {
    status: "spendable";
};
export type OutputStatus = PrePending | Pending | Spent | Burnt | Reorged | Spendable;
export declare function outputStatus(output: Output, cache: ScanCache, current_height: number): OutputStatus;
export declare function spendable(output: Output, cache: ScanCache, current_height: number): boolean;
export declare function findTipIndex(block_infos: BlockInfo[], oldTip: BlockInfo): number | "reorg_found" | "empty_blocks_array";
export declare function selectAnchors(block_infos: BlockInfo[], tipIndex: number, oldRange: CacheRange, endIndex?: number): CacheRange;
export declare function shouldReplaceAnchor(oldRange: CacheRange, last: BlockInfo): true | undefined;
export declare function newAnchorCandidates(oldRange: CacheRange, block_infos: BlockInfo[], tipIndex: number, endIndex: number, last: BlockInfo): {
    newCandidateAnchor: BlockInfo;
    newAnchor: BlockInfo;
};
