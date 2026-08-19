import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { MultiSig, getDkgPublicKey, makeEscrowContext } from "../vendor/monero-wallet-api/dist/api.js";

const runtimeDir = process.env.FROST_MONERO_RUNTIME_DIR ?? join(process.env.HOME ?? ".", ".local/share/frost-monero-regtest");
const mediator = JSON.parse(await readFile(join(runtimeDir, "mediator-public.json"), "utf8")) as { dkgPublicKey: string };
const threshold = 3;
const count = 5;
const secrets = Array.from({ length: 4 }, () => crypto.getRandomValues(new Uint8Array(64)));
const secretHex = secrets.map(secret => Buffer.from(secret).toString("hex"));
const publicKeys = [...await Promise.all(secrets.map(secret => getDkgPublicKey(secret))), mediator.dkgPublicKey];
const dkg = await Promise.all(Array.from({ length: count }, () => MultiSig.createAndSetupGenerators(threshold, count)));
const contextResult = makeEscrowContext(0);
if (!contextResult.context) throw new Error(`Escrow context failure: ${JSON.stringify(contextResult)}`);
const started = await Promise.all([0, 1, 2].map(index => dkg[index].participate({
  dkg_secret_key: secretHex[index], context: contextResult.context, dkg_public_keys: publicKeys, t: threshold,
})));
const participations = Object.fromEntries(started.map((result, index) => [String(index + 1), result.participation]));
const results = [];
for (let index = 0; index < 4; index += 1) {
  results.push(await dkg[index].verify({
    dkg_secret_key: secretHex[index], context: contextResult.context, dkg_public_keys: publicKeys, participations, t: threshold,
  }));
}
dkg.forEach(instance => instance.stopWorker());
console.log(JSON.stringify({ publicOnlyMediator: true, results }, null, 2));
