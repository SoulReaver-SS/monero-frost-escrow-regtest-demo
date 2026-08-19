import { type GetBlocksBinBufferItem, type ConnectionStatus, type BlocksBufferLoopResult, type CacheRange } from "../../api";
export type SetupBlocksBufferGeneratorParams = {
    nodeUrl: string;
    startHeight: number;
    anchor_range?: CacheRange;
    stopSync?: AbortSignal;
    maxBufferItems?: number;
    scanSettingsPath?: string;
};
export declare function setupBlocksBufferGenerator(params: SetupBlocksBufferGeneratorParams): Promise<{
    generator: AsyncGenerator<BlocksBufferLoopResult, any, any>;
    blocksBuffer: GetBlocksBinBufferItem[];
    connection_status: ConnectionStatus;
}>;
export declare function handleConnectionStatusChanges(event: BlocksBufferLoopResult, scanSettingsPath?: string): Promise<void>;
