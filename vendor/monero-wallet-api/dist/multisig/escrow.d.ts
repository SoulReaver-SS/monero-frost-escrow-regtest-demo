export declare function makeEscrowContext(context_index: number): {
    ok: boolean;
    error: string;
    context?: undefined;
    context_index?: undefined;
} | {
    ok: boolean;
    context: string;
    context_index: number;
    error?: undefined;
};
export declare function parseEscrowContext(input: string): {
    ok: boolean;
    error: string;
    context?: undefined;
    context_index?: undefined;
} | {
    ok: boolean;
    context: string;
    context_index: string;
    error?: undefined;
};
/**
 * To give users the ability to conveniently partake in escrow transactions,
 * the necessary secrets need to be organized well.
 *
 * The seedphrase package in this repository provides methods to derive
 * secrets from a "walletroute" and a bip39 seedphrase.
 *
 * The "walletroute" is a string that is human readable and gives
 * information on the context the wallet is created for.
 *
 * getWalletSecret() in the seedphrase package returns:
 * 64 bytes of key data - uses KDF ( bip39.mnemonicToSeedSync of noble bip39)
 *
 * We use this method to derive the escrow-viewpair-comms secret from the
 * "comms" key type of a walletroute. (consult the seedphrase package readme for more information)
 *
 * @param bip39_secret : 64 bytes key data
 * @returns 32 bytes secret
 */
export declare function deriveEscrowViewpairCommsSecret(bip39_secret: Uint8Array): Uint8Array<ArrayBufferLike> & Uint8Array<ArrayBuffer>;
export declare function escrowViewPairECDHgetPublicKey(vp_comms_secret: Uint8Array): Uint8Array<ArrayBufferLike> & Uint8Array<ArrayBuffer>;
/**
 * In the typical escrow setup, from the perspective of the customer,
 * the customer_sk is used together with the merchant pk to make the
 * escrow wallet viewpair.
 *
 * From the perspective of the merchant,
 *  the merchant_sk is used together with the customer pk to make the
 * escrow wallet viewpair.
 *
 * In the dispute flow case, the disputer shares the shared secret,
 * that resulted from this ECDH exchange with the arbitrator.
 * @param alice_sk - your viewpair secret
 * @param bob_pk - the other multisig (escrow) party's viewpair public key
 */
export declare function performEscrowViewPairECDH(alice_sk: Uint8Array, bob_pk: Uint8Array): Promise<string>;
