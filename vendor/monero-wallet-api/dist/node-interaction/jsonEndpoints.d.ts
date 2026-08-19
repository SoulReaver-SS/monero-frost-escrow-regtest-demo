import type { SignedTransaction } from "../send-functionality/transactionBuilding";
type R<T> = {
    success: true;
    data: T;
} | {
    success: false;
    error: Error;
};
type Infer<T> = T extends (x: unknown) => infer R ? R : never;
export declare const GetInfoResponseSchema: ((x: unknown) => {
    id: string;
    jsonrpc: "2.0";
    result: {
        adjusted_time: /*elided*/ any;
        alt_blocks_count: /*elided*/ any;
        block_size_limit: /*elided*/ any;
        block_size_median: /*elided*/ any;
        block_weight_limit: /*elided*/ any;
        block_weight_median: /*elided*/ any;
        bootstrap_daemon_address: /*elided*/ any;
        busy_syncing: /*elided*/ any;
        credits: /*elided*/ any;
        cumulative_difficulty: /*elided*/ any;
        cumulative_difficulty_top64: /*elided*/ any;
        database_size: /*elided*/ any;
        difficulty: /*elided*/ any;
        difficulty_top64: /*elided*/ any;
        free_space: /*elided*/ any;
        grey_peerlist_size: /*elided*/ any;
        height: /*elided*/ any;
        height_without_bootstrap: /*elided*/ any;
        incoming_connections_count: /*elided*/ any;
        mainnet: /*elided*/ any;
        nettype: /*elided*/ any;
        offline: /*elided*/ any;
        outgoing_connections_count: /*elided*/ any;
        restricted: /*elided*/ any;
        rpc_connections_count: /*elided*/ any;
        stagenet: /*elided*/ any;
        start_time: /*elided*/ any;
        status: /*elided*/ any;
        synchronized: /*elided*/ any;
        target: /*elided*/ any;
        target_height: /*elided*/ any;
        testnet: /*elided*/ any;
        top_block_hash: /*elided*/ any;
        top_hash: /*elided*/ any;
        tx_count: /*elided*/ any;
        tx_pool_size: /*elided*/ any;
        untrusted: /*elided*/ any;
        update_available: /*elided*/ any;
        version: /*elided*/ any;
        was_bootstrap_ever_used: /*elided*/ any;
        white_peerlist_size: /*elided*/ any;
        wide_cumulative_difficulty: /*elided*/ any;
        wide_difficulty: /*elided*/ any;
    };
}) & {
    safeParse(x: unknown): R<{
        id: string;
        jsonrpc: "2.0";
        result: {
            adjusted_time: /*elided*/ any;
            alt_blocks_count: /*elided*/ any;
            block_size_limit: /*elided*/ any;
            block_size_median: /*elided*/ any;
            block_weight_limit: /*elided*/ any;
            block_weight_median: /*elided*/ any;
            bootstrap_daemon_address: /*elided*/ any;
            busy_syncing: /*elided*/ any;
            credits: /*elided*/ any;
            cumulative_difficulty: /*elided*/ any;
            cumulative_difficulty_top64: /*elided*/ any;
            database_size: /*elided*/ any;
            difficulty: /*elided*/ any;
            difficulty_top64: /*elided*/ any;
            free_space: /*elided*/ any;
            grey_peerlist_size: /*elided*/ any;
            height: /*elided*/ any;
            height_without_bootstrap: /*elided*/ any;
            incoming_connections_count: /*elided*/ any;
            mainnet: /*elided*/ any;
            nettype: /*elided*/ any;
            offline: /*elided*/ any;
            outgoing_connections_count: /*elided*/ any;
            restricted: /*elided*/ any;
            rpc_connections_count: /*elided*/ any;
            stagenet: /*elided*/ any;
            start_time: /*elided*/ any;
            status: /*elided*/ any;
            synchronized: /*elided*/ any;
            target: /*elided*/ any;
            target_height: /*elided*/ any;
            testnet: /*elided*/ any;
            top_block_hash: /*elided*/ any;
            top_hash: /*elided*/ any;
            tx_count: /*elided*/ any;
            tx_pool_size: /*elided*/ any;
            untrusted: /*elided*/ any;
            update_available: /*elided*/ any;
            version: /*elided*/ any;
            was_bootstrap_ever_used: /*elided*/ any;
            white_peerlist_size: /*elided*/ any;
            wide_cumulative_difficulty: /*elided*/ any;
            wide_difficulty: /*elided*/ any;
        };
    }>;
};
export type GetInfoResponse = Infer<typeof GetInfoResponseSchema>;
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
export declare const GetOutputDistributionResponseSchema: ((x: unknown) => {
    id: string;
    jsonrpc: "2.0";
    result: {
        distributions: /*elided*/ any;
        status: /*elided*/ any;
    };
}) & {
    safeParse(x: unknown): R<{
        id: string;
        jsonrpc: "2.0";
        result: {
            distributions: /*elided*/ any;
            status: /*elided*/ any;
        };
    }>;
};
export type GetOutputDistributionResponse = Infer<typeof GetOutputDistributionResponseSchema>;
export declare function parseGetOutputDistributionResponse(data: unknown): GetOutputDistributionResponse | null;
export declare function parseGetInfoResponse(data: unknown): GetInfoResponse | null;
export declare function get_info(NODE_URL: string): Promise<{
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
/**
 * Parameters for retrieving output distribution information.
 *
 * @property amounts - Array of unsigned integers representing cleartext amounts to look for.
 *   Use 0 to get all RingCT outputs. defaults to [0].
 * @property cumulative - (Optional) If true, the result will be cumulative. Defaults to false.
 * @property from_height - (Optional) Starting block height (inclusive) to check from. Defaults to 0.
 * @property to_height - (Optional) Ending block height (inclusive) to check up to. Set to 0 to get the entire chain after from_height. Defaults to 0.
 * @property binary - boolean; for disabling epee encoding, defaults to false.
 * @property compress - (Optional) If true, enables compression. Ignored if binary is set to false.
 */
export type GetOutputDistributionParams = {
    amounts?: number[];
    cumulative?: boolean;
    from_height?: number;
    to_height?: number;
    binary?: boolean;
    compress?: boolean;
};
export declare function get_output_distribution(NODE_URL: string, params?: GetOutputDistributionParams): Promise<{
    distributions: {
        amount: number;
        base: number;
        distribution: number[];
        start_height: number;
    }[];
    status: string;
}>;
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
export declare const GetFeeEstimateResponseSchema: ((x: unknown) => {
    id: string;
    jsonrpc: "2.0";
    result: {
        status: /*elided*/ any;
        fee: /*elided*/ any;
        fees: /*elided*/ any;
        quantization_mask: /*elided*/ any;
    };
}) & {
    safeParse(x: unknown): R<{
        id: string;
        jsonrpc: "2.0";
        result: {
            status: /*elided*/ any;
            fee: /*elided*/ any;
            fees: /*elided*/ any;
            quantization_mask: /*elided*/ any;
        };
    }>;
};
export type GetFeeEstimateResponse = Infer<typeof GetFeeEstimateResponseSchema>;
export declare function parseGetFeeEstimateResponse(data: unknown): GetFeeEstimateResponse | null;
export type GetFeeEstimateResult = {
    status: string;
    fee: number;
    fees?: number[];
    quantization_mask: number;
};
export type FeeEstimateResponse = {
    status: string;
    fee: number;
    quantization_mask: number;
    fees?: number[] | undefined;
};
export declare function get_fee_estimate(NODE_URL: string): Promise<FeeEstimateResponse>;
export declare const SendRawTransactionResponseSchema: ((x: unknown) => {
    double_spend: boolean;
    fee_too_low: boolean;
    invalid_input: boolean;
    invalid_output: boolean;
    low_mixin: boolean;
    not_rct: boolean | undefined;
    not_relayed: boolean;
    overspend: boolean;
    reason: string;
    status: string;
    too_big: boolean;
    untrusted: boolean;
}) & {
    safeParse(x: unknown): R<{
        double_spend: boolean;
        fee_too_low: boolean;
        invalid_input: boolean;
        invalid_output: boolean;
        low_mixin: boolean;
        not_rct: boolean | undefined;
        not_relayed: boolean;
        overspend: boolean;
        reason: string;
        status: string;
        too_big: boolean;
        untrusted: boolean;
    }>;
};
export type SendRawTransactionResponse = Infer<typeof SendRawTransactionResponseSchema>;
export declare function parseSendRawTransactionResponse(data: unknown): SendRawTransactionResponse | null;
export type SendRawTransactionResult = {
    double_spend: boolean;
    fee_too_low: boolean;
    invalid_input: boolean;
    invalid_output: boolean;
    low_mixin: boolean;
    not_relayed: boolean;
    overspend: boolean;
    reason: string;
    status: string;
    too_big: boolean;
    untrusted: boolean;
    not_rct?: boolean | undefined;
};
export declare function send_raw_transaction(NODE_URL: string, tx_as_hex: SignedTransaction, // tx_as_hex - string; Full transaction information as hexadecimal string.
do_not_relay?: boolean): Promise<SendRawTransactionResult>;
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
export declare const GetBlockHeadersRangeResponseSchema: ((x: unknown) => {
    id: string;
    jsonrpc: "2.0";
    result: {
        credits: number;
        headers: {
            block_size: number;
            block_weight: number;
            cumulative_difficulty: number;
            cumulative_difficulty_top64: number;
            depth: number;
            difficulty: number;
            difficulty_top64: number;
            hash: string;
            height: number;
            long_term_weight: number;
            major_version: number;
            miner_tx_hash: string;
            minor_version: number;
            nonce: number;
            num_txes: number;
            orphan_status: boolean;
            pow_hash: string;
            prev_hash: string;
            reward: number;
            timestamp: number;
            wide_cumulative_difficulty: string;
            wide_difficulty: string;
        }[];
        status: string;
        top_hash: string;
        untrusted: boolean;
    } | undefined;
    error: {
        code: number;
        message: string;
    } | undefined;
}) & {
    safeParse(x: unknown): R<{
        id: string;
        jsonrpc: "2.0";
        result: {
            credits: number;
            headers: {
                block_size: number;
                block_weight: number;
                cumulative_difficulty: number;
                cumulative_difficulty_top64: number;
                depth: number;
                difficulty: number;
                difficulty_top64: number;
                hash: string;
                height: number;
                long_term_weight: number;
                major_version: number;
                miner_tx_hash: string;
                minor_version: number;
                nonce: number;
                num_txes: number;
                orphan_status: boolean;
                pow_hash: string;
                prev_hash: string;
                reward: number;
                timestamp: number;
                wide_cumulative_difficulty: string;
                wide_difficulty: string;
            }[];
            status: string;
            top_hash: string;
            untrusted: boolean;
        } | undefined;
        error: {
            code: number;
            message: string;
        } | undefined;
    }>;
};
export type GetBlockHeadersRangeResponse = Infer<typeof GetBlockHeadersRangeResponseSchema>;
export type GetBlockHeadersRange = {
    status: string;
    credits: number;
    headers: {
        block_size: number;
        block_weight: number;
        cumulative_difficulty: number;
        cumulative_difficulty_top64: number;
        depth: number;
        difficulty: number;
        difficulty_top64: number;
        hash: string;
        height: number;
        long_term_weight: number;
        major_version: number;
        miner_tx_hash: string;
        minor_version: number;
        nonce: number;
        num_txes: number;
        orphan_status: boolean;
        pow_hash: string;
        prev_hash: string;
        reward: number;
        timestamp: number;
        wide_cumulative_difficulty: string;
        wide_difficulty: string;
    }[];
    top_hash: string;
    untrusted: boolean;
};
export declare function parseGetBlockHeadersRangeResponse(data: unknown): GetBlockHeadersRangeResponse | null;
/**
 * Parameters for retrieving block headers in a range.
 *
 * @property start_height - unsigned int; The starting block's height.
 * @property end_height - unsigned int; The ending block's height.
 * @property fill_pow_hash - (Optional) boolean; Add PoW hash to block_header response. Defaults to false.
 */
export type GetBlockHeadersRangeParams = {
    start_height: number;
    end_height: number;
    fill_pow_hash?: boolean;
};
export declare const RESTRICTED_BLOCK_HEADER_RANGE = 1000;
export declare function get_block_headers_range(NODE_URL: string, params: GetBlockHeadersRangeParams): Promise<GetBlockHeadersRange>;
export {};
