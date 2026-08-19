import { coordinatorMainWorker, requestCoordinatorShutdown, } from "./coordinator-main";
import { handleCpuboundScanTry, sendFromCpuWorker } from "./cpubound-main";
import { log, setupLoggingPath } from "../../io/logging";
import { multisigMainWorkerCall } from "./multisig-main";
import { DistributedKeyGenerator, SCAN_SETTINGS_STORE_NAME_DEFAULT, } from "../../api";
self.onerror = (e) => self.postMessage({ type: "ERROR", payload: e });
self.addEventListener("unhandledrejection", (e) => self.postMessage({ type: "ERROR", payload: e.reason }));
let SCAN_SETTINGS_PATH;
let PATH_PREFIX;
let cpuPort;
const cpu_worker_status = { cancel: false };
// true while a scan is running so idle cancel can ack immediately
let cpu_work_in_flight = false;
let multisig_dkg;
export function CPU_PORT_HANDLER(pe) {
    if (pe.data === "cancel") {
        if (cpu_work_in_flight) {
            cpu_worker_status.cancel = true;
            return;
        }
        // idle cancel: ack right away so coordinator drain does not hang
        if (cpuPort) {
            sendFromCpuWorker(cpuPort, { type: "Canceled" });
        }
        return;
    }
    if (!cpuPort)
        throw new Error("[cpubound] cpuPort is undefined in port.onmessage");
    log("CPU_PORT_HANDLER", "new workitem msg received");
    cpu_work_in_flight = true;
    cpuPort.postMessage({
        type: "WORKSTART",
        work_uuid: pe.data.work_uuid,
    });
    handleCpuboundScanTry(pe.data, cpu_worker_status).then((result) => {
        log("CPU_PORT_HANDLER", "work finished, sending result");
        cpu_work_in_flight = false;
        if (!cpuPort)
            throw new Error("[cpubound] cpuPort is undefined in port.onmessage");
        cpuPort.onmessage = CPU_PORT_HANDLER;
        sendFromCpuWorker(cpuPort, result);
    });
}
const handleMessage = async (e) => {
    const msg = e.data;
    log("handleMessage", ["msg received", msg]);
    if (msg.type === "shutdown") {
        // only coordinator listens for this; abort fetch + race loop
        requestCoordinatorShutdown();
        return;
    }
    if (msg.type === "heap_snapshot") {
        try {
            const path = typeof msg.path === "string" && msg.path.length > 0
                ? msg.path
                : `worker-heap-${Date.now()}.heapsnapshot`;
            // @ts-ignore bun has generateHeapSnapshot; node has v8.writeHeapSnapshot
            let out;
            if (typeof Bun !== "undefined" && typeof Bun.generateHeapSnapshot === "function") {
                const snap = Bun.generateHeapSnapshot("v8");
                await Bun.write(path, typeof snap === "string" ? snap : JSON.stringify(snap));
                out = path;
            }
            else {
                throw Error("in the browser use the inspector directly to observe worker memory growth");
                // const v8 = await import("node:v8");
                // out = v8.writeHeapSnapshot(path);
            }
            self.postMessage({ type: "HEAP_SNAPSHOT_DONE", path: out ?? path });
        }
        catch (err) {
            self.postMessage({
                type: "HEAP_SNAPSHOT_ERROR",
                error: err instanceof Error ? err.message : String(err),
            });
        }
        return;
    }
    if (msg.type === "setup") {
        const settingsPath = msg.scan_settings_path || SCAN_SETTINGS_STORE_NAME_DEFAULT;
        SCAN_SETTINGS_PATH = settingsPath;
        PATH_PREFIX = msg.pathPrefix;
        await setupLoggingPath(settingsPath, msg.pathPrefix ?? "", msg.role, msg.cpu_worker_id);
        if (msg.role === "cpubound") {
            cpuPort = e.ports[0];
            if (cpuPort) {
                cpuPort.onmessage = CPU_PORT_HANDLER;
                cpuPort.addEventListener("message", (e) => {
                    log("handleMessage", ["message received", e]);
                });
                cpuPort.addEventListener("messageerror", (e) => {
                    log("handleMessage", ["messageerror received", e]);
                });
            }
        }
        else if (msg.role === "coordinator") {
            const cpuPorts = [...e.ports];
            coordinatorMainWorker(SCAN_SETTINGS_PATH, PATH_PREFIX, cpuPorts).catch((err) => {
                self.postMessage({
                    type: "ERROR",
                    payload: err?.message ?? String(err),
                });
            });
        }
        else if (msg.role === "multisig") {
            DistributedKeyGenerator.createAndSetupGenerators(msg.t, msg.n).then((dkg) => {
                multisig_dkg = dkg;
                self.postMessage({ type: "multisig-ready" });
            });
        }
    }
    else if (msg.type === "multisig-call") {
        multisigMainWorkerCall(msg, multisig_dkg);
    }
};
function handleMessageTry(e) {
    try {
        handleMessage(e);
    }
    catch (error) {
        console.error("[worker] error:", error);
        self.postMessage({ type: "ERROR", payload: error });
    }
}
self.onmessage = handleMessageTry;
// signal main thread that onmessage handler is installed
self.postMessage({ type: "WORKER_READY" });
