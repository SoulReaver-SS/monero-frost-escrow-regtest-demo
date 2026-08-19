import { monero_wallet_api_wasm } from "../wasm-processing/wasmFile";
import { WasmProcessor } from "../wasm-processing/wasmProcessor";
export function makeInput(processor, outputToBeSpent, candidates, get_outs_Response) {
    const makeInputArgs = JSON.stringify({
        serialized_input: outputToBeSpent.serialized,
        candidates,
    });
    processor.writeToWasmMemory = (ptr, len) => {
        processor.writeString(ptr, len, makeInputArgs);
        processor.writeToWasmMemory = (ptr, len) => {
            processor.writeArray(ptr, len, get_outs_Response);
        };
    };
    let result = null;
    processor.readFromWasmMemory = (ptr, len) => {
        result = JSON.parse(processor.readString(ptr, len));
    };
    //@ts-ignore
    processor.tinywasi.instance.exports.make_input(makeInputArgs.length, get_outs_Response.length);
    if (!result) {
        throw new Error("Failed to make Input (combine output with sampled and verified unlocked decoys)");
    }
    return result["input"];
}
export function sampleDecoys(processor, outputToBeSpentIndex, distribution, candidatesLength) {
    const sampleDecoyArgs = JSON.stringify({
        output_being_spent_index: outputToBeSpentIndex,
        distribution,
        candidates_len: candidatesLength,
    });
    processor.writeToWasmMemory = (ptr, len) => {
        processor.writeString(ptr, len, sampleDecoyArgs);
    };
    let result;
    processor.readFromWasmMemory = (ptr, len) => {
        result = JSON.parse(processor.readString(ptr, len));
    };
    //@ts-ignore
    processor.tinywasi.instance.exports.sample_decoys(sampleDecoyArgs.length);
    if (!result) {
        throw new Error("Failed to sample decoys");
    }
    return result;
}
export function makeSweepTransaction(processor, params) {
    const jsonParams = JSON.stringify(params);
    processor.writeToWasmMemory = (ptr, len) => {
        processor.writeString(ptr, len, jsonParams);
    };
    let result = null;
    let error = null;
    processor.readFromWasmMemory = (ptr, len) => {
        result = JSON.parse(processor.readString(ptr, len));
    };
    processor.readErrorFromWasmMemory = (ptr, len) => {
        error = JSON.parse(processor.readString(ptr, len));
    };
    //@ts-ignore
    processor.tinywasi.instance.exports.make_external_sweep_transaction(jsonParams.length);
    if (!result) {
        throw error;
    }
    return result["signable_transaction"];
}
/**
 *  this function returns the unsigned transaction, throws {@link SendError}
 * @param processor
 * @param params
 * @returns
 */
export function makeTransaction(processor, params) {
    const jsonParams = JSON.stringify(params);
    processor.writeToWasmMemory = (ptr, len) => {
        processor.writeString(ptr, len, jsonParams);
    };
    let result = null;
    let error = null;
    processor.readFromWasmMemory = (ptr, len) => {
        result = JSON.parse(processor.readString(ptr, len));
    };
    processor.readErrorFromWasmMemory = (ptr, len) => {
        error = JSON.parse(processor.readString(ptr, len));
    };
    //@ts-ignore
    processor.tinywasi.instance.exports.make_transaction(jsonParams.length);
    if (!result) {
        throw error;
    }
    return result["signable_transaction"];
}
export async function signTransaction(tx, sender_spend_key) {
    const wasmProcessor = await WasmProcessor.init(monero_wallet_api_wasm);
    wasmProcessor.writeToWasmMemory = (ptr, len) => {
        wasmProcessor.writeString(ptr, len, tx);
        wasmProcessor.writeToWasmMemory = (ptr, len) => {
            wasmProcessor.writeString(ptr, len, sender_spend_key);
        };
    };
    let result = null;
    wasmProcessor.readFromWasmMemory = (ptr, len) => {
        result = JSON.parse(wasmProcessor.readString(ptr, len));
    };
    //@ts-ignore
    wasmProcessor.tinywasi.instance.exports.sign_transaction(tx.length, sender_spend_key.length);
    if (!result) {
        throw new Error("Failed to sign transaction");
    }
    return result["signed_transaction"];
}
export async function parseAddress(address) {
    const wasmProcessor = await WasmProcessor.init(monero_wallet_api_wasm);
    wasmProcessor.writeToWasmMemory = (ptr, len) => {
        wasmProcessor.writeString(ptr, len, address);
    };
    let result = null;
    wasmProcessor.readFromWasmMemory = (ptr, len) => {
        result = JSON.parse(wasmProcessor.readString(ptr, len));
    };
    let error = null;
    wasmProcessor.readErrorFromWasmMemory = (ptr, len) => {
        error = JSON.parse(wasmProcessor.readString(ptr, len));
    };
    //@ts-ignore
    wasmProcessor.tinywasi.instance.exports.parse_address(address.length);
    if (!result) {
        if (!error) {
            throw new Error("Failed to parse address");
        }
        return error;
    }
    return result;
}
