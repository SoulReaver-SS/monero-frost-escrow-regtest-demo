import { get_info, NodeUrl, signTransaction, ViewPair, } from "../../api";
import { prepareInput, sumPayments, } from "../../send-functionality/inputSelection";
import { createWebworker } from "../backgroundWorker";
import { spendable } from "./scanResult";
import { getPathPrefix, readPrivateSpendKeyFromEnv, SCAN_SETTINGS_STORE_NAME_DEFAULT, SUB_ADDRESS_INDEX_DEFAULT_VALUE, walletSettingsPlusKeys, } from "../../api";
import { ScanSettingsOpened } from "../../scansettings/scanSettingsOpened";
import { ConnectionStatusOpened } from "../connectionStatusOpened";
import { findRange, lastRange, readCacheFileDefaultLocation, writeCacheFileDefaultLocationThrows, } from "./scanCache";
import { alignScanStatsWithCache, isSelfSpent, processTxlogInputs, processTxlogPayments, writeStatsFileDefaultLocation, } from "./scanStats";
import { readWriteConnectionStatusFile, } from "../connectionStatus";
export class ScanCacheOpened {
    _scanSettings;
    view_pair;
    wallet_route;
    wallet_name;
    wallet_slot;
    no_worker;
    masterCacheChanged;
    _start_height;
    scan_settings_path;
    pathPrefix;
    workerError;
    /** how many decoys to sample per input (default 20, ring size is 11) */
    decoySampleCount = 20;
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
    decoyRetry = false;
    /** sample sizes to try when decoyRetry is enabled, in order */
    decoyRetrySizes = [20, 50, 100, 200, 500];
    static async create(params) {
        // same dir as workers / connection status: next to ScanSettings.json
        const pathPrefix = getPathPrefix(params.scan_settings_path, params.pathPrefix);
        const theCatchToBeOpened = await readCacheFileDefaultLocation(params.primary_address, pathPrefix);
        if (!params.primary_address)
            throw new Error(`primary_address is required, potentially half filled out wallet setting in: ${params.scan_settings_path || SCAN_SETTINGS_STORE_NAME_DEFAULT}`);
        // use ScanSettingsOpened instead of direct scanSettings calls
        const scanSettings = await ScanSettingsOpened.create(params.scan_settings_path, pathPrefix);
        const walletSettings = scanSettings.getWallet(params.primary_address);
        if (!walletSettings)
            throw new Error(`wallet not found in settings. did you call openwallet with the right params?
      Either wrong file name supplied to params.scan_settings_path: ${params.scan_settings_path}
      Or wrong primary_address supplied params.primary_address: ${params.primary_address}`);
        const walletWithSettings = {
            ...walletSettings,
            node_url: scanSettings.node_url,
            start_height: scanSettings.start_height,
        };
        // read secret_view_key and secret_spend_key from env
        const walletSettingsWithKeys = await walletSettingsPlusKeys(walletWithSettings);
        // create viewpair + ScanCacheOpened instance
        const scanCacheOpen = new ScanCacheOpened(scanSettings, await ViewPair.create(params.primary_address, walletSettingsWithKeys.secret_view_key, walletSettings.subaddress_index, scanSettings.node_url), walletSettings.wallet_route, walletSettings.wallet_name, walletSettings.wallet_slot, params.no_worker || false, params.masterCacheChanged || null, scanSettings.start_height, params.scan_settings_path, pathPrefix, params.workerError);
        if (theCatchToBeOpened)
            scanCacheOpen._cache = theCatchToBeOpened;
        if (!walletSettings.halted) {
            // run webworker (respecting halted param + setting)
            // unpause will start scanning from this.wallet_scan_settings.start_height
            await scanCacheOpen.unpause();
        }
        scanCacheOpen._highest_subaddress_index =
            walletSettings.subaddress_index || SUB_ADDRESS_INDEX_DEFAULT_VALUE;
        if (!params.no_stats) {
            scanCacheOpen._stats = await alignScanStatsWithCache(scanCacheOpen._cache, scanCacheOpen.view_pair, params.primary_address, pathPrefix, walletSettings.subaddress_index, lastRange(scanCacheOpen._cache.scanned_ranges)?.end);
        }
        else {
            scanCacheOpen._no_stats = params.no_stats; // true
        }
        return scanCacheOpen;
    }
    get start_height() {
        return this._start_height;
    }
    get subaddress_index() {
        if (typeof this._highest_subaddress_index === "undefined" ||
            this._highest_subaddress_index === null)
            return SUB_ADDRESS_INDEX_DEFAULT_VALUE;
        return this._highest_subaddress_index;
    }
    get current_height() {
        // progress on the range that covers start_height (start can jump;
        // lastRange would pick a different segment and be wrong)
        const current_range = findRange(this._cache.scanned_ranges, this._start_height || 0);
        return current_range == null ? null : current_range.end;
    }
    get current_top_range_height() {
        if (typeof this._stats === "undefined" || this._stats === null)
            return this.current_height;
        return this._stats.height;
    }
    async changeStartHeight(start_height) {
        await this.stopWorker();
        await this._scanSettings.setStartHeight(start_height);
        this._start_height = start_height;
        await this.unpause();
    }
    get cache() {
        return this._cache;
    }
    get prepending_txs() {
        const txs = [];
        for (const txlog of this._cache.tx_logs || []) {
            if (!txlog ||
                !txlog.sendResult ||
                (txlog.sendResult && txlog.sendResult.status !== "OK"))
                continue;
            const { inputSum, alreadyRecognizedAsSpend } = processTxlogInputs(txlog, this._cache);
            if (alreadyRecognizedAsSpend)
                continue;
            const outWardPaymentSum = processTxlogPayments(txlog, this._cache);
            const self_spent = isSelfSpent(txlog.payments[0].address, this._cache);
            const destination_address = txlog.payments[0].address;
            const inputs = [];
            for (const inputId of txlog.inputs_index) {
                const input = this._cache.outputs[inputId];
                inputs.push(input);
            }
            const typical_fee = 1000000000n; // 0.001 XMR
            const amount = -outWardPaymentSum - typical_fee;
            const prepending_tx = {
                amount,
                txlog,
                inputSum,
                outWardPaymentSum,
                self_spent,
                destination_address,
                inputs,
            };
            txs.push(prepending_tx);
        }
        return txs;
    }
    get transactions() {
        if (typeof this._stats === "undefined" || this._stats === null)
            return [];
        const transactions = [];
        for (const tx of this._stats?.ordered_transactions) {
            transactions.push(this._stats.found_transactions[tx]);
        }
        return transactions;
    }
    get primary_address() {
        return this.view_pair.primary_address;
    }
    get node_url() {
        return this.view_pair.node_url;
    }
    set node_url(nu) {
        this.view_pair.node_url = nu;
    }
    get merchant_confirmations() {
        return this._scanSettings.merchant_confirmations;
    }
    get cpu_worker_count() {
        return this._scanSettings.cpu_worker_count;
    }
    get logs() {
        return this._scanSettings.logs;
    }
    get logs_include() {
        return this._scanSettings.logs_include;
    }
    get logs_exclude() {
        return this._scanSettings.logs_exclude;
    }
    async changeNodeUrlAndStartHeight(node_url, start_height) {
        await this.stopWorker();
        if (node_url !== undefined) {
            await this._scanSettings.setNodeUrl(node_url);
            this.node_url = node_url;
        }
        if (start_height !== undefined) {
            await this._scanSettings.setStartHeight(start_height);
            this._start_height = start_height;
        }
        await this.unpause();
    }
    async changeNodeUrl(node_url) {
        await this.stopWorker();
        await this._scanSettings.setNodeUrl(node_url);
        this.node_url = node_url;
        await this.unpause();
    }
    async setMerchantConfirmations(merchant_confirmations) {
        await this._scanSettings.setMerchantConfirmations(merchant_confirmations);
    }
    async setCpuWorkerCount(cpu_worker_count) {
        await this.stopWorker();
        await this._scanSettings.setCpuWorkerCount(cpu_worker_count);
        await this.unpause();
    }
    async setLogSettings(logs, logs_include, logs_exclude) {
        await this.stopWorker();
        await this._scanSettings.setLogSettings(logs, logs_include, logs_exclude);
        await this.unpause();
    }
    async setWalletName(name) {
        await this._scanSettings.setWalletName(this.view_pair.primary_address, name);
    }
    async retry() {
        await this.stopWorker();
        //  scansettings  so external changes (e.g. from a sidebar frontend instance) are picked up
        await this._scanSettings.reload();
        const walletStillExists = this._scanSettings.walletExists(this.primary_address);
        if (walletStillExists) {
            // if there is no scan settings file,
            // the retry loop is stopped.
            // the wallet reset happens through deleting all the scan setting + cache files
            // we want any background retry loops to stop in this case
            //TODO ? write connection status retry
            await this.unpause();
        }
        return walletStillExists;
    }
    async sendTransaction(signedTx) {
        const node = await NodeUrl.create(this.node_url);
        return await node.sendRawTransaction(signedTx);
    }
    async signTransaction(unsignedTx) {
        const privateSpendKey = readPrivateSpendKeyFromEnv(this._cache.primary_address);
        if (!privateSpendKey)
            throw new Error("privateSpendKey not found in env");
        return await signTransaction(unsignedTx, privateSpendKey);
    }
    async getFeeEstimate() {
        const node = await NodeUrl.create(this.node_url);
        const feeEstimate = await node.getFeeEstimate();
        const feePerByte = BigInt(feeEstimate.fees[0]);
        const max_plausible_fee = 20000000000n; // 0.02 XMR
        const feeFor10kb = feePerByte * 10000n;
        //2. check if fee is too high
        if (feeFor10kb > max_plausible_fee) {
            throw new Error(`fee too high:
          ${feeFor10kb} (fee for 10kb tx size) > ${max_plausible_fee} (0.001 XMR)
          most likely your node is faulty. connect to another node.
           preferably run one yourself locally.`);
        }
        return feeEstimate;
    }
    async calculateFeeAndSelectInputs(params) {
        const sum = sumPayments(params.payments);
        const node = await NodeUrl.create(this.node_url);
        // 1. get fee estimate
        const feeEstimate = await node.getFeeEstimate();
        const feePerByte = BigInt(feeEstimate.fees[0]);
        if (!params.no_fee_circuit_breaker) {
            // default is false / undefined -> use fee circuit breaker
            const max_plausible_fee = 20000000000n; // 0.02 XMR
            const feeFor10kb = feePerByte * 10000n;
            //2. check if fee is too high
            if (feeFor10kb > max_plausible_fee) {
                throw new Error(`fee too high:
          ${feeFor10kb} (fee for 10kb tx size) > ${max_plausible_fee} (0.001 XMR)
          most likely your node is faulty. connect to another node.
           preferably run one yourself locally.`);
            }
        }
        // 3. select inputs TODO: log inputs indices
        const selectedInputs = params.inputs || this.selectInputs(sum, feePerByte);
        if (!selectedInputs.length)
            throw new Error("not enough funds");
        return { selectedInputs, feeEstimate };
    }
    async makeTransactionFromSelectedInputs(payments, selectedInputs, feeEstimate) {
        // 4. get output distribution
        const node = await NodeUrl.create(this.node_url);
        const distibution = await node.getOutputDistribution();
        const inputs = [];
        for (const input of selectedInputs) {
            // 5. sample decoys & get outs from node: here is where a privacy compromising event could happen
            const sizesToTry = this.decoyRetry
                ? this.decoyRetrySizes
                : [this.decoySampleCount];
            let madeInput;
            for (const size of sizesToTry) {
                if (madeInput)
                    break;
                try {
                    const prepared = prepareInput(node, distibution, input, size);
                    const wasmInput = node.makeInput(prepared.input, prepared.sample.candidates, await prepared.outsResponse);
                    madeInput = wasmInput;
                }
                catch (e) {
                    if (size === sizesToTry[sizesToTry.length - 1])
                        throw e;
                    // fall through to next size
                }
            }
            if (!madeInput)
                throw new Error("failed to make input");
            inputs.push(madeInput);
        }
        // 7. make transaction: combine inputs, payments + fee info
        const unsignedTx = this.view_pair.makeTransaction({
            inputs,
            payments,
            fee_response: feeEstimate,
            fee_priority: "unimportant",
        });
        return unsignedTx;
    }
    async makeSweepTransactionFromSelectedInputs(destination_address, selectedInputs, feeEstimate) {
        // 4. get output distribution
        const node = await NodeUrl.create(this.node_url);
        const distibution = await node.getOutputDistribution();
        const inputs = [];
        for (const input of selectedInputs) {
            // 5. sample decoys & get outs from node: here is where a privacy compromising event could happen
            const sizesToTry = this.decoyRetry
                ? this.decoyRetrySizes
                : [this.decoySampleCount];
            let madeInput;
            for (const size of sizesToTry) {
                if (madeInput)
                    break;
                try {
                    const prepared = prepareInput(node, distibution, input, size);
                    const wasmInput = node.makeInput(prepared.input, prepared.sample.candidates, await prepared.outsResponse);
                    madeInput = wasmInput;
                }
                catch (e) {
                    if (size === sizesToTry[sizesToTry.length - 1])
                        throw e;
                    // fall through to next size
                }
            }
            if (!madeInput)
                throw new Error("failed to make input");
            inputs.push(madeInput);
        }
        // 7. make transaction: combine inputs, payments + fee info
        const unsignedTx = this.view_pair.makeSweepTransaction({
            inputs,
            payments: [
                {
                    address: destination_address,
                    amount: "0",
                },
            ],
            fee_response: feeEstimate,
            fee_priority: "unimportant",
        });
        return unsignedTx;
    }
    /**
     * this function returns the unsigned transaction, throws {@link SendError}
     */
    async makeTransaction(params) {
        const { selectedInputs, feeEstimate } = await this.calculateFeeAndSelectInputs(params);
        return await this.makeTransactionFromSelectedInputs(params.payments, selectedInputs, feeEstimate);
    }
    /**
     * sweep inputs to external wallet address (the wallet will receive input amount - fee)
     * @param inputs     use spendableInputs() to find inputs to put in
     */
    async sweepToExternalWallet(destination_address, inputs) {
        const feeEstimate = await this.getFeeEstimate();
        return await this.makeSweepTransactionFromSelectedInputs(destination_address, inputs, feeEstimate);
    }
    get daemon_height() {
        return this._cache.daemon_height;
    }
    get amount() {
        if (this.no_stats)
            throw new Error("instance has no_stats option active");
        return this._stats?.total_spendable_amount || 0n;
    }
    get pending_amount() {
        if (this.no_stats)
            throw new Error("instance has no_stats option active");
        return this._stats?.total_pending_amount || 0n;
    }
    get subaddresses() {
        if (this.no_stats)
            throw new Error("instance has no_stats option active");
        return Object.values(this._stats?.subaddresses || {});
    }
    get tx_logs() {
        return this._cache.tx_logs || [];
    }
    async makeSignSendTransaction(params) {
        let maybeInputs = [];
        let maybeFeeEstimate;
        let maybeSendResult;
        try {
            const { selectedInputs, feeEstimate } = await this.calculateFeeAndSelectInputs(params);
            maybeInputs = selectedInputs;
            maybeFeeEstimate = feeEstimate;
            const unsignedTx = await this.makeTransactionFromSelectedInputs(params.payments, selectedInputs, feeEstimate);
            const signedTx = await this.signTransaction(unsignedTx);
            const sendResult = await this.sendTransaction(signedTx);
            maybeSendResult = sendResult;
            if (sendResult.status !== "OK")
                throw new Error("send raw transaction rpc returned error");
            // before writing the scan cache, we stop the worker to avoid a race
            await this.stopWorker();
            // write txlog to cache + update pending_spent_utxos (affects stats + spendability)
            await writeCacheFileDefaultLocationThrows({
                primary_address: this.primary_address,
                pathPrefix: this.pathPrefix,
                writeCallback: async (cache) => {
                    if (!cache.tx_logs)
                        cache.tx_logs = [];
                    if (!cache.pending_spent_utxos)
                        cache.pending_spent_utxos = {};
                    const inputs_index = selectedInputs.map((input) => String(input.index_on_blockchain));
                    const txLog = {
                        sendResult,
                        feeEstimate,
                        payments: params.payments,
                        node_url: this.node_url,
                        inputs_index,
                        height: this.current_height,
                        timestamp: Date.now(),
                    };
                    const newLen = cache.tx_logs.push(txLog);
                    const txLogIndex = newLen - 1;
                    for (const inputId of inputs_index) {
                        cache.pending_spent_utxos[inputId] = txLogIndex;
                    }
                },
            });
            const newCache = await readCacheFileDefaultLocation(this.primary_address, this.pathPrefix);
            if (!newCache)
                throw new Error(`cache not found for primary address: ${this.primary_address}, and path prefix: ${this.pathPrefix}`);
            const changed_outputs = selectedInputs.map((input) => ({
                change_reason: "spent",
                output: input,
            }));
            await this.feed({
                newCache,
                changed_outputs,
            });
            // restart the worker
            await this.unpause();
            return sendResult;
        }
        catch (e) {
            // before writing the scan cache, we stop the worker to avoid a race
            await this.stopWorker();
            // write txlog error to cache
            await writeCacheFileDefaultLocationThrows({
                primary_address: this.primary_address,
                pathPrefix: this.pathPrefix,
                writeCallback: async (cache) => {
                    if (!cache.tx_logs)
                        cache.tx_logs = [];
                    if (!cache.pending_spent_utxos)
                        cache.pending_spent_utxos = {};
                    const inputs_index = maybeInputs.map((input) => String(input.index_on_blockchain));
                    const txLog = {
                        sendResult: maybeSendResult,
                        error: String(e || "unknown error"),
                        feeEstimate: maybeFeeEstimate,
                        payments: params.payments,
                        node_url: this.node_url,
                        inputs_index,
                        height: this.current_height,
                        timestamp: Date.now(),
                    };
                    const newLen = cache.tx_logs.push(txLog);
                },
            });
            const newCache = await readCacheFileDefaultLocation(this.primary_address, this.pathPrefix);
            if (!newCache)
                throw new Error(`cache not found for primary address: ${this.primary_address}, and path prefix: ${this.pathPrefix}`);
            const changed_outputs = maybeInputs.map((input) => ({
                change_reason: "spent",
                output: input,
            }));
            await this.feed({
                newCache,
                changed_outputs,
            });
            // restart the worker
            await this.unpause();
            throw e;
        }
    }
    /**
     * makeStandardTransaction
     */
    makeStandardTransaction(destination_address, amount) {
        return this.makeTransaction({
            payments: [{ address: destination_address, amount }],
        });
    }
    /**
     * makeIntegratedAddress
     */
    makeIntegratedAddress(paymentId) {
        return this.view_pair.makeIntegratedAddress(paymentId);
    }
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
    async makeSubaddress() {
        // reload scansettings so external changes (e.g. from a sidebar frontend instance) are picked up
        await this._scanSettings.reload();
        const walletSettings = this._scanSettings.getWallet(this.view_pair.primary_address);
        if (!walletSettings)
            throw new Error(`wallet not found in settings. did you call openwallet with the right params?
      Either wrong file name supplied to params.scan_settings_path: ${this.scan_settings_path}
      Or wrong primary_address supplied params.primary_address: ${this.view_pair.primary_address}`);
        const last_subaddress_index = walletSettings.subaddress_index || 0;
        const minor = last_subaddress_index + 1;
        const subaddress = this.view_pair.makeSubaddress(minor);
        this._highest_subaddress_index = minor;
        await this._scanSettings.setSubaddressIndex(this.view_pair.primary_address, minor);
        const created_at_height = lastRange(this._cache.scanned_ranges)?.end || 0;
        const created_at_timestamp = new Date().getTime();
        const new_subaddress = {
            minor,
            address: subaddress,
            created_at_height,
            created_at_timestamp,
            not_yet_included: true,
        };
        if (!this._no_stats)
            this._stats = await writeStatsFileDefaultLocation({
                primary_address: this.primary_address,
                pathPrefix: getPathPrefix(this.scan_settings_path, this.pathPrefix),
                writeCallback: async (stats) => {
                    stats.subaddresses[minor.toString()] = new_subaddress;
                },
            });
        return new_subaddress;
    }
    /**
     * notify
     *
     * ChangeReason = "added" | "ownspend" | "reorged" | "burned";
     */
    //TODO PAUSE NOTIFY listner and node status / connection error
    notify(callback) {
        this.notifyListeners.push(callback);
        const id = this.notifyListeners.length - 1;
        return {
            remove: () => (this.notifyListeners[id] = null),
        };
    }
    async pause() {
        await this.stopWorker();
        return await this._scanSettings.haltWallet(this.view_pair.primary_address);
    }
    // debug: dump coordinator + cpu worker heaps while they are live
    // in browser: use inspector directly, this is only useful for bun
    async dumpWorkerHeaps(dir) {
        if (!this.worker?.dumpHeaps)
            return [];
        return await this.worker.dumpHeaps(dir);
    }
    async stopWorker() {
        if (this.worker) {
            const worker = this.worker;
            // clear ref first so concurrent stop/retry cannot double shutdown
            this.worker.cpuWorkers = [];
            this.worker.fetchWorker = undefined;
            delete this.worker;
            // drain coordinator first, then hard kill workers
            try {
                await worker.shutdown();
            }
            catch {
                // still terminate below
            }
            try {
                worker.terminate();
            }
            catch {
            }
        }
    }
    async unpause() {
        // if worker does not exist yet, start it (if we are not slave / no_worker)
        if (!this.worker && !this.no_worker) {
            this.worker = await createWebworker(async (params) => await this.feed(params), this.scan_settings_path, this.pathPrefix, (params) => this._onWorkerError(params));
        }
        return await this._scanSettings.unhaltWallet(this.view_pair.primary_address);
    }
    _onWorkerError = (error) => {
        const workerErrCB = this.workerError;
        this.stopWorker();
        readWriteConnectionStatusFile((cs) => {
            if (cs?.last_packet.status === "catastrophic_reorg")
                return;
            const connectionStatus = {
                ...cs,
                last_packet: {
                    status: "connection_failed",
                    bytes_read: 0,
                    node_url: this.node_url,
                    timestamp: new Date().toISOString(),
                },
            };
            return connectionStatus;
        }, this.scan_settings_path).then(() => {
            if (workerErrCB)
                workerErrCB(error);
        });
    };
    /**
     * selectInputs returns array of inputs, whose sum is larger than amount
     * adds approximate fee for 10kb transaction to amount if feePerByte is supplied
     */
    selectInputs(amount, feePerByte) {
        if (feePerByte)
            amount += feePerByte * 10000n; // 10kb * feePerByte; for sweeping low amounts inputs[] supplied directly
        const oneInputIsEnough = this.selectOneInput(amount);
        if (oneInputIsEnough)
            return [oneInputIsEnough];
        return this.selectMultipleInputs(amount);
    }
    /**
     * selectOneInput larger than amount, (smallest one matching this amount)
     */
    selectOneInput(amount) {
        return this.spendableInputs()
            .filter((output) => output.amount >= amount)
            .sort((a, b) => {
            if (b.amount > a.amount)
                return -1;
            if (b.amount < a.amount)
                return 1;
            return a.block_height - b.block_height;
        })[0];
    }
    /**
     * selectMultipleInputs larger than amount, sorted from largest to smallest until total reaches amount
     */
    selectMultipleInputs(amount) {
        const selected = [];
        let total = 0n;
        for (const output of this.spendableInputs()) {
            selected.push(output);
            total += output.amount;
            if (total >= amount)
                return selected;
        }
        return [];
    }
    /**
     * get spendableInputs
     */
    spendableInputs() {
        return Object.values(this._cache.outputs)
            .filter((output) => spendable(output, this._cache, this.current_height || 0))
            .sort((a, b) => (a.amount > b.amount ? -1 : a.amount < b.amount ? 1 : 0));
    }
    /**
     * feed the ScanCacheOpened with new ScanCache as syncing happens
     * if primary_address does not match, do not feed
     * if masterCacheChanged is set, it will be called here
     * for all primary addresses
     */
    async feed(params) {
        //TODO update aggregated amount stats + height
        if (this.masterCacheChanged)
            this.masterCacheChanged(params);
        if (this.view_pair.primary_address !== params.newCache.primary_address)
            return;
        this._cache = params.newCache;
        if (!this._no_stats)
            this._stats = await alignScanStatsWithCache(this._cache, this.view_pair, this.primary_address, getPathPrefix(this.scan_settings_path, this.pathPrefix), this.subaddress_index, lastRange(this._cache.scanned_ranges)?.end);
        for (const listener of this.notifyListeners) {
            if (listener)
                listener(params);
        }
    }
    _highest_subaddress_index = null;
    _no_stats = false;
    get no_stats() {
        return this._no_stats;
    }
    _cache = {
        daemon_height: 0,
        outputs: {},
        own_key_images: {},
        scanned_ranges: [],
        primary_address: "",
    };
    worker = undefined;
    last_eta_height = null;
    last_eta_timestamp = null;
    constructor(_scanSettings, view_pair, wallet_route, wallet_name, wallet_slot, no_worker, masterCacheChanged, _start_height, scan_settings_path, pathPrefix, workerError) {
        this._scanSettings = _scanSettings;
        this.view_pair = view_pair;
        this.wallet_route = wallet_route;
        this.wallet_name = wallet_name;
        this.wallet_slot = wallet_slot;
        this.no_worker = no_worker;
        this.masterCacheChanged = masterCacheChanged;
        this._start_height = _start_height;
        this.scan_settings_path = scan_settings_path;
        this.pathPrefix = pathPrefix;
        this.workerError = workerError;
    }
    _stats = null;
    notifyListeners = [];
}
export class ManyScanCachesOpened {
    connectionStatusOpened;
    _scanSettings;
    _options;
    get start_height() {
        if (this.wallets.length === 0)
            return null;
        return this.wallets[0]?.start_height;
    }
    // overall scan tip = lagging non-halted wallet (this.wallets is already non-halted)
    get current_height() {
        let min = null;
        for (const w of this.wallets) {
            const h = w.current_height;
            if (h == null)
                continue;
            if (min == null || h < min)
                min = h;
        }
        return min;
    }
    get node_url() {
        if (this.wallets.length === 0)
            return "";
        return this.wallets[0]?.node_url;
    }
    async changeNodeUrlAndStartHeight(node_url, start_height) {
        if (this.wallets.length === 0)
            return;
        const masterWallet = this.wallets[0];
        return await masterWallet.changeNodeUrlAndStartHeight(node_url, start_height);
    }
    async retry() {
        if (this.wallets.length === 0)
            return;
        const masterWallet = this.wallets[0];
        return await masterWallet.retry();
    }
    async stopWorker() {
        if (this.wallets.length === 0)
            return;
        const masterWallet = this.wallets[0];
        return await masterWallet.stopWorker();
    }
    // debug: dump live coordinator + cpu worker heaps via master wallet workers
    // in browser: use inspector directly, this is only useful for bun
    async dumpWorkerHeaps(dir) {
        if (this.wallets.length === 0)
            return [];
        return await this.wallets[0].dumpWorkerHeaps(dir);
    }
    async changeNodeUrl(node_url) {
        if (this.wallets.length === 0)
            return;
        const masterWallet = this.wallets[0];
        return await masterWallet.changeNodeUrl(node_url);
    }
    get merchant_confirmations() {
        if (this.wallets.length === 0)
            return undefined;
        return this.wallets[0]?.merchant_confirmations;
    }
    get cpu_worker_count() {
        if (this.wallets.length === 0)
            return undefined;
        return this.wallets[0]?.cpu_worker_count;
    }
    get logs() {
        return this._scanSettings.logs;
    }
    get logs_include() {
        return this._scanSettings.logs_include;
    }
    get logs_exclude() {
        return this._scanSettings.logs_exclude;
    }
    get connectionStatus() {
        return this.connectionStatusOpened.connectionStatus;
    }
    get daemonHeight() {
        return this.connectionStatusOpened.daemonHeight;
    }
    watchConnectionStatus(intervalMs) {
        this.connectionStatusOpened.watch(intervalMs);
    }
    unwatchConnectionStatus() {
        this.connectionStatusOpened.unwatch();
    }
    async setMerchantConfirmations(merchant_confirmations) {
        if (this.wallets.length === 0)
            return;
        return await this.wallets[0].setMerchantConfirmations(merchant_confirmations);
    }
    async setCpuWorkerCount(cpu_worker_count) {
        if (this.wallets.length === 0)
            return;
        return await this.wallets[0].setCpuWorkerCount(cpu_worker_count);
    }
    async setLogSettings(logs, logs_include, logs_exclude) {
        return await this._scanSettings.setLogSettings(logs, logs_include, logs_exclude);
    }
    async setWalletName(primary_address, name) {
        await this._scanSettings.setWalletName(primary_address, name);
    }
    async setWalletSlot(primary_address, slot) {
        await this._scanSettings.setWalletSlot(primary_address, slot);
    }
    async changeStartHeight(start_height) {
        if (this.wallets.length === 0)
            return;
        const masterWallet = this.wallets[0];
        return await masterWallet.changeStartHeight(start_height);
    }
    static async _buildWallets(scanSettingsOpened, options) {
        const { scan_settings_path, pathPrefix, no_worker, no_stats, workerError, notifyMasterChanged, } = options;
        const nonHaltedWallets = scanSettingsOpened.wallets.filter((wallet) => !wallet?.halted);
        if (!nonHaltedWallets.length)
            return undefined;
        const openedWallets = [];
        const firstNonHaltedWallet = nonHaltedWallets[0];
        if (nonHaltedWallets.length > 1) {
            const slaveWallets = [];
            for (const wallet of nonHaltedWallets.slice(1)) {
                if (!wallet || wallet.halted)
                    continue;
                const slaveWallet = await ScanCacheOpened.create({
                    ...wallet,
                    no_worker: true, // slaves depend on master worker
                    scan_settings_path,
                    pathPrefix,
                    no_stats,
                });
                slaveWallets.push(slaveWallet);
            }
            const masterWallet = await ScanCacheOpened.create({
                ...firstNonHaltedWallet,
                masterCacheChanged: async (params) => {
                    notifyMasterChanged?.(params);
                    for (const slave of slaveWallets) {
                        await slave.feed(params);
                    }
                },
                scan_settings_path,
                pathPrefix,
                no_stats,
                no_worker, // pass no_worker, if you want to manually feed()
                workerError,
            });
            openedWallets.push(masterWallet, ...slaveWallets);
        }
        else {
            const onlyWallet = await ScanCacheOpened.create({
                masterCacheChanged: async (params) => {
                    notifyMasterChanged?.(params);
                },
                ...firstNonHaltedWallet,
                scan_settings_path,
                pathPrefix,
                no_stats,
                no_worker, // pass no_worker, if you want to manually feed()
                workerError,
            });
            openedWallets.push(onlyWallet);
        }
        return openedWallets;
    }
    static async create(options) {
        const { scan_settings_path, pathPrefix, onConnectionStatusChange, connectionStatusIntervalMs, autoRetry, retryDelayMs, } = options;
        const scanSettingsOpened = await ScanSettingsOpened.create(scan_settings_path, pathPrefix);
        // persist log options into ScanSettings.json before workers start
        if (options.logs !== undefined ||
            options.logs_include !== undefined ||
            options.logs_exclude !== undefined) {
            await scanSettingsOpened.setLogSettings(options.logs !== undefined ? options.logs : scanSettingsOpened.logs, options.logs_include !== undefined
                ? options.logs_include
                : scanSettingsOpened.logs_include, options.logs_exclude !== undefined
                ? options.logs_exclude
                : scanSettingsOpened.logs_exclude);
        }
        // wrap workerError with auto-retry
        let retryTimer;
        let instance = null;
        const retryFn = async () => {
            // no wallets means idle, do not rebuild or restart workers
            if (!instance || instance.wallets.length === 0) {
                clearTimeout(retryTimer);
                retryTimer = undefined;
                return;
            }
            await instance.buildWallets();
            // still empty after rebuild, stay idle
            if (instance.wallets.length === 0) {
                clearTimeout(retryTimer);
                retryTimer = undefined;
                return;
            }
            const node_url = instance.node_url;
            if (!node_url)
                throw new Error("No nodeurl set, can't retry connection");
            const getinfo_result = await get_info(node_url)
                .then((r) => {
                r?.status === "OK";
            })
                .catch(() => false);
            if (getinfo_result)
                await instance?.retry();
            clearTimeout(retryTimer);
            retryTimer = undefined;
        };
        const newOptions = { ...options };
        let connectionFailedShown = false;
        if (autoRetry) {
            const originalError = options.workerError;
            newOptions.workerError = (err) => {
                originalError?.(err);
                const msg = err instanceof Error ? err.message : String(err);
                if (csOpened.connectionStatus?.last_packet?.status ===
                    "catastrophic_reorg") {
                    clearTimeout(retryTimer);
                    instance?.stopWorker();
                    throw new Error("catastrophic reorg, aborting ...");
                }
                if (msg.includes("connect") ||
                    msg.includes("fetch") ||
                    msg.includes("NetworkError")) {
                    if (!connectionFailedShown) {
                        connectionFailedShown = true;
                        console.error("unable to connect to node ... retrying ...");
                    }
                }
                // only schedule retry when we still have wallets to scan
                if (!retryTimer && instance && instance.wallets.length > 0) {
                    retryTimer = setTimeout(retryFn, retryDelayMs ?? 5000);
                }
            };
        }
        const wallets = (await this._buildWallets(scanSettingsOpened, newOptions)) ?? [];
        const csOpened = new ConnectionStatusOpened(scan_settings_path || SCAN_SETTINGS_STORE_NAME_DEFAULT, autoRetry
            ? (status) => {
                if (status?.last_packet?.status === "OK" && connectionFailedShown) {
                    connectionFailedShown = false;
                    console.log("connection to node established");
                }
                if (onConnectionStatusChange)
                    onConnectionStatusChange(status);
            }
            : (onConnectionStatusChange ?? null));
        csOpened.watch(connectionStatusIntervalMs);
        instance = new ManyScanCachesOpened(wallets, csOpened, scanSettingsOpened, newOptions);
        return instance;
    }
    async buildWallets() {
        await this.stopWorker();
        await this.reloadWalletsAfterStop();
    }
    // assumes stopWorker already ran (graceful shutdown + terminate)
    async reloadWalletsAfterStop() {
        await this._scanSettings.reload();
        // empty after reload: stay idle, do not open ScanCacheOpened or start workers
        const remaining = this._scanSettings.wallets.filter((w) => !w?.halted);
        if (remaining.length === 0) {
            this._wallets = [];
            return;
        }
        const newWallets = await ManyScanCachesOpened._buildWallets(this._scanSettings, this._options);
        this._wallets = newWallets ?? [];
    }
    async addViewWallet(primary_address, view_key, fields) {
        await this.stopWorker();
        await this._scanSettings.addViewWallet(primary_address, view_key, fields);
        await this.reloadWalletsAfterStop();
    }
    async addSpendWallet(wallet_secret, fields) {
        await this.stopWorker();
        await this._scanSettings.addSpendWallet(wallet_secret, fields);
        await this.reloadWalletsAfterStop();
    }
    async removeWallet(primary_address) {
        await this.stopWorker();
        await this._scanSettings.removeWallet(primary_address);
        await this.reloadWalletsAfterStop();
    }
    async feed(params) {
        if (this.wallets.length === 0)
            return;
        await this.wallets[0].feed(params);
    }
    _wallets = [];
    get wallets() {
        return this._wallets;
    }
    constructor(wallets, connectionStatusOpened, _scanSettings, _options) {
        this.connectionStatusOpened = connectionStatusOpened;
        this._scanSettings = _scanSettings;
        this._options = _options;
        this._wallets = wallets;
    }
}
