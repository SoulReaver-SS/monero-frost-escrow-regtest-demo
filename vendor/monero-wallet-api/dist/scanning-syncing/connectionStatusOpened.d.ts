import { type ConnectionStatus } from "../api";
export declare class ConnectionStatusOpened {
    private _onChange?;
    private _timer;
    private _cached;
    private _prevConnected;
    private _prevSyncKey;
    private _path;
    constructor(scan_settings_path: string, _onChange?: ((status: ConnectionStatus | null) => void) | null | undefined);
    watch(intervalMs?: number): Promise<void>;
    unwatch(): void;
    get connectionStatus(): ConnectionStatus | null;
    get isConnected(): boolean;
    get daemonHeight(): number | undefined;
    private _syncKey;
    private _poll;
}
