import { TinyWASI } from "./wasi";
export class WasmProcessor {
    /**
     * This method is invoked whenever a Rust function expects an array or string parameter.
     * You should use `writeArray` or `writeString` within the function assigned to this callback
     * to write the data into WebAssembly (Wasm) memory before calling the corresponding Wasm method.
     *
     * @param ptr - The WebAssembly memory address where the data should be written.
     * @param len - The number of bytes to write starting from the specified `ptr`.
     */
    writeToWasmMemory = (ptr, len) => { };
    /**
     * This method is invoked whenever a Rust function wants to return an array or string.
     * You should use `readArray` or `readString` within the function assigned to this callback
     * to read the data from WebAssembly (Wasm) memory after the corresponding Wasm method has written it.
     *
     * @param ptr - The WebAssembly memory address from which the data should be read.
     * @param len - The number of bytes to read starting from the specified `ptr`.
     */
    readFromWasmMemory = (ptr, len) => { };
    /**
     * This method is invoked whenever a Rust function wants to return an error json string.
     * You should use `readString` within the function assigned to this callback
     * to read the data from WebAssembly (Wasm) memory after the corresponding Wasm method has written it.
     *
     * @param ptr - The WebAssembly memory address from which the data should be read.
     * @param len - The number of bytes to read starting from the specified `ptr`.
     */
    readErrorFromWasmMemory = (ptr, len) => { };
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
    writeArray = (ptr, len, arr) => {
        const view = this.tinywasi.getDataView();
        for (let i = 0; i < arr.length; i++) {
            const offset = i + ptr;
            view.setUint8(offset, arr[i]);
        }
    };
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
    writeString = (ptr, len, str) => {
        const encoder = new TextEncoder();
        const arr = encoder.encode(str);
        this.writeArray(ptr, len, arr);
    };
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
    readArray = (ptr, len) => {
        const memory = this.tinywasi.getMemory();
        const original = new Uint8Array(memory.buffer, ptr, len);
        const copy = new Uint8Array(len);
        copy.set(original);
        return copy;
    };
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
    readString = (ptr, len) => {
        const array = this.readArray(ptr, len);
        const decoder = new TextDecoder();
        const str = decoder.decode(array);
        return str;
    };
    tinywasi;
    constructor() { }
    async initWasmModule(wasm_module) {
        const tinywasi = new TinyWASI();
        this.tinywasi = tinywasi;
        const imports = {
            env: {
                input: (ptr, len) => {
                    this.writeToWasmMemory(ptr, len);
                },
                output: (ptr, len) => {
                    this.readFromWasmMemory(ptr, len);
                },
                output_error: (ptr, len) => {
                    this.readErrorFromWasmMemory(ptr, len);
                },
            },
            ...tinywasi.imports,
        };
        const { module, instance } = await WebAssembly.instantiate(wasm_module, imports);
        tinywasi.initialize(instance);
        return tinywasi;
    }
    static async init(wasm_module) {
        const wasmProcessor = new WasmProcessor();
        await wasmProcessor.initWasmModule(wasm_module);
        return wasmProcessor;
    }
}
