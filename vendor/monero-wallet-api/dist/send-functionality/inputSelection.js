export function sumPayments(payments) {
    return payments.reduce((sum, payment) => sum + BigInt(payment.amount), 0n);
}
export function prepareInput(node, distibution, input, how_many_to_sample = 20) {
    const sample = node.sampleDecoys(input.index_on_blockchain, distibution, how_many_to_sample);
    const outsResponse = node.getOutsBin(sample.candidates);
    return { input, sample, outsResponse };
}
