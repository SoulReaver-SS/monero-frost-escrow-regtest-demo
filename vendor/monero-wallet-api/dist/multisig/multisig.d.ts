import type { DkgErrorResponse, DkgParticipateParams, DkgParticipateResult, DkgVerifyParams, DkgVerifyResult, DkgVerifyValidResult } from "./DistributedKeyGenerator";
export declare class MultiSig {
    private worker?;
    /**
     * set up a distributed key generator with t threshold and n total participants
     * @param t  - total number of multisig participants
     * @param n  - threshold to sign a transaction
     * @returns  - Promise<DistributedKeyGenerator>
     */
    static createAndSetupGenerators(t: number, n: number): Promise<MultiSig>;
    stopWorker(): void;
    startWorker(t: number, n: number): Promise<void>;
    /**
     * participate in a DKG round (nothrow).
     *
     * @param params dkg_secret_key as 64-byte hex string, context, dkg_public_keys array (length is n implicitly), t (threshold)
     * @returns The participation message as hex, or an error object
     */
    participateNoThrow(params: DkgParticipateParams): Promise<DkgParticipateResult | DkgErrorResponse>;
    /**
     * verify DKG participations and extract the group key (nothrow).
     *
     * @param params dkg_secret_key as 64-byte hex string, context, t (threshold), dkg_public_keys array (length is n implicitly),
     *  participations [ paricipant index -> hex participation message ]
     * @returns The group key and params, faulty participants, not-enough message, or error
     */
    verifyNoThrow(params: DkgVerifyParams): Promise<DkgVerifyResult | DkgErrorResponse>;
    /**
     * participate in a DKG round (throws on error).
     */
    participate(params: DkgParticipateParams): Promise<DkgParticipateResult>;
    /**
     * verify DKG participations and extract the group key (throws on error).
     */
    verify(params: DkgVerifyParams): Promise<DkgVerifyValidResult>;
}
