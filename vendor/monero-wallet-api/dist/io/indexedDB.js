import { writeEnvLineToDotEnvRefresh } from "../keypairs-seeds/writeKeypairs";
class IndexedDBBun {
    stdin = new IndexedDBFile();
    stdout = new IndexedDBFile();
    stderr = new IndexedDBFile();
    file(path, options) {
        return new IndexedDBFile(getFileFromIndexedDB(path.toString()), path.toString());
    }
    async write(destination, input) {
        return await putFileIntoIndexedDB(destination.toString(), input);
    }
    env = {};
}
class IndexedDBFile {
    content;
    path;
    size = 0;
    type = "";
    constructor(content, path) {
        this.content = content;
        this.path = path;
    }
    async text() {
        const result = (await this.content);
        if (!result)
            throw new Error(`no such file or directory, open '${this.path}'`);
        return result;
    }
    stream() {
        throw new Error("not implemented");
        return new ReadableStream();
    }
    async arrayBuffer() {
        const result = (await this.content);
        if (!result)
            throw new Error(`no such file or directory, open '${this.path}'`);
        return result;
    }
    json() {
        throw new Error("not implemented");
        return Promise.resolve({});
    }
    writer(params) {
        throw new Error("not implemented");
        return new BunFileSink();
    }
    exists() {
        if (!this.path)
            return Promise.resolve(false);
        return getFileFromIndexedDB(this.path)
            .then((r) => r !== undefined)
            .catch(() => false);
    }
    delete() {
        return deleteFileFromIndexedDB(this.path);
    }
}
class BunFileSink {
    write(chunk) {
        throw new Error("not implemented");
        return 0;
    }
    flush() {
        throw new Error("not implemented");
        return 0;
    }
    end(error) {
        throw new Error("not implemented");
        return 0;
    }
    start(options) {
        throw new Error("not implemented");
    }
    ref() {
        throw new Error("not implemented");
    }
    unref() {
        throw new Error("not implemented");
    }
}
export async function getItemLength(input) {
    if (typeof input === "string") {
        return [input, new TextEncoder().encode(input).length];
    }
    if (input instanceof Blob) {
        return [input, input.size];
    }
    if (ArrayBuffer.isView(input)) {
        return [input.buffer, input.byteLength];
    }
    if ("arrayBuffer" in input) {
        const bytes = await input.arrayBuffer();
        return [bytes, bytes.byteLength];
    }
    // SharedArrayBuffer/ArrayBuffer fallback
    if ("byteLength" in input) {
        return [input, input.byteLength];
    }
    throw new Error(`ENOSPC: unsupported input type`);
}
export async function putFileIntoIndexedDB(path, content) {
    if (!browserGlobal.filesDb) {
        throw new Error("IndexedDB not initialized");
    }
    const [dbContent, byteLength] = await getItemLength(content);
    const tx = browserGlobal.filesDb.transaction(fileStoreName, "readwrite");
    const store = tx.objectStore(fileStoreName);
    const request = store.put(dbContent, path);
    return await new Promise((resolve, reject) => {
        request.onsuccess = () => resolve(byteLength);
        request.onerror = () => reject(request.error);
    });
}
export function getFileFromIndexedDB(path) {
    if (!browserGlobal.filesDb) {
        throw new Error("IndexedDB not initialized");
    }
    else {
        const tx = browserGlobal.filesDb.transaction(fileStoreName, "readonly");
        const store = tx.objectStore(fileStoreName);
        const request = store.get(path);
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}
export async function deleteFileFromIndexedDB(path) {
    if (!browserGlobal.filesDb) {
        throw new Error("IndexedDB not initialized");
    }
    const tx = browserGlobal.filesDb.transaction(fileStoreName, "readwrite");
    const store = tx.objectStore(fileStoreName);
    const request = store.delete(path.trim());
    return new Promise((resolve, reject) => {
        request.onsuccess = () => resolve();
        request.onerror = () => reject(request.error);
    });
}
export const fileStoreName = "files";
async function initFilesDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open(fileStoreName);
        request.onerror = () => reject(request.error);
        request.onsuccess = () => resolve(request.result);
        request.onupgradeneeded = () => request.result.createObjectStore(fileStoreName);
    });
}
// In browsers: window in main thread, self in workers
const hasWindow = typeof window !== "undefined";
const hasSelf = typeof self !== "undefined";
//@ts-ignore
const browserGlobal = hasWindow ? window : hasSelf ? self : {}; // non-browser -> no shimming
if (typeof globalThis.Bun === "undefined") {
    browserGlobal.filesDb = await initFilesDB();
    browserGlobal.Bun = new IndexedDBBun();
    browserGlobal.Bun.env = await readEnvIndexedDB();
    browserGlobal.areWeInTheBrowser = true;
}
else {
    browserGlobal.areWeInTheBrowser = false;
}
export async function refreshEnvIndexedDB() {
    if (!areWeInTheBrowser)
        return;
    browserGlobal.Bun.env = await readEnvIndexedDB();
}
// we need this to change the env at runtime from inside the Browser extension,
// or react native app. Or to persist view keys in bun web backend.
// this one is specifically for indexedDB (convention of treating .env as Bun.env)
export async function writeEnvIndexedDB(key, value) {
    // this file should be treated as ephemeral
    // private spendkeys + viewkeys are deterministically derived from seedphrase and password
    // we have to go through indexedDB just so the background worker has access to this.
    // (after waking up from an alarm or onmessage event)
    await writeEnvLineToDotEnvRefresh(key, value, ".env");
}
export async function readEnvIndexedDB() {
    const file = Bun.file(".env");
    const content = await file
        .text()
        .catch(() => { })
        .then((c) => c || "");
    const lines = content.split("\n");
    const result = {};
    for (const line of lines) {
        const keyValue = line.split("=");
        const key = keyValue[0];
        if (!key)
            continue;
        const value = keyValue[1];
        result[key.trim()] = value?.trim();
    }
    return result;
}
/**
 * useless function
 * you can just do process.env[key] instead. Look at the code above.
 * @param key
 * @returns value
 */
export async function readEnvIndexedDBLine(key) {
    const file = Bun.file(".env");
    const content = await file.text();
    const lines = content.split("\n");
    const idx = lines.findIndex((line) => line.startsWith(key.trim()));
    return lines[idx].split("=")[1].trim();
}
export async function readdir(dirpath) {
    if (!browserGlobal.filesDb) {
        throw new Error("IndexedDB not initialized");
    }
    let prefix = dirpath.trim();
    if (prefix && !prefix.endsWith("/")) {
        prefix += "/";
    }
    const tx = browserGlobal.filesDb.transaction(fileStoreName, "readonly");
    const store = tx.objectStore(fileStoreName);
    const range = IDBKeyRange.bound(prefix, prefix + "\uffff", false, true);
    const keys = await new Promise((resolve, reject) => {
        const request = store.getAllKeys(range);
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
    });
    return keys.map((key) => key.slice(prefix.length));
}
