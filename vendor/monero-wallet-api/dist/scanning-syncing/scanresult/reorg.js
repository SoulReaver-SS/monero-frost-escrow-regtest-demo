import { makeNewRange } from "./scanResult";
export function handleReorg(current_range, result, cache, oldRange) {
    let changed_outputs = [];
    console.log("[handleReorg] oldRange hashes:", oldRange.block_hashes.map((h) => h.block_height + ":" + h.block_hash.slice(0, 8)));
    console.log("[handleReorg] cache outputs:", Object.entries(cache.outputs).map(([id, o]) => "h=" + o.block_height + " spent=" + (o.spent_block_height ?? "no")));
    console.log("[handleReorg] result infos:", result.block_infos.length +
        " blocks, first=" +
        result.block_infos[0]?.block_height, "last=" + result.block_infos.at(-1)?.block_height);
    // we need to check where anchor candidate is and if not found, try the same for anchor
    // if else throw on catastrophic reorg
    for (const block_hash of oldRange.block_hashes) {
        const split_height_index = result.block_infos.findIndex((b) => b.block_hash === block_hash.block_hash);
        if (!(split_height_index > 0))
            continue;
        console.log("[handleReorg] trying hash", block_hash.block_height, block_hash.block_hash.slice(0, 8), "found at idx", split_height_index);
        const split_height = result.block_infos[split_height_index];
        // still a chance to find the split height, (could be candidate_anchor or anchor)
        if (!split_height)
            continue;
        // we found the split height & do the reorg
        console.log("[handleReorg] SPLIT FOUND at height", split_height.block_height);
        if (!cache.reorg_info) {
            cache.reorg_info = {
                split_heights: [split_height],
                removed_outputs: [],
                reverted_spends: [],
            };
        }
        else {
            cache.reorg_info.split_heights.push(split_height);
        }
        // First, collect reverted spends from all outputs (before any removals)
        // so that outputs with block_height < split_height but spent_block_height >= split_height are captured
        const reverted_outputs = Object.entries(cache.outputs).filter(([id, output]) => output.spent_block_height !== undefined &&
            output.spent_block_height >= split_height.block_height);
        const removed_outputs = Object.entries(cache.outputs).filter(([id, output]) => output.block_height >= split_height.block_height);
        console.log("[handleReorg] removed_outputs count:", removed_outputs.length, "reverted count:", reverted_outputs.length);
        for (const [id, old_output_state] of removed_outputs) {
            // 1. find key_image of output to be removed (as it was reorged)
            const [key_image] = Object.entries(cache.own_key_images).find(([own_key_image, globalid]) => globalid === id) || [""]; // if this is viewonly the key_image will be empty
            cache.reorg_info.removed_outputs.push({
                old_output_state,
                key_image,
                split_height,
            });
            // 2. remove from outputs and own_key_images
            delete cache.outputs[id];
            delete cache.own_key_images[key_image];
            changed_outputs.push({
                output: old_output_state,
                change_reason: "reorged",
            });
        }
        for (const [id, old_output_state_pointer] of reverted_outputs) {
            const [key_image] = Object.entries(cache.own_key_images).find(([own_key_image, globalid]) => globalid === id) || [""]; // if this is viewonly the key_image will be empty
            const old_output_state = Object.assign({}, old_output_state_pointer);
            cache.reorg_info.reverted_spends.push({
                old_output_state,
                key_image, // in this case key_image only used here, does not get removed
                split_height,
            });
            // remove spend info from original cache (if output still exists
            // it may have been deleted above in the removed_outputs loop)
            if (cache.outputs[id]) {
                delete cache.outputs[id].spent_relative_index;
                delete cache.outputs[id].spent_in_tx_hash;
                delete cache.outputs[id].spent_block_height;
                delete cache.outputs[id].spent_block_timestamp;
            }
            changed_outputs.push({
                output: old_output_state,
                change_reason: "reorged_spent",
            });
        }
        // find current range in scanned ranges and change its end value + latest_block_hash
        oldRange.end = split_height.block_height;
        oldRange.block_hashes[0] = split_height;
        // fix current_range
        let anchor = result.block_infos.slice(-100)[0]; // if we got lots of new blocks
        const old_anchor = oldRange.block_hashes.at(-1);
        if (!anchor &&
            old_anchor &&
            split_height.block_height > old_anchor.block_height //if we did not get many new blocks + split height was candidate anchor
        ) {
            anchor = old_anchor; // we keep the anchor the same
        }
        if (!anchor)
            anchor = split_height;
        let last_block_hash_of_result = result.block_infos.at(-1);
        const end = last_block_hash_of_result.block_height;
        const start = current_range.start > end ? end : current_range.start;
        const newRange = {
            start,
            end,
            block_hashes: [last_block_hash_of_result, anchor, anchor],
        };
        return [makeNewRange(newRange, cache), changed_outputs];
    }
    // we tried all the block hashes and could not find the split height
    throw new Error("Could not find reorg split height. Most likely connected to faulty node / catastrophic reorg.");
}
