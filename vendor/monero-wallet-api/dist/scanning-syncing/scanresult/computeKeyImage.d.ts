import type { Output } from "../../api";
import { WasmProcessor } from "../../wasm-processing/wasmProcessor";
export type KeyImage = string;
export declare function computeKeyImage(output: Output, sender_spend_key: string, wasmProcessor?: WasmProcessor): Promise<KeyImage | undefined>;
