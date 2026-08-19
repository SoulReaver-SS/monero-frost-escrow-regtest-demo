import { frost_dkg_wasm } from "../wasm-processing/wasmFile";
import { WasmProcessor } from "../wasm-processing/wasmProcessor";
export class MultiSigTxSigner extends WasmProcessor {
    static async create() {
        const signer = new MultiSigTxSigner();
        await signer.initWasmModule(frost_dkg_wasm);
        return signer;
    }
    /**
     * preprocess
     *
     * @param params threshold_key hex, unsigned_tx hex
     * @returns preprocess hex
     */
    preprocess(params) {
        const result = this.preprocessNoThrow(params);
        if ("message" in result) {
            throw new Error(`preprocess failed: ${result.message}`);
        }
        return result;
    }
    /**
     * preprocess -  does not throw, with return error type
     *
     * @param params threshold_key hex, unsigned_tx hex
     * @returns preprocess hex
     */
    preprocessNoThrow(params) {
        const jsonStr = JSON.stringify(params);
        this.writeToWasmMemory = (ptr, len) => {
            this.writeString(ptr, len, jsonStr);
        };
        let result;
        this.readFromWasmMemory = (ptr, len) => {
            result = JSON.parse(this.readString(ptr, len));
        };
        this.readErrorFromWasmMemory = (ptr, len) => {
            result = JSON.parse(this.readString(ptr, len));
        };
        //@ts-ignore
        this.tinywasi.instance.exports.monero_preprocess(jsonStr.length);
        if (!result) {
            return { message: "No response from monero_preprocess" };
        }
        return result;
    }
    /**
     * sign
     *
     * @param params preprocesses map from all signers
     * @returns share hex
     */
    sign(params) {
        const result = this.signNoThrow(params);
        if ("message" in result) {
            throw new Error(`sign failed: ${result.message}`);
        }
        return result;
    }
    /**
     * sign -  does not throw, with return error type
     *
     * @param params preprocesses map from all signers
     * @returns share hex
     */
    signNoThrow(params) {
        const jsonStr = JSON.stringify(params);
        this.writeToWasmMemory = (ptr, len) => {
            this.writeString(ptr, len, jsonStr);
        };
        let result;
        this.readFromWasmMemory = (ptr, len) => {
            result = JSON.parse(this.readString(ptr, len));
        };
        this.readErrorFromWasmMemory = (ptr, len) => {
            result = JSON.parse(this.readString(ptr, len));
        };
        //@ts-ignore
        this.tinywasi.instance.exports.monero_sign(jsonStr.length);
        if (!result) {
            return { message: "No response from monero_sign" };
        }
        return result;
    }
    /**
     * complete
     *
     * @param params shares map from all signers
     * @returns signed_tx hex
     */
    complete(params) {
        const result = this.completeNoThrow(params);
        if ("message" in result) {
            throw new Error(`complete failed: ${result.message}`);
        }
        return result;
    }
    /**
     * complete -  does not throw, with return error type
     *
     * @param params shares map from all signers
     * @returns signed_tx hex
     */
    completeNoThrow(params) {
        const jsonStr = JSON.stringify(params);
        this.writeToWasmMemory = (ptr, len) => {
            this.writeString(ptr, len, jsonStr);
        };
        let result;
        this.readFromWasmMemory = (ptr, len) => {
            result = JSON.parse(this.readString(ptr, len));
        };
        this.readErrorFromWasmMemory = (ptr, len) => {
            result = JSON.parse(this.readString(ptr, len));
        };
        //@ts-ignore
        this.tinywasi.instance.exports.monero_complete(jsonStr.length);
        if (!result) {
            return { message: "No response from monero_complete" };
        }
        return result;
    }
}
