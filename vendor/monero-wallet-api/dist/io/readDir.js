import { readdir as indexedDBreaddir } from "./indexedDB";
export async function readDir(path) {
    if (areWeInTheBrowser)
        return await indexedDBreaddir(path);
    const { readdir } = await import("node:fs/promises");
    return await readdir(path);
}
