import type { GetFeeEstimateResult, Output } from "../api";
import { WasmProcessor } from "../wasm-processing/wasmProcessor";
export type Input = string;
export type UnsignedTransaction = string;
export type SignedTransaction = string;
export declare function makeInput<T extends WasmProcessor>(processor: T, outputToBeSpent: Output, candidates: number[], get_outs_Response: Uint8Array): Input;
export type SampledDecoys = {
    candidates: number[];
};
export declare function sampleDecoys<T extends WasmProcessor>(processor: T, outputToBeSpentIndex: number, distribution: number[], candidatesLength: number): SampledDecoys;
export type MakeTransactionParams = {
    inputs: Input[];
    payments: {
        address: string;
        amount: string;
    }[];
    fee_response: GetFeeEstimateResult;
    fee_priority: string;
    outgoing_view_key?: string;
    data?: number[][];
};
export type NotEnoughFundsError = {
    inputs: number;
    necessary_fee: number;
    outputs: number;
};
export type ErrorDetail = {
    NotEnoughFunds: NotEnoughFundsError;
};
export type SendError = {
    error: ErrorDetail;
    message: string;
};
export declare function makeSweepTransaction<T extends WasmProcessor>(processor: T, params: MakeTransactionParams): UnsignedTransaction;
/**
 *  this function returns the unsigned transaction, throws {@link SendError}
 * @param processor
 * @param params
 * @returns
 */
export declare function makeTransaction<T extends WasmProcessor>(processor: T, params: MakeTransactionParams): UnsignedTransaction;
export declare function signTransaction(tx: UnsignedTransaction, sender_spend_key: string): Promise<SignedTransaction>;
export type ParsedAddress = {
    address: string;
    kind: "primary" | "subaddress" | "integrated" | "featured";
    network: "mainnet" | "stagenet" | "testnet";
    payment_id?: string;
};
export type ParseAddressError = {
    error: string;
};
export declare function parseAddress(address: string): Promise<ParsedAddress | ParseAddressError>;
