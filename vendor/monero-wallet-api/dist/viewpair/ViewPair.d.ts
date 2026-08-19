import { type ScanResult } from "../scanning-syncing/scanresult/scanResult";
export { type ScanResult };
export { NodeUrl } from "../node-interaction/nodeUrl";
import { type GetBlocksBinMetaCallback, type GetBlocksBinRequest, type ErrorResponse } from "../node-interaction/binaryEndpoints";
import { type ScanCache } from "../scanning-syncing/scanresult/scanCache";
import { type MakeTransactionParams, type UnsignedTransaction } from "../send-functionality/transactionBuilding";
import { WasmProcessor } from "../wasm-processing/wasmProcessor";
import { type NETWORKS } from "../node-interaction/nodeUrl";
import { type GetBlockHeadersRangeParams } from "../api";
/**
 * This class is useful to interact with Moneros DaemonRpc binary requests in a convenient way.
 * (similar to how you would interact with a REST api that gives you json back.)
 * The wasm part will handle the creation of the binary requests and parse the responses and then parse them
 * and return outputs that belong to the ViewPair.
 * {@link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_blocksbin}
 */
export declare class ViewPair extends WasmProcessor {
    node_url: string;
    primary_address: string;
    private _network;
    get network(): NETWORKS;
    private _genesis_hash;
    get genesis_hash(): string;
    protected constructor(node_url: string, primary_address: string);
    static create(primary_address: string, secret_view_key: string, subaddress_index?: number, node_url?: string): Promise<ViewPair>;
    /**
     * This function helps with making requests to the get_blocks.bin endpoint of the Monerod nodes. It does the Request and returns the outputs that belong to the ViewPair.
     * (if outputs are found in the blocks that are returned)
     *
     * if params.block_ids is supplied, it will add the genesis hash to the end of the block_ids array.
     * (so you can just supply the block_id you want to start fetching from)
     * @link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_blocksbin
     * @param params params that will be turned into epee (monero lib that does binary serialization)
     * @param metaCallBack contains meta information about the getBlocksbin call (new sync height = start_height param + number of blocks)
     * @param stopSync optional AbortSignal to stop the syncing process
     * @returns The difference to the same method on NodeUrl is: It returns {@link ScanResult} (outputs that belong to viewpair) and not just the blocks as json.
     */
    getBlocksBin(params: GetBlocksBinRequest, metaCallBack?: GetBlocksBinMetaCallback, stopSync?: AbortSignal): Promise<ScanResult | ErrorResponse | undefined>;
    addGenesisHashToBlockIds(params: GetBlocksBinRequest): Promise<GetBlocksBinRequest>;
    /**
     * This function helps with making requests to the get_blocks.bin endpoint of the Monerod nodes.
     * if params.block_ids is supplied, it will add the genesis hash to the end of the block_ids array.
     * (so you can just supply the block_id you want to start fetching from)
     *
     * The difference compared to the getBlocksBin method is that it returns a Uint8Array that still has to be scanned for outputs.
     * This is useful if you want to scan multiple viewpairs at once. You can take the Uint8Array and pass it to another ViewPair to scan for outputs.
     * @param params params that will be turned into epee (monero lib that does binary serialization)
     * @param stopSync optional AbortSignal to stop the syncing process
     * @returns This method will return a Uint8Array that can subsequently be scanned for outputs with the getBlocksBinScanResponse method.
     */
    getBlocksBinExecuteRequest(params: GetBlocksBinRequest, stopSync?: AbortSignal): Promise<Uint8Array<ArrayBufferLike>>;
    /**
     * This function helps with scanning the response of the getBlocksBinExecuteRequest method.
     * It will parse the Uint8Array and return the outputs that belong to the ViewPair.
     * (if outputs are found in the blocks that are contained in the Uint8Array that was returned by the getBlocksBinExecuteRequest method)
     * @link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_blocksbin
     * @param getBlocksBinResponseBuffer the Uint8Array that was returned by the getBlocksBinExecuteRequest method.(which contains the blocks in binary format, returned from the Monerod node)
     * @param metaCallBack contains meta information about the getBlocksbin call (new sync height = start_height param + number of blocks)
     * @returns It returns {@link ScanResult} (outputs that belong to viewpair)
     */
    getBlocksBinScanResponse(getBlocksBinResponseBuffer: Uint8Array, metaCallBack?: GetBlocksBinMetaCallback): Promise<any>;
    /**
     * Loads a getBlocks.bin response into the WASM module without scanning for outputs.
     * The stored response can later be used to scan individual blocks. Subsequent calls
     * overwrite the previously stored response.
     * @param getBlocksBinResponseBuffer the raw binary response from the get_blocks.bin endpoint
     * @returns metadata about the loaded blocks (new_height, daemon_height, status, block_infos)
     */
    loadGetBlocksBinResponse(getBlocksBinResponseBuffer: Uint8Array): Promise<import("../api").GetBlocksResultMeta>;
    /**
     * scan one block from a getblocks.bin response that was loaded into wasm memory.
     * call loadGetBlocksBinResponse first to populate the response in the wasm module.
     * call this in a loop over blockIndex 0..meta.block_infos.length-1 to scan all blocks.
     * @param blockIndex index of the block within the loaded response (0-based)
     * @returns scan result with outputs and all key images for that one block.
     *          returns ErrorResponse (`{ error: string }`) if scanning fails.
     *          check `if ("error" in result)` before accessing outputs/key_images.
     *
     * error cases from the rust wasm (search these strings in rust/src/):
     * - "Block index {} out of bounds (total blocks: {})"
     *   blockIndex >= number of blocks in the loaded response
     * - "No getBlocks.bin response loaded. Call loadGetBlocksBinResponse first."
     *   forgot to call loadGetBlocksBinResponse before this method
     * - "Error scanning miner transaction: {}"
     *   the miner tx of the block could not be scanned
     * - "Error scanning block: {}"
     *   the block could not be scanned
     */
    getBlocksBinScanOneBlock(blockIndex: number): Promise<ScanResult | ErrorResponse>;
    /**
     * This method makes an integrated Address for the Address of the Viewpair it was opened with.
     * The network (mainnet, stagenet, testnet) is the same as the one of the Viewpairaddress.
     * @param paymentId (u64 under the hood) you can use a random number or a primary key of an sqlite db to associate payments with customer sessions.
     * @returns Adressstring
     */
    makeIntegratedAddress(paymentId: number): string;
    /**
     * This method makes a Subaddress for the Address of the Viewpair it was opened with.
     * The network (mainnet, stagenet, testnet) is the same as the one of the Viewpairaddress.
     * if there is an active scan going on, call this on ScanCacheOpened, so the new subaddress will be scanned
     *
     * @param minor address index, we always set major (also called account index) to 0
     * @returns Adressstring
     */
    makeSubaddress(minor: number): string;
    private writeSubaddressesToScanCache;
    addSubaddressesToScanCache(cache: ScanCache, scan_settings_path?: string): Promise<void>;
    /**
     * This method makes a Subaddress for the Address of the Viewpair it was opened with.
     * The network (mainnet, stagenet, testnet) is the same as the one of the Viewpairaddress.
     *
     * @param major account index should be set to 0 in most cases
     * @param minor address index starting at 1
     * @returns Adressstring
     */
    private makeSubaddressRaw;
    /**
     * Creates a signable transaction using the provided parameters.
     * @param params - The transaction parameters.
     * @returns The serialized transaction as an array of numbers.
     */
    makeTransaction(params: MakeTransactionParams): UnsignedTransaction;
    /**
     * makeSweepTransaction
     * @param params - The transaction parameters. Must have exactly one payment,
     *  the amount will be overwritten by the total amount of the inputs - the necessary fee
     *
     * @returns The serialized transaction as an array of numbers
     */
    makeSweepTransaction(params: MakeTransactionParams): string;
    /**
     * Retrieve block headers for a specified range of heights.
     * @link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_block_headers_range
     * @param params The parameters including start_height, end_height, and optional fill_pow_hash.
     * @returns The result object with headers, status, etc. Throws if the range is invalid:(end_height > daemonheight)
     */
    getBlockHeadersRange(params: GetBlockHeadersRangeParams): Promise<import("../api").GetBlockHeadersRange>;
    /**
     * Fetch general information about the Monero daemon.
     * @link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_info
     * @returns The result object with daemon info like height, status, etc.
     */
    getInfo(): Promise<{
        adjusted_time: number;
        alt_blocks_count: number;
        block_size_limit: number;
        block_size_median: number;
        block_weight_limit: number;
        block_weight_median: number;
        bootstrap_daemon_address: string;
        busy_syncing: boolean;
        credits: number;
        cumulative_difficulty: number;
        cumulative_difficulty_top64: number;
        database_size: number;
        difficulty: number;
        difficulty_top64: number;
        free_space: number;
        grey_peerlist_size: number;
        height: number;
        height_without_bootstrap: number;
        incoming_connections_count: number;
        mainnet: boolean;
        nettype: string;
        offline: boolean;
        outgoing_connections_count: number;
        restricted: boolean;
        rpc_connections_count: number;
        stagenet: boolean;
        start_time: number;
        status: string;
        synchronized: boolean;
        target: number;
        target_height: number;
        testnet: boolean;
        top_block_hash: string;
        top_hash: string;
        tx_count: number;
        tx_pool_size: number;
        untrusted: boolean;
        update_available: boolean;
        version: string;
        was_bootstrap_ever_used: boolean;
        white_peerlist_size: number;
        wide_cumulative_difficulty: string;
        wide_difficulty: string;
    }>;
}
