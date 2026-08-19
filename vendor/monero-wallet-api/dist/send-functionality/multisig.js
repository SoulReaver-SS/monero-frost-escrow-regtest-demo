import { frost_dkg_wasm } from "../wasm-processing/wasmFile";
import { WasmProcessor } from "../wasm-processing/wasmProcessor";
export class DistributedKeyGenerator extends WasmProcessor {
    /**
     * set up a distributed key generator with t threshold and n total participants
     * @param t  - total number of multisig participants
     * @param n  - threshold to sign a transaction
     * @returns
     */
    static async create(t, n) {
        const dkg = new DistributedKeyGenerator();
        await dkg.initWasmModule(frost_dkg_wasm);
        dkg.setupGenerators(t, n);
        return dkg;
    }
    /**
     * setupGenerators
     * configure the max threshold and max participants for the DKG generators.
     * if never called, defaults to 16, 16 used automatically on first DKG operation.
     */
    setupGenerators(t, n) {
        //@ts-ignore
        this.tinywasi.instance.exports.setup_generators(t, n);
    }
    /**
     * derive the DKG public key from a 64-byte DKG secret key.
     *
     * @param dkgSecretKeyBytes 64-byte DKG secret key (from seed function)
     * @returns the DKG public key as a hex string, or an error object
     */
    getPublicKey(dkgSecretKeyBytes) {
        // set up write callback: rust will call input(64) to read the secret key bytes
        this.writeToWasmMemory = (ptr, len) => {
            this.writeArray(ptr, len, dkgSecretKeyBytes);
        };
        // set up read callback: rust will call output_string() to return the result JSON
        let result;
        this.readFromWasmMemory = (ptr, len) => {
            result = JSON.parse(this.readString(ptr, len));
        };
        //@ts-ignore
        this.tinywasi.instance.exports.dkg_get_public_key();
        if (!result) {
            return { message: "No response from dkg_get_public_key" };
        }
        return result;
    }
    /**
     * participate in a DKG round.
     *
     * @param params dkg_secret_key as 64-byte hex string, context, dkg_public_keys array (length is n implicitly), t (threshold)
     * @returns The participation message as hex, or an error object
     */
    participate(params) {
        const jsonStr = JSON.stringify(params);
        // set up write callback: rust will call input_string(json_len) to read the JSON
        this.writeToWasmMemory = (ptr, len) => {
            this.writeString(ptr, len, jsonStr);
        };
        // set up read callback: rust will call output_string() to return the result JSON
        let result;
        this.readFromWasmMemory = (ptr, len) => {
            result = JSON.parse(this.readString(ptr, len));
        };
        //@ts-ignore
        this.tinywasi.instance.exports.dkg_participate(jsonStr.length);
        if (!result) {
            return { message: "No response from dkg_participate" };
        }
        return result;
    }
    /**
     * verify DKG participations and extract the group key.
     *
     * @param params dkg_secret_key as 64-byte hex string, context, t (threshold), dkg_public_keys array (length is n implicitly),
     *  participations [ paricipant index -> hex participation message ]
     * @returns The group key and params, faulty participants, not-enough message, or error
     */
    verify(params) {
        const jsonStr = JSON.stringify(params);
        // set up write callback: rust will call input_string(json_len) to read the JSON
        this.writeToWasmMemory = (ptr, len) => {
            this.writeString(ptr, len, jsonStr);
        };
        // set up read callback: rust will call output_string() to return the result JSON
        let result;
        this.readFromWasmMemory = (ptr, len) => {
            result = JSON.parse(this.readString(ptr, len));
        };
        //@ts-ignore
        this.tinywasi.instance.exports.dkg_verify(jsonStr.length);
        if (!result) {
            return { message: "No response from dkg_verify" };
        }
        return result;
    }
}
