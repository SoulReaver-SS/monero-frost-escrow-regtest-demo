import {} from "./computeKeyImage";
import { get_block_headers_range, } from "../../api";
import { atomicWrite } from "../../io/atomicWrite";
import { log } from "../../io/logging";
export async function initScanCache(viewpair, start_height, scan_settings_path, pathPrefix) {
    const initialCache = await readCacheFileDefaultLocation(viewpair.primary_address, pathPrefix);
    let cache = {
        daemon_height: 0,
        outputs: {},
        own_key_images: {},
        scanned_ranges: [],
        primary_address: viewpair.primary_address,
    };
    if (initialCache)
        cache = initialCache;
    let current_height = start_height;
    // merge existing ranges & find end of current range
    cache.scanned_ranges = mergeRanges(cache.scanned_ranges);
    let current_range = findRange(cache.scanned_ranges, current_height);
    let start_block_hash = current_range?.block_hashes[0];
    if (!start_block_hash) {
        const blockHeaderResponse = (await viewpair.getBlockHeadersRange({
            start_height,
            end_height: start_height,
        })).headers[0];
        start_block_hash = {
            block_hash: blockHeaderResponse.hash,
            block_height: blockHeaderResponse.height,
            block_timestamp: blockHeaderResponse.timestamp,
        };
        const newRange = {
            start: start_block_hash.block_height,
            end: start_block_hash.block_height,
            block_hashes: [start_block_hash, start_block_hash, start_block_hash],
        };
        current_range = newRange;
        cache.scanned_ranges.push(newRange);
    }
    if (!start_block_hash)
        throw new Error("could not find start block hash");
    if (current_range == null || !current_range?.block_hashes.length)
        throw new Error("current_range was malformed. block_hashes is empty");
    await viewpair.addSubaddressesToScanCache(cache, scan_settings_path);
    // write to cache
    await writeCacheToFile(cache, pathPrefix);
    return current_range;
}
export async function getBlockInfoForHeight(height, node_url) {
    const blockHeaderResponse = await get_block_headers_range(node_url, {
        start_height: height,
        end_height: height,
    });
    const header = blockHeaderResponse.headers[0];
    return {
        block_hash: header.hash,
        block_height: header.height,
        block_timestamp: header.timestamp,
    };
}
export async function makeCacheRangeForHeight(height, node_url) {
    const hash_at_height = await getBlockInfoForHeight(height, node_url);
    const newRange = {
        start: height,
        end: height,
        block_hashes: [hash_at_height, hash_at_height, hash_at_height],
    };
    return newRange;
}
export async function initScanCacheFile(viewpair, scan_settings_path, pathPrefix) {
    const initialCache = await readCacheFileDefaultLocation(viewpair.primary_address, pathPrefix);
    let cache = {
        daemon_height: 0,
        outputs: {},
        own_key_images: {},
        scanned_ranges: [],
        primary_address: viewpair.primary_address,
    };
    if (initialCache)
        cache = initialCache;
    cache.scanned_ranges = mergeRanges(cache.scanned_ranges);
    await viewpair.addSubaddressesToScanCache(cache, scan_settings_path);
    // write to cache
    await writeCacheToFile(cache, pathPrefix);
    return cache;
}
export async function readCacheFile(cacheFilePath) {
    const jsonString = await Bun.file(cacheFilePath)
        .text()
        .catch(() => undefined);
    return jsonString
        ? JSON.parse(jsonString, (key, value) => {
            if (key === "amount")
                return BigInt(value);
            return value;
        })
        : undefined;
}
export function cacheFileDefaultLocation(primary_address, pathPrefix) {
    if (pathPrefix && pathPrefix.endsWith("/"))
        pathPrefix = pathPrefix.slice(0, -1);
    if (pathPrefix)
        pathPrefix += "/";
    return `${pathPrefix ?? ""}${primary_address}_cache.json`;
}
export async function readCacheFileDefaultLocation(primary_address, pathPrefix) {
    return await readCacheFile(cacheFileDefaultLocation(primary_address, pathPrefix));
}
export async function writeCacheFileDefaultLocationThrows(params) {
    const cache = await readCacheFileDefaultLocation(params.primary_address, params.pathPrefix);
    if (!cache)
        throw new Error(`cache not found for primary address: ${params.primary_address}, and path prefix: ${params.pathPrefix}`);
    await params.writeCallback(cache);
    // write to cache
    await writeCacheToFile(cache, params.pathPrefix);
}
export async function writeCacheToFile(cache, pathPrefix) {
    // write to cache
    return await atomicWrite(cacheFileDefaultLocation(cache.primary_address, pathPrefix), JSON.stringify(cache, (key, value) => (typeof value === "bigint" ? value.toString() : value), 2));
}
export function lastRange(ranges) {
    if (!ranges.length)
        return undefined;
    return ranges.reduce((maxRange, current) => (current.end > maxRange.end ? current : maxRange), ranges[0]);
}
export function lastRangeThrows(ranges) {
    if (!ranges.length)
        throw new Error("ranges is empty");
    return ranges.reduce((maxRange, current) => (current.end > maxRange.end ? current : maxRange), ranges[0]);
}
export function mergeRanges(ranges) {
    if (ranges.length <= 1)
        return ranges.map((r) => ({ ...r }));
    const sorted = [...ranges].sort((a, b) => a.start - b.start);
    const merged = [sorted[0]];
    for (let i = 1; i < sorted.length; i++) {
        const curr = sorted[i];
        const last = merged[merged.length - 1];
        // If last range overlaps or touches current range
        if (curr.start <= last.end) {
            // Extend last range to cover both (take max end value)
            if (curr.end > last.end) {
                last.end = curr.end;
                last.block_hashes = curr.block_hashes;
            }
        }
        else {
            // No overlap: add current range as new merged interval
            merged.push(curr);
        }
    }
    return merged;
}
// find the cache range that contains the given height, if not found return null
export const findRange = (ranges, value) => ranges.find((r) => value >= r.start && value <= r.end) ?? null;
export function findRangeThrows(ranges, value) {
    const range = findRange(ranges, value);
    if (!range)
        throw new Error(`range not found for value: ${value}`);
    return range;
}
export function handleScanError(error) {
    // treat errno 0 code "ConnectionRefused" as non fatal outcome, and rethrow,
    // so that UI can be informed after catching it higher up
    if (isConnectionError(error)) {
        log("handleScanError", "Scan stopped. node might be offline. Connection Refused");
        throw error;
    }
    // Treat AbortError as a normal, non-fatal outcome
    if (error &&
        typeof error === "object" &&
        (("name" in error && error.name === "AbortError") ||
            ("code" in error && error.code === 20))) {
        log("handleScanError", "Scan was aborted.");
        return;
    }
    else {
        log("handleScanError", [
            error,
            "\n, scanWithCache in scanning-syncing/scanWithCache.ts`",
        ]);
        throw error;
    }
}
export function isConnectionError(error) {
    if (error &&
        typeof error === "object" &&
        (("code" in error && error.code === "ConnectionRefused") ||
            ("errno" in error && error.errno === 0))) {
        return true;
    }
    else {
        false;
    }
}
