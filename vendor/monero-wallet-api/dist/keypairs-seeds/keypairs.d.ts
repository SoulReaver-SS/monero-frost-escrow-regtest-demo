/**
 * "So when we first decided to create a mnemonic system the spec we
 * came up with was: take the seed from the mnemonic, hash it for the
 * spend key, hash it twice for the view key. Somewhere during the
 * simplewallet implementation we forgot about that, and just used the
 * mnemonic seed as the spendkey directly.
 *
 * This proved to be a blessing in disguise, though, as we'd not realised
 * that people might want to retrieve their seed. Using our original
 * design this wouldn't have been possible, as we didn't store the seed
 * in the wallet file.
 *
 * Much later on when we were creating MyMonero (a different group of
 * developers, I'm the only common link between the two) we decided that
 * a 13 word seed would be much easier for people to remember, but
 * because we wanted it to match simplewallet's implementation we made
 * sure that we followed the spec... as it was originally... before we
 * duffed the implementation."
 */
export type SpendKey = string;
export type Keypair = {
    spend_key: SpendKey;
    view_key: ViewPairJson;
};
/**
 *  use this function to generate a keypair for testing
 * @returns spendkey and viewkey (contains primary address, for mainnet, testnet,stagenet)
 */
export declare function makeTestKeyPair(): Promise<Keypair>;
/**
 *  use this function to generate a spend key for testing
 *  use the spend key to generate a view key with the makeViewKey function
 * @returns SpendKey
 */
export declare function makeSpendKey(): Promise<SpendKey>;
export declare function makeSpendKeyFromSeed(wallet_secret: string): Promise<SpendKey>;
export type ViewPairJson = {
    view_key: string;
    mainnet_primary: string;
    stagenet_primary: string;
    testnet_primary: string;
};
/**
 * spend private key is hashed with keccak to make the view private key
 * this is according to the convention in the monero code base,
 * read the comment at the top of the file for more details & link to source
 * @param spend_private_key the spendkey the viewkey will be derived from
 * @returns the viewkey that was derive from the spendkey
 */
export declare function makeViewKey(spend_private_key: string): Promise<ViewPairJson>;
/**
 * entropy is hashed with keccak to make the view private key
 * this is according to the convention in the monero code base,
 * read the comment at the top of the file for more details & link to source
 * @param entropy the spendkey the viewkey will be derived from
 * @returns the viewkey that was derived from entropy as hex
 */
export declare function vk_from_entropy(entropy: Uint8Array): Promise<string>;
