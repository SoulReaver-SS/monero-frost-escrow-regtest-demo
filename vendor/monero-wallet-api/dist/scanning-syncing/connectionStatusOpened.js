import { readConnectionStatusFile, connectionStatusFilePath, } from "../api";
export class ConnectionStatusOpened {
    _onChange;
    _timer;
    _cached = null;
    _prevConnected = false;
    // notify when sync progress fields change, not only connect flip
    _prevSyncKey = "";
    _path;
    constructor(scan_settings_path, _onChange) {
        this._onChange = _onChange;
        this._path = connectionStatusFilePath(scan_settings_path);
    }
    async watch(intervalMs = 2500) {
        if (this._timer)
            return;
        await this._poll();
        this._timer = setInterval(() => this._poll(), intervalMs);
    }
    unwatch() {
        if (this._timer) {
            clearInterval(this._timer);
            this._timer = undefined;
        }
    }
    get connectionStatus() {
        return this._cached;
    }
    get isConnected() {
        const cs = this._cached;
        if (!cs?.last_packet)
            return false;
        const { status, timestamp } = cs.last_packet;
        if (status !== "OK" && status !== "blocks_buffer_full")
            return false;
        if (!timestamp)
            return false;
        const age = Date.now() - new Date(timestamp).getTime();
        return age >= 0 && age <= 10_000;
    }
    get daemonHeight() {
        return this._cached?.sync?.daemon_height;
    }
    _syncKey(cs) {
        const s = cs?.sync;
        if (!s)
            return "";
        return [
            s.daemon_height ?? "",
            s.current_scan_height ?? "",
            s.eta ?? "",
            s.timestamp ?? "",
        ].join("|");
    }
    async _poll() {
        this._cached =
            (await readConnectionStatusFile(this._path).catch(() => null)) || null;
        const now = this.isConnected;
        const syncKey = this._syncKey(this._cached);
        const connectedChanged = now !== this._prevConnected;
        const syncChanged = syncKey !== this._prevSyncKey;
        this._prevConnected = now;
        this._prevSyncKey = syncKey;
        if (connectedChanged || syncChanged) {
            this._onChange?.(this._cached);
        }
    }
}
