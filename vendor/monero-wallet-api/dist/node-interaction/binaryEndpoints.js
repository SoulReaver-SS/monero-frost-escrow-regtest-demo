export const MAINNET_GENESIS_BLOCK_HASH = "418015bb9ae982a1975da7d79277c2705727a56894ba0fb246adaabb1f4632e3";
export const STAGENET_GENESIS_BLOCK_HASH = "76ee3cc98646292206cd3e86f74d88b4dcc1d937088645e9b0cbca84b7ce74eb";
/**
 *  This function creates a binary request to the get_blocks.bin endpoint of the Monerod node.
 * @param processor it uses the wasm module to build the request and parse the response.
 * @param params params that will be turned into epee (moner lib that does binary serialization)
 * @returns a Uint8Array that can be used to make a fetch request to the get_blocks.bin endpoint.
 */
export function getBlocksBinMakeRequest(processor, params) {
    // https://github.com/monero-project/monero/blob/941ecefab21db382e88065c16659864cb8e763ae/src/rpc/core_rpc_server_commands_defs.h#L178
    //    enum REQUESTED_INFO
    //   {
    //     BLOCKS_ONLY = 0,
    //     BLOCKS_AND_POOL = 1,
    //     POOL_ONLY = 2
    //   };
    if (params.requested_info === "BLOCKS_AND_POOL") {
        params.requested_info = 1;
    }
    else if (params.requested_info === "POOL_ONLY") {
        params.requested_info = 2;
    }
    else {
        params.requested_info = 0;
    }
    if (params.prune === undefined)
        params.prune = true; // prune default true, our scan function expects pruned transactions
    const json_params = JSON.stringify(params);
    let getBlocksRequestArray;
    processor.writeToWasmMemory = (ptr, len) => {
        processor.writeString(ptr, len, json_params);
    };
    processor.readFromWasmMemory = (ptr, len) => {
        getBlocksRequestArray = processor.readArray(ptr, len);
    };
    let error = null;
    processor.readErrorFromWasmMemory = (ptr, len) => {
        error = JSON.parse(processor.readString(ptr, len));
    };
    //@ts-ignore
    processor.tinywasi.instance.exports.build_getblocksbin_request(json_params.length);
    if (!getBlocksRequestArray)
        // written in build_getblocksbin_request call to readFromWasmMemory
        throw error || new Error("failed to build get_blocks.bin request");
    return getBlocksRequestArray;
}
export async function getBlocksBinExecuteRequest(processor, params, stopSync) {
    const getBlocksRequestArray = getBlocksBinMakeRequest(processor, params);
    const getBlocksBinResponseBuffer = await binaryFetchRequest(processor.node_url + "/getblocks.bin", getBlocksRequestArray, // written in build_getblocksbin_request call to readFromWasmMemory
    stopSync);
    return getBlocksBinResponseBuffer;
}
export async function getBlocksBinScanResponse(processor, getBlocksBinResponseBuffer, metaCallBack) {
    processor.writeToWasmMemory = (ptr, len) => {
        processor.writeArray(ptr, len, getBlocksBinResponseBuffer);
    };
    let resultMeta;
    let result;
    processor.readFromWasmMemory = (ptr, len) => {
        resultMeta = JSON.parse(processor.readString(ptr, len));
        if (metaCallBack)
            metaCallBack(resultMeta);
        processor.readFromWasmMemory = (ptr, len) => {
            result = JSON.parse(processor.readString(ptr, len), (key, value) => {
                if (key === "amount")
                    return BigInt(value);
                return value;
            });
            if (!("error" in result)) {
                result.new_height = resultMeta.new_height;
                result.block_infos = resultMeta.block_infos;
                result.daemon_height = resultMeta.daemon_height;
            }
        };
    };
    //@ts-ignore
    processor.tinywasi.instance.exports.scan_blocks_with_get_blocks_bin(getBlocksBinResponseBuffer.length);
    return result; //result written in scan_blocks_with_get_blocks_bin
}
export async function getBlocksBinScan(processor, params, metaCallBack, stopSync) {
    const getBlocksBinResponseBuffer = await getBlocksBinExecuteRequest(processor, params, stopSync);
    return getBlocksBinScanResponse(processor, getBlocksBinResponseBuffer, metaCallBack);
}
/**
 * throws error on failure to create request
 * @param processor wasmprocessor
 * @param getouts_request_indices output indices to request
 * @returns array with epee serialized get_outs.bin request arguments
 */
export function getOutsBinMakeRequest(processor, getouts_request_indices) {
    let getOutsArray = undefined; // return value
    const getouts_json = JSON.stringify(getouts_request_indices); // argument
    processor.readFromWasmMemory = (ptr, len) => {
        // read result
        getOutsArray = processor.readArray(ptr, len);
    };
    processor.writeToWasmMemory = (ptr, len) => {
        // write argument
        processor.writeString(ptr, len, getouts_json);
    };
    //@ts-ignore
    processor.tinywasi.instance.exports.build_getoutsbin_request(getouts_json.length);
    if (!getOutsArray) {
        throw new Error("Failed to build get_outs.bin request");
    }
    return getOutsArray; // written in build_getblocksbin_request call to readFromWasmMemory
}
export async function getOutsBinExecuteRequest(processor, params) {
    const getOutsRequestArray = getOutsBinMakeRequest(processor, params);
    const getOutsBinResponseBuffer = await binaryFetchRequest(processor.node_url + "/get_outs.bin", getOutsRequestArray);
    return getOutsBinResponseBuffer;
}
export async function getOutsBinJson(processor, params) {
    const getOutsBinResponseBuffer = await getOutsBinExecuteRequest(processor, params);
    processor.writeToWasmMemory = (ptr, len) => {
        processor.writeArray(ptr, len, getOutsBinResponseBuffer);
    };
    let result;
    processor.readFromWasmMemory = (ptr, len) => {
        result = JSON.parse(processor.readString(ptr, len));
    };
    //@ts-ignore
    processor.tinywasi.instance.exports.convert_get_outs_bin_response_to_json(getOutsBinResponseBuffer.length);
    if (!result) {
        throw new Error("Failed to parse get_outs.bin response");
    }
    return result;
}
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
export async function loadGetBlocksBinResponse(processor, getBlocksBinResponseBuffer) {
    processor.writeToWasmMemory = (ptr, len) => {
        processor.writeArray(ptr, len, getBlocksBinResponseBuffer);
    };
    let resultMeta;
    processor.readFromWasmMemory = (ptr, len) => {
        resultMeta = JSON.parse(processor.readString(ptr, len));
    };
    //@ts-ignore
    processor.tinywasi.instance.exports.load_get_blocks_bin_response(getBlocksBinResponseBuffer.length);
    return resultMeta;
}
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
export async function getBlocksBinScanOneBlock(processor, blockIndex) {
    let result;
    processor.readFromWasmMemory = (ptr, len) => {
        result = JSON.parse(processor.readString(ptr, len), (key, value) => {
            if (key === "amount")
                return BigInt(value);
            return value;
        });
    };
    //@ts-ignore
    processor.tinywasi.instance.exports.get_blocks_bin_scan_one_block(blockIndex);
    return result;
}
export async function binaryFetchRequest(url, body, stopSync) {
    const response = await fetch(url, {
        body: body,
        method: "POST",
        signal: stopSync,
    });
    if (!response.ok)
        throw new Error(`HTTP ${response.status}`);
    const MAX_SIZE = 125829120; // 120MB
    const contentLength = parseInt(response.headers.get("content-length") || "0", 10);
    if (contentLength > MAX_SIZE) {
        throw new Error(`Response exceeds 120MB (${contentLength} bytes)`);
    }
    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > MAX_SIZE) {
        throw new Error(`Response exceeds 120MB (${buffer.byteLength} bytes)`);
    }
    return new Uint8Array(buffer);
}
