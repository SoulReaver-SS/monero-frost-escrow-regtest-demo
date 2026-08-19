import type { ScanResult } from "../scanning-syncing/scanresult/scanResult";
import type { WasmProcessor } from "../wasm-processing/wasmProcessor";
export type GetBlocksBinRequest = {
    requested_info?: "BLOCKS_ONLY" | "BLOCKS_AND_POOL" | "POOL_ONLY" | number;
    block_ids?: string[];
    start_height?: number;
    prune?: boolean;
    no_miner_tx?: boolean;
    pool_info_since?: number;
};
/**
 * array of output indices to fetch
 */
export type GetOutsBinRequest = number[];
export type PoolInfo = {};
export type Transaction = {};
export type Block = {
    pruned: boolean;
    block: number[];
    block_weight: number;
    txs: "None" | Transaction[];
};
export type OutputIndex = {
    indices: {
        indices: number[];
    }[];
};
export type GetBlocksBinResponse = {
    status: "OK";
    untrusted: false;
    credits: number;
    top_hash: string;
    blocks: Block[];
    start_height: number;
    current_height: number;
    output_indices: OutputIndex[];
    daemon_time: number;
    pool_info: "None" | PoolInfo;
    new_height: number;
};
export type GetOutsBinResponse = {
    status: "OK";
    untrusted: boolean;
    credits: number;
    top_hash: string;
    outs: Array<{
        key: number[];
        mask: number[];
        unlocked: boolean;
        height: number;
        txid: number[];
    }>;
};
export type Status = "OK" | "BUSY" | "NOT MINING" | "PAYMENT REQUIRED" | "Failed." | string;
export type GetBlocksResultMeta = {
    new_height: number;
    daemon_height: number;
    status: Status;
    block_infos: BlockInfo[];
};
export type BlockInfo = {
    block_timestamp: number;
    block_height: number;
    block_hash: string;
};
export type Output = {
    amount: bigint;
    block_height: number;
    block_timestamp: number;
    index_in_transaction: number;
    index_on_blockchain: number;
    payment_id: number;
    stealth_address: string;
    tx_hash: string;
    is_miner_tx: boolean;
    primary_address: string;
    subaddress_index: number | null;
    serialized: string;
    spent_relative_index?: number;
    spent_in_tx_hash?: string;
    spent_block_height?: number;
    spent_block_timestamp?: number;
    burned?: number;
};
export type ErrorResponse = {
    error: string;
};
interface HasNodeUrl {
    node_url: string;
}
export type GetBlocksBinMetaCallback = (meta: GetBlocksResultMeta) => void;
export declare const MAINNET_GENESIS_BLOCK_HASH = "418015bb9ae982a1975da7d79277c2705727a56894ba0fb246adaabb1f4632e3";
export declare const STAGENET_GENESIS_BLOCK_HASH = "76ee3cc98646292206cd3e86f74d88b4dcc1d937088645e9b0cbca84b7ce74eb";
/**
 *  This function creates a binary request to the get_blocks.bin endpoint of the Monerod node.
 * @param processor it uses the wasm module to build the request and parse the response.
 * @param params params that will be turned into epee (moner lib that does binary serialization)
 * @returns a Uint8Array that can be used to make a fetch request to the get_blocks.bin endpoint.
 */
export declare function getBlocksBinMakeRequest<T extends WasmProcessor>(processor: T, params: GetBlocksBinRequest): Uint8Array<ArrayBufferLike>;
export declare function getBlocksBinExecuteRequest<T extends WasmProcessor & HasNodeUrl>(processor: T, params: GetBlocksBinRequest, stopSync?: AbortSignal): Promise<Uint8Array<ArrayBufferLike>>;
export declare function getBlocksBinScanResponse<T extends WasmProcessor>(processor: T, getBlocksBinResponseBuffer: Uint8Array, metaCallBack?: GetBlocksBinMetaCallback): Promise<ScanResult | ErrorResponse | undefined>;
export declare function getBlocksBinScan<T extends WasmProcessor & HasNodeUrl>(processor: T, params: GetBlocksBinRequest, metaCallBack?: GetBlocksBinMetaCallback, stopSync?: AbortSignal): Promise<ScanResult | ErrorResponse | undefined>;
/**
 * throws error on failure to create request
 * @param processor wasmprocessor
 * @param getouts_request_indices output indices to request
 * @returns array with epee serialized get_outs.bin request arguments
 */
export declare function getOutsBinMakeRequest<T extends WasmProcessor>(processor: T, getouts_request_indices: GetOutsBinRequest): Uint8Array;
export type GetOutsResponseBuffer = Uint8Array;
export declare function getOutsBinExecuteRequest<T extends WasmProcessor & HasNodeUrl>(processor: T, params: GetOutsBinRequest): Promise<GetOutsResponseBuffer>;
export declare function getOutsBinJson<T extends WasmProcessor & HasNodeUrl>(processor: T, params: GetOutsBinRequest): Promise<GetOutsBinResponse>;
/**
 * Loads a getBlocks.bin response into the WASM module for later single-block scanning
 * via repeated calls to scan_block. Unlike getBlocksBinScanResponse, this does not
 * scan any outputs,it only returns the block metadata (heights, timestamps, hashes).
 * Each call overwrites the previously stored response, so it can be called repeatedly
 * without leaking memory.
 * @param processor the WASM processor used to interface with the Rust module, eg ViewPair in viewpair.ts
 * @param getBlocksBinResponseBuffer the raw binary response from the get_blocks.bin endpoint
 * @returns metadata about the loaded blocks (new_height, daemon_height, status, block_infos)
 */
export declare function loadGetBlocksBinResponse<T extends WasmProcessor>(processor: T, getBlocksBinResponseBuffer: Uint8Array): Promise<GetBlocksResultMeta>;
/**
 * Scans a single block from the previously loaded getBlocks.bin response.
 * Call loadGetBlocksBinResponse first to load a response into WASM memory.
 * @param processor the WASM processor
 * @param blockIndex index of the block within the loaded response (0-based)
 * @returns scan result with outputs and key images for that one block
 *
 * ErrorResponse type:
 * the error messages come from the rust side in rust/src/:
 * - "Block index {} out of bounds (total blocks: {})"
 *   in lib.rs get_blocks_bin_scan_one_block, guards blockIndex against response.blocks.len
 * - "No getBlocks.bin response loaded. Call loadGetBlocksBinResponse first."
 *   in lib.rs get_blocks_bin_scan_one_block, when GLOBAL_GET_BLOCKS_BIN_RESPONSE is None
 * - "Error scanning miner transaction: {}"
 *   in block_parsing/mod.rs scan_block, scanner.scan_transaction failed when parsing miner tx of block
 * - "Error scanning block: {}"
 *   in block_parsing/mod.rs scan_block, scanner.scan(scan_block) failed
 * all errors are returned as { error: string } (ErrorResponse type)
 */
export declare function getBlocksBinScanOneBlock<T extends WasmProcessor>(processor: T, blockIndex: number): Promise<ScanResult | ErrorResponse>;
export declare function binaryFetchRequest(url: string, body: Uint8Array, stopSync?: AbortSignal): Promise<Uint8Array>;
export {};
