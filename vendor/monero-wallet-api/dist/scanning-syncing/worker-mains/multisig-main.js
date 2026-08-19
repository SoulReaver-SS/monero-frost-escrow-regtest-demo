import { DistributedKeyGenerator, } from "../../api";
import { log } from "../../io/logging";
export function multisigMainWorkerCall(msg, dkg) {
    if (!dkg) {
        const error = new Error("multisigMainWorkerCall called without setup DistributedKeyGenerator first");
        console.error("[multisigMainWorkerCall] error:", error);
        log("multisigMainWorkerCall", ["error:", error]);
        self.postMessage({ type: "ERROR", payload: error });
    }
    else if (msg.type === "multisig-call") {
        const functionName = msg.functionName;
        const params = msg.params;
        log("multisigMainWorkerCall", [
            `received call to ${functionName}() with params:`,
            params,
        ]);
        let result;
        if (functionName === "participate") {
            result = dkg.participateNoThrow(params);
        }
        else if (functionName === "verify") {
            result = dkg.verifyNoThrow(params);
        }
        log("multisigMainWorkerCall", [
            `received call to ${functionName}() with params, got result`,
            params,
            result,
        ]);
        self.postMessage({ type: "multisig-call-result", result });
    }
}
