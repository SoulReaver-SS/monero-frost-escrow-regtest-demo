import { type ScanResult } from "./scanResult";
import type { CacheRange, ChangedOutput, ScanCache } from "./scanCache";
export declare function handleReorg(current_range: CacheRange, result: ScanResult, cache: ScanCache, oldRange: CacheRange): [CacheRange, ChangedOutput[]];
