import { type Output, type GetBlocksBinRequest, type GetBlocksResultMeta, type GetOutsBinRequest } from "./binaryEndpoints";
import { type FeeEstimateResponse, type GetBlockHeadersRangeParams, type GetOutputDistributionParams, type SendRawTransactionResult } from "./jsonEndpoints";
export type NETWORKS = "mainnet" | "stagenet" | "testnet";
import { type SignedTransaction, type Input } from "../send-functionality/transactionBuilding";
import { WasmProcessor } from "../wasm-processing/wasmProcessor";
/**
 * This class is useful to interact with Moneros DaemonRpc binary requests in a convenient way.
 * (similar to how you would interact with a REST api that gives you json back.)
 * The wasm part will handle the creation of the binary requests and parse the responses and return them as json.
 * {@link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_blocksbin}
 */
export declare class NodeUrl extends WasmProcessor {
    node_url: string;
    protected constructor(node_url: string);
    private _network;
    get network(): NETWORKS;
    private _genesis_hash;
    get genesis_hash(): string;
    static create(node_url?: string): Promise<NodeUrl>;
    /**
     * Executes a get_blocks.bin request and returns the raw binary response buffer.
     * @link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_blocksbin
     * @param params params for the get_blocks.bin request
     * @param stopSync optional AbortSignal
     * @returns the raw binary response buffer
     */
    getBlocksBinExecuteRequest(params: GetBlocksBinRequest, stopSync?: AbortSignal): Promise<Uint8Array<ArrayBufferLike>>;
    /**
     * Loads a getBlocks.bin response into the WASM module.
     * Unlike getBlocksBinExecuteRequest, this does not make a request, it parses an already fetched
     * binary response and stores it in WASM memory. Subsequent calls overwrite the stored response.
     * @param getBlocksBinResponseBuffer the raw binary response from the get_blocks.bin endpoint
     * @returns metadata about the loaded blocks (new_height, daemon_height, status, block_infos)
     */
    loadGetBlocksBinResponse(getBlocksBinResponseBuffer: Uint8Array): Promise<GetBlocksResultMeta>;
    /**
     * This request helps making requests to the get_outs.bin endpoint of the Monerod nodes.
     *  @link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_outsbin
     * @param outputIndexArrayToFetch an array of numbers that represent the output indices to be fetched. (candidates array returned from sampleDecoys for example)
     * @returns after the request is made it will return epee serialized objects as a binary array.
     */
    getOutsBin(outputIndexArrayToFetch: GetOutsBinRequest): Promise<import("./binaryEndpoints").GetOutsResponseBuffer>;
    /**
     * This request helps making requests to the get_outs.bin endpoint of the Monerod nodes.
     *  @link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_outsbin
     * @param outputIndexArrayToFetch an array of numbers that represent the output indices to be fetched. (candidates array returned from sampleDecoys for example)
     * @returns after the request is made it will return epee serialized objects that are then parsed into json.
     */
    getOutsBinJson(outputIndexArrayToFetch: GetOutsBinRequest): Promise<import("./binaryEndpoints").GetOutsBinResponse>;
    /**
     * fetch output distribution from node (necessary to make input - also named OutputWithDecoys in Monero-oxide)
     * @param params defaults to: { amounts: [0], binary: false }
     * @returns returns output distribution necessary to sample input candidates
     */
    getOutputDistribution(params?: GetOutputDistributionParams): Promise<number[]>;
    /**
     * fetch fee estimate from node
     * @returns fee estimate response
     */
    getFeeEstimate(): Promise<FeeEstimateResponse>;
    /**
     * sample decoys with distibution (cumulative)
     * @param outputToBeSpentIndex the index of the output to be spent
     * @param distribution cumulative distribution fetched from the node with getOutputDistribution()
     * @param candidatesLength the amount of candidates to be sampled + 1 (the result will also contain the original index so in total the length of the resulting array will be this + 2)
     * @returns SampledDecoys: {candidates: number[]} - an array with output indices including the spent index
     */
    sampleDecoys(outputToBeSpentIndex: number, distribution: number[], candidatesLength: number): import("../send-functionality/transactionBuilding").SampledDecoys;
    /**
     * makeInput helper that uses the wasm module to create an input for a transaction.
     * @param outputToBeSpent the output that should be spent
     * @param candidates array of output indices that can be used as decoys
     * @param get_outs_Response the response from a get_outs.bin request for the candidates
     * @returns the input serialized that can be used in transaction building
     */
    makeInput(outputToBeSpent: Output, candidates: number[], get_outs_Response: Uint8Array): Input;
    /**
     * Send a raw transaction to the node for broadcasting.
     * @link https://docs.getmonero.org/rpc-library/monerod-rpc/#send_raw_transaction
     * @param tx_as_hex tx_as_hex - string; Full transaction information as hexadecimal string.
     * @param do_not_relay (Optional) boolean; Stop relaying transaction to other nodes. Defaults to false.
     * @returns The response indicating success or failure, with validation details.
     */
    sendRawTransaction(tx_as_hex: SignedTransaction, do_not_relay?: boolean): Promise<SendRawTransactionResult>;
    /**
     * Retrieve block headers for a specified range of heights.
     * @link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_block_headers_range
     * @param params The parameters including start_height, end_height, and optional fill_pow_hash.
     * @returns The result object with headers, status, etc. Throws if the range is invalid:(end_height > daemonheight)
     */
    getBlockHeadersRange(params: GetBlockHeadersRangeParams): Promise<import("./jsonEndpoints").GetBlockHeadersRange>;
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
    addGenesisHashToBlockIds(params: GetBlocksBinRequest): Promise<GetBlocksBinRequest>;
}
export declare const LOCAL_NODE_DEFAULT_URL = "http://127.0.0.1:18081";
