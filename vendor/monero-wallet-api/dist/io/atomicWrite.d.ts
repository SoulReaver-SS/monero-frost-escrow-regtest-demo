import type { TypedArray } from "./BunFileInterface";
export declare function atomicWrite(targetPath: string, data: string | Blob | ArrayBuffer | SharedArrayBuffer | TypedArray | Response): Promise<number>;
