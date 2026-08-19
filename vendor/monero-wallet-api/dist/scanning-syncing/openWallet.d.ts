import { ManyScanCachesOpened, ScanCacheOpened, type ManyScanCachesOpenedCreateOptions } from "./scanresult/scanCacheOpened";
/**
 * Opens all **non halted wallets listed in ScanSettings.json** for scanning.
 *
 * @param options.scan_settings_path if you want to use a different settings file other than the default "ScanSettings.json"
 * @param options.pathPrefix if you want to keep wallet scan caches, getblocksbinbuffer in a different directory
 * @param options.no_worker to feed the ManyScanCachesOpened manually with .feed(params) from CacheChangedCallbackParams
 * @param options.no_stats to disable creation of stats file with aggregated information e.g. amount per wallet / subaddress
 * @param options.notifyMasterChanged pass the output of this to another (no_worker) instance to feed
 * @param options.logs "console" | "file" | "console-and-file" | "off"
 * @param options.logs_include function names to include (e.g. handleCpuboundScan, blocksBufferFetchLoop)
 * @param options.logs_exclude function names to exclude
 * @returns Promise<ManyScanCachesOpened>
 */
export declare function openWallets(options?: ManyScanCachesOpenedCreateOptions): Promise<ManyScanCachesOpened>;
/**
 * Opens a **single wallet** for scanning.
 * **Touches ScanSettings.json**,
 *  halts all other wallets and scans only this wallet (use `openWallets()` for scanning all non halted wallets in the settings file).
 *
 * Scan runs in a worker thread to not block the main thread.
 *
 * @param primary_address Wallet address
 * @param scan_settings_path if you want to use a different settings file other than the default "ScanSettings.json"
 * @param pathPrefix if you want to keep wallet scan caches, getblocksbinbuffer in a different directory
 * @param no_worker to feed the ManyScanCachesOpened manually with .feed(params) from CacheChangedCallbackParams
 * @param options.no_stats to disable creation of stats file with aggregated information e.g. amount per wallet / subaddress
 * @returns Promise<ScanCacheOpened>
 */
export declare function openWallet(primary_address: string, scan_settings_path?: string, pathPrefix?: string, no_worker?: boolean, no_stats?: boolean): Promise<ScanCacheOpened>;
export declare function haltAllWalletsExcept(primary_address: string, scan_settings_path?: string): Promise<void>;
