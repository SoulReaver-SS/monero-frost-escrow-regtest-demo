import { DistributedKeyGenerator, type DkgParticipateParams, type DkgVerifyParams } from "../../api";
export type MultiSigParticipateCall = {
    type: "multisig-call";
    functionName: "participate";
    params: DkgParticipateParams;
};
export type MultiSigVerifyCallMsg = {
    type: "multisig-call";
    functionName: "verify";
    params: DkgVerifyParams;
};
export type MultiSigWorkerCallMsg = MultiSigParticipateCall | MultiSigVerifyCallMsg;
export declare function multisigMainWorkerCall(msg: MultiSigWorkerCallMsg, dkg?: DistributedKeyGenerator): void;
