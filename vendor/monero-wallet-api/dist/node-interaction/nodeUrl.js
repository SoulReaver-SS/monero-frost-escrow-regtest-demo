import { getBlocksBinExecuteRequest, loadGetBlocksBinResponse, getOutsBinJson, getOutsBinExecuteRequest, MAINNET_GENESIS_BLOCK_HASH, STAGENET_GENESIS_BLOCK_HASH, } from "./binaryEndpoints";
import { get_block_headers_range, get_fee_estimate, get_info, get_output_distribution, send_raw_transaction, } from "./jsonEndpoints";
import { makeInput, sampleDecoys, } from "../send-functionality/transactionBuilding";
import { WasmProcessor } from "../wasm-processing/wasmProcessor";
import { monero_wallet_api_wasm } from "../wasm-processing/wasmFile";
/**
 * This class is useful to interact with Moneros DaemonRpc binary requests in a convenient way.
 * (similar to how you would interact with a REST api that gives you json back.)
 * The wasm part will handle the creation of the binary requests and parse the responses and return them as json.
 * {@link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_blocksbin}
 */
export class NodeUrl extends WasmProcessor {
    node_url;
    constructor(node_url) {
        super();
        this.node_url = node_url;
    }
    _network;
    get network() {
        return this._network; // we set this in ViewPair.create()
    }
    _genesis_hash;
    get genesis_hash() {
        if (!this._genesis_hash) {
            throw new Error("Genesis hash not set. Node not connected?");
        }
        return this._genesis_hash; // set in first call to ViewPair.getBlocksBin, if params.block_ids is supplied
    }
    static async create(node_url) {
        const nodeUrl = new NodeUrl(node_url || LOCAL_NODE_DEFAULT_URL);
        await nodeUrl.initWasmModule(monero_wallet_api_wasm);
        return nodeUrl;
    }
    /**
     * Executes a get_blocks.bin request and returns the raw binary response buffer.
     * @link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_blocksbin
     * @param params params for the get_blocks.bin request
     * @param stopSync optional AbortSignal
     * @returns the raw binary response buffer
     */
    async getBlocksBinExecuteRequest(params, stopSync) {
        return await getBlocksBinExecuteRequest(this, await this.addGenesisHashToBlockIds(params), stopSync);
    }
    /**
     * Loads a getBlocks.bin response into the WASM module.
     * Unlike getBlocksBinExecuteRequest, this does not make a request, it parses an already fetched
     * binary response and stores it in WASM memory. Subsequent calls overwrite the stored response.
     * @param getBlocksBinResponseBuffer the raw binary response from the get_blocks.bin endpoint
     * @returns metadata about the loaded blocks (new_height, daemon_height, status, block_infos)
     */
    loadGetBlocksBinResponse(getBlocksBinResponseBuffer) {
        return loadGetBlocksBinResponse(this, getBlocksBinResponseBuffer);
    }
    /**
     * This request helps making requests to the get_outs.bin endpoint of the Monerod nodes.
     *  @link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_outsbin
     * @param outputIndexArrayToFetch an array of numbers that represent the output indices to be fetched. (candidates array returned from sampleDecoys for example)
     * @returns after the request is made it will return epee serialized objects as a binary array.
     */
    getOutsBin(outputIndexArrayToFetch) {
        return getOutsBinExecuteRequest(this, outputIndexArrayToFetch);
    }
    /**
     * This request helps making requests to the get_outs.bin endpoint of the Monerod nodes.
     *  @link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_outsbin
     * @param outputIndexArrayToFetch an array of numbers that represent the output indices to be fetched. (candidates array returned from sampleDecoys for example)
     * @returns after the request is made it will return epee serialized objects that are then parsed into json.
     */
    getOutsBinJson(outputIndexArrayToFetch) {
        return getOutsBinJson(this, outputIndexArrayToFetch);
    }
    /**
     * fetch output distribution from node (necessary to make input - also named OutputWithDecoys in Monero-oxide)
     * @param params defaults to: { amounts: [0], binary: false }
     * @returns returns output distribution necessary to sample input candidates
     */
    async getOutputDistribution(params) {
        return (await get_output_distribution(this.node_url, params))
            .distributions[0].distribution;
    }
    /**
     * fetch fee estimate from node
     * @returns fee estimate response
     */
    getFeeEstimate() {
        return get_fee_estimate(this.node_url);
    }
    /**
     * sample decoys with distibution (cumulative)
     * @param outputToBeSpentIndex the index of the output to be spent
     * @param distribution cumulative distribution fetched from the node with getOutputDistribution()
     * @param candidatesLength the amount of candidates to be sampled + 1 (the result will also contain the original index so in total the length of the resulting array will be this + 2)
     * @returns SampledDecoys: {candidates: number[]} - an array with output indices including the spent index
     */
    sampleDecoys(outputToBeSpentIndex, distribution, candidatesLength) {
        return sampleDecoys(this, outputToBeSpentIndex, distribution, candidatesLength);
    }
    /**
     * makeInput helper that uses the wasm module to create an input for a transaction.
     * @param outputToBeSpent the output that should be spent
     * @param candidates array of output indices that can be used as decoys
     * @param get_outs_Response the response from a get_outs.bin request for the candidates
     * @returns the input serialized that can be used in transaction building
     */
    makeInput(outputToBeSpent, candidates, get_outs_Response) {
        return makeInput(this, outputToBeSpent, candidates, get_outs_Response);
    }
    /**
     * Send a raw transaction to the node for broadcasting.
     * @link https://docs.getmonero.org/rpc-library/monerod-rpc/#send_raw_transaction
     * @param tx_as_hex tx_as_hex - string; Full transaction information as hexadecimal string.
     * @param do_not_relay (Optional) boolean; Stop relaying transaction to other nodes. Defaults to false.
     * @returns The response indicating success or failure, with validation details.
     */
    async sendRawTransaction(tx_as_hex, do_not_relay = false) {
        return send_raw_transaction(this.node_url, tx_as_hex, do_not_relay);
    }
    /**
     * Retrieve block headers for a specified range of heights.
     * @link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_block_headers_range
     * @param params The parameters including start_height, end_height, and optional fill_pow_hash.
     * @returns The result object with headers, status, etc. Throws if the range is invalid:(end_height > daemonheight)
     */
    async getBlockHeadersRange(params) {
        return await get_block_headers_range(this.node_url, params);
    }
    /**
     * Fetch general information about the Monero daemon.
     * @link https://docs.getmonero.org/rpc-library/monerod-rpc/#get_info
     * @returns The result object with daemon info like height, status, etc.
     */
    async getInfo() {
        return get_info(this.node_url);
    }
    async addGenesisHashToBlockIds(params) {
        if (params.block_ids) {
            if (!this._genesis_hash && this.network === "mainnet") {
                this._genesis_hash = MAINNET_GENESIS_BLOCK_HASH;
            }
            if (!this._genesis_hash && this.network === "stagenet") {
                this._genesis_hash = STAGENET_GENESIS_BLOCK_HASH;
            }
            if (!this._genesis_hash) {
                // TESTNET
                const range = await this.getBlockHeadersRange({
                    start_height: 0,
                    end_height: 0,
                });
                this._genesis_hash = range.headers[0].hash;
            }
            params.block_ids.push(this.genesis_hash);
        }
        return params;
    }
}
export const LOCAL_NODE_DEFAULT_URL = "http://127.0.0.1:18081";
