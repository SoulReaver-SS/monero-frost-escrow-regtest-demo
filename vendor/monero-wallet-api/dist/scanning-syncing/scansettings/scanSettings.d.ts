import type { LogSetting, PossibleLogs } from "../../io/logging";
export declare const SCAN_SETTINGS_STORE_NAME_DEFAULT = "ScanSettings.json";
export declare const SUB_ADDRESS_INDEX_DEFAULT_VALUE = 1;
export type ScanSetting = {
    primary_address: string;
    subaddress_index?: number;
    halted?: boolean;
    wallet_route?: string;
    wallet_name?: string;
    wallet_slot?: number;
};
export type WriteScanSettingParams = {
    primary_address: string;
    start_height?: number | null;
    subaddress_index?: number;
    halted?: boolean;
    scan_settings_path?: string;
    node_url?: string;
    wallet_route?: string;
    wallet_name?: string;
    wallet_slot?: number;
    logs?: LogSetting;
    logs_include?: PossibleLogs[];
    logs_exclude?: PossibleLogs[];
};
export type ScanSettingOpened = {
    primary_address: string;
    start_height: number | null;
    node_url: string;
    subaddress_index?: number;
    secret_view_key?: string;
    halted?: boolean;
    secret_spend_key?: string;
    wallet_route?: string;
    wallet_name?: string;
    wallet_slot?: number;
};
export type ScanSettings = {
    wallets: ScanSetting[];
    node_url: string;
    start_height: number | null;
    merchant_confirmations?: number | null;
    cpu_worker_count?: number;
    logs?: LogSetting;
    logs_include?: PossibleLogs[];
    logs_exclude?: PossibleLogs[];
};
export type ScanSettingsOpened = {
    wallets: (ScanSettingOpened | undefined)[];
    node_url: string;
    start_height: number | null;
    merchant_confirmations?: number | null;
    cpu_worker_count?: number;
    logs?: LogSetting;
    logs_include?: PossibleLogs[];
    logs_exclude?: PossibleLogs[];
};
/**
 * Writes scan settings to the default or specified storage file in json.
 *
 * @example
 * ```
 * const settings: ScanSettings = {
 *   wallets: [{
 *     primary_address: "5dsf...",
 *     start_height: 1741707,
 *   }],
 *   node_urls: ["https://monerooo.roooo"]
 * };
 * await writeScanSettings(settings);
 * ```
 *
 * @param scan_settings - The complete {@link ScanSettings} configuration to persist.
 * @param scan_settings_path - Optional path for the settings file. Defaults to `SCAN_SETTINGS_STORE_NAME_DEFAULT`.
 * @returns A promise that resolves when the file is successfully written.
 * @throws Will throw if file writing fails (e.g., permissions, disk space).
 */
export declare function writeScanSettings(scan_settings: ScanSettings, scan_settings_path?: string): Promise<number>;
export type WriteScanSettingsFileParams = {
    scan_settings_path?: string;
    writeCallback: (settings: ScanSettings) => void | Promise<void>;
};
export declare function writeScanSettingsFileDefaultLocation(params: WriteScanSettingsFileParams): Promise<void>;
export declare function writeStartHeightToScanSettings(start_height: number | null, scan_settings_path?: string): Promise<number>;
export declare function writeDaemonHeightAsStartHeightToScanSettings(node_url: string, scan_settings_path?: string): Promise<number>;
export declare function cullTooLargeScanHeight(node_url: string, scan_settings_path?: string): Promise<number>;
export declare function writeNodeUrlToScanSettings(node_url: string, scan_settings_path?: string): Promise<number>;
export declare function readNodeUrlFromScanSettings(scan_settings_path?: string): Promise<string | undefined>;
/**
 * Writes the merchant confirmation threshold to scan settings.
 *
 * This setting only has effect when the wallet is run as part of a checkout system,
 * that accepts payments.
 * It determines after how many confirmations a transaction is accepted
 * for a payment. The actual enforcement of this policy is left to the
 * custom payment-system code that consumes this library.
 *
 * @param merchant_confirmations - Number of confirmations required before
 *   accepting a payment, or `null` to leave it unset.
 * @param scan_settings_path - Optional path for the settings file.
 *   Defaults to `SCAN_SETTINGS_STORE_NAME_DEFAULT`.
 * @returns A promise that resolves when the file is successfully written.
 */
export declare function writeMerchantConfirmationsToScanSettings(merchant_confirmations: number | null, scan_settings_path?: string): Promise<number>;
/**
 * Reads the merchant confirmation threshold from scan settings.
 *
 * This setting only has effect when the wallet is run as part of a checkout system,
 * that accepts payments.
 *
 * It determines after how many confirmations a transaction is accepted
 * for a payment. The actual enforcement of this policy is left to the
 * custom payment-system code that consumes this library.
 *
 * @param scan_settings_path - Optional path for the settings file.
 *   Defaults to `SCAN_SETTINGS_STORE_NAME_DEFAULT`.
 * @returns The configured number of confirmations, null, or `undefined`
 *   if the setting has not been persisted yet.
 */
export declare function readMerchantConfirmationsFromScanSettings(scan_settings_path?: string): Promise<number | null | undefined>;
/**
 * Reads scan settings from the default or specified storage file.
 * secret_view_key and spend_private_key are read from environment variables
 *
 * @example
 * ```
 * const settings = await readScanSettings();
 * if (settings) {
 *   console.log(settings.wallets?.primary_address);
 * }
 * ```
 *
 * @param scan_settings_path - Path to the settings file. Defaults to `SCAN_SETTINGS_STORE_NAME_DEFAULT`.
 * @returns The parsed {@link ScanSettings} object if file exists and is valid JSON, otherwise `undefined`.
 */
export declare function readScanSettings(scan_settings_path?: string): Promise<ScanSettingsOpened | undefined>;
export declare function readPrivateSpendKeyFromEnv(primary_address: string): string | undefined;
export declare function readPrivateViewKeyFromEnv(primary_address: string): string | undefined;
export declare function readWalletFromScanSettings(primary_address: string, scan_settings_path?: string): Promise<ScanSettingOpened | undefined>;
export declare function readWalletsFromScanSettings(scan_settings_path?: string): Promise<ScanSettingOpened[]>;
export declare function walletSettingsPlusKeys(wallet_settings: ScanSettingOpened, secret_view_key?: string, secret_spend_key?: string): Promise<{
    secret_view_key: string;
    secret_spend_key: string | undefined;
    primary_address: string;
    start_height: number | null;
    node_url: string;
    subaddress_index?: number;
    halted?: boolean;
    wallet_route?: string;
    wallet_name?: string;
    wallet_slot?: number;
}>;
export declare function writeWalletToScanSettings(params: WriteScanSettingParams): Promise<number>;
export declare function openScanSettingsFile(scan_settings_path?: string): Promise<ScanSettings | undefined>;
export declare function openNonHaltedWallets(scan_settings_path?: string): Promise<ScanSettingOpened[]>;
export declare function getNonHaltedWallets(scan_settings?: ScanSettings): ScanSetting[];
export declare function doesScanSettingsFileExist(scan_settings_path?: string): Promise<boolean>;
/**
 * Either 1. the consumer explicitly sets a pathprefix, we extract it from the scan_settings_path
 * or we pick the default which is nothing
 * @param scan_settings_path optional scan settings path
 * @param pathPrefix optional path prefix
 * @returns definite path prefix
 */
export declare function getPathPrefix(scan_settings_path?: string, pathPrefix?: string): string;
