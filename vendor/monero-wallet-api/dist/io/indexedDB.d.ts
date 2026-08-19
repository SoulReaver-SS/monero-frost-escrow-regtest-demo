import type { BunFile, Bun, TypedArray } from "./BunFileInterface";
export type PossibleBunFileContent = string | Blob | ArrayBuffer | SharedArrayBuffer | TypedArray | Response;
declare class IndexedDBBun implements Bun {
    stdin: BunFile;
    stdout: BunFile;
    stderr: BunFile;
    file(path: string | number | URL, options?: {
        type?: string;
    }): BunFile;
    write(destination: string | number | BunFile | URL, input: PossibleBunFileContent): Promise<number>;
    env: BunEnv;
}
export type BunEnv = {
    [key: string]: string | undefined;
    TZ?: string | undefined;
    NODE_ENV?: string | undefined;
};
export type IndexedDBItem = string | Blob | ArrayBufferLike | ArrayBuffer | SharedArrayBuffer;
export declare function getItemLength(input: PossibleBunFileContent): Promise<[IndexedDBItem, number]>;
export declare function putFileIntoIndexedDB(path: string, content: PossibleBunFileContent): Promise<number>;
export declare function getFileFromIndexedDB(path: string): Promise<unknown>;
export declare function deleteFileFromIndexedDB(path: string): Promise<void>;
export declare const fileStoreName = "files";
export type BrowserGlobal = {
    filesDb?: IDBDatabase;
    Bun: IndexedDBBun;
    areWeInTheBrowser: boolean;
};
declare global {
    var areWeInTheBrowser: boolean;
}
export declare function refreshEnvIndexedDB(): Promise<void>;
export declare function writeEnvIndexedDB(key: string, value: string): Promise<void>;
export declare function readEnvIndexedDB(): Promise<{
    [key: string]: string;
}>;
/**
 * useless function
 * you can just do process.env[key] instead. Look at the code above.
 * @param key
 * @returns value
 */
export declare function readEnvIndexedDBLine(key: string): Promise<string>;
export declare function readdir(dirpath: string): Promise<string[]>;
export {};
