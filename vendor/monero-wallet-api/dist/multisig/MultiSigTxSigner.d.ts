import { WasmProcessor } from "../wasm-processing/wasmProcessor";
export type MoneroPreprocessParams = {
    threshold_key: string;
    unsigned_tx: string;
};
export type MoneroPreprocessResult = {
    preprocess: string;
};
export type MoneroSignParams = {
    preprocesses: Record<string, string>;
};
export type MoneroSignResult = {
    share: string;
};
export type MoneroCompleteParams = {
    shares: Record<string, string>;
};
export type MoneroCompleteResult = {
    signed_tx: string;
};
export type MoneroErrorResponse = {
    message: string;
};
export declare class MultiSigTxSigner extends WasmProcessor {
    static create(): Promise<MultiSigTxSigner>;
    /**
     * preprocess
     *
     * @param params threshold_key hex, unsigned_tx hex
     * @returns preprocess hex
     */
    preprocess(params: MoneroPreprocessParams): MoneroPreprocessResult;
    /**
     * preprocess -  does not throw, with return error type
     *
     * @param params threshold_key hex, unsigned_tx hex
     * @returns preprocess hex
     */
    preprocessNoThrow(params: MoneroPreprocessParams): MoneroPreprocessResult | MoneroErrorResponse;
    /**
     * sign
     *
     * @param params preprocesses map from all signers
     * @returns share hex
     */
    sign(params: MoneroSignParams): MoneroSignResult;
    /**
     * sign -  does not throw, with return error type
     *
     * @param params preprocesses map from all signers
     * @returns share hex
     */
    signNoThrow(params: MoneroSignParams): MoneroSignResult | MoneroErrorResponse;
    /**
     * complete
     *
     * @param params shares map from all signers
     * @returns signed_tx hex
     */
    complete(params: MoneroCompleteParams): MoneroCompleteResult;
    /**
     * complete -  does not throw, with return error type
     *
     * @param params shares map from all signers
     * @returns signed_tx hex
     */
    completeNoThrow(params: MoneroCompleteParams): MoneroCompleteResult | MoneroErrorResponse;
}
