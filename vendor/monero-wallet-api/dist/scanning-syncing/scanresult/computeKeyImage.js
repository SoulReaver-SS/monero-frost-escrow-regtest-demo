import { monero_wallet_api_wasm } from "../../wasm-processing/wasmFile";
import { WasmProcessor } from "../../wasm-processing/wasmProcessor";
export async function computeKeyImage(output, sender_spend_key, wasmProcessor) {
    if (!wasmProcessor)
        wasmProcessor = await WasmProcessor.init(monero_wallet_api_wasm);
    wasmProcessor.writeToWasmMemory = (ptr, len) => {
        wasmProcessor.writeString(ptr, len, output.serialized);
        wasmProcessor.writeToWasmMemory = (ptr, len) => {
            wasmProcessor.writeString(ptr, len, sender_spend_key);
        };
    };
    let result = undefined;
    wasmProcessor.readFromWasmMemory = (ptr, len) => {
        result = JSON.parse(wasmProcessor.readString(ptr, len));
    };
    //@ts-ignore
    wasmProcessor.tinywasi.instance.exports.compute_key_image(output.serialized.length, sender_spend_key.length);
    if (!result) {
        throw new Error("Failed to compute key image for output with global id: " +
            output.index_on_blockchain);
    }
    return result["key_image"];
}
