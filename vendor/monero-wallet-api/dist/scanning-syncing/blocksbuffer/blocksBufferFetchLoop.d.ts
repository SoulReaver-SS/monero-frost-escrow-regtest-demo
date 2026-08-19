import { NodeUrl, type BlockInfo, type CacheRange, type GetBlocksResultMeta } from "../../api";
import { type ConnectionSatusLastPacket, type ConnectionStatus, type ConnectionStatusSync } from "../connectionStatus";
export type GetBlocksBinBufferItem = {
    local_uuid: string;
    get_blocks_result_meta: GetBlocksResultMeta;
    data: Uint8Array;
};
export declare const MAX_BLOCKS_BUFFER_SIZE = 10;
export type BlocksBufferIteratorResult = IteratorYieldResult<BlocksBufferLoopResult>;
export type BlocksBufferLoopResult = ConnectionSatusLastPacket | ConnectionStatusSync | GetBlocksBinBufferItem;
export declare function blocksBufferFetchLoop(node_url: string, start_height: number, blocks_buffer: GetBlocksBinBufferItem[], // pass by reference
connection_status: ConnectionStatus, // we make a local copy of this and pass last_packet and sync updates seperately
max_blocks_buffer_size?: number, anchor_range?: CacheRange, stopSync?: AbortSignal): AsyncGenerator<BlocksBufferLoopResult>;
export declare function makeBlocksBufferItem(result_meta: GetBlocksResultMeta, get_blocks_bin: Uint8Array): GetBlocksBinBufferItem;
export declare function popBlocksBufferItemFromIndex(blocks_buffer: GetBlocksBinBufferItem[], index: number): GetBlocksBinBufferItem | undefined;
export declare function findBufferitemBySplitHeight(blocks_buffer: GetBlocksBinBufferItem[], split_height: BlockInfo): GetBlocksBinBufferItem | undefined;
export declare function findBufferItemIndexByLocalId(blocks_buffer: GetBlocksBinBufferItem[], local_uuid: string): number;
export declare function popBlocksBufferItemsFromSplitHeight(blocks_buffer: GetBlocksBinBufferItem[], split_height: BlockInfo): GetBlocksBinBufferItem[];
export declare function doRPCrequest(nodeUrl: NodeUrl, current_range: CacheRange, stopSync?: AbortSignal): Promise<Uint8Array<ArrayBufferLike>>;
export type BlocksBufferScanStatus = {
    current_range: CacheRange;
    scanned_ranges: CacheRange[];
};
export type BlocksBufferReorgResult = BlocksBufferScanStatus & {
    split_height?: BlockInfo;
};
export declare function initScannedRanges(node_url: string, start_height: number, scanned_ranges?: CacheRange[]): Promise<BlocksBufferScanStatus>;
export declare function updateBlocksBufferScanHeight(current_range: CacheRange, result_meta: GetBlocksResultMeta, scanned_ranges: CacheRange[]): Promise<BlocksBufferReorgResult>;
export declare function makeNewBlocksBufferScanRange(newRange: CacheRange, scanned_ranges: CacheRange[]): CacheRange;
export declare function handleBlocksBufferReorg(current_range: CacheRange, result_meta: GetBlocksResultMeta, scanned_ranges: CacheRange[], oldRange: CacheRange): Promise<BlocksBufferReorgResult>;
/**
 * getBlocks.bin monero RPC call will block clients as peers,
 * after 3 attempts of fetching a height higher than tip,
 * this is ugly but it is what it is, so we need to do a get_info
 * rpc call to get the tip height and reduce the start_height to the tip height,
 * if it is larger than the tip height
 * @param start_height
 * @param node_url
 * @returns Promise<number>  a promise with the new potentially reduced start_height
 */
export declare function reduceStartHeightToTip(start_height: number, node_url: string): Promise<number>;
export declare class CatastrophicReorgError extends Error {
    name: string;
}
