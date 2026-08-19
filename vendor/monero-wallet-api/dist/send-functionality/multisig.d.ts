import { WasmProcessor } from "../wasm-processing/wasmProcessor";
export type DkgGetPublicKeyResult = {
    dkg_public_key: string;
};
export type DkgParticipateParams = {
    dkg_secret_key: string;
    context: string;
    dkg_public_keys: string[];
    t: number;
};
export type DkgParticipateResult = {
    participation: string;
};
export type DkgVerifyParams = {
    dkg_secret_key: string;
    context: string;
    t: number;
    dkg_public_keys: string[];
    participations: Record<string, string>;
};
export type DkgVerifyValidResult = {
    group_key: string;
    t: number;
    n: number;
};
export type DkgVerifyInvalidResult = {
    faulty_participants: number[];
};
export type DkgVerifyNotEnoughResult = {
    message: "NotEnoughParticipants";
};
export type DkgVerifyResult = DkgVerifyValidResult | DkgVerifyInvalidResult | DkgVerifyNotEnoughResult;
export type DkgErrorResponse = {
    message: string;
};
export declare class DistributedKeyGenerator extends WasmProcessor {
    /**
     * set up a distributed key generator with t threshold and n total participants
     * @param t  - total number of multisig participants
     * @param n  - threshold to sign a transaction
     * @returns
     */
    static create(t: number, n: number): Promise<DistributedKeyGenerator>;
    /**
     * setupGenerators
     * configure the max threshold and max participants for the DKG generators.
     * if never called, defaults to 16, 16 used automatically on first DKG operation.
     */
    setupGenerators(t: number, n: number): void;
    /**
     * derive the DKG public key from a 64-byte DKG secret key.
     *
     * @param dkgSecretKeyBytes 64-byte DKG secret key (from seed function)
     * @returns the DKG public key as a hex string, or an error object
     */
    getPublicKey(dkgSecretKeyBytes: Uint8Array): DkgGetPublicKeyResult | DkgErrorResponse;
    /**
     * participate in a DKG round.
     *
     * @param params dkg_secret_key as 64-byte hex string, context, dkg_public_keys array (length is n implicitly), t (threshold)
     * @returns The participation message as hex, or an error object
     */
    participate(params: DkgParticipateParams): DkgParticipateResult | DkgErrorResponse;
    /**
     * verify DKG participations and extract the group key.
     *
     * @param params dkg_secret_key as 64-byte hex string, context, t (threshold), dkg_public_keys array (length is n implicitly),
     *  participations [ paricipant index -> hex participation message ]
     * @returns The group key and params, faulty participants, not-enough message, or error
     */
    verify(params: DkgVerifyParams): DkgVerifyResult | DkgErrorResponse;
}
