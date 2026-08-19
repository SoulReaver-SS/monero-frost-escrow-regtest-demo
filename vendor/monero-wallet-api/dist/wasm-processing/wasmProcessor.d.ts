import { TinyWASI } from "./wasi";
export type FunctionCallMeta = {
    function: string;
};
export type MemoryCallback = (ptr: number, len: number) => void;
export declare class WasmProcessor {
    /**
     * This method is invoked whenever a Rust function expects an array or string parameter.
     * You should use `writeArray` or `writeString` within the function assigned to this callback
     * to write the data into WebAssembly (Wasm) memory before calling the corresponding Wasm method.
     *
     * @param ptr - The WebAssembly memory address where the data should be written.
     * @param len - The number of bytes to write starting from the specified `ptr`.
     */
    writeToWasmMemory: MemoryCallback;
    /**
     * This method is invoked whenever a Rust function wants to return an array or string.
     * You should use `readArray` or `readString` within the function assigned to this callback
     * to read the data from WebAssembly (Wasm) memory after the corresponding Wasm method has written it.
     *
     * @param ptr - The WebAssembly memory address from which the data should be read.
     * @param len - The number of bytes to read starting from the specified `ptr`.
     */
    readFromWasmMemory: MemoryCallback;
    /**
     * This method is invoked whenever a Rust function wants to return an error json string.
     * You should use `readString` within the function assigned to this callback
     * to read the data from WebAssembly (Wasm) memory after the corresponding Wasm method has written it.
     *
     * @param ptr - The WebAssembly memory address from which the data should be read.
     * @param len - The number of bytes to read starting from the specified `ptr`.
     */
    readErrorFromWasmMemory: MemoryCallback;
    /**
     * Writes an array of bytes to a specified offset in WebAssembly memory.
     *
     * This method is typically used within `writeToWasmMemory` to write data into Wasm memory.
     * For more details, see {@link writeToWasmMemory}.
     *
     * @param ptr - The WebAssembly memory address where the data should be written.
     * @param len - The number of bytes to write starting from the specified `ptr`.
     * @param arr - The array of bytes to write into WebAssembly memory.
     *
     * @see {@link writeToWasmMemory}
     */
    writeArray: (ptr: number, len: number, arr: Uint8Array) => void;
    /**
     * Writes a string to a specified offset in WebAssembly memory.
     *
     * This method is typically used within `writeToWasmMemory` to write string data into Wasm memory.
     * For more details, see {@link writeToWasmMemory}.
     *
     * @param ptr - The WebAssembly memory address where the data should be written.
     * @param len - The number of bytes to write starting from the specified `ptr`.
     * @param str - The string to write into WebAssembly memory.
     *
     * @see {@link writeToWasmMemory}
     */
    writeString: (ptr: number, len: number, str: string) => void;
    /**
     * Reads an array of bytes from a specified offset in WebAssembly memory.
     *
     * This method is typically used within the function assigned to `readFromWasmMemory`
     * callback to read data written by Rust functions into Wasm memory.
     *
     * @param ptr - The WebAssembly memory address from which the data should be read.
     * @param len - The number of bytes to read starting from the specified `ptr`.
     * @returns A Uint8Array containing the bytes read from WebAssembly memory.
     *
     * @see {@link readFromWasmMemory}
     */
    readArray: (ptr: number, len: number) => Uint8Array<ArrayBuffer>;
    /**
     * Reads a string from a specified offset in WebAssembly memory.
     *
     * This method is typically used within `readFromWasmMemory` to read string data from Wasm memory.
     * For more details, see {@link readFromWasmMemory}.
     *
     * @param ptr - The WebAssembly memory address where the data should be read from.
     * @param len - The number of bytes to read starting from the specified `ptr`.
     * @param str - The string to read from WebAssembly memory.
     *
     * @see {@link readFromWasmMemory}
     */
    readString: (ptr: number, len: number) => string;
    tinywasi: TinyWASI;
    protected constructor();
    initWasmModule(wasm_module: Uint8Array<ArrayBuffer>): Promise<TinyWASI>;
    static init(wasm_module: Uint8Array<ArrayBuffer>): Promise<WasmProcessor>;
}
