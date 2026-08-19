import { type CacheRange, type ReorgInfo } from "../api";
export type ConnectionStatusOptions = "OK" | "partial_read" | "connection_failed" | "blocks_buffer_full" | "no_connection_yet" | "catastrophic_reorg";
export type ConnectionSatusLastPacket = {
    status: ConnectionStatusOptions;
    bytes_read: number;
    node_url: string;
    timestamp: string;
    daemon_height?: number;
};
export type ConnectionStatusSync = {
    reorg_info?: ReorgInfo;
    scanned_ranges: CacheRange[];
    daemon_height: number;
    current_scan_height: number;
    eta: string;
    timestamp: string;
};
export type ConnectionStatus = {
    last_packet: ConnectionSatusLastPacket;
    sync: ConnectionStatusSync;
};
export declare function applyWalletScanProgress(cs: ConnectionStatus, progress: {
    current_scan_height: number;
    scanned_ranges?: CacheRange[];
    daemon_height?: number;
    eta?: string;
}): void;
export declare const DEFAULT_CONNECTION_STATUS_PREFIX = "ConnectionStatus-";
export declare function msToHHMM(ms: number): string;
export declare function emptyConnectionStatus(overrides?: Partial<ConnectionStatus>): ConnectionStatus;
export declare function connectionStatusFilePath(scan_settings_path?: string): string;
export declare function readConnectionStatusDefaultLocation(scan_settings_path?: string): Promise<ConnectionStatus | undefined>;
export declare function readConnectionStatusFile(connectionStatusFilePath: string): Promise<ConnectionStatus | undefined>;
export declare function writeConnectionStatusFile(connectionStatus: ConnectionStatus, scan_settings_path?: string): Promise<number>;
export declare function readWriteConnectionStatusFile(writeCB: (cs: ConnectionStatus) => void, scan_settings_path?: string): Promise<ConnectionStatus>;
/**
 * read the connection status from disk (typical /path/to/ConnectionStatus-ScanSettings.json)
 * and persist empty inital status if not found
 * @param scan_settings_path  path to the scan settings file /path/to/ScanSettings.json
 * @returns connection status or empty initalized connection status
 */
export declare function readOrInitConnectionStatus(scan_settings_path?: string): Promise<ConnectionStatus>;
