import { atomicWrite, } from "../api";
import { SCAN_SETTINGS_STORE_NAME_DEFAULT } from "../api";
// wallet progress write: always set scan fields; only replace eta when a new one is provided
// so a missing eta does not wipe / flicker the previous value.
export function applyWalletScanProgress(cs, progress) {
    cs.sync.current_scan_height = progress.current_scan_height;
    if (progress.scanned_ranges) {
        cs.sync.scanned_ranges = progress.scanned_ranges;
    }
    if (typeof progress.daemon_height === "number") {
        cs.sync.daemon_height = progress.daemon_height;
    }
    if (progress.eta !== undefined) {
        cs.sync.eta = progress.eta;
    }
    cs.sync.timestamp = new Date().toISOString();
}
export const DEFAULT_CONNECTION_STATUS_PREFIX = "ConnectionStatus-";
export function msToHHMM(ms) {
    const totalSeconds = Math.floor(ms / 1000);
    const minutes = Math.floor(totalSeconds / 60);
    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;
    if (!Number.isFinite(hours) || !Number.isFinite(minutes)) {
        return "00:00";
    }
    const paddedHours = String(hours).padStart(2, "0");
    const paddedMinutes = String(remainingMinutes).padStart(2, "0");
    return `${paddedHours}:${paddedMinutes}`;
}
export function emptyConnectionStatus(overrides) {
    const defaultStatus = {
        last_packet: {
            status: "no_connection_yet",
            bytes_read: 0,
            node_url: "",
            timestamp: new Date().toISOString(),
        },
        sync: {
            scanned_ranges: [],
            daemon_height: 0,
            current_scan_height: 0,
            eta: "00:00",
            timestamp: new Date().toISOString(),
        },
    };
    return overrides ? { ...defaultStatus, ...overrides } : defaultStatus;
}
export function connectionStatusFilePath(scan_settings_path = SCAN_SETTINGS_STORE_NAME_DEFAULT) {
    const parts = scan_settings_path.split("/");
    const basename = parts.pop();
    const dir = parts.join("/");
    const prefix = dir ? `${dir}/` : "";
    return `${prefix}${DEFAULT_CONNECTION_STATUS_PREFIX}${basename}`;
}
export async function readConnectionStatusDefaultLocation(scan_settings_path) {
    return await readConnectionStatusFile(connectionStatusFilePath(scan_settings_path));
}
export async function readConnectionStatusFile(connectionStatusFilePath) {
    const jsonString = await Bun.file(connectionStatusFilePath)
        .text()
        .catch(() => undefined);
    return jsonString ? JSON.parse(jsonString) : undefined;
}
export async function writeConnectionStatusFile(connectionStatus, scan_settings_path) {
    return await atomicWrite(connectionStatusFilePath(scan_settings_path), JSON.stringify(connectionStatus, null, 2));
}
export async function readWriteConnectionStatusFile(writeCB, scan_settings_path) {
    let connectionStatus = await readConnectionStatusDefaultLocation(scan_settings_path);
    if (!connectionStatus)
        connectionStatus = emptyConnectionStatus();
    await writeCB(connectionStatus);
    await writeConnectionStatusFile(connectionStatus, scan_settings_path);
    return connectionStatus;
}
/**
 * read the connection status from disk (typical /path/to/ConnectionStatus-ScanSettings.json)
 * and persist empty inital status if not found
 * @param scan_settings_path  path to the scan settings file /path/to/ScanSettings.json
 * @returns connection status or empty initalized connection status
 */
export async function readOrInitConnectionStatus(scan_settings_path) {
    const cs = await readConnectionStatusFile(connectionStatusFilePath(scan_settings_path));
    if (typeof cs === "undefined") {
        const emptyInitial = emptyConnectionStatus();
        await writeConnectionStatusFile(emptyInitial, scan_settings_path);
        return emptyInitial;
    }
    return cs;
}
