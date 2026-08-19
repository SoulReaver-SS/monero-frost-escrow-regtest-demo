import { log } from "./logging";
export async function atomicWrite(targetPath, data) {
    log("atomicWrite", ["writing to", targetPath]);
    // in the browser we don't have rename + indexedDB writes are atomic in any case
    if (areWeInTheBrowser)
        return await Bun.write(targetPath, data);
    const { rename } = await import("node:fs/promises");
    const tempPath = targetPath + ".tmp." + Date.now() + "." + Math.random();
    const bytesWritten = await Bun.write(tempPath, data);
    try {
        await rename(tempPath, targetPath);
    }
    catch (e) {
        //eat rename failed
    }
    return bytesWritten;
}
