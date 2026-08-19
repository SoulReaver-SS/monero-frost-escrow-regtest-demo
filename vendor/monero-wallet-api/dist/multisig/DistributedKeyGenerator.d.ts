import { WasmProcessor } from "../wasm-processing/wasmProcessor";
/**
 * get the DKG public key from a 64-byte DKG secret key
 * @param dkgSecretKey - 64 byte Uint8Array dkg secret key
 * @returns - dkg public key as hex string
 */
export declare function getDkgPublicKey(dkgSecretKey: Uint8Array): Promise<string>;
/**
 * derive a Monero address (mainnet, stagenet, testnet) from a DKG group key.
 * spend_public_key is the group_key hex from dkg_verify output.
 * view_secret_key is the 32-byte view secret key hex. (see performEscrowViewPairECDH on how to get one)
 *
 * @returns object with view_key, mainnet_primary, stagenet_primary, testnet_primary
 */
export declare function getDkgMoneroAddress(spend_public_key: string, view_secret_key: string): Promise<DkgGetMoneroAddressResult>;
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
    i: number;
    threshold_key: string;
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
export type DkgGetMoneroAddressParams = {
    spend_public_key: string;
    view_secret_key: string;
};
export type DkgGetMoneroAddressResult = {
    view_key: string;
    mainnet_primary: string;
    stagenet_primary: string;
    testnet_primary: string;
};
export declare class DistributedKeyGenerator extends WasmProcessor {
    /**
     * create distributed key generator wasm instance,
     * without initializing generators
     * (in case you just want to get the public dkg key from a secret dkg key)
     *
     * @returns  - Promise<DistributedKeyGenerator>
     */
    static create(): Promise<DistributedKeyGenerator>;
    /**
     * set up a distributed key generator with t threshold and n total participants
     * @param t  - total number of multisig participants
     * @param n  - threshold to sign a transaction
     * @returns  - Promise<DistributedKeyGenerator>
     */
    static createAndSetupGenerators(t: number, n: number): Promise<DistributedKeyGenerator>;
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
     * participate in a DKG round (nothrow).
     *
     * @param params dkg_secret_key as 64-byte hex string, context, dkg_public_keys array (length is n implicitly), t (threshold)
     * @returns The participation message as hex, or an error object
     */
    participateNoThrow(params: DkgParticipateParams): DkgParticipateResult | DkgErrorResponse;
    /**
     * verify DKG participations and extract the group key (nothrow).
     *
     * @param params dkg_secret_key as 64-byte hex string, context, t (threshold), dkg_public_keys array (length is n implicitly),
     *  participations [ paricipant index -> hex participation message ]
     * @returns The group key and params, faulty participants, not-enough message, or error
     */
    verifyNoThrow(params: DkgVerifyParams): DkgVerifyResult | DkgErrorResponse;
    /**
     * derive a Monero address from a DKG group key.
     *
     * Input JSON keys expected by the rust wasm:
     *   spend_public_key (hex32) - the group_key hex from dkg_verify output
     *   view_secret_key (hex32) - 32-byte view secret key (see performEscrowViewPairECDH on how to get one)
     *
     * @param params - spendPublicKey and viewSecretKey as hex strings
     * @returns object with view_key, mainnet_primary, stagenet_primary, testnet_primary
     */
    getMoneroAddress(params: DkgGetMoneroAddressParams): DkgGetMoneroAddressResult | DkgErrorResponse;
    /**
     * participate in a DKG round (throws on error).
     */
    participate(params: DkgParticipateParams): DkgParticipateResult;
    /**
     * verify DKG participations and extract the group key (throws on error).
     */
    verify(params: DkgVerifyParams): DkgVerifyValidResult;
}
