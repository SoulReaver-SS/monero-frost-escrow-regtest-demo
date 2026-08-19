import type { BlockInfo, GetBlocksBinRequest, ViewPair } from "../../api";
import type { ScanSetting } from "../scanSettings";
import { type CacheRange } from "../scanresult/scanCache";
export declare function writeGetblocksBinBuffer(getBlocksBinResponseContent: Uint8Array, block_infos: BlockInfo[], pathPrefix?: string): Promise<GetBlocksBinBufferItemFilename | undefined>;
export type GetBlocksBinBufferItemFilename = {
    start: number;
    end: number;
    filename: string;
    date: string;
    last_block_hash: string;
};
export declare function readGetblocksBinBuffer(current_height: number, pathPrefix?: string): Promise<GetBlocksBinBufferItemFilename[]>;
export type BlocksGenerator = AsyncGenerator<Uint8Array>;
export type SlaveViewPair = {
    viewpair: ViewPair;
    current_range: CacheRange;
    secret_spend_key?: string;
};
declare module "bun" {
    interface BunFile {
        delete(): Promise<void>;
    }
}
export declare function trimGetBlocksBinBuffer(nonHaltedWallets: ScanSetting[], pathPrefix?: string): Promise<void>;
export declare function readGetblocksBinBufferItems(pathPrefix?: string): Promise<GetBlocksBinBufferItemFilename[]>;
export interface HasGetBlocksBinExecuteRequestMethod {
    getBlocksBinExecuteRequest: (params: GetBlocksBinRequest, stopSync?: AbortSignal) => Promise<Uint8Array>;
}
