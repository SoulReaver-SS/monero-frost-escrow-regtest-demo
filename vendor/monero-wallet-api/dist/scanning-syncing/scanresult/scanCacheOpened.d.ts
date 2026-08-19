import { ViewPair, type FeeEstimateResponse, type Output, type SendRawTransactionResult } from "../../api";
import { type Payment } from "../../send-functionality/inputSelection";
import { ConnectionStatusOpened } from "../connectionStatusOpened";
import type { LogSetting, PossibleLogs } from "../../io/logging";
import { type CacheChangedCallback, type CacheChangedCallbackParameters, type ScanCache, type Subaddress, type TxLog } from "./scanCache";
import { type FoundTransaction, type PrePendingTx } from "./scanStats";
import { type ConnectionStatus } from "../connectionStatus";
export type SlaveScanCache = boolean;
export type ScanCacheOpenedCreateParams = {
    primary_address: string;
    scan_settings_path?: string;
    pathPrefix?: string;
    no_worker?: boolean;
    no_stats?: boolean;
    masterCacheChanged?: CacheChangedCallback;
    workerError?: (error: unknown) => void;
};
export type CreateTransactionParams = {
    payments: Payment[];
    inputs?: Output[];
    no_fee_circuit_breaker?: boolean;
};
export declare class ScanCacheOpened {
    private _scanSettings;
    readonly view_pair: ViewPair;
    readonly wallet_route: string | undefined;
    readonly wallet_name: string | undefined;
    readonly wallet_slot: number | undefined;
    readonly no_worker: boolean;
    readonly masterCacheChanged: CacheChangedCallback | null;
    private _start_height;
    private scan_settings_path?;
    private pathPrefix?;
    private workerError?;
    /** how many decoys to sample per input (default 20, ring size is 11) */
    decoySampleCount: number;
    /**
     * when true, retry makeInput with higher sample counts on failure.
     *
     * PRIVACY WARNING: retrying contacts the node multiple times for the same
     * input, each time with a different set of candidate indices. this lets the
     * node correlate which output is the real spend across the retries.
     * only ever enable this on your own local trusted node, never on a remote
     * public node.
     *
     * defaults to false, on failure the original error propagates.
     */
    decoyRetry: boolean;
    /** sample sizes to try when decoyRetry is enabled, in order */
    readonly decoyRetrySizes: number[];
    static create(params: ScanCacheOpenedCreateParams): Promise<ScanCacheOpened>;
    get start_height(): number | null;
    get subaddress_index(): number;
    get current_height(): number | null;
    get current_top_range_height(): number | null;
    changeStartHeight(start_height: number | null): Promise<void>;
    get cache(): ScanCache;
    get prepending_txs(): PrePendingTx[];
    get transactions(): FoundTransaction[];
    get primary_address(): string;
    get node_url(): string;
    private set node_url(value);
    get merchant_confirmations(): number | null | undefined;
    get cpu_worker_count(): number | undefined;
    get logs(): LogSetting | undefined;
    get logs_include(): PossibleLogs[] | undefined;
    get logs_exclude(): PossibleLogs[] | undefined;
    changeNodeUrlAndStartHeight(node_url?: string, start_height?: number | null): Promise<void>;
    changeNodeUrl(node_url: string): Promise<void>;
    setMerchantConfirmations(merchant_confirmations: number | null): Promise<void>;
    setCpuWorkerCount(cpu_worker_count: number | undefined): Promise<void>;
    setLogSettings(logs?: LogSetting | null, logs_include?: PossibleLogs[] | null, logs_exclude?: PossibleLogs[] | null): Promise<void>;
    setWalletName(name?: string): Promise<void>;
    retry(): Promise<boolean>;
    sendTransaction(signedTx: string): Promise<SendRawTransactionResult>;
    signTransaction(unsignedTx: string): Promise<string>;
    getFeeEstimate(): Promise<FeeEstimateResponse>;
    calculateFeeAndSelectInputs(params: CreateTransactionParams): Promise<{
        selectedInputs: Output[];
        feeEstimate: {
            status: string;
            fee: number;
            quantization_mask: number;
            fees?: number[] | undefined;
        };
    }>;
    makeTransactionFromSelectedInputs(payments: Payment[], selectedInputs: Output[], feeEstimate: FeeEstimateResponse): Promise<string>;
    makeSweepTransactionFromSelectedInputs(destination_address: string, selectedInputs: Output[], feeEstimate: FeeEstimateResponse): Promise<string>;
    /**
     * this function returns the unsigned transaction, throws {@link SendError}
     */
    makeTransaction(params: CreateTransactionParams): Promise<string>;
    /**
     * sweep inputs to external wallet address (the wallet will receive input amount - fee)
     * @param inputs     use spendableInputs() to find inputs to put in
     */
    sweepToExternalWallet(destination_address: string, inputs: Output[]): Promise<string>;
    get daemon_height(): number;
    get amount(): bigint;
    get pending_amount(): bigint;
    get subaddresses(): Subaddress[];
    get tx_logs(): TxLog[];
    makeSignSendTransaction(params: CreateTransactionParams): Promise<SendRawTransactionResult>;
    /**
     * makeStandardTransaction
     */
    makeStandardTransaction(destination_address: string, amount: string): Promise<string>;
    /**
     * makeIntegratedAddress
     */
    makeIntegratedAddress(paymentId: number): string;
    /**
     * This method makes a Subaddress for the Address of the Viewpair it was opened with.
     * The network (mainnet, stagenet, testnet) is the same as the one of the Viewpairaddress.
     * will increment minor by 1 on major 0 in "ScanSettings.json" subaddresses definition
     *
     * if there is an active scan going on, call this here on ScanCacheOpened, so the new subaddress will be scanned
     * (and not on a viewpair / scancacheopened instance that is not conducting the scan, aka where no_worker is true)
     *
     * @returns Adressstring
     */
    makeSubaddress(): Promise<Subaddress>;
    /**
     * notify
     *
     * ChangeReason = "added" | "ownspend" | "reorged" | "burned";
     */
    notify(callback: CacheChangedCallback): {
        remove: () => null;
    };
    pause(): Promise<void>;
    dumpWorkerHeaps(dir?: string): Promise<string[]>;
    stopWorker(): Promise<void>;
    unpause(): Promise<void>;
    private _onWorkerError;
    /**
     * selectInputs returns array of inputs, whose sum is larger than amount
     * adds approximate fee for 10kb transaction to amount if feePerByte is supplied
     */
    selectInputs(amount: bigint, feePerByte?: bigint): Output[];
    /**
     * selectOneInput larger than amount, (smallest one matching this amount)
     */
    selectOneInput(amount: bigint): Output | undefined;
    /**
     * selectMultipleInputs larger than amount, sorted from largest to smallest until total reaches amount
     */
    selectMultipleInputs(amount: bigint): Output[];
    /**
     * get spendableInputs
     */
    spendableInputs(): Output[];
    /**
     * feed the ScanCacheOpened with new ScanCache as syncing happens
     * if primary_address does not match, do not feed
     * if masterCacheChanged is set, it will be called here
     * for all primary addresses
     */
    feed(params: CacheChangedCallbackParameters): Promise<void>;
    private _highest_subaddress_index;
    private _no_stats;
    get no_stats(): boolean;
    private _cache;
    private worker?;
    private last_eta_height;
    private last_eta_timestamp;
    private constructor();
    private _stats;
    private notifyListeners;
}
export type ManyScanCachesOpenedCreateOptions = {
    scan_settings_path?: string;
    pathPrefix?: string;
    no_worker?: boolean;
    notifyMasterChanged?: CacheChangedCallback;
    no_stats?: boolean;
    workerError?: (error: unknown) => void;
    autoRetry?: boolean;
    retryDelayMs?: number;
    connectionStatusIntervalMs?: number;
    onConnectionStatusChange?: ((status: ConnectionStatus | null) => void) | null;
    logs?: LogSetting;
    logs_include?: PossibleLogs[];
    logs_exclude?: PossibleLogs[];
};
export declare class ManyScanCachesOpened {
    readonly connectionStatusOpened: ConnectionStatusOpened;
    private _scanSettings;
    private _options;
    get start_height(): number | null;
    get current_height(): number | null;
    get node_url(): string;
    changeNodeUrlAndStartHeight(node_url?: string, start_height?: number | null): Promise<void>;
    retry(): Promise<boolean | undefined>;
    stopWorker(): Promise<void>;
    dumpWorkerHeaps(dir?: string): Promise<string[]>;
    changeNodeUrl(node_url: string): Promise<void>;
    get merchant_confirmations(): number | null | undefined;
    get cpu_worker_count(): number | undefined;
    get logs(): LogSetting | undefined;
    get logs_include(): PossibleLogs[] | undefined;
    get logs_exclude(): PossibleLogs[] | undefined;
    get connectionStatus(): ConnectionStatus | null;
    get daemonHeight(): number | undefined;
    watchConnectionStatus(intervalMs?: number): void;
    unwatchConnectionStatus(): void;
    setMerchantConfirmations(merchant_confirmations: number | null): Promise<void>;
    setCpuWorkerCount(cpu_worker_count: number | undefined): Promise<void>;
    setLogSettings(logs?: LogSetting | null, logs_include?: PossibleLogs[] | null, logs_exclude?: PossibleLogs[] | null): Promise<void>;
    setWalletName(primary_address: string, name?: string): Promise<void>;
    setWalletSlot(primary_address: string, slot?: number): Promise<void>;
    changeStartHeight(start_height: number | null): Promise<void>;
    private static _buildWallets;
    static create(options: ManyScanCachesOpenedCreateOptions): Promise<ManyScanCachesOpened>;
    buildWallets(): Promise<void>;
    private reloadWalletsAfterStop;
    addViewWallet(primary_address: string, view_key: string, fields?: {
        wallet_name?: string;
        wallet_slot?: number;
        wallet_route?: string;
        subaddress_index?: number;
        halted?: boolean;
    }): Promise<void>;
    addSpendWallet(wallet_secret: Uint8Array, fields?: {
        wallet_name?: string;
        wallet_slot?: number;
        wallet_route?: string;
        subaddress_index?: number;
        halted?: boolean;
    }): Promise<void>;
    removeWallet(primary_address: string): Promise<void>;
    feed(params: CacheChangedCallbackParameters): Promise<void>;
    private _wallets;
    get wallets(): ScanCacheOpened[];
    private constructor();
}
