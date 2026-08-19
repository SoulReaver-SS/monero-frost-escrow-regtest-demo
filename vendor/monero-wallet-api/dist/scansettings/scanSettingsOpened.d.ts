import { type LogSetting, type PossibleLogs } from "../io/logging";
import { type ScanSetting, type ScanSettingOpened } from "../api";
export declare class ScanSettingsOpened {
    private _scan_settings_path;
    private _pathPrefix;
    /**
     * open the settings file and return a new ScanSettingsOpened instance.
     * if the file does not exist, creates one with defaults.
     */
    static create(scan_settings_path?: string, pathPrefix?: string): Promise<ScanSettingsOpened>;
    get node_url(): string;
    get start_height(): number | null;
    get merchant_confirmations(): number | null | undefined;
    get cpu_worker_count(): number | undefined;
    get logs(): LogSetting | undefined;
    get logs_include(): PossibleLogs[] | undefined;
    get logs_exclude(): PossibleLogs[] | undefined;
    get wallets(): ScanSetting[];
    get scan_settings_path(): string;
    get pathPrefix(): string;
    setNodeUrl(node_url: string): Promise<void>;
    setStartHeight(start_height: number | null): Promise<void>;
    setMerchantConfirmations(merchant_confirmations: number | undefined | null): Promise<void>;
    setCpuWorkerCount(cpu_worker_count: number | undefined | null): Promise<void>;
    setLogSettings(logs?: LogSetting | null, logs_include?: PossibleLogs[] | null, logs_exclude?: PossibleLogs[] | null): Promise<void>;
    /**
     * get a wallet's settings (without env keys).
     * returns undefined if not found.
     */
    getWallet(primary_address: string): ScanSetting | undefined;
    /**
     * get a wallet's settings merged with env keys.
     * throws if not found or view key missing.
     */
    getWalletOpened(primary_address: string): Promise<ScanSettingOpened>;
    /**
     * get all wallets merged with env keys.
     * wallets missing env keys are skipped.
     */
    getWalletsOpened(): Promise<ScanSettingOpened[]>;
    walletExists(primary_address: string): boolean;
    /**
     * add a new view wallet to settings and write its view key to env.
     * if the wallet already exists, updates it instead.
     */
    addViewWallet(primary_address: string, view_key: string, fields?: {
        wallet_name?: string;
        wallet_slot?: number;
        wallet_route?: string;
        subaddress_index?: number;
        halted?: boolean;
    }): Promise<void>;
    /**
     * add a new view wallet to settings and write its view key to env.
     * if the wallet already exists, updates it instead.
     */
    addSpendWallet(wallet_secret: Uint8Array, fields?: {
        wallet_name?: string;
        wallet_slot?: number;
        wallet_route?: string;
        subaddress_index?: number;
        halted?: boolean;
    }): Promise<void>;
    /**
     * remove a wallet from settings by primary address.
     * does not remove the view key from env.
     */
    removeWallet(primary_address: string): Promise<void>;
    /**
     * update specific fields on an existing wallet.
     * set a field to null to unset it.
     */
    updateWallet(primary_address: string, fields: {
        wallet_name?: string | null;
        wallet_slot?: number | null;
        wallet_route?: string | null;
        subaddress_index?: number | null;
        halted?: boolean | null;
    }): Promise<void>;
    haltWallet(primary_address: string): Promise<void>;
    unhaltWallet(primary_address: string): Promise<void>;
    setWalletName(primary_address: string, name?: string): Promise<void>;
    setWalletSlot(primary_address: string, slot?: number): Promise<void>;
    setWalletRoute(primary_address: string, route?: string): Promise<void>;
    setSubaddressIndex(primary_address: string, index?: number): Promise<void>;
    /**
     * reread the settings file from disk and replace inmemory state.
     */
    reload(): Promise<void>;
    /**
     * validate that all entries in logs_include and logs_exclude
     * are valid function names from LOGGING_FUNCTIONS.
     * throws if any entry is invalid.
     */
    private static _validateLogOptions;
    private static _validateAddress;
    private static _validateViewKey;
    private static _validateNodeUrl;
    private static _validateStartHeight;
    private static _validateCpuWorkerCount;
    private static _validateMerchantConfirmations;
    private static _validateWalletName;
    private static _validateWalletSlot;
    private static _validateSubaddressIndex;
    private static _validateWalletRoute;
    private static _validateHalted;
    private _settings;
    private constructor();
    /**
     * write current in memory state to disk.
     */
    private _persist;
}
export declare function walletRouteFromString(input: string): {
    ok: boolean;
    error: string;
    route?: undefined;
} | {
    ok: boolean;
    route: {
        identity: string;
        domain: string;
        wallet_type: string;
        wallet_slot: string;
    };
    error?: undefined;
};
