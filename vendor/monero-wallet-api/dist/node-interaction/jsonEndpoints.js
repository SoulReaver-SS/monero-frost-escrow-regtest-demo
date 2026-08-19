function obj(s) {
    function p(d) {
        if (typeof d !== "object" || d === null)
            throw 0;
        const r = {};
        for (const k in s)
            r[k] = s[k](d[k]);
        return r;
    }
    p.safeParse = (d) => {
        try {
            return { success: true, data: p(d) };
        }
        catch {
            return { success: false, error: new Error() };
        }
    };
    return p;
}
const str = (x) => {
    if (typeof x !== "string")
        throw 0;
    return x;
};
const num = (x) => {
    if (typeof x !== "number")
        throw 0;
    return x;
};
const bool = (x) => {
    if (typeof x !== "boolean")
        throw 0;
    return x;
};
const lit = (v) => (x) => {
    if (x !== v)
        throw 0;
    return v;
};
const arr = (f) => (x) => {
    if (!Array.isArray(x))
        throw 0;
    return x.map(f);
};
const opt = (f) => (x) => x === undefined ? undefined : f(x);
export const GetInfoResponseSchema = obj({
    id: str,
    jsonrpc: lit("2.0"),
    result: obj({
        adjusted_time: num,
        alt_blocks_count: num,
        block_size_limit: num,
        block_size_median: num,
        block_weight_limit: num,
        block_weight_median: num,
        bootstrap_daemon_address: str,
        busy_syncing: bool,
        credits: num,
        cumulative_difficulty: num,
        cumulative_difficulty_top64: num,
        database_size: num,
        difficulty: num,
        difficulty_top64: num,
        free_space: num,
        grey_peerlist_size: num,
        height: num,
        height_without_bootstrap: num,
        incoming_connections_count: num,
        mainnet: bool,
        nettype: str,
        offline: bool,
        outgoing_connections_count: num,
        restricted: bool,
        rpc_connections_count: num,
        stagenet: bool,
        start_time: num,
        status: str,
        synchronized: bool,
        target: num,
        target_height: num,
        testnet: bool,
        top_block_hash: str,
        top_hash: str,
        tx_count: num,
        tx_pool_size: num,
        untrusted: bool,
        update_available: bool,
        version: str,
        was_bootstrap_ever_used: bool,
        white_peerlist_size: num,
        wide_cumulative_difficulty: str,
        wide_difficulty: str,
    }),
});
/**
 * Response schema for the get_output_distribution method.
 *
 * @property id - The request ID.
 * @property jsonrpc - The JSON-RPC version.
 * @property result - The result object containing:
 *   - distributions: An array of distribution objects, each with:
 *     - amount: unsigned int Same as in the request. Use 0 to get all RingCT outputs.
 *     - base: unsigned int; The total number of outputs of amount in the chain before, not including, the block at start_height.
 *     - distribution: array of unsigned int
 *     - start_height:  unsigned int; Note that this is not necessarily equal to from_height, especially for amount=0 where start_height will be no less than the height of the v4 hardfork.
 *   - status: string; General RPC error code. "OK" means everything looks good.
 */
export const GetOutputDistributionResponseSchema = obj({
    id: str,
    jsonrpc: lit("2.0"),
    result: obj({
        distributions: arr(obj({
            amount: num,
            base: num,
            distribution: arr(num),
            start_height: num,
        })),
        status: str,
    }),
});
export function parseGetOutputDistributionResponse(data) {
    const result = GetOutputDistributionResponseSchema.safeParse(data);
    if (result.success) {
        return result.data;
    }
    else {
        console.error("Validation failed:", result.error);
        return null;
    }
}
export function parseGetInfoResponse(data) {
    const result = GetInfoResponseSchema.safeParse(data);
    if (result.success) {
        return result.data;
    }
    else {
        console.error("Validation failed:", result.error);
        return null;
    }
}
export async function get_info(NODE_URL) {
    const getInfoResponse = await fetch(NODE_URL + "/json_rpc", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: "0",
            method: "get_info",
        }),
    });
    if (!getInfoResponse.ok) {
        throw new Error(`Failed to get info: ${getInfoResponse.statusText}`);
    }
    const getInfoResult = await getInfoResponse.json();
    const parsedResult = parseGetInfoResponse(getInfoResult);
    if (parsedResult === null || !parsedResult.result?.height) {
        throw new Error("Failed to get height from get_info result");
    }
    return parsedResult.result;
}
export async function get_output_distribution(NODE_URL, params = {
    amounts: [0],
    binary: false,
    cumulative: true,
}) {
    const getOutputDistributionResponse = await fetch(NODE_URL + "/json_rpc", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: "0",
            method: "get_output_distribution",
            params,
        }),
    });
    if (!getOutputDistributionResponse.ok) {
        throw new Error(`Failed to get output distribution (for decoy sampling): ${getOutputDistributionResponse.statusText}`);
    }
    const getOutputDistributionResult = await getOutputDistributionResponse.json();
    const parsedResult = parseGetOutputDistributionResponse(getOutputDistributionResult);
    if (parsedResult === null || !parsedResult.result) {
        throw new Error("Failed to receive output distribution from node (get_output_distribution result)");
    }
    return parsedResult.result;
}
/**
 * Response schema for the get_fee_estimate method.
 *
 * @property id - The request ID.
 * @property jsonrpc - The JSON-RPC version.
 * @property result - The result object containing:
 *   - status: string; General RPC error code. "OK" means everything looks good.
 *   - fee: unsigned int; Base fee per byte.
 *   - fees: (Optional) Array of unsigned int; Fee estimates for priorities 1–4.
 *   - quantization_mask: unsigned int; Mask used for fee rounding.
 */
export const GetFeeEstimateResponseSchema = obj({
    id: str,
    jsonrpc: lit("2.0"),
    result: obj({
        status: str,
        fee: num,
        fees: opt(arr(num)),
        quantization_mask: num,
    }),
});
export function parseGetFeeEstimateResponse(data) {
    const result = GetFeeEstimateResponseSchema.safeParse(data);
    if (result.success) {
        return result.data;
    }
    else {
        console.error("Validation failed:", result.error);
        return null;
    }
}
export async function get_fee_estimate(NODE_URL) {
    // GRACE_BLOCKS_FOR_FEE_ESTIMATE: u64 = 10 (0xA) accoding to monero oxide
    const GRACE_BLOCKS_FOR_FEE_ESTIMATE = 10;
    const getFeeEstimateResponse = await fetch(NODE_URL + "/json_rpc", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: "0",
            method: "get_fee_estimate",
            params: { grace_blocks: GRACE_BLOCKS_FOR_FEE_ESTIMATE },
        }),
    });
    if (!getFeeEstimateResponse.ok) {
        throw new Error(`Failed to get fee estimate: ${getFeeEstimateResponse.statusText}`);
    }
    const getFeeEstimateResult = await getFeeEstimateResponse.json();
    const parsedResult = parseGetFeeEstimateResponse(getFeeEstimateResult);
    if (parsedResult === null || !parsedResult.result) {
        throw new Error("Failed to receive fee estimate from node (get_fee_estimate result)");
    }
    return parsedResult.result;
}
export const SendRawTransactionResponseSchema = obj({
    double_spend: bool, // double_spend - boolean; Transaction is a double spend (true) or not (false).
    fee_too_low: bool, // fee_too_low - boolean; Fee is too low (true) or OK (false).
    invalid_input: bool, // invalid_input - boolean; Input is invalid (true) or valid (false).
    invalid_output: bool, // invalid_output - boolean; Output is invalid (true) or valid (false).
    low_mixin: bool, // low_mixin - boolean; Mixin count is too low (true) or OK (false).
    not_rct: opt(bool), // not_rct - boolean; Transaction is a standard ring transaction (true) or a ring confidential transaction (false).
    not_relayed: bool, // not_relayed - boolean; Transaction was not relayed (true) or relayed (false).
    overspend: bool, // overspend - boolean; Transaction uses more money than available (true) or not (false).
    reason: str, // reason - string; Additional information. Currently empty or "Not relayed" if transaction was accepted but not relayed.
    status: str, // status - string; General RPC error code. "OK" means everything looks good. Any other value means that something went wrong.
    too_big: bool, // too_big - boolean; Transaction size is too big (true) or OK (false).
    untrusted: bool, // untrusted - boolean; States if the result is obtained using the bootstrap mode, and is therefore not trusted (true), or when the daemon is fully synced and thus handles the RPC locally (false)
});
export function parseSendRawTransactionResponse(data) {
    const result = SendRawTransactionResponseSchema.safeParse(data);
    if (result.success) {
        return result.data;
    }
    else {
        console.error("Validation failed:", result.error);
        return null;
    }
}
export async function send_raw_transaction(NODE_URL, tx_as_hex, // tx_as_hex - string; Full transaction information as hexadecimal string.
do_not_relay = false) {
    const sendRawTransactionResponse = await fetch(NODE_URL + "/send_raw_transaction", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({ tx_as_hex, do_not_relay }),
    });
    if (!sendRawTransactionResponse.ok) {
        throw new Error(`Failed to send raw transaction: ${sendRawTransactionResponse.statusText}`);
    }
    const sendRawTransactionResult = await sendRawTransactionResponse.json();
    const parsedResult = parseSendRawTransactionResponse(sendRawTransactionResult);
    if (parsedResult === null) {
        throw new Error("Failed to receive response from node (send_raw_transaction result)");
    }
    return parsedResult;
}
/**
 * Response schema for the get_block_headers_range method.
 *
 * @property id - The request ID.
 * @property jsonrpc - The JSON-RPC version.
 * @property result - The result object containing:
 * - credits: unsigned int; If payment for RPC is enabled, the number of credits available to the requesting client. Otherwise, 0.
 * - headers: array of block_header objects, each with:
 *   - block_size: unsigned int
 *   - block_weight: unsigned int
 *   - cumulative_difficulty: unsigned int
 *   - cumulative_difficulty_top64: unsigned int
 *   - depth: unsigned int
 *   - difficulty: unsigned int
 *   - difficulty_top64: unsigned int
 *   - hash: string
 *   - height: unsigned int
 *   - long_term_weight: unsigned int
 *   - major_version: unsigned int
 *   - miner_tx_hash: string
 *   - minor_version: unsigned int
 *   - nonce: unsigned int
 *   - num_txes: unsigned int
 *   - orphan_status: boolean
 *   - pow_hash: string (if fill_pow_hash is true)
 *   - prev_hash: string
 *   - reward: unsigned int
 *   - timestamp: unsigned int
 *   - wide_cumulative_difficulty: string
 *   - wide_difficulty: string
 * - status: string; General RPC error code. "OK" means everything looks good.
 * - top_hash: string; If payment for RPC is enabled, the hash of the highest block in the chain. Otherwise, empty.
 * - untrusted: boolean; States if the result is obtained using the bootstrap mode (true) or not (false).
 * @property error - Optional error object if the request failed:
 * - code: int; Error code.
 * - message: string; Error message.
 */
export const GetBlockHeadersRangeResponseSchema = obj({
    id: str,
    jsonrpc: lit("2.0"),
    result: opt(obj({
        credits: num,
        headers: arr(obj({
            block_size: num,
            block_weight: num,
            cumulative_difficulty: num,
            cumulative_difficulty_top64: num,
            depth: num,
            difficulty: num,
            difficulty_top64: num,
            hash: str,
            height: num,
            long_term_weight: num,
            major_version: num,
            miner_tx_hash: str,
            minor_version: num,
            nonce: num,
            num_txes: num,
            orphan_status: bool,
            pow_hash: str,
            prev_hash: str,
            reward: num,
            timestamp: num,
            wide_cumulative_difficulty: str,
            wide_difficulty: str,
        })),
        status: str,
        top_hash: str,
        untrusted: bool,
    })),
    error: opt(obj({
        code: num,
        message: str,
    })),
});
export function parseGetBlockHeadersRangeResponse(data) {
    const result = GetBlockHeadersRangeResponseSchema.safeParse(data);
    if (result.success) {
        return result.data;
    }
    else {
        console.error("Validation failed:", result.error);
        return null;
    }
}
export const RESTRICTED_BLOCK_HEADER_RANGE = 1000;
export async function get_block_headers_range(NODE_URL, params) {
    //https://github.com/monero-project/monero/blob/48ad374b0d6d6e045128729534dc2508e6999afe/src/rpc/core_rpc_server.cpp#L74
    // #define RESTRICTED_BLOCK_HEADER_RANGE 1000
    // https://github.com/monero-project/monero/blob/48ad374b0d6d6e045128729534dc2508e6999afe/src/rpc/core_rpc_server.cpp#L2612
    if (params.end_height - params.start_height > RESTRICTED_BLOCK_HEADER_RANGE) {
        throw new Error("Too many block headers requested. Max: " + RESTRICTED_BLOCK_HEADER_RANGE);
    }
    const getBlockHeadersRangeResponse = await fetch(NODE_URL + "/json_rpc", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            jsonrpc: "2.0",
            id: "0",
            method: "get_block_headers_range",
            params,
        }),
    });
    if (!getBlockHeadersRangeResponse.ok) {
        throw new Error(`Failed to get block headers range: ${getBlockHeadersRangeResponse.statusText}`);
    }
    const getBlockHeadersRangeResult = await getBlockHeadersRangeResponse.json();
    const parsedResult = parseGetBlockHeadersRangeResponse(getBlockHeadersRangeResult);
    if (parsedResult === null) {
        throw new Error("Failed to parse block headers range response from node");
    }
    if (parsedResult.error) {
        throw new Error(`RPC error: ${parsedResult.error.message} (code: ${parsedResult.error.code})`);
    }
    if (!parsedResult.result) {
        throw new Error("Failed to receive block headers range from node (missing result)");
    }
    return parsedResult.result;
}
