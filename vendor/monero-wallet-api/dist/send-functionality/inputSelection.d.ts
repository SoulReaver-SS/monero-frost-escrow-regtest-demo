import type { GetOutsResponseBuffer, NodeUrl, Output } from "../api";
import type { SampledDecoys } from "./transactionBuilding";
export type Payment = {
    address: string;
    amount: string;
};
export declare function sumPayments(payments: Payment[]): bigint;
export type PreparedInput = {
    input: Output;
    sample: SampledDecoys;
    outsResponse: Promise<GetOutsResponseBuffer>;
};
export declare function prepareInput(node: NodeUrl, distibution: number[], input: Output, how_many_to_sample?: number): PreparedInput;
